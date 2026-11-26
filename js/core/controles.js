/* Controles para o Painel (js/core/painel.js, tipo 'custom'): peças prontas para escolher tamanhos sem digitar texto solto.
   Cada função devolve um elemento. Quem usa decide o que fazer com a escolha (hoje: js/core/painel-layout.js).

     Controles.celulas({ colunas, linhas, atual: { c, l }, texto(c, l), aoEscolher(c, l), nome })
        Seletor de células: passe o mouse (ou use as setas) para ver o tamanho e clique (ou Enter) para escolher.
        colunas/linhas = quantas células aparecem; atual = o tamanho de agora (fica pintado); texto = a frase da legenda.
        aoEscolher pode devolver um TEXTO: ele aparece embaixo (use para explicar por que não deu).
     Controles.medida({ rotulo, valor: { n, u }, unidades, converter(de, para), aoPrevia(v), aoConfirmar(v), info(), id })
        Campo "− valor +" com unidade e deslizante. unidades = { fr: { min, max, passo, slider: [a, b] }, rem: {...}, auto: { auto: true } }
        (a unidade "auto" não tem número); com uma unidade só, a caixa de unidade não aparece.
        Enquanto o deslizante anda só chama aoPrevia (mostrar ao vivo, sem guardar); aoConfirmar é para guardar (−, +, digitar, soltar o deslizante, trocar a unidade).
        converter(de, para) devolve o número equivalente quando a unidade muda; info() devolve um texto curto ao lado do rótulo.
     Controles.segmentado({ rotulo, opcoes: [[valor, rótulo]], valor, aoEscolher(valor) })
        Dois ou três botões lado a lado, para escolher uma opção.
   Estilo: css/planilha.css (classes cs-*, md-*, sg-*). Texto entra sempre como texto (textContent), nunca como HTML.
   Carregue depois de util.js e antes de painel-layout.js. */
const Controles = (() => {
  const h = Util.h;
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const arred = v => Math.round(v * 100) / 100;
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  /* ---------- seletor de células ---------- */
  function celulas(o) {
    const raiz = h('div', 'cs'), grade = h('div', 'cs-grade'), leg = h('p', 'cs-leg'), msg = h('p', 'pn-erro'); msg.hidden = true;
    const texto = o.texto || ((c, l) => plural(c, 'coluna', 'colunas') + ' × ' + plural(l, 'linha', 'linhas'));
    let cur = { c: o.atual.c, l: o.atual.l };                      // a célula de baixo à direita que o mouse (ou a seta) está marcando
    grade.style.gridTemplateColumns = 'repeat(' + o.colunas + ', minmax(0, 1fr))';
    grade.tabIndex = 0; grade.setAttribute('role', 'group'); grade.setAttribute('aria-label', o.nome || 'Escolher colunas e linhas');
    if (o.id) grade.dataset.foco = o.id;
    const cels = [];
    for (let l = 1; l <= o.linhas; l++) for (let c = 1; c <= o.colunas; c++) {
      const e = h('span', 'cs-c'); e.dataset.c = c; e.dataset.l = l; cels.push(e); grade.append(e);
    }
    const pintar = sobre => {
      cels.forEach(e => {
        const c = +e.dataset.c, l = +e.dataset.l;
        e.classList.toggle('atual', c <= o.atual.c && l <= o.atual.l);
        e.classList.toggle('sobre', sobre && c <= cur.c && l <= cur.l);
      });
      leg.textContent = sobre && (cur.c !== o.atual.c || cur.l !== o.atual.l) ? '→ ' + texto(cur.c, cur.l) : texto(o.atual.c, o.atual.l);
    };
    const escolher = () => {
      const r = o.aoEscolher(cur.c, cur.l);
      msg.textContent = typeof r === 'string' ? r : ''; msg.hidden = !(typeof r === 'string' && r);
    };
    grade.addEventListener('pointerover', ev => { const k = ev.target.closest('.cs-c'); if (k) { cur = { c: +k.dataset.c, l: +k.dataset.l }; pintar(true); } });
    grade.addEventListener('pointerleave', () => { cur = { c: o.atual.c, l: o.atual.l }; pintar(false); });
    grade.addEventListener('click', ev => { const k = ev.target.closest('.cs-c'); if (!k) return; cur = { c: +k.dataset.c, l: +k.dataset.l }; escolher(); });
    grade.addEventListener('focus', () => pintar(true));
    grade.addEventListener('blur', () => { cur = { c: o.atual.c, l: o.atual.l }; pintar(false); });
    grade.addEventListener('keydown', ev => {                      // teclado: setas movem a marca, Enter ou espaço escolhem
      const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[ev.key];
      if (d) { ev.preventDefault(); cur = { c: limitar(cur.c + d[0], 1, o.colunas), l: limitar(cur.l + d[1], 1, o.linhas) }; pintar(true); }
      else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); escolher(); }
    });
    pintar(false);
    raiz.append(grade, leg, msg);
    return raiz;
  }

  /* ---------- campo "− valor +" com unidade e deslizante ---------- */
  function medida(o) {
    const raiz = h('div', 'md'), topo = h('div', 'md-topo'), info = h('span', 'md-info'), linha = h('div', 'md-linha');
    const menos = h('button', 'md-btn', '−'), mais = h('button', 'md-btn', '+'), num = h('input', 'md-num'), un = h('select', 'md-un'), desl = h('input', 'md-desl');
    menos.type = mais.type = 'button'; num.type = 'text'; num.inputMode = 'decimal'; desl.type = 'range';
    menos.setAttribute('aria-label', 'Diminuir ' + o.rotulo); mais.setAttribute('aria-label', 'Aumentar ' + o.rotulo);
    num.setAttribute('aria-label', o.rotulo); un.setAttribute('aria-label', 'Unidade de ' + o.rotulo); desl.setAttribute('aria-label', o.rotulo + ' (deslizante)');
    if (o.id) { menos.dataset.foco = o.id + ':menos'; mais.dataset.foco = o.id + ':mais'; num.dataset.foco = o.id + ':num'; un.dataset.foco = o.id + ':un'; desl.dataset.foco = o.id + ':desl'; }
    const nomes = Object.keys(o.unidades);
    nomes.forEach(u => un.append(new Option(u, u)));
    un.hidden = nomes.length < 2;
    let v = { n: o.valor.n, u: nomes.includes(o.valor.u) ? o.valor.u : nomes[0] };
    let guardado = { n: v.n, u: v.u };                           // o último valor CONFIRMADO (a prévia do deslizante muda v, mas não isto)
    const cfg = () => o.unidades[v.u], auto = () => !!cfg().auto;
    const pedirInfo = () => { info.textContent = o.info ? o.info() : ''; };

    function sincronizar() {
      const c = cfg(), a = auto();
      un.value = v.u; num.value = a ? '' : String(arred(v.n)); num.placeholder = a ? 'auto' : ''; num.disabled = a;
      menos.disabled = mais.disabled = a; desl.hidden = a;
      if (!a) { desl.min = c.slider ? c.slider[0] : c.min; desl.max = c.slider ? c.slider[1] : c.max; desl.step = c.passo; desl.value = String(limitar(v.n, +desl.min, +desl.max)); }
    }
    function ajustar(n, confirmar) {
      const c = cfg(), novo = { n: limitar(arred(n), c.min, c.max), u: v.u };
      v = novo; sincronizar();
      if (confirmar) { if (v.n !== guardado.n || v.u !== guardado.u) { guardado = { n: v.n, u: v.u }; o.aoConfirmar({ n: v.n, u: v.u }); } } else o.aoPrevia({ n: v.n, u: v.u });
      pedirInfo();
    }
    menos.onclick = () => ajustar(v.n - cfg().passo, true);
    mais.onclick = () => ajustar(v.n + cfg().passo, true);
    num.addEventListener('change', () => { const n = parseFloat(num.value.replace(',', '.')); if (Number.isFinite(n)) ajustar(n, true); else sincronizar(); });
    desl.addEventListener('input', () => ajustar(+desl.value, false));
    desl.addEventListener('change', () => ajustar(+desl.value, true));
    un.addEventListener('change', () => {
      const de = { n: v.n, u: v.u }, u = un.value, c = o.unidades[u];
      let n = c.auto ? 0 : o.converter ? o.converter(de, u) : c.min;
      if (!Number.isFinite(n)) n = c.auto ? 0 : c.min;
      v = { n: c.auto ? 0 : limitar(arred(n), c.min, c.max), u };
      sincronizar(); guardado = { n: v.n, u: v.u }; o.aoConfirmar({ n: v.n, u: v.u }); pedirInfo();
    });
    topo.append(h('span', 'md-rot', o.rotulo), info); linha.append(menos, num, mais, un);
    raiz.append(topo, linha, desl);
    sincronizar(); pedirInfo();
    return raiz;
  }

  /* ---------- opções lado a lado ---------- */
  function segmentado(o) {
    const raiz = h('div', 'sg'), grupo = h('div', 'sg-grupo');
    grupo.setAttribute('role', 'radiogroup'); grupo.setAttribute('aria-label', o.rotulo);
    o.opcoes.forEach(([val, rot]) => {
      const b = h('button', 'sg-op' + (val === o.valor ? ' atual' : ''), rot); b.type = 'button';
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(val === o.valor));
      if (o.id) b.dataset.foco = o.id + ':' + val;
      b.onclick = () => { if (val !== o.valor) o.aoEscolher(val); };
      grupo.append(b);
    });
    raiz.append(h('span', 'md-rot', o.rotulo), grupo);
    return raiz;
  }

  return { celulas, medida, segmentado };
})();