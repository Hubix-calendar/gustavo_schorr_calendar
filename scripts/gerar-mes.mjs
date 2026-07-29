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
    arco: doMes.map((v) => `dia ${pad(v.dia)} · ${v.pilar} · ${v.titulo}`),
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
      duracao: { type: 'string', description: 'Ex: "60–75s"' },
      titulo: str,
      objetivo: { type: 'string', description: 'Por que esta peça existe e o que ela move no negócio' },
      publico: { type: 'string', description: 'Recorte específico do público-alvo' },
      hooks: { type: 'array', items: str, description: 'Exatamente 3 ganchos alternativos' },
      roteiro: { type: 'array', items: cena, description: 'Exatamente 5 cenas: hook, contexto, virada, conclusão, CTA' },
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
      'dia', 'semana', 'pilar', 'duracao', 'titulo', 'objetivo', 'publico',
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

function montarPrompt({ ano, mes, dias, firstDow, feriados, estrutura, estrategia, aprendizado }) {
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

Arco de objetivos do mês de referência:
${estrutura.arco.map((l) => `  ${l}`).join('\n')}

Replique essa estrutura — quantidade, cadência, dias da semana e proporção de
pilares — trocando apenas temas e ângulos. Não repita títulos nem teses já usadas.`
    : 'Não há mês de referência. Monte a estrutura a partir da estratégia.';

  const comando = estrategia
    ? `## Estratégia deste mês (sobrepõe a herança apenas no que ela mencionar)

${estrategia}`
    : '## Estratégia deste mês\n\nNenhuma informada. Replique a estrutura herdada e troque só temas e ângulos.';

  const licoes = aprendizado
    ? `## Banco de aprendizado (recusas anteriores — não repita estes erros)

${aprendizado}`
    : '';

  return `Monte o mês de ${nome} de ${ano} do calendário editorial de vídeos do Gustavo Schorr.

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

Vídeo de 45 a 90 segundos, distribuído em Reels, Shorts, TikTok, LinkedIn e
Facebook. Cada peça carrega 17 entregáveis; o schema define todos eles.

Regras que não podem ser quebradas:
- roteiro tem exatamente 5 cenas: hook (0–3s), contexto, virada, conclusão, CTA
- o campo "t" de cada cena é só a fala corrida, sem "CENA 1", sem descrição de
  imagem, sem rubrica. Direção de imagem vai no campo "d"
- hooks tem exatamente 3 alternativas de abertura
- impacto tem exatamente 3 frases recortáveis
- srt é a legenda completa, numerada, com timecodes no formato
  00:00:00,000 --> 00:00:04,500, coerente com a duração declarada
- pilar é um de: ${PILARES.join(' · ')}

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

Fim de semana é permitido se a cadência pedir — não é erro.

${heranca}

${comando}

${licoes}

Devolva o mês completo no formato do schema.`;
}

// --------------------------------------------------------------- validação

function validar(videos, { ano, mes, dias }) {
  const erros = [];
  const vistos = new Set();

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

    if (!Array.isArray(v.roteiro) || v.roteiro.length < 3) {
      erros.push(`${rot}: reel sem roteiro utilizável`);
    } else {
      const semFala = v.roteiro.filter((c) => !c?.t?.trim()).length;
      if (semFala) erros.push(`${rot}: ${semFala} cena(s) sem fala`);
      const semDirecao = v.roteiro.filter((c) => !c?.d?.trim()).length;
      if (semDirecao) erros.push(`${rot}: ${semDirecao} cena(s) sem orientação de gravação`);
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
    L.push(`**Pilar:** ${v.pilar} · **Semana:** ${v.semana} · **Duração:** ${v.duracao}`);
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

function gerarMock({ dias, estrutura }) {
  const alvo = estrutura?.total ?? 8;
  const videos = [];
  let dia = 1;
  for (let i = 0; i < alvo && dia <= dias; i++) {
    videos.push({
      dia,
      semana: Math.min(5, Math.ceil(dia / 7)),
      pilar: PILARES[i % PILARES.length],
      duracao: '60–75s',
      titulo: `[MOCK] Peça de teste ${i + 1}`,
      objetivo: '[MOCK] objetivo de teste do fluxo do gerador.',
      publico: '[MOCK] público de teste.',
      hooks: ['[MOCK] gancho 1', '[MOCK] gancho 2', '[MOCK] gancho 3'],
      roteiro: [
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
    dia += 2;
  }
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
    });

    if (debugPrompt) {
      console.log(prompt);
      return;
    }

    console.log(`· Gerando ${nome}/${a} com ${MODELO}${mock ? ' (MOCK)' : ''}...`);
    const saida = mock ? gerarMock({ dias, estrutura }) : await gerarComIA(prompt);

    const erros = validar(saida.videos, { ano: a, mes: m, dias });
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
