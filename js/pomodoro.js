/* Pomodoro: cronômetro, sessões, fila de envio, conexão com a planilha (botão de status no canto), categorias e mensagens.
   Mensagens: mostrar(tipo, texto, obj, silencioso) guarda na lista "Mensagens recentes" (sino no canto, últimas 50, só nesta aba)
   e, exceto tipo 'info' ou silencioso, mostra um aviso temporário (#toast). avisar(texto) = aviso para o usuário.
   Também define utilitários que os outros arquivos usam ($, LS, cfg, avisar, mostrar, chamarScript). */
  const $ = s => document.querySelector(s);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  let cfg = Object.assign({ url: '', token: '', foco: 25, curta: 5, longa: 15 }, LS.get('pomo-cfg', {}));
  Sheets.usar(() => cfg);   // o núcleo (js/core/sheets.js) lê a URL e o token daqui
  const PLAN_PADRAO = { aba: 'Banco', linhaInicial: 2, tipo: 'Estudo', formatoTempo: 'dia', apagarTeste: 'linha', abaConfig: 'Config', intervalo: 'A23:A31',
    campos: { data: 'A', inicio: 'B', fim: 'C', perdido: 'D', categoria: 'E', tipo: 'F', liquido: 'G' } };
  cfg.planilha = Object.assign({}, PLAN_PADRAO, cfg.planilha, { campos: Object.assign({}, PLAN_PADRAO.campos, (cfg.planilha || {}).campos) });

  // O script é genérico: é o site que monta o pedido. Cada sessão vira uma linha nas colunas configuradas.
  function pedidoAnexar(e) {
    const p = cfg.planilha, tempo = m => p.formatoTempo === 'min' ? m : m / 1440;
    const valores = {
      data: { iso: e.inicio, como: 'data' }, inicio: { iso: e.inicio, como: 'hora' }, fim: { iso: e.fim, como: 'hora' },
      perdido: tempo(e.perdido || 0), categoria: e.categoria || 'Estudo', tipo: p.tipo, liquido: tempo(e.minutos)
    };
    const colunas = {}, usadas = {};
    for (const k of Object.keys(valores)) {
      const c = String(p.campos[k] || '').trim().toUpperCase();
      if (!c) continue;
      if (!/^[A-Z]{1,3}$/.test(c)) throw new Error('coluna inválida em "' + k + '": ' + c);
      if (usadas[c]) throw new Error('"' + usadas[c] + '" e "' + k + '" apontam para a coluna ' + c);
      usadas[c] = k; colunas[c] = valores[k];
    }
    if (!Object.keys(colunas).length) throw new Error('nenhuma coluna configurada para envio');
    const chave = String(p.campos.data || '').trim().toUpperCase();
    return { acao: 'anexar', aba: p.aba, linhaInicial: p.linhaInicial, colunaChave: chave || undefined, colunas };
  }

  // Modo teste que se limpa: depois de enviar uma sessão de TESTE, lê a linha de volta (confirma que chegou e que é a desta sessão)
  // e manda o script apagá-la. Só mexe na linha que ESTE envio acabou de criar (a que o script informou), só se o conteúdo bater e só
  // se a sessão for de teste. Qualquer dúvida: não apaga nada e avisa. cfg.planilha.apagarTeste: 'linha' (exclui), 'limpar' ou 'nao'.
  async function limparTeste(e, linha) {
    const p = cfg.planilha, como = p.apagarTeste;
    if (!e.teste || como === 'nao' || !(linha >= 1)) return false;
    const falta = txt => { mostrar('aviso', 'Teste enviado, mas NÃO apaguei a linha ' + linha + ': ' + txt); return false; };
    try {
      const esperado = pedidoAnexar(e).colunas, letras = Object.keys(esperado), nums = letras.map(Util.colunaNumero);
      const c0 = Math.min(...nums), c1 = Math.max(...nums);
      const lido = await Sheets.ler(p.aba, Util.colunaLetra(c0) + linha + ':' + Util.colunaLetra(c1) + linha, { retorno: ['exibidos'], cortarVazias: false });
      if (!lido.ok) return falta('não consegui conferir (' + (lido.erro || 'resposta inesperada') + ').');
      const cel = (lido.exibidos || [])[0];
      if (!cel) return falta('a linha lida veio vazia.');
      const conferir = {};
      for (const l of letras) {
        const v = esperado[l], c = String(cel[Util.colunaNumero(l) - c0] ?? '').trim(); conferir[l] = String(cel[Util.colunaNumero(l) - c0] ?? '');
        let bate = true;
        if (typeof v === 'string') bate = c === v.trim();                                       // texto (categoria, tipo): igual
        else if (v && v.como === 'hora') {                                                       // hora: mesmo minuto (aceita 1 min de diferença por arredondamento)
          const m = /(\d{1,2}):(\d{2})/.exec(c), d = new Date(v.iso);
          const dif = m ? Math.abs((+m[1] * 60 + +m[2]) - (d.getHours() * 60 + d.getMinutes())) : 9999;
          bate = dif <= 1 || dif >= 1439;
        } else if (v && v.como === 'data') bate = c !== '';                                      // data: preenchida
        if (!bate) return falta('a linha não bate com a sessão (coluna ' + l + ': "' + c + '").');
      }
      const d = await Sheets.apagarLinha(p.aba, linha, { conferir, como: como === 'limpar' ? 'limpar' : 'excluir' });
      if (!d.ok) return falta(/desconhecida/.test(d.erro || '') ? 'o script está numa versão antiga: cole o novo apps-script.gs (v-generico-2) e publique uma nova versão da implantação.' : (d.erro || 'o script recusou.'));
      e.apagada = como === 'limpar' ? 'limpa' : 'excluída';
      mostrar('ok', 'Teste enviado e apagado (linha ' + linha + ').');
      return true;
    } catch (err) { return falta('não consegui conferir (' + err.message + ').'); }
  }

  // Categorias = células lidas com a ação genérica "ler"
  async function lerCategoriasPlanilha() {
    const p = cfg.planilha;
    const d = await chamarScript('ler', { aba: p.abaConfig, intervalo: p.intervalo, retorno: ['exibidos'] });
    if (!d.ok) return d;
    if (!d.exibidos) return { ok: false, erro: 'o script está numa versão antiga: cole o novo apps-script.gs (v-generico-1) e publique uma nova versão' };
    return { ok: true, categorias: [...new Set(d.exibidos.flat().map(v => String(v).trim()).filter(Boolean))], aba: d.aba, intervalo: d.intervalo };
  }


  // (fim das funções do site para o script genérico)

  let log = LS.get('pomo-log', []);
  log.forEach(e => { if (e.status === 'enviando') e.status = 'pendente'; });
  let conexao = (cfg.url && cfg.token) ? 'ver' : 'config', fila = Promise.resolve();
  let categorias = LS.get('pomo-cats', ['Estudo']), categoriaSessao = 'Estudo', categoriasCarregadas = false, ultimaCarga = 0;
  let modo = 'foco', restante = 0, rodando = false, fimPrevisto = 0;
  let inicioSessao = null, ciclo = 0, timer = null, extra = false;
  let livreMs = 0, trecho = 0;                                     // modo Livre: tempo já contado (pausado) e quando o trecho atual começou

  const duracao = () => modo === 'livre' ? 0 : cfg[modo] * 60000;   // no modo Livre não há tempo definido
  // tempo focado até agora, em ms (Foco: o que já passou do planejado; Livre: o que foi contado)
  const focadoAgora = () => modo === 'livre' ? livreMs + (rodando ? Date.now() - trecho : 0) : duracao() - (rodando ? Math.max(0, fimPrevisto - Date.now()) : restante);
  const fmtLivre = ms => { const t = Math.floor(Math.max(ms, 0) / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60, p = n => String(n).padStart(2, '0'); return h ? h + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s); };
  const fmt = ms => {
    const s = Math.ceil(Math.max(ms, 0) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horaFmt = (iso, seg) => new Date(iso).toLocaleTimeString('pt-BR',
    seg ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
  const fmtMin = n => {
    const t = Math.round(Number(n) * 60), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    if (h) return h + ' h ' + String(m).padStart(2, '0') + ' min';
    if (m) return m + ' min' + (s ? ' ' + s + ' s' : '');
    return s + ' s';
  };
  const minimoMs = () => (cfg.teste ? 1000 : 60000);
  const fmtMais = ms => {
    const t = Math.floor(Math.max(ms, 0) / 1000);
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };

  let audioCtx;
  function ctx() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tom(freq, dur, { tipo = 'sine', vol = 0.18, atraso = 0, ate = freq } = {}) {
    try {
      const c = ctx(), t0 = c.currentTime + atraso;
      const o = c.createOscillator(), g = c.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(freq, t0);
      if (ate !== freq) o.frequency.exponentialRampToValueAtTime(ate, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch {}
  }
  function clique(vol = 0.3) {
    try {
      const c = ctx(), n = Math.floor(c.sampleRate * 0.03);
      const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf; g.gain.value = vol;
      s.connect(g); g.connect(c.destination); s.start();
    } catch {}
  }
  const SOM = {
    iniciar() { clique(); tom(520, 0.1, { tipo: 'triangle', ate: 780, atraso: 0.02 }); tom(1040, 0.14, { tipo: 'triangle', vol: 0.1, atraso: 0.1 }); },
    pausar() { clique(0.22); tom(560, 0.12, { tipo: 'triangle', ate: 340, atraso: 0.02 }); },
    trocar() { clique(0.18); tom(700, 0.06, { tipo: 'triangle', vol: 0.08 }); },
    zerar() { clique(0.2); tom(480, 0.14, { tipo: 'triangle', ate: 300, vol: 0.12 }); },
    enviar() { clique(0.2); tom(660, 0.1, { tipo: 'triangle', atraso: 0.02 }); tom(990, 0.16, { tipo: 'triangle', atraso: 0.11, vol: 0.14 }); },
    negado() { clique(0.2); tom(200, 0.18, { tipo: 'square', vol: 0.06, atraso: 0.02 }); },
    alarme() { [0, 0.9, 1.8].forEach(a => { tom(880, 1.2, { atraso: a, vol: 0.2 }); tom(1760, 0.9, { atraso: a, vol: 0.07 }); tom(2640, 0.5, { atraso: a, vol: 0.03 }); }); }
  };

  function render() {
    document.body.dataset.modo = modo;
    if (extra) document.body.dataset.extra = ''; else delete document.body.dataset.extra;
    document.querySelectorAll('.modos button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.modo === modo));
      b.disabled = extra;
    });
    const tempoTxt = modo === 'livre' ? fmtLivre(focadoAgora()) : extra ? '+' + fmtMais(Date.now() - fimPrevisto) : fmt(restante);
    $('#tempo').textContent = tempoTxt;
    document.title = tempoTxt;
    $('#iniciar').hidden = extra;
    $('#reiniciar').hidden = extra;
    $('#encerrar').hidden = extra || !((modo === 'foco' || modo === 'livre') && inicioSessao);
    $('#fim-extra').hidden = !extra;
    $('#no-horario').hidden = !extra;
    $('#categoria').disabled = !!inicioSessao;
    $('#cat-btn').disabled = !!inicioSessao;
    $('#iniciar').textContent = rodando ? 'Pausar' : ((modo === 'livre' ? livreMs > 0 : restante < duracao()) ? 'Continuar' : 'Iniciar');
    $('#ciclo').textContent = extra ? 'O tempo acabou. Tempo extra rodando.'
      : modo === 'foco' ? 'Sessões de foco concluídas: ' + ciclo : modo === 'livre' ? 'Modo livre: conta para cima. Encerre quando quiser.' : 'Hora de descansar.';
  }

  const SVG = c => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + c + '</svg>';
  const NUVEM = '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>';
  const ICONES = {
    on: SVG(NUVEM + '<path d="m9 13 2 2 4-4"/>'),
    off: SVG(NUVEM + '<path d="m3 3 18 18"/>'),
    config: SVG(NUVEM + '<path d="M12 10.5v3M12 16.5h.01"/>'),
    ver: SVG(NUVEM + '<path d="M9 13h.01M12 13h.01M15 13h.01"/>')
  };

  function atualizarStatus() {
    const n = log.filter(e => e.status === 'pendente' || e.status === 'enviando').length;
    $('#status').dataset.st = conexao;
    $('#st-icone').innerHTML = ICONES[conexao];
    // o botão é só o símbolo: o estado vai no aria-label e na dica (title)
    const rotulo = {
      on: n ? 'Enviando…' : 'Conectado',
      off: 'Sem conexão' + (n ? ' (' + n + ' na fila)' : ''),
      config: 'Configurar',
      ver: 'Verificando…'
    }[conexao];
    $('#status').setAttribute('aria-label', rotulo);
    $('#status').title = rotulo + '. ' + {
      on: 'Clique para verificar a conexão com a planilha de novo.',
      off: 'As sessões ficam guardadas e são enviadas sozinhas quando voltar.',
      config: 'Configure a URL e o token nas configurações.',
      ver: 'Aguarde.'
    }[conexao];
  }

  function renderLog() {
    atualizarStatus();
    const ul = $('#lista');
    const y = ul.scrollTop;
    ul.replaceChildren();
    if (!log.length) {
      const p = document.createElement('li');
      p.className = 'vazio';
      p.textContent = 'Nenhuma sessão ainda. Termine um foco e ele aparece aqui.';
      ul.append(p);
      return;
    }
    log.forEach(e => {
      const li = document.createElement('li');
      const topo = document.createElement('div'); topo.className = 'topo';
      const mat = document.createElement('span'); mat.className = 'mat'; mat.textContent = (e.categoria || 'Estudo') + (e.livre ? ' (livre)' : '') + (e.teste ? ' (teste)' : '') + (e.apagada ? ' · apagada' : '');
      const st = document.createElement('span'); st.className = 'st ' + e.status;
      st.textContent = e.status === 'ok' ? 'Enviada' : e.status === 'enviando' ? 'Enviando…' : e.status === 'pendente' ? 'Na fila' : 'Falhou';
      topo.append(mat, st);

      const seg = (e.minutos + (e.perdido || 0)) < 2;   // em sessões bem curtas, mostra também os segundos
      const par = (rotulo, valor) => {
        const p = document.createElement('span'); p.className = 'par';
        const r = document.createElement('span'); r.className = 'rot'; r.textContent = rotulo;
        p.append(r, valor);
        return p;
      };
      const det = document.createElement('div'); det.className = 'det';
      det.append(par('Início', horaFmt(e.inicio, seg)), par('Fim', horaFmt(e.fim, seg)),
                 par('Líquido', fmtMin(e.minutos)), par('Perdido', fmtMin(e.perdido || 0)));
      li.append(topo, det);

      if (e.erro) { const m = document.createElement('p'); m.className = 'msg'; m.textContent = e.erro; li.append(m); }
      if (e.status === 'erro') {
        const bt = document.createElement('button'); bt.textContent = 'Tentar de novo';
        bt.onclick = () => enfileirar(e);
        li.append(bt);
      }
      ul.append(li);
    });
    ul.scrollTop = y;
  }

  // Mensagens: vão para a lista "Mensagens recentes" (sino) e, fora as 'info' e as silenciosas, aparecem um instante como aviso
  const MAX_MENSAGENS = 50;
  function mostrar(tipo, texto, obj, silencioso) {
    const p = document.createElement('p');
    p.className = tipo;
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = new Date().toLocaleTimeString('pt-BR') + '  ';
    p.append(t, texto + (obj ? '\n' + JSON.stringify(obj, null, 2) : ''));
    const c = $('#console');
    c.append(p);
    while (c.children.length > MAX_MENSAGENS) c.firstElementChild.remove();
    c.scrollTop = c.scrollHeight;
    if (tipo === 'erro' && !$('#dlg-console').open) $('#btn-historico').classList.add('alerta');   // erro que passou sem você ver
    (tipo === 'erro' ? console.error : console.log)(texto, obj ?? '');
    if (!silencioso && tipo !== 'info') aviso(tipo, texto);
  }

  const UM_DIA = 24 * 60 * 60 * 1000;
  const falhaDeRede = msg => Object.assign(new Error(msg), { fila: true });

  async function enviar(e) {
    e.status = 'enviando'; e.erro = ''; renderLog();
    const dados = { inicio: e.inicio, fim: e.fim, categoria: e.categoria || 'Estudo', liquido: e.minutos, perdido: e.perdido || 0 };
    try {
      if (!cfg.url || !cfg.token) throw falhaDeRede('configure a URL e o token');
      if (!navigator.onLine) throw falhaDeRede('sem internet');
      mostrar('info', 'Enviando: ' + hora(e.inicio) + ' até ' + hora(e.fim) + ', ' + fmtMin(e.minutos) + ', ' + dados.categoria
        + '\nDestino: …' + cfg.url.slice(-24), dados);
      const pedido = pedidoAnexar(e);
      let d;
      try {
        const { acao, ...resto } = pedido;
        d = await Sheets.chamar(acao, resto, { timeout: 30000 });
      } catch (err) {
        if (err.tipo === 'rede') throw falhaDeRede(err.message);   // sem conexão: vai para a fila
        throw err;
      }
      if (!d.ok) throw new Error(d.erro || 'o script respondeu ok: false');
      if (!d.linha) throw new Error('o script respondeu, mas não confirmou a gravação (versão antiga da implantação?)');
      mostrar('ok', 'Gravado na planilha, linha ' + d.linha, d, !!e.teste && cfg.planilha.apagarTeste !== 'nao');   // teste: quem avisa é a limpeza
      e.status = 'ok'; e.enviadoEm = Date.now(); e.linha = d.linha; conexao = 'on';
      if (e.teste) await limparTeste(e, d.linha);                          // antes de avisar 'sessao-enviada': os gráficos já leem sem a linha de teste
    } catch (err) {
      e.status = err.fila ? 'pendente' : 'erro';
      e.erro = err.message;
      conexao = !(cfg.url && cfg.token) ? 'config' : err.fila ? 'off' : 'on';
      mostrar(err.fila ? 'aviso' : 'erro', (err.fila ? 'Guardada na fila: ' : 'Falhou: ') + err.message);
    }
    limparAntigas();
    LS.set('pomo-log', log);
    renderLog();
    if (e.status === 'ok') Util.avisar('sessao-enviada');
  }

  // Envia um de cada vez, na ordem: evita duas gravações disputando a mesma linha da planilha
  function enfileirar(e) {
    e.status = 'enviando';
    fila = fila.then(() => enviar(e)).catch(() => {});
  }

  function pingar() { return Sheets.ping(); }

  function renderCategorias() {
    const sel = $('#categoria');
    const atual = sel.value || LS.get('pomo-cat', '');
    sel.replaceChildren(...categorias.map(c => new Option(c, c)));
    sel.value = categorias.includes(atual) ? atual : categorias[0];
    sel.disabled = !!inicioSessao;
    $('#cat-btn').disabled = sel.disabled;
    montarMenuCategorias();
  }

  let itemAtivo = 0;

  function montarMenuCategorias() {
    const sel = $('#categoria'), ul = $('#cat-lista');
    $('#cat-txt').textContent = sel.value || 'Sem categorias';
    ul.replaceChildren(...categorias.map((c, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(c === sel.value));
      li.textContent = c;
      li.onclick = () => escolherCategoria(c);
      li.onmouseenter = () => destacarCategoria(i, false);
      return li;
    }));
  }

  function destacarCategoria(i, rolar = true) {
    const itens = [...$('#cat-lista').children];
    if (!itens.length) return;
    itemAtivo = (i + itens.length) % itens.length;
    itens.forEach((li, k) => li.classList.toggle('ativo', k === itemAtivo));
    if (rolar) itens[itemAtivo].scrollIntoView({ block: 'nearest' });
  }

  function abrirMenuCategorias() {
    if ($('#cat-btn').disabled) return;
    $('#cat-lista').hidden = false;
    $('#cat-btn').setAttribute('aria-expanded', 'true');
    const atual = [...$('#cat-lista').children].findIndex(li => li.getAttribute('aria-selected') === 'true');
    destacarCategoria(atual < 0 ? 0 : atual);
  }

  function fecharMenuCategorias() {
    $('#cat-lista').hidden = true;
    $('#cat-btn').setAttribute('aria-expanded', 'false');
  }

  function escolherCategoria(c) {
    const sel = $('#categoria');
    sel.value = c;
    sel.dispatchEvent(new Event('change'));
    montarMenuCategorias();
    fecharMenuCategorias();
    $('#cat-btn').focus();
  }

  // Ponte: os outros arquivos ainda chamam chamarScript. Aos poucos eles passam a usar Sheets.* direto.
  function chamarScript(acao, dados = {}) { return Sheets.chamar(acao, dados); }

  async function carregarCategorias(manual = false) {
    if (!cfg.url || !cfg.token || !navigator.onLine) { if (manual) avisar('Configure a URL e o token para carregar as categorias.'); return; }
    ultimaCarga = Date.now();
    try {
      const d = await lerCategoriasPlanilha();
      if (!d.ok) throw new Error(d.erro || 'resposta inesperada');
      if (!d.categorias.length) throw new Error('nenhuma categoria encontrada na planilha');
      categorias = d.categorias;
      categoriasCarregadas = true;
      LS.set('pomo-cats', categorias);
      renderCategorias();
      if (manual) avisar('Categorias atualizadas (' + categorias.length + ').');
      else mostrar('ok', 'Categorias carregadas: ' + categorias.join(', '), null, true);
    } catch (err) {
      const msg = 'Não consegui carregar as categorias: ' + (err instanceof SyntaxError ? 'resposta inesperada do script (confira a URL e se a implantação é a versão nova)' : err.message);
      if (manual) avisar(msg); else mostrar('erro', msg);
    }
  }

  let verificando = false;
  async function verificarEEnviar() {
    if (verificando) return;
    verificando = true;
    try {
      if (!cfg.url || !cfg.token) { conexao = 'config'; return; }
      const ok = navigator.onLine && await pingar();
      conexao = ok ? 'on' : 'off';
      if (ok && !categoriasCarregadas) carregarCategorias();
      if (ok) log.filter(e => e.status === 'pendente').reverse().forEach(enfileirar);
    } finally { verificando = false; renderLog(); }
  }

  // Sessões já enviadas saem da lista 24 h depois do envio; as na fila e as com erro ficam até serem resolvidas
  function limparAntigas() {
    const antes = log.length, agora = Date.now();
    log = log.filter(e => e.status !== 'ok' || agora - (e.enviadoEm || Date.parse(e.fim)) < UM_DIA);
    return log.length !== antes;
  }

  let toastTimer;
  function aviso(tipo, texto) {                       // aviso temporário no canto da tela (só a 1ª linha; o resto fica na lista)
    const t = $('#toast');
    t.textContent = String(texto).split('\n')[0]; t.dataset.tipo = tipo; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, tipo === 'erro' ? 7000 : 4500);
  }
  function avisar(texto) { mostrar('aviso', texto); }

  function registrar(focadoMs, fim = new Date()) {
    if (focadoMs < minimoMs()) { avisar('Sessão com menos de ' + (cfg.teste ? '1 segundo' : '1 minuto') + ' não é enviada.'); return; }
    const e = {
      id: Date.now(), categoria: categoriaSessao, teste: !!cfg.teste, livre: modo === 'livre',
      inicio: inicioSessao.toISOString(), fim: fim.toISOString(),
      minutos: Math.round(focadoMs / 600) / 100,
      perdido: Math.round(Math.max(0, fim - inicioSessao - focadoMs) / 600) / 100,
      status: 'enviando', erro: ''
    };
    log.unshift(e);
    enfileirar(e);
  }

  function parar() { clearInterval(timer); rodando = false; }

  function iniciar() {
    if ((modo === 'foco' || modo === 'livre') && !inicioSessao) { inicioSessao = new Date(); categoriaSessao = $('#categoria').value || 'Estudo'; }
    if (modo === 'livre') trecho = Date.now(); else fimPrevisto = Date.now() + restante;
    rodando = true;
    timer = setInterval(tick, 250);
    render();
  }

  function pausar() {
    if (modo === 'livre') livreMs += Date.now() - trecho; else restante = Math.max(0, fimPrevisto - Date.now());
    parar(); render();
  }

  function tick() {
    if (!extra && modo !== 'livre') {                                // Livre: só atualiza o relógio (sem fim, sem alarme)
      restante = fimPrevisto - Date.now();
      if (restante <= 0) { if (modo === 'foco') entrarExtra(); else concluirPausa(); return; }
    }
    render();
  }

  function entrarExtra() {
    restante = 0; extra = true; rodando = false;
    SOM.alarme();
    mostrar('info', 'O tempo de foco acabou. Escolha como finalizar.');
    render();
  }

  function concluirPausa() {
    parar(); SOM.alarme();
    modo = 'foco'; inicioSessao = null; restante = duracao();
    render();
  }

  function finalizarFoco(comExtra) {
    parar();
    const planejado = duracao();
    if (comExtra) registrar(planejado + (Date.now() - fimPrevisto), new Date());
    else registrar(planejado, new Date(fimPrevisto));
    extra = false; ciclo++;
    modo = ciclo % 4 === 0 ? 'longa' : 'curta';
    inicioSessao = null; restante = duracao();
    render();
  }

  function encerrarAntes() {
    const focado = focadoAgora();
    if (focado < minimoMs()) {
      SOM.negado();
      avisar('Ainda não alcançou o mínimo de ' + (cfg.teste ? '1 segundo' : '1 minuto') + '. Faltam ' + Math.ceil((minimoMs() - focado) / 1000) + ' s para poder enviar.');
      return;
    }
    SOM.enviar();
    if (rodando) pausar();
    registrar(focado);
    inicioSessao = null; livreMs = 0;
    restante = duracao();
    render();
  }

  function zerar(novoModo) {
    parar(); extra = false;
    if (novoModo) modo = novoModo;
    inicioSessao = null; livreMs = 0;
    restante = duracao();
    render();
  }

  $('#iniciar').onclick = () => { if (rodando) { SOM.pausar(); pausar(); } else { SOM.iniciar(); iniciar(); } };
  $('#fim-extra').onclick = () => { SOM.enviar(); finalizarFoco(true); };
  $('#no-horario').onclick = () => { SOM.enviar(); finalizarFoco(false); };
  $('#encerrar').onclick = encerrarAntes;
  $('#reiniciar').onclick = () => { SOM.zerar(); zerar(); };
  $('#limpar-enviadas').onclick = () => { log = log.filter(e => e.status !== 'ok'); LS.set('pomo-log', log); renderLog(); };
  $('#limpar-console').onclick = () => $('#console').replaceChildren();
  window.addEventListener('error', ev => mostrar('erro', 'Erro na página: ' + ev.message));
  document.querySelectorAll('.modos button').forEach(b => b.onclick = () => { SOM.trocar(); zerar(b.dataset.modo); });

  $('#url').value = cfg.url;
  // modo teste: a chave fica em Configurações; com ele ligado a engrenagem ganha um pontinho amarelo (para não esquecer)
  const marcarTeste = () => {
    $('#selo-teste').classList.toggle('ligado', !!cfg.teste);
    $('#btn-config').classList.toggle('teste-ligado', !!cfg.teste);
    $('#btn-config').title = cfg.teste ? 'Configurações (modo teste ligado)' : 'Configurações';
  };
  $('#teste').checked = !!cfg.teste; marcarTeste();
  $('#token').value = cfg.token;
  ['foco', 'curta', 'longa'].forEach(k => $('#d-' + k).value = cfg[k]);
  const salvarCfg = () => {
    cfg.url = $('#url').value.trim();
    cfg.token = $('#token').value;
    ['foco', 'curta', 'longa'].forEach(k => cfg[k] = Math.max(1, parseInt($('#d-' + k).value) || cfg[k]));
    LS.set('pomo-cfg', cfg);
    if (!rodando && !inicioSessao) { restante = duracao(); render(); }
    verificarEEnviar();
  };
  ['#url', '#token', '#d-foco', '#d-curta', '#d-longa'].forEach(s => $(s).onchange = salvarCfg);
  $('#btn-historico').onclick = () => {
    const d = $('#dlg-console');
    if (d.open) { d.close(); return; }
    $('#btn-historico').classList.remove('alerta');
    d.show();
    $('#console').scrollTop = $('#console').scrollHeight;
  };
  $('#btn-config').onclick = () => $('#dlg-config').showModal();
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
    d.querySelector('.fechar').onclick = () => d.close();
  });
  $('#dlg-config').addEventListener('close', salvarCfg);

  restante = duracao();
  render();
  renderCategorias();
  limparAntigas();
  renderLog();
  if ((!cfg.url || !cfg.token) && location.hash !== '#grade') $('#dlg-config').showModal();
  mostrar('info', 'Mensagens prontas. Os envios e avisos aparecem aqui.');

  $('#status').onclick = verificarEEnviar;
  $('#teste').onchange = () => {
    cfg.teste = $('#teste').checked;
    LS.set('pomo-cfg', cfg);
    marcarTeste();
    mostrar('info', cfg.teste ? 'Modo teste ligado: sessões a partir de 1 segundo são enviadas.' : 'Modo teste desligado: mínimo de 1 minuto.');
  };
  $('#categoria').onchange = e => LS.set('pomo-cat', e.target.value);
  $('#cat-btn').onclick = () => ($('#cat-lista').hidden ? abrirMenuCategorias() : fecharMenuCategorias());
  $('#cat-btn').onkeydown = ev => {
    const aberto = !$('#cat-lista').hidden;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!aberto) abrirMenuCategorias(); else destacarCategoria(itemAtivo + (ev.key === 'ArrowDown' ? 1 : -1));
    } else if (ev.key === 'Enter' && aberto) {
      ev.preventDefault();
      escolherCategoria(categorias[itemAtivo]);
    } else if (ev.key === 'Escape' && aberto) {
      fecharMenuCategorias();
    }
  };
  document.addEventListener('click', ev => { if (!$('#dd').contains(ev.target)) fecharMenuCategorias(); });
  $('#atualizar-cats').onclick = () => carregarCategorias(true);
  window.addEventListener('online', verificarEEnviar);
  window.addEventListener('offline', () => { if (cfg.url && cfg.token) conexao = 'off'; renderLog(); });
  setInterval(() => {
    if (limparAntigas()) { LS.set('pomo-log', log); renderLog(); }
    if (conexao !== 'on' || log.some(e => e.status === 'pendente')) verificarEEnviar();
    if (conexao === 'on' && !inicioSessao && Date.now() - ultimaCarga > 30 * 60 * 1000) carregarCategorias();
  }, 30000);
  verificarEEnviar();