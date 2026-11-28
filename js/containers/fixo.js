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
   Não tem painel de configuração: o que dá para ajustar é só o lugar dele (layout, ordem, ocupa).
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
  return { raiz };
});