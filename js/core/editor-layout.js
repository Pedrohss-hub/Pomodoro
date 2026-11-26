/* Editor de layout: o botão "Editar layout" da barra de cada página que tem 2 ou mais containers.
   O botão fica no canto do site, ao lado da engrenagem, só com o símbolo (aria-label e dica explicam); ligado, vira um ✓ em fundo cheio.
   Ligado, cada container ganha uma alça (⋮⋮ + o título) presa à borda de cima; arraste pela alça para outra posição da fila.
   Os outros se reorganizam na hora (só o style.order muda, o DOM não é mexido). Ao soltar, a nova ordem (1..n) é guardada
   com Containers.ajustar (navegador + Sheets, como qualquer ajuste) e o Roteador.reaplicar() refaz a tela a partir dela.

   Como usar: nada a chamar. Basta carregar este arquivo depois de roteador.js e antes de paginas.js (que chama Roteador.iniciar).
   Ele se registra com Roteador.acaoDePagina e o botão aparece sozinho, na barra da página, só onde há 2+ containers ligados.
   Por que assim: "Editar layout" é da PÁGINA, não de um container. O Roteador já sabe onde fica a barra (o [data-acoes] do index.html,
   ou uma barra criada por ele) e quais containers estão ligados; o editor só pede um lugar lá e não precisa saber de nada do HTML.

   Regras:  - só troca a posição na fila (esquerda→direita, de cima para baixo); não cria células vazias nem linhas duplas
            - mouse e toque (pointer events); perto da borda de cima/baixo da tela a página rola sozinha
            - Esc cancela o arrastar (volta como estava); trocar de página ou clicar no botão de novo (✓ "Concluir layout") sai do modo
            - fora do modo, nada muda: alça e classes só existem enquanto ele está ligado
   Estilo: css/layout.css (classes el-*). Não usa a classe .editando, que é do Painel. */
const EditorLayout = (() => {
  const h = Util.h;
  const MOVE_MIN = 5;      // px que o ponteiro precisa andar para começar a arrastar (evita arrastar sem querer)
  const ZONA = 72;         // px da borda de cima/baixo da tela onde a página rola sozinha
  const HISTERESE = 12;    // px (na página) que o ponteiro anda entre uma troca e outra: evita ficar trocando de ida e volta
  const botoes = new Map();  // id da página -> botão do canto
  const SVG = c => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + c + '</svg>';
  const ICONE_EDITAR = SVG('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>');
  const ICONE_PRONTO = SVG('<path d="M20 6 9 17l-5-5"/>');
  const DICA_EDITAR = 'Editar layout: arrastar os blocos desta página para outra posição';
  let ed = null;             // modo ligado: { info, fila: [{ id, raiz }] na ordem visual, alcas: [] }
  let arr = null;            // arrastar em andamento

  const nome = id => Containers.def(id).titulo || id;

  // ordem visual de agora: a que o CSS usa (style.order, escrito pelo Roteador); se empatar, vale a posição no DOM
  const ordemVisual = itens => itens.slice().sort((a, b) =>
    ((parseInt(a.raiz.style.order, 10) || 0) - (parseInt(b.raiz.style.order, 10) || 0)) ||
    (a.raiz.compareDocumentPosition(b.raiz) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const escreverOrdem = () => ed.fila.forEach((it, i) => { it.raiz.style.order = String(i + 1); });

  /* ---------- ligar e desligar ---------- */
  function entrar(info) {
    if (ed) sair();
    Painel.fechar();                                        // o painel de configuração fecha ao entrar
    ed = { info, fila: ordemVisual(info.itens), alcas: [] };
    ed.info.itens.forEach(it => {
      const alca = h('span', 'el-alca'); alca.title = 'Arraste para mudar a posição';
      alca.append(h('span', 'el-pontos', '⋮⋮'), h('span', 'el-nome', nome(it.id)));
      alca.addEventListener('pointerdown', ev => comecar(ev, it, alca));
      alca.addEventListener('contextmenu', ev => ev.preventDefault());   // pressionar e segurar no celular não abre menu
      it.raiz.append(alca); ed.alcas.push(alca);
    });
    info.destino.classList.add('el-editando');
    marcarBotao(info.id, true);
  }

  function sair() {
    if (!ed) return;
    if (arr) terminar(false);
    ed.alcas.forEach(a => a.remove());
    ed.info.destino.classList.remove('el-editando');
    marcarBotao(ed.info.id, false);
    ed = null;
  }

  function marcarBotao(id, ligado) {
    const b = botoes.get(id); if (!b) return;
    b.innerHTML = ligado ? ICONE_PRONTO : ICONE_EDITAR;          // só o símbolo; o ✓ em fundo cheio mostra que o modo está ligado
    b.title = ligado ? 'Concluir layout (sair do modo de edição)' : DICA_EDITAR;
    b.setAttribute('aria-label', ligado ? 'Concluir layout' : 'Editar layout');
    b.setAttribute('aria-pressed', String(ligado));
  }

  /* ---------- arrastar pela alça ---------- */
  function comecar(ev, it, alca) {
    if (!ed || arr || ev.button > 0 || ev.isPrimary === false) return;
    ev.preventDefault();                                    // sem selecionar texto nem rolar a página (a alça tem touch-action: none)
    try { alca.setPointerCapture(ev.pointerId); } catch {}
    arr = { it, alca, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, on: false, antes: ed.fila.slice(), ult: null, raf: 0, chip: null };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar); window.addEventListener('pointercancel', cancelar);
    document.addEventListener('keydown', teclar, true);
    window.addEventListener('blur', cancelar);
  }

  function mover(ev) {
    if (!arr || ev.pointerId !== arr.pid) return;
    arr.x = ev.clientX; arr.y = ev.clientY;
    if (!arr.on) {
      if (Math.hypot(arr.x - arr.x0, arr.y - arr.y0) < MOVE_MIN) return;
      arr.on = true;
      arr.it.raiz.classList.add('el-arrastado'); document.body.classList.add('el-arrastando');
      arr.chip = h('div', 'el-chip', '⋮⋮ ' + nome(arr.it.id)); document.body.append(arr.chip);   // no body: o .painel-estudo tem transform e "prenderia" um fixed
    }
    seguir();
  }

  // posiciona o "fantasma" junto do ponteiro, troca de lugar se ele estiver sobre outro container e liga a rolagem automática
  function seguir() {
    arr.chip.style.transform = 'translate(' + (arr.x + 14) + 'px,' + (arr.y + 14) + 'px)';
    trocar();
    if (!arr.raf && velocidade(arr.y)) arr.raf = requestAnimationFrame(rolar);
  }

  function trocar() {
    const px = arr.x + scrollX, py = arr.y + scrollY;
    if (arr.ult && Math.hypot(px - arr.ult.x, py - arr.ult.y) < HISTERESE) return;
    const el = document.elementFromPoint(arr.x, arr.y);
    const alvo = el && ed.fila.find(it => it !== arr.it && it.raiz.contains(el));
    if (!alvo) return;
    const de = ed.fila.indexOf(arr.it), para = ed.fila.indexOf(alvo);     // vindo de antes, fica depois do alvo; vindo de depois, fica antes
    ed.fila.splice(de, 1); ed.fila.splice(para, 0, arr.it);
    escreverOrdem();
    arr.ult = { x: px, y: py };
  }

  const velocidade = y => {
    const d = Math.max(ZONA - y, y - (innerHeight - ZONA)); if (d <= 0) return 0;
    const v = Math.min(22, Math.ceil(d / ZONA * 22));
    return ZONA - y > y - (innerHeight - ZONA) ? -v : v;
  };

  function rolar() {
    if (!arr) return;
    arr.raf = 0;
    const v = velocidade(arr.y), antes = scrollY; if (!v) return;
    scrollBy({ top: v, left: 0, behavior: 'instant' });
    if (scrollY === antes) return;                          // chegou ao fim da página: para (volta a andar quando o ponteiro mexer)
    trocar();                                               // a página andou sob o ponteiro: pode haver outro container embaixo dele
    arr.raf = requestAnimationFrame(rolar);
  }

  const soltar = ev => { if (arr && ev.pointerId === arr.pid) terminar(true); };
  const cancelar = ev => { if (arr && (!ev.pointerId || ev.pointerId === arr.pid)) terminar(false); };
  const teclar = ev => { if (arr && ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); terminar(false); } };

  function terminar(guardar) {
    const a = arr; arr = null;
    cancelAnimationFrame(a.raf);
    window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); window.removeEventListener('pointercancel', cancelar);
    document.removeEventListener('keydown', teclar, true); window.removeEventListener('blur', cancelar);
    try { a.alca.releasePointerCapture(a.pid); } catch {}
    if (a.chip) a.chip.remove();
    a.it.raiz.classList.remove('el-arrastado'); document.body.classList.remove('el-arrastando');
    if (!a.on) return;
    const mudou = ed.fila.some((it, i) => it !== a.antes[i]);
    if (!guardar) { ed.fila = a.antes; if (mudou) Roteador.reaplicar(); return; }    // cancelou: volta como estava (reaplicar relê a configuração)
    if (!mudou) return;                                     // soltou onde estava: nada a gravar
    ed.fila.forEach((it, i) => Containers.ajustar(it.id, { ordem: i + 1 }));        // 1..n de todos os containers da página
    Roteador.reaplicar();
  }

  /* ---------- o botão da barra ---------- */
  Roteador.acaoDePagina(info => info.itens.length < 2 ? null : {
    rotulo: 'Editar layout', dica: DICA_EDITAR, canto: true, icone: ICONE_EDITAR,
    fazer: () => { if (ed && ed.info.id === info.id) sair(); else entrar(info); },
    botao: b => { botoes.set(info.id, b); b.setAttribute('aria-pressed', 'false'); b.classList.add('el-botao'); }
  });
  window.addEventListener('hashchange', sair);              // trocou de página: sai do modo

  return { entrar, sair, ligado: () => !!ed };
})();