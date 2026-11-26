/* Editor de layout: o botão "Editar layout" da barra de cada página que tem 2 ou mais containers.
   O botão fica no canto do site, ao lado da engrenagem, só com o símbolo (aria-label e dica explicam); ligado, vira um ✓ em fundo cheio.
   Ligado, cada container ganha uma alça (⋮⋮ + o título) presa à borda de cima; arraste pela alça para outra posição da fila.
   Cada layout (área) da página mostra o nome que você deu a ele ("Layout: Topo"; sem nome, o id); um layout sem blocos aparece com "Solte aqui".
   Dentro da MESMA área os outros se reorganizam na hora (só o style.order muda, o DOM não é mexido). Ao soltar, a nova ordem (1..n) da área é guardada
   com Containers.ajustar (navegador + Sheets, como qualquer ajuste) e o Roteador.reaplicar() refaz a tela a partir dela.
   Para OUTRA área: ao entrar nela, a área ganha um contorno e uma barra mostra onde o bloco vai ficar; o bloco só muda de lugar ao soltar
   (grava "layout" e "ordem" dele e renumera as duas áreas). Esc cancela.
   Ao ligar o modo o Painel ao lado abre com os LAYOUTS da página (js/core/painel-layout.js): nome, tipo de grade, espaços, colunas de cada bloco, criar e apagar layouts.
   Em tela pequena ele não abre sozinho (cobriria a página). Fechou o painel? O botão "⚙ Layouts" (canto de baixo, à esquerda) ou o nome do layout ("Layout: nome ⚙") abrem de novo.

   Como usar: nada a chamar. Basta carregar este arquivo depois de roteador.js e antes de paginas.js (que chama Roteador.iniciar).
   Ele se registra com Roteador.acaoDePagina e o botão aparece sozinho, na barra da página, só onde há 2+ containers ligados.
   Por que assim: "Editar layout" é da PÁGINA, não de um container. O Roteador já sabe onde fica a barra (o [data-acoes] do index.html,
   ou uma barra criada por ele) e quais containers estão ligados; o editor só pede um lugar lá e não precisa saber de nada do HTML.

   Regras:  - dentro da área, troca a posição na fila (esquerda→direita, de cima para baixo); entre áreas, escolhe a posição pela barra
            - não cria células vazias nem linhas duplas
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
  let ed = null;             // modo ligado: { info, alcas: [] }
  let arr = null;            // arrastar em andamento
  const AREAS = ':scope > .ct-area';   // as áreas (layouts) da página, filhas diretas do destino

  const nome = id => Containers.def(id).titulo || id;

  // ordem visual de agora: a que o CSS usa (style.order, escrito pelo Roteador); se empatar, vale a posição no DOM
  const ordemVisual = itens => itens.slice().sort((a, b) =>
    ((parseInt(a.raiz.style.order, 10) || 0) - (parseInt(b.raiz.style.order, 10) || 0)) ||
    (a.raiz.compareDocumentPosition(b.raiz) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  // os blocos de uma área (o pai do bloco), na ordem visual de agora
  const filaDe = area => ordemVisual(ed.info.itens.filter(it => it.raiz.parentNode === area));
  const escreverOrdem = fila => { fila.forEach((it, i) => { it.raiz.style.order = String(i + 1); }); Roteador.empilhar(); };   // empilhar: refaz a "pilha" com a ordem nova

  /* ---------- ligar e desligar ---------- */
  function entrar(info) {
    if (ed) sair();
    Painel.fechar();                                        // o painel de configuração fecha ao entrar
    ed = { info, alcas: [] };
    ed.info.itens.forEach(it => {
      const alca = h('span', 'el-alca'); alca.title = 'Arraste para mudar a posição';
      alca.append(h('span', 'el-pontos', '⋮⋮'), h('span', 'el-nome', nome(it.id)));
      alca.addEventListener('pointerdown', ev => comecar(ev, it, alca));
      alca.addEventListener('contextmenu', ev => ev.preventDefault());   // pressionar e segurar no celular não abre menu
      it.raiz.append(alca); ed.alcas.push(alca);
    });
    info.destino.classList.add('el-editando');
    const bl = h('button', 'el-layouts-btn', '⚙ Layouts'); bl.type = 'button'; bl.title = 'Abrir o painel de layouts'; bl.onclick = abrirLayouts;   // sempre à mão para reabrir o painel (some quando ele está aberto)
    document.body.append(bl); ed.btnLayouts = bl;
    marcarAreas();
    marcarBotao(info.id, true);
    if (matchMedia('(min-width: 72rem)').matches) abrirLayouts();
  }

  const contar = id => ed.info.itens.filter(it => it.raiz.parentNode && it.raiz.parentNode.dataset.layout === id).length;
  // os blocos de um layout, na ordem de agora: [{ id, titulo }] (o Painel de layouts usa para escolher quantas colunas cada um ocupa)
  const blocos = id => ordemVisual(ed.info.itens.filter(it => it.raiz.parentNode && it.raiz.parentNode.dataset.layout === id)).map(it => ({ id: it.id, titulo: nome(it.id) }));
  const nomeDoLayout = id => { const l = Roteador.layouts(ed.info.id).layouts.find(x => x.id === id); return (l && l.nome) || id; };
  function abrirLayouts() {
    if (!ed) return;
    const b = document.querySelector('.abas [data-pg="' + ed.info.id + '"]');
    PainelLayout.abrir({ pid: ed.info.id, titulo: b ? b.textContent : ed.info.id, contar, blocos, aoAlterar: marcarAreas });
  }

  // nome em cada área; área sem blocos ganha um espaço "Solte aqui" (e aparece, mesmo vazia, só enquanto o modo está ligado)
  function marcarAreas() {
    if (!ed) return;
    ed.info.destino.querySelectorAll(AREAS).forEach(area => {
      area.hidden = false;
      let nm = area.querySelector(':scope > .el-area-nome');
      if (!nm) { nm = h('button', 'el-area-nome'); nm.type = 'button'; nm.title = 'Ajustar os layouts desta página'; nm.onclick = abrirLayouts; area.append(nm); }
      nm.textContent = 'Layout: ' + nomeDoLayout(area.dataset.layout) + ' ⚙';          // o nome pode ter mudado no Painel
      const vazia = !ed.info.itens.some(it => it.raiz.parentNode === area), v = area.querySelector(':scope > .el-vazio');
      if (vazia && !v) area.append(h('div', 'el-vazio', 'Solte aqui'));
      else if (!vazia && v) v.remove();
    });
  }

  function sair() {
    if (!ed) return;
    if (arr) terminar(false);
    ed.alcas.forEach(a => a.remove());
    if (ed.btnLayouts) ed.btnLayouts.remove();
    PainelLayout.fechar();
    let vazia = false;
    ed.info.destino.querySelectorAll(AREAS).forEach(area => {
      if (area.querySelector(':scope > .el-vazio')) vazia = true;
      area.querySelectorAll(':scope > .el-area-nome, :scope > .el-vazio').forEach(e => e.remove());
      area.classList.remove('el-alvo');
    });
    ed.info.destino.classList.remove('el-editando');
    if (vazia) { const info = ed.info; ed = null; Roteador.reaplicar(); marcarBotao(info.id, false); return; }   // área vazia volta a sumir
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
    const area = it.raiz.parentNode, fila = filaDe(area);
    arr = { it, alca, area, fila, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, on: false, antes: fila.slice(), ult: null, raf: 0, chip: null, alvo: null, marca: null };
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

  // a área (layout) que está sob o ponto, ou nada se ele estiver no espaço entre áreas
  function areaSob(x, y) {
    return [...ed.info.destino.querySelectorAll(AREAS)].find(a => {
      if (a.hidden) return false;
      const r = a.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }) || null;
  }

  // o ponteiro está sobre OUTRA área: acha a posição na fila dela e mostra a barra; nada muda de lugar até soltar
  function alvoFora(area) {
    if (arr.alvo && arr.alvo.area !== area) arr.alvo.area.classList.remove('el-alvo');
    const fila = filaDe(area), lado = fila.length && getComputedStyle(area).gridTemplateColumns.split(' ').length > 1;   // lado a lado ou empilhados
    let idx = fila.length;
    for (let i = 0; i < fila.length; i++) {
      const r = fila[i].raiz.getBoundingClientRect();
      if (lado ? (arr.y < r.top || (arr.y < r.bottom && arr.x < r.left + r.width / 2)) : arr.y < r.top + r.height / 2) { idx = i; break; }
    }
    arr.alvo = { area, idx, fila }; area.classList.add('el-alvo');
    const ar = area.getBoundingClientRect(), fim = idx >= fila.length;
    const ref = fila.length ? fila[fim ? idx - 1 : idx].raiz.getBoundingClientRect() : ar;
    if (!arr.marca) { arr.marca = h('div', 'el-marca'); document.body.append(arr.marca); }
    const m = arr.marca.style;
    if (lado) { m.left = (fim ? ref.right : ref.left) - 2 + 'px'; m.top = ref.top + 'px'; m.width = '4px'; m.height = ref.height + 'px'; }
    else { m.left = ar.left + 'px'; m.top = (fila.length ? (fim ? ref.bottom : ref.top) : ar.top + 8) - 2 + 'px'; m.width = ar.width + 'px'; m.height = '4px'; }
  }

  function limparAlvo(a) {
    if (a.alvo) a.alvo.area.classList.remove('el-alvo');
    if (a.marca) a.marca.remove();
    a.alvo = null; a.marca = null;
  }

  function trocar() {
    const area = areaSob(arr.x, arr.y);
    if (area && area !== arr.area) { alvoFora(area); return; }
    if (!area) { if (arr.alvo) alvoFora(arr.alvo.area); return; }       // no espaço entre áreas: mantém o último alvo
    if (arr.alvo) limparAlvo(arr);                                      // voltou para a própria área
    const px = arr.x + scrollX, py = arr.y + scrollY;
    if (arr.ult && Math.hypot(px - arr.ult.x, py - arr.ult.y) < HISTERESE) return;
    const el = document.elementFromPoint(arr.x, arr.y);
    const alvo = el && arr.fila.find(it => it !== arr.it && it.raiz.contains(el));          // só troca com quem é da mesma área
    if (!alvo) return;
    const de = arr.fila.indexOf(arr.it), para = arr.fila.indexOf(alvo);   // vindo de antes, fica depois do alvo; vindo de depois, fica antes
    arr.fila.splice(de, 1); arr.fila.splice(para, 0, arr.it);
    escreverOrdem(arr.fila);
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
    const alvo = a.alvo; limparAlvo(a);
    a.it.raiz.classList.remove('el-arrastado'); document.body.classList.remove('el-arrastando');
    if (!a.on) return;
    if (guardar && alvo) { levar(a, alvo); return; }                                  // soltou em outra área
    const mudou = a.fila.some((it, i) => it !== a.antes[i]);
    if (!guardar) { if (mudou) { Roteador.reaplicar(); marcarAreas(); } return; }                       // cancelou: volta como estava (reaplicar relê a configuração)
    if (!mudou) return;                                     // soltou onde estava: nada a gravar
    a.fila.forEach((it, i) => Containers.ajustar(it.id, { ordem: i + 1 }));          // 1..n dos containers da área
    Roteador.reaplicar(); marcarAreas();
  }

  // leva o bloco para outra área: grava o layout e a posição dele, e renumera (1..n) as duas áreas
  function levar(a, alvo) {
    const id = alvo.area.dataset.layout, nova = alvo.fila.slice();
    nova.splice(alvo.idx, 0, a.it);
    nova.forEach((it, i) => Containers.ajustar(it.id, it === a.it ? { layout: id, ordem: i + 1, col: null, lin: null } : { ordem: i + 1 }));   // col/lin: posição de grade do layout antigo não vale no novo
    a.fila.filter(it => it !== a.it).forEach((it, i) => Containers.ajustar(it.id, { ordem: i + 1 }));
    Roteador.reaplicar(); marcarAreas(); PainelLayout.atualizar();
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