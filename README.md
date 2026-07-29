# Calendário Editorial — Gustavo Schorr

Site com todos os roteiros de vídeo do mês, prontos para gravar. Cada peça traz
os 17 entregáveis — do objetivo à legenda SRT — e pode ser aprovada ou recusada
direto na tela. Todo motivo de recusa vira aprendizado para os próximos meses.

**Site no ar:** https://hubix-calendar.github.io/gustavo_schorr_calendar/

Você não precisa programar para usar nada disto.

---

## O que tem no site

- **Calendário do mês** — cada dia com conteúdo mostra a peça, colorida por pilar.
  Setas ‹ › para trocar de mês, ou o seletor ao lado.
- **Clique num dia** e abre a peça inteira: objetivo, público, 3 ganchos,
  roteiro em 5 cenas com teleprompter (com botão de aumentar a letra),
  B-roll, legendas na tela, frases de impacto, CTA, título/descrição/hashtags
  por rede, thumbnail, cortes por formato e a legenda SRT pronta para copiar.
- **Aprovar / Recusar** dentro da peça. Ao recusar, você escreve o motivo.
- **Banco de aprendizado** no fim da página: guarda todas as recusas, destaca os
  termos que mais se repetem nos motivos e exporta tudo em JSON.
- **⚙ no topo** — nome, logo, cores, slogan e tom de voz. As cores entram no
  tema na hora.
- **◐ no topo** — alterna entre tema claro, escuro e automático.

Trechos marcados assim `[substituir por história real do Gustavo: ...]` são
propositais: nunca inventamos viagens, negociações ou números internos. Preencha
com experiência real antes de gravar. O mesmo vale para `[INSERIR NÚMERO REAL]`.

---

## Os dois formatos de roteiro

As peças não seguem todas o mesmo desenho. Há dois formatos, e o filtro
**Formato** no topo da grade separa os dois.

### Clássico — 5 cenas, 45 a 90s

Hook, contexto, virada, conclusão, CTA. É o padrão do calendário, usado na
maioria das peças: educativo de método, bastidores, conteúdo de nicho.

### ⚡ Retenção — 9 tempos, 75 a 90s

Marcado com ⚡ na grade. Construído para segurar o espectador até o fim:

| # | Tempo | Para que serve |
|---|---|---|
| 1 | Ganchismo (0–3s) | Vários gatilhos ao mesmo tempo — impedir o deslize |
| 2 | Promessa aberta (3–8s) | Benefício claro, resposta escondida |
| 3 | Introdução (8–14s) | Entra no assunto direto, sem apresentação |
| 4 | Bloco 1 (14–30s) | Primeira entrega útil |
| 5 | **Ponta solta** (30–34s) | Quebra a entrega com curiosidade |
| 6 | Bloco 2 (34–52s) | Segunda entrega, informação melhor |
| 7 | **Ponta solta** (52–56s) | Nova quebra antes da conclusão |
| 8 | Solução (56–78s) | Fecha todas as promessas e pontas soltas |
| 9 | CTA (78–88s) | Ação escolhida pelo objetivo da peça |

No teleprompter, os tempos de gancho e as pontas soltas aparecem com uma barra
lateral colorida — são os pontos em que a atenção se perde se a entrega for mole.

O CTA nunca é genérico. Educativo e tutorial pedem **salvar**, autoridade pede
**seguir**, polêmica pede **compartilhar**, tese que divide opinião pede
**comentar**.

**Por que não em todas:** o formato depende de novidade. Se todo vídeo abrisse
com quebra de padrão e duas pontas soltas, o feed viraria uma coisa só e o
efeito acabava. Por isso o gerador é obrigado a ficar entre um quarto e um terço
das peças do mês, com teto de metade — se passar disso, a validação aborta e
nada é gravado. Hoje são **12 de 35** (34%), escolhidas por tema: mito a
derrubar, erro caro, contradição com o senso comum e polêmica do setor. Tutorial
passo a passo e conteúdo técnico seguem no clássico, onde a estrutura de
retenção soaria forçada.

> As aprovações e o histórico ficam salvos **no navegador que você usou**. Não
> sincronizam entre computadores. Para levar de uma máquina para outra, use
> **Exportar base (JSON)**.

---

## Gerar um mês novo

1. Vá na aba **Actions** do repositório
2. Escolha **Novo mês do calendário** na lista da esquerda
3. Clique em **Run workflow**
4. Preencha os campos e clique no botão verde

Quando terminar (uns minutos), o mês novo já está no site. Atualize a página.

### O que cada campo faz

| Campo | O que colocar |
|---|---|
| **mes** | Obrigatório. `outubro`, `10` ou `2026-10` |
| **estrategia** | O campo mais importante. Português corrido, veja abaixo |
| **ano** | Só se quiser forçar. Em branco, ele segue o ano do último mês |
| **modo** | `ia` gera o conteúdo · `vazio` só monta a grade (grátis) |
| **ate** | Só no modo `vazio`: monta de `mes` até este mês de uma vez |
| **aprendizado** | Opcional. Cole o conteúdo do JSON exportado do banco de aprendizado |
| **mock** | Marque para testar o fluxo inteiro **sem gastar API** |

### A regra da herança

O mês novo **herda a estrutura do último mês preenchido**: quantas peças, em
quais dias da semana, com que mistura de pilares, quantas peças de retenção e
que arco de assuntos. A `estrategia` sobrepõe isso **apenas naquilo que ela
mencionar**. Se você deixar em branco, ele repete a estrutura e troca só os
temas e ângulos. Ele também recebe a lista de temas que já foram ⚡ Retenção no
mês anterior, para não repetir a mesma tese.

Exemplo de estratégia que ele obedece:

> Novembro é mês de Black Friday. Quero 3 peças por semana em vez de 5, só
> segunda, quarta e sexta. Puxa mais o pilar Opinião. Tema central: por que
> desconto em mídia sem estratégia queima orçamento. Na última semana, empurra
> uma conversa de diagnóstico com prazo.

---

## Quanto custa

Cerca de **US$ 0,40 a 0,90** por mês gerado, cobrado direto na conta da
Anthropic. O modo `vazio`, que só monta a grade para preencher à mão, é grátis.
O campo `mock` também é grátis — roda o fluxo inteiro sem chamar a API.

---

## Se o mês sair ruim

1. **Não apague nada.** Abra as peças ruins no site e clique em **Recusar**,
   escrevendo o motivo de forma concreta — "genérico demais" ajuda pouco,
   "não citou dado de mercado e o gancho repetiu o de setembro" ajuda muito.
2. Clique em **Exportar base (JSON)** no banco de aprendizado.
3. Rode o workflow de novo para o mesmo mês, colando o conteúdo do JSON no
   campo `aprendizado` e escrevendo na `estrategia` o que precisa mudar.

O mês é reescrito por cima. As aprovações antigas continuam salvas por
dia — se a peça daquele dia mudou, revise a decisão.

---

## Testar sem gastar

- **No site:** marque `mock` no workflow. Ele monta um mês de mentira, commita e
  você vê o fluxo inteiro funcionando. Depois é só rodar de novo pra valer.
- **No seu computador:** `npm ci` e depois `MES=outubro MOCK=1 node scripts/gerar-mes.mjs`.

Para ver só o prompt que seria enviado, sem chamar a API:
`MES=outubro DEBUG_PROMPT=1 node scripts/gerar-mes.mjs`

---

## Como o repositório é montado

| Arquivo | O que é |
|---|---|
| `index.html` | O site inteiro, num arquivo só. Abre offline, sem servidor |
| `scripts/gerar-mes.mjs` | O gerador. Lê o mês anterior, chama a IA, valida e grava |
| `.github/workflows/gerar-mes.yml` | O botão do Actions |
| `package.json` / `package-lock.json` | A única dependência: o SDK da Anthropic |
| `conteudo-AAAA-MM.md` | Todo o texto do mês em Markdown, gerado junto |

Os dados vivem dentro do `index.html`, entre os marcadores
`/* ==== MESES:START ... */` e `/* ==== MESES:END ==== */`. **Esses marcadores
não podem ser removidos** — é entre eles que o gerador escreve.

O gerador nunca grava um mês quebrado: ele valida antes (dia repetido, dia fora
do mês, peça sem roteiro, sem orientação de gravação, sem objetivo, sem CTA, sem
SRT) e, se achar problema, aborta sem tocar no site.

---

## Configuração (só uma vez)

1. **Chave da API** — crie em `console.anthropic.com`, ponha crédito antes (a
   assinatura do Claude Code não inclui crédito de API) e defina um teto de gasto.
   Depois, no seu terminal:
   ```
   gh secret set ANTHROPIC_API_KEY -R Hubix-calendar/gustavo_schorr_calendar
   ```
   Nunca cole a chave num chat — ela ficaria salva no histórico.
2. **Permissão de escrita do Actions** — Settings → Actions → General →
   Workflow permissions → **Read and write permissions**. Sem isso, o robô gera
   o mês e falha com 403 na hora de commitar.
3. **GitHub Pages** — Settings → Pages → Deploy from a branch → `main` / `(root)`.
   Subir os arquivos não liga o Pages sozinho.
