/* Container "fixo": leva para o sistema de layout um bloco que JÁ está escrito no index.html (o timer e as sessões, a grade).
   Ele não reescreve nada: só aponta para o elemento. Os ids e o HTML continuam iguais, então pomodoro.js, planilha.js e grade.js
   não precisam mudar. O roteador só muda o bloco de lugar (área, ordem, ocupa), como faz com qualquer container.

   Como usar (em js/paginas.js):
     { id: 'pomodoro-fixo', tipo: 'fixo', titulo: 'Timer e Sessões', alvo: '#pg-pomo > .grade', layout: 'topo', ordem: 1 }
       alvo     seletor CSS do elemento que vira o bloco (tem que existir uma vez só no index.html)
       envolver (opcional) true = o bloco vira uma caixa nova com TUDO o que está dentro do alvo (menos o .painel-estudo do roteador);
                use quando o alvo é a página inteira (a Grade). O alvo continua no lugar, só os filhos mudam de caixa.
   Não tem painel de configuração: o que dá para ajustar é só o lugar dele (layout, ordem, ocupa).
   Carregue antes de paginas.js. */
Containers.registrar('fixo', ctx => {
  const d = ctx.def();
  let raiz = d.alvo ? document.querySelector(d.alvo) : null;
  if (!raiz) throw new Error('não achei o elemento ' + d.alvo + ' no index.html');
  if (d.envolver) {
    const caixa = Util.h('div', 'ct-caixa');
    [...raiz.children].forEach(c => { if (!c.classList.contains('painel-estudo')) caixa.append(c); });
    raiz = caixa;
  }
  return { raiz };
});