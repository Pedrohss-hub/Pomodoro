/* Container "fixo": leva para o sistema de layout um bloco que JÁ está escrito no index.html (o timer e as sessões, a grade).
   Ele não reescreve nada: só aponta para o elemento. Os ids e o HTML continuam iguais, então pomodoro.js, planilha.js e grade.js
   não precisam mudar. O roteador só muda o bloco de lugar (área, ordem, ocupa), como faz com qualquer container.

   Como usar (em js/paginas.js):
     { id: 'pomodoro-fixo', tipo: 'fixo', titulo: 'Timer e Sessões', alvo: '#pg-pomo > .grade', layout: 'topo', ordem: 1 }
       alvo     seletor CSS do elemento que vira o bloco (tem que existir uma vez só no index.html)
       envolver (opcional) true = o bloco vira uma caixa nova com TUDO o que está dentro do alvo (menos o .painel-estudo do roteador);
                use quando o alvo é a página inteira (a Grade). O alvo continua no lugar, só os filhos mudam de caixa.
       exceto   (opcional, com envolver) seletor CSS (ou lista de seletores) dos filhos que NÃO entram na caixa e ficam para outro container 'fixo'.
       caixa    (opcional) true = o bloco vira uma caixa nova que leva o alvo para dentro. Use quando o alvo esconde os filhos dele (como um <details> fechado):
                as alças do editor de layout são filhos do bloco e sumiriam. Ex.: alvo '#pg-x .detalhes', caixa: true.
                Ex. de exceto: o planejador da Grade fica sozinho (exceto: '.pl-dados'); o .pl-dados vai para as Configurações (ver js/core/configuracoes.js).
   painel   (opcional) { botaoEm: 'seletor onde o ⚙ entra', secoes: [ { alvo: 'seletor da peça' } ] }  cria um ⚙ no bloco que abre um painel com essas peças
            (elas saem de onde estavam no index.html e vão para o painel; ver ligarPainel abaixo). Sem "painel", só dá para ajustar o lugar dele (layout, ordem, ocupa).
   Carregue antes de paginas.js. */
Containers.registrar('fixo', ctx => {
  const d = ctx.def();
  let raiz = d.alvo ? document.querySelector(d.alvo) : null;
  if (!raiz) throw new Error('não achei o elemento ' + d.alvo + ' no index.html');
  if (d.envolver) {
    const caixa = Util.h('div', 'ct-caixa');
    const fora = [].concat(d.exceto || []).filter(x => typeof x === 'string' && x);          // filhos que ficam de fora (outro container fixo leva)
    [...raiz.children].forEach(c => { if (!c.classList.contains('painel-estudo') && !fora.some(sel => c.matches(sel))) caixa.append(c); });
    raiz = caixa;
  }
  if (d.caixa && !d.envolver) {                                            // o alvo vai para dentro de uma caixa; a caixa é que entra no layout
    const caixa = Util.h('div', 'ct-caixa');
    caixa.append(raiz); raiz = caixa;
  }
  if (d.painel && Array.isArray(d.painel.secoes)) ligarPainel(ctx, d, raiz);
  return { raiz };
});

/* ⚙ do bloco fixo: leva peças que já existem no index.html (com ids e botões) para um painel flutuante, o mesmo dos outros containers.
   As peças ficam guardadas num <div id="cfg-guarda" hidden> quando o painel está fechado (assim os ids continuam no documento e o resto do site os acha).
   Elas são MOVIDAS, não copiadas: o que cada uma já faz continua igual. */
function ligarPainel(ctx, d, raiz) {
  let guarda = document.getElementById('cfg-guarda');
  if (!guarda) { guarda = Util.h('div'); guarda.id = 'cfg-guarda'; guarda.hidden = true; document.body.append(guarda); }
  const corpo = Util.h('div', 'cfg-corpo');
  guarda.append(corpo);
  (d.painel.secoes || []).forEach(s => {
    const el = typeof s.alvo === 'string' ? document.querySelector(s.alvo) : null;
    if (el) corpo.append(el); else console.error('painel de ' + ctx.id + ': não achei ' + s.alvo);
  });
  const onde = (d.painel.botaoEm && raiz.querySelector(d.painel.botaoEm)) || raiz;
  const b = Util.h('button', 'mini fixo-engrenagem', '⚙'); b.type = 'button';
  b.title = 'Configurar: ' + (d.titulo || ctx.id); b.setAttribute('aria-label', b.title);
  b.onclick = () => Painel.abrir({
    id: 'cfg:' + ctx.id, titulo: d.titulo || ctx.id, subtitulo: 'As mudanças valem na hora', alvo: raiz,
    campos: [{ tipo: 'custom', montar: () => corpo }], valores: () => ({}), aoMudar: () => {},
    aoFechar: () => guarda.append(corpo)
  });
  onde.append(b);
}