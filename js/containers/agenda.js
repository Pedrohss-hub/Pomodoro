/* Tipo de container "agenda": lê uma aba (Status, ID, Descrição, Horas, Categoria, Rest, Data), mostra a lista ordenada por data
   e deixa concluir, editar, adicionar e excluir itens (grava na planilha pelo Sheets).
   Configuração (em js/paginas.js): { aba, intervalo, vermelho, amarelo, concluidas, titulo, altura }.
     altura = altura máxima da lista, em rem (1 rem ≈ 16 px); passou disso, a lista rola (padrão 32). */
Containers.registrar('agenda', ctx => {
  const PADRAO = { titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false, altura: 32 };
  const a = () => Object.assign({}, PADRAO, ctx.def());              // configuração de agora (padrão + o que você mudou)
  const CACHE = 'ct-cache-' + ctx.id, TTL = 10 * 60 * 1000, REGEX = Util.REGEX_INTERVALO;
  const salvo = LS.get(CACHE, null) || {};
  const est = { itens: salvo.itens || [], meta: salvo.meta || null, sig: salvo.sig || '', em: salvo.em || 0, carregando: false, erro: '' };
  const sig = () => a().aba + '!' + a().intervalo;
  const salvarCache = () => LS.set(CACHE, { itens: est.itens, meta: est.meta, sig: est.sig, em: est.em });
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const h = Util.h;
  const p2 = n => String(n).padStart(2, '0');

  /* ---------- HTML do container (só texto fixo: nada digitado por você entra aqui) ---------- */
  const raiz = h('section', 'box ag-box');
  raiz.innerHTML = `
    <div class="box-topo"><h2 class="ag-titulo"></h2>
      <div class="acoes-topo">
        <button type="button" class="mini ag-nova" title="Adicionar item na agenda">+ Novo</button>
        <button type="button" class="mini ag-atualizar" title="Atualizar agenda" aria-label="Atualizar agenda">↻</button>
        <button type="button" class="mini ag-engrenagem" title="De onde ler" aria-label="Configurar a agenda" aria-expanded="false">⚙</button></div>
    </div>
    <p class="status-linha ag-status" role="status"></p>
    <div class="ag-lista"></div>`;
  const q = s => raiz.querySelector(s);
  // outros containers (ex.: o gráfico semanal) leem os itens da agenda por aqui
  ctx.publicar('agenda-itens', () => est.itens);
  const avisarMudou = () => Util.avisar('agenda-atualizada');
  const lista = q('.ag-lista');

  const dlg = Util.dialogo('dlg-ag', `
    <div class="dlg-corpo">
      <div class="dlg-topo"><h2 class="ag-d-titulo">Item da agenda</h2><button type="button" class="fechar">Fechar</button></div>
      <form class="pl-form ag-form" autocomplete="off">
        <label><span>Descrição</span><input type="text" class="ag-f-desc" maxlength="120"></label>
        <div class="pl-2">
          <label><span>Data</span><input type="date" class="ag-f-data"></label>
          <label><span>Hora (opcional)</span><input type="time" class="ag-f-hora"></label>
        </div>
        <label><span>Categoria</span><input type="text" class="ag-f-cat" list="ag-cats-${ctx.id}" maxlength="40"></label>
        <datalist id="ag-cats-${ctx.id}"></datalist>
        <label class="teste ag-feita-l"><input type="checkbox" class="ag-f-feita"> Concluído</label>
        <p class="pl-erro ag-erro" role="alert" hidden></p>
        <div class="pl-btns">
          <button type="button" class="pl-btn perigo ag-excluir">Excluir</button>
          <span class="grow"></span>
          <button type="button" class="pl-btn ag-cancelar">Cancelar</button>
          <button type="submit" class="pl-btn pri ag-salvar">Salvar</button>
        </div>
      </form>
    </div>`);
  const qd = s => dlg.querySelector(s);

  /* ---------- ler: linhas da planilha -> itens [{desc, hora, cat, feita, t:[ano, mês, dia]}] ordenados por data e hora ---------- */
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
    est.meta = { aba: a().aba, primeira: l0 + ini, editavel: !r.truncado && !!m0, cols: { st: L(col.st), desc: L(col.desc), hora: L(col.hora), cat: L(col.cat), data: L(col.data) } };
    return itens.sort((x, y) => Date.UTC(...x.t) - Date.UTC(...y.t) || x.hora.localeCompare(y.hora));
  }

  /* ---------- desenhar ---------- */
  const msg = (t, erro) => lista.replaceChildren(h('p', 'ag-msg' + (erro ? ' erro' : ''), t));

  function render() {
    q('.ag-titulo').textContent = a().titulo;
    raiz.style.setProperty('--ag-altura', String(Math.max(8, Number(a().altura) || 32)));
    if (!Sheets.pronto()) return msg('Configure a URL e o token (Configurações) para ver a agenda.');
    if (est.sig !== sig()) return msg(est.carregando ? 'Carregando…' : est.erro ? 'Não consegui carregar: ' + est.erro : 'Ainda sem dados. Use ↻.', !!est.erro && !est.carregando);
    const { vermelho, amarelo, concluidas } = a();
    const hoje = new Date(), h0 = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const itens = est.itens.filter(x => concluidas || !x.feita);
    if (!itens.length) return msg('Nada pendente na agenda.');
    const nivel = d => d < 0 ? 0 : d <= vermelho ? 1 : d <= amarelo ? 2 : 3;
    const rel = d => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d < 0 ? 'há ' + (-d) + ' d' : 'em ' + d + ' d';
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
    q('.ag-status').textContent = Util.textoAtualizado(est);
  }

  async function carregar(forcar) {
    if (!Sheets.pronto()) { render(); return; }
    if (est.carregando) return;
    if (!forcar && est.sig === sig() && Date.now() - est.em < TTL) { rodape(); return; }
    est.carregando = true; est.erro = ''; render(); rodape();
    try {
      Util.exigirInternet();
      const d = await Sheets.ler(a().aba, a().intervalo, { retorno: ['exibidos', 'valores'], limite: 3000 });
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      est.itens = converter(d); est.sig = sig(); est.em = Date.now();
      salvarCache(); avisarMudou();
    } catch (err) {
      est.erro = err.message;
    } finally { est.carregando = false; render(); rodape(); }
  }

  q('.ag-atualizar').onclick = () => carregar(true);

  /* ---------- editar, concluir, adicionar e excluir (grava na planilha) ---------- */
  const valHora = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) / 1440 : 0; };   // fração do dia (00:00 = sem horário)
  const valData = t => ({ iso: new Date(t[0], t[1], t[2], 12).toISOString(), como: 'data' });
  async function gravar(itens) {
    const d = await Sheets.lote(itens);
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
    x.feita = !x.feita; salvarCache(); render(); avisarMudou();       // avisa já: o gráfico remarca os dias "Imp"
    try { await gravar(escritas(x.linha, { st: x.feita })); est.erro = ''; }
    catch (err) { x.feita = !x.feita; est.erro = 'não consegui gravar: ' + err.message; salvarCache(); render(); avisarMudou(); }
    rodape();
  });
  lista.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.classList.contains('ag-item')) { const x = achar(ev.target.dataset.linha); if (x) abrir(x); } });

  let editando = null;
  function abrir(x) {
    if (!podeEditar()) return;
    editando = x || null;
    qd('.ag-d-titulo').textContent = x ? 'Editar item' : 'Novo item';
    qd('.ag-f-desc').value = x ? x.desc : '';
    qd('.ag-f-data').value = x ? x.t[0] + '-' + p2(x.t[1] + 1) + '-' + p2(x.t[2]) : '';
    qd('.ag-f-hora').value = x ? x.hora : '';
    qd('.ag-f-cat').value = x ? x.cat : '';
    qd('.ag-f-feita').checked = !!(x && x.feita); qd('.ag-feita-l').hidden = !x; qd('.ag-excluir').hidden = !x;
    qd('datalist').replaceChildren(...[...new Set(['Imp', 'Outros', ...est.itens.map(i => i.cat).filter(Boolean)])].map(c => new Option('', c)));
    qd('.ag-erro').hidden = true;
    dlg.showModal(); qd('.ag-f-desc').focus();
  }
  q('.ag-nova').onclick = () => abrir(null);
  qd('.ag-cancelar').onclick = () => dlg.close();

  async function executar(btn, texto, fn) {
    btn.disabled = true; const t0 = btn.textContent; btn.textContent = texto;
    try { await fn(); dlg.close(); await carregar(true); }
    catch (err) { qd('.ag-erro').textContent = 'Não consegui gravar: ' + err.message; qd('.ag-erro').hidden = false; }
    finally { btn.disabled = false; btn.textContent = t0; }
  }
  qd('.ag-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const desc = qd('.ag-f-desc').value.trim(), dv = qd('.ag-f-data').value, mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dv);
    const erro = t => { qd('.ag-erro').textContent = t; qd('.ag-erro').hidden = false; };
    if (!desc) return erro('Escreva a descrição.');
    if (!mm) return erro('Escolha a data.');
    const t = [+mm[1], +mm[2] - 1, +mm[3]], hora = qd('.ag-f-hora').value, cat = qd('.ag-f-cat').value.trim(), m = est.meta;
    const btn = qd('.ag-salvar');
    if (editando) executar(btn, 'Salvando…', () => gravar(escritas(editando.linha, { st: qd('.ag-f-feita').checked, desc, hora: valHora(hora), cat, data: valData(t) })));
    else {
      const cols = {}; [['desc', desc], ['hora', valHora(hora)], ['cat', cat], ['data', valData(t)]].forEach(([k, v]) => { if (m.cols[k]) cols[m.cols[k]] = v; });
      executar(btn, 'Salvando…', () => gravar([{ acao: 'anexar', aba: m.aba, linhaInicial: m.primeira, colunaChave: m.cols.desc, colunas: cols }]));
    }
  });
  qd('.ag-excluir').onclick = () => {
    if (!editando || !confirm('Excluir "' + editando.desc + '" da agenda? Isso limpa a linha na planilha.')) return;
    const l = editando.linha;
    executar(qd('.ag-excluir'), 'Excluindo…', () => gravar([
      ...['desc', 'hora', 'cat', 'data'].filter(k => est.meta.cols[k]).map(k => ({ acao: 'limpar', aba: est.meta.aba, intervalo: est.meta.cols[k] + l })),
      ...escritas(l, { st: false })]));
  };

  /* ---------- configuração: o ⚙ abre o painel padrão ao lado (o container continua visível) ---------- */
  const CAMPOS = [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
    { chave: 'aba', rotulo: 'Aba da planilha', tipo: 'aba' },
    { chave: 'intervalo', rotulo: 'Células', tipo: 'intervalo', dica: 'Colunas, nesta ordem: Status, ID, Descrição, Horas, Categoria, Rest, Data. Ex.: A3:G' },
    { chave: 'vermelho', rotulo: 'Data em vermelho até (dias)', tipo: 'numero', min: 0, dica: 'Passou disso, fica amarela; mais longe ainda, verde.' },
    { chave: 'amarelo', rotulo: 'Data em amarelo até (dias)', tipo: 'numero', min: 0 },
    { chave: 'concluidas', rotulo: 'Mostrar também os itens concluídos', tipo: 'caixa' },
    { chave: 'altura', rotulo: 'Altura máxima da lista', tipo: 'numero', min: 8, max: 80, dica: 'Em rem (1 rem ≈ 16 px). Passou disso, a lista rola.' }
  ];
  q('.ag-engrenagem').onclick = () => Painel.abrir({
    id: 'cfg:' + ctx.id, titulo: a().titulo, subtitulo: 'Agenda · as mudanças valem na hora', alvo: raiz, campos: CAMPOS, valores: a,
    aoMudar(chave, valor) {
      const mud = { [chave]: valor };
      if (chave === 'vermelho') mud.amarelo = Math.max(valor, a().amarelo);        // o amarelo nunca fica antes do vermelho
      ctx.ajustar(mud); q('.ag-titulo').textContent = a().titulo; Painel.titulo(a().titulo);
      render(); if (ctx.visivel() && (chave === 'aba' || chave === 'intervalo')) carregar();
      if (chave === 'vermelho') Painel.atualizar();
    }
  });

  setInterval(() => { render(); rodape(); }, 60000);        // vira o dia sem precisar recarregar

  return {
    raiz,
    iniciar() {
      render(); rodape(); avisarMudou(); if (ctx.visivel()) carregar();
      // apagadinho quando fora da vista, igual aos gráficos
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => raiz.classList.toggle('em-foco', en.isIntersecting), { rootMargin: '0px 0px -45% 0px' }).observe(raiz);
      else raiz.classList.add('em-foco');
    },
    aparecer() { render(); carregar(); }
  };
});