/* Agenda: lê da planilha (Status, ID, Descrição, Horas, Categoria, Rest, Data) e mostra a lista ordenada por data. */
(() => {
  const PADRAO = { aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false };
  cfg.agenda = Object.assign({}, PADRAO, cfg.agenda);
  const CACHE = 'pomo-agenda', TTL = 10 * 60 * 1000, REGEX = /^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d*$/;
  const salvo = LS.get(CACHE, null) || {};
  const est = { itens: salvo.itens || [], meta: salvo.meta || null, sig: salvo.sig || '', em: salvo.em || 0, carregando: false, erro: '' };
  const sig = () => cfg.agenda.aba + '!' + cfg.agenda.intervalo;
  const det = $('#ag-det'), lista = $('#ag-lista');
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const visivel = () => !$('#pg-pomo').hidden;

  // linhas da planilha -> itens [{desc, hora, cat, feita, t:[ano, mês, dia]}] ordenados por data e hora.
  // As colunas são achadas pelo cabeçalho (Status, Descrição, Horas, Categoria, Data) se ele estiver no intervalo;
  // sem cabeçalho, vale a ordem Status, ID, Descrição, Horas, Categoria, Rest, Data.
  const letra = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const numCol = s => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  function converter(r) {
    const ex = r.exibidos || [], va = r.valores || [];
    const m0 = /^([A-Z]+)(\d+)/.exec(r.intervalo || ''), c0 = m0 ? numCol(m0[1]) : 1, l0 = m0 ? +m0[2] : 1;   // canto superior esquerdo lido
    let col = { st: 0, desc: 2, hora: 3, cat: 4, data: 6 }, ini = 0;
    for (let i = 0; i < Math.min(ex.length, 8); i++) {
      const l = ex[i].map(c => String(c).trim().toLowerCase()), f = re => l.findIndex(c => re.test(c));
      if (f(/^descri/) >= 0 && f(/^data/) >= 0) { col = { st: f(/^status/), desc: f(/^descri/), hora: f(/^hora/), cat: f(/^categ/), data: f(/^data/) }; ini = i + 1; break; }
    }
    const itens = [];
    ex.slice(ini).forEach((e, k) => {
      const linha = l0 + ini + k;
      const v = va[ini + k] || [], desc = String(e[col.desc] || '').trim();
      if (!desc) return;
      let d = /^\d{4}-\d{2}-\d{2}T/.test(String(v[col.data])) ? new Date(v[col.data]) : null;
      if (!d) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(e[col.data]); if (m) d = new Date(+m[3], +m[2] - 1, +m[1]); }
      if (!d || isNaN(d)) return;                                   // linha sem data
      const hm = /(\d{1,2}):(\d{2})/.exec(e[col.hora] || '');
      itens.push({
        linha, desc, cat: String(e[col.cat] || '').trim(), t: [d.getFullYear(), d.getMonth(), d.getDate()],
        hora: hm && (+hm[1] || +hm[2]) ? hm[1].padStart(2, '0') + ':' + hm[2] : '',       // 00:00 = sem horário
        feita: col.st >= 0 && (v[col.st] === true || /^(true|verdadeiro|sim)$/i.test(String(e[col.st])))
      });
    });
    if (!itens.length && ex.some(l => l.some(c => String(c).trim() && !/^(true|false)$/i.test(String(c).trim()))))
      throw new Error('não reconheci a agenda. Primeiras linhas lidas: ' + ex.filter(l => l.some(c => String(c).trim())).slice(0, 2).map(l => l.join(' | ')).join(' / ') + '. Confira a aba e as células (ex.: A2:G, com o cabeçalho).');
    const L = c => c >= 0 ? letra(c0 + c) : '';
    est.meta = { aba: cfg.agenda.aba, primeira: l0 + ini, editavel: !r.truncado && !!m0, cols: { st: L(col.st), desc: L(col.desc), hora: L(col.hora), cat: L(col.cat), data: L(col.data) } };
    return itens.sort((x, y) => Date.UTC(...x.t) - Date.UTC(...y.t) || x.hora.localeCompare(y.hora));
  }

  const msg = (t, erro) => lista.replaceChildren(h('p', 'ag-msg' + (erro ? ' erro' : ''), t));

  function render() {
    const a = cfg.agenda;
    if (!cfg.url || !cfg.token) return msg('Configure a URL e o token (Configurações) para ver a agenda.');
    if (est.sig !== sig()) return msg(est.carregando ? 'Carregando…' : est.erro ? 'Não consegui carregar: ' + est.erro : 'Ainda sem dados. Use ↻.', !!est.erro && !est.carregando);
    const hoje = new Date(), h0 = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const itens = est.itens.filter(x => a.concluidas || !x.feita);
    if (!itens.length) return msg('Nada pendente na agenda.');
    const nivel = d => d < 0 ? 0 : d <= a.vermelho ? 1 : d <= a.amarelo ? 2 : 3;
    const rel = d => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d < 0 ? 'há ' + (-d) + ' d' : 'em ' + d + ' d';
    const p2 = n => String(n).padStart(2, '0');
    lista.replaceChildren(...itens.map(x => {
      const dias = Math.round((Date.UTC(...x.t) - h0) / 864e5);
      const li = h('div', 'ag-item' + (x.feita ? ' feita' : '')); li.dataset.linha = x.linha; li.tabIndex = 0; li.title = 'Clique para editar';
      const data = h('div', 'ag-data v' + nivel(dias));
      data.append(h('b', null, p2(x.t[2]) + '/' + p2(x.t[1] + 1) + (x.t[0] !== hoje.getFullYear() ? '/' + String(x.t[0]).slice(2) : '')),
        h('small', null, DIAS[new Date(x.t[0], x.t[1], x.t[2]).getDay()] + ' · ' + rel(dias)));
      const meta = h('div', 'ag-meta');
      if (x.hora) meta.append(h('span', null, x.hora));
      if (x.cat) meta.append(h('span', 'ag-tag', x.cat));
      const corpo = h('div'); corpo.append(h('div', 'ag-desc', x.desc), meta);
      const chk = h('button', 'ag-chk', '✓'); chk.type = 'button'; chk.title = x.feita ? 'Concluído (clique para desmarcar)' : 'Marcar como concluído'; chk.setAttribute('aria-label', chk.title); chk.setAttribute('aria-pressed', String(x.feita));
      li.append(data, corpo, chk);
      return li;
    }));
  }

  function rodape() {
    $('#ag-status').textContent = est.carregando ? 'Atualizando…' : est.em ? 'Atualizado há ' + (Date.now() - est.em < 60000 ? 'instantes' : Math.round((Date.now() - est.em) / 60000) + ' min') + (est.erro ? ' · falhou: ' + est.erro : '') : 'Ainda não atualizado';
  }

  async function carregar(forcar) {
    if (!cfg.url || !cfg.token) { render(); return; }
    if (est.carregando) return;
    if (!forcar && est.sig === sig() && Date.now() - est.em < TTL) { rodape(); return; }
    est.carregando = true; est.erro = ''; render(); rodape();
    try {
      if (!navigator.onLine) throw new Error('sem internet');
      const d = await chamarScript('ler', { aba: cfg.agenda.aba, intervalo: cfg.agenda.intervalo, retorno: ['exibidos', 'valores'], limite: 3000 });
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      est.itens = converter(d); est.sig = sig(); est.em = Date.now();
      LS.set(CACHE, { itens: est.itens, meta: est.meta, sig: est.sig, em: est.em });
    } catch (err) {
      est.erro = err instanceof SyntaxError ? 'resposta inesperada do script' : err.name === 'TypeError' ? 'sem conexão com o script' : err.message;
    } finally { est.carregando = false; render(); rodape(); }
  }

  $('#ag-atualizar').onclick = () => carregar(true);

  /* ---------- editar, concluir, adicionar e excluir (grava na planilha pelo script genérico) ---------- */
  const valHora = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) / 1440 : 0; };   // fração do dia (00:00 = sem horário)
  const valData = t => ({ iso: new Date(t[0], t[1], t[2], 12).toISOString(), como: 'data' });
  async function gravar(itens) {
    const d = await chamarScript('lote', { itens });
    if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
    if (!d.resultados) throw new Error('o script está numa versão antiga: atualize o apps-script.gs');
    const ruim = d.resultados.find(r => !r.ok); if (ruim) throw new Error(ruim.erro || 'o script recusou a gravação');
  }
  // escreve só as colunas pedidas (a coluna Rest e o ID ficam como estão); colunas vizinhas vão numa escrita só
  function escritas(linha, campos) {
    const m = est.meta, v = Object.keys(campos).filter(k => m.cols[k]).map(k => [numCol(m.cols[k]), campos[k]]).sort((x, y) => x[0] - y[0]);
    const out = []; let i = 0;
    while (i < v.length) {
      let j = i; while (j + 1 < v.length && v[j + 1][0] === v[j][0] + 1) j++;
      out.push({ acao: 'escrever', aba: m.aba, intervalo: letra(v[i][0]) + linha, valores: [v.slice(i, j + 1).map(x => x[1])] }); i = j + 1;
    }
    return out;
  }
  const podeEditar = () => { if (!est.meta || !est.meta.editavel) { est.erro = 'edição indisponível: releia a agenda (↻) ou confira o intervalo'; rodape(); return false; } return true; };
  const achar = linha => est.itens.find(x => x.linha === +linha);

  lista.addEventListener('click', async ev => {
    const li = ev.target.closest('.ag-item'); if (!li) return;
    const x = achar(li.dataset.linha); if (!x) return;
    if (!ev.target.closest('.ag-chk')) { abrir(x); return; }
    if (!podeEditar()) return;
    x.feita = !x.feita; LS.set(CACHE, { itens: est.itens, meta: est.meta, sig: est.sig, em: est.em }); render();
    try { await gravar(escritas(x.linha, { st: x.feita })); est.erro = ''; }
    catch (err) { x.feita = !x.feita; est.erro = 'não consegui gravar: ' + err.message; render(); }
    rodape();
  });
  lista.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.classList.contains('ag-item')) { const x = achar(ev.target.dataset.linha); if (x) abrir(x); } });

  const dlg = $('#dlg-ag'); let editando = null;
  const p2 = n => String(n).padStart(2, '0');
  function abrir(x) {
    if (!podeEditar()) return;
    editando = x || null;
    $('#ag-titulo').textContent = x ? 'Editar item' : 'Novo item';
    $('#ag-f-desc').value = x ? x.desc : '';
    $('#ag-f-data').value = x ? x.t[0] + '-' + p2(x.t[1] + 1) + '-' + p2(x.t[2]) : '';
    $('#ag-f-hora').value = x ? x.hora : '';
    $('#ag-f-cat').value = x ? x.cat : '';
    $('#ag-f-feita').checked = !!(x && x.feita); $('#ag-feita-l').hidden = !x; $('#ag-excluir').hidden = !x;
    $('#ag-cats').replaceChildren(...[...new Set(['Imp', 'Outros', ...est.itens.map(i => i.cat).filter(Boolean)])].map(c => new Option('', c)));
    $('#ag-erro').hidden = true;
    dlg.showModal(); $('#ag-f-desc').focus();
  }
  $('#ag-nova').onclick = () => abrir(null);
  $('#ag-cancelar').onclick = () => dlg.close();

  async function executar(btn, texto, fn) {
    btn.disabled = true; const t0 = btn.textContent; btn.textContent = texto;
    try { await fn(); dlg.close(); await carregar(true); }
    catch (err) { $('#ag-erro').textContent = 'Não consegui gravar: ' + (err instanceof SyntaxError ? 'resposta inesperada do script' : err.message); $('#ag-erro').hidden = false; }
    finally { btn.disabled = false; btn.textContent = t0; }
  }
  $('#ag-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const desc = $('#ag-f-desc').value.trim(), dv = $('#ag-f-data').value, mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dv);
    const erro = t => { $('#ag-erro').textContent = t; $('#ag-erro').hidden = false; };
    if (!desc) return erro('Escreva a descrição.');
    if (!mm) return erro('Escolha a data.');
    const t = [+mm[1], +mm[2] - 1, +mm[3]], hora = $('#ag-f-hora').value, cat = $('#ag-f-cat').value.trim(), m = est.meta;
    const btn = $('#ag-salvar');
    if (editando) executar(btn, 'Salvando…', () => gravar(escritas(editando.linha, { st: $('#ag-f-feita').checked, desc, hora: valHora(hora), cat, data: valData(t) })));
    else {
      const cols = {}; [['desc', desc], ['hora', valHora(hora)], ['cat', cat], ['data', valData(t)]].forEach(([k, v]) => { if (m.cols[k]) cols[m.cols[k]] = v; });
      executar(btn, 'Salvando…', () => gravar([{ acao: 'anexar', aba: m.aba, linhaInicial: m.primeira, colunaChave: m.cols.desc, colunas: cols }]));
    }
  });
  $('#ag-excluir').onclick = () => {
    if (!editando || !confirm('Excluir "' + editando.desc + '" da agenda? Isso limpa a linha na planilha.')) return;
    const l = editando.linha;
    executar($('#ag-excluir'), 'Excluindo…', () => gravar([
      ...['desc', 'hora', 'cat', 'data'].filter(k => est.meta.cols[k]).map(k => ({ acao: 'limpar', aba: est.meta.aba, intervalo: est.meta.cols[k] + l })),
      ...escritas(l, { st: false })]));
  };
  window.addEventListener('hashchange', () => { if (visivel()) { render(); carregar(); } });
  setInterval(() => { render(); rodape(); }, 60000);        // vira o dia sem precisar recarregar

  /* ---------- configuração ---------- */
  const campos = ['#ag-aba', '#ag-int', '#ag-verm', '#ag-amar', '#ag-conc'];
  function mostrarCfg() {
    const a = cfg.agenda;
    $('#ag-aba').value = a.aba; $('#ag-int').value = a.intervalo; $('#ag-verm').value = a.vermelho; $('#ag-amar').value = a.amarelo; $('#ag-conc').checked = a.concluidas;
  }
  campos.forEach(s => $(s).addEventListener('change', () => {
    const a = cfg.agenda, iv = $('#ag-int').value.trim().toUpperCase();
    a.aba = $('#ag-aba').value.trim() || PADRAO.aba;
    $('#ag-int').classList.toggle('erro', !REGEX.test(iv));
    if (REGEX.test(iv)) a.intervalo = iv;
    a.vermelho = Math.max(0, parseInt($('#ag-verm').value) || 0);
    a.amarelo = Math.max(a.vermelho, parseInt($('#ag-amar').value) || 0);
    a.concluidas = $('#ag-conc').checked;
    LS.set('pomo-cfg', cfg); mostrarCfg(); render(); if (visivel()) carregar();
  }));
  mostrarCfg();
  render(); rodape();
  if (visivel()) carregar();
})();