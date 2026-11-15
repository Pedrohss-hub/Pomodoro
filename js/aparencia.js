/* Painel de Aparência (usa o Tema definido em tema.js). */
(() => {
  const T = Tema, q = s => document.querySelector(s);
  const dlg = q('#dlg-aparencia');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const GRUPOS = [
    ['Base', [['bg', 'Fundo'], ['card', 'Cartões'], ['ink', 'Texto'], ['soft', 'Texto secundário'], ['line', 'Bordas']]],
    ['Destaques', [['foco', 'Foco'], ['curta', 'Pausa curta'], ['longa', 'Pausa longa'], ['extra', 'Tempo extra'], ['ok', 'Concluído'], ['aviso', 'Aviso'], ['erro', 'Erro'], ['sobre', 'Texto sobre destaque']]],
    ['Disciplinas e gráficos', [['obr', 'Obrigatória'], ['ele', 'Optativa eletiva'], ['liv', 'Optativa livre'], ['liq', 'Tempo líquido'], ['per', 'Tempo perdido']]]
  ];
  const MEDIDAS = [
    ['escala', 'Tamanho do texto', .8, 1.3, .05, v => Math.round(v * 100) + '%'],
    ['btn', 'Tamanho dos botões', .8, 1.5, .05, v => Math.round(v * 100) + '%'],
    ['esp', 'Espaço entre containers', 0, 2.5, .1, v => '×' + v.toFixed(1)],
    ['pad', 'Espaço dentro dos containers', .5, 2, .1, v => '×' + v.toFixed(1)],
    ['raio', 'Arredondamento', 0, 2, .1, v => '×' + v.toFixed(1)],
    ['largura', 'Largura da página', 40, 100, 2, v => v + ' rem']
  ];
  const json = () => { if (document.activeElement !== q('#ap-json')) q('#ap-json').value = JSON.stringify(T.atual, null, 2); };

  // temas prontos
  Object.values(T.PRESETS).forEach(p => {
    const b = el('button', 'ap-tema'); b.type = 'button';
    [p.cores.bg, p.cores.foco, p.cores.curta].forEach(c => { const i = el('i'); i.style.background = c; b.append(i); });
    b.append(p.nome);
    b.onclick = () => { Object.assign(T.atual.cores, p.cores); T.aplicar(); T.salvar(); sincronizar(); };
    q('#ap-temas').append(b);
  });
  // cores
  GRUPOS.forEach(([titulo, itens]) => {
    q('#ap-cores').append(el('h3', 'ap-h', titulo));
    const g = el('div', 'ap-grade-cores');
    itens.forEach(([k, nome]) => {
      const lab = el('label', 'ap-cor'), inp = el('input');
      inp.type = 'color'; inp.dataset.cor = k;
      lab.append(inp, el('span', null, nome)); g.append(lab);
    });
    q('#ap-cores').append(g);
  });
  // medidas
  MEDIDAS.forEach(([k, nome, min, max, passo]) => {
    const lab = el('label', 'ap-med'), out = el('output'), inp = el('input');
    out.dataset.m = k; inp.type = 'range'; inp.min = min; inp.max = max; inp.step = passo; inp.dataset.med = k;
    lab.append(el('span', null, nome), out, inp); q('#ap-medidas').append(lab);
  });
  // fontes
  T.FONTES.forEach(f => q('#ap-fonte').append(new Option(f.nome, f.nome)));
  q('#ap-fonte').append(new Option('Outra (digite abaixo)', ''));

  function sincronizar() {
    const a = T.atual;
    dlg.querySelectorAll('input[data-cor]').forEach(i => { i.value = a.cores[i.dataset.cor]; });
    MEDIDAS.forEach(([k, , , , , fmt]) => {
      dlg.querySelector('input[data-med="' + k + '"]').value = a.medidas[k];
      dlg.querySelector('output[data-m="' + k + '"]').textContent = fmt(Number(a.medidas[k]));
    });
    const conhecida = T.FONTES.some(f => f.nome === a.fonte.nome);
    q('#ap-fonte').value = conhecida ? a.fonte.nome : '';
    q('#ap-fonte-outra').value = conhecida ? '' : a.fonte.nome;
    json();
  }

  // ao vivo: arrastar/escolher já muda o site; ao soltar, os gráficos são redesenhados
  dlg.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.cor) T.atual.cores[t.dataset.cor] = t.value;
    else if (t.dataset.med) {
      T.atual.medidas[t.dataset.med] = Number(t.value);
      const m = MEDIDAS.find(x => x[0] === t.dataset.med);
      dlg.querySelector('output[data-m="' + t.dataset.med + '"]').textContent = m[5](Number(t.value));
    } else return;
    T.aplicar(undefined, false); T.salvar(); json();
  });
  dlg.addEventListener('change', ev => { if (ev.target.dataset.cor || ev.target.dataset.med) T.aplicar(); });

  q('#ap-fonte').onchange = e => { if (!e.target.value) { q('#ap-fonte-outra').focus(); return; } T.atual.fonte = { nome: e.target.value }; T.aplicar(); T.salvar(); sincronizar(); };
  q('#ap-fonte-usar').onclick = () => {
    const nome = T.limparNome(q('#ap-fonte-outra').value);
    if (!nome) return;
    T.atual.fonte = { nome }; T.aplicar(); T.salvar(); sincronizar();
  };
  q('#ap-fonte-outra').onkeydown = e => { if (e.key === 'Enter') q('#ap-fonte-usar').click(); };

  const msg = t => { q('#ap-json-msg').textContent = t; setTimeout(() => { q('#ap-json-msg').textContent = ''; }, 2500); };
  q('#ap-json-aplicar').onclick = () => {
    try { T.definir(JSON.parse(q('#ap-json').value)); sincronizar(); msg('Tema aplicado.'); }
    catch { msg('JSON inválido.'); }
  };
  q('#ap-json-copiar').onclick = async () => {
    try { await navigator.clipboard.writeText(q('#ap-json').value); msg('Copiado.'); } catch { q('#ap-json').select(); msg('Selecionado: use Ctrl+C.'); }
  };
  q('#ap-restaurar').onclick = () => { if (confirm('Voltar todas as cores, fonte e medidas ao padrão?')) { T.restaurar(); sincronizar(); } };

  q('#btn-aparencia').onclick = () => { if (dlg.open) dlg.close(); else { sincronizar(); dlg.show(); } };
  sincronizar();
})();
