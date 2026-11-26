/* Roteador: as páginas e o menu do site, montados a partir de PAGINAS (js/paginas.js).
   Cada página é um objeto:
     { id: 'pomodoro', titulo: 'Pomodoro', fixa: 'pg-pomo', containers: [ ...blocos... ] }
   - fixa: o id de uma página que já existe escrita no index.html (um "módulo fixo", como o Pomodoro e a Grade).
           Sem "fixa", a página é criada aqui, vazia, só com os containers dela.
   - ligado: false   a página some do menu e da tela, sem apagar nada.
   - larga: true     a página usa a largura grande (a Grade usa).
   - destino         (opcional) onde os containers entram dentro da página; o padrão é ".painel-estudo".
   - layouts: [ { id, tipo, espaco, largura } ]   as ÁREAS da página, de cima para baixo. Cada container pertence a uma (campo "layout" dele).
        id       nome da área (letras, números, - ou _)
        tipo     'coluna' (1 coluna, o padrão) | 'duas' | 'tres' | 'lateral' (coluna estreita de 22rem + o resto)
        espaco   multiplicador do espaço entre os blocos DENTRO da área (1 = normal, 0.5 = metade, 2 = dobro); soma-se ao ajuste geral de Aparência
        largura  'ampla' (o padrão: largura grande a partir de 72rem) | 'normal' (a largura do site)
   - entre: multiplicador do espaço ENTRE uma área e a outra (1 = normal; o padrão). Soma-se ao ajuste geral de Aparência.
   - layout: { tipo, espaco }   atalho antigo: vale como uma única área chamada "principal" (o que já funcionava continua igual).
   - Os ajustes feitos pela tela ficam no Armazém, na chave "paginas": { idDaPagina: { layouts: [...], entre } }; valem mais que o paginas.js.
     Container: ordem (a posição dele DENTRO da área; o padrão é a posição na lista), ocupa (quantas colunas ocupa; o padrão é 1)
                e layout (o id da área; se faltar ou não existir, vai para a primeira).
     Abaixo de 72rem (celular e tablet) cada área vira uma coluna só, seguindo a ordem.
     Mudou algum desses valores com Containers.ajustar(...) ou Roteador.ajustarPagina(...)? Chame Roteador.reaplicar() (ajustarPagina já chama).
     Roteador.layouts(id) devolve as áreas de agora ({ layouts, entre }); Roteador.limparAjustes() apaga os ajustes feitos pela tela. A tela que mexe nisso é js/core/painel-layout.js.
     Cada área é um <div class="ct-area"> dentro do destino da página; se a página não tiver o destino, o roteador cria um .painel-estudo.
     Containers do tipo "fixo" (js/containers/fixo.js) levam um bloco que já está escrito no index.html (o timer e as sessões, a grade) para dentro de uma área.
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
  const CHAVE = 'paginas';    // nome dos ajustes de páginas no Armazém (navegador + Sheets): { idDaPagina: { layouts, entre } }
  const ajustesPag = Armazem.obter(CHAVE, {});
  const salvarPag = () => Armazem.guardar(CHAVE, ajustesPag);
  Armazem.usar(CHAVE, () => {   // chegou uma versão mais nova de outro aparelho: atualiza aqui dentro e avisa a tela (ela oferece "Recarregar")
    const novo = Armazem.obter(CHAVE, {});
    Object.keys(ajustesPag).forEach(k => { delete ajustesPag[k]; }); Object.assign(ajustesPag, novo);
    Util.avisar('configuracao-recebida');
  });
  const montadas = [];        // por página: { p, destino, areas: Map(id -> elemento), ls: [layouts], itens: [{ inst, def, pos }] }, para o reaplicar()
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

  const limitar = (v, min, max, padrao) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };

  // as áreas de uma página: o que foi ajustado na tela (Armazém) vale mais que o paginas.js; sem "layouts", o "layout" antigo vira a área "principal"
  function layoutsDe(p) {
    const aj = ajustesPag[p.id] || {};
    const lista = Array.isArray(aj.layouts) && aj.layouts.length ? aj.layouts : (Array.isArray(p.layouts) && p.layouts.length ? p.layouts : [Object.assign({ id: 'principal' }, p.layout)]);
    const vistos = new Set();
    const ok = lista.filter(l => l && ID_OK.test(l.id || '') && !vistos.has(l.id) && vistos.add(l.id));
    return (ok.length ? ok : [{ id: 'principal' }]).map(l => Object.assign({ tipo: 'coluna', espaco: 1, largura: 'ampla' }, l));
  }
  const entreDe = p => { const aj = ajustesPag[p.id] || {}; return limitar(aj.entre != null ? aj.entre : p.entre, 0, 5, 1); };

  function modeloDe(l, p) {
    const m = LAYOUTS[l.tipo];
    if (m) return m;
    console.error('página "' + p.id + '", área "' + l.id + '": layout desconhecido "' + l.tipo + '" (use: ' + Object.keys(LAYOUTS).join(', ') + ')');
    return LAYOUTS.coluna;
  }

  // cria/ordena as áreas (um <div class="ct-area"> por layout) dentro do destino; não mexe no que já está no lugar
  function montarAreas(reg) {
    reg.ls = layoutsDe(reg.p);
    let anterior = null;
    reg.ls.forEach(l => {
      let el = reg.areas.get(l.id);
      if (!el) { el = h('div', 'ct-area'); el.dataset.layout = l.id; reg.areas.set(l.id, el); }
      const quer = anterior ? anterior.nextSibling : reg.destino.firstChild;
      if (el !== quer) reg.destino.insertBefore(el, quer);
      anterior = el;
    });
  }

  // escolhe o tipo de grid e o espaço de cada área, e o espaço entre elas (só escreve as variáveis; o desenho está em css/layout.css)
  function estilizar(reg) {
    reg.ls.forEach(l => {
      const el = reg.areas.get(l.id);
      el.style.setProperty('--ct-colunas', modeloDe(l, reg.p).colunas);
      el.style.setProperty('--ct-espaco', String(limitar(l.espaco, 0, 5, 1)));
      el.classList.toggle('ampla', l.largura !== 'normal');
    });
    reg.destino.style.setProperty('--ct-entre', String(entreDe(reg.p)));
  }

  // ordem, largura (em colunas) e área de um bloco; o que foi ajustado com Containers.ajustar vale mais que o de paginas.js
  function posicionar(it, reg) {
    const d = Containers.def(it.def.id), ordem = Number(d.ordem), ocupa = Math.round(Number(d.ocupa));
    const l = reg.ls.find(x => x.id === d.layout) || reg.ls[0], area = reg.areas.get(l.id), raiz = it.inst.raiz;
    if (raiz.parentNode !== area) area.append(raiz);                    // outro layout: leva o bloco para lá
    raiz.style.order = String(Number.isFinite(ordem) ? ordem : it.pos);
    raiz.style.setProperty('--ct-ocupa', String(Math.min(modeloDe(l, reg.p).n, Math.max(1, Number.isFinite(ocupa) ? ocupa : 1))));
  }

  // área vazia some (senão o espaço entre áreas ficaria sobrando); sem espaço no topo quando a página começa por um bloco fixo (o timer)
  function acabar(reg) {
    reg.areas.forEach((el, id) => { if (!reg.ls.some(l => l.id === id)) { el.remove(); reg.areas.delete(id); } });
    reg.areas.forEach(el => { el.hidden = !el.children.length; });
    const primeira = reg.ls.map(l => reg.areas.get(l.id)).find(el => !el.hidden);
    const ordem = it => Number(it.inst.raiz.style.order) || 0;
    const primeiro = primeira && reg.itens.filter(it => it.inst.raiz.parentNode === primeira).sort((a, b) => ordem(a) - ordem(b))[0];
    reg.destino.style.setProperty('--ct-topo', primeiro && primeiro.def.tipo === 'fixo' ? '0' : '1');
  }

  // refaz áreas, ordem e largura de todas as páginas (use depois de mudar algo com Containers.ajustar)
  function reaplicar() {
    montadas.forEach(m => { montarAreas(m); m.itens.forEach(it => posicionar(it, m)); acabar(m); estilizar(m); });
  }

  // ajusta as áreas de uma página pela tela: campos = { layouts: [...], entre: n }; guarda (navegador + Sheets) e redesenha
  function ajustarPagina(id, campos) {
    ajustesPag[id] = Object.assign({}, ajustesPag[id], campos); salvarPag(); reaplicar();
  }
  // as áreas de agora de uma página e o espaço entre elas (cópia): { layouts: [{ id, tipo, espaco, largura }], entre }
  function layouts(id) {
    const p = ligadas.find(x => x.id === id);
    return p ? { layouts: layoutsDe(p).map(l => Object.assign({}, l)), entre: entreDe(p) } : null;
  }

  // apaga os ajustes de layout feitos pela tela (volta ao que está em js/paginas.js); quem chama recarrega a página
  function limparAjustes() { Object.keys(ajustesPag).forEach(k => { delete ajustesPag[k]; }); salvarPag(); }

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

    // o destino dos containers; se a página não tiver, cria um (assim até as páginas fixas, como a Grade, podem ter containers)
    const destinoDe = p => {
      let d = els[p.id].querySelector(p.destino || '.painel-estudo');
      if (!d && !p.destino) { d = h('div', 'painel-estudo'); els[p.id].append(d); }
      return d;
    };
    montadas.length = 0;
    ligadas.forEach(p => {
      const acoes = [], lista = p.containers || [];
      if (!lista.length) return;
      const destino = destinoDe(p);
      if (!destino) { console.error('página "' + p.id + '": não achei o destino ' + (p.destino || '.painel-estudo') + ' para os containers'); return; }
      const reg = { p, destino, areas: new Map(), ls: [], itens: [] };
      montarAreas(reg);
      lista.forEach((def, i) => {
        const velho = opcoes.herdar && opcoes.herdar[def.id];
        const inst = Containers.montar(def, d => (reg.areas.get(d.layout) || reg.areas.get(reg.ls[0].id)), { visivel: () => visivel(p.id), herdar: typeof velho === 'function' ? velho() : velho });
        if (!inst) return;
        const it = { inst, def, pos: i + 1 }; reg.itens.push(it); posicionar(it, reg);
        if (inst.acoes) acoes.push(...inst.acoes);
      });
      acabar(reg); estilizar(reg);
      montadas.push(reg);
      const info = { id: p.id, el: els[p.id], destino, itens: reg.itens.map(it => ({ id: it.def.id, raiz: it.inst.raiz })) };
      provedores.forEach(fn => { try { const a = fn(info); if (a) acoes.push(a); } catch (err) { console.error('botão de página falhou (' + p.id + '):', err); } });
      colocarAcoes(els[p.id], acoes, p.id);
    });

    window.addEventListener('hashchange', mostrar);
  }

  return { iniciar, visivel, atual, reaplicar, acaoDePagina, ajustarPagina, layouts, limparAjustes };
})();