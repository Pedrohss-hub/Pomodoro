/* Armazém: guarda configurações como JSON no navegador E numa aba do seu Google Sheets,
   para todos os aparelhos ficarem com as mesmas configurações.

   Onde fica no Sheets é escolha sua (Configurações > aba e célula inicial). A tabela é assim:
       chave        | json                    | atualizado        | aparelho
       containers   | {"agenda":{...},...}    | 1764000000000     | k3x9ab
   Cada configuração é UMA linha. A URL e o token NUNCA vão para a planilha: ficam só em cada aparelho.

   Como usar (quem guarda algo):
     Armazem.usar('containers', (chave, deQuem) => { ... });   // registra a chave; a função é chamada quando chega
                                                               // uma versão mais nova vinda de OUTRO aparelho
     Armazem.adotar('containers', valorAntigo);                // 1ª vez: aproveita o que já havia guardado só no navegador
     const dados = Armazem.obter('containers', {});            // lê (sempre do navegador: rápido e funciona offline)
     Armazem.guardar('containers', dados);                     // grava no navegador e, 1,5 s depois, no Sheets (se ligado)
   Quem liga tudo (js/sincronia.js): Armazem.configurar(() => cfg.armazem), sincronizar(), preparar(), estado().

   Regra de conflito: vale a versão com a data mais nova ("a última gravação vence"). Edite por um aparelho de cada vez.
   Segurança: antes de gravar, confere o cabeçalho da tabela; assim nunca escreve por cima de outros dados seus.
   Carregue depois de pomodoro.js (usa LS), util.js e sheets.js, e antes de containers.js. */
const Armazem = (() => {
  const PREFIXO = 'arm-', LIMITE = 45000, LINHAS = 60;        // uma célula do Sheets aceita até 50.000 caracteres
  const CABECALHO = ['chave', 'json', 'atualizado', 'aparelho'];
  const PADRAO = { ligado: false, aba: 'App', celula: 'A1' };
  let pegarConf = () => ({});
  const ouvintes = {}, timers = {};
  let andamento = null, repetir = false, ultimo = { ok: null, erro: '', em: 0 };

  const aparelho = (() => { let a = LS.get('arm-aparelho', null); if (!a) { a = Math.random().toString(36).slice(2, 8); LS.set('arm-aparelho', a); } return a; })();
  const configurar = fn => { pegarConf = fn; };
  const conf = () => Object.assign({}, PADRAO, pegarConf());
  const celulaOk = c => /^[A-Za-z]{1,3}\d+$/.test(c);
  const ativo = () => { const c = conf(); return !!(c.ligado && c.aba && celulaOk(c.celula) && Sheets.pronto() && navigator.onLine); };
  const estado = () => Object.assign({}, ultimo);

  /* ---------- no navegador ---------- */
  const local = chave => LS.get(PREFIXO + chave, null);                       // { dados, em }
  const obter = (chave, padrao) => { const l = local(chave); return l ? l.dados : padrao; };
  const usar = (chave, aoReceber) => { ouvintes[chave] = aoReceber || (() => {}); };
  function adotar(chave, antigo) {                                             // em: 0 = "nunca foi para o Sheets": a versão de lá, se existir, vence
    if (!local(chave) && antigo !== undefined && antigo !== null) LS.set(PREFIXO + chave, { dados: antigo, em: 0 });
  }
  function guardar(chave, dados) {
    LS.set(PREFIXO + chave, { dados, em: Date.now() });
    if (!ativo() || !(chave in ouvintes)) return;
    clearTimeout(timers[chave]);
    timers[chave] = setTimeout(() => sincronizar([chave]), 1500);              // junta várias mudanças seguidas numa gravação só
  }

  /* ---------- no Sheets ---------- */
  function ondeFica() { const m = /^([A-Za-z]{1,3})(\d+)$/.exec(conf().celula); return { col: Util.colunaNumero(m[1]), linha: +m[2] }; }
  const intervaloTabela = () => { const o = ondeFica(); return Util.colunaLetra(o.col) + o.linha + ':' + Util.colunaLetra(o.col + 3) + (o.linha + LINHAS); };
  const traduzir = err => /não encontrada/.test(err.message) ? err.message + '. Use "Testar e criar a aba".' : err.message;

  async function lerTabela() {                                                 // devolve { chave: { linha, json, em, aparelho } }
    const c = conf(), o = ondeFica();
    const r = await Sheets.ler(c.aba, intervaloTabela(), { retorno: ['valores'], limite: 200 });
    if (!r.ok) throw new Error(r.erro || 'resposta inesperada');
    const v = r.valores || [];
    if (!v.length || CABECALHO.some((t, i) => String(v[0][i]) !== t)) throw new Error('não achei o cabeçalho do Armazém em ' + c.aba + '!' + c.celula + '. Use "Testar e criar a aba"');
    const mapa = {};
    v.slice(1).forEach((l, i) => { if (l[0]) mapa[String(l[0])] = { linha: o.linha + 1 + i, json: String(l[1] || ''), em: Number(l[2]) || 0, aparelho: String(l[3] || '') }; });
    return mapa;
  }

  async function enviar(chave, mapa) {
    const c = conf(), o = ondeFica(), l = local(chave), json = JSON.stringify(l.dados);
    if (json.length > LIMITE) throw new Error('"' + chave + '" ficou grande demais para uma célula (' + json.length + ' de ' + LIMITE + ' caracteres)');
    const linha = mapa[chave] ? mapa[chave].linha : Math.max(o.linha, ...Object.values(mapa).map(x => x.linha)) + 1;
    if (linha > o.linha + LINHAS) throw new Error('a tabela do Armazém está cheia');
    const em = Date.now();
    const d = await Sheets.escrever(c.aba, Util.colunaLetra(o.col) + linha, [[chave, json, em, aparelho]]);
    if (!d.ok) throw new Error(d.erro || 'o script recusou a gravação');
    LS.set(PREFIXO + chave, { dados: l.dados, em });                           // o navegador e o Sheets ficam com a MESMA data
    mapa[chave] = { linha, json, em, aparelho };
  }

  async function sincronizarChave(chave, mapa) {
    const rem = mapa[chave], loc = local(chave);
    if (rem && (!loc || rem.em > loc.em)) {                                    // o Sheets tem algo mais novo: recebe
      let dados; try { dados = JSON.parse(rem.json); } catch { throw new Error('o JSON de "' + chave + '" na planilha (linha ' + rem.linha + ') está inválido'); }
      const igual = !!loc && JSON.stringify(loc.dados) === JSON.stringify(dados);
      LS.set(PREFIXO + chave, { dados, em: rem.em });
      if (!igual && ouvintes[chave]) ouvintes[chave](chave, rem.aparelho);
      return 'recebido';
    }
    if (loc && (!rem || loc.em > rem.em)) { await enviar(chave, mapa); return 'enviado'; }
    return 'igual';
  }

  // Confere o Sheets e deixa os dois lados iguais. Nunca lança erro: o resultado fica em estado().
  function sincronizar(chaves) {
    if (!ativo()) return Promise.resolve(estado());
    if (andamento) { repetir = true; return andamento; }                       // já está sincronizando: roda de novo ao terminar
    andamento = (async () => {
      try {
        const mapa = await lerTabela(), res = {};
        for (const k of (chaves || Object.keys(ouvintes))) res[k] = await sincronizarChave(k, mapa);
        ultimo = { ok: true, erro: '', em: Date.now(), res };
      } catch (err) { ultimo = { ok: false, erro: traduzir(err), em: Date.now() }; }
      finally {
        andamento = null; Util.avisar('armazem-estado');
        if (repetir) { repetir = false; sincronizar(); }
      }
      return ultimo;
    })();
    return andamento;
  }

  // "Testar e criar a aba": cria a aba (se faltar) e escreve o cabeçalho. Recusa se o lugar escolhido já tiver outros dados.
  async function preparar() {
    const c = conf();
    if (!Sheets.pronto()) throw new Error('configure a URL e o token primeiro');
    if (!c.aba) throw new Error('informe a aba');
    if (!celulaOk(c.celula)) throw new Error('célula inicial inválida (use algo como A1)');
    const r = await Sheets.criarAba(c.aba);
    if (!r.ok) throw new Error(/desconhecida/.test(r.erro || '') ? 'o script ainda é a versão antiga: cole o apps-script.gs novo e publique uma nova versão da implantação' : (r.erro || 'resposta inesperada'));
    const z = await Sheets.ler(c.aba, intervaloTabela(), { retorno: ['valores'], limite: 200 });
    if (!z.ok) throw new Error(z.erro || 'resposta inesperada');
    const v = z.valores || [];
    if (v.length) {
      if (CABECALHO.some((t, i) => String(v[0][i]) !== t)) throw new Error('já existe outro conteúdo em ' + c.aba + '!' + c.celula + ' ("' + String(v[0].find(x => x !== '') || '') + '"). Escolha outra aba ou célula.');
      return { criada: !!r.criada, existente: true };                          // a tabela do Armazém já está lá: nada a fazer
    }
    const h = await Sheets.escrever(c.aba, c.celula, [CABECALHO]);
    if (!h.ok) throw new Error(h.erro || 'não consegui escrever o cabeçalho');
    return { criada: !!r.criada, existente: false };
  }

  return { configurar, conf, ativo, estado, usar, adotar, obter, guardar, sincronizar, preparar, aparelho };
})();