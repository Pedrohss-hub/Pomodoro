/* Painel de configuração: o jeito ÚNICO de configurar qualquer container. FLUTUA por cima da página (à direita ou à esquerda em tela larga;
   folha embaixo no celular) e NÃO empurra nem encolhe nada: as medidas da página são as mesmas com ele aberto ou fechado.
   Na barra do título: ⇄ muda de lado (lembra neste aparelho), − recolhe (só a barra fica) / expande, ✕ fecha.
   O que você muda vale na hora e dá para ver o resultado enquanto mexe.
   Cada container só descreve os campos; o visual e o comportamento são sempre os mesmos.

     Painel.abrir({
       id: 'cfg:agenda',              // abrir de novo com o mesmo id fecha o painel
       titulo, subtitulo,
       alvo: elemento,                // opcional: ganha um contorno enquanto é editado
       campos: [ { chave, rotulo, tipo, ... } ],
       valores: () => objeto,         // valores de agora (lido de novo a cada mudança)
       aoMudar: (chave, valor) => {}, // chamado ao vivo
       botoes: [ { rotulo, perigo, acao } ],
       aoFechar: () => {},
       classe: 'minha-classe'         // opcional: classe extra no painel enquanto este está aberto (ex.: 'pn-translucido' = fica meio transparente sem o mouse)
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
  let recolhido = false;               // painel recolhido (só a barra do título)? volta a expandir ao abrir outro
  const gruposAbertos = new Map();      // chave do grupo -> aberto? (lembra enquanto a página não é recarregada)

  function montar() {
    if (el) return;
    el = h('aside', 'painel'); el.hidden = true; el.setAttribute('aria-label', 'Configuração');
    el.innerHTML = `<div class="painel-topo"><div><h2 class="painel-titulo"></h2><p class="painel-sub"></p></div>
      <div class="painel-botoes"><button type="button" class="painel-ic painel-lado" aria-label="Mudar de lado" title="Mudar de lado"></button>
      <button type="button" class="painel-ic painel-rec" aria-label="Recolher o painel" title="Recolher"></button>
      <button type="button" class="painel-fechar" aria-label="Fechar o painel" title="Fechar">✕</button></div></div>
      <div class="painel-corpo"></div><div class="painel-rodape"></div>`;
    document.body.append(el);
    el.querySelector('.painel-lado').onclick = () => { lado(lado() === 'direita' ? 'esquerda' : 'direita'); };
    el.querySelector('.painel-rec').onclick = () => recolher(!recolhido);
    lado(lado()); recolher(false);
    el.querySelector('.painel-fechar').onclick = () => fechar();       // sem repassar o evento do clique: ele seria lido como "troca" e o painel não fecharia
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && atual && !ev.defaultPrevented && !document.querySelector('dialog[open]')) fechar(); });
  }

  // ícones: texto fixo do código (nunca dado digitado), por isso innerHTML é seguro aqui
  const SVG = d => '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICO = { lado: SVG('<path d="M2 5h10M9 2l3 3-3 3M12 9H2M5 6l-3 3 3 3"/>'), menos: SVG('<path d="M3 7h8"/>'), mais: SVG('<path d="M3 7h8M7 3v8"/>') };
  // lado do painel em tela larga: 'direita' (padrão) ou 'esquerda'; guardado só neste aparelho (localStorage "pn-lado"), sem ir para o Sheets
  function lado(novo) {
    if (novo === undefined) { try { return localStorage.getItem('pn-lado') === 'esquerda' ? 'esquerda' : 'direita'; } catch (e) { return 'direita'; } }
    try { localStorage.setItem('pn-lado', novo); } catch (e) { /* sem armazenamento: vale só até recarregar */ }
    el.dataset.lado = novo;
    const b = el.querySelector('.painel-lado'); b.innerHTML = ICO.lado;
    b.title = b.ariaLabel = novo === 'direita' ? 'Mover para a esquerda' : 'Mover para a direita';
  }
  function recolher(sim) {
    recolhido = !!sim; el.classList.toggle('recolhido', recolhido);
    const b = el.querySelector('.painel-rec'); b.innerHTML = recolhido ? ICO.mais : ICO.menos;
    b.title = b.ariaLabel = recolhido ? 'Expandir o painel' : 'Recolher o painel';
    b.setAttribute('aria-expanded', String(!recolhido));
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
    if (o.classe) el.classList.add(...String(o.classe).split(/\s+/).filter(Boolean));
    el.querySelector('.painel-titulo').textContent = o.titulo || 'Configuração';
    el.querySelector('.painel-sub').textContent = o.subtitulo || '';
    desenhar(); recolher(false);
    el.hidden = false; document.body.classList.add('painel-aberto');      // só marca "aberto" (esconde o botão ⚙ Layouts); não muda o tamanho de nada
    if (o.alvo) o.alvo.classList.add('editando');                          // sem rolar a página: nada pode se mexer
  }
  function fechar(troca) {
    if (!el || !atual) return;
    const o = atual; atual = null;
    if (o.alvo) o.alvo.classList.remove('editando');
    if (o.classe) el.classList.remove(...String(o.classe).split(/\s+/).filter(Boolean));
    if (!troca) { el.hidden = true; document.body.classList.remove('painel-aberto'); }
    if (o.aoFechar) o.aoFechar();
  }
  const titulo = t => { if (el && atual) el.querySelector('.painel-titulo').textContent = t; };

  return { abrir, fechar, atualizar: () => { if (atual) desenhar(); }, aberto: () => atual, titulo };
})();