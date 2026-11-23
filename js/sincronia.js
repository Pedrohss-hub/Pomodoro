/* Tela do Armazém: o bloco "sincronizar entre aparelhos" em Configurações e o aviso "Recarregar".
   A lógica de verdade está em js/core/armazem.js; aqui só tem botões, campos e mensagens.
   Depende de pomodoro.js (cfg, LS, $), util.js e core/armazem.js. */
(() => {
  Armazem.configurar(() => cfg.armazem);                 // onde ficam as escolhas (ligado, aba, célula): junto com a URL e o token, neste aparelho
  const msg = (t, cls) => { const e = $('#arm-msg'); e.textContent = t || ''; e.className = 'dica' + (cls ? ' ' + cls : ''); };
  const hora = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  function mostrarEstado() {
    const e = Armazem.estado();
    if (e.ok === null) msg(Armazem.conf().ligado ? 'Ainda não sincronizado.' : 'Desligado: as configurações ficam só neste aparelho.');
    else msg(e.ok ? 'Sincronizado às ' + hora(e.em) + '.' : 'Falhou: ' + e.erro, e.ok ? 'ok' : 'erro');
  }
  function mostrar() {
    const c = Armazem.conf();
    $('#arm-ligado').checked = c.ligado; $('#arm-aba').value = c.aba; $('#arm-celula').value = c.celula;
    mostrarEstado();
  }
  function salvar() {
    const celula = $('#arm-celula').value.trim().toUpperCase(), ok = /^[A-Z]{1,3}\d+$/.test(celula);
    $('#arm-celula').classList.toggle('erro', !ok);
    cfg.armazem = { ligado: $('#arm-ligado').checked, aba: $('#arm-aba').value.trim() || 'App', celula: ok ? celula : Armazem.conf().celula };
    LS.set('pomo-cfg', cfg);
  }
  async function sincronizarAgora() {
    if (!Armazem.ativo()) { msg('Ligue a opção, informe a URL e o token e esteja online.', 'erro'); return; }
    msg('Sincronizando…'); await Armazem.sincronizar(); mostrarEstado();
  }

  ['#arm-ligado', '#arm-aba', '#arm-celula'].forEach(s => $(s).addEventListener('change', () => {
    salvar(); mostrarEstado();
    if (s === '#arm-ligado' && $('#arm-ligado').checked) sincronizarAgora();
  }));
  $('#arm-sincronizar').onclick = () => { salvar(); sincronizarAgora(); };
  $('#arm-preparar').onclick = async () => {
    salvar(); msg('Testando…');
    try {
      const r = await Armazem.preparar();
      msg(r.existente ? 'Tudo certo: a tabela já estava lá.' : r.criada ? 'Aba criada e pronta. Agora é só ligar a opção.' : 'Aba encontrada e tabela criada. Agora é só ligar a opção.', 'ok');
    } catch (err) { msg(err.message, 'erro'); }
  };

  // aviso no rodapé quando chega uma configuração mais nova de outro aparelho
  function faixa(texto, botao, fazer) {
    const velha = document.getElementById('arm-faixa'); if (velha) velha.remove();
    const f = Util.h('div'); f.id = 'arm-faixa'; f.setAttribute('role', 'status');
    f.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:50;display:flex;gap:.75rem;align-items:center;padding:.6rem .9rem;border:1.5px solid var(--line);border-radius:12px;background:var(--card);box-shadow:0 4px 18px rgba(0,0,0,.2);max-width:calc(100vw - 2rem)';
    const b = Util.h('button', 'mini', botao); b.type = 'button'; b.onclick = fazer;
    const x = Util.h('button', 'mini', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar aviso'); x.onclick = () => f.remove();
    f.append(Util.h('span', null, texto), b, x);
    document.body.append(f);
  }
  document.addEventListener('armazem-estado', mostrarEstado);
  document.addEventListener('configuracao-recebida', () => faixa('As configurações foram atualizadas por outro aparelho.', 'Recarregar', () => location.reload()));

  // quando sincronizar: ao abrir, ao voltar a ficar online e ao voltar para esta aba depois de um tempo
  mostrar();
  Armazem.sincronizar();
  window.addEventListener('online', () => Armazem.sincronizar());
  let ultima = Date.now();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultima > 60000) { ultima = Date.now(); Armazem.sincronizar(); } });
})();