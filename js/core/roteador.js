/* Roteador: as páginas e o menu do site, montados a partir de PAGINAS (js/paginas.js).
   Cada página é um objeto:
     { id: 'pomodoro', titulo: 'Pomodoro', fixa: 'pg-pomo', containers: [ ...blocos... ] }
   - fixa: o id de uma página que já existe escrita no index.html (um "módulo fixo", como o Pomodoro e a Grade).
           Sem "fixa", a página é criada aqui, vazia, só com os containers dela.
   - ligado: false   a página some do menu e da tela, sem apagar nada.
   - configuracoes: [ { id, titulo, alvo | montar } ]   seções próprias da página dentro das Configurações (#btn-config); só aparecem com a página aberta (ver js/core/configuracoes.js).
   - larga: true     a página usa a largura grande (a Grade usa).
   - destino         (opcional) onde os containers entram dentro da página; o padrão é ".painel-estudo".
   - layouts: [ { id, tipo, espaco, largura } ]   as ÁREAS da página, de cima para baixo. Cada container pertence a uma (campo "layout" dele).
        id       identificador interno da área (letras, números, - ou _); não aparece na tela e não muda
        nome     (opcional) o nome que você vê na tela; livre (espaços e acentos valem). Sem nome, aparece o id. Muda-se no Painel de layouts
        tipo     'coluna' (1 coluna, o padrão) | 'duas' | 'tres' | 'quatro' | 'cinco' | 'seis' | 'lateral' (coluna estreita de 22rem + o resto)
        espaco   multiplicador do espaço entre os blocos DENTRO da área (1 = normal, 0.5 = metade, 2 = dobro); soma-se ao ajuste geral de Aparência
        largura  'ampla' (o padrão: largura grande a partir de 72rem) | 'normal' (a largura do site)
        pilha    (só em 'lateral' e 'duas', a partir de 72rem) quantos blocos ficam EMPILHADOS na 1ª coluna (1 = nenhum, o padrão); o bloco seguinte
                 ocupa a 2ª coluna na altura da pilha e os outros vêm embaixo dele. Ex.: pilha 2 = calendário e agenda na coluna estreita, gráficos ao lado
        coluna1  (só em 'lateral') largura da 1ª coluna, em rem (padrão 22)
        colunas  GRADE LIVRE (opcional; se existir, vale no lugar de tipo, pilha e coluna1): lista com o tamanho de cada coluna, até 12.
                 Número = parte do espaço que sobra (1, 2...: 2 é o dobro de 1); texto com unidade = tamanho fixo ('22rem', '300px', '30%', '1.5fr').
                 Ex.: colunas: ['22rem', 1] = coluna estreita fixa + o resto;  colunas: [1, 1, 1] = três iguais
        linhas   (só com colunas) lista com a altura de cada linha, até 24: 'auto' (a do conteúdo, o padrão), número (parte do que sobra) ou '12rem' / '200px' (altura MÍNIMA).
                 Linhas que faltam são 'auto'. Ex.: linhas: ['auto', 1]
   - Na GRADE LIVRE cada container pode dizer onde fica:  col (coluna onde começa, 1...), lin (linha onde começa, 1...), ocupa (quantas colunas) e
     ocupaLin (quantas linhas; padrão 1). Sem col/lin ele entra no primeiro espaço livre, seguindo a ordem. Dois blocos no mesmo espaço se sobrepõem: cuide para não repetir.
     Abaixo de 72rem a grade livre vira uma coluna só, na ordem do campo "ordem" de cada container (a mesma de antes). Roteador.modelo(idDaPágina, idDoLayout) devolve a grade de qualquer layout
     (os antigos são convertidos para colunas, linhas e posições; o resultado desenha igual), e é por ele que o editor visual (js/core/editor-grade.js) trabalha.
     Roteador.cssTrilhas(colunas, linhas) devolve o CSS dessas listas ({ colunas, linhas }), para mostrar o resultado ao vivo.
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
    quatro:  { n: 4, colunas: 'repeat(4, minmax(0, 1fr))' },
    cinco:   { n: 5, colunas: 'repeat(5, minmax(0, 1fr))' },
    seis:    { n: 6, colunas: 'repeat(6, minmax(0, 1fr))' },
    lateral: { n: 2, colunas: '22rem minmax(0, 1fr)' }
  };
  // grade livre: tamanho das trilhas (colunas e linhas) escritos em CSS; valor inválido vira o padrão
  const UNID = /^\d+(\.\d+)?(rem|px|%|fr)$/, ALTURA = /^\d+(\.\d+)?(rem|px)$/;
  const MAX_COL = 12, MAX_LIN = 24;
  const livre = l => Array.isArray(l.colunas) && l.colunas.length > 0;
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
    Util.avisar('pagina-mudou');              // avisa o resto do site (ex.: as seções das Configurações que valem só para uma página)
  }

  const limitar = (v, min, max, padrao) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };

  // as áreas de uma página: o que foi ajustado na tela (Armazém) vale mais que o paginas.js; sem "layouts", o "layout" antigo vira a área "principal"
  function layoutsDe(p) {
    const aj = ajustesPag[p.id] || {};
    const lista = Array.isArray(aj.layouts) && aj.layouts.length ? aj.layouts : (Array.isArray(p.layouts) && p.layouts.length ? p.layouts : [Object.assign({ id: 'principal' }, p.layout)]);
    const vistos = new Set();
    const ok = lista.filter(l => l && ID_OK.test(l.id || '') && !vistos.has(l.id) && vistos.add(l.id));
    return (ok.length ? ok : [{ id: 'principal' }]).map(l => Object.assign({ tipo: 'coluna', espaco: 1, largura: 'ampla', pilha: 1, coluna1: 22 }, l));
  }
  const entreDe = p => { const aj = ajustesPag[p.id] || {}; return limitar(aj.entre != null ? aj.entre : p.entre, 0, 5, 1); };

  const colCss = v => (typeof v === 'number' ? 'minmax(0, ' + limitar(v, .1, 20, 1) + 'fr)' : UNID.test(String(v)) ? (/fr$/.test(v) ? 'minmax(0, ' + v + ')' : String(v)) : 'minmax(0, 1fr)');
  const linCss = v => (typeof v === 'number' ? 'minmax(0, ' + limitar(v, .1, 20, 1) + 'fr)' : ALTURA.test(String(v)) ? 'minmax(' + v + ', auto)' : 'auto');
  const inteiro = (v, min, max) => { const n = Math.round(Number(v)); return v != null && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };   // null = não definido
  const nColunas = (l, p) => (livre(l) ? Math.min(MAX_COL, l.colunas.length) : modeloDe(l, p).n);

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
      if (livre(l)) {
        el.style.setProperty('--ct-colunas', l.colunas.slice(0, MAX_COL).map(colCss).join(' '));
        if (Array.isArray(l.linhas) && l.linhas.length) el.style.setProperty('--ct-linhas', l.linhas.slice(0, MAX_LIN).map(linCss).join(' ')); else el.style.removeProperty('--ct-linhas');
      } else {
        el.style.setProperty('--ct-colunas', l.tipo === 'lateral' ? limitar(l.coluna1, 14, 44, 22) + 'rem minmax(0, 1fr)' : modeloDe(l, reg.p).colunas);
        el.style.removeProperty('--ct-linhas');
      }
      el.classList.toggle('livre', livre(l));
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
    const am = /^\d+(\.\d+)?(rem|px)$/.exec(String(d.alturaMin || ''));          // altura mínima do bloco ('12rem' | '200px'); sem ela, o bloco tem a altura do conteúdo
    if (am) raiz.style.setProperty('--ct-alt-min', d.alturaMin); else raiz.style.removeProperty('--ct-alt-min');
    const n = nColunas(l, reg.p), col = livre(l) ? inteiro(d.col, 1, n) : null;
    raiz.style.setProperty('--ct-ocupa', String(Math.min(col ? n - col + 1 : n, Math.max(1, Number.isFinite(ocupa) ? ocupa : 1))));
    if (livre(l)) {                                                    // grade livre: onde começa e quantas linhas ocupa (só nela; no modo antigo nada disto é escrito)
      const lin = inteiro(d.lin, 1, MAX_LIN);
      if (col) raiz.style.setProperty('--ct-gc', String(col)); else raiz.style.removeProperty('--ct-gc');
      if (lin) raiz.style.setProperty('--ct-gr', String(lin)); else raiz.style.removeProperty('--ct-gr');
      raiz.style.setProperty('--ct-ocupa-lin', String(inteiro(d.ocupaLin, 1, MAX_LIN) || 1));
    } else ['--ct-gc', '--ct-gr', '--ct-ocupa-lin'].forEach(v => raiz.style.removeProperty(v));
  }

  // "pilha": os primeiros N blocos de uma área de 2 colunas ficam empilhados na 1ª coluna; o seguinte ocupa a 2ª coluna na altura da pilha.
  // Só escreve variáveis (--ct-col, --ct-row, --ct-lin e --ct-molde); o desenho está em css/layout.css (a partir de 72rem).
  function empilhar(reg) {
    const ordem = it => Number(it.raiz.style.order) || 0;
    reg.ls.forEach(l => {
      const area = reg.areas.get(l.id), n = Math.round(limitar(l.pilha, 1, 6, 1)), vale = n > 1 && !livre(l) && modeloDe(l, reg.p).n === 2;
      const filhos = reg.itens.map(it => it.inst.raiz).filter(r => r.parentNode === area).sort((a, b) => ordem({ raiz: a }) - ordem({ raiz: b }));
      area.classList.toggle('empilha', vale);
      if (vale) area.style.setProperty('--ct-molde', Array(n - 1).fill('auto').concat('minmax(0, 1fr)').join(' ')); else area.style.removeProperty('--ct-molde');
      filhos.forEach((r, i) => {
        ['--ct-col', '--ct-row', '--ct-lin'].forEach(v => r.style.removeProperty(v));
        if (!vale) return;
        r.style.setProperty('--ct-col', i < n ? '1' : '2');
        if (i === n) { r.style.setProperty('--ct-row', '1'); r.style.setProperty('--ct-lin', String(n)); }
      });
    });
  }
  const empilharTudo = () => montadas.forEach(empilhar);          // o editor chama enquanto você arrasta (a ordem muda ao vivo)

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
    montadas.forEach(m => { montarAreas(m); m.itens.forEach(it => posicionar(it, m)); acabar(m); estilizar(m); empilhar(m); });
  }

  // ajusta as áreas de uma página pela tela: campos = { layouts: [...], entre: n }; guarda (navegador + Sheets) e redesenha
  function ajustarPagina(id, campos) {
    ajustesPag[id] = Object.assign({}, ajustesPag[id], campos); salvarPag(); reaplicar();
  }
  // as áreas de agora de uma página e o espaço entre elas (cópia): { layouts: [{ id, nome, tipo, espaco, largura }], entre }
  function layouts(id) {
    const p = ligadas.find(x => x.id === id);
    return p ? { layouts: layoutsDe(p).map(l => Object.assign({}, l)), entre: entreDe(p) } : null;
  }

  // a grade de um layout, pronta para o editor: { livre, colunas, linhas, blocos: [{ id, col, lin, ocupa, ocupaLin }] }.
  // Layout antigo (tipo/pilha/coluna1) é CONVERTIDO aqui, sem guardar nada: o resultado desenha igual ao que está na tela.
  function modelo(pid, lid) {
    const reg = montadas.find(m => m.p.id === pid), l = reg && reg.ls.find(x => x.id === lid);
    if (!l) return null;
    const ordem = it => Number(it.inst.raiz.style.order) || 0, area = reg.areas.get(l.id);
    const itens = reg.itens.filter(it => it.inst.raiz.parentNode === area).sort((a, b) => ordem(a) - ordem(b));
    const dados = it => Containers.def(it.def.id);
    if (livre(l)) {
      const n = nColunas(l, reg.p);
      return { livre: true, colunas: l.colunas.slice(0, MAX_COL), linhas: (l.linhas || []).slice(0, MAX_LIN), blocos: itens.map(it => {
        const d = dados(it), col = inteiro(d.col, 1, n);
        return { id: it.def.id, col, lin: inteiro(d.lin, 1, MAX_LIN), ocupa: Math.min(col ? n - col + 1 : n, inteiro(d.ocupa, 1, n) || 1), ocupaLin: inteiro(d.ocupaLin, 1, MAX_LIN) || 1 };
      }) };
    }
    const n = modeloDe(l, reg.p).n, pn = Math.round(limitar(l.pilha, 1, 6, 1)), pilha = pn > 1 && n === 2;
    const colunas = l.tipo === 'lateral' ? [limitar(l.coluna1, 14, 44, 22) + 'rem', 1] : Array(n).fill(1);
    const linhas = pilha ? Array(pn - 1).fill('auto').concat([1]) : [];
    let r = 1, c = 1;                                                 // o mesmo caminho do CSS: da esquerda para a direita, quebrando a linha quando não cabe
    const blocos = itens.map((it, i) => {
      const o = inteiro(dados(it).ocupa, 1, n) || 1;
      if (pilha) return i < pn ? { id: it.def.id, col: 1, lin: i + 1, ocupa: 1, ocupaLin: 1 }
        : { id: it.def.id, col: 2, lin: i === pn ? 1 : i, ocupa: 1, ocupaLin: i === pn ? pn : 1 };
      if (c + o - 1 > n) { r++; c = 1; }
      const b = { id: it.def.id, col: c, lin: r, ocupa: o, ocupaLin: 1 };
      c += o; if (c > n) { r++; c = 1; }
      return b;
    });
    return { livre: false, colunas, linhas, blocos };
  }

  // o CSS das trilhas de uma grade ({ colunas, linhas }); o editor de grade usa para mostrar o resultado ao vivo, antes de guardar
  const cssTrilhas = (colunas, linhas) => ({ colunas: colunas.slice(0, MAX_COL).map(colCss).join(' '), linhas: Array.isArray(linhas) && linhas.length ? linhas.slice(0, MAX_LIN).map(linCss).join(' ') : null });

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
      acabar(reg); estilizar(reg); empilhar(reg);
      montadas.push(reg);
      const info = { id: p.id, el: els[p.id], destino, itens: reg.itens.map(it => ({ id: it.def.id, raiz: it.inst.raiz })) };
      provedores.forEach(fn => { try { const a = fn(info); if (a) acoes.push(a); } catch (err) { console.error('botão de página falhou (' + p.id + '):', err); } });
      colocarAcoes(els[p.id], acoes, p.id);
    });

    // seções que a página registra nas Configurações (campo "configuracoes" da página; ver js/core/configuracoes.js)
    ligadas.forEach(p => (p.configuracoes || []).forEach(s => {
      try { Configuracoes.secao(Object.assign({}, s, { pagina: p.id, paginaTitulo: p.titulo || p.id })); }
      catch (err) { console.error('seção de Configurações falhou (' + p.id + '/' + (s && s.id) + '):', err); }
    }));

    window.addEventListener('hashchange', mostrar);
  }

  return { iniciar, visivel, atual, reaplicar, acaoDePagina, ajustarPagina, layouts, modelo, cssTrilhas, limparAjustes, empilhar: empilharTudo };
})();