/* Configuração da planilha (o que enviar e de onde ler) e painel Avançado. Depende de pomodoro.js. */
(() => {
  const CAMPOS = [
    ['data', 'Data', 'dia da sessão'], ['inicio', 'Início', 'hora em que começou'], ['fim', 'Fim', 'hora em que terminou'],
    ['perdido', 'Perdido', 'minutos fora de foco'], ['categoria', 'Categoria', 'a escolhida no menu'],
    ['tipo', 'Tipo', 'texto fixo, definido abaixo'], ['liquido', 'Tempo líquido', 'minutos focados']
  ];
  const msg = (t, cls) => { const e = $('#sh-msg'); e.textContent = t || ''; e.className = 'dica' + (cls ? ' ' + cls : ''); };
  const tbody = $('#sh-campos');
  CAMPOS.forEach(([k, nome, dica]) => {
    const tr = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td');
    const n = document.createElement('b'); n.textContent = nome;
    const s = document.createElement('small'); s.textContent = dica;
    a.append(n, s);
    const i = document.createElement('input'); i.type = 'text'; i.id = 'sh-c-' + k; i.maxLength = 3; i.autocomplete = 'off';
    i.setAttribute('aria-label', 'Coluna de ' + nome);
    b.append(i); tr.append(a, b); tbody.append(tr);
  });

  const ids = ['#sh-aba', '#sh-linha', '#sh-tipo', '#sh-formato', '#sh-abacfg', '#sh-intervalo'].concat(CAMPOS.map(c => '#sh-c-' + c[0]));

  function mostrar() {
    const p = cfg.planilha;
    $('#sh-aba').value = p.aba; $('#sh-linha').value = p.linhaInicial; $('#sh-tipo').value = p.tipo;
    $('#sh-formato').value = p.formatoTempo; $('#sh-abacfg').value = p.abaConfig; $('#sh-intervalo').value = p.intervalo;
    CAMPOS.forEach(([k]) => { $('#sh-c-' + k).value = p.campos[k]; });
    resumo();
}

  function resumo() {
    const p = cfg.planilha;
    const enviados = CAMPOS.filter(([k]) => p.campos[k]).map(([k, n]) => n + ' → ' + p.campos[k]);
    const cols = CAMPOS.map(([k]) => p.campos[k]).filter(Boolean);
    const dup = cols.filter((c, i) => cols.indexOf(c) !== i);
    let t = enviados.length
      ? 'Cada sessão vai para a aba “' + p.aba + '”, na primeira linha livre a partir da linha ' + p.linhaInicial + ': ' + enviados.join(', ') + '.'
      : 'Nenhuma coluna configurada: nada será enviado.';
    if (dup.length) t += '\nAtenção: a coluna ' + [...new Set(dup)].join(', ') + ' está em mais de um campo; o envio vai falhar.';
    if (!/^[A-Za-z]{1,3}\d+(:[A-Za-z]{1,3}\d+)?$/.test(p.intervalo)) t += '\nAtenção: as células das categorias devem ser como A23:A31.';
    const e = $('#sh-resumo'); e.textContent = t; e.style.whiteSpace = 'pre-wrap';
    e.style.color = /Atenção|Nenhuma/.test(t) ? 'var(--erro)' : '';
  }

  function guardar() {
    const p = cfg.planilha;
    p.aba = $('#sh-aba').value.trim() || p.aba;
    p.linhaInicial = Math.max(1, parseInt($('#sh-linha').value) || p.linhaInicial);
    p.tipo = $('#sh-tipo').value;
    p.formatoTempo = $('#sh-formato').value;
    p.abaConfig = $('#sh-abacfg').value.trim() || p.abaConfig;
    p.intervalo = $('#sh-intervalo').value.trim().toUpperCase() || p.intervalo;
    CAMPOS.forEach(([k, nome]) => {
      const v = $('#sh-c-' + k).value.trim().toUpperCase();
      if (/^[A-Z]{0,3}$/.test(v)) p.campos[k] = v; else msg('Coluna inválida em “' + nome + '”: use só letras (A, B, … AA).', 'erro');
    });
    LS.set('pomo-cfg', cfg);
    mostrar();
}
  ids.forEach(s => $(s).addEventListener('change', guardar));

  async function pedir(fn) {
    if (!cfg.url || !cfg.token) throw new Error('preencha a URL e o token acima');
    if (!navigator.onLine) throw new Error('sem internet');
    try { return await fn(); }
    catch (err) {
      if (err instanceof SyntaxError) throw new Error('o script respondeu algo inesperado (URL errada ou script antigo)');
      if (['TimeoutError', 'AbortError'].includes(err.name) || (err.name === 'TypeError' && /fetch|network|load failed/i.test(err.message))) throw new Error('sem conexão com o script');
      throw err;
    }
}

  $('#sh-buscar-abas').onclick = async () => {
    msg('Buscando abas…');
    try {
      const d = await pedir(() => chamarScript('abas'));
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      $('#sh-abas').replaceChildren(...d.abas.map(n => new Option('', n)));
      msg('Abas encontradas: ' + d.abas.join(', ') + '. Clique num campo de aba para escolher.', 'ok');
    } catch (err) { msg('Não consegui buscar as abas: ' + err.message, 'erro'); }
  };

  $('#sh-testar').onclick = async () => {
    msg('Lendo…');
    try {
      const d = await pedir(lerCategoriasPlanilha);
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      if (!d.categorias.length) throw new Error('nenhuma categoria nessas células');
      categorias = d.categorias; categoriasCarregadas = true;
      LS.set('pomo-cats', categorias); renderCategorias();
      msg('Leitura ok em ' + (d.aba || cfg.planilha.abaConfig) + '!' + (d.intervalo || cfg.planilha.intervalo) + ' (' + categorias.length + '): ' + categorias.join(', '), 'ok');
    } catch (err) { msg('Falhou: ' + err.message, 'erro'); }
  };

  $('#sh-restaurar').onclick = () => {
    if (!confirm('Voltar as opções da planilha para o padrão (aba Banco, colunas A–G, categorias em Config!A23:A31)?')) return;
    cfg.planilha = JSON.parse(JSON.stringify(PLAN_PADRAO));
    LS.set('pomo-cfg', cfg); mostrar(); msg('');
  };

  /* ---------- painel avançado: fala direto com o script genérico ---------- */
  const EXEMPLOS = {
    info: {},
    abas: {},
    ler: { aba: 'Banco', intervalo: 'A1:G5', retorno: ['exibidos'] },
    escrever: { aba: 'Teste', intervalo: 'A1', valores: [['olá', 1], ['hoje', { iso: new Date().toISOString(), como: 'data' }]] },
    anexar: { aba: 'Teste', linhaInicial: 1, colunas: { A: 'texto', B: 123 } },
    limpar: { aba: 'Teste', intervalo: 'A1:B5' }
  };
  const mostrarExemplo = () => { $('#av-json').value = JSON.stringify(EXEMPLOS[$('#av-acao').value], null, 2); };
  $('#av-acao').onchange = mostrarExemplo;
  mostrarExemplo();
  $('#av-rodar').onclick = async () => {
    const acao = $('#av-acao').value, saida = $('#av-saida');
    let params;
    try { params = JSON.parse($('#av-json').value || '{}'); } catch (err) { saida.textContent = 'JSON inválido: ' + err.message; return; }
    if (['escrever', 'anexar', 'limpar'].includes(acao) && !confirm('Executar "' + acao + '" na planilha de verdade?')) return;
    saida.textContent = 'Executando…';
    try {
      const d = await pedir(() => chamarScript(acao, params));
      saida.textContent = JSON.stringify(d, null, 2);
    } catch (err) { saida.textContent = 'Falhou: ' + err.message; }
  };

  mostrar();
})();