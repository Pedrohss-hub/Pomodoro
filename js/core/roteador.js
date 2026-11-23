/* Roteador: as páginas e o menu do site, montados a partir de PAGINAS (js/paginas.js).
   Cada página é um objeto:
     { id: 'pomodoro', titulo: 'Pomodoro', fixa: 'pg-pomo', containers: [ ...blocos... ] }
   - fixa: o id de uma página que já existe escrita no index.html (um "módulo fixo", como o Pomodoro e a Grade).
           Sem "fixa", a página é criada aqui, vazia, só com os containers dela.
   - ligado: false   a página some do menu e da tela, sem apagar nada.
   - larga: true     a página usa a largura grande (a Grade usa).
   - destino         (opcional) onde os containers entram dentro da página; o padrão é ".painel-estudo".
   O endereço da página é o #id (ex.: #grade). Sem endereço conhecido, abre a primeira página.
   Um container pode oferecer botões para a barra da página devolvendo  acoes: [{ rotulo, dica, fazer }].
   Carregue depois de util.js e containers.js; quem chama Roteador.iniciar(PAGINAS) é o js/paginas.js, por último. */
const Roteador = (() => {
  const h = Util.h;
  const ID_OK = /^[a-z0-9_-]+$/i;
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
    document.querySelectorAll('.abas button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pg === atualId)));
    Containers.paginaMudou();                 // avisa os containers: quem ficou visível se atualiza
  }

  // botões que os containers pedem para a barra da página (ex.: "Gráficos")
  function colocarAcoes(el, acoes) {
    if (!acoes.length) return;
    let slot = el.querySelector('[data-acoes]');
    if (!slot) { const barra = h('div', 'barra'); slot = h('div', 'barra-dir'); barra.append(slot); el.prepend(barra); }
    acoes.forEach(a => { const b = h('button', null, a.rotulo); b.type = 'button'; if (a.dica) b.title = a.dica; b.onclick = a.fazer; slot.append(b); });
  }

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
    ligadas.forEach(p => {
      const acoes = [];
      (p.containers || []).forEach(def => {
        const destino = destinoDe(p);
        if (!destino) { console.error('página "' + p.id + '": não achei o destino ' + (p.destino || '.painel-estudo') + ' para o container "' + def.id + '"'); return; }
        const velho = opcoes.herdar && opcoes.herdar[def.id];
        const inst = Containers.montar(def, destino, { visivel: () => visivel(p.id), herdar: typeof velho === 'function' ? velho() : velho });
        if (inst && inst.acoes) acoes.push(...inst.acoes);
      });
      colocarAcoes(els[p.id], acoes);
    });

    window.addEventListener('hashchange', mostrar);
  }

  return { iniciar, visivel, atual };
})();