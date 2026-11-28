/* Configurações: seções que UMA PÁGINA registra dentro do diálogo de Configurações (#btn-config).
   A seção só aparece quando essa página está aberta e leva a marca "da página X" no título, para ficar claro a quem ela vale.

   Uso mais simples: no js/paginas.js, na página, a lista "configuracoes":
     { id: 'grade', titulo: 'Grade', ..., configuracoes: [
         { id: 'dados', titulo: 'Dados e backup', alvo: '#pg-grade .pl-dados' },       // leva um bloco que já está no index.html (ids e botões continuam iguais)
         { id: 'extra', titulo: 'Outra seção', montar: corpo => { corpo.append(Util.h('p', 'dica', 'texto')); } }   // ou monta na hora
     ] }
   Campos de cada seção:
     id       identificador (único na página)
     titulo   o que aparece na tela
     alvo     (opcional) seletor do bloco que vai para dentro da seção; se for um <details>, entra só o conteúdo dele (.cx-corpo)
     montar   (opcional) função(corpo) que preenche a seção
     aberta   (opcional) true = a seção começa aberta
   Também dá para chamar direto: Configuracoes.secao({ pagina: 'id-da-pagina', paginaTitulo: 'Nome', id, titulo, alvo | montar }).
   Carregue antes de paginas.js (depois de util.js). A seção aparece/some sozinha ao trocar de página (evento 'pagina-mudou' do Roteador). */
const Configuracoes = (() => {
  const h = Util.h, secoes = [];

  const lugar = () => document.querySelector('#dlg-config .config');

  // mostra só as seções da página aberta (seção sem página aparece sempre)
  function atualizar() {
    const pg = typeof Roteador !== 'undefined' ? Roteador.atual() : null;
    secoes.forEach(s => { s.el.hidden = !!s.pagina && s.pagina !== pg; });
  }

  // leva o conteúdo de um bloco do index.html para a seção (os elementos são MOVIDOS, não copiados: ids e botões continuam funcionando)
  function levar(alvo, corpo) {
    const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    if (!el) throw new Error('não achei ' + alvo + ' no index.html');
    const fonte = el.querySelector(':scope > .cx-corpo') || el;
    [...fonte.childNodes].forEach(n => corpo.append(n));
    el.remove();
  }

  function secao(def) {
    const raiz = lugar();
    if (!raiz) throw new Error('não achei as Configurações (#dlg-config .config)');
    const sid = (def.pagina ? def.pagina + ':' : '') + def.id;
    if (secoes.some(s => s.sid === sid)) return;                     // já registrada
    const el = h('details', 'sh cfg-secao'); el.dataset.secao = sid;
    if (def.aberta) el.open = true;
    const resumo = h('summary'); resumo.append(def.titulo || def.id);
    if (def.pagina) resumo.append(h('small', 'cfg-pag', ' · da página ' + (def.paginaTitulo || def.pagina)));
    const corpo = h('div', 'cx-corpo');
    el.append(resumo, corpo);
    if (def.alvo) levar(def.alvo, corpo);
    if (typeof def.montar === 'function') def.montar(corpo);
    const antes = raiz.querySelector('#av-det');                      // fica antes de "Avançado"
    if (antes) raiz.insertBefore(el, antes); else raiz.append(el);
    secoes.push({ sid, pagina: def.pagina || null, el });
    atualizar();
  }

  document.addEventListener('pagina-mudou', atualizar);
  return { secao, atualizar };
})();