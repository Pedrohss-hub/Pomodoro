/* Páginas e containers do site, como DADOS. Para mudar o que aparece, mexa aqui (ou, no futuro, na planilha).
   Cada container tem um "tipo" (arquivo em js/containers/) e a configuração dele.
   Dica: "ligado: false" desliga um container sem apagar nada. */
const PAGINAS = [
  { id: 'pomodoro', containers: [
    { id: 'agenda', tipo: 'agenda', titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false }
  ] }
];

(() => {
  const pomoVisivel = () => !$('#pg-pomo').hidden;
  const destino = document.querySelector('.painel-estudo');
  PAGINAS.find(p => p.id === 'pomodoro').containers.forEach(def =>
    Containers.montar(def, destino, {
      antes: $('#gf-det'),           // a agenda fica antes dos gráficos
      visivel: pomoVisivel,
      herdar: def.id === 'agenda' ? cfg.agenda : undefined      // aproveita o que você já tinha configurado na agenda antiga
    }));
})();