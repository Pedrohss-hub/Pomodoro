/* Tipo de container "graficos": gráficos de barras, linhas e histograma lidos de intervalos da planilha, desenhados em SVG,
   com período anterior apagado, dia da semana, marcas de itens "Imp" da agenda, cache e janela ampliada (botão Gráficos do topo).
   Configuração (em js/paginas.js): { titulo, graficos: [lista] } (null = lista padrão; o ⚙ do quadro edita a lista). */
Containers.registrar('graficos', ctx => {
  const intervaloInicio = () => { const p = cfg.planilha, c = String(p.campos.inicio || 'B').toUpperCase(); return c + p.linhaInicial + ':' + c; };
  const GRAF_PADRAO = [
    { id: 'g4', titulo: 'Desenvolvimento semanal', tipo: 'linhas', aba: 'Banco', intervalo: 'Q18:S25', ativo: true, imp: true },
    { id: 'g3', titulo: 'Estudo mensal anual', tipo: 'barras', aba: 'Banco', intervalo: 'Q3:S14', ativo: true },
    { id: 'g1', titulo: 'Estudo mensal', tipo: 'barras', aba: 'Banco', intervalo: 'I3:K', ativo: true },
    { id: 'g2', titulo: 'Estudo anual', tipo: 'barras', aba: 'Banco', intervalo: 'M3:O', ativo: true },
    { id: 'g5', titulo: 'Horários de início', tipo: 'histograma', aba: cfg.planilha.aba, intervalo: intervaloInicio(), passo: 60, ativo: true }
  ];
  // lista de gráficos: a do código (padrão) ou a que você montou (fica neste navegador, em ct-defs-v1)
  const graficos = JSON.parse(JSON.stringify(ctx.def().graficos || GRAF_PADRAO));
  const persistir = () => ctx.ajustar({ graficos });

  const corCss = (v, padrao) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || padrao;
  const IMP = '#C9A227';   // dourado discreto para os dias importantes
  const CORES = { get liq() { return corCss('--g-liq', '#4B3BFF'); }, get per() { return corCss('--g-per', '#E08A00'); } };
  const CACHE = 'ct-cache-' + ctx.id, TTL = 10 * 60 * 1000;
  const salvoCache = LS.get(CACHE, null) || {};
  const estado = { dados: salvoCache.dados || {}, em: salvoCache.em || 0, carregando: false, erro: '' };
  const sig = g => g.aba + '!' + g.intervalo + (g.tipo === 'histograma' ? '#h' : (g.anterior ? '+' + g.anterior : '') + (g.diaSemana ? '#d' : ''));
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  // dia da semana de uma linha [rótulo, líquido, perdido, data ISO]: usa a data da célula; se faltar, tenta ler dd/mm[/aaaa] do rótulo
  function dataLinha(l) {
    let d = /^\d{4}-\d{2}-\d{2}T/.test(l[3] || '') ? new Date(l[3]) : null;
    if (!d) { const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(l[0] || ''); if (m) d = new Date(m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(), +m[2] - 1, +m[1]); }
    return d && !isNaN(d) ? d : null;
  }
  const diaSem = l => { const d = dataLinha(l); return d ? DIAS[d.getDay()] : null; };
  // itens da categoria "Imp" da agenda que caem num dia (nome + hora)
  const impDoDia = d => (window.Agenda ? [...window.Agenda.fontes.values()] : []).flatMap(f => f())
    .filter(x => /^imp/i.test(x.cat) && x.t[0] === d.getFullYear() && x.t[1] === d.getMonth() && x.t[2] === d.getDate())
    .map(x => x.desc + (x.hora ? ' · ' + x.hora : ''));
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const sv = (tag, attrs, txt) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; };

  const horaTxt = x => { const m = Math.round(x * 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
  const passo = max => { for (const p of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]) if (max / p <= 5) return p; return 10000; };

  const passoN = max => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find(p => max / p <= 5) || 2000;

  /* ---------- desenho do gráfico (SVG feito à mão, sem bibliotecas) ---------- */
  function desenharSvg(plot, tipo, rot, series, tip, unid = 'h', dicas, marcas, hoje) {
    const velho = plot.querySelector('svg'); if (velho) velho.remove();
    tip.hidden = true;
    const W = Math.max(260, plot.clientWidth), H = 240, ML = 46, MR = 10, MT = 12, MB = 30;
    const pw = W - ML - MR, ph = H - MT - MB, n = rot.length;
    const vis = series.filter(s => !s.oculta);
    const max = Math.max(unid === 'n' ? 1 : 0.5, ...vis.flatMap(s => s.valores));
    const st = unid === 'n' ? passoN(max) : passo(max), topo = Math.ceil(max / st - 1e-9) * st;
    const y = v => MT + ph - (v / topo) * ph;
    const gw = pw / n;
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Gráfico de estudo' });
    svg.style.cssText = 'width:100%;height:auto;display:block;touch-action:pan-y';

    for (let k = 0; k * st <= topo + 1e-9; k++) {
      const v = k * st;
      svg.append(sv('line', { x1: ML, x2: W - MR, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }),
        sv('text', { x: ML - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--soft)' }, unid === 'n' ? String(v) : v + 'h'));
    }
    const cada = Math.ceil(n / Math.max(1, Math.floor(pw / 48)));
    rot.forEach((r, i) => {
      if (i % cada && i !== hoje) return;
      svg.append(sv('text', { x: ML + gw * (i + .5), y: H - 10, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': i === hoje ? 700 : 400, fill: i === hoje ? 'var(--ink)' : 'var(--soft)' }, r.length > 9 ? r.slice(0, 8) + '…' : r));
    });

    // dias com algo importante: faixa dourada bem leve e um pequeno losango no topo (sem alarme)
    if (marcas) marcas.forEach((n, i) => {
      if (!n) return;
      const cx = ML + gw * (i + .5);
      svg.append(sv('rect', { x: ML + gw * i, y: MT, width: gw, height: ph, fill: IMP, opacity: 0.12 }),
        sv('polygon', { points: [[cx, MT + 2], [cx + 5, MT + 7], [cx, MT + 12], [cx - 5, MT + 7]].map(p => p.join(',')).join(' '), fill: IMP, opacity: 0.85 }));
    });
    const marca = sv('rect', { y: MT, height: ph, width: gw, fill: 'var(--ink)', opacity: 0.06, visibility: 'hidden' });
    svg.append(marca);

    // o período anterior (fundo) é desenhado primeiro, apagado
    if (tipo === 'linhas') {
      vis.slice().sort((x, y2) => (y2.fundo ? 1 : 0) - (x.fundo ? 1 : 0)).forEach(s => {
        const pts = s.valores.map((v, i) => [ML + gw * (i + .5), y(v)]);
        const fx = s.fundo ? { 'stroke-dasharray': '5 4', opacity: 0.45 } : {};
        if (pts.length > 1) svg.append(sv('path', Object.assign({ d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), fill: 'none', stroke: s.cor, 'stroke-width': s.fundo ? 2 : 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, fx)));
        pts.forEach((p, i) => svg.append(sv('circle', Object.assign({ cx: p[0], cy: p[1], r: i === hoje && s.chave === 'liq' && !s.fundo ? 5.5 : 3.5, fill: s.cor }, s.fundo ? { opacity: 0.45 } : {}))));
      });
    } else {
      const prim = vis.filter(s => !s.fundo), k = Math.max(1, prim.length);
      const bw = tipo === 'histograma' ? gw * 0.9 : Math.min(26, (gw * 0.74) / k);
      const xb = (si, i) => ML + gw * i + gw / 2 - (k * bw) / 2 + si * bw;
      const barra = (x, v, w, cor, op) => { if (v > 0) svg.append(sv('rect', { x, y: y(v), width: Math.max(1, w), height: Math.max(1, (v / topo) * ph), rx: tipo === 'histograma' ? 1 : 2, fill: cor, opacity: op })); };
      vis.filter(s => s.fundo).forEach(s => s.valores.forEach((v, i) => barra(xb(0, i) - 3, v, bw + 5, s.cor, 0.3)));
      prim.forEach((s, si) => s.valores.forEach((v, i) => barra(xb(si, i) + .5, v, bw - 1, s.cor, 1)));
    }

    function mostrar(ev) {
      const r = svg.getBoundingClientRect(), esc = W / r.width;
      const i = Math.floor(((ev.clientX - r.left) * esc - ML) / gw);
      if (i < 0 || i >= n) { esconder(); return; }
      marca.setAttribute('x', ML + gw * i); marca.setAttribute('visibility', 'visible');
      tip.replaceChildren();
      tip.append(h('b', null, (dicas && dicas[i]) || rot[i]));
      series.forEach(s => {
        const l = h('div', 'gf-tip-l');
        const p = h('i'); p.style.background = s.cor;
        l.append(p, document.createTextNode(s.nome + ': ' + (unid === 'n' ? s.valores[i] : horaTxt(s.valores[i])))); tip.append(l);
      });
      if (marcas && marcas[i]) {
        const t2 = h('b', null, 'Importante'); t2.style.marginTop = '.3rem'; tip.append(t2);
        marcas[i].forEach(nm => { const l = h('div', 'gf-tip-l'), p = h('i'); p.style.background = IMP; l.append(p, document.createTextNode(nm)); tip.append(l); });
      }
      tip.hidden = false;
      const cx = (ML + gw * (i + .5)) / esc;
      tip.style.left = Math.max(0, Math.min(cx + 12, plot.clientWidth - tip.offsetWidth)) + 'px';
    }
    function esconder() { marca.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', mostrar);
    svg.addEventListener('pointerleave', esconder);
    plot.prepend(svg);
  }

  /* ---------- cartão de um gráfico ---------- */
  function cartao(g) {
    const card = h('div', 'gf-card');
    const topo = h('div', 'gf-topo'), sub = h('span', 'gf-sub');
    topo.append(h('h3', null, g.titulo || 'Gráfico'), sub);
    const leg = h('div', 'gf-leg'), plot = h('div', 'gf-plot'), tip = h('div', 'gf-tip'), msg = h('p', 'gf-msg');
    tip.hidden = true; plot.append(tip);
    card.append(topo, leg, plot, msg);
    const ocultas = new Set();
    let ultimo = null, larg = 0;

    const aviso = (t, erro) => { msg.textContent = t; msg.className = 'gf-msg' + (erro ? ' erro' : ''); msg.hidden = !t; };
    const pintar = () => { if (ultimo && plot.clientWidth > 0) { larg = plot.clientWidth; desenharSvg(plot, g.tipo, ultimo.rot, ultimo.series, tip, ultimo.unid, ultimo.dicas, ultimo.marcas, ultimo.hoje); } };

    // histograma: quantas vezes você começou a estudar em cada faixa de horário do dia
    function histograma(d) {
      if (!d.minutos.length) return aviso('Não achei horários em ' + g.aba + '!' + g.intervalo + ' (esperado: a coluna Início, como 14:30)' + (d.amostra ? '. Primeiras linhas lidas: ' + d.amostra.map(l => l.join(' | ')).join(' / ') : '') + '.', true);
      const passo = g.passo === 30 ? 30 : 60, cont = Array(1440 / passo).fill(0);
      d.minutos.forEach(m => cont[Math.floor(m / passo)]++);
      const rot = cont.map((_, i) => { const m = i * passo, hh = String(Math.floor(m / 60)).padStart(2, '0'); return passo === 60 ? hh + 'h' : hh + ':' + String(m % 60).padStart(2, '0'); });
      [[60, '1 h'], [30, '30 min']].forEach(([v, t]) => {
        const b = h('button', 'gf-leg-b', t); b.type = 'button'; b.setAttribute('aria-pressed', String(passo === v));
        b.onclick = () => { g.passo = v; persistir(); atualizar(); };
        leg.append(b);
      });
      ultimo = { rot, unid: 'n', series: [{ nome: 'Inícios', chave: 'liq', cor: CORES.liq, valores: cont }] };
      sub.textContent = d.minutos.length + ' inícios · pico ' + rot[cont.indexOf(Math.max(...cont))];
      pintar();
    }

    function atualizar() {
      const v = plot.querySelector('svg'); if (v) v.remove();
      leg.replaceChildren(); sub.textContent = ''; ultimo = null; aviso('');
      if (!Sheets.pronto()) return aviso('Configure a URL e o token (Configurações) para ver os gráficos.');
      const d = estado.dados[g.id];
      if (!d || d.sig !== sig(g)) return aviso(estado.carregando ? 'Carregando…' : estado.erro ? 'Não consegui carregar: ' + estado.erro : 'Ainda sem dados. Use ↻ Atualizar.', !!estado.erro && !estado.carregando);
      if (d.erro) return aviso(d.erro, true);
      if (g.tipo === 'histograma') return histograma(d);
      if (!d.linhas.some(l => l[1] != null || l[2] != null))
        return aviso('Não consegui interpretar os tempos de ' + g.aba + '!' + g.intervalo + ' (esperado: rótulo, tempo líquido, perdido)' + (d.amostra ? '. Primeiras linhas lidas: ' + d.amostra.map(l => l.join(' | ')).join(' / ') : '') + '.', true);
      const linhas = d.linhas.slice();
      while (linhas.length && linhas[0][1] == null && linhas[0][2] == null) linhas.shift();   // ignora cabeçalho
      const rot = linhas.map(l => (g.diaSemana && diaSem(l)) || l[0] || '');
      const dicas = g.diaSemana ? linhas.map((l, i) => rot[i] + (l[0] && l[0] !== rot[i] ? ' · ' + l[0] : '')) : null;
      const liq = linhas.map(l => l[1] || 0), per = linhas.map(l => l[2] || 0);
      const ant = d.ant && d.ant.length ? d.ant.map(l => l[1] || 0) : null;
      const series = [{ nome: 'Tempo líquido', chave: 'liq', cor: CORES.liq, valores: liq, oculta: ocultas.has('liq') }];
      const temPer = d.tres === undefined ? per.some(x => x > 0) : d.tres;      // intervalo com 3 colunas = mostra o perdido, mesmo que seja zero
      if (temPer) series.push({ nome: 'Perdido', chave: 'per', cor: CORES.per, valores: per, oculta: ocultas.has('per') });
      if (ant) series.push({ nome: 'Anterior', chave: 'ant', cor: CORES.liq, fundo: true, valores: ant, oculta: ocultas.has('ant') });
      const marcas = g.imp ? linhas.map(l => { const d = dataLinha(l), n = d ? impDoDia(d) : []; return n.length ? n : null; }) : null;
      const hj = new Date(), hoje = linhas.findIndex(l => { const d = dataLinha(l); return d && d.getFullYear() === hj.getFullYear() && d.getMonth() === hj.getMonth() && d.getDate() === hj.getDate(); });
      ultimo = { rot, series, dicas, marcas, hoje: hoje >= 0 ? hoje : null };
      const soma = a => a.reduce((s, x) => s + x, 0);
      sub.textContent = 'Líquido ' + horaTxt(soma(liq)) + (temPer ? ' · Perdido ' + horaTxt(soma(per)) : ' · sem coluna de perdido (use 3 colunas)') + (temPer && d.linhas.every(l => l[2] == null) ? ' · não entendi o formato do perdido' : '') + (ant ? ' · Anterior ' + horaTxt(soma(ant)) : '');
      series.forEach(s => {
        const b = h('button', 'gf-leg-b' + (s.oculta ? ' off' : '')); b.type = 'button';
        const p = h('i'); p.style.background = s.cor; if (s.fundo) p.style.opacity = 0.35; b.append(p, document.createTextNode(s.nome));
        b.title = 'Clique para ' + (s.oculta ? 'mostrar' : 'ocultar');
        b.onclick = () => { const k = s.chave; if (ocultas.has(k)) ocultas.delete(k); else if (series.filter(x => !x.oculta).length > 1) ocultas.add(k); atualizar(); };
        leg.append(b);
      });
      if (marcas && marcas.some(Boolean)) { const lg = h('span', 'gf-leg-imp'); lg.append(h('b'), document.createTextNode('Importante')); leg.append(lg); }
      pintar();
    }
    const ro = new ResizeObserver(() => { if (plot.clientWidth !== larg) pintar(); });
    ro.observe(plot);
    card.atualizar = atualizar; card.desligar = () => ro.disconnect();
    return card;
  }

  // O script devolve as células; aqui viram [rótulo, líquido(h), perdido(h)]
  function converter(r, g) {
    if (!r || !r.ok) return { erro: (r && r.erro) || 'o script não respondeu para este gráfico' };
    const ex = r.exibidos || [], va = r.valores || [], fo = r.formatos || [];
    if (g.tipo === 'histograma') {   // só os horários de início (minutos desde 00:00)
      const minutos = [];
      ex.forEach(l => { const m = /(\d{1,2}):(\d{2})/.exec(l[0]); if (m && +m[1] < 24) minutos.push(+m[1] * 60 + +m[2]); });
      return { minutos, amostra: ex.slice(0, 3) };
    }
    if (ex.length && ex[0].length < 2) return { erro: 'o intervalo precisa ter ao menos 2 colunas (rótulo e tempo líquido)' };
    const tres = ex.length && ex[0].length >= 3;
    return {
      linhas: ex.map((e, i) => [String(e[0]).trim(), emHoras(va[i][1], fo[i][1], e[1]), tres ? emHoras(va[i][2], fo[i][2], e[2]) : null, String((va[i] || [])[0] || '')]).slice(-500),
      amostra: ex.slice(0, 3), tres: !!tres
    };
  }

  /* ---------- onde os gráficos aparecem ---------- */
  const raiz = h('section', 'box gf-box');
  raiz.innerHTML = `
    <div class="box-topo"><h2 class="gf-titulo"></h2>
      <div class="acoes-topo">
        <button type="button" class="mini gf-atualizar" title="Atualizar gráficos" aria-label="Atualizar gráficos">↻</button>
        <button type="button" class="mini gf-engrenagem" title="Escolher os gráficos" aria-label="Configurar os gráficos" aria-expanded="false">⚙</button></div>
    </div>
    <p class="status-linha gf-status" role="status"></p>
    <div class="gf-cfg" hidden>
      <p class="dica">Cada gráfico lê um intervalo de 3 colunas: rótulo (data), tempo líquido e perdido. Pode ter ou não o cabeçalho; linhas vazias no fim são ignoradas. Intervalos abertos como I3:K pegam tudo até a última linha.</p>
      <div class="gf-cfg-lista"></div>
      <div class="sh-btns"><button type="button" class="gf-add">+ Adicionar gráfico</button><button type="button" class="gf-restaurar">Restaurar padrão</button></div>
    </div>
    <div class="gf-grade"></div>`;
  const dlg = h('dialog', 'gf-dlg');
  dlg.innerHTML = `
    <div class="dlg-corpo">
      <div class="dlg-topo"><h2>Gráficos de estudo</h2><button type="button" class="fechar">Fechar</button></div>
      <div class="gf-barra"><button type="button" class="mini gf-atualizar" title="Atualizar gráficos" aria-label="Atualizar gráficos">↻</button><span class="gf-status" role="status"></span></div>
      <div class="gf-grade gf-popup"></div>
    </div>`;
  document.body.append(dlg);
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
  dlg.querySelector('.fechar').onclick = () => dlg.close();
  const q = x => raiz.querySelector(x), grade = q('.gf-grade'), popup = dlg.querySelector('.gf-popup');
  q('.gf-titulo').textContent = ctx.def().titulo || 'Gráficos de estudo';
  const alvos = () => [ctx.visivel() ? grade : null, dlg.open ? popup : null].filter(Boolean);
  const visivel = () => alvos().length > 0;

  function renderizar(c) {
    (c._cards || []).forEach(x => x.desligar());
    c._cards = graficos.filter(g => g.ativo).map(cartao);
    c.replaceChildren(...c._cards);
    if (!c._cards.length) { const p = h('p', 'gf-msg', 'Nenhum gráfico ativo. Ative ou adicione no ⚙ deste quadro.'); c.append(p); }
    c._cards.forEach(x => x.atualizar());
  }
  document.addEventListener('agenda-atualizada', () => renderizarTudo());   // a agenda chegou ou mudou: remarca os dias
  function renderizarTudo() { alvos().forEach(renderizar); rodape(); }

  function rodape() {
    const t = estado.carregando ? 'Atualizando…' : estado.em ? 'Atualizado há ' + (Date.now() - estado.em < 60000 ? 'instantes' : Math.round((Date.now() - estado.em) / 60000) + ' min') : 'Ainda não atualizado';
    [...raiz.querySelectorAll('.gf-status'), ...dlg.querySelectorAll('.gf-status')].forEach(e => { e.textContent = t + (estado.erro && !estado.carregando ? ' · falhou: ' + estado.erro : ''); });
  }

  async function carregar(forcar) {
    if (!Sheets.pronto()) { renderizarTudo(); return; }
    const ativos = graficos.filter(g => g.ativo && g.intervalo);
    if (!ativos.length || estado.carregando) return;
    const velho = Date.now() - estado.em > TTL || ativos.some(g => !estado.dados[g.id] || estado.dados[g.id].sig !== sig(g));
    if (!forcar && !velho) { rodape(); return; }
    estado.carregando = true; estado.erro = ''; renderizarTudo();
    try {
      if (!navigator.onLine) throw new Error('sem internet');
      const itens = [], mapa = [], hist = g => g.tipo === 'histograma';
      ativos.forEach(g => {
        itens.push(hist(g) ? { acao: 'ler', aba: g.aba, intervalo: g.intervalo, retorno: ['exibidos'], limite: 1000 } : { acao: 'ler', aba: g.aba, intervalo: g.intervalo, retorno: ['exibidos', 'valores', 'formatos'] });
        mapa.push([g, false]);
        if (!hist(g) && g.anterior) { itens.push({ acao: 'ler', aba: g.aba, intervalo: g.anterior, retorno: ['exibidos', 'valores', 'formatos'] }); mapa.push([g, true]); }
      });
      const d = await Sheets.lote(itens);
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      if (!d.resultados) throw new Error('o script está numa versão antiga: cole o novo apps-script.gs (v-generico-1) e publique uma nova versão');
      ativos.forEach(g => { estado.dados[g.id] = { sig: sig(g) }; });
      mapa.forEach(([g, ant], i) => { const c = converter(d.resultados[i], g); if (ant) estado.dados[g.id].ant = c.erro ? null : c.linhas; else Object.assign(estado.dados[g.id], c); });
      estado.em = Date.now();
      LS.set(CACHE, { em: estado.em, dados: estado.dados });
    } catch (err) {
      estado.erro = err instanceof SyntaxError ? 'resposta inesperada do script (token, URL ou versão antiga)' : (err.name === 'TimeoutError' || err.name === 'AbortError' || (err.name === 'TypeError' && /fetch|network|load failed/i.test(err.message))) ? 'sem conexão com o script' : err.message;
    } finally { estado.carregando = false; renderizarTudo(); }
  }

  function abrirPopup() { dlg.showModal(); requestAnimationFrame(() => { renderizarTudo(); carregar(); }); }
  dlg.addEventListener('close', () => { (popup._cards || []).forEach(x => x.desligar()); popup._cards = []; popup.replaceChildren(); });
  [raiz, dlg].forEach(e => e.querySelectorAll('.gf-atualizar').forEach(b => b.onclick = () => carregar(true)));
  setInterval(rodape, 30000);

  // chamado depois que uma sessão é gravada na planilha
  window.graficosRedesenhar = () => { if (visivel()) renderizarTudo(); };
  window.graficosAposEnvio = () => { estado.em = 0; LS.set(CACHE, { em: 0, dados: estado.dados }); if (visivel()) carregar(true); };

  /* ---------- configuração (⚙ no topo do quadro) ---------- */
  const eng = q('.gf-engrenagem'), cfgBox = q('.gf-cfg');
  eng.onclick = () => { cfgBox.hidden = !cfgBox.hidden; eng.setAttribute('aria-expanded', String(!cfgBox.hidden)); };
  const REGEX_INTERVALO = /^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d*$/;
  const guardar = () => { persistir(); renderizarTudo(); if (visivel()) carregar(); };
  function montarConfig() {
    const box = q('.gf-cfg-lista'); box.replaceChildren();
    graficos.forEach((g, i) => {
      const it = h('div', 'gf-cfg-item'), l1 = h('div', 'gf-cfg-l1'), l2 = h('div', 'gf-cfg-l2');
      const at = h('input'); at.type = 'checkbox'; at.checked = g.ativo; at.title = 'Mostrar este gráfico'; at.setAttribute('aria-label', 'Mostrar ' + g.titulo);
      at.onchange = () => { g.ativo = at.checked; guardar(); };
      const ti = h('input'); ti.type = 'text'; ti.value = g.titulo; ti.setAttribute('aria-label', 'Título'); ti.placeholder = 'Título';
      ti.onchange = () => { g.titulo = ti.value.trim() || 'Gráfico'; guardar(); };
      const sobe = h('button', null, '↑'), desce = h('button', null, '↓');
      sobe.type = desce.type = 'button'; sobe.title = 'Mover para cima'; desce.title = 'Mover para baixo';
      sobe.disabled = i === 0; desce.disabled = i === graficos.length - 1;
      const mover = d => { const j = i + d; [graficos[i], graficos[j]] = [graficos[j], graficos[i]]; guardar(); montarConfig(); };
      sobe.onclick = () => mover(-1); desce.onclick = () => mover(1);
      const x = h('button', null, '✕'); x.type = 'button'; x.title = 'Remover este gráfico';
      x.onclick = () => { if (!confirm('Remover o gráfico “' + g.titulo + '”?')) return; graficos.splice(i, 1); guardar(); montarConfig(); };
      l1.append(at, ti, sobe, desce, x);
      const tp = h('select'); tp.setAttribute('aria-label', 'Tipo');
      tp.append(new Option('Barras', 'barras'), new Option('Linhas', 'linhas'), new Option('Histograma', 'histograma')); tp.value = g.tipo;
      tp.onchange = () => { g.tipo = tp.value; if (g.tipo === 'histograma') { g.aba = cfg.planilha.aba; g.intervalo = intervaloInicio(); g.passo = g.passo || 60; } guardar(); montarConfig(); };
      const ab = h('input'); ab.type = 'text'; ab.value = g.aba; ab.setAttribute('list', 'sh-abas'); ab.setAttribute('aria-label', 'Aba'); ab.placeholder = 'Aba';
      ab.onchange = () => { g.aba = ab.value.trim() || 'Banco'; guardar(); };
      const iv = h('input'); iv.type = 'text'; iv.value = g.intervalo; iv.setAttribute('aria-label', 'Células'); iv.placeholder = 'I3:K';
      iv.onchange = () => {
        const v = iv.value.trim().toUpperCase();
        iv.classList.toggle('erro', !REGEX_INTERVALO.test(v));
        if (REGEX_INTERVALO.test(v)) { g.intervalo = v; guardar(); }
      };
      l2.append(tp, ab, iv);
      it.append(l1, l2);
      if (g.tipo !== 'histograma') {   // período anterior (opcional), desenhado apagado atrás
        const an = h('input'); an.type = 'text'; an.value = g.anterior || ''; an.placeholder = 'Intervalo anterior (opcional), ex.: Q3:S14'; an.setAttribute('aria-label', 'Intervalo anterior');
        an.onchange = () => { const v = an.value.trim().toUpperCase(); an.classList.toggle('erro', !!v && !REGEX_INTERVALO.test(v)); if (!v || REGEX_INTERVALO.test(v)) { g.anterior = v; guardar(); } };
        it.append(an);
        const dl = h('label', 'teste'), dc = h('input'); dc.type = 'checkbox'; dc.checked = !!g.diaSemana;
        dc.onchange = () => { g.diaSemana = dc.checked; guardar(); };
        dl.append(dc, document.createTextNode(' Mostrar o dia da semana (Seg, Ter…) no eixo, quando a primeira coluna for uma data'));
        it.append(dl);
        const il = h('label', 'teste'), ic = h('input'); ic.type = 'checkbox'; ic.checked = !!g.imp;
        ic.onchange = () => { g.imp = ic.checked; guardar(); };
        il.append(ic, document.createTextNode(' Marcar os dias com itens "Imp" da agenda (a primeira coluna deve ser uma data)'));
        it.append(il);
      }
      box.append(it);
    });
  }
  q('.gf-add').onclick = () => {
    graficos.push({ id: 'g' + Date.now().toString(36), titulo: 'Novo gráfico', tipo: 'barras', aba: 'Banco', intervalo: 'I3:K', ativo: true });
    persistir(); montarConfig();
  };
  q('.gf-restaurar').onclick = () => {
    if (!confirm('Voltar à lista padrão de gráficos (I3:K, M3:O, Q3:S14 e Q18:S25)?')) return;
    graficos.splice(0, graficos.length, ...JSON.parse(JSON.stringify(GRAF_PADRAO))); guardar(); montarConfig();
  };

  return {
    raiz,
    iniciar() {
      const bt = $('#btn-graficos'); if (bt) { bt.hidden = false; bt.onclick = abrirPopup; }     // botão "Gráficos" do topo = janela ampliada
      montarConfig(); renderizarTudo(); carregar();
      // "no nível": o quadro fica nítido quando o topo dele passa de ~55% da altura da tela
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => raiz.classList.toggle('em-foco', en.isIntersecting), { rootMargin: '0px 0px -45% 0px' }).observe(raiz);
      else raiz.classList.add('em-foco');
    },
    aparecer() { renderizarTudo(); carregar(); }
  };
});