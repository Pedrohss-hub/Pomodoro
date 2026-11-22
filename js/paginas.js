/* Páginas e containers do site, como DADOS. Para mudar o que aparece, mexa aqui (ou, no futuro, na planilha).
   Cada container tem um "tipo" (arquivo em js/containers/) e a configuração dele.
   Dica: "ligado: false" desliga um container sem apagar nada. */
const PAGINAS = [
  { id: 'pomodoro', containers: [
    { id: 'agenda', tipo: 'agenda', titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', vermelho: 7, amarelo: 30, concluidas: false },
    { id: 'graficos', tipo: 'graficos', titulo: 'Gráficos de estudo', graficos: null }   // null = lista padrão (editável no ⚙ do quadro)
  ] }
];

(() => {
  const pomoVisivel = () => !$('#pg-pomo').hidden;
  const destino = document.querySelector('.painel-estudo');
  PAGINAS.find(p => p.id === 'pomodoro').containers.forEach(def =>
    Containers.montar(def, destino, {
      visivel: pomoVisivel,
      herdar: def.id === 'agenda' ? cfg.agenda : def.id === 'graficos' ? { graficos: cfg.graficos } : undefined   // aproveita o que já estava configurado
    }));
})();

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