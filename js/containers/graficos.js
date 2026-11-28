/* Tipo de container "graficos": gráficos de barras, linhas e histograma lidos de intervalos da planilha, desenhados em SVG,
   com período anterior apagado, dia da semana, marcas de itens "Imp" da agenda e cache.
   Nos gráficos de BARRAS com um mês por barra, bolinhas numa faixa no topo (centralizadas na coluna do mês, de cima para baixo) mostram os compromissos PENDENTES da agenda daquele mês, na cor do prazo
   (as mesmas faixas da Agenda: atrasado = preto, vermelho, amarelo, verde). Opções no ⚙ do gráfico: "compromissos" ('auto' liga sozinho se os
   rótulos forem meses | 'sim' | 'nao'), "compromissosMax" (bolinhas por mês, padrão 5; o resto vira +N) e "anoMeses" (ano, quando o rótulo só traz o mês;
   vazio = ano de hoje). O mês vem da data da célula ou do rótulo (jan, janeiro/26, 03/2026, 2026-03). Não lê o Sheets: usa os itens que a Agenda já tem.
   "mesAbrev" (caixa no ⚙ das barras): mostra o mês abreviado (Jan, Fev…, pelo idioma do navegador) no eixo, se cada barra for um mês; desligado = rótulos de sempre.
   Em cada gráfico de linhas, "frente" ('liq' padrão | 'per') escolhe a linha desenhada por cima.
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
  let editandoId = null;                                  // gráfico aberto no painel de configuração

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
  // itens PENDENTES da categoria "Imp" da agenda que caem num dia (nome + hora); concluídos não marcam
  const impDoDia = d => ctx.consultar('agenda-itens')
    .filter(x => !x.feita && /^imp/i.test(x.cat) && x.t[0] === d.getFullYear() && x.t[1] === d.getMonth() && x.t[2] === d.getDate())
    .map(x => x.desc + (x.hora ? ' · ' + x.hora : ''));
  /* ---------- compromissos da agenda sobre as barras dos meses ---------- */
  const NOMES_MES = { janeiro: 0, jan: 0, fevereiro: 1, fev: 1, marco: 2, mar: 2, abril: 3, abr: 3, maio: 4, mai: 4, junho: 5, jun: 5, julho: 6, jul: 6, agosto: 7, ago: 7, setembro: 8, set: 8, outubro: 9, out: 9, novembro: 10, nov: 10, dezembro: 11, dez: 11 };
  const COR_PRAZO = ['#111111', '#F2A7A7', '#FFD966', '#B7E1CD'];      // as mesmas cores da data na lista da Agenda (css/agenda.css): v0 a v3
  const p2 = n => String(n).padStart(2, '0');
  // mês (0-11) e ano (ou null, se o rótulo só traz o mês) de uma linha [rótulo, líquido, perdido, valor bruto]; null se não for um mês
  function mesDeLinha(l) {
    const bruto = String(l[3] || '');
    if (/^\d{4}-\d{2}-\d{2}T/.test(bruto)) {                           // célula de data: +12 h tira o risco do fuso empurrar para o mês vizinho
      const d = new Date(Date.parse(bruto) + 12 * 36e5);
      if (!isNaN(d)) return { m: d.getMonth(), a: d.getFullYear() };
    }
    const t = String(l[0] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    let r;
    if ((r = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(t))) return +r[2] >= 1 && +r[2] <= 12 ? { m: +r[2] - 1, a: +r[1] } : null;        // 2026-03
    if ((r = /^(?:\d{1,2}\/)?(\d{1,2})\/(\d{4})$/.exec(t))) return +r[1] >= 1 && +r[1] <= 12 ? { m: +r[1] - 1, a: +r[2] } : null;     // 03/2026 ou 15/03/2026
    if ((r = /^([a-z]+)\.?(?:\s*(?:de|\/|-)?\s*(\d{2}|\d{4}))?$/.exec(t)) && r[1] in NOMES_MES) return { m: NOMES_MES[r[1]], a: r[2] ? (+r[2] < 100 ? 2000 + +r[2] : +r[2]) : null };   // mar, março, mar/26
    return null;
  }
  // Mês abreviado no eixo (opção "mesAbrev" do gráfico): só vale se CADA barra for um mês diferente (data do Sheets, "mar/26", "03/2026" ou "dd/mm" sem ano,
  // em que o mês é a 2ª parte). O nome vem do idioma do navegador (Intl), com inicial maiúscula e sem ponto. Devolve { rot, dicas } ou null (aí o eixo fica como está).
  let fmtMes = null;
  function nomeMesAbrev(m) {
    if (!fmtMes) {
      const lang = navigator.language || document.documentElement.lang || undefined;
      try { fmtMes = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }); } catch { fmtMes = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }); }
    }
    const t = fmtMes.format(new Date(Date.UTC(2021, m, 15))).replace(/\./g, '').trim();
    return t.charAt(0).toLocaleUpperCase() + t.slice(1);
  }
  function rotulosMeses(linhas) {
    const ddmm = l => {                                                    // "dd/mm" sem ano: o mês é a 2ª parte
      const r = /^(\d{1,2})\/(\d{1,2})$/.exec(String(l[0] || '').trim());
      return r && +r[1] >= 1 && +r[1] <= 31 && +r[2] >= 1 && +r[2] <= 12 ? { m: +r[2] - 1, a: null } : null;
    };
    const ks = linhas.map(l => { const r = mesDeLinha(l) || ddmm(l); return r ? (r.a != null ? r.a : 0) * 12 + r.m : null; });
    if (ks.length < 2 || ks.some(k => k == null) || new Set(ks).size !== ks.length) return null;
    const rot = ks.map(k => nomeMesAbrev(k % 12));
    return { rot, dicas: rot.map((r, i) => r + (linhas[i][0] && linhas[i][0] !== r ? ' · ' + linhas[i][0] : '')) };
  }
  // compromissos pendentes por linha (lista de { dia, nome, nivel } ou null); null = este gráfico não mostra compromissos
  function compromissosPorLinha(g, linhas) {
    if (g.tipo !== 'barras' || g.compromissos === 'nao') return null;
    const aCfg = Number(g.anoMeses), ano = aCfg >= 1900 && aCfg <= 2200 ? aCfg : new Date().getFullYear();
    const ks = linhas.map(l => { const r = mesDeLinha(l); return r ? (r.a != null ? r.a : ano) * 12 + r.m : null; });
    const ok = ks.filter(k => k != null);
    // automático: só liga se (quase) todas as barras são meses, sem repetir; ligado à força: serve a qualquer gráfico com meses nos rótulos
    if (!ok.length || (g.compromissos !== 'sim' && (ok.length < 2 || ok.length < linhas.length * 0.6 || new Set(ok).size !== ok.length))) return null;
    const itens = ctx.consultar('agenda-itens').filter(x => !x.feita);
    if (!itens.length) return null;
    const cfgAg = ctx.consultar('agenda-config')[0] || {}, verm = cfgAg.vermelho != null ? +cfgAg.vermelho : 7, amar = cfgAg.amarelo != null ? +cfgAg.amarelo : 30;
    const hj = new Date(), h0 = Date.UTC(hj.getFullYear(), hj.getMonth(), hj.getDate()), por = new Map();
    itens.slice().sort((x, y) => Date.UTC(...x.t) - Date.UTC(...y.t) || String(x.hora).localeCompare(String(y.hora))).forEach(x => {
      const dias = Math.round((Date.UTC(...x.t) - h0) / 864e5), k = x.t[0] * 12 + x.t[1];
      if (!por.has(k)) por.set(k, []);
      por.get(k).push({ dia: p2(x.t[2]) + '/' + p2(x.t[1] + 1), nome: x.desc, nivel: dias < 0 ? 0 : dias <= verm ? 1 : dias <= amar ? 2 : 3 });
    });
    const visto = new Set();
    const lista = ks.map(k => { if (k == null || visto.has(k)) return null; visto.add(k); return por.get(k) || null; });
    return lista.some(Boolean) ? lista : null;
  }
  const h = Util.h;
  // Hora ou duração vira horas (número); número puro segue a opção "formato dos tempos" das Configurações da planilha (cfg.planilha)
  function emHoras(valor, formato, exibido) {
    if (exibido === '' || exibido == null) return null;
    const t = String(exibido).trim(), f = formato || '';
    const m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?/);                 // 12:30 ou 12:30:00 (hora, duração ou texto)
    if (m && (/[hH\[]/.test(f) || typeof valor !== 'number')) return Number(m[1]) + Number(m[2]) / 60 + (Number(m[3]) || 0) / 3600;
    const u = /^\[(h+|m+|s+)\]/i.exec(f);                                  // duração só em horas, minutos ou segundos: [h], [m], [s]
    if (u && /^-?\d+([.,]\d+)?$/.test(t)) { const n = Number(t.replace(',', '.')), k = u[1][0].toLowerCase(); return k === 'h' ? n : k === 'm' ? n / 60 : n / 3600; }
    if (typeof valor === 'number') return cfg.planilha.formatoTempo === 'min' ? valor / 60 : valor * 24;
    return null;
  }
  const sv = (tag, attrs, txt) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; };

  const horaTxt = x => { const m = Math.round(x * 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
  const passo = max => { for (const p of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]) if (max / p <= 5) return p; return 10000; };

  const passoN = max => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find(p => max / p <= 5) || 2000;

  /* ---------- desenho do gráfico (SVG feito à mão, sem bibliotecas) ---------- */
  function desenharSvg(plot, tipo, rot, series, tip, unid = 'h', dicas, marcas, hoje, frente, cmps, cmpsMax = 5) {
    const velho = plot.querySelector('svg'); if (velho) velho.remove();
    tip.hidden = true;
    const W = Math.max(260, plot.clientWidth), ML = 46, MR = 10, MB = 30;
    let H = 240, MT = 12;                                       // H e MT crescem só se as bolinhas dos compromissos precisarem de espaço em cima
    const pw = W - ML - MR, ph = H - MT - MB, n = rot.length;   // ph não muda (a faixa extra fica acima do gráfico)
    const vis = series.filter(s => !s.oculta);
    const max = Math.max(unid === 'n' ? 1 : 0.5, ...vis.flatMap(s => s.valores));
    const st = unid === 'n' ? passoN(max) : passo(max), topo = Math.ceil(max / st - 1e-9) * st;
    const gw = pw / n;
    // bolinhas dos compromissos (só barras): numa FAIXA no topo, acima da área das barras; em cada mês ficam centralizadas na coluna (no mesmo x do rótulo)
    // e empilhadas de CIMA PARA BAIXO (a 1ª no topo); o "+N" vem depois da última. A faixa cresce o quanto precisar (nunca cobre as barras)
    const rb = Math.max(2.5, Math.min(4.5, gw / 2 - 1.5)), passoB = 2 * rb + 2;
    const mostradas = l => Math.min(l.length, cmpsMax);
    const alturaB = l => 4 + mostradas(l) * passoB + (l.length > cmpsMax ? 11 : 0);
    const bol = tipo === 'barras' && cmps && cmps.some(Boolean) ? cmps : null;
    if (bol) {
      const faixa = Math.max(0, ...bol.map(l => l ? alturaB(l) : 0)), extra = Math.max(0, Math.ceil(faixa + 6) - MT);
      MT += extra; H += extra;
    }
    const y = v => MT + ph - (v / topo) * ph;
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
      // ordem de desenho: período anterior (fundo), depois as demais, e por último a série escolhida em "frente"
      const camada = s => s.fundo ? 0 : s.chave === frente ? 2 : 1;
      vis.slice().sort((x, y2) => camada(x) - camada(y2)).forEach(s => {
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

    if (bol) bol.forEach((l, i) => {
      if (!l) return;
      const cx = ML + gw * (i + .5), ns = mostradas(l);
      for (let k = 0; k < ns; k++)
        svg.append(sv('circle', { cx, cy: 4 + rb + k * passoB, r: rb, fill: COR_PRAZO[l[k].nivel], stroke: 'var(--ink)', 'stroke-opacity': 0.45, 'stroke-width': 1, 'data-c': i, 'data-k': k }));
      if (l.length > ns) svg.append(sv('text', { x: cx, y: 4 + ns * passoB + 7, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: 'var(--soft)', 'data-c': i }, '+' + (l.length - ns)));
    });

    function mostrar(ev) {
      const r = svg.getBoundingClientRect(), esc = W / r.width;
      const i = Math.floor(((ev.clientX - r.left) * esc - ML) / gw);
      if (i < 0 || i >= n) { esconder(); return -1; }
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
      if (bol && bol[i]) {                                           // compromissos do mês: dd/mm e nome; o da bolinha sob o dedo/mouse fica em negrito
        const sel = ev.target && ev.target.getAttribute ? Number(ev.target.getAttribute('data-k')) : NaN, t3 = h('b', null, 'Compromissos'); t3.style.marginTop = '.3rem'; tip.append(t3);
        bol[i].slice(0, 12).forEach((c, k) => {
          const l = h('div', 'gf-tip-l'), p = h('i'); p.style.background = COR_PRAZO[c.nivel]; p.style.boxShadow = 'inset 0 0 0 1px rgba(128,128,128,.7)';
          const tx = h('span', null, c.dia + ' · ' + c.nome); if (k === sel) tx.style.fontWeight = '700';
          l.append(p, tx); tip.append(l);
        });
        if (bol[i].length > 12) tip.append(h('div', 'gf-tip-l', '+' + (bol[i].length - 12) + ' outros'));
      }
      tip.hidden = false;
      const cx = (ML + gw * (i + .5)) / esc;
      tip.style.left = Math.max(0, Math.min(cx + 12, plot.clientWidth - tip.offsetWidth)) + 'px';
      return i;
    }
    // toque: soltar o dedo esconderia a dica na hora; num mês com compromissos ela fica uns segundos (ou até tocar fora do gráfico)
    let fixo = false, tempo = 0;
    const largar = () => { fixo = false; clearTimeout(tempo); document.removeEventListener('pointerdown', fora, true); esconder(); };
    const fora = ev => { if (!svg.contains(ev.target)) largar(); };
    function esconder() { marca.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', ev => {
      const i = mostrar(ev);
      clearTimeout(tempo); document.removeEventListener('pointerdown', fora, true); fixo = false;
      if (ev.pointerType !== 'mouse' && i >= 0 && bol && bol[i]) { fixo = true; tempo = setTimeout(largar, 6000); document.addEventListener('pointerdown', fora, true); }
    });
    svg.addEventListener('pointerleave', () => { if (!fixo) esconder(); });
    plot.prepend(svg);
  }

  /* ---------- cartão de um gráfico ---------- */
  function cartao(g) {
    const card = h('div', 'gf-card');
    const topo = h('div', 'gf-topo'), sub = h('span', 'gf-sub');
    card.dataset.id = g.id; if (g.id === editandoId) card.classList.add('editando');
    const alca = h('span', 'gf-alca', '⋮⋮'); alca.title = 'Arraste para mudar a ordem';
    const tit = h('h3', null, g.titulo || 'Gráfico'); tit.title = 'Clique para editar'; tit.onclick = () => editar(g);
    const ed = h('button', 'gf-editar', '✎'); ed.type = 'button'; ed.title = 'Editar este gráfico'; ed.setAttribute('aria-label', 'Editar o gráfico ' + (g.titulo || '')); ed.onclick = () => editar(g);
    topo.append(alca, tit, ed, sub);
    const leg = h('div', 'gf-leg'), plot = h('div', 'gf-plot'), tip = h('div', 'gf-tip'), msg = h('p', 'gf-msg');
    tip.hidden = true; plot.append(tip);
    card.append(topo, leg, plot, msg);
    const ocultas = new Set();
    let ultimo = null, larg = 0;

    const aviso = (t, erro) => { msg.textContent = t; msg.className = 'gf-msg' + (erro ? ' erro' : ''); msg.hidden = !t; };
    const pintar = () => { if (ultimo && plot.clientWidth > 0) { larg = plot.clientWidth; desenharSvg(plot, g.tipo, ultimo.rot, ultimo.series, tip, ultimo.unid, ultimo.dicas, ultimo.marcas, ultimo.hoje, ultimo.frente, ultimo.cmps, ultimo.cmpsMax); } };

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
      let rot = linhas.map(l => (g.diaSemana && diaSem(l)) || l[0] || '');
      let dicas = g.diaSemana ? linhas.map((l, i) => rot[i] + (l[0] && l[0] !== rot[i] ? ' · ' + l[0] : '')) : null;
      const meses = g.mesAbrev && g.tipo === 'barras' ? rotulosMeses(linhas) : null;
      if (meses) { rot = meses.rot; dicas = meses.dicas; }
      const liq = linhas.map(l => l[1] || 0), per = linhas.map(l => l[2] || 0);
      const ant = d.ant && d.ant.length ? d.ant.map(l => l[1] || 0) : null;
      const series = [{ nome: 'Tempo líquido', chave: 'liq', cor: CORES.liq, valores: liq, oculta: ocultas.has('liq') }];
      const temPer = d.tres === undefined ? per.some(x => x > 0) : d.tres;      // intervalo com 3 colunas = mostra o perdido, mesmo que seja zero
      if (temPer) series.push({ nome: 'Perdido', chave: 'per', cor: CORES.per, valores: per, oculta: ocultas.has('per') });
      if (ant) series.push({ nome: 'Anterior', chave: 'ant', cor: CORES.liq, fundo: true, valores: ant, oculta: ocultas.has('ant') });
      const marcas = g.imp ? linhas.map(l => { const d = dataLinha(l), n = d ? impDoDia(d) : []; return n.length ? n : null; }) : null;
      const hj = new Date(), hoje = linhas.findIndex(l => { const d = dataLinha(l); return d && d.getFullYear() === hj.getFullYear() && d.getMonth() === hj.getMonth() && d.getDate() === hj.getDate(); });
      const cmps = compromissosPorLinha(g, linhas), cmpsMax = Math.min(10, Math.max(1, Number(g.compromissosMax) || 5));
      ultimo = { rot, series, dicas, marcas, hoje: hoje >= 0 ? hoje : null, frente: g.frente || 'liq', cmps, cmpsMax };
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
      if (cmps) { const lg = h('span', 'gf-leg-imp gf-leg-cmp'); lg.append(h('b'), document.createTextNode('Compromissos')); leg.append(lg); }
      pintar();
    }
    const ro = new ResizeObserver(() => requestAnimationFrame(() => { if (plot.clientWidth !== larg) pintar(); }));   // no próximo quadro: evita o aviso "ResizeObserver loop"
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
        <button type="button" class="mini gf-nova" title="Adicionar um gráfico">+ Gráfico</button>
        <button type="button" class="mini gf-atualizar" title="Atualizar gráficos" aria-label="Atualizar gráficos">↻</button>
        <button type="button" class="mini gf-engrenagem" title="Escolher os gráficos" aria-label="Configurar os gráficos" aria-expanded="false">⚙</button></div>
    </div>
    <p class="status-linha gf-status" role="status"></p>
    <div class="gf-grade"></div>`;
  const q = x => raiz.querySelector(x), grade = q('.gf-grade');
  q('.gf-titulo').textContent = ctx.def().titulo || 'Gráficos de estudo';
  const visivel = () => ctx.visivel();

  function renderizar(c) {
    (c._cards || []).forEach(x => x.desligar());
    c._cards = graficos.filter(g => g.ativo).map(cartao);
    c.replaceChildren(...c._cards);
    if (!c._cards.length) { const p = h('p', 'gf-msg', 'Nenhum gráfico ativo. Use "+ Gráfico".'); c.append(p); }
    c._cards.forEach(x => x.atualizar());
  }
  document.addEventListener('agenda-atualizada', () => renderizarTudo());   // a agenda chegou ou mudou: remarca os dias
  function renderizarTudo() { if (visivel()) renderizar(grade); rodape(); }

  function rodape() {
    const t = Util.textoAtualizado(estado);
    raiz.querySelectorAll('.gf-status').forEach(e => { e.textContent = t; });
  }

  async function carregar(forcar) {
    if (!Sheets.pronto()) { renderizarTudo(); return; }
    const ativos = graficos.filter(g => g.ativo && g.intervalo);
    if (!ativos.length || estado.carregando) return;
    const velho = Date.now() - estado.em > TTL || ativos.some(g => !estado.dados[g.id] || estado.dados[g.id].sig !== sig(g));
    if (!forcar && !velho) { rodape(); return; }
    estado.carregando = true; estado.erro = ''; renderizarTudo();
    try {
      Util.exigirInternet();
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

  raiz.querySelectorAll('.gf-atualizar').forEach(b => b.onclick = () => carregar(true));
  let diaVisto = new Date().toDateString();
  setInterval(() => { rodape(); const d = new Date().toDateString(); if (d !== diaVisto) { diaVisto = d; if (visivel()) renderizarTudo(); } }, 30000);   // virou o dia: as cores dos prazos mudam

  // avisos de fora (ver Util.avisar): o tema mudou / uma sessão foi gravada na planilha
  document.addEventListener('tema-mudou', () => { if (visivel()) renderizarTudo(); });
  document.addEventListener('sessao-enviada', () => { estado.em = 0; LS.set(CACHE, { em: 0, dados: estado.dados }); if (visivel()) carregar(true); });

  /* ---------- editar, adicionar e ordenar: painel padrão ao lado (vale na hora) e arrastar pela alça ---------- */
  const guardar = () => { persistir(); renderizarTudo(); if (visivel()) carregar(); };
  const marcarEditando = () => grade.querySelectorAll('.gf-card').forEach(c => c.classList.toggle('editando', c.dataset.id === editandoId));
  const nTipo = v => v.tipo !== 'histograma';
  const CAMPOS_G = [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'selecao', recarrega: true, opcoes: [['barras', 'Barras'], ['linhas', 'Linhas'], ['histograma', 'Histograma (horário de início)']] },
    { chave: 'aba', rotulo: 'Aba da planilha', tipo: 'aba' },
    { chave: 'intervalo', rotulo: 'Células', tipo: 'intervalo', dica: 'Rótulo (data), tempo líquido e perdido. Intervalos abertos como I3:K pegam até a última linha. No histograma: a coluna Início.' },
    { chave: 'anterior', rotulo: 'Período anterior (opcional)', tipo: 'intervalo', opcional: true, mostrarSe: nTipo, dica: 'Mesmo formato; aparece apagado atrás. Ex.: Q26:S33' },
    { chave: 'diaSemana', rotulo: 'Mostrar o dia da semana (Seg, Ter…) no eixo', tipo: 'caixa', mostrarSe: nTipo, dica: 'A primeira coluna precisa ser uma data.' },
    { chave: 'imp', rotulo: 'Marcar os dias com itens "Imp" da agenda', tipo: 'caixa', mostrarSe: nTipo },
    { chave: 'mesAbrev', rotulo: 'Mostrar o mês abreviado (Jan, Fev…) no eixo', tipo: 'caixa', mostrarSe: v => v.tipo === 'barras', dica: 'Só vale quando cada barra é um mês. O idioma segue o do navegador.' },
    { chave: 'compromissos', rotulo: 'Compromissos da agenda nos meses', tipo: 'selecao', recarrega: true, mostrarSe: v => v.tipo === 'barras', opcoes: [['auto', 'Automático (se as barras forem meses)'], ['sim', 'Ligado'], ['nao', 'Desligado']], dica: 'Bolinhas sobre a barra do mês, na cor do prazo da Agenda (só os pendentes). Passe o mouse ou toque no mês para ver os nomes.' },
    { chave: 'compromissosMax', rotulo: 'Bolinhas por mês (no máximo)', tipo: 'numero', min: 1, max: 10, mostrarSe: v => v.tipo === 'barras' && v.compromissos !== 'nao', dica: 'O resto aparece como +N; a dica lista todos.' },
    { chave: 'anoMeses', rotulo: 'Ano dos meses (se o rótulo só tiver o mês)', tipo: 'numero', min: 0, mostrarSe: v => v.tipo === 'barras' && v.compromissos !== 'nao', dica: 'Deixe 0 para usar o ano de hoje. Se o rótulo ou a data da célula já trazem o ano, ele vale.' },
    { chave: 'frente', rotulo: 'Linha na frente', tipo: 'selecao', mostrarSe: v => v.tipo === 'linhas', opcoes: [['liq', 'Tempo líquido'], ['per', 'Perdido']], dica: 'Qual linha fica por cima quando as duas se cruzam.' },
    { chave: 'passo', rotulo: 'Faixa do histograma', tipo: 'selecao', numero: true, mostrarSe: v => v.tipo === 'histograma', opcoes: [[60, '1 hora'], [30, '30 minutos']] },
    { chave: 'ativo', rotulo: 'Mostrar este gráfico', tipo: 'caixa' }
  ];
  function editar(g) {
    editandoId = g.id; marcarEditando();
    Painel.abrir({
      id: 'g:' + g.id, titulo: g.titulo || 'Gráfico', subtitulo: 'Gráfico · as mudanças valem na hora', campos: CAMPOS_G, valores: () => Object.assign({ passo: 60, frente: 'liq', compromissos: 'auto', compromissosMax: 5, anoMeses: 0 }, g),
      aoMudar(chave, valor) {
        g[chave] = valor;
        if (chave === 'tipo' && valor === 'histograma') { g.aba = cfg.planilha.aba; g.intervalo = intervaloInicio(); g.passo = g.passo || 60; }
        if (chave === 'titulo') {                                       // só o título: troca o texto sem redesenhar
          persistir(); Painel.titulo(valor || 'Gráfico');
          grade.querySelectorAll('.gf-card').forEach(c => { if (c.dataset.id === g.id) c.querySelector('h3').textContent = valor || 'Gráfico'; });
          return;
        }
        guardar(); if (chave === 'tipo') Painel.atualizar();
      },
      botoes: [{ rotulo: 'Excluir este gráfico', perigo: true, acao: () => {
        if (!confirm('Excluir o gráfico “' + (g.titulo || 'sem título') + '”?')) return;
        graficos.splice(graficos.indexOf(g), 1); Painel.fechar(); guardar();
      } }],
      aoFechar: () => { if (editandoId === g.id) { editandoId = null; marcarEditando(); } }
    });
  }
  const novo = () => {
    const g = { id: 'g' + Date.now().toString(36), titulo: 'Novo gráfico', tipo: 'barras', aba: cfg.planilha.aba, intervalo: 'I3:K', ativo: true };
    graficos.push(g); persistir(); renderizarTudo(); editar(g);
  };
  const restaurar = () => {
    if (!confirm('Voltar à lista padrão de gráficos? Os que você criou ou mudou serão perdidos.')) return;
    Painel.fechar(); graficos.splice(0, graficos.length, ...JSON.parse(JSON.stringify(GRAF_PADRAO))); guardar();
  };
  q('.gf-nova').onclick = novo;
  q('.gf-engrenagem').onclick = () => Painel.abrir({
    id: 'cfg:' + ctx.id, titulo: ctx.def().titulo || 'Gráficos de estudo', subtitulo: 'Quadro de gráficos · as mudanças valem na hora', alvo: raiz,
    campos: [{ chave: 'titulo', rotulo: 'Título do quadro', tipo: 'texto' }], valores: () => ({ titulo: ctx.def().titulo || 'Gráficos de estudo' }),
    aoMudar(chave, valor) { ctx.ajustar({ titulo: valor }); q('.gf-titulo').textContent = valor; Painel.titulo(valor); },
    botoes: [{ rotulo: '+ Adicionar gráfico', acao: novo }, { rotulo: 'Restaurar lista padrão', perigo: true, acao: restaurar }]
  });

  // arrastar pela alça (⋮⋮) para mudar a ordem; vale com mouse e com toque
  let arr = null;
  grade.addEventListener('pointerdown', ev => {
    const alca = ev.target.closest('.gf-alca'); if (!alca || ev.button > 0) return;
    arr = { card: alca.closest('.gf-card'), pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, on: false };
    ev.preventDefault();
  });
  window.addEventListener('pointermove', ev => {
    if (!arr || ev.pointerId !== arr.pid) return;
    if (!arr.on) { if (Math.hypot(ev.clientX - arr.x0, ev.clientY - arr.y0) < 5) return; arr.on = true; arr.card.classList.add('arrastando'); document.body.classList.add('arrastando-gf'); }
    if (ev.clientY < 70) scrollBy(0, -12); else if (ev.clientY > innerHeight - 70) scrollBy(0, 12);
    const alvo = document.elementFromPoint(ev.clientX, ev.clientY);
    const c = alvo && alvo.closest('.gf-card');
    if (!c || c === arr.card || c.parentNode !== grade) return;
    const fs = [...grade.children];
    if (fs.indexOf(arr.card) < fs.indexOf(c)) c.after(arr.card); else c.before(arr.card);   // o cartão vai trocando de lugar enquanto você arrasta
  });
  const soltar = ev => {
    if (!arr || ev.pointerId !== arr.pid) return;
    const fim = arr; arr = null; document.body.classList.remove('arrastando-gf'); fim.card.classList.remove('arrastando');
    if (!fim.on) return;
    const ordem = [...grade.children].map(c => c.dataset.id).filter(Boolean), novos = ordem.map(id => graficos.find(g => g.id === id));
    let k = 0; graficos.forEach((g, i) => { if (ordem.includes(g.id)) graficos[i] = novos[k++]; });     // os desligados ficam onde estavam
    persistir(); renderizarTudo();
  };
  window.addEventListener('pointerup', soltar); window.addEventListener('pointercancel', soltar);

  return {
    raiz,
    iniciar() {
      renderizarTudo(); carregar();
      // "no nível": o quadro fica nítido quando o topo dele passa de ~55% da altura da tela
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => raiz.classList.toggle('em-foco', en.isIntersecting), { rootMargin: '0px 0px -45% 0px' }).observe(raiz);
      else raiz.classList.add('em-foco');
    },
    aparecer() { renderizarTudo(); carregar(); }
  };
});