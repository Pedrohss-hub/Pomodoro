/* Agenda: lê da planilha (Status, ID, Descrição, Horas, Categoria, Rest, Data) e mostra a lista ordenada por data. */
(() => {
  const PADRAO = { aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false };
  cfg.agenda = Object.assign({}, PADRAO, cfg.agenda);
  const CACHE = 'pomo-agenda', TTL = 10 * 60 * 1000, REGEX = /^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d*$/;
  const salvo = LS.get(CACHE, null) || {};
  const est = { itens: salvo.itens || [], sig: salvo.sig || '', em: salvo.em || 0, carregando: false, erro: '' };
  const sig = () => cfg.agenda.aba + '!' + cfg.agenda.intervalo;
  const det = $('#ag-det'), lista = $('#ag-lista');
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const visivel = () => !$('#pg-pomo').hidden;

  // linhas da planilha -> itens [{desc, hora, cat, feita, t:[ano, mês, dia]}] ordenados por data e hora.
  // As colunas são achadas pelo cabeçalho (Status, Descrição, Horas, Categoria, Data) se ele estiver no intervalo;
  // sem cabeçalho, vale a ordem Status, ID, Descrição, Horas, Categoria, Rest, Data.
  function converter(r) {
    const ex = r.exibidos || [], va = r.valores || [];
    let col = { st: 0, desc: 2, hora: 3, cat: 4, data: 6 }, ini = 0;
    for (let i = 0; i < Math.min(ex.length, 8); i++) {
      const l = ex[i].map(c => String(c).trim().toLowerCase()), f = re => l.findIndex(c => re.test(c));
      if (f(/^descri/) >= 0 && f(/^data/) >= 0) { col = { st: f(/^status/), desc: f(/^descri/), hora: f(/^hora/), cat: f(/^categ/), data: f(/^data/) }; ini = i + 1; break; }
    }
    const itens = [];
    ex.slice(ini).forEach((e, k) => {
      const v = va[ini + k] || [], desc = String(e[col.desc] || '').trim();
      if (!desc) return;
      let d = /^\d{4}-\d{2}-\d{2}T/.test(String(v[col.data])) ? new Date(v[col.data]) : null;
      if (!d) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(e[col.data]); if (m) d = new Date(+m[3], +m[2] - 1, +m[1]); }
      if (!d || isNaN(d)) return;                                   // linha sem data
      const hm = /(\d{1,2}):(\d{2})/.exec(e[col.hora] || '');
      itens.push({
        desc, cat: String(e[col.cat] || '').trim(), t: [d.getFullYear(), d.getMonth(), d.getDate()],
        hora: hm && (+hm[1] || +hm[2]) ? hm[1].padStart(2, '0') + ':' + hm[2] : '',       // 00:00 = sem horário
        feita: col.st >= 0 && (v[col.st] === true || /^(true|verdadeiro|sim)$/i.test(String(e[col.st])))
      });
    });
    if (!itens.length && ex.some(l => l.some(c => String(c).trim() && !/^(true|false)$/i.test(String(c).trim()))))
      throw new Error('não reconheci a agenda. Primeiras linhas lidas: ' + ex.filter(l => l.some(c => String(c).trim())).slice(0, 2).map(l => l.join(' | ')).join(' / ') + '. Confira a aba e as células (ex.: A2:G, com o cabeçalho).');
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
      const li = h('div', 'ag-item' + (x.feita ? ' feita' : ''));
      const data = h('div', 'ag-data v' + nivel(dias));
      data.append(h('b', null, p2(x.t[2]) + '/' + p2(x.t[1] + 1) + (x.t[0] !== hoje.getFullYear() ? '/' + String(x.t[0]).slice(2) : '')),
        h('small', null, DIAS[new Date(x.t[0], x.t[1], x.t[2]).getDay()] + ' · ' + rel(dias)));
      const meta = h('div', 'ag-meta');
      if (x.hora) meta.append(h('span', null, x.hora));
      if (x.cat) meta.append(h('span', 'ag-tag', x.cat));
      const corpo = h('div'); corpo.append(h('div', 'ag-desc', x.desc), meta);
      li.append(data, corpo);
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
      LS.set(CACHE, { itens: est.itens, sig: est.sig, em: est.em });
    } catch (err) {
      est.erro = err instanceof SyntaxError ? 'resposta inesperada do script' : err.name === 'TypeError' ? 'sem conexão com o script' : err.message;
    } finally { est.carregando = false; render(); rodape(); }
  }

  $('#ag-atualizar').onclick = () => carregar(true);
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