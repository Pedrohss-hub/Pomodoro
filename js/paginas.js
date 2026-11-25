/* Páginas e containers do site, como DADOS. Para mudar o que aparece, mexa aqui (ou, no futuro, na planilha).
   Cada container tem um "tipo" (arquivo em js/containers/) e a configuração dele.
   Dica: "ligado: false" desliga um container sem apagar nada. */
const PAGINAS = [
  { id: 'pomodoro', titulo: 'Pomodoro', fixa: 'pg-pomo', layout: { tipo: 'lateral', espaco: 1 }, containers: [
    { id: 'agenda', tipo: 'agenda', ordem: 1, titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false },
    { id: 'graficos', tipo: 'graficos', ordem: 2, titulo: 'Gráficos de estudo', graficos: null }   // null = lista padrão (editável no ⚙ do quadro)
  ] },
  { id: 'grade', titulo: 'Grade', fixa: 'pg-grade', larga: true }
];
/* Páginas: "fixa" aponta para uma página escrita no index.html (módulo fixo: Pomodoro, Grade). Sem "fixa", a página é criada
   sozinha só com os containers dela. "ligado: false" esconde a página sem apagar nada. "larga: true" usa a tela larga.

   GRID da página (campo "layout"):
     tipo    'coluna' (1 coluna, o padrão) | 'duas' | 'tres' | 'lateral' (coluna estreita + o resto, como o Pomodoro)
     espaco  espaço entre os blocos: 1 = normal, 0.5 = metade, 2 = dobro (soma-se ao ajuste geral de Aparência)
   Em cada container:
     ordem   a posição dele (1, 2, 3...); se faltar, vale a posição na lista
     ocupa   quantas colunas ele ocupa (1, 2 ou 3, até o limite do tipo); se faltar, vale 1
   No celular e em telas estreitas tudo vira uma coluna só, seguindo a ordem.

   Exemplo de página nova (cole dentro da lista acima), com duas colunas e o segundo bloco ocupando as duas:
     { id: 'financas', titulo: 'Finanças', layout: { tipo: 'duas', espaco: 1.5 }, containers: [
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
    Containers.limparAjustes(); location.reload();
  };
})();