#!/usr/bin/env node
// Gerador de meses do calendário editorial — Gustavo Schorr
//
// Lê o último mês preenchido do index.html, extrai a estrutura dele
// (dias da semana usados, frequência, mix de pilares, arco de objetivos)
// e pede ao modelo um mês novo que herde essa estrutura. O campo ESTRATEGIA
// sobrepõe a herança apenas naquilo que ele mencionar.
//
// Uso:
//   MES=outubro node scripts/gerar-mes.mjs
//   MES=2026-10 ESTRATEGIA="3 peças por semana, tema Black Friday" node scripts/gerar-mes.mjs
//   MES=novembro MODO=vazio ATE=dezembro node scripts/gerar-mes.mjs
//   MES=outubro MOCK=1 node scripts/gerar-mes.mjs

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(RAIZ, 'index.html');

const MARCA_INICIO = '/* ==== MESES:START · bloco mantido pelo script scripts/gerar-mes.mjs — NÃO remover estes marcadores ==== */';
const MARCA_FIM = '/* ==== MESES:END ==== */';

const MODELO = 'claude-opus-5';

const PILARES = [
  'Autoridade',
  'Bastidores',
  'Opinião',
  'Educação',
  'Expansão Internacional',
  'Liderança',
  'Futuro',
  'Histórias',
];

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ---------------------------------------------------------------- utilidades

const pad = (n) => String(n).padStart(2, '0');
const chave = (ano, mes) => `${ano}-${pad(mes)}`;

function normalizar(txt) {
  return String(txt).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function interpretarMes(bruto) {
  if (!bruto) return null;
  const t = String(bruto).trim();

  const comAno = t.match(/^(\d{4})-(\d{1,2})$/);
  if (comAno) return { ano: Number(comAno[1]), mes: Number(comAno[2]) };

  const barra = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (barra) return { ano: Number(barra[2]), mes: Number(barra[1]) };

  if (/^\d{1,2}$/.test(t)) return { ano: null, mes: Number(t) };

  const alvo = normalizar(t);
  const i = NOMES_MES.findIndex((n) => normalizar(n) === alvo);
  if (i >= 0) return { ano: null, mes: i + 1 };

  return null;
}

// Feriados nacionais brasileiros, incluindo os móveis.
// Páscoa pelo algoritmo de Meeus/Jones/Butcher — nunca chutar data.
function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data, dias) {
  return new Date(data.getTime() + dias * 86400000);
}

function feriadosNacionais(ano, mes) {
  const p = pascoa(ano);
  const fixos = [
    [1, 1, 'Confraternização Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência do Brasil'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'],
    [11, 20, 'Consciência Negra'],
    [12, 25, 'Natal'],
  ];
  const moveis = [
    [somarDias(p, -48), 'Carnaval (segunda)'],
    [somarDias(p, -47), 'Carnaval'],
    [somarDias(p, -2), 'Sexta-feira Santa'],
    [p, 'Páscoa'],
    [somarDias(p, 60), 'Corpus Christi'],
  ];

  const out = {};
  for (const [m, d, nome] of fixos) if (m === mes) out[pad(d)] = nome;
  for (const [data, nome] of moveis) {
    if (data.getUTCFullYear() === ano && data.getUTCMonth() + 1 === mes) {
      out[pad(data.getUTCDate())] = nome;
    }
  }
  return out;
}

function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function primeiroDiaSemana(ano, mes) {
  return new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
}

// -------------------------------------------------------------- serialização

// </script> dentro dos dados quebra o HTML. Escapar sempre.
function texto(s) {
  return JSON.stringify(String(s ?? '')).replace(/<\//g, '<\\/');
}

function lista(arr) {
  return `[${(arr ?? []).map(texto).join(',')}]`;
}

function serializarVideo(v) {
  const cenas = (v.roteiro ?? [])
    .map((c) => `\n  {c:${texto(c.c)},t:${texto(c.t)},d:${texto(c.d)}}`)
    .join(',');

  return `{
 n:${v.n},semana:${v.semana},dia:${v.dia},mes:${v.mes},ano:${v.ano},pilar:${texto(v.pilar)},duracao:${texto(v.duracao)},
 modelo:${texto(v.modelo || 'classico')},
 titulo:${texto(v.titulo)},
 objetivo:${texto(v.objetivo)},
 publico:${texto(v.publico)},
 hooks:${lista(v.hooks)},
 roteiro:[${cenas}
 ],
 broll:${lista(v.broll)},
 legendas:${lista(v.legendas)},
 impacto:${lista(v.impacto)},
 cta:${texto(v.cta)},
 titulos:{ig:${texto(v.titulos?.ig)},li:${texto(v.titulos?.li)},yt:${texto(v.titulos?.yt)}},
 desc:{ig:${texto(v.desc?.ig)},li:${texto(v.desc?.li)},fb:${texto(v.desc?.fb)},yt:${texto(v.desc?.yt)}},
 hash:{ig:${texto(v.hash?.ig)},li:${texto(v.hash?.li)},tt:${texto(v.hash?.tt)},yt:${texto(v.hash?.yt)}},
 thumb:{texto:${texto(v.thumb?.texto)},comp:${texto(v.thumb?.comp)},expr:${texto(v.thumb?.expr)}},
 cortes:{shorts:${texto(v.cortes?.shorts)},linkedin:${texto(v.cortes?.linkedin)},tiktok:${texto(v.cortes?.tiktok)}},
 srt:${texto(v.srt)}
}`;
}

export function serializarBloco(meses, videos) {
  const chaves = Object.keys(meses).sort();

  const linhasMeses = chaves.map((k) => {
    const m = meses[k];
    const fer = Object.entries(m.feriados ?? {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([d, nome]) => `'${d}':${texto(nome)}`)
      .join(',');
    return ` '${k}':{nome:${texto(m.nome)},ano:${m.ano},mes:${m.mes},dias:${m.dias},firstDow:${m.firstDow},feriados:{${fer}}}`;
  });

  // Chaves "10" a "31" são índices inteiros em JS e pulam na frente de "01"–"09".
  // Onde a ordem importa, ordenar explicitamente.
  const ordenados = [...videos].sort(
    (a, b) => a.ano - b.ano || a.mes - b.mes || a.dia - b.dia
  );

  return [
    MARCA_INICIO,
    `const MESES={\n${linhasMeses.join(',\n')}\n};`,
    `const VIDEOS=[\n${ordenados.map(serializarVideo).join(',\n')}\n];`,
    MARCA_FIM,
  ].join('\n');
}

// ---------------------------------------------------------- leitura do index

async function lerIndex() {
  const html = await readFile(INDEX, 'utf8');
  const ini = html.indexOf(MARCA_INICIO);
  const fim = html.indexOf(MARCA_FIM);
  if (ini < 0 || fim < 0) {
    throw new Error(
      'Marcadores MESES:START / MESES:END não encontrados em index.html. ' +
      'Eles não podem ser removidos — o gerador escreve entre eles.'
    );
  }
  const bloco = html.slice(ini, fim + MARCA_FIM.length);
  return { html, ini, fim: fim + MARCA_FIM.length, bloco };
}

async function avaliarBloco(bloco) {
  const corpo = bloco
    .replace(MARCA_INICIO, '')
    .replace(MARCA_FIM, '');
  const fn = new Function(`${corpo}\nreturn {MESES, VIDEOS};`);
  return fn();
}

// ------------------------------------------------------- análise da herança

function analisarEstrutura(meses, videos) {
  const chaves = Object.keys(meses).sort();
  const ultima = chaves[chaves.length - 1];
  if (!ultima) return null;

  const m = meses[ultima];
  const doMes = videos
    .filter((v) => v.ano === m.ano && v.mes === m.mes && !v.vazio)
    .sort((a, b) => a.dia - b.dia);

  if (!doMes.length) return null;

  const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const contDow = {};
  for (const v of doMes) {
    const dow = new Date(Date.UTC(m.ano, m.mes - 1, v.dia)).getUTCDay();
    contDow[DOW[dow]] = (contDow[DOW[dow]] ?? 0) + 1;
  }

  const contPilar = {};
  for (const v of doMes) contPilar[v.pilar] = (contPilar[v.pilar] ?? 0) + 1;

  const virais = doMes.filter((v) => v.modelo === 'viral');
  const youtube = doMes.filter((v) => v.modelo === 'youtube');

  const semanas = {};
  for (const v of doMes) semanas[v.semana] = (semanas[v.semana] ?? 0) + 1;

  return {
    chave: ultima,
    nome: m.nome,
    ano: m.ano,
    total: doMes.length,
    porSemana: semanas,
    diasDaSemana: contDow,
    pilares: contPilar,
    duracoes: [...new Set(doMes.map((v) => v.duracao))],
    virais: virais.length,
    temasVirais: virais.map((v) => v.titulo),
    youtube: youtube.length,
    temasYoutube: youtube.map((v) => v.titulo),
    arco: doMes.map((v) => `dia ${pad(v.dia)} · ${v.modelo === 'viral' ? '[viral] ' : v.modelo === 'youtube' ? '[youtube] ' : ''}${v.pilar} · ${v.titulo}`),
  };
}

// ------------------------------------------------------------------- schema

// Restrições de structured outputs que quebram silenciosamente se ignoradas:
// additionalProperties:false em todo objeto, todo campo em required,
// sem tipos nulos, sem uniões, sem minLength/maxLength/minimum/maximum.
function schemaMes() {
  const str = { type: 'string' };
  const arrStr = { type: 'array', items: str };

  const cena = {
    type: 'object',
    additionalProperties: false,
    properties: {
      c: { type: 'string', description: 'Rótulo da cena, ex: "Cena 1 · Hook (0–3s)"' },
      t: { type: 'string', description: 'Fala corrida do porta-voz, sem descrição de imagem' },
      d: { type: 'string', description: 'Direção de imagem/B-roll para esta cena' },
    },
    required: ['c', 't', 'd'],
  };

  const video = {
    type: 'object',
    additionalProperties: false,
    properties: {
      dia: { type: 'integer', description: 'Dia do mês' },
      semana: { type: 'integer', description: 'Semana do mês, 1 a 5' },
      pilar: { type: 'string', enum: PILARES },
      modelo: {
        type: 'string',
        enum: ['viral', 'classico', 'youtube'],
        description: 'Estrutura do roteiro. "viral" = 9 tempos de retenção (só para os temas de maior potencial de compartilhamento). "classico" = 5 cenas. "youtube" = formato longo, 8 a 14 blocos, duas peças fixas por mês.',
      },
      duracao: { type: 'string', description: 'Ex: "60–75s" no clássico, "78–88s" no viral, "8–12min" no youtube' },
      titulo: str,
      objetivo: { type: 'string', description: 'Por que esta peça existe e o que ela move no negócio' },
      publico: { type: 'string', description: 'Recorte específico do público-alvo' },
      hooks: { type: 'array', items: str, description: 'Exatamente 3 ganchos alternativos' },
      roteiro: {
        type: 'array',
        items: cena,
        description: 'No modelo "classico": exatamente 5 cenas (hook, contexto, virada, conclusão, CTA). No modelo "viral": exatamente 9 tempos, nesta ordem — Ganchismo, Promessa aberta, Introdução, Bloco 1, Ponta solta, Bloco 2, Ponta solta, Solução, CTA. No modelo "youtube": 8 a 14 blocos — hook, promessa do vídeo, contexto, de 3 a 6 blocos de conteúdo (cada um cobrindo uma ideia completa do argumento), recapitulação e CTA. O rótulo em "c" deve começar com o número e o nome do bloco/tempo, com a marcação de tempo. Ex: "5. Ponta solta (28–32s)" ou "4. Critério 1 · Fluxo x atenção (1:40–3:10)".',
      },
      broll: { type: 'array', items: str, description: '5 sugestões de B-roll' },
      legendas: { type: 'array', items: str, description: 'Momentos de legenda na tela, com marcação de tempo' },
      impacto: { type: 'array', items: str, description: '3 frases de impacto recortáveis' },
      cta: str,
      titulos: {
        type: 'object',
        additionalProperties: false,
        properties: { ig: str, li: str, yt: str },
        required: ['ig', 'li', 'yt'],
      },
      desc: {
        type: 'object',
        additionalProperties: false,
        properties: { ig: str, li: str, fb: str, yt: str },
        required: ['ig', 'li', 'fb', 'yt'],
      },
      hash: {
        type: 'object',
        additionalProperties: false,
        properties: { ig: str, li: str, tt: str, yt: str },
        required: ['ig', 'li', 'tt', 'yt'],
      },
      thumb: {
        type: 'object',
        additionalProperties: false,
        properties: {
          texto: { type: 'string', description: 'Texto grande da thumbnail' },
          comp: { type: 'string', description: 'Composição visual' },
          expr: { type: 'string', description: 'Expressão do porta-voz' },
        },
        required: ['texto', 'comp', 'expr'],
      },
      cortes: {
        type: 'object',
        additionalProperties: false,
        properties: { shorts: str, linkedin: str, tiktok: str },
        required: ['shorts', 'linkedin', 'tiktok'],
      },
      srt: { type: 'string', description: 'Legenda SRT completa, numerada, com timecodes' },
    },
    required: [
      'dia', 'semana', 'pilar', 'modelo', 'duracao', 'titulo', 'objetivo', 'publico',
      'hooks', 'roteiro', 'broll', 'legendas', 'impacto', 'cta',
      'titulos', 'desc', 'hash', 'thumb', 'cortes', 'srt',
    ],
  };

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      plano: { type: 'string', description: 'Resumo em 3 a 6 linhas do que foi montado e por quê' },
      pendencias: { type: 'array', items: str, description: 'Números, casos ou dados que precisam ser preenchidos por um humano' },
      videos: { type: 'array', items: video },
    },
    required: ['plano', 'pendencias', 'videos'],
  };
}

// ------------------------------------------------------------------ prompt

function montarPrompt({ ano, mes, dias, firstDow, feriados, estrutura, estrategia, aprendizado, permanente }) {
  const DOW = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const nome = NOMES_MES[mes - 1];

  const calendario = [];
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    const fer = feriados[pad(d)] ? ` — FERIADO: ${feriados[pad(d)]}` : '';
    calendario.push(`  ${pad(d)} ${DOW[dow]}${fer}`);
  }

  const heranca = estrutura
    ? `## Estrutura herdada de ${estrutura.nome}/${estrutura.ano} (mês de referência)

Total de peças: ${estrutura.total}
Peças por semana: ${JSON.stringify(estrutura.porSemana)}
Dias da semana usados: ${JSON.stringify(estrutura.diasDaSemana)}
Mix de pilares: ${JSON.stringify(estrutura.pilares)}
Durações usadas: ${estrutura.duracoes.join(', ')}
Peças no modelo viral: ${estrutura.virais} de ${estrutura.total}
Temas que foram virais no mês de referência (não repita as mesmas teses):
${estrutura.temasVirais.length ? estrutura.temasVirais.map((t) => `  · ${t}`).join('\n') : '  (nenhum)'}
Peças no modelo youtube: ${estrutura.youtube} de ${estrutura.total}
Temas que foram youtube no mês de referência (não repita os mesmos ângulos):
${estrutura.temasYoutube.length ? estrutura.temasYoutube.map((t) => `  · ${t}`).join('\n') : '  (nenhum)'}

Arco de objetivos do mês de referência:
${estrutura.arco.map((l) => `  ${l}`).join('\n')}

Replique o mix de pilares, as durações e a proporção de retenção, trocando
apenas temas e ângulos. Não repita títulos nem teses já usadas. A quantidade e
os dias vêm da cadência obrigatória mais abaixo, não da estrutura herdada.`
    : 'Não há mês de referência. Monte a estrutura a partir da estratégia.';

  const comando = estrategia
    ? `## Estratégia deste mês (sobrepõe a herança apenas no que ela mencionar)

${estrategia}`
    : '## Estratégia deste mês\n\nNenhuma informada. Replique a estrutura herdada e troque só temas e ângulos.';

  const licoes = aprendizado
    ? `## Banco de aprendizado (recusas anteriores — não repita estes erros)

${aprendizado}`
    : '';

  const estrategiaPermanente = permanente
    ? `## Estratégia permanente do perfil

O bloco abaixo é o arquivo ESTRATEGIA.md do repositório. Ele vale mais que
qualquer suposição sua sobre o perfil: posicionamento, dores confirmadas, papel
de cada pilar, critério de escolha de formato, mapa de CTA, dados públicos
autorizados e teses que já foram usadas. Leia inteiro antes de montar o mês e
respeite as decisões registradas nele.

---

${permanente}

---
`
    : '';

  return `Monte o mês de ${nome} de ${ano} do calendário editorial de vídeos do Gustavo Schorr.

${estrategiaPermanente}
## Quem é e para quem fala

Gustavo Schorr é referência em mídia exterior (OOH/DOOH) na América Latina. O
conteúdo posiciona ele como autoridade no setor. O ângulo é sempre o empresário
e a empresa: gerar conhecimento fácil de salvar e compartilhar, mostrando o Out
Of Home como ferramenta estratégica de crescimento e construção de marca.

Público: CEOs, fundadores, diretores de marketing e gestores comerciais que
assinam o cheque da mídia mas nem sempre participam da decisão. Dores reais:
não conseguem provar retorno de OOH, compram painel por preço e tamanho em vez
de atenção e contexto, terceirizam a decisão de onde a marca aparece, tratam
marketing como despesa e não como ativo.

Tom: profissional e direto, sem jargão de guru, sem hype. Fala de dono para dono.
Português do Brasil, oralidade natural — o roteiro é lido em teleprompter.

## Formato de cada peça

Vídeo distribuído em Reels, Shorts, TikTok, LinkedIn e Facebook. Cada peça
carrega 17 entregáveis; o schema define todos eles.

Regras que valem para os três modelos:
- o campo "t" de cada cena/bloco é só a fala corrida, sem "CENA 1", sem
  descrição de imagem, sem rubrica. Direção de imagem vai no campo "d"
- hooks tem exatamente 3 alternativas de abertura
- impacto tem exatamente 3 frases recortáveis
- srt é a legenda completa, numerada, com timecodes no formato
  00:00:00,000 --> 00:00:04,500, coerente com as falas e com a duração declarada
- pilar é um de: ${PILARES.join(' · ')}

## Três modelos de roteiro — escolha peça a peça

### modelo "classico" — 45 a 90 segundos, 5 cenas

Hook (0–3s), contexto, virada, conclusão, CTA. É o formato padrão do
calendário. Use na maioria das peças, principalmente nas educativas de método,
nos bastidores e no conteúdo de nicho.

A cena de CTA do clássico não pode terminar só numa pergunta retórica. A
pergunta cria a reflexão, mas quem concorda mentalmente desliza sem agir. Feche
com a pergunta **e** uma ação concreta, escolhida pelo objetivo da peça — salvar,
seguir, compartilhar ou comentar. Exemplo: "Na sua última campanha, você comprou
lugar ou comprou tamanho? Salva esse vídeo pra rever antes de fechar a próxima."

### modelo "viral" — 75 a 90 segundos, 9 tempos

Reserve para os temas de maior potencial de compartilhamento. Escolha o modelo
pelo tema, não por sorteio: mito a derrubar, erro comum e caro, contradição com
o senso comum, polêmica do setor, previsão que mexe com medo do empresário,
pergunta que ele já se faz. Tema técnico, tutorial passo a passo e conteúdo de
nicho continuam no clássico — a estrutura de retenção neles soa forçada.

**Proporção obrigatória: entre um quarto e um terço das peças do mês. Nunca mais
que metade.** Se todas virassem, o feed ficaria repetitivo e o formato perderia
o efeito. Espalhe pelo mês, evitando dois virais em dias seguidos.

Os 9 tempos, nesta ordem exata, com o rótulo em "c" começando pelo número e o
nome do tempo mais a marcação de tempo (ex: "5. Ponta solta (28–32s)"):

1. **Ganchismo (0–3s)** — nunca um gatilho só. Combine vários ao mesmo tempo:
   quebra de padrão, curiosidade, promessa forte, conflito, contradição, erro
   comum, identificação, benefício claro. O objetivo é impedir o deslize para o
   próximo vídeo. Comece já falando, sem "oi, tudo bem".
2. **Promessa aberta (3–8s)** — o benefício fica claro, a resposta não. "Tem
   três erros, e o terceiro é o que faz você perder dinheiro." "A maior
   vantagem aparece só no final."
3. **Introdução (8–14s)** — entra no assunto direto. Sem apresentação, sem
   contextualização longa. Aos 10 segundos o espectador já tem que estar dentro.
4. **Bloco 1 (14–30s)** — primeira entrega útil de verdade. A pessoa precisa
   sentir que já aprendeu algo.
5. **Ponta solta (28–34s)** — interrompe a entrega com curiosidade. "Mas isso
   ainda não é o maior problema." "E quase ninguém percebe esse detalhe."
6. **Bloco 2 (32–52s)** — segunda entrega, com informação melhor que a primeira.
7. **Ponta solta (50–56s)** — nova quebra antes da conclusão. Nunca entregue
   tudo de uma vez.
8. **Solução (54–78s)** — fecha todas as promessas e resolve todas as pontas
   soltas. Não deixe pergunta sem resposta.
9. **CTA (76–88s)** — nunca genérico. Escolha pelo objetivo da peça:
   educativo ou tutorial → salvar · autoridade → seguir · polêmico → compartilhar
   · gerador de debate → comentar · comercial → link. Um CTA por peça.

Escrevendo o roteiro viral, cada frase responde a "o que faz a pessoa assistir
mais 3 segundos?". Frases curtas. Linguagem falada. Nada de frase decorativa.
A sequência é curiosidade → recompensa → curiosidade → recompensa até o fim.
Varie os CTAs entre as peças virais do mês — não repita "salva esse vídeo" em
todas.

### modelo "youtube" — 8 a 12 minutos, 8 a 14 blocos

Formato longo, fora do feed vertical: hook, promessa do vídeo, contexto/por que
isso importa, de 3 a 6 blocos de conteúdo — cada um cobrindo uma ideia completa
do argumento, não uma cena de 3 a 15 segundos —, recapitulação e CTA. Ainda
assim é roteiro pra teleprompter: fala corrida no campo "t", direção de imagem
no campo "d", mesmas regras de autenticidade e de CTA por objetivo.

Reserve pra tema que pede profundidade que o clássico e o viral não comportam:
framework completo com vários critérios, tese central do perfil argumentada a
fundo com contra-argumento respondido, ou um mapa de decisão em fases. Puxe
prioritariamente da lista "Ângulos ainda não explorados" do ESTRATEGIA.md — são
exatamente os temas grandes demais pra 90 segundos.

**Cadência fixa: exatamente 2 peças no modelo youtube por mês**, à parte da
cadência principal de dia alternado. Regras de posicionamento:
- dia útil, nunca sábado, domingo ou feriado — igual às peças curtas
- não precisa do dia livre de intervalo que as peças curtas exigem entre si:
  é produção separada, pode ficar ao lado de uma peça clássica ou viral no
  calendário
- as duas peças youtube do mês não ficam no mesmo dia nem, se der pra evitar,
  na mesma semana
- não conta na proporção de peças virais (o denominador da proporção é só
  clássico + viral)

## Autenticidade — inegociável

NUNCA invente número, caso, percentual, viagem, negociação ou resultado de
cliente. Dados de mercado só se forem públicos e amplamente conhecidos do setor
de mídia exterior. Onde o roteiro pedir história pessoal do Gustavo, escreva
literalmente [substituir por história real do Gustavo: <o que a história precisa
mostrar>] no campo "d" da cena. Onde faltar um número real, escreva
[INSERIR NÚMERO REAL] e liste a pendência no campo "pendencias".

## Conteúdo preso a data

Peça amarrada a data específica não sobrevive a remanejo. Evite "amanhã é
feriado", "esta semana", "ontem". Se a peça precisar de âncora temporal, use o
mês inteiro como referência, nunca o dia.

## Calendário de ${nome}/${ano}

Dias no mês: ${dias}. O dia 1 cai em ${DOW[firstDow]}.

${calendario.join('\n')}

## Cadência obrigatória

Vale para os modelos "classico" e "viral" — as peças curtas do feed. Publica
**um dia útil sim, outro não**, de segunda a sexta. Nunca sábado, nunca
domingo, nunca dois dias seguidos — entre duas publicações tem que sobrar pelo
menos um dia útil livre, que é o dia de gravar.

Feriado não publica e também não inverte o ritmo: pula o feriado e mantém a
alternância no próximo dia útil.

Isso costuma dar 10 ou 11 peças no mês. Se a estrutura herdada disser outra
quantidade, esta regra vence — ela é decisão de produção, não de conteúdo.

As 2 peças do modelo "youtube" são à parte dessa cadência — ver a seção do
modelo "youtube" acima pra regra de posicionamento delas.

${heranca}

${comando}

${licoes}

Devolva o mês completo no formato do schema.`;
}

// --------------------------------------------------------------- validação

export function validar(videos, { ano, mes, dias, feriados = {} }) {
  const erros = [];
  const vistos = new Set();

  // A cadência é decisão de produção: um dia útil sim, outro não. Sem esta
  // checagem o modelo volta ao ritmo quase diário do primeiro mês, que é
  // exatamente o que sufocou a gravação. As peças "youtube" são produção à
  // parte — entram no checa de fim de semana/feriado, mas não no intervalo.
  const curtas = videos.filter((v) => v.modelo !== 'youtube');
  const longas = videos.filter((v) => v.modelo === 'youtube');

  const publicados = curtas
    .map((v) => v.dia)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= dias)
    .sort((a, b) => a - b);

  const diasTodos = videos
    .map((v) => v.dia)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= dias)
    .sort((a, b) => a - b);

  for (const d of diasTodos) {
    const dow = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) {
      erros.push(`dia ${pad(d)}: cai num ${dow === 0 ? 'domingo' : 'sábado'} — a cadência é só de segunda a sexta`);
    }
    if (feriados[pad(d)]) {
      erros.push(`dia ${pad(d)}: é feriado (${feriados[pad(d)]}) — não publica`);
    }
  }

  // Entre duas publicações curtas tem que sobrar um dia útil livre. Fim de
  // semana e feriado no meio não contam como folga: eles não seriam dia de
  // gravação. As peças "youtube" ficam fora desta checagem de propósito.
  for (let i = 1; i < publicados.length; i++) {
    let uteisNoMeio = 0;
    for (let d = publicados[i - 1] + 1; d < publicados[i]; d++) {
      const dow = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
      if (dow >= 1 && dow <= 5 && !feriados[pad(d)]) uteisNoMeio++;
    }
    if (uteisNoMeio < 1) {
      erros.push(
        `dias ${pad(publicados[i - 1])} e ${pad(publicados[i])}: sem dia útil livre entre as duas peças — ` +
        'a cadência é um dia útil sim, outro não'
      );
    }
  }

  // Padrão fixo: 2 peças no modelo youtube por mês, à parte da cadência
  // principal. Só checa em meses com volume normal, pra não travar teste
  // pequeno nem o modo "vazio" parcial.
  if (videos.length >= 8) {
    if (longas.length === 0) {
      erros.push('nenhuma peça no modelo youtube — o padrão do mês é 2 roteiros longos');
    } else if (longas.length > 3) {
      erros.push(`${longas.length} peças no modelo youtube — o padrão é 2 por mês, no máximo 3`);
    }
  }

  for (const v of videos) {
    const rot = `dia ${v.dia ?? '?'} (${v.titulo ?? 'sem título'})`;

    if (!Number.isInteger(v.dia) || v.dia < 1 || v.dia > dias) {
      erros.push(`${rot}: dia fora do mês (mês tem ${dias} dias)`);
      continue;
    }
    if (vistos.has(v.dia)) erros.push(`${rot}: dia repetido`);
    vistos.add(v.dia);

    if (!PILARES.includes(v.pilar)) erros.push(`${rot}: pilar inválido "${v.pilar}"`);
    if (!v.objetivo?.trim()) erros.push(`${rot}: sem objetivo`);
    if (!v.cta?.trim()) erros.push(`${rot}: sem CTA`);
    if (!v.titulo?.trim()) erros.push(`${rot}: sem título`);
    if (!v.publico?.trim()) erros.push(`${rot}: sem público definido`);

    if (!['viral', 'classico', 'youtube'].includes(v.modelo)) {
      erros.push(`${rot}: modelo inválido "${v.modelo}" (use "viral", "classico" ou "youtube")`);
    }

    if (!Array.isArray(v.roteiro) || v.roteiro.length < 3) {
      erros.push(`${rot}: reel sem roteiro utilizável`);
    } else {
      const semFala = v.roteiro.filter((c) => !c?.t?.trim()).length;
      if (semFala) erros.push(`${rot}: ${semFala} cena(s) sem fala`);
      const semDirecao = v.roteiro.filter((c) => !c?.d?.trim()).length;
      if (semDirecao) erros.push(`${rot}: ${semDirecao} cena(s) sem orientação de gravação`);

      // A estrutura de retenção só funciona inteira. Faltando uma ponta solta,
      // o roteiro perde exatamente o que faz a pessoa continuar assistindo.
      if (v.modelo === 'viral') {
        if (v.roteiro.length !== 9) {
          erros.push(`${rot}: roteiro viral precisa de 9 tempos (tem ${v.roteiro.length})`);
        }
        const rotulos = v.roteiro.map((c) => normalizar(c?.c ?? ''));
        const pontas = rotulos.filter((r) => r.includes('ponta solta')).length;
        if (pontas < 2) erros.push(`${rot}: roteiro viral com ${pontas} ponta(s) solta(s), precisa de 2`);
        if (!rotulos.some((r) => r.includes('ganchismo'))) erros.push(`${rot}: roteiro viral sem o tempo de ganchismo`);
        if (!rotulos.some((r) => r.includes('promessa aberta'))) erros.push(`${rot}: roteiro viral sem promessa aberta`);
        if (!rotulos.some((r) => r.includes('solucao'))) erros.push(`${rot}: roteiro viral sem o tempo de solução`);
      } else if (v.modelo === 'classico' && v.roteiro.length !== 5) {
        erros.push(`${rot}: roteiro clássico precisa de 5 cenas (tem ${v.roteiro.length})`);
      } else if (v.modelo === 'youtube' && (v.roteiro.length < 8 || v.roteiro.length > 14)) {
        erros.push(`${rot}: roteiro youtube precisa de 8 a 14 blocos (tem ${v.roteiro.length})`);
      }
    }

    if (!Array.isArray(v.hooks) || v.hooks.filter((h) => h?.trim()).length < 3) {
      erros.push(`${rot}: menos de 3 ganchos`);
    }
    if (!Array.isArray(v.impacto) || v.impacto.filter((h) => h?.trim()).length < 3) {
      erros.push(`${rot}: menos de 3 frases de impacto`);
    }
    if (!Array.isArray(v.broll) || !v.broll.length) erros.push(`${rot}: sem B-roll`);
    if (!v.thumb?.texto?.trim()) erros.push(`${rot}: sem briefing de thumbnail`);
    if (!v.srt?.trim()) erros.push(`${rot}: sem legenda SRT`);
    if (!/-->/.test(v.srt ?? '')) erros.push(`${rot}: SRT sem timecodes`);
    if (!v.cortes?.shorts?.trim()) erros.push(`${rot}: sem orientação de cortes`);
  }

  if (!videos.length) erros.push('nenhuma peça gerada');

  // Proporção: se todo mês virasse roteiro de retenção, o feed ficaria repetitivo
  // e o formato perderia o efeito. Se nenhum virasse, o mês não teria peça de
  // alcance. O denominador é só classico + viral — youtube é produção à parte
  // e não deve diluir essa conta.
  if (curtas.length >= 4) {
    const virais = curtas.filter((v) => v.modelo === 'viral').length;
    const parte = virais / curtas.length;
    if (virais === 0) erros.push('nenhuma peça no modelo viral — o mês precisa de peças de alcance');
    else if (parte > 0.5) erros.push(`${virais} de ${curtas.length} peças curtas no modelo viral (${Math.round(parte * 100)}%) — o teto é 50%, senão o feed fica repetitivo`);
  }

  return erros;
}

// -------------------------------------------------------------- markdown

function markdown(mesKey, meta, videos) {
  const L = [];
  L.push(`# ${meta.nome} de ${meta.ano} — Calendário editorial · Gustavo Schorr`);
  L.push('');
  L.push(`${videos.length} peças · gerado em ${new Date().toISOString().slice(0, 10)}`);
  L.push('');

  const ordenados = [...videos].sort((a, b) => a.dia - b.dia);

  for (const v of ordenados) {
    L.push(`## Dia ${pad(v.dia)} — ${v.titulo}`);
    L.push('');
    const rotuloModelo = v.modelo === 'viral'
      ? `retenção, ${v.roteiro.length} tempos`
      : v.modelo === 'youtube'
      ? `YouTube longo, ${v.roteiro.length} blocos`
      : `clássico, ${v.roteiro.length} cenas`;
    L.push(`**Pilar:** ${v.pilar} · **Semana:** ${v.semana} · **Duração:** ${v.duracao} · **Formato:** ${rotuloModelo}`);
    L.push('');
    L.push(`**Objetivo:** ${v.objetivo}`);
    L.push('');
    L.push(`**Público:** ${v.publico}`);
    L.push('');
    L.push('**Ganchos:**');
    for (const h of v.hooks) L.push(`- ${h}`);
    L.push('');
    L.push('**Roteiro:**');
    for (const c of v.roteiro) {
      L.push('');
      L.push(`*${c.c}*`);
      L.push('');
      L.push(c.t);
      L.push('');
      L.push(`> Imagem: ${c.d}`);
    }
    L.push('');
    L.push('**B-roll:**');
    for (const b of v.broll) L.push(`- ${b}`);
    L.push('');
    L.push('**Legendas na tela:**');
    for (const b of v.legendas) L.push(`- ${b}`);
    L.push('');
    L.push('**Frases de impacto:**');
    for (const b of v.impacto) L.push(`- ${b}`);
    L.push('');
    L.push(`**CTA:** ${v.cta}`);
    L.push('');
    L.push('**Títulos:**');
    L.push(`- Instagram: ${v.titulos.ig}`);
    L.push(`- LinkedIn: ${v.titulos.li}`);
    L.push(`- YouTube: ${v.titulos.yt}`);
    L.push('');
    L.push('**Descrições:**');
    L.push(`- Instagram: ${v.desc.ig}`);
    L.push(`- LinkedIn: ${v.desc.li}`);
    L.push(`- Facebook: ${v.desc.fb}`);
    L.push(`- YouTube: ${v.desc.yt}`);
    L.push('');
    L.push('**Hashtags:**');
    L.push(`- Instagram: ${v.hash.ig}`);
    L.push(`- LinkedIn: ${v.hash.li}`);
    L.push(`- TikTok: ${v.hash.tt}`);
    L.push(`- YouTube: ${v.hash.yt}`);
    L.push('');
    L.push(`**Thumbnail:** ${v.thumb.texto} — ${v.thumb.comp} (${v.thumb.expr})`);
    L.push('');
    L.push('**Cortes:**');
    L.push(`- Shorts: ${v.cortes.shorts}`);
    L.push(`- LinkedIn: ${v.cortes.linkedin}`);
    L.push(`- TikTok: ${v.cortes.tiktok}`);
    L.push('');
    L.push('**SRT:**');
    L.push('```');
    L.push(v.srt);
    L.push('```');
    L.push('');
    L.push('---');
    L.push('');
  }

  return L.join('\n');
}

// ------------------------------------------------------------ chamada da API

async function gerarComIA(prompt) {
  const chaveApi = process.env.ANTHROPIC_API_KEY;
  if (!chaveApi) {
    throw new Error('ANTHROPIC_API_KEY não definida. Ela é obrigatória no MODO=ia.');
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: chaveApi });

  // Streaming é obrigatório: max_tokens alto não cabe em requisição
  // não-streaming — estoura o timeout do SDK.
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: schemaMes() },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  let ultimo = 0;
  stream.on('text', () => {
    const agora = Date.now();
    if (agora - ultimo > 15000) {
      ultimo = agora;
      process.stdout.write('.');
    }
  });

  const resposta = await stream.finalMessage();
  process.stdout.write('\n');

  // Checar stop_reason antes de ler content.
  if (resposta.stop_reason === 'refusal') {
    const cat = resposta.stop_details?.category ?? 'sem categoria';
    throw new Error(
      `O modelo recusou a requisição (categoria: ${cat}). ` +
      'Revise a estratégia — nada foi gravado no site.'
    );
  }
  if (resposta.stop_reason === 'max_tokens') {
    throw new Error(
      'A resposta estourou max_tokens e veio incompleta. ' +
      'Gere menos peças por vez (reduza a cadência na estratégia) — nada foi gravado.'
    );
  }

  const bloco = resposta.content.find((b) => b.type === 'text');
  if (!bloco) throw new Error('Resposta sem bloco de texto — nada foi gravado.');

  try {
    return JSON.parse(bloco.text);
  } catch (e) {
    throw new Error(`Resposta não é JSON válido: ${e.message}`);
  }
}

const TEMPOS_VIRAL = [
  'Ganchismo (0–3s)', 'Promessa aberta (3–8s)', 'Introdução (8–14s)',
  'Bloco 1 (14–30s)', 'Ponta solta (30–34s)', 'Bloco 2 (34–52s)',
  'Ponta solta (52–56s)', 'Solução (56–78s)', 'CTA (78–88s)',
];

// Os dias do mock seguem a mesma cadência do mês real — um dia útil sim, outro
// não, sem feriado. Caso contrário o teste falha na própria validação.
function diasDaCadencia(ano, mes, dias, feriados = {}) {
  const saida = [];
  let passo = 0;
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6 || feriados[pad(d)]) continue;
    if (passo % 2 === 0) saida.push(d);
    passo++;
  }
  return saida;
}

// Dias úteis livres do mês que não colidem com a agenda das peças curtas —
// é onde entram as 2 peças mock do modelo youtube.
function diasLivresUteis(ano, mes, dias, feriados, ocupados) {
  const saida = [];
  for (let d = 1; d <= dias; d++) {
    if (ocupados.has(d)) continue;
    const dow = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6 || feriados[pad(d)]) continue;
    saida.push(d);
  }
  return saida;
}

const BLOCOS_YOUTUBE_MOCK = [
  '1. Hook', '2. Promessa do vídeo', '3. Contexto', '4. Bloco 1', '5. Bloco 2',
  '6. Bloco 3', '7. Recapitulação', '8. CTA',
];

function gerarMock({ ano, mes, dias, feriados, estrutura }) {
  const agenda = diasDaCadencia(ano, mes, dias, feriados);
  const alvo = Math.min(estrutura?.total ?? 8, agenda.length);
  const videos = [];
  for (let i = 0; i < alvo; i++) {
    const dia = agenda[i];
    const viral = i % 3 === 0;
    videos.push({
      dia,
      semana: Math.min(5, Math.ceil(dia / 7)),
      pilar: PILARES[i % PILARES.length],
      modelo: viral ? 'viral' : 'classico',
      duracao: viral ? '78–88s' : '60–75s',
      titulo: `[MOCK] Peça de teste ${i + 1}`,
      objetivo: '[MOCK] objetivo de teste do fluxo do gerador.',
      publico: '[MOCK] público de teste.',
      hooks: ['[MOCK] gancho 1', '[MOCK] gancho 2', '[MOCK] gancho 3'],
      roteiro: viral
        ? TEMPOS_VIRAL.map((tempo, k) => ({
            c: `${k + 1}. ${tempo}`,
            t: `[MOCK] fala do tempo ${k + 1}.`,
            d: k === 5 ? '[substituir por história real do Gustavo: teste].' : '[MOCK] direção de imagem.',
          }))
        : [
            { c: 'Cena 1 · Hook (0–3s)', t: '[MOCK] fala do hook.', d: '[MOCK] plano fechado.' },
            { c: 'Cena 2 · Contexto (3–18s)', t: '[MOCK] fala de contexto.', d: '[MOCK] B-roll urbano.' },
            { c: 'Cena 3 · Virada (18–40s)', t: '[MOCK] fala da virada.', d: '[substituir por história real do Gustavo: teste].' },
            { c: 'Cena 4 · Conclusão (40–58s)', t: '[MOCK] fala de conclusão.', d: '[MOCK] plano médio.' },
            { c: 'Cena 5 · CTA (58–70s)', t: '[MOCK] pergunta final.', d: '[MOCK] plano fechado.' },
          ],
      broll: ['[MOCK] painel de LED', '[MOCK] avenida', '[MOCK] reunião', '[MOCK] mapa', '[MOCK] fachada'],
      legendas: ['0–3s: [MOCK]', '30s: [MOCK]'],
      impacto: ['[MOCK] frase 1', '[MOCK] frase 2', '[MOCK] frase 3'],
      cta: '[MOCK] chamada final.',
      titulos: { ig: '[MOCK] título IG', li: '[MOCK] título LI', yt: '[MOCK] título YT' },
      desc: { ig: '[MOCK] desc IG', li: '[MOCK] desc LI', fb: '[MOCK] desc FB', yt: '[MOCK] desc YT' },
      hash: { ig: '#mock', li: '#mock', tt: '#mock', yt: '#mock' },
      thumb: { texto: '[MOCK]', comp: '[MOCK] composição', expr: '[MOCK] expressão' },
      cortes: { shorts: '[MOCK] shorts', linkedin: '[MOCK] linkedin', tiktok: '[MOCK] tiktok' },
      srt: '1\n00:00:00,000 --> 00:00:04,500\n[MOCK] legenda de teste.',
    });
  }

  // Padrão fixo: 2 peças youtube por mês, em dias livres que não colidem com
  // a agenda das peças curtas.
  const ocupados = new Set(videos.map((v) => v.dia));
  const diasYoutube = diasLivresUteis(ano, mes, dias, feriados, ocupados).slice(0, 2);
  diasYoutube.forEach((dia, i) => {
    videos.push({
      dia,
      semana: Math.min(5, Math.ceil(dia / 7)),
      pilar: PILARES[(i + 3) % PILARES.length],
      modelo: 'youtube',
      duracao: '9–10min',
      titulo: `[MOCK] Roteiro YouTube longo ${i + 1}`,
      objetivo: '[MOCK] objetivo de teste do fluxo do gerador, formato longo.',
      publico: '[MOCK] público de teste.',
      hooks: ['[MOCK] gancho 1', '[MOCK] gancho 2', '[MOCK] gancho 3'],
      roteiro: BLOCOS_YOUTUBE_MOCK.map((bloco, k) => ({
        c: bloco,
        t: `[MOCK] fala do bloco ${k + 1}.`,
        d: k === 3 ? '[substituir por história real do Gustavo: teste].' : '[MOCK] direção de imagem.',
      })),
      broll: ['[MOCK] painel de LED', '[MOCK] avenida', '[MOCK] reunião', '[MOCK] mapa', '[MOCK] fachada'],
      legendas: ['0:00: [MOCK]', '3:00: [MOCK]'],
      impacto: ['[MOCK] frase 1', '[MOCK] frase 2', '[MOCK] frase 3'],
      cta: '[MOCK] chamada final.',
      titulos: { ig: '[MOCK] título IG', li: '[MOCK] título LI', yt: '[MOCK] título YT' },
      desc: { ig: '[MOCK] desc IG', li: '[MOCK] desc LI', fb: '[MOCK] desc FB', yt: '[MOCK] desc YT' },
      hash: { ig: '#mock', li: '#mock', tt: '#mock', yt: '#mock' },
      thumb: { texto: '[MOCK]', comp: '[MOCK] composição', expr: '[MOCK] expressão' },
      cortes: { shorts: '[MOCK] shorts', linkedin: '[MOCK] linkedin', tiktok: '[MOCK] tiktok' },
      srt: '1\n00:00:00,000 --> 00:00:04,500\n[MOCK] legenda de teste.',
    });
  });

  return {
    plano: '[MOCK] Execução de teste — nenhuma chamada de API foi feita.',
    pendencias: ['[MOCK] nada a preencher, isto é um teste.'],
    videos,
  };
}

// ------------------------------------------------------------------- saída

async function publicarSaida(pares) {
  const arquivo = process.env.GITHUB_OUTPUT;
  if (!arquivo) return;
  const linhas = Object.entries(pares).map(([k, v]) => {
    const texto = String(v ?? '');
    if (texto.includes('\n')) {
      const delim = `EOF_${Math.random().toString(36).slice(2)}`;
      return `${k}<<${delim}\n${texto}\n${delim}`;
    }
    return `${k}=${texto}`;
  });
  await appendFile(arquivo, linhas.join('\n') + '\n');
}

// -------------------------------------------------------------------- main

async function main() {
  const alvoBruto = process.env.MES;
  if (!alvoBruto) throw new Error('MES é obrigatória. Ex: MES=outubro, MES=10 ou MES=2026-10');

  const modo = (process.env.MODO || 'ia').toLowerCase();
  if (!['ia', 'vazio'].includes(modo)) throw new Error(`MODO inválido: ${modo}. Use "ia" ou "vazio".`);

  const mock = process.env.MOCK === '1' || process.env.MOCK === 'true';
  const debugPrompt = process.env.DEBUG_PROMPT === '1';

  const { html, ini, fim } = await lerIndex();
  const { bloco } = await lerIndex();
  const dados = await avaliarBloco(bloco);
  const meses = { ...dados.MESES };
  const videos = [...dados.VIDEOS];

  const estrutura = analisarEstrutura(meses, videos);

  // A estratégia permanente vive em Markdown, não no código — assim ela pode ser
  // corrigida por quem entende do negócio, sem tocar no gerador.
  let permanente = '';
  try {
    permanente = (await readFile(path.join(RAIZ, 'ESTRATEGIA.md'), 'utf8')).trim();
    console.log(`· ESTRATEGIA.md carregado (${permanente.length} caracteres).`);
  } catch {
    console.log('· ESTRATEGIA.md não encontrado — seguindo só com a estratégia embutida no prompt.');
  }

  const alvo = interpretarMes(alvoBruto);
  if (!alvo) throw new Error(`Não consegui interpretar MES="${alvoBruto}".`);

  const anoPadrao = Number(process.env.ANO) || estrutura?.ano || new Date().getUTCFullYear();
  let ano = alvo.ano ?? anoPadrao;
  const mes = alvo.mes;

  // Se o mês alvo é anterior ao último cadastrado e o ano não foi dito, virou o ano.
  if (!alvo.ano && !process.env.ANO && estrutura && mes < estrutura.chave.split('-')[1] * 1) {
    ano = estrutura.ano + 1;
  }

  const ateBruto = process.env.ATE;
  const ate = ateBruto ? interpretarMes(ateBruto) : null;
  if (ate && modo !== 'vazio') throw new Error('ATE só funciona com MODO=vazio.');

  const alvos = [];
  if (ate) {
    const fimMes = ate.mes;
    const fimAno = ate.ano ?? ano;
    let a = ano, m = mes;
    while (a < fimAno || (a === fimAno && m <= fimMes)) {
      alvos.push({ ano: a, mes: m });
      m++;
      if (m > 12) { m = 1; a++; }
      if (alvos.length > 24) throw new Error('Intervalo MES..ATE grande demais (máx. 24 meses).');
    }
  } else {
    alvos.push({ ano, mes });
  }

  const rotulos = [];
  let plano = '';
  let pendencias = [];
  let totalPecas = 0;
  let ultimaChave = '';

  for (const { ano: a, mes: m } of alvos) {
    const k = chave(a, m);
    const dias = diasNoMes(a, m);
    const firstDow = primeiroDiaSemana(a, m);
    const feriados = feriadosNacionais(a, m);
    const nome = NOMES_MES[m - 1];

    meses[k] = { nome, ano: a, mes: m, dias, firstDow, feriados };
    ultimaChave = k;
    rotulos.push(`${nome}/${a}`);

    if (modo === 'vazio') {
      console.log(`· ${nome}/${a}: grade vazia (${dias} dias, dia 1 numa ${['domingo','segunda','terça','quarta','quinta','sexta','sábado'][firstDow]}).`);
      continue;
    }

    const prompt = montarPrompt({
      ano: a, mes: m, dias, firstDow, feriados,
      estrutura,
      estrategia: process.env.ESTRATEGIA,
      aprendizado: process.env.APRENDIZADO,
      permanente,
    });

    if (debugPrompt) {
      console.log(prompt);
      return;
    }

    console.log(`· Gerando ${nome}/${a} com ${MODELO}${mock ? ' (MOCK)' : ''}...`);
    const saida = mock
      ? gerarMock({ ano: a, mes: m, dias, feriados, estrutura })
      : await gerarComIA(prompt);

    const erros = validar(saida.videos, { ano: a, mes: m, dias, feriados });
    if (erros.length) {
      console.error(`\nValidação falhou para ${nome}/${a}. Nada foi gravado no site.\n`);
      for (const e of erros) console.error(`  ✕ ${e}`);
      process.exit(1);
    }

    const base = videos.length ? Math.max(...videos.map((v) => v.n)) : 0;
    saida.videos
      .sort((x, y) => x.dia - y.dia)
      .forEach((v, i) => videos.push({ ...v, n: base + i + 1, ano: a, mes: m }));

    totalPecas += saida.videos.length;
    plano = saida.plano;
    pendencias = pendencias.concat(saida.pendencias ?? []);

    const md = markdown(k, meses[k], saida.videos);
    await writeFile(path.join(RAIZ, `conteudo-${a}-${pad(m)}.md`), md, 'utf8');
    console.log(`  → conteudo-${a}-${pad(m)}.md`);
  }

  const novoBloco = serializarBloco(meses, videos);
  const novoHtml = html.slice(0, ini) + novoBloco + html.slice(fim);

  // Relê o resultado e confirma que continua sendo JS válido antes de salvar.
  const iniNovo = novoHtml.indexOf(MARCA_INICIO);
  const fimNovo = novoHtml.indexOf(MARCA_FIM) + MARCA_FIM.length;
  await avaliarBloco(novoHtml.slice(iniNovo, fimNovo));

  await writeFile(INDEX, novoHtml, 'utf8');
  console.log(`\n✓ index.html atualizado — ${rotulos.join(', ')} · ${totalPecas} peça(s).`);

  if (pendencias.length) {
    console.log('\nPendências para preencher à mão:');
    for (const p of pendencias) console.log(`  · ${p}`);
  }

  await publicarSaida({
    chave: ultimaChave,
    rotulo: rotulos.join(', '),
    pecas: String(totalPecas),
    plano: plano || '(modo vazio — só a grade foi montada)',
  });
}

const executadoDireto = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  main().catch((e) => {
    console.error(`\n✕ ${e.message}`);
    process.exit(1);
  });
}
