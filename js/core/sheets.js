/* Núcleo de dados: o ÚNICO arquivo do site que fala com o Apps Script (Google Sheets).
   Os outros arquivos pedem coisas a ele (Sheets.ler, Sheets.anexar...) e não usam fetch direto.
   Carregue este arquivo ANTES dos demais no index.html.

   Como usar:
     Sheets.usar(() => cfg);                         // 1 vez, no início: diz onde estão a URL e o token
     const d = await Sheets.ler('Agenda', 'A3:G');   // lê um intervalo
     await Sheets.anexar('Banco', { A: 'texto' });   // grava na primeira linha livre
     await Sheets.lote([{ acao: 'ler', ... }, ...]); // várias ações numa chamada só

   Quando algo falha, o erro lançado tem a propriedade "tipo":
     'config'   -> faltam URL ou token
     'rede'     -> sem internet / script fora do ar / demorou demais (vale guardar na fila e tentar depois)
     'token'    -> o script recusou o token
     'resposta' -> a URL respondeu, mas não é o script esperado (é um SyntaxError)
   Erros que o script devolve com { ok: false, erro } NÃO viram exceção aqui: quem chamou confere d.ok. */
const Sheets = (() => {
  let pegarCfg = () => ({ url: '', token: '' });
  const sinal = ms => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
  const erro = (msg, tipo, extra) => Object.assign(new Error(msg), { tipo }, extra);

  const usar = fn => { pegarCfg = fn; };
  const pronto = () => { const c = pegarCfg(); return !!(c.url && c.token); };

  // Chamada básica: tudo abaixo é só atalho para ela.
  async function chamar(acao, dados = {}, opcoes = {}) {
    const c = pegarCfg();
    if (!c.url || !c.token) throw erro('configure a URL e o token', 'config');
    let txt;
    try {
      const r = await fetch(c.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita o "preflight" do navegador
        body: JSON.stringify({ token: c.token, acao, ...dados }),
        signal: sinal(opcoes.timeout || 15000)
      });
      txt = await r.text();
    } catch (e) { throw erro('sem conexão com o script', 'rede', { cause: e }); }
    if (txt.trim() === 'negado') throw erro('token recusado pelo script', 'token');
    try { return JSON.parse(txt); }
    catch { throw Object.assign(new SyntaxError('o endereço não respondeu como o script esperado (confira a URL)'), { tipo: 'resposta' }); }
  }

  const ler = (aba, intervalo, extra = {}) => chamar('ler', { aba, intervalo, retorno: ['exibidos'], ...extra });
  const lote = itens => chamar('lote', { itens });
  const anexar = (aba, colunas, extra = {}) => chamar('anexar', { aba, colunas, ...extra });
  const escrever = (aba, intervalo, valores) => chamar('escrever', { aba, intervalo, valores });
  const limpar = (aba, intervalo) => chamar('limpar', { aba, intervalo });
  const abas = () => chamar('abas');

  // O script está no ar? (true/false; nunca lança erro)
  async function ping() {
    const url = pegarCfg().url;
    const opcoes = { cache: 'no-store', signal: sinal(8000) };
    try { return (await fetch(url, opcoes)).ok; }
    catch {
      try { await fetch(url, { ...opcoes, mode: 'no-cors', signal: sinal(8000) }); return true; }
      catch { return false; }
    }
  }

  return { usar, pronto, chamar, ler, lote, anexar, escrever, limpar, abas, ping };
})();