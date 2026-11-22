/* Tema: cores, fonte e medidas do site (variáveis CSS). Carregado no <head> para a página não piscar com o tema padrão. */
/* Tema: todas as cores, a fonte e as medidas do site passam por variáveis CSS, controladas aqui. */
const Tema = (() => {
  const CHAVE = 'pomo-tema-v1';
  const VARS = { bg: '--bg', card: '--card', ink: '--ink', soft: '--soft', line: '--line', erro: '--erro',
    foco: '--c-foco', curta: '--c-curta', longa: '--c-longa', extra: '--c-extra', ok: '--ok', aviso: '--aviso', sobre: '--sobre',
    obr: '--t-obr', ele: '--t-ele', liv: '--t-liv', liq: '--g-liq', per: '--g-per' };
  const PADRAO = {
    cores: { bg: '#ECEBF3', card: '#F8F7FC', ink: '#23203A', soft: '#6B6785', line: '#CFCCE0', erro: '#B3283D',
      foco: '#4B3BFF', curta: '#0B7C6D', longa: '#2B6CB0', extra: '#B35A00', ok: '#0B7C6D', aviso: '#B35A00', sobre: '#FFFFFF',
      obr: '#4B3BFF', ele: '#0B7C6D', liv: '#B35A00', liq: '#4B3BFF', per: '#E08A00' },
    fonte: { nome: 'Bricolage Grotesque' },
    medidas: { escala: 1, btn: 1, esp: 1, pad: 1, raio: 1, largura: 62 }
  };
  const PRESETS = {
    padrao: { nome: 'Padrão', cores: PADRAO.cores },
    escuro: { nome: 'Escuro', cores: { bg: '#14131F', card: '#1E1C2D', ink: '#ECEAF7', soft: '#A5A2C2', line: '#39364F', erro: '#FF7D90',
      foco: '#8F82FF', curta: '#3CC4AA', longa: '#58A8F0', extra: '#F2A24E', ok: '#3CC4AA', aviso: '#F2A24E', sobre: '#14131F',
      obr: '#8F82FF', ele: '#3CC4AA', liv: '#F2A24E', liq: '#8F82FF', per: '#F2A24E' } },
    papel: { nome: 'Papel', cores: { bg: '#F3EEE3', card: '#FBF8F1', ink: '#2B2620', soft: '#7A7062', line: '#DDD3BF', erro: '#B3402A',
      foco: '#3B5BA9', curta: '#2E7D5B', longa: '#7A4FA0', extra: '#B5651D', ok: '#2E7D5B', aviso: '#B5651D', sobre: '#FFFFFF',
      obr: '#3B5BA9', ele: '#2E7D5B', liv: '#B5651D', liq: '#3B5BA9', per: '#C77C2A' } },
    oceano: { nome: 'Oceano', cores: { bg: '#E6F0F4', card: '#F4F9FB', ink: '#12303D', soft: '#547380', line: '#C4D8E0', erro: '#B3283D',
      foco: '#0E6BA8', curta: '#12806F', longa: '#5B5BD6', extra: '#C2410C', ok: '#12806F', aviso: '#C2410C', sobre: '#FFFFFF',
      obr: '#0E6BA8', ele: '#12806F', liv: '#C2410C', liq: '#0E6BA8', per: '#D97706' } }
  };
  const FONTES = [
    { nome: 'Bricolage Grotesque', tipo: 'sans' }, { nome: 'Inter', tipo: 'sans' }, { nome: 'DM Sans', tipo: 'sans' },
    { nome: 'Space Grotesk', tipo: 'sans' }, { nome: 'Nunito', tipo: 'sans' }, { nome: 'Fraunces', tipo: 'serif' },
    { nome: 'Lora', tipo: 'serif' }, { nome: 'JetBrains Mono', tipo: 'mono' }, { nome: 'Sistema', tipo: 'sistema' }
  ];
  const PILHAS = { sans: 'system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, Menlo, Consolas, monospace', sistema: 'system-ui, -apple-system, "Segoe UI", sans-serif' };
  const LIM = { escala: [.6, 1.6], btn: [.6, 2], esp: [0, 4], pad: [.3, 3], raio: [0, 3], largura: [30, 120] };
  const clone = o => JSON.parse(JSON.stringify(o));
  const hex = v => /^#[0-9a-f]{6}$/i.test(v);

  function mesclar(x) {
    x = x || {};
    const m = Object.assign({}, PADRAO.medidas, x.medidas);
    Object.keys(LIM).forEach(k => { const v = Number(m[k]); m[k] = isFinite(v) ? Math.min(LIM[k][1], Math.max(LIM[k][0], v)) : PADRAO.medidas[k]; });
    return { cores: Object.assign({}, PADRAO.cores, x.cores), fonte: Object.assign({}, PADRAO.fonte, x.fonte), medidas: m };
  }
  let atual = clone(PADRAO);
  try { const salvo = JSON.parse(localStorage.getItem(CHAVE)); if (salvo) atual = mesclar(salvo); } catch {}

  const limparNome = n => String(n || '').replace(/[^A-Za-z0-9 \-]/g, '').trim().slice(0, 40);
  function pilha(f) {
    const nome = limparNome(f.nome), conhecida = FONTES.find(x => x.nome === nome);
    const tipo = conhecida ? conhecida.tipo : 'sans';
    return (!nome || tipo === 'sistema') ? PILHAS.sistema : '"' + nome + '", ' + PILHAS[tipo];
  }
  function luminancia(h) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
    return .2126 * r + .7152 * g + .0722 * b;
  }
  function carregarFonte(nome) {
    nome = limparNome(nome);
    if (!nome || nome === 'Sistema' || nome === 'Bricolage Grotesque') return;   // a Bricolage já vem na página
    let link = document.getElementById('tema-fonte');
    if (!link) { link = document.createElement('link'); link.id = 'tema-fonte'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    if (link.dataset.nome === nome) return;
    const fam = encodeURIComponent(nome).replace(/%20/g, '+');
    link.dataset.nome = nome;
    link.onerror = () => { link.onerror = null; link.href = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap'; };   // fontes sem todos os pesos
    link.href = 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@400;500;600;700&display=swap';
  }
  function aplicar(t = atual, redesenhar = true) {
    const r = document.documentElement.style, m = t.medidas;
    Object.keys(VARS).forEach(k => { if (hex(t.cores[k])) r.setProperty(VARS[k], t.cores[k]); });
    r.setProperty('--fonte', pilha(t.fonte));
    r.setProperty('--escala', m.escala); r.setProperty('--btn', m.btn); r.setProperty('--esp', m.esp);
    r.setProperty('--pad', m.pad); r.setProperty('--raio', m.raio); r.setProperty('--largura', m.largura + 'rem');
    r.colorScheme = (hex(t.cores.bg) && luminancia(t.cores.bg) < .35) ? 'dark' : 'light';
    carregarFonte(t.fonte.nome);
    if (redesenhar) document.dispatchEvent(new Event('tema-mudou'));      // (tema.js carrega primeiro: não usa o Util)
  }
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(atual)); } catch {} };
  aplicar();
  return {
    PADRAO, PRESETS, FONTES, aplicar, salvar, limparNome,
    get atual() { return atual; },
    definir(x) { atual = mesclar(x); aplicar(); salvar(); },
    restaurar() { atual = clone(PADRAO); aplicar(); salvar(); }
  };
})();