/* Roteador: as páginas e o menu do site, montados a partir de PAGINAS (js/paginas.js).
   Cada página é um objeto:
     { id: 'pomodoro', titulo: 'Pomodoro', fixa: 'pg-pomo', containers: [ ...blocos... ] }
   - fixa: o id de uma página que já existe escrita no index.html (um "módulo fixo", como o Pomodoro e a Grade).
           Sem "fixa", a página é criada aqui, vazia, só com os containers dela.
   - ligado: false   a página some do menu e da tela, sem apagar nada.
   - larga: true     a página usa a largura grande (a Grade usa).
   - destino         (opcional) onde os containers entram dentro da página; o padrão é ".painel-estudo".
   - layout: { tipo, espaco }   como os containers se distribuem na página (o desenho está em css/layout.css):
        tipo   'coluna' (1 coluna, o padrão) | 'duas' | 'tres' | 'lateral' (coluna estreita de 22rem + o resto)
        espaco multiplicador do espaço entre os blocos (1 = normal, 0.5 = metade, 2 = dobro); soma-se ao ajuste geral de Aparência
     Em cada container: ordem (a posição dele; o padrão é a posição na lista) e ocupa (quantas colunas ocupa; o padrão é 1).
     Abaixo de 72rem (celular e tablet) tudo vira uma coluna só, seguindo a ordem.
     Mudou algum desses valores com Containers.ajustar(...)? Chame Roteador.reaplicar() para a tela refletir.
   O endereço da página é o #id (ex.: #grade). Sem endereço conhecido, abre a primeira página.
   Botões da barra da página (o [data-acoes] do index.html; nas páginas criadas aqui a barra nasce sozinha). Duas origens:
     - de um CONTAINER: ele devolve  acoes: [{ rotulo, dica, fazer }]  (nenhum container usa isso hoje);
     - da PÁGINA (não é de um container): quem quiser chama  Roteador.acaoDePagina(info => acao | nada)  antes do iniciar().
       A função roda uma vez por página montada e recebe  info = { id, el, destino, itens: [{ id, raiz }] }  (só os containers ligados);
       devolve  { rotulo, dica, fazer, botao, canto, icone }  para ganhar um botão naquela página, ou nada. "botao" (opcional) recebe o botão criado.
       Com  canto: true  o botão vai para o canto do site (o [data-cantos] do index.html, ao lado da engrenagem) em vez da barra da página;
       "icone" (um <svg> escrito no código) o deixa só com o símbolo, e "rotulo"/"dica" viram o aria-label e a dica (title).
       Botões de canto são um por página, mas só o da página aberta aparece.
       Exemplo: o js/core/editor-layout.js ("Editar layout"). Os botões de containers vêm primeiro, depois os de página.
   Carregue depois de util.js e containers.js; quem chama Roteador.iniciar(PAGINAS) é o js/paginas.js, por último. */
const Roteador = (() => {
  const h = Util.h;
  const ID_OK = /^[a-z0-9_-]+$/i;
  // os tipos de grid (n = número de colunas; colunas = o grid-template-columns usado a partir de 72rem)
  const LAYOUTS = {
    coluna:  { n: 1, colunas: 'minmax(0, 1fr)' },
    duas:    { n: 2, colunas: 'repeat(2, minmax(0, 1fr))' },
    tres:    { n: 3, colunas: 'repeat(3, minmax(0, 1fr))' },
    lateral: { n: 2, colunas: '22rem minmax(0, 1fr)' }
  };
  const montadas = [];        // por página: { p, destino, itens: [{ inst, def, pos }] }, para o reaplicar()
  const provedores = [];      // funções que oferecem botões da PÁGINA à barra (ver acaoDePagina)
  let ligadas = [];           // páginas que existem agora, na ordem do menu
  const els = {};             // id da página -> elemento
  let atualId = null;

  const idDaHash = () => { const k = location.hash.replace(/^#/, ''); return ligadas.some(p => p.id === k) ? k : (ligadas[0] ? ligadas[0].id : null); };
  const visivel = id => atualId === id;
  const atual = () => atualId;

  function mostrar() {
    atualId = idDaHash();
    ligadas.forEach(p => { els[p.id].hidden = p.id !== atualId; });
    const pg = ligadas.find(p => p.id === atualId);
    document.querySelector('main').classList.toggle('larga', !!(pg && pg.larga));
    document.querySelectorAll('[data-cantos] [data-pg]').forEach(b => { b.hidden = b.dataset.pg !== atualId; });   // botões de canto: só o da página aberta
    document.querySelectorAll('.abas button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pg === atualId)));
    Containers.paginaMudou();                 // avisa os containers: quem ficou visível se atualiza
  }

  // escolhe o tipo de grid da página e o espaço entre os blocos (só escreve as variáveis; o desenho está em css/layout.css)
  function aplicarLayout(p, destino) {
    const l = Object.assign({ tipo: 'coluna', espaco: 1 }, p.layout);
    let modelo = LAYOUTS[l.tipo];
    if (!modelo) { console.error('página "' + p.id + '": layout desconhecido "' + l.tipo + '" (use: ' + Object.keys(LAYOUTS).join(', ') + ')'); modelo = LAYOUTS.coluna; }
    const esp = Number(l.espaco);
    destino.style.setProperty('--ct-colunas', modelo.colunas);
    destino.style.setProperty('--ct-espaco', String(Number.isFinite(esp) ? Math.min(5, Math.max(0, esp)) : 1));
    return modelo;
  }

  // ordem e largura (em colunas) de um bloco; o que foi ajustado com Containers.ajustar vale mais que o de paginas.js
  function posicionar(it, modelo) {
    const d = Containers.def(it.def.id), ordem = Number(d.ordem), ocupa = Math.round(Number(d.ocupa));
    it.inst.raiz.style.order = String(Number.isFinite(ordem) ? ordem : it.pos);
    it.inst.raiz.style.setProperty('--ct-ocupa', String(Math.min(modelo.n, Math.max(1, Number.isFinite(ocupa) ? ocupa : 1))));
  }

  // refaz layout, ordem e largura de todas as páginas (use depois de mudar algo com Containers.ajustar)
  function reaplicar() { montadas.forEach(m => { const modelo = aplicarLayout(m.p, m.destino); m.itens.forEach(it => posicionar(it, modelo)); }); }

  // botões da barra da página, ou do canto do site (canto: true); ver o comentário do topo
  function colocarAcoes(el, acoes, pid) {
    if (!acoes.length) return;
    const canto = document.querySelector('[data-cantos]');
    let slot = null;
    acoes.forEach(a => {
      const noCanto = !!(a.canto && canto);
      if (!noCanto && !slot) {
        slot = el.querySelector('[data-acoes]');
        if (!slot) { const barra = h('div', 'barra'); slot = h('div', 'barra-dir'); barra.append(slot); el.prepend(barra); }
      }
      const b = h('button', a.icone ? 'canto-btn' : null, a.icone ? null : a.rotulo); b.type = 'button';
      if (a.icone) { b.innerHTML = a.icone; b.setAttribute('aria-label', a.rotulo); }        // o ícone é texto fixo do código
      if (a.dica || a.icone) b.title = a.dica || a.rotulo;
      b.onclick = a.fazer;
      if (noCanto) { b.dataset.pg = pid; b.hidden = pid !== atualId; canto.append(b); } else slot.append(b);
      if (a.botao) a.botao(b);
    });
  }

  // registra quem oferece um botão da PÁGINA (não de um container); ver o comentário do topo
  const acaoDePagina = fn => { provedores.push(fn); };

  // opcoes.herdar: { idDoContainer: configuração antiga (ou função que devolve) }, usada só na 1ª vez
  function iniciar(paginas, opcoes = {}) {
    const main = document.querySelector('main'), nav = document.querySelector('.abas');
    nav.replaceChildren(); ligadas = [];
    paginas.forEach(p => {
      if (!ID_OK.test(p.id || '')) { console.error('página sem id válido (use letras, números, - ou _):', p); return; }
      let el = p.fixa ? document.getElementById(p.fixa) : null;
      if (p.fixa && !el) { console.error('página "' + p.id + '": não achei #' + p.fixa + ' no index.html'); return; }
      if (p.ligado === false) { if (el) el.hidden = true; return; }              // desligada: some, sem apagar nada
      if (!el) { el = h('div'); el.id = 'pg-' + p.id; el.hidden = true; el.append(h('div', 'painel-estudo')); main.append(el); }
      els[p.id] = el; ligadas.push(p);
      const b = h('button', null, p.titulo || p.id); b.type = 'button'; b.dataset.pg = p.id; b.setAttribute('aria-pressed', 'false');
      b.onclick = () => { location.hash = p.id; };
      nav.append(b);
    });
    mostrar();                                // decide a página de agora ANTES de montar os containers (eles perguntam se estão visíveis)

    const destinoDe = p => els[p.id].querySelector(p.destino || '.painel-estudo');
    montadas.length = 0;
    ligadas.forEach(p => {
      const acoes = [], lista = p.containers || [];
      if (!lista.length) return;
      const destino = destinoDe(p);
      if (!destino) { console.error('página "' + p.id + '": não achei o destino ' + (p.destino || '.painel-estudo') + ' para os containers'); return; }
      const modelo = aplicarLayout(p, destino), reg = { p, destino, itens: [] };
      lista.forEach((def, i) => {
        const velho = opcoes.herdar && opcoes.herdar[def.id];
        const inst = Containers.montar(def, destino, { visivel: () => visivel(p.id), herdar: typeof velho === 'function' ? velho() : velho });
        if (!inst) return;
        const it = { inst, def, pos: i + 1 }; reg.itens.push(it); posicionar(it, modelo);
        if (inst.acoes) acoes.push(...inst.acoes);
      });
      montadas.push(reg);
      const info = { id: p.id, el: els[p.id], destino, itens: reg.itens.map(it => ({ id: it.def.id, raiz: it.inst.raiz })) };
      provedores.forEach(fn => { try { const a = fn(info); if (a) acoes.push(a); } catch (err) { console.error('botão de página falhou (' + p.id + '):', err); } });
      colocarAcoes(els[p.id], acoes, p.id);
    });

    window.addEventListener('hashchange', mostrar);
  }

  return { iniciar, visivel, atual, reaplicar, acaoDePagina };
})();