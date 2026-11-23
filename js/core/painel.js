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
   Opções comuns: dica, mostrarSe(valores), recarrega (redesenha os campos ao mudar), ao: 'input' | 'change' (quando avisar) */
const Painel = (() => {
  const h = Util.h;
  let el = null, atual = null, abasCache = [];

  function montar() {
    if (el) return;
    el = h('aside', 'painel'); el.hidden = true; el.setAttribute('aria-label', 'Configuração');
    el.innerHTML = `<div class="painel-topo"><div><h2 class="painel-titulo"></h2><p class="painel-sub"></p></div>
      <button type="button" class="painel-fechar" aria-label="Fechar o painel" title="Fechar">✕</button></div>
      <div class="painel-corpo"></div><div class="painel-rodape"></div>`;
    document.body.append(el);
    el.querySelector('.painel-fechar').onclick = fechar;
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && atual && !ev.defaultPrevented && !document.querySelector('dialog[open]')) fechar(); });
  }

  const carregarAbas = () => { if (!abasCache.length && Sheets.pronto()) Sheets.abas().then(d => { if (d && d.ok) abasCache = d.abas; }).catch(() => {}); };

  function campo(c, v) {
    const caixa = h('div', 'pn-campo');
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
    const sc = corpo.scrollTop;
    corpo.replaceChildren(...atual.campos.filter(c => !c.mostrarSe || c.mostrarSe(v)).map(c => campo(c, v)));
    corpo.scrollTop = sc;
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