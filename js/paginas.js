/* Páginas e containers do site, como DADOS. Para mudar o que aparece, mexa aqui (ou, no futuro, na planilha).
   Cada container tem um "tipo" (arquivo em js/containers/) e a configuração dele.
   Dica: "ligado: false" desliga um container sem apagar nada. */
const PAGINAS = [
  { id: 'pomodoro', titulo: 'Pomodoro', fixa: 'pg-pomo', entre: 1,
    layouts: [
      { id: 'topo', tipo: 'coluna', largura: 'normal' },                  // o timer e as Sessões, na largura do site
      { id: 'principal', tipo: 'lateral', espaco: 1, largura: 'ampla', pilha: 2, coluna1: 26 }   // coluna estreita (calendário em cima da Agenda) + Gráficos ao lado
    ],
    containers: [
      { id: 'pomodoro-fixo', tipo: 'fixo', layout: 'topo', ordem: 1, titulo: 'Timer e Sessões', alvo: '#pg-pomo > .grade' },
      { id: 'calendario', tipo: 'calendario', layout: 'principal', ordem: 1, titulo: 'Calendário' },   // usa os itens da Agenda (não lê a planilha)
      { id: 'agenda', tipo: 'agenda', layout: 'principal', ordem: 2, titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false, altura: 18 },
      { id: 'graficos', tipo: 'graficos', layout: 'principal', ordem: 3, titulo: 'Gráficos de estudo', graficos: null }   // null = lista padrão (editável no ⚙ do quadro)
    ] },
  { id: 'grade', titulo: 'Grade', fixa: 'pg-grade', larga: true,
    layouts: [ { id: 'principal', tipo: 'coluna', largura: 'normal' } ],
    containers: [
      { id: 'grade-fixo', tipo: 'fixo', layout: 'principal', ordem: 1, titulo: 'Planejador de grade', alvo: '#pg-grade', envolver: true, exceto: '.pl-dados' },   // o planejador fica sozinho; Dados e backup é o container abaixo
      { id: 'grade-dados', tipo: 'fixo', layout: 'principal', ordem: 2, titulo: 'Dados e backup', alvo: '#pg-grade .pl-dados', caixa: true }   // sai desta página na Etapa 7 (vai para as Configurações)
    ] }
];
/* Páginas: "fixa" aponta para uma página escrita no index.html (módulo fixo: Pomodoro, Grade). Sem "fixa", a página é criada
   sozinha só com os containers dela. "ligado: false" esconde a página sem apagar nada. "larga: true" usa a tela larga.

   LAYOUTS da página (campo "layouts"): cada página tem uma ou mais ÁREAS, de cima para baixo; cada container fica numa área (campo "layout" dele).
     id       identificador interno da área (não aparece na tela)
     nome     (opcional) o nome que aparece na tela, livre; dá-se pelo Painel de layouts (Editar layout). Sem nome, aparece o id
     tipo     'coluna' (1 coluna, o padrão) | 'duas' | 'tres' | 'quatro' | 'cinco' | 'seis' | 'lateral' (coluna estreita + o resto, como o Pomodoro)
     espaco   espaço entre os blocos DENTRO da área: 1 = normal, 0.5 = metade, 2 = dobro (soma-se ao ajuste geral de Aparência)
     largura  'ampla' (o padrão; largura grande em tela larga) | 'normal' (a largura do site)
     pilha    quantos blocos ficam empilhados na 1ª coluna (só 'lateral' e 'duas', em tela larga); o seguinte fica ao lado, na altura da pilha (padrão 1 = nenhum)
     coluna1  (só 'lateral') largura da 1ª coluna, em rem (padrão 22)
   Na página: "entre" = espaço ENTRE uma área e a outra (1 = normal). Sem "layouts", o antigo  layout: { tipo, espaco }  vale como uma área só ("principal").
   Em cada container:
     layout  o id da área onde ele fica; se faltar, a primeira
     ordem   a posição dele DENTRO da área (1, 2, 3...); se faltar, vale a posição na lista
     ocupa   quantas colunas ele ocupa (1, 2 ou 3, até o limite do tipo da área); se faltar, vale 1
   Container de tipo 'fixo' leva um bloco que já está no index.html para dentro de uma área (ver js/containers/fixo.js).
   No celular e em telas estreitas cada área vira uma coluna só, seguindo a ordem.
   GRADE LIVRE (opcional): num layout, "colunas" e "linhas" (listas de tamanhos) no lugar de tipo/pilha/coluna1; e, no container, col, lin, ocupa e ocupaLin.
   Ex.: { id: 'principal', colunas: [1, 1, 1], linhas: ['auto', 'auto'] } com  agenda { col: 1, lin: 1 }, notas { col: 1, lin: 2 }, graficos { col: 3, lin: 1, ocupaLin: 2 }. Detalhes em js/core/roteador.js.

   Exemplo de página nova (cole dentro da lista acima), com duas colunas e o segundo bloco ocupando as duas:
     { id: 'financas', titulo: 'Finanças', layouts: [ { id: 'principal', tipo: 'duas', espaco: 1.5 } ], containers: [
         { id: 'agenda2', tipo: 'agenda', ordem: 1, titulo: 'Contas', aba: 'Contas', intervalo: 'A3:G' },
         { id: 'agenda3', tipo: 'agenda', ordem: 2, ocupa: 2, titulo: 'Metas', aba: 'Metas', intervalo: 'A3:G' } ] } */

// aproveita o que já estava configurado antes dos containers existirem (só vale na 1ª vez)
Roteador.iniciar(PAGINAS, { herdar: {
  agenda: () => cfg.agenda,
  graficos: () => (Array.isArray(cfg.graficos) ? { graficos: cfg.graficos } : undefined)
} });

/* Levar a configuração para outros aparelhos: ela fica salva por navegador. Copie daqui para o PAGINAS acima
   e envie ao GitHub; nos outros aparelhos use "Usar a do projeto". */
(() => {
  const area = $('#ct-saida'), msg = t => { $('#ct-msg').textContent = t; };
  $('#ct-copiar').onclick = async () => {
    const txt = JSON.stringify(Containers.todas(), null, 2);
    area.value = txt; area.hidden = false; area.focus(); area.select();
    try { await navigator.clipboard.writeText(txt); msg('Copiado. Cole no lugar da lista "containers" de js/paginas.js e envie ao GitHub.'); }
    catch { msg('Selecione o texto abaixo, copie e cole no lugar da lista "containers" de js/paginas.js.'); }
  };
  $('#ct-limpar').onclick = () => {
    if (!confirm('Apagar as mudanças feitas neste aparelho e usar a configuração de js/paginas.js? A página será recarregada.')) return;
    Containers.limparAjustes(); Roteador.limparAjustes(); location.reload();
  };
})();