/* Editor de grade: a parte VISUAL do modo "Editar layout" (js/core/editor-layout.js), sobre a grade livre do Roteador.
   Só vale em tela larga (>= 72rem). Em tela estreita cada layout é uma coluna só e o editor continua arrastando pela ordem.
   Ligado, cada layout da página mostra:
     - as CÉLULAS livres (tracejadas, "livre") e as ocupadas (sem desenho: o bloco já está lá);
     - DIVISÓRIAS entre as colunas e entre as linhas: arraste para mudar a largura da coluna ou a altura da linha (uma dica mostra os px);
     - uma etiqueta embaixo de cada coluna (a largura) e à esquerda de cada linha (o número); "×" aparece só se a coluna/linha está vazia;
     - botões "+" para acrescentar uma coluna (à direita) e uma linha (embaixo); limites: 12 colunas e 24 linhas;
     - em cada bloco, 3 ALÇAS (direita, embaixo e canto) para ele ocupar mais colunas e/ou linhas; uma marca mostra onde vai ficar.
   Arrastar um bloco pela alça de cima (feito pelo editor-layout.js, que chama comecarArrasto / sobre / soltarArrasto / cancelarArrasto):
     - célula livre: o bloco vai para lá;  célula ocupada: os dois blocos TROCAM de lugar (se couberem);  não cabe: marca vermelha, nada muda.
   Layout antigo (tipo/pilha/coluna1) é CONVERTIDO em grade livre na 1ª edição feita nele (colunas, linhas, col, lin, ocupa, ocupaLin);
   o que já estava guardado (tipo, pilha, coluna1...) não é apagado. Antes disso nada é gravado: as células vêm de Roteador.modelo.
   Ordem das telas estreitas ("ordem"): ao MOVER ou TROCAR blocos ela é reescrita em leitura linha a linha (de cima para baixo, da esquerda para a direita).
   Nas outras edições (largura, altura, alças, + e ×) ela não muda.
   Linhas vazias, enquanto se edita, ganham altura mínima de 5rem para dar para soltar blocos nelas (só na tela de edição).
   Como usar: o editor-layout.js chama  EditorGrade.ligar(info, depois)  /  desligar()  /  atualizar()  /  larga().
   O painel de layouts (js/core/painel-layout.js) usa, enquanto o modo está ligado e a tela é larga:
     EditorGrade.dados(idDoLayout)                      a grade de agora: { livre, colunas, linhas, blocos, px: { c, l }, larguraPx } (ou null)
     EditorGrade.tamanho(idDoLayout, nCol, nLin)        muda quantas colunas e linhas; só tira as VAZIAS do fim. Devolve { ok, msg }
     EditorGrade.estrutura(idDoLayout, colunas)         troca TODAS as colunas por uma lista pronta (ex.: [1, 2]); só tira colunas VAZIAS. Devolve { ok, msg }
     EditorGrade.tamanhoBloco(idDoLayout, idBloco, w, h) muda quantas colunas/linhas o bloco ocupa (nunca encosta em outro). Devolve { ok, msg }
     EditorGrade.previa(idDoLayout, 'c' | 'l', lista)    mostra ao vivo uma lista nova de colunas ou linhas, sem guardar
     EditorGrade.definir(idDoLayout, 'c' | 'l', lista)   guarda a lista nova de colunas ou linhas (layout antigo vira grade livre)
   Carregue depois de roteador.js e containers.js, e antes de editor-layout.js. Estilo: css/layout.css (classes el-grade, el-celula, el-divisor, el-tag, el-mais, el-redim). */
const EditorGrade = (() => {
  const h = Util.h;
  const MAX_COL = 12, MAX_LIN = 24;   // os mesmos limites do Roteador
  const MIN_PX = 48;                  // menor largura/altura que uma divisória deixa
  const MIN_VAZIA = '5rem';           // altura das linhas vazias enquanto se edita
  const larga = () => matchMedia('(min-width: 72rem)').matches;
  let st = null;                      // { info, depois, ro, obs, mq, raf, mexeu }
  let drag = null;                    // divisória ou alça em andamento
  let arr = null;                     // arrastar de bloco em andamento (comandado pelo editor-layout.js)
  let marcas = [];                    // retângulos que mostram onde o bloco vai ficar

  /* ---------- medidas (tudo lido do que o navegador desenhou) ---------- */
  const nums = s => (s || '').split(' ').map(parseFloat).filter(Number.isFinite);
  function medir(area) {
    const cs = getComputedStyle(area), r = area.getBoundingClientRect();
    const gc = parseFloat(cs.columnGap) || 0, gl = parseFloat(cs.rowGap) || 0;
    const xs = [], ys = [];
    let x = r.left; nums(cs.gridTemplateColumns).forEach(w => { xs.push([x, x + w]); x += w + gc; });
    let y = r.top; nums(cs.gridTemplateRows).forEach(a => { ys.push([y, y + a]); y += a + gl; });
    if (!xs.length) xs.push([r.left, r.right]);
    if (!ys.length) ys.push([r.top, r.bottom]);
    return { r, xs, ys };
  }
  // índice da faixa [início, fim] onde cai o ponto v (no vão entre duas faixas vale a mais próxima)
  const indice = (v, f) => { for (let i = 0; i < f.length - 1; i++) if (v < (f[i][1] + f[i + 1][0]) / 2) return i; return f.length - 1; };
  const tam = el => { const r = el.getBoundingClientRect(); return r.width.toFixed(1) + 'x' + r.height.toFixed(1); };
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- o modelo da grade, com todas as posições preenchidas ---------- */
  const clonar = m => ({ livre: m.livre, colunas: m.colunas.slice(), linhas: m.linhas.slice(), blocos: m.blocos.map(b => Object.assign({}, b)) });
  const nLin = m => Math.max(m.linhas.length, 1);
  const areasDe = () => [...st.info.destino.querySelectorAll(':scope > .ct-area')];
  const itemDe = id => st.info.itens.find(it => it.id === id);
  const areaDe = lid => areasDe().find(a => a.dataset.layout === lid) || null;

  // Roteador.modelo + posição dos blocos sem col/lin (entram sozinhos no 1º espaço livre): vem de onde o navegador os desenhou
  function modeloReal(area) {
    const m = Roteador.modelo(st.info.id, area.dataset.layout);
    if (!m) return null;
    const g = medir(area), nC = Math.max(m.colunas.length, 1);
    const blocos = m.blocos.map(b => {
      const rc = itemDe(b.id).raiz.getBoundingClientRect();
      const col = Math.min(nC, b.col || indice(rc.left + 2, g.xs) + 1), lin = b.lin || indice(rc.top + 2, g.ys) + 1;
      return { id: b.id, col, lin, ocupa: Math.max(1, Math.min(b.ocupa, nC - col + 1)), ocupaLin: b.ocupaLin };
    });
    const total = Math.max(m.linhas.length, 1, ...blocos.map(b => b.lin + b.ocupaLin - 1)), linhas = m.linhas.slice();
    while (linhas.length < total) linhas.push('auto');
    return { livre: m.livre, colunas: m.colunas.slice(), linhas, blocos };
  }

  function mapa(m, ignorar) {     // quem está em cada célula: [linha][coluna] = id | null
    const nC = m.colunas.length, g = Array.from({ length: nLin(m) }, () => Array(nC).fill(null));
    m.blocos.forEach(b => {
      if (ignorar && ignorar.includes(b.id)) return;
      for (let r = b.lin; r < b.lin + b.ocupaLin; r++) for (let c = b.col; c < b.col + b.ocupa; c++) if (g[r - 1] && c <= nC) g[r - 1][c - 1] = b.id;
    });
    return g;
  }
  function colide(g, col, lin, w, hh) {
    const ids = new Set(); let fora = false;
    for (let r = lin; r < lin + hh; r++) for (let c = col; c < col + w; c++) {
      if (!g[r - 1] || c < 1 || c > g[0].length) fora = true; else if (g[r - 1][c - 1]) ids.add(g[r - 1][c - 1]);
    }
    return { fora, ids: [...ids] };
  }
  const colunaVazia = (m, c) => !m.blocos.some(b => c >= b.col && c < b.col + b.ocupa);     // c = 1...
  const linhaVazia = (m, r) => !m.blocos.some(b => r >= b.lin && r < b.lin + b.ocupaLin);

  // mover (célula livre) ou trocar de lugar (célula ocupada por um bloco só); devolve { ok, modelo, marcas }
  function tentarMover(m, id, col, lin) {
    const b = m.blocos.find(x => x.id === id), nC = m.colunas.length, nL = nLin(m);
    col = limitar(col, 1, nC - b.ocupa + 1); lin = limitar(lin, 1, nL - b.ocupaLin + 1);
    const alvo = { col, lin, ocupa: b.ocupa, ocupaLin: b.ocupaLin };
    if (col === b.col && lin === b.lin) return { ok: false, marcas: [Object.assign({ ok: true }, alvo)] };
    const c = colide(mapa(m, [id]), col, lin, b.ocupa, b.ocupaLin), novo = clonar(m), nb = novo.blocos.find(x => x.id === id);
    if (!c.fora && !c.ids.length) { nb.col = col; nb.lin = lin; return { ok: true, modelo: novo, marcas: [Object.assign({ ok: true }, alvo)] }; }
    if (!c.fora && c.ids.length === 1) {                                  // troca: cada um vai para o canto do outro
      const t = m.blocos.find(x => x.id === c.ids[0]), nt = novo.blocos.find(x => x.id === t.id), g3 = mapa(m, [id, t.id]);
      const bc = Math.min(t.col, nC - b.ocupa + 1), bl = Math.min(t.lin, nL - b.ocupaLin + 1);
      const a = colide(g3, bc, bl, b.ocupa, b.ocupaLin), z = colide(g3, b.col, b.lin, t.ocupa, t.ocupaLin);
      const sobrepoe = bc < b.col + t.ocupa && b.col < bc + b.ocupa && bl < b.lin + t.ocupaLin && b.lin < bl + b.ocupaLin;
      if (!a.fora && !a.ids.length && !z.fora && !z.ids.length && !sobrepoe) {
        nb.col = bc; nb.lin = bl; nt.col = b.col; nt.lin = b.lin;
        return { ok: true, modelo: novo, marcas: [{ ok: true, col: bc, lin: bl, ocupa: b.ocupa, ocupaLin: b.ocupaLin }, { ok: true, col: b.col, lin: b.lin, ocupa: t.ocupa, ocupaLin: t.ocupaLin }] };
      }
    }
    return { ok: false, marcas: [Object.assign({ ok: false }, alvo)] };
  }

  // quantas colunas/linhas o bloco ocupa: o maior tamanho que cabe sem encostar em outro bloco (modo: 'd' direita, 'b' embaixo, 'c' canto)
  function tentarRedim(m, id, w, hh, modo) {
    const b = m.blocos.find(x => x.id === id), nC = m.colunas.length, nL = nLin(m);
    w = modo === 'b' ? b.ocupa : limitar(w, 1, nC - b.col + 1); hh = modo === 'd' ? b.ocupaLin : limitar(hh, 1, nL - b.lin + 1);
    const g = mapa(m, [id]); let melhor = null;
    for (let ww = w; ww >= 1; ww--) for (let h2 = hh; h2 >= 1; h2--) {
      if ((modo === 'd' && h2 !== b.ocupaLin) || (modo === 'b' && ww !== b.ocupa)) continue;
      const c = colide(g, b.col, b.lin, ww, h2);
      if (!c.fora && !c.ids.length && (!melhor || ww * h2 > melhor.ww * melhor.h2)) melhor = { ww, h2 };
    }
    if (!melhor) melhor = { ww: b.ocupa, h2: b.ocupaLin };
    const mudou = melhor.ww !== b.ocupa || melhor.h2 !== b.ocupaLin, novo = clonar(m), nb = novo.blocos.find(x => x.id === id);
    nb.ocupa = melhor.ww; nb.ocupaLin = melhor.h2;
    return { ok: mudou, modelo: novo, marcas: [{ ok: true, col: b.col, lin: b.lin, ocupa: melhor.ww, ocupaLin: melhor.h2 }] };
  }

  /* ---------- tamanhos das trilhas (divisórias) ---------- */
  const tipoTrilha = v => (typeof v === 'number' || /fr$/.test(String(v)) ? 'fr' : /^\d/.test(String(v)) ? 'fixo' : 'auto');
  const frDe = v => (typeof v === 'number' ? v : parseFloat(v));
  function fixoDe(v, pxv, areaW, raiz) {      // escreve o tamanho novo na mesma unidade do antigo (rem, px ou %)
    const s = String(v);
    if (/%$/.test(s)) return +(pxv / areaW * 100).toFixed(1) + '%';
    if (/px$/.test(s)) return Math.round(pxv) + 'px';
    return +(pxv / raiz).toFixed(1) + 'rem';
  }
  // a divisória entre a trilha i e a i+1 foi para: i = a px, i+1 = b px. Devolve a lista nova.
  function ajustarLista(lista, i, a, b, eixo, areaW) {
    const L = lista.slice(), raiz = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const ti = tipoTrilha(L[i]), tj = tipoTrilha(L[i + 1]);
    if (ti === 'fr' && tj === 'fr') {         // as duas são "partes do que sobra": reparte a soma na proporção dos px
      const tot = frDe(L[i]) + frDe(L[i + 1]), n = +(tot * a / (a + b)).toFixed(2);
      L[i] = n; L[i + 1] = +(tot - n).toFixed(2); return L;
    }
    if (eixo === 'v') {                       // coluna de tamanho fixo: fica com o tamanho novo; a vizinha "fr" absorve a diferença
      if (ti === 'fixo') { L[i] = fixoDe(L[i], a, areaW, raiz); if (tj === 'fixo') L[i + 1] = fixoDe(L[i + 1], b, areaW, raiz); }
      else if (tj === 'fixo') L[i + 1] = fixoDe(L[i + 1], b, areaW, raiz);
      return L;
    }
    L[i] = fixoDe(ti === 'fixo' ? L[i] : '0rem', a, areaW, raiz);   // linha: a de cima vira altura mínima
    return L;
  }
  const rotuloTrilha = v => (typeof v === 'number' ? +v.toFixed(2) + 'fr' : String(v));

  /* ---------- gravar ---------- */
  // m = a grade nova de uma área. Grava as posições dos blocos (Containers.ajustar) e as colunas/linhas do layout (Roteador.ajustarPagina).
  // reordenar: reescreve "ordem" em leitura linha a linha (só ao mover/trocar blocos).
  function gravar(area, m, reordenar) {
    const pid = st.info.id, lid = area.dataset.layout;
    const ordem = reordenar ? m.blocos.slice().sort((a, b) => a.lin - b.lin || a.col - b.col).map(b => b.id) : null;
    m.blocos.forEach(b => {
      const c = { col: b.col, lin: b.lin, ocupa: b.ocupa, ocupaLin: b.ocupaLin };
      if (ordem) c.ordem = ordem.indexOf(b.id) + 1;
      Containers.ajustar(b.id, c);
    });
    const cur = Roteador.layouts(pid), l = cur.layouts.find(x => x.id === lid);
    if (!l) return;
    l.colunas = m.colunas.slice(); l.linhas = m.linhas.slice();
    Roteador.ajustarPagina(pid, { layouts: cur.layouts });          // guarda (navegador + Sheets) e redesenha
    st.depois();
  }

  /* ---------- o desenho por cima de cada layout ---------- */
  const linhasEd = m => m.linhas.map((v, i) => (v === 'auto' && linhaVazia(m, i + 1) ? MIN_VAZIA : v));
  function aplicarLinhas(area, m) {      // só na grade livre: linhas vazias ganham altura para dar para soltar blocos nelas
    if (!m.livre) return;
    const css = Roteador.cssTrilhas(m.colunas, linhasEd(m));
    if (css.linhas) area.style.setProperty('--ct-linhas', css.linhas);
    st.mexeu = true;
  }

  const limparArea = area => { area.querySelectorAll(':scope > .el-grade').forEach(e => e.remove()); area.classList.remove('el-com-grade'); };

  function construir(area, m) {
    const g = medir(area), cs = getComputedStyle(area), nC = m.colunas.length, nL = nLin(m), ov = h('div', 'el-grade'), p = { v: [], h: [], tc: [], tl: [] };
    ov.setAttribute('aria-hidden', 'true');
    ov.style.columnGap = cs.columnGap; ov.style.rowGap = cs.rowGap;
    ov.style.gridTemplateRows = g.ys.map(([a, b]) => (b - a) + 'px').join(' ');    // as colunas vêm de var(--ct-colunas), herdada da área (css/layout.css)
    const ocup = mapa(m);
    for (let r = 1; r <= nL; r++) for (let c = 1; c <= nC; c++) {
      const cheia = !!ocup[r - 1][c - 1], d = h('div', 'el-celula' + (cheia ? ' cheia' : ''), cheia ? null : 'livre');
      d.style.gridArea = r + ' / ' + c; ov.append(d);
    }
    for (let i = 0; i < nC - 1; i++) { const d = h('div', 'el-divisor v'); d.dataset.i = i; d.title = 'Arraste para mudar a largura da coluna'; d.addEventListener('pointerdown', ev => iniciarDivisor(ev, area, 'v', i)); ov.append(d); p.v.push(d); }
    for (let i = 0; i < nL - 1; i++) { const d = h('div', 'el-divisor h'); d.dataset.i = i; d.title = 'Arraste para mudar a altura da linha'; d.addEventListener('pointerdown', ev => iniciarDivisor(ev, area, 'h', i)); ov.append(d); p.h.push(d); }
    for (let c = 1; c <= nC; c++) {
      const t = h('div', 'el-tag c'), rot = h('span', null, rotuloTrilha(m.colunas[c - 1])); rot.title = 'Largura da coluna ' + c; t.append(rot);
      if (nC > 1 && colunaVazia(m, c)) t.append(botaoTag('×', 'Remover esta coluna (está vazia)', () => remover(area, 'c', c)));
      ov.append(t); p.tc.push(t);
    }
    for (let r = 1; r <= nL; r++) {
      const t = h('div', 'el-tag l');
      if (nL > 1 && linhaVazia(m, r)) t.append(botaoTag('×', 'Remover esta linha (está vazia)', () => remover(area, 'l', r)));
      else { const n = h('span', null, String(r)); n.title = 'Linha ' + r + ' (' + rotuloTrilha(m.linhas[r - 1]) + ')'; t.append(n); }
      ov.append(t); p.tl.push(t);
    }
    if (nC < MAX_COL) { const b = h('button', 'el-mais c', '+'); b.type = 'button'; b.title = 'Acrescentar uma coluna'; b.onclick = () => acrescentar(area, 'c'); ov.append(b); }
    if (nL < MAX_LIN) { const b = h('button', 'el-mais l', '+'); b.type = 'button'; b.title = 'Acrescentar uma linha'; b.onclick = () => acrescentar(area, 'l'); ov.append(b); }
    ov._p = p; area.append(ov); area.classList.add('el-com-grade');
    reposicionar(area);
    area._tam = tam(area);
  }
  function botaoTag(txt, dica, fazer) { const b = h('button', null, txt); b.type = 'button'; b.title = dica; b.onclick = ev => { ev.stopPropagation(); fazer(); }; return b; }

  // põe divisórias e etiquetas no meio das trilhas de agora (também chamado a cada passo de uma divisória)
  function reposicionar(area) {
    const ov = area.querySelector(':scope > .el-grade'); if (!ov || !ov._p) return;
    const g = medir(area), p = ov._p;
    ov.style.gridTemplateRows = g.ys.map(([a, b]) => (b - a) + 'px').join(' ');
    p.v.forEach((e, i) => { if (g.xs[i + 1]) e.style.left = ((g.xs[i][1] + g.xs[i + 1][0]) / 2 - g.r.left - 6) + 'px'; });
    p.h.forEach((e, i) => { if (g.ys[i + 1]) e.style.top = ((g.ys[i][1] + g.ys[i + 1][0]) / 2 - g.r.top - 6) + 'px'; });
    p.tc.forEach((e, i) => { if (g.xs[i]) e.style.left = ((g.xs[i][0] + g.xs[i][1]) / 2 - g.r.left) + 'px'; });
    p.tl.forEach((e, i) => { if (g.ys[i]) e.style.top = ((g.ys[i][0] + g.ys[i][1]) / 2 - g.r.top) + 'px'; });
  }

  // refaz o desenho de todos os layouts (o editor-layout.js chama depois de cada redesenho da página)
  function atualizar() {
    if (!st) return;
    const areas = areasDe();
    areas.forEach(limparArea);
    if (!larga()) return;
    areas.forEach(area => {
      if (area.hidden) return;
      const m = modeloReal(area); if (!m) return;
      aplicarLinhas(area, m);
      construir(area, m);
      if (!st.obs.has(area)) { st.obs.add(area); st.ro.observe(area); }
    });
  }

  /* ---------- + e × ---------- */
  function acrescentar(area, eixo) {
    const m = modeloReal(area); if (!m) return;
    if (eixo === 'c') { if (m.colunas.length >= MAX_COL) return; m.colunas.push(1); }
    else { if (nLin(m) >= MAX_LIN) return; m.linhas.push('auto'); }
    gravar(area, m, false);
  }
  function remover(area, eixo, k) {        // k = 1...; só vazia (nenhum bloco passa por ela)
    const m = modeloReal(area); if (!m) return;
    if (eixo === 'c') {
      if (m.colunas.length < 2 || !colunaVazia(m, k)) return;
      m.colunas.splice(k - 1, 1); m.blocos.forEach(b => { if (b.col > k) b.col--; });
    } else {
      if (nLin(m) < 2 || !linhaVazia(m, k)) return;
      m.linhas.splice(k - 1, 1); m.blocos.forEach(b => { if (b.lin > k) b.lin--; });
    }
    gravar(area, m, false);
  }

  /* ---------- arrastar divisória e alça do bloco ---------- */
  function ouvir(tipos) {
    window.addEventListener('pointermove', tipos.mover); window.addEventListener('pointerup', tipos.soltar); window.addEventListener('pointercancel', cancelarDrag);
    document.addEventListener('keydown', teclar, true); window.addEventListener('blur', cancelarDrag);
  }
  function limparDrag() {
    if (!drag) return;
    window.removeEventListener('pointermove', drag.mover); window.removeEventListener('pointerup', drag.soltar); window.removeEventListener('pointercancel', cancelarDrag);
    document.removeEventListener('keydown', teclar, true); window.removeEventListener('blur', cancelarDrag);
    try { drag.el.releasePointerCapture(drag.id); } catch {}
    if (drag.dica) drag.dica.remove();
    drag.el.classList.remove('ativo'); document.body.classList.remove('el-arrastando'); limparMarcas();
    drag = null;
  }
  function cancelarDrag() { if (!drag) return; limparDrag(); Roteador.reaplicar(); if (st) st.depois(); }   // volta ao que está guardado
  function teclar(ev) { if (drag && ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cancelarDrag(); } }

  function iniciarDivisor(ev, area, eixo, i) {
    if (drag || arr || ev.button > 0 || !larga()) return;
    ev.preventDefault(); ev.stopPropagation();
    const m = modeloReal(area); if (!m) return;
    let el = ev.currentTarget;
    if (!m.livre) {                        // layout antigo: vira grade livre agora (desenha igual), e a divisória nova assume o arrastar
      gravar(area, m, false);
      el = area.querySelector(':scope > .el-grade .el-divisor.' + eixo + '[data-i="' + i + '"]');
      if (!el) return;
    }
    try { el.setPointerCapture(ev.pointerId); } catch {}
    const g = medir(area), f = eixo === 'v' ? g.xs : g.ys;
    el.classList.add('ativo'); document.body.classList.add('el-arrastando');
    const dica = h('div', 'el-dica'); area.querySelector(':scope > .el-grade').append(dica);
    drag = { tipo: 'div', area, el, id: ev.pointerId, eixo, i, m, p0: eixo === 'v' ? ev.clientX : ev.clientY, a0: f[i][1] - f[i][0], b0: f[i + 1][1] - f[i + 1][0], areaW: g.r.width, nova: null, dica,
      mover: moverDivisor, soltar: soltarDivisor };
    ouvir(drag);
  }
  function moverDivisor(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag, total = d.a0 + d.b0, delta = (d.eixo === 'v' ? ev.clientX : ev.clientY) - d.p0;
    const a = total < 2 * MIN_PX ? d.a0 : limitar(d.a0 + delta, MIN_PX, total - MIN_PX), b = total - a;
    d.nova = ajustarLista(d.eixo === 'v' ? d.m.colunas : d.m.linhas, d.i, a, b, d.eixo, d.areaW);
    const mm = Object.assign({}, d.m, d.eixo === 'v' ? { colunas: d.nova } : { linhas: d.nova });
    const css = Roteador.cssTrilhas(mm.colunas, linhasEd(mm));            // ao vivo: só as variáveis da área; grava ao soltar
    d.area.style.setProperty('--ct-colunas', css.colunas);
    if (css.linhas) d.area.style.setProperty('--ct-linhas', css.linhas);
    reposicionar(d.area);
    d.dica.textContent = Math.round(a) + ' px | ' + Math.round(b) + ' px';
    d.dica.style.left = d.eixo === 'v' ? d.el.style.left : '8px';
    d.dica.style.top = d.eixo === 'v' ? '8px' : d.el.style.top;
  }
  function soltarDivisor(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const { area, eixo, nova, m } = drag; limparDrag();
    if (!nova) return;
    const novo = clonar(m); if (eixo === 'v') novo.colunas = nova; else novo.linhas = nova;
    gravar(area, novo, false);
  }

  function iniciarRedim(ev, it, modo) {
    if (drag || arr || ev.button > 0 || !larga()) return;
    ev.preventDefault(); ev.stopPropagation();
    const area = it.raiz.parentNode, m = modeloReal(area); if (!m) return;
    const el = ev.currentTarget;
    try { el.setPointerCapture(ev.pointerId); } catch {}
    el.classList.add('ativo'); document.body.classList.add('el-arrastando');
    drag = { tipo: 'redim', area, el, id: ev.pointerId, bloco: it.id, modo, m, res: null, mover: moverRedim, soltar: soltarRedim };
    ouvir(drag);
  }
  function moverRedim(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag, g = medir(d.area), b = d.m.blocos.find(x => x.id === d.bloco);
    const w = indice(ev.clientX, g.xs) + 1 - b.col + 1, hh = indice(ev.clientY, g.ys) + 1 - b.lin + 1;
    d.res = tentarRedim(d.m, d.bloco, w, hh, d.modo);
    mostrarMarcas(g, d.res.marcas);
  }
  function soltarRedim(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const { area, res } = drag; limparDrag();
    if (res && res.ok) gravar(area, res.modelo, false);
  }

  /* ---------- arrastar um bloco (pela alça de cima; o editor-layout.js comanda) ---------- */
  function rectCelulas(g, col, lin, w, hh) {
    const x0 = g.xs[col - 1], x1 = g.xs[col + w - 2], y0 = g.ys[lin - 1], y1 = g.ys[lin + hh - 2];
    return x0 && x1 && y0 && y1 ? { left: x0[0], top: y0[0], width: x1[1] - x0[0], height: y1[1] - y0[0] } : null;
  }
  function mostrarMarcas(g, lista) {
    while (marcas.length < lista.length) { const e = h('div', 'el-celula-marca'); document.body.append(e); marcas.push(e); }
    marcas.forEach((e, i) => {
      const it = lista[i], r = it && rectCelulas(g, it.col, it.lin, it.ocupa, it.ocupaLin);
      e.hidden = !r; if (!r) return;
      e.style.left = r.left + 'px'; e.style.top = r.top + 'px'; e.style.width = r.width + 'px'; e.style.height = r.height + 'px';
      e.classList.toggle('nao', !it.ok);
    });
  }
  function limparMarcas() { marcas.forEach(e => e.remove()); marcas = []; }

  function comecarArrasto(id, x) {
    arr = null;
    if (!st || !larga()) return;
    const it = itemDe(id), area = it && it.raiz.parentNode, m = area && modeloReal(area), b = m && m.blocos.find(k => k.id === id);
    if (!b) return;
    const g = medir(area);
    arr = { id, area, m, offCol: limitar(indice(x, g.xs) + 1 - b.col, 0, b.ocupa - 1), res: null };   // por qual coluna do bloco você o pegou
  }
  function sobre(x, y) {
    if (!arr) return;
    const g = medir(arr.area);
    arr.res = tentarMover(arr.m, arr.id, indice(x, g.xs) + 1 - arr.offCol, indice(y, g.ys) + 1);
    mostrarMarcas(g, arr.res.marcas);
  }
  const limparSobre = () => { limparMarcas(); if (arr) arr.res = null; };
  function soltarArrasto() { const a = arr; arr = null; limparMarcas(); if (a && a.res && a.res.ok) gravar(a.area, a.res.modelo, true); }
  function cancelarArrasto() { arr = null; limparMarcas(); }

  /* ---------- o que o painel de layouts usa (ver o comentário do topo) ---------- */
  function dados(lid) {
    if (!st || !larga()) return null;
    const area = areaDe(lid), m = area && modeloReal(area); if (!m) return null;
    const g = medir(area);
    return { livre: m.livre, colunas: m.colunas, linhas: m.linhas, blocos: m.blocos, px: { c: g.xs.map(f => f[1] - f[0]), l: g.ys.map(f => f[1] - f[0]) }, larguraPx: g.r.width };
  }
  function tamanho(lid, nC, nL) {
    const area = st && larga() ? areaDe(lid) : null, m = area && modeloReal(area);
    if (!m) return { ok: false, msg: 'A grade só pode ser editada em tela larga.' };
    nC = limitar(nC, 1, MAX_COL); nL = limitar(nL, 1, MAX_LIN);
    for (let c = m.colunas.length; c > nC; c--) if (!colunaVazia(m, c)) return { ok: false, msg: 'A coluna ' + c + ' tem um bloco. Mova o bloco antes de tirar a coluna.' };
    for (let r = nLin(m); r > nL; r--) if (!linhaVazia(m, r)) return { ok: false, msg: 'A linha ' + r + ' tem um bloco. Mova o bloco antes de tirar a linha.' };
    const c0 = m.colunas.length, l0 = nLin(m);
    if (nC === c0 && nL === l0) return { ok: true };
    m.colunas.length = Math.min(c0, nC); while (m.colunas.length < nC) m.colunas.push(1);
    m.linhas.length = Math.min(m.linhas.length, nL); while (m.linhas.length < nL) m.linhas.push('auto');
    gravar(area, m, false);
    return { ok: true };
  }
  function estrutura(lid, cols) {                  // atalho de estrutura: as colunas viram a lista dada (as linhas ficam como estão)
    const area = st && larga() ? areaDe(lid) : null, m = area && modeloReal(area);
    if (!m) return { ok: false, msg: 'A grade só pode ser editada em tela larga.' };
    const nC = limitar(cols.length, 1, MAX_COL);
    for (let c = m.colunas.length; c > nC; c--) if (!colunaVazia(m, c)) return { ok: false, msg: 'A coluna ' + c + ' tem um bloco. Mova o bloco antes de usar esta estrutura.' };
    m.colunas = cols.slice(0, nC);
    gravar(area, m, false);
    return { ok: true };
  }
  function tamanhoBloco(lid, id, w, hh) {
    const area = st && larga() ? areaDe(lid) : null, m = area && modeloReal(area), b = m && m.blocos.find(x => x.id === id);
    if (!b) return { ok: false, msg: 'Não achei este bloco.' };
    const r = tentarRedim(m, id, w, hh, 'c');
    if (!r.ok) return { ok: false, msg: w === b.ocupa && hh === b.ocupaLin ? '' : 'Não cabe: tem outro bloco no caminho (ou a grade acaba).' };
    gravar(area, r.modelo, false);
    return { ok: true };
  }
  function previa(lid, eixo, lista) {
    const area = st && larga() ? areaDe(lid) : null, m = area && modeloReal(area); if (!m) return;
    const mm = Object.assign({}, m, eixo === 'c' ? { colunas: lista } : { linhas: lista });
    const css = Roteador.cssTrilhas(mm.colunas, linhasEd(mm));
    area.style.setProperty('--ct-colunas', css.colunas);
    if (css.linhas) area.style.setProperty('--ct-linhas', css.linhas);
    st.previa = true; clearTimeout(st.tp); st.tp = setTimeout(() => { if (st) st.previa = false; }, 500);   // enquanto mexe, o redesenho automático espera
    reposicionar(area);
  }
  function definir(lid, eixo, lista) {
    const area = st && larga() ? areaDe(lid) : null, m = area && modeloReal(area); if (!m) return false;
    if (eixo === 'c') m.colunas = lista.slice(0, MAX_COL); else m.linhas = lista.slice(0, MAX_LIN);
    st.previa = false; gravar(area, m, false);
    return true;
  }

  /* ---------- ligar e desligar ---------- */
  const TITULOS = { d: 'Arraste para ocupar mais colunas', b: 'Arraste para ocupar mais linhas', c: 'Arraste para ocupar mais colunas e linhas' };
  function ligar(info, depois) {
    if (st) desligar();
    st = { info, depois, mexeu: false, raf: 0, obs: new Set() };
    st.ro = new ResizeObserver(entradas => {         // tamanho do layout mudou (janela; o Painel flutua e não muda mais isso): refaz o desenho (só se mudou de verdade)
      if (drag || arr || st.previa || !entradas.some(e => tam(e.target) !== e.target._tam)) return;
      cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(() => { if (st && !drag && !arr) atualizar(); });
    });
    st.mq = matchMedia('(min-width: 72rem)'); st.mqf = () => atualizar(); st.mq.addEventListener('change', st.mqf);
    info.itens.forEach(it => ['d', 'b', 'c'].forEach(modo => {
      const e = h('span', 'el-redim ' + modo); e.title = TITULOS[modo];
      e.addEventListener('pointerdown', ev => iniciarRedim(ev, it, modo));
      it.raiz.append(e);
    }));
  }
  // devolve true se mexeu nas linhas de algum layout (quem chama refaz a página para desfazer)
  function desligar() {
    if (!st) return false;
    if (drag) limparDrag();
    cancelarArrasto();
    st.info.itens.forEach(it => it.raiz.querySelectorAll(':scope > .el-redim').forEach(e => e.remove()));
    areasDe().forEach(limparArea);
    cancelAnimationFrame(st.raf); st.ro.disconnect(); st.mq.removeEventListener('change', st.mqf);
    const mexeu = st.mexeu; st = null;
    return mexeu;
  }

  return { ligar, desligar, atualizar, larga, dados, tamanho, estrutura, tamanhoBloco, previa, definir, comecarArrasto, sobre, limparSobre, soltarArrasto, cancelarArrasto };
})();