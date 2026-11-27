/* Tipo de container "agenda": lê uma aba (Status, ID, Descrição, Horas, Categoria, Rest, Data), mostra a lista ordenada por data
   e deixa concluir, editar, adicionar e excluir itens (grava na planilha pelo Sheets).
   Edição rápida: clique no item e ele vira um formulário na própria linha (Enter salva, Esc cancela). A tela muda NA HORA e a gravação
   vai em segundo plano, em fila (a linha de status mostra "Salvando…"); só os campos que mudaram são enviados, e a agenda NÃO é relida
   depois de gravar. Se o script recusar, a mudança é desfeita e você é avisado.
   Oferece aos outros containers: 'agenda-itens' (a lista) e 'agenda-config' ({ vermelho, amarelo }, para colorir pelo prazo igual à lista).
   Configuração (em js/paginas.js): { aba, intervalo, vermelho, amarelo, concluidas, titulo, altura }.
     altura = altura máxima da lista, em rem (1 rem ≈ 16 px); passou disso, a lista rola (padrão 32). */
Containers.registrar('agenda', ctx => {
  const PADRAO = { titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false, altura: 32 };
  const a = () => Object.assign({}, PADRAO, ctx.def());              // configuração de agora (padrão + o que você mudou)
  const CACHE = 'ct-cache-' + ctx.id, TTL = 10 * 60 * 1000, REGEX = Util.REGEX_INTERVALO;
  const salvo = LS.get(CACHE, null) || {};
  const est = { itens: salvo.itens || [], meta: salvo.meta || null, sig: salvo.sig || '', em: salvo.em || 0, carregando: false, erro: '' };
  const sig = () => a().aba + '!' + a().intervalo;
  const salvarCache = () => LS.set(CACHE, { itens: est.itens.filter(x => !x.pend), meta: est.meta, sig: est.sig, em: est.em });   // item ainda não gravado fica de fora
  let seq = 0, ed = null, pend = 0, fila = Promise.resolve(), mudancas = 0;   // ed = edição aberta na lista; pend = gravações no ar; mudancas = conta as mudanças feitas na tela
  est.itens.forEach(x => { x.uid = ++seq; });                                // uid: identifica o item na tela (a linha da planilha ainda pode não existir)
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
  ctx.publicar('agenda-config', () => [{ vermelho: a().vermelho, amarelo: a().amarelo }]);   // os gráficos usam as mesmas faixas de prazo
  const avisarMudou = () => Util.avisar('agenda-atualizada');
  const lista = q('.ag-lista');

  raiz.append(h('datalist')); raiz.lastChild.id = 'ag-cats-' + ctx.id;   // sugestões de categoria para a edição na linha

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
        uid: ++seq, linha, desc, cat: String(e[col.cat] || '').trim(), t: [d.getFullYear(), d.getMonth(), d.getDate()],
        hora: hm && (+hm[1] || +hm[2]) ? hm[1].padStart(2, '0') + ':' + hm[2] : '',       // 00:00 = sem horário
        feita: col.st >= 0 && (v[col.st] === true || /^(true|verdadeiro|sim)$/i.test(String(e[col.st])))
      });
    });
    if (!itens.length && ex.some(l => l.some(c => String(c).trim() && !/^(true|false)$/i.test(String(c).trim()))))
      throw new Error('não reconheci a agenda. Primeiras linhas lidas: ' + ex.filter(l => l.some(c => String(c).trim())).slice(0, 2).map(l => l.join(' | ')).join(' / ') + '. Confira a aba e as células (ex.: A2:G, com o cabeçalho).');
    const L = c => c >= 0 ? letra(c0 + c) : '';
    est.meta = { aba: a().aba, primeira: l0 + ini, editavel: !r.truncado && !!m0, cols: { st: L(col.st), desc: L(col.desc), hora: L(col.hora), cat: L(col.cat), data: L(col.data) } };
    return ordenar(itens);
  }
  const ordenar = itens => itens.sort((x, y) => Date.UTC(...x.t) - Date.UTC(...y.t) || x.hora.localeCompare(y.hora));

  /* ---------- desenhar ---------- */
  const msg = (t, erro) => lista.replaceChildren(h('p', 'ag-msg' + (erro ? ' erro' : ''), t));

  function render() {
    q('.ag-titulo').textContent = a().titulo;
    raiz.style.setProperty('--ag-altura', String(Math.max(8, Number(a().altura) || 32)));
    if (ed) return;                                                  // edição aberta: a lista só é refeita quando ela fechar
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
      const li = h('div', 'ag-item' + (x.feita ? ' feita' : '')); li.dataset.uid = x.uid; li.tabIndex = 0; li.title = 'Clique para editar';
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
    q('.ag-status').textContent = pend ? 'Salvando…' : Util.textoAtualizado(est);
    q('.ag-status').classList.toggle('salvando', pend > 0);
  }

  async function carregar(forcar) {
    if (!Sheets.pronto()) { render(); return; }
    if (est.carregando || pend) return;                           // gravando: a tela já está mais nova que a planilha
    if (!forcar && est.sig === sig() && Date.now() - est.em < TTL) { rodape(); return; }
    est.carregando = true; est.erro = ''; render(); rodape();
    const v0 = mudancas;
    try {
      Util.exigirInternet();
      const d = await Sheets.ler(a().aba, a().intervalo, { retorno: ['exibidos', 'valores'], limite: 3000 });
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      if (v0 !== mudancas) return;                                  // você mexeu enquanto lia: essa leitura já é velha
      est.itens = converter(d); est.sig = sig(); est.em = Date.now();
      salvarCache(); avisarMudou();
    } catch (err) {
      est.erro = err.message;
    } finally { est.carregando = false; render(); rodape(); }
  }

  q('.ag-atualizar').onclick = () => carregar(true);

  /* ---------- editar, concluir, adicionar e excluir: a tela muda na hora e a planilha recebe em segundo plano ---------- */
  const valHora = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) / 1440 : 0; };   // fração do dia (00:00 = sem horário)
  const valData = t => ({ iso: new Date(t[0], t[1], t[2], 12).toISOString(), como: 'data' });
  async function gravar(itens) {
    const d = await Sheets.lote(itens);
    if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
    if (!d.resultados) throw new Error('o script está numa versão antiga: atualize o apps-script.gs');
    const ruim = d.resultados.find(r => !r.ok); if (ruim) throw new Error(ruim.erro || 'o script recusou a gravação');
    return d.resultados;
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
  const achar = uid => est.itens.find(x => x.uid === +uid);
  const linhaDe = x => { if (x.linha == null) throw new Error('o item anterior não foi gravado'); return x.linha; };   // item novo recebe a linha quando o script responde

  // Põe a gravação na fila (uma de cada vez, na ordem). pedido() é chamado só na hora de enviar; aoOk(resultados) e desfazer() são da tela.
  function enfileirar(pedido, aoOk, desfazer) {
    pend++; mudancas++; rodape();
    fila = fila.then(async () => {
      try { const r = await gravar(pedido()); est.erro = ''; if (aoOk) aoOk(r); }
      catch (err) {
        desfazer(); mudancas++; est.em = 0; salvarCache(); render(); avisarMudou();
        mostrar('erro', 'Agenda: não consegui gravar (' + err.message + '). Desfiz a mudança na tela.');
        est.erro = 'não consegui gravar: ' + err.message;
      } finally {
        pend--; rodape();
        if (!pend && !est.carregando && est.em === 0) carregar(true);       // depois de uma falha, relê para a tela voltar a bater com a planilha
      }
    });
  }

  function alternar(x) {
    if (!podeEditar()) return;
    const antes = x.feita; x.feita = !antes; salvarCache(); render(); avisarMudou();       // avisa já: o gráfico remarca os dias "Imp"
    enfileirar(() => escritas(linhaDe(x), { st: x.feita }), null, () => { x.feita = antes; });
  }

  function editarItem(x, n) {
    const campos = {};
    if (n.desc !== x.desc) campos.desc = n.desc;
    if (n.hora !== x.hora) campos.hora = valHora(n.hora);
    if (n.cat !== x.cat) campos.cat = n.cat;
    if (n.t.join() !== x.t.join()) campos.data = valData(n.t);
    if (!Object.keys(campos).length) return;                         // nada mudou: nada a enviar
    const velho = { desc: x.desc, hora: x.hora, cat: x.cat, t: x.t };
    Object.assign(x, n); ordenar(est.itens); salvarCache(); avisarMudou();
    enfileirar(() => escritas(linhaDe(x), campos), null, () => { Object.assign(x, velho); ordenar(est.itens); });
  }

  function criarItem(n) {
    const m = est.meta, x = Object.assign({ uid: ++seq, linha: null, feita: false, pend: true }, n);
    est.itens.push(x); ordenar(est.itens); avisarMudou();
    enfileirar(() => {
      const cols = {}; [['desc', x.desc], ['hora', valHora(x.hora)], ['cat', x.cat], ['data', valData(x.t)]].forEach(([k, v]) => { if (m.cols[k]) cols[m.cols[k]] = v; });
      return [{ acao: 'anexar', aba: m.aba, linhaInicial: m.primeira, colunaChave: m.cols.desc, colunas: cols }];
    }, r => { x.linha = typeof r[0].linha === 'number' ? r[0].linha : null; delete x.pend; if (x.linha == null) est.em = 0; salvarCache(); },
    () => { est.itens = est.itens.filter(i => i !== x); });
  }

  function excluirItem(x) {
    const pos = est.itens.indexOf(x), cols = est.meta.cols;
    est.itens.splice(pos, 1); salvarCache(); avisarMudou();
    enfileirar(() => { const l = linhaDe(x); return [
      ...['desc', 'hora', 'cat', 'data'].filter(k => cols[k]).map(k => ({ acao: 'limpar', aba: est.meta.aba, intervalo: cols[k] + l })),
      ...escritas(l, { st: false })]; },
    null, () => { est.itens.splice(Math.min(pos, est.itens.length), 0, x); ordenar(est.itens); });
  }

  /* ---------- edição na própria linha ---------- */
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  function criarForm(x) {
    const f = h('form', 'ag-item ag-edit'); f.autocomplete = 'off'; f.noValidate = true;
    const campo = (tipo, cls, rotulo, extra) => { const i = h('input', cls); i.type = tipo; i.title = rotulo; i.setAttribute('aria-label', rotulo); return Object.assign(i, extra); };
    const desc = campo('text', 'ag-f-desc', 'Descrição', { maxLength: 120, placeholder: 'Descrição', value: x ? x.desc : '' });
    const data = campo('date', 'ag-f-data', 'Data', { value: x ? x.t[0] + '-' + p2(x.t[1] + 1) + '-' + p2(x.t[2]) : hojeISO() });
    const hora = campo('time', 'ag-f-hora', 'Hora (opcional)', { value: x ? x.hora : '' });
    const cat = campo('text', 'ag-f-cat', 'Categoria', { maxLength: 40, placeholder: 'Categoria', value: x ? x.cat : '' }); cat.setAttribute('list', 'ag-cats-' + ctx.id);
    const linha = h('div', 'ag-linha'); linha.append(data, hora, cat);
    const erro = h('p', 'pl-erro ag-erro'); erro.hidden = true; erro.setAttribute('role', 'alert');
    const btns = h('div', 'pl-btns');
    const btn = (cls, txt, tipo) => { const b = h('button', 'pl-btn ' + cls, txt); b.type = tipo || 'button'; return b; };
    const excluir = btn('perigo ag-excluir', 'Excluir'), cancelar = btn('ag-cancelar', 'Cancelar'), salvar = btn('pri ag-salvar', 'Salvar', 'submit');
    if (x) btns.append(excluir);
    btns.append(h('span', 'grow'), cancelar, salvar);
    f.append(desc, linha, erro, btns);
    const falha = t => { erro.textContent = t; erro.hidden = false; };
    cancelar.onclick = () => fechar();
    excluir.onclick = () => { if (!confirm('Excluir "' + x.desc + '" da agenda? Isso limpa a linha na planilha.')) return; fechar(); excluirItem(x); render(); };
    f.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fechar(); } });   // Esc cancela (e não fecha o painel)
    f.addEventListener('submit', ev => {                              // Enter em qualquer campo cai aqui
      ev.preventDefault();
      const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.value);
      if (!desc.value.trim()) { falha('Escreva a descrição.'); desc.focus(); return; }
      if (!mm) { falha('Escolha a data.'); data.focus(); return; }
      const n = { desc: desc.value.trim(), t: [+mm[1], +mm[2] - 1, +mm[3]], hora: hora.value, cat: cat.value.trim() };
      fechar(); if (x) editarItem(x, n); else criarItem(n);
      render();
    });
    return f;
  }
  function fechar() { ed = null; render(); }
  function abrir(x) {                                                 // x = item para editar, ou null para um item novo
    if (!podeEditar()) return;
    if (ed) { ed = null; render(); }                                   // outra edição aberta: cancela e refaz a lista
    const f = criarForm(x); ed = { x, f };
    const dl = raiz.querySelector('datalist');
    dl.replaceChildren(...[...new Set(['Imp', 'Outros', ...est.itens.map(i => i.cat).filter(Boolean)])].map(c => new Option('', c)));
    if (x) { const li = lista.querySelector('[data-uid="' + x.uid + '"]'); if (!li) { ed = null; return; } li.replaceWith(f); }
    else { const m = lista.querySelector('.ag-msg'); if (m) m.remove(); lista.prepend(f); lista.scrollTop = 0; }
    f.querySelector('.ag-f-desc').focus(); f.scrollIntoView({ block: 'nearest' });
  }

  lista.addEventListener('click', ev => {
    const li = ev.target.closest('.ag-item'); if (!li || li.classList.contains('ag-edit')) return;
    const x = achar(li.dataset.uid); if (!x) return;
    if (ev.target.closest('.ag-chk')) { if (ed) { ed = null; render(); } alternar(x); return; }
    abrir(x);
  });
  lista.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.classList.contains('ag-item') && !ev.target.classList.contains('ag-edit')) { const x = achar(ev.target.dataset.uid); if (x) abrir(x); } });
  q('.ag-nova').onclick = () => abrir(null);
  window.addEventListener('beforeunload', ev => { if (pend) { ev.preventDefault(); ev.returnValue = ''; } });   // fechar a aba com gravação no ar: o navegador pergunta

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
      if (chave === 'vermelho' || chave === 'amarelo') avisarMudou();               // as bolinhas dos gráficos mudam de cor
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