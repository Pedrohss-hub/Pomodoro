/* Painel de configuração: o jeito ÚNICO de configurar qualquer container. Abre ao lado (ou embaixo, no celular),
   sem cobrir o container: o que você muda vale na hora e dá para ver o resultado enquanto mexe.
   Cada container só descreve os campos; o visual e o comportamento são sempre os mesmos.

     Painel.abrir({
       id: 'cfg:agenda',              // abrir de novo com o mesmo id fecha o painel
       titulo, subtitulo,
       alvo: elemento,                // opcional: ganha um contorno enquanto é editado
       campos: [ { chave, rotulo, tipo, ... } ],
       valores: () => objeto,         // valores de agora (lido de novo a cada mudança)
       aoMudar: (chave, valor) => {}, // chamado ao vivo
       botoes: [ { rotulo, perigo, acao } ],
       aoFechar: () => {}
     });
     Painel.atualizar()  redesenha os campos       Painel.fechar()  fecha       Painel.aberto()  as opções abertas (ou null)

   Tipos de campo:
     texto | numero (min, max) | caixa | selecao (opcoes: [[valor, rótulo]], numero: true)
     intervalo (células tipo A3:G; opcional: true)      aba (nome da aba, com sugestões da planilha)      sugestao (sugestoes: () => [textos])
     titulo (só um subtítulo para separar grupos; rotulo, dica)      botao (rotulo, perigo, acao: um botão no meio dos campos)
     grupo (rotulo, chave, aberto, campos: [...])   caixa que abre e fecha, com outros campos dentro; lembra se está aberta (pela chave)
     custom (montar: valores => elemento)           um controle feito por fora (ex.: js/core/controles.js); o Painel só o coloca na lista
   Opções comuns: dica, mostrarSe(valores), recarrega (redesenha os campos ao mudar), ao: 'input' | 'change' (quando avisar) */
const Painel = (() => {
  const h = Util.h;
  let el = null, atual = null, abasCache = [];
  const gruposAbertos = new Map();      // chave do grupo -> aberto? (lembra enquanto a página não é recarregada)

  function montar() {
    if (el) return;
    el = h('aside', 'painel'); el.hidden = true; el.setAttribute('aria-label', 'Configuração');
    el.innerHTML = `<div class="painel-topo"><div><h2 class="painel-titulo"></h2><p class="painel-sub"></p></div>
      <button type="button" class="painel-fechar" aria-label="Fechar o painel" title="Fechar">✕</button></div>
      <div class="painel-corpo"></div><div class="painel-rodape"></div>`;
    document.body.append(el);
    el.querySelector('.painel-fechar').onclick = () => fechar();       // sem repassar o evento do clique: ele seria lido como "troca" e o painel não fecharia
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && atual && !ev.defaultPrevented && !document.querySelector('dialog[open]')) fechar(); });
  }

  const carregarAbas = () => { if (!abasCache.length && Sheets.pronto()) Sheets.abas().then(d => { if (d && d.ok && Array.isArray(d.abas)) abasCache = d.abas; }).catch(() => {}); };

  function campo(c, v) {
    const caixa = h('div', 'pn-campo');
    if (c.tipo === 'custom') { caixa.append(c.montar(v)); return caixa; }
    if (c.tipo === 'grupo') {                                           // caixa que abre e fecha; os campos de dentro funcionam como os de fora
      const d = h('details', 'pn-grupo'), corpo = h('div', 'pn-grupo-corpo'), k = c.chave || c.rotulo;
      d.open = gruposAbertos.has(k) ? gruposAbertos.get(k) : !!c.aberto;
      d.addEventListener('toggle', () => gruposAbertos.set(k, d.open));
      d.append(h('summary', null, c.rotulo), corpo);
      corpo.append(...c.campos.filter(x => !x.mostrarSe || x.mostrarSe(v)).map(x => campo(x, v)));
      caixa.append(d); return caixa;
    }
    if (c.tipo === 'titulo' || c.tipo === 'botao') {                    // não guardam valor: só texto ou botão
      if (c.tipo === 'titulo') caixa.append(h('h3', 'pn-secao', c.rotulo));
      else { const b = h('button', 'painel-btn' + (c.perigo ? ' perigo' : ''), c.rotulo); b.type = 'button'; b.onclick = c.acao; caixa.append(b); }
      if (c.dica) caixa.append(h('p', 'pn-dica', c.dica));
      return caixa;
    }
    const dica = c.dica ? h('p', 'pn-dica', c.dica) : null, erro = h('p', 'pn-erro'); erro.hidden = true;
    const aplicar = valor => { atual.aoMudar(c.chave, valor); if (c.recarrega) desenhar(); };
    let ctl;
    if (c.tipo === 'caixa') {
      const l = h('label', 'pn-caixa'); ctl = h('input'); ctl.type = 'checkbox'; ctl.checked = !!v[c.chave];
      ctl.onchange = () => aplicar(ctl.checked); l.append(ctl, h('span', null, c.rotulo)); caixa.append(l);
    } else {
      const l = h('label', 'pn-rotulo', c.rotulo); caixa.append(l);
      if (c.tipo === 'selecao') {
        ctl = h('select'); c.opcoes.forEach(([val, rot]) => ctl.append(new Option(rot, String(val)))); ctl.value = String(v[c.chave]);
        ctl.onchange = () => aplicar(c.numero ? Number(ctl.value) : ctl.value);
      } else {
        ctl = h('input'); ctl.type = c.tipo === 'numero' ? 'number' : 'text'; ctl.value = v[c.chave] == null ? '' : v[c.chave];
        if (c.tipo === 'numero') { if (c.min != null) ctl.min = c.min; if (c.max != null) ctl.max = c.max; }
        const intervalo = c.tipo === 'intervalo', sugere = c.tipo === 'aba' || c.tipo === 'sugestao';
        if (c.tipo === 'aba') { carregarAbas(); Combo.ligar(ctl, () => abasCache); }
        if (c.tipo === 'sugestao') Combo.ligar(ctl, c.sugestoes);
        const quando = c.ao || (intervalo || sugere ? 'change' : 'input');
        ctl.addEventListener(quando, () => {
          let val = ctl.value;
          if (intervalo) {
            val = val.trim().toUpperCase();
            const ok = (c.opcional && !val) || Util.REGEX_INTERVALO.test(val);
            ctl.classList.toggle('erro', !ok); erro.textContent = ok ? '' : 'Use o formato A3:G (colunas e linhas).'; erro.hidden = ok;
            if (!ok) return;
          } else if (c.tipo === 'numero') val = Math.max(c.min != null ? c.min : -Infinity, parseInt(val) || 0);
          else if (c.tipo === 'aba') val = val.trim() || v[c.chave];
          aplicar(val);
        });
      }
      l.htmlFor = ctl.id = 'pn-' + c.chave;
      caixa.append(ctl);
    }
    if (dica) caixa.append(dica);
    caixa.append(erro);
    return caixa;
  }

  function desenhar() {
    const corpo = el.querySelector('.painel-corpo'), rod = el.querySelector('.painel-rodape'), v = atual.valores();
    const sc = corpo.scrollTop, f = document.activeElement, foco = f && f.dataset ? f.dataset.foco : null;   // data-foco: o campo que estava em foco volta a ficar depois de redesenhar
    corpo.replaceChildren(...atual.campos.filter(c => !c.mostrarSe || c.mostrarSe(v)).map(c => campo(c, v)));
    corpo.scrollTop = sc;
    if (foco) { const n = [...corpo.querySelectorAll('[data-foco]')].find(x => x.dataset.foco === foco); if (n && !n.disabled) n.focus({ preventScroll: true }); }
    rod.replaceChildren(...(atual.botoes || []).map(b => { const x = h('button', 'painel-btn' + (b.perigo ? ' perigo' : ''), b.rotulo); x.type = 'button'; x.onclick = b.acao; return x; }));
    rod.hidden = !rod.children.length;
  }

  function abrir(o) {
    montar();
    if (atual && o.id && atual.id === o.id) return fechar();
    if (atual) fechar(true);
    atual = o;
    el.querySelector('.painel-titulo').textContent = o.titulo || 'Configuração';
    el.querySelector('.painel-sub').textContent = o.subtitulo || '';
    desenhar();
    el.hidden = false; document.body.classList.add('painel-aberto');
    if (o.alvo) { o.alvo.classList.add('editando'); o.alvo.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function fechar(troca) {
    if (!el || !atual) return;
    const o = atual; atual = null;
    if (o.alvo) o.alvo.classList.remove('editando');
    if (!troca) { el.hidden = true; document.body.classList.remove('painel-aberto'); }
    if (o.aoFechar) o.aoFechar();
  }
  const titulo = t => { if (el && atual) el.querySelector('.painel-titulo').textContent = t; };

  return { abrir, fechar, atualizar: () => { if (atual) desenhar(); }, aberto: () => atual, titulo };
})();