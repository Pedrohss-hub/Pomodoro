// Cole este arquivo no Apps Script da planilha (Extensões > Apps Script).
// IMPORTANTE: troque o TOKEN só lá dentro do editor do Apps Script.
// Não grave o token verdadeiro neste arquivo se ele for para o GitHub.
const TOKEN = 'COLOQUE-AQUI-UM-TOKEN-LONGO-E-ALEATORIO';

// ============================================================
//  Apps Script genérico: o SITE decide o que ler e o que gravar.
//  Este código não sabe nada de Pomodoro, categorias ou gráficos:
//  só executa pedidos (ler, escrever, anexar...) com os parâmetros recebidos.
//  Depois de colar, você não precisa mais mexer aqui.
// ============================================================

// ----- Travas de segurança (opcionais) -----
const ESCRITA_LIBERADA = true; // false = o script só consegue LER
const ABAS_PERMITIDAS = [];    // [] = todas as abas; ou ['Banco', 'Config'] para limitar

const VERSAO = 'v-generico-2';

// ===================== Utilidades =====================

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function aviso(msg, titulo) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, titulo, 5); } catch (e) {}
}

function abaPorNome(nome, escrita) {
  nome = String(nome || '').trim();
  if (!nome) throw new Error('informe a aba ("aba")');
  if (ABAS_PERMITIDAS.length && ABAS_PERMITIDAS.indexOf(nome) < 0) throw new Error('aba "' + nome + '" não permitida neste script');
  if (escrita && !ESCRITA_LIBERADA) throw new Error('escrita desligada neste script (ESCRITA_LIBERADA = false)');
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba) throw new Error('aba "' + nome + '" não encontrada');
  return aba;
}

function colunaNumero(letras) {
  const s = String(letras || '').trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(s)) throw new Error('coluna inválida: "' + letras + '"');
  return [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
}

function colunaLetra(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Hora do dia como fração de 24 h (formate a coluna como hora)
function horaDoDia(d, tz) {
  const [h, m, s] = Utilities.formatDate(d, tz, 'HH:mm:ss').split(':').map(Number);
  return (h * 3600 + m * 60 + s) / 86400;
}

// Valores que o site manda. Além de texto, número e booleano, aceita:
//   { iso: '2026-11-12T18:05:00Z', como: 'data' }  -> data (no fuso da planilha)
//   { iso: '2026-11-12T18:05:00Z', como: 'hora' }  -> hora do dia (fração de 24 h)
//   { iso: '2026-11-12T18:05:00Z' }                -> data e hora
function converterValor(v, tz) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.iso) {
    const d = new Date(v.iso);
    if (isNaN(d.getTime())) throw new Error('data inválida: ' + v.iso);
    if (v.como === 'hora') return horaDoDia(d, tz);
    if (v.como === 'data') return Utilities.parseDate(Utilities.formatDate(d, tz, 'yyyy-MM-dd'), tz, 'yyyy-MM-dd');
    return d;
  }
  if (typeof v === 'object') throw new Error('valor não suportado: ' + JSON.stringify(v));
  return v;
}

function paraJson(v) { return v instanceof Date ? v.toISOString() : v; }

// Garante que a página tem linhas e colunas suficientes
function garantirTamanho(aba, ultimaLinha, ultimaColuna) {
  if (ultimaLinha > aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(), Math.max(100, ultimaLinha - aba.getMaxRows()));
  if (ultimaColuna > aba.getMaxColumns()) aba.insertColumnsAfter(aba.getMaxColumns(), ultimaColuna - aba.getMaxColumns());
}

// ===================== Ações =====================

// info: nome da planilha, fuso e abas com tamanho
function info() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: true, versao: VERSAO, planilha: ss.getName(), fuso: ss.getSpreadsheetTimeZone(),
    escrita: ESCRITA_LIBERADA,
    abas: ss.getSheets().map(a => ({ nome: a.getName(), linhas: a.getMaxRows(), colunas: a.getMaxColumns() }))
      .filter(a => !ABAS_PERMITIDAS.length || ABAS_PERMITIDAS.indexOf(a.nome) >= 0)
  };
}

// abas: só os nomes
function abas() {
  return { ok: true, abas: info().abas.map(a => a.nome) };
}

// ler: { aba, intervalo, retorno?: ['exibidos','valores','formatos'], cortarVazias?: true, limite?: 2000 }
//   exibidos = o texto como aparece na célula; valores = o valor (datas viram texto ISO);
//   formatos = o formato numérico de cada célula. Intervalos abertos (I3:K) funcionam.
function ler(p) {
  const aba = abaPorNome(p.aba, false);
  if (!p.intervalo) throw new Error('informe o intervalo ("intervalo")');
  const r = aba.getRange(String(p.intervalo).trim());
  const quer = Array.isArray(p.retorno) && p.retorno.length ? p.retorno : ['exibidos'];
  let exibidos = r.getDisplayValues();
  let valores = quer.indexOf('valores') >= 0 ? r.getValues().map(l => l.map(paraJson)) : null;
  let formatos = quer.indexOf('formatos') >= 0 ? r.getNumberFormats() : null;

  if (p.cortarVazias !== false) {                       // descarta as linhas vazias do fim
    let fim = exibidos.length;
    while (fim > 0 && exibidos[fim - 1].every(c => c === '')) fim--;
    exibidos = exibidos.slice(0, fim);
    if (valores) valores = valores.slice(0, fim);
    if (formatos) formatos = formatos.slice(0, fim);
  }
  const limite = Math.max(1, parseInt(p.limite, 10) || 2000);
  const truncado = exibidos.length > limite;
  if (truncado) {                                       // fica com as últimas linhas
    exibidos = exibidos.slice(-limite);
    if (valores) valores = valores.slice(-limite);
    if (formatos) formatos = formatos.slice(-limite);
  }
  const saida = { ok: true, aba: aba.getName(), intervalo: r.getA1Notation(), linhas: exibidos.length, truncado };
  if (quer.indexOf('exibidos') >= 0) saida.exibidos = exibidos;
  if (valores) saida.valores = valores;
  if (formatos) saida.formatos = formatos;
  return saida;
}

// escrever: { aba, intervalo: 'A1' (canto superior esquerdo), valores: [[...],[...]] }
function escrever(p) {
  const aba = abaPorNome(p.aba, true);
  if (!p.intervalo) throw new Error('informe a célula inicial ("intervalo")');
  if (!Array.isArray(p.valores) || !p.valores.every(Array.isArray)) throw new Error('"valores" deve ser uma lista de linhas, ex.: [["a",1],["b",2]]');
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const largura = Math.max(1, ...p.valores.map(l => l.length));
  const matriz = p.valores.map(l => { const x = l.map(v => converterValor(v, tz)); while (x.length < largura) x.push(''); return x; });
  if (!matriz.length) throw new Error('"valores" está vazio');
  const ini = aba.getRange(String(p.intervalo).split(':')[0].trim());
  garantirTamanho(aba, ini.getRow() + matriz.length - 1, ini.getColumn() + largura - 1);
  const r = aba.getRange(ini.getRow(), ini.getColumn(), matriz.length, largura);
  r.setValues(matriz);
  aviso('Escrito em ' + aba.getName() + '!' + r.getA1Notation(), 'OK');
  return { ok: true, aba: aba.getName(), intervalo: r.getA1Notation(), celulas: matriz.length * largura };
}

// limpar: { aba, intervalo }  (apaga só o conteúdo, mantém formatação)
function limpar(p) {
  const aba = abaPorNome(p.aba, true);
  if (!p.intervalo) throw new Error('informe o intervalo ("intervalo")');
  const r = aba.getRange(String(p.intervalo).trim());
  r.clearContent();
  return { ok: true, aba: aba.getName(), intervalo: r.getA1Notation() };
}

// apagarLinha: { aba, linha, conferir: { A: 'texto exibido', C: '...' }, como?: 'excluir' | 'limpar' }
//   Apaga UMA linha, mas só se as células de "conferir" mostrarem exatamente o texto esperado (é o site que diz o que a linha deve conter).
//   Se qualquer uma for diferente, NADA é apagado e a resposta traz o motivo.
//   como: 'excluir' (padrão) remove a linha e sobe as de baixo; 'limpar' só apaga o conteúdo das colunas de "conferir".
function apagarLinha(p) {
  const aba = abaPorNome(p.aba, true);
  const linha = parseInt(p.linha, 10);
  if (!(linha >= 1)) throw new Error('informe a linha (número)');
  const conf = p.conferir && typeof p.conferir === 'object' ? p.conferir : {};
  const letras = Object.keys(conf);
  if (!letras.length) throw new Error('informe "conferir" (colunas e o texto esperado) para apagar com segurança');
  const como = p.como === 'limpar' ? 'limpar' : 'excluir';
  if (como === 'excluir' && linha <= aba.getFrozenRows()) throw new Error('a linha ' + linha + ' está nas linhas congeladas; nada foi apagado');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (linha > aba.getLastRow()) throw new Error('a linha ' + linha + ' está vazia; nada foi apagado');
    const cols = letras.map(colunaNumero), c0 = Math.min.apply(null, cols), c1 = Math.max.apply(null, cols);
    const atual = aba.getRange(linha, c0, 1, c1 - c0 + 1).getDisplayValues()[0];
    letras.forEach((l, i) => {
      const lido = atual[cols[i] - c0];
      if (String(lido) !== String(conf[l])) throw new Error('a linha ' + linha + ' não é a esperada (coluna ' + l.toUpperCase() + ': "' + lido + '" em vez de "' + conf[l] + '"); nada foi apagado');
    });
    if (como === 'excluir') aba.deleteRow(linha); else aba.getRange(linha, c0, 1, c1 - c0 + 1).clearContent();
    const props = PropertiesService.getScriptProperties(), pref = 'prox:' + aba.getSheetId() + ':';   // esquece o palpite da próxima linha livre
    Object.keys(props.getProperties()).forEach(k => { if (k.indexOf(pref) === 0) props.deleteProperty(k); });
    aviso('Linha ' + linha + (como === 'excluir' ? ' excluída' : ' limpa'), 'OK');
    return { ok: true, aba: aba.getName(), linha, como };
  } finally {
    lock.releaseLock();
  }
}

// Acha a próxima linha livre olhando só a coluna-chave (com poucas chamadas)
function proximaLinha(aba, col, inicial) {
  const props = PropertiesService.getScriptProperties();
  const chave = 'prox:' + aba.getSheetId() + ':' + col + ':' + inicial;
  const palpite = Math.max(Number(props.getProperty(chave)) || 0, inicial);
  try {
    if (palpite > 1) {
      const [cima, atual] = aba.getRange(palpite - 1, col, 2, 1).getValues();
      if (cima[0] !== '' && atual[0] === '') return { linha: palpite, chave };
    }
  } catch (e) { /* palpite fora da página: cai na busca completa */ }
  const total = Math.max(aba.getMaxRows() - inicial + 1, 1);
  const celulas = aba.getRange(inicial, col, total, 1).getValues();
  let ultimo = -1;
  for (let i = celulas.length - 1; i >= 0; i--) {
    if (celulas[i][0] !== '') { ultimo = i; break; }
  }
  return { linha: inicial + ultimo + 1, chave };
}

// anexar: { aba, colunas: { A: valor, B: valor, ... }  ou  linhas: [ {A:..}, {A:..} ],
//           colunaChave?: 'A', linhaInicial?: 2 }
//   Grava na primeira linha livre (olhando a coluna-chave; por padrão, a menor coluna usada).
function anexar(p) {
  const aba = abaPorNome(p.aba, true);
  const lista = Array.isArray(p.linhas) ? p.linhas : (p.colunas ? [p.colunas] : []);
  if (!lista.length) throw new Error('informe "colunas" (ex.: {"A": 1, "B": "x"}) ou "linhas"');
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const inicial = Math.max(1, parseInt(p.linhaInicial, 10) || 1);

  // converte tudo antes de travar, para falhar cedo
  const prontas = lista.map(obj => Object.keys(obj)
    .map(letra => ({ col: colunaNumero(letra), valor: converterValor(obj[letra], tz) }))
    .sort((a, b) => a.col - b.col));
  prontas.forEach(itens => {
    if (!itens.length) throw new Error('linha sem colunas');
    for (let i = 1; i < itens.length; i++) if (itens[i].col === itens[i - 1].col) throw new Error('coluna repetida: ' + colunaLetra(itens[i].col));
  });
  const colChave = p.colunaChave ? colunaNumero(p.colunaChave) : Math.min.apply(null, prontas.map(i => i[0].col));

  const lock = LockService.getScriptLock();   // evita dois envios disputando a mesma linha
  lock.waitLock(20000);
  try {
    const { linha, chave } = proximaLinha(aba, colChave, inicial);
    const ultimaCol = Math.max.apply(null, prontas.map(i => i[i.length - 1].col));
    garantirTamanho(aba, linha + prontas.length - 1, ultimaCol);
    prontas.forEach((itens, k) => {
      // colunas vizinhas numa escrita só; colunas separadas, em escritas separadas
      let i = 0;
      while (i < itens.length) {
        let j = i;
        while (j + 1 < itens.length && itens[j + 1].col === itens[j].col + 1) j++;
        const grupo = itens.slice(i, j + 1);
        aba.getRange(linha + k, grupo[0].col, 1, grupo.length).setValues([grupo.map(g => g.valor)]);
        i = j + 1;
      }
    });
    PropertiesService.getScriptProperties().setProperty(chave, String(linha + prontas.length));
    aviso('Gravado na linha ' + linha, 'OK');
    return { ok: true, aba: aba.getName(), linha, ultimaLinha: linha + prontas.length - 1 };
  } finally {
    lock.releaseLock();
  }
}

// lote: { itens: [ {acao:'ler', ...}, {acao:'abas'} ] } -> resultados na mesma ordem.
// Serve para fazer várias coisas numa só chamada (mais rápido que vários pedidos).
function lote(p) {
  if (!Array.isArray(p.itens)) throw new Error('"itens" deve ser uma lista de pedidos');
  return { ok: true, resultados: p.itens.slice(0, 25).map(it => { try { return executar(it, true); } catch (err) { return { ok: false, erro: String(err.message || err) }; } }) };
}

// ===================== Roteador =====================

const ACOES = { info, abas, ler, escrever, limpar, anexar, apagarLinha, lote };
const SO_LEITURA = ['info', 'abas', 'ler'];   // as únicas ações aceitas por GET

function executar(p, dentroDeLote) {
  const acao = p.acao || 'info';
  if (!Object.prototype.hasOwnProperty.call(ACOES, acao)) return { ok: false, erro: 'ação desconhecida: ' + acao };
  if (acao === 'lote' && dentroDeLote) return { ok: false, erro: 'lote dentro de lote não é permitido' };
  return ACOES[acao](p);
}

// POST: corpo JSON  { token, acao, ...parâmetros }   (use POST para tudo que grava)
function doPost(e) {
  try {
    const corpo = JSON.parse(e.postData.contents);
    if (corpo.token !== TOKEN) return ContentService.createTextOutput('negado');
    return resposta(executar(corpo));
  } catch (err) {
    aviso(String(err.message || err), 'ERRO');
    return resposta({ ok: false, erro: String(err.message || err) });
  }
}

// GET: só leitura, por parâmetros na URL.
//   .../exec                                  -> mostra que o script está no ar
//   .../exec?token=T&acao=ler&aba=Banco&intervalo=A1:G5&retorno=exibidos,valores
// Atenção: o token vai na URL (fica no histórico do navegador). Para uso normal, prefira POST.
function doGet(e) {
  const q = (e && e.parameter) || {};
  if (!q.acao) return ContentService.createTextOutput('Script no ar, ' + VERSAO);
  try {
    if (q.token !== TOKEN) return ContentService.createTextOutput('negado');
    if (SO_LEITURA.indexOf(q.acao) < 0) return resposta({ ok: false, erro: 'GET só aceita: ' + SO_LEITURA.join(', ') });
    const p = Object.assign({}, q);
    if (q.retorno) p.retorno = String(q.retorno).split(',').map(s => s.trim());
    if (q.cortarVazias !== undefined) p.cortarVazias = q.cortarVazias !== 'false';
    return resposta(executar(p));
  } catch (err) {
    return resposta({ ok: false, erro: String(err.message || err) });
  }
}