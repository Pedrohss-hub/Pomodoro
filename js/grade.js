/* Planejador de grade curricular e navegação entre as páginas (abas). Depende de pomodoro.js. */
(() => {
  const MAXP = 15, IDEAL = 10;
  const CURTO = { obr: 'Obrigatória', ele: 'Eletiva', liv: 'Livre' };

  // Nomes e créditos (aula|trabalho) tirados do documento do IME; ajuste à vontade na própria página
  const NOMES = `
MAT0450|Seminário de Resolução de Problemas|4|2|I
MAT0412|Análise de Textos Didáticos|4|2|I
MAC0118|Noções de Ensino de Matemática Usando o Computador|4|2|I
MAE1514|Estatística no Ensino Básico|4|2|I
MAT0465|Tópicos em Ensino e Aprendizagem de Matemática I|4|2|I
MAT0466|Tópicos em Ensino e Aprendizagem de Matemática II|4|2|I
MAT0467|Tópicos em Ensino e Aprendizagem de Matemática III|4|2|I
MAT0468|Tópicos em Ensino e Aprendizagem de Matemática IV|4|2|I
MAT0451|Projeto de Ensino de Matemática (anual)|8|4|II
MAT0130|Equações Diferenciais Ordinárias e Aplicações|4|0|III
MAT0214|Tópicos de Álgebra|4|0|III
MAT0222|Álgebra Linear II|4|0|III
MAT0223|Introdução à Teoria dos Números|4|0|III
MAT0225|Funções Analíticas|4|0|III
MAT0226|Equações Diferenciais I|4|0|III
MAT0233|Tópicos de Grupos e Aplicações|4|0|III
MAT0311|Cálculo Diferencial e Integral V|6|0|III
MAT0317|Topologia|4|0|III
MAT0326|Geometria Diferencial I|4|0|III
MAT0320|Introdução à Análise Complexa|4|0|III
MAT0349|Introdução à Lógica|4|0|III
MAT0418|Cálculo das Variações|4|0|III
MAT0419|Geometria Projetiva e Desenho|4|0|III
MAT0421|Geometria não Euclidiana|4|0|III
MAT0430|História da Matemática II|4|0|III
MAC0121|Algoritmos e Estruturas de Dados I|4|0|IV
MAC0122|Princípio de Desenvolvimento de Algoritmos|4|0|IV
MAC0239|Introdução à Lógica e Verificação de Programas|4|0|IV
MAC0320|Introdução à Teoria dos Grafos|4|0|IV
MAC0329|Álgebra Booleana e Aplicações no Projeto de Arquitetura de Computadores|4|0|IV
MAP2210|Aplicações de Álgebra Linear|4|0|IV
MAP2220|Fundamentos de Análise Numérica|4|0|IV
MAE0111|Análise Exploratória de Dados|4|0|V
MAE0228|Noções de Probabilidade e Processos Estocásticos|4|0|V
MAE0301|Inferência Frequentista|6|0|V
MAE0302|Inferência Bayesiana|4|0|V
4300254|Laboratório de Mecânica|2|0|VI
4300255|Mecânica dos Corpos Rígidos e dos Fluidos|4|2|VI
4300271|Eletricidade e Magnetismo II|4|2|VI
4300357|Oscilações e Ondas|2|0|VI
4300270|Eletricidade e Magnetismo I|4|0|VI
4300373|Laboratório de Eletromagnetismo|4|0|VI
4300374|Relatividade|2|0|VI
4300159|Física do Calor|4|0|VI
4300259|Termo-estatística|4|0|VI
4300405|Evolução dos Conceitos da Física|2|0|VI
4300266|Partículas: a dança da matéria e dos campos|4|0|VI
4300351|Física do Meio Ambiente|2|0|VI
AGA0215|Fundamentos de Astronomia|4|0|VI
AGA0317|Experimentos de Astronomia|2|0|VI
4300356|Elementos e Estratégias para o Ensino de Física|4|0|VII
4300358|Propostas e Projetos para o Ensino de Física|4|0|VII
EDM0425|Metodologia do Ensino de Física I|4|2|VII,EST
EDM0426|Metodologia do Ensino de Física II|4|2|VII,EST
EDF0285|Introdução aos Estudos da Educação: Enfoque Filosófico|4|0|IEE
EDF0287|Introdução aos Estudos da Educação: Enfoque Histórico|4|0|IEE
EDF0289|Introdução aos Estudos da Educação: Enfoque Sociológico|4|0|IEE
PSA5100|As Explicações do Fracasso Escolar|3|2|IEE
4705291|Educação Escolar Inclusiva|3|3|IEE
EDF0290|Práticas Escolares, Contemporaneidade e Processos de Subjetivação|4|1|PSI
EDF0292|A Psicologia Histórico-cultural e a Compreensão do Fenômeno Educacional|4|1|PSI
EDF0294|A Psicanálise, Educação e Cultura|4|1|PSI
EDF0296|Psicologia da Educação: uma Abordagem Psicossocial do Cotidiano|4|1|PSI
EDF0298|Práticas Escolares, Diversidade, Subjetividade|4|1|PSI
EDM0685|Experimentação e Modelagem|1|2|EST`;

  // Obrigatórias na ordem da grade ideal: [período, concluídas, ainda não feitas]
  // (o progresso de cada pessoa fica só no navegador; para trazer o seu, use Configurações > Dados e backup > Importar)
  const OBR = [
    [1, '', 'MAT0105 MAT0153 MAT1351 MAT0102'],
    [2, '', '4300156 MAT0154 MAT0134 MAT1352'],
    [3, '', '4300160 MAE1511 MAT0120 MAT0201 MAT2351'],
    [4, '', 'MAC0110 MAE1512 MAT0203 MAT0315 MAT2352'],
    [5, '', '4300152 MAP0151 MAT0231'],
    [6, '', '4310232 EDM0402 MAT0202 MAT0230'],
    [7, '', 'MAT0240 MAT1500'],
    [8, '', 'EDA0463 MAT0341'],
    [9, '', '4800400 EDM0427 MAT0310'],
    [10, '', 'EDM0428 MAT0331']
  ];
  const NOMES_OBR = {
    '4300160': 'Ótica',
    'MAT0202': 'Laboratório de Projetos e Tecnologias no Ensino de Matemática',
    'MAT0203': 'Atividades Extensionistas para Licenciatura em Matemática',
    'MAT1500': 'Projetos de Estágio'
  };
  const LIVRES = 'ACA0115 ACA0221 ACA0223 ACA0226 ACA0245 ACA0324 ACA0330 ACA0336 ACA0410 ACA0415 ACA0522 ACA0537'.split(' ');

  // Blocos: [chave, rótulo curto, nome completo]
  const BLOCOS = [
    ['I', 'Bloco I', 'Elementos para o Ensino de Matemática'],
    ['II', 'Bloco II', 'Projeto de Ensino de Matemática'],
    ['III', 'Bloco III', 'Matemática'],
    ['IV', 'Bloco IV', 'Computação e Matemática Aplicada'],
    ['V', 'Bloco V', 'Probabilidade e Estatística'],
    ['VI', 'Bloco VI', 'Física'],
    ['VII', 'Bloco VII', 'Ensino de Física'],
    ['IEE', 'Intro. à Educação', 'Introdução aos Estudos da Educação'],
    ['PSI', 'Psicologia', 'Psicologia da Educação'],
    ['EST', 'Estágio', 'Eletivas de Estágio']
  ];
  const APROF = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const BL = Object.fromEntries(BLOCOS.map(b => [b[0], b]));
  const rotuloBloco = k => BL[k] ? BL[k][1] : k;
  const nomeBloco = k => !BL[k] ? k : APROF.includes(k) ? BL[k][1] + ' · ' + BL[k][2] : BL[k][2];

  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const novoId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const horas = d => d.aula * 15 + d.trab * 30;          // 1 crédito-aula = 15 h; 1 crédito-trabalho = 30 h
  const credStr = (a, t) => (a || t) ? (t ? a + '+' + t : String(a)) + ' cr' : '— cr';
  const okPar = (d, p) => d.par === 'any' || (d.par === 'impar') === (p % 2 === 1);
  const letra = p => p % 2 ? 'I' : 'P';                    // I = períodos ímpares (1º, 3º…), P = pares (2º, 4º…)
  const txtPar = d => d.par === 'impar' ? 'I (1º, 3º, 5º…)' : 'P (2º, 4º, 6º…)';

  // Completa campos que faltam e converte o formato antigo (campo "bloco" em texto livre)
  function normalizar(d) {
    const o = Object.assign({ id: novoId(), codigo: '', nome: '', tipo: 'ele', aula: 0, trab: 0, par: 'any', periodo: null, feita: false, blocos: [], obs: '' }, d);
    if (!Array.isArray(o.blocos)) o.blocos = [];
    if (typeof o.bloco === 'string') {
      const s = o.bloco, ach = [];
      (s.match(/Bloco (VII|VI|V|IV|III|II|I)(?![IVX])/g) || []).forEach(x => ach.push(x.slice(6)));
      if (/Intro/.test(s)) ach.push('IEE');
      if (/Psicologia/.test(s)) ach.push('PSI');
      if (/Est[áa]gio/.test(s)) ach.push('EST');
      if (!ach.length && s && !o.obs) o.obs = s;
      o.blocos = [...new Set(o.blocos.concat(ach))];
      delete o.bloco;
    }
    return o;
  }

  function seed() {
    const out = [];
    const add = (codigo, tipo, periodo, feita, info, par) => {
      info = info || {};
      out.push({ id: novoId(), codigo, nome: info.nome || '', tipo, aula: info.aula || 0, trab: info.trab || 0,
        par, periodo, feita, blocos: info.blocos || [], obs: '' });
    };
    const opt = NOMES.trim().split('\n').map(l => {
      const [c, n, a, t, b] = l.split('|');
      return [c, { nome: n, aula: +a, trab: +t, blocos: b ? b.split(',') : [] }];
    });
    const mapa = new Map(opt);
    OBR.forEach(([p, ok, falta]) => {
      const par = p % 2 ? 'impar' : 'par';
      ok.split(' ').filter(Boolean).forEach(c => add(c, 'obr', p, true, { nome: NOMES_OBR[c] }, par));
      falta.split(' ').filter(Boolean).forEach(c => add(c, 'obr', p, false, { nome: NOMES_OBR[c] }, par));
    });
    opt.forEach(([c, info]) => add(c, 'ele', null, false, info, 'any'));
    LIVRES.forEach(c => add(c, 'liv', null, false, {}, 'any'));
    return out;
  }

  let G = (() => {
    const s = LS.get('grade-v2', null) || LS.get('grade-v1', null);
    if (s && Array.isArray(s.dis)) return { dis: s.dis.map(normalizar), atual: s.atual || null, recolher: s.recolher !== false };
    return { dis: seed(), atual: null, recolher: true };
  })();
  let filtro = 'todas', fb = 'todos', busca = '';
  const salvar = () => LS.set('grade-v2', G);
  const achar = id => G.dis.find(d => d.id === id);

  // Período atual: o escolhido, ou o seguinte ao último período com disciplina concluída
  function atualEf() {
    if (G.atual) return G.atual;
    const ps = G.dis.filter(d => d.feita && d.periodo != null).map(d => d.periodo);
    return Math.min(MAXP, (ps.length ? Math.max(...ps) : 0) + 1);
  }

  /* ---------- desenho ---------- */
  function cartao(d, noBanco) {
    const c = el('div', 'pl-card t-' + d.tipo + (d.feita ? ' feita' : ''));
    c.dataset.id = d.id; c.tabIndex = 0;
    const conflito = d.periodo != null && !okPar(d, d.periodo);
    const atrasada = d.periodo != null && d.periodo < atualEf() && !d.feita;
    if (conflito) c.classList.add('aviso');
    if (atrasada) c.classList.add('atrasada');
    c.title = [d.codigo, d.nome, CURTO[d.tipo], d.blocos.map(rotuloBloco).join(', '), horas(d) ? horas(d) + ' h' : '', atrasada ? 'pendente em período passado' : '']
      .filter(Boolean).join(' · ') + ' — clique para editar';

    const l1 = el('div', 'pl-l1');
    l1.append(el('span', 'pl-cod', d.codigo || '(sem código)'));
    const lado = el('span', 'pl-lado');
    const chk = el('button', 'pl-chk', '✓'); chk.type = 'button';
    chk.title = d.feita ? 'Concluída (clique para desmarcar)' : 'Marcar como concluída';
    chk.setAttribute('aria-label', chk.title); chk.setAttribute('aria-pressed', String(d.feita));
    const alca = el('span', 'pl-alca', '⋮⋮'); alca.title = 'Arraste por aqui';
    lado.append(chk, alca);
    l1.append(lado);

    const nome = el('div', 'pl-nome' + (d.nome ? '' : ' sem'), d.nome || 'sem nome — clique para editar');
    const rod = el('div', 'pl-rod');
    rod.append(el('span', null, credStr(d.aula, d.trab) + (horas(d) ? ' · ' + horas(d) + ' h' : '')));
    rod.append(el('span', 'pl-tag', CURTO[d.tipo]));
    if (d.par !== 'any') rod.append(el('span', 'pl-tag' + (conflito ? ' erro' : ''), d.par === 'impar' ? 'só I' : 'só P'));
    if (noBanco) d.blocos.forEach(k => rod.append(el('span', null, rotuloBloco(k))));
    c.append(l1, nome, rod);
    return c;
  }

  function desenharResumo() {
    const box = $('#pl-resumo'); box.replaceChildren();
    const stat = (v, r, cls) => { const s = el('div', 'pl-stat' + (cls ? ' ' + cls : '')); s.append(el('b', null, v), el('span', null, r)); box.append(s); };
    const feitas = G.dis.filter(d => d.feita);
    const sa = feitas.reduce((s, d) => s + d.aula, 0), st = feitas.reduce((s, d) => s + d.trab, 0);
    const hf = feitas.reduce((s, d) => s + horas(d), 0);
    const obr = G.dis.filter(d => d.tipo === 'obr');
    const soltasObr = obr.filter(d => !d.feita && d.periodo == null).length;
    const conflitos = G.dis.filter(d => d.periodo != null && !okPar(d, d.periodo)).length;
    const atrasadas = G.dis.filter(d => d.periodo != null && d.periodo < atualEf() && !d.feita).length;
    const ult = G.dis.reduce((m, d) => d.periodo != null ? Math.max(m, d.periodo) : m, 0);

    stat(feitas.length + ' concluídas', credStr(sa, st) + ' · ' + hf + ' h');
    stat(obr.filter(d => d.feita).length + '/' + obr.length, 'obrigatórias concluídas');
    stat(String(G.dis.filter(d => !d.feita && d.periodo != null && d.periodo >= atualEf()).length), 'planejadas a cursar');
    stat(ult ? ult + 'º período' : '—', ult === 0 ? 'término previsto' : ult <= IDEAL ? 'término previsto · dentro do ideal (' + IDEAL + ')' : 'término previsto · acima do ideal (' + IDEAL + '), limite ' + MAXP, ult > IDEAL ? 'alerta' : (ult ? 'ok' : ''));
    if (atrasadas) stat(String(atrasadas), 'pendentes em períodos passados', 'alerta');
    if (soltasObr) stat(String(soltasObr), 'obrigatórias sem período', 'alerta');
    if (conflitos) stat(String(conflitos), 'conflito(s) de semestre I/P', 'alerta');
  }

  // Contador das optativas exigidas (só créditos-aula; uma disciplina "planejada" é a que tem período ou já foi concluída)
  function desenharReqs() {
    const box = $('#pl-reqs'); box.replaceChildren();
    const opt = G.dis.filter(d => d.tipo !== 'obr');
    const plan = d => d.periodo != null || d.feita;
    const soma = l => l.reduce((s, d) => s + d.aula, 0);
    const doBloco = k => opt.filter(d => d.blocos.includes(k));

    const bl = APROF.map(k => { const l = doBloco(k); return { k, feito: soma(l.filter(d => d.feita)), plan: soma(l.filter(plan)) }; });
    const melhor = l => l.slice().sort((a, b) => b.plan - a.plan || b.feito - a.feito)[0];
    const um = melhor(bl.filter(b => b.k === 'I' || b.k === 'II'));
    const dois = melhor(bl.filter(b => b !== um));
    const esc = [um, dois];
    const apFeito = esc.reduce((s, b) => s + Math.min(8, b.feito), 0), apPlan = esc.reduce((s, b) => s + Math.min(8, b.plan), 0);

    function card(titulo, plano, feito, meta, unid, sub, opts = {}) {
      const c = el('div', 'pl-req' + (plano >= meta ? ' ok' : '') + (opts.largo ? ' largo' : ''));
      if (opts.bloco) c.dataset.bloco = opts.bloco;
      c.append(el('div', 't', titulo));
      const v = el('div', 'v' + (opts.max && plano > opts.max ? ' passou' : ''), plano + '/' + meta + ' ' + unid);
      c.append(v);
      const barra = el('div', 'pl-barra');
      const p = el('i', 'plan'); p.style.width = Math.min(100, plano / meta * 100) + '%';
      const f = el('i', 'feito'); f.style.width = Math.min(100, feito / meta * 100) + '%';
      barra.append(p, f); c.append(barra);
      c.append(el('div', 's', sub));
      if (opts.extra) c.append(opts.extra);
      box.append(c);
    }

    const chips = el('div', 'pl-chips');
    bl.forEach(b => {
      const x = el('button', (esc.includes(b) ? 'esc' : '') + (b.plan >= 8 ? ' cheio' : ''), BL[b.k][1].replace('Bloco ', '') + ' · ' + b.plan + '/8');
      x.type = 'button'; x.dataset.filtro = b.k; x.title = nomeBloco(b.k) + ' — clique para ver as disciplinas do bloco';
      chips.append(x);
    });
    card('Aprofundamento (2 blocos de 8 cr, um deles I ou II)', apPlan, apFeito, 16, 'cr',
      apFeito + ' cr concluídos · contando ' + rotuloBloco(um.k) + ' e ' + rotuloBloco(dois.k), { largo: true, extra: chips });

    const cont = (k, titulo) => {
      const l = doBloco(k);
      card(titulo, l.filter(plan).length, l.filter(d => d.feita).length, 1, l.length === 1 ? 'disc.' : 'disc.', l.filter(d => d.feita).length + ' concluída(s) · ' + l.length + ' opções', { bloco: k });
    };
    cont('IEE', 'Intro. aos Estudos da Educação');
    cont('PSI', 'Psicologia da Educação');
    cont('EST', 'Optativa de Estágio');

    const liv = opt.filter(d => d.tipo === 'liv');
    card('Optativas livres', soma(liv.filter(plan)), soma(liv.filter(d => d.feita)), 8, 'cr', soma(liv.filter(d => d.feita)) + ' cr concluídos');
    card('Total de optativas (meta 29 a 32 cr)', soma(opt.filter(plan)), soma(opt.filter(d => d.feita)), 29, 'cr',
      soma(opt.filter(d => d.feita)) + ' cr concluídos' + (soma(opt.filter(plan)) > 32 ? ' · passou de 32' : ''), { max: 32 });
  }

  function desenharQuadro() {
    const board = $('#pl-board'), x = board.scrollLeft, atual = atualEf();
    board.replaceChildren();
    for (let p = 1; p <= MAXP; p++) {
      const lista = G.dis.filter(d => d.periodo === p);
      const col = el('div', 'pl-col' + (p > IDEAL ? ' extra' : '') + (p === IDEAL + 1 ? ' primeira-extra' : '')
        + (p === atual ? ' atual' : '') + (p < atual && G.recolher ? ' passado' : ''));
      col.dataset.zona = 'col'; col.dataset.per = p;
      const cab = el('div', 'pl-cab');
      const t = el('div'); t.append(el('b', null, p + 'º período'));
      const sa = lista.reduce((s, d) => s + d.aula, 0), st = lista.reduce((s, d) => s + d.trab, 0);
      const sm = el('small', null, letra(p) + (p > IDEAL ? ' · além do ideal' : '') + (lista.length ? ' · ' + credStr(sa, st) : ''));
      sm.title = p % 2 ? 'Semestre I (ímpar)' : 'Semestre P (par)';
      t.append(sm);
      const mais = el('button', 'mini pl-mais', '+'); mais.type = 'button'; mais.dataset.per = p;
      mais.title = 'Adicionar disciplina no ' + p + 'º período'; mais.setAttribute('aria-label', mais.title);
      cab.append(t, mais);
      const corpo = el('div', 'pl-corpo');
      lista.forEach(d => corpo.append(cartao(d, false)));
      col.append(cab, corpo);
      board.append(col);
    }
    board.scrollLeft = x;
  }

  function desenharBanco() {
    const ul = $('#pl-banco'), y = ul.scrollTop;
    ul.replaceChildren();
    const q = norm(busca);
    const todas = G.dis.filter(d => d.periodo == null);
    const itens = todas.filter(d => (filtro === 'todas' || d.tipo === filtro)
      && (fb === 'todos' || (fb === 'nenhum' ? !d.blocos.length : d.blocos.includes(fb)))
      && (!q || norm(d.codigo + ' ' + d.nome + ' ' + d.obs + ' ' + d.blocos.map(k => rotuloBloco(k) + ' ' + nomeBloco(k)).join(' ')).includes(q)));
    $('#pl-banco-tit').textContent = 'Sem período (' + todas.length + ')';
    if (!itens.length) ul.append(el('p', 'pl-vazio', todas.length ? 'Nada encontrado com esse filtro.' : 'Tudo já está num período. Arraste um cartão para cá para tirá-lo da grade.'));
    itens.forEach(d => ul.append(cartao(d, true)));
    ul.scrollTop = y;
  }

  function sincronizarControles() {
    const sel = $('#pl-atual');
    sel.options[0].textContent = 'Automático (' + atualEf() + 'º)';
    sel.value = G.atual ? String(G.atual) : '';
    $('#pl-recolher').checked = G.recolher;
  }

  function desenhar() { desenharResumo(); desenharReqs(); desenharQuadro(); desenharBanco(); sincronizarControles(); }

  /* ---------- arrastar (mouse, caneta e toque) ---------- */
  let drag = null, supClick = false, raf = 0;

  document.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('#pg-grade .pl-card');
    if (!card || ev.button > 0 || ev.target.closest('.pl-chk')) return;
    if (ev.pointerType === 'touch' && !ev.target.closest('.pl-alca')) return;   // no toque, só pela alça
    drag = { id: card.dataset.id, card, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, on: false, ghost: null, zona: null, pid: ev.pointerId, dx: 0, dy: 0 };
  });

  window.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.pid) return;
    drag.x = ev.clientX; drag.y = ev.clientY;
    if (!drag.on) {
      if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 6) return;
      comecar();
    }
    mover();
  });
  window.addEventListener('pointerup', ev => { if (drag && ev.pointerId === drag.pid) terminar(true); });
  window.addEventListener('pointercancel', ev => { if (drag && ev.pointerId === drag.pid) terminar(false); });
  window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && drag && drag.on) terminar(false); });

  function comecar() {
    const d = achar(drag.id), r = drag.card.getBoundingClientRect();
    drag.on = true; drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
    const g = drag.card.cloneNode(true);
    g.classList.add('pl-ghost'); g.style.width = r.width + 'px';
    document.body.append(g); drag.ghost = g;
    drag.card.classList.add('arrastando');
    document.querySelectorAll('#pl-board .pl-col').forEach(c => c.classList.toggle('pl-bloq', !okPar(d, Number(c.dataset.per))));
    raf = requestAnimationFrame(auto);
  }

  function zonaSob() {
    const e = document.elementFromPoint(drag.x, drag.y);
    return e ? e.closest('#pg-grade [data-zona]') : null;
  }

  function mover() {
    drag.ghost.style.transform = 'translate(' + (drag.x - drag.dx) + 'px,' + (drag.y - drag.dy) + 'px) rotate(1.5deg)';
    const z = zonaSob();
    if (z !== drag.zona) {
      if (drag.zona) drag.zona.classList.remove('pl-sobre');
      if (z) z.classList.add('pl-sobre');
      drag.zona = z;
    }
  }

  // Rolagem automática: só quando o ponteiro está DENTRO do quadro, perto da borda esquerda ou direita
  function auto() {
    if (!drag || !drag.on) return;
    const b = $('#pl-board'), r = b.getBoundingClientRect();
    if (drag.y > r.top - 50 && drag.y < r.bottom + 50 && drag.x >= r.left && drag.x <= r.right) {
      if (drag.x > r.right - 70) b.scrollLeft += 16; else if (drag.x < r.left + 70) b.scrollLeft -= 16;
    }
    if (drag.y < 70) window.scrollBy(0, -14); else if (drag.y > innerHeight - 70) window.scrollBy(0, 14);
    mover();
    raf = requestAnimationFrame(auto);
  }

  function terminar(soltou) {
    const d = drag; drag = null; cancelAnimationFrame(raf);
    if (!d.on) return;
    supClick = true; setTimeout(() => { supClick = false; }, 0);
    d.ghost.remove(); d.card.classList.remove('arrastando');
    document.querySelectorAll('#pg-grade .pl-sobre, #pg-grade .pl-bloq').forEach(e => e.classList.remove('pl-sobre', 'pl-bloq'));
    if (soltou && d.zona) soltar(d.id, d.zona);
  }

  function soltar(id, zona) {
    const d = achar(id);
    if (!d) return;
    if (zona.dataset.zona === 'banco') d.periodo = null;
    else {
      const p = Number(zona.dataset.per);
      if (!okPar(d, p)) { avisar((d.codigo || d.nome) + ' só é oferecida em semestres ' + txtPar(d) + '. O ' + p + 'º período é ' + letra(p) + '.'); return; }
      d.periodo = p;
    }
    G.dis = G.dis.filter(x => x !== d); G.dis.push(d);   // vai para o fim da coluna
    salvar(); desenhar();
  }

  /* ---------- clique: concluir, editar, adicionar, filtrar por bloco ---------- */
  function filtrarBloco(k) {
    fb = k; filtro = 'todas'; busca = '';
    $('#pl-bloco').value = k; $('#pl-busca').value = '';
    document.querySelectorAll('.pl-filtros button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.f === 'todas')));
    desenharBanco();
    $('#pl-banco-box').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $('#pg-grade').addEventListener('click', ev => {
    if (supClick) return;
    const chip = ev.target.closest('.pl-chips button');
    if (chip) { filtrarBloco(chip.dataset.filtro); return; }
    const req = ev.target.closest('.pl-req[data-bloco]');
    if (req) { filtrarBloco(req.dataset.bloco); return; }
    const card = ev.target.closest('.pl-card');
    if (ev.target.closest('.pl-chk') && card) {
      const d = achar(card.dataset.id); d.feita = !d.feita; salvar(); desenhar(); return;
    }
    const mais = ev.target.closest('.pl-mais');
    if (mais) { abrir(null, Number(mais.dataset.per)); return; }
    if (card) abrir(card.dataset.id);
  });
  $('#pg-grade').addEventListener('keydown', ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('pl-card')) { ev.preventDefault(); abrir(ev.target.dataset.id); }
  });
  $('#pl-nova').onclick = () => abrir(null, null);

  /* ---------- filtros do banco ---------- */
  const selBloco = $('#pl-bloco');
  selBloco.append(new Option('Todos os blocos', 'todos'));
  BLOCOS.forEach(b => selBloco.append(new Option(nomeBloco(b[0]), b[0])));
  selBloco.append(new Option('Sem bloco', 'nenhum'));
  selBloco.onchange = () => { fb = selBloco.value; desenharBanco(); };
  $('#pl-busca').addEventListener('input', e => { busca = e.target.value; desenharBanco(); });
  document.querySelectorAll('.pl-filtros button').forEach(b => b.onclick = () => {
    filtro = b.dataset.f;
    document.querySelectorAll('.pl-filtros button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    desenharBanco();
  });

  /* ---------- período atual e recolhimento ---------- */
  const selAtual = $('#pl-atual');
  selAtual.append(new Option('Automático', ''));
  for (let p = 1; p <= MAXP; p++) selAtual.append(new Option(p + 'º período', String(p)));
  selAtual.onchange = () => { G.atual = selAtual.value ? Number(selAtual.value) : null; salvar(); desenhar(); };
  $('#pl-recolher').onchange = e => { G.recolher = e.target.checked; salvar(); desenhar(); };

  /* ---------- diálogo de edição ---------- */
  const dlg = $('#dlg-dis');
  let editId = null;
  const selPer = $('#f-per');
  selPer.append(new Option('Sem período (fica na lista ao lado)', ''));
  for (let p = 1; p <= MAXP; p++) selPer.append(new Option(p + 'º período (' + letra(p) + ')' + (p > IDEAL ? ' · além do ideal' : ''), String(p)));
  const boxBlocos = $('#f-blocos');
  BLOCOS.forEach(b => {
    const l = el('label'), i = el('input'); i.type = 'checkbox'; i.value = b[0];
    l.append(i, el('span', null, nomeBloco(b[0])));
    boxBlocos.append(l);
  });

  function atualizarHoras() {
    const a = Math.max(0, parseInt($('#f-aula').value) || 0), t = Math.max(0, parseInt($('#f-trab').value) || 0);
    $('#f-horas').textContent = 'Carga horária: ' + (a * 15 + t * 30) + ' h (1 crédito-aula = 15 h; 1 crédito-trabalho = 30 h).';
  }
  ['#f-aula', '#f-trab'].forEach(s => $(s).addEventListener('input', atualizarHoras));

  function abrir(id, per) {
    editId = id;
    const d = id ? achar(id) : { codigo: '', nome: '', tipo: 'obr', aula: 4, trab: 0, par: 'any', periodo: per || null, feita: false, blocos: [], obs: '' };
    $('#dis-titulo').textContent = id ? 'Editar disciplina' : 'Nova disciplina';
    $('#f-cod').value = d.codigo; $('#f-nome').value = d.nome; $('#f-tipo').value = d.tipo;
    $('#f-aula').value = d.aula; $('#f-trab').value = d.trab; $('#f-par').value = d.par;
    $('#f-per').value = d.periodo == null ? '' : String(d.periodo);
    $('#f-obs').value = d.obs; $('#f-feita').checked = d.feita;
    boxBlocos.querySelectorAll('input').forEach(i => { i.checked = d.blocos.includes(i.value); });
    $('#dis-erro').hidden = true; $('#dis-excluir').hidden = !id;
    atualizarHoras();
    dlg.showModal();
    $('#f-cod').focus();
  }

  $('#f-dis').addEventListener('submit', ev => {
    ev.preventDefault();
    const erro = m => { $('#dis-erro').textContent = m; $('#dis-erro').hidden = false; };
    const v = {
      codigo: $('#f-cod').value.trim().toUpperCase(), nome: $('#f-nome').value.trim(), tipo: $('#f-tipo').value,
      aula: Math.max(0, parseInt($('#f-aula').value) || 0), trab: Math.max(0, parseInt($('#f-trab').value) || 0),
      par: $('#f-par').value, periodo: $('#f-per').value ? Number($('#f-per').value) : null,
      blocos: [...boxBlocos.querySelectorAll('input:checked')].map(i => i.value),
      obs: $('#f-obs').value.trim(), feita: $('#f-feita').checked
    };
    if (!v.codigo && !v.nome) return erro('Informe pelo menos o código ou o nome.');
    if (v.periodo != null && !okPar(v, v.periodo))
      return erro('Esta disciplina só é oferecida em semestres ' + txtPar(v) + '. Escolha outro período ou mude o oferecimento.');
    if (editId) Object.assign(achar(editId), v);
    else G.dis.push({ id: novoId(), ...v });
    salvar(); desenhar(); dlg.close();
  });
  $('#dis-cancelar').onclick = () => dlg.close();
  $('#dis-excluir').onclick = () => {
    const d = achar(editId);
    if (!d || !confirm('Excluir ' + (d.codigo || d.nome) + ' da grade?')) return;
    G.dis = G.dis.filter(x => x !== d); salvar(); desenhar(); dlg.close();
  };

  /* ---------- edição em tabela (rápida) ---------- */
  const dlgTab = $('#dlg-tab'), tabCorpo = $('#tab-corpo');
  let tabBusca = '', tabTipo = 'todos', tabPer = 'todos';
  const CHAVES = BLOCOS.map(b => b[0]);
  const tabMsg = m => { const e = $('#tab-erro'); e.textContent = m; e.hidden = !m; };

  function opcoes(lista, valor, campo) {
    const s = el('select'); s.dataset.campo = campo;
    lista.forEach(([v, r]) => s.append(new Option(r, v)));
    s.value = valor; return s;
  }
  function linhaTabela(d) {
    const tr = el('tr', d.feita ? 'feita' : ''); tr.dataset.id = d.id;
    const cel = (x, cls) => { const td = el('td', cls); td.append(x); tr.append(td); };
    const campo = (tipo, valor, campo, cls) => { const i = el('input', cls); i.type = tipo; i.value = valor; i.dataset.campo = campo; return i; };
    const chk = campo('checkbox', '', 'feita'); chk.checked = d.feita; chk.title = 'Concluída';
    cel(chk, 'c');
    cel(campo('text', d.codigo, 'codigo'));
    cel(campo('text', d.nome, 'nome'));
    cel(opcoes([['obr', 'Obrigatória'], ['ele', 'Eletiva'], ['liv', 'Livre']], d.tipo, 'tipo'));
    const a = campo('number', d.aula, 'aula', 'n'); a.min = 0; a.max = 40; cel(a);
    const b = campo('number', d.trab, 'trab', 'n'); b.min = 0; b.max = 40; cel(b);
    cel(opcoes([['any', 'Todo semestre'], ['impar', 'Só I'], ['par', 'Só P']], d.par, 'par'));
    cel(opcoes([['', '—']].concat(Array.from({ length: MAXP }, (_, k) => [String(k + 1), (k + 1) + 'º ' + letra(k + 1)])), d.periodo == null ? '' : String(d.periodo), 'periodo'));
    cel(campo('text', d.blocos.join(', '), 'blocos'));
    const x = el('button', 'pl-btn perigo tab-del', '✕'); x.type = 'button'; x.title = 'Excluir esta disciplina'; cel(x, 'c');
    return tr;
  }
  function desenharTabela() {
    const q = norm(tabBusca);
    const lista = G.dis.map((d, i) => ({ d, i }))
      .filter(({ d }) => (tabTipo === 'todos' || d.tipo === tabTipo)
        && (tabPer === 'todos' || (tabPer === 'sem' ? d.periodo == null : d.periodo === Number(tabPer)))
        && (!q || norm(d.codigo + ' ' + d.nome + ' ' + d.blocos.join(' ')).includes(q)))
      .sort((a, b) => (a.d.periodo == null ? 99 : a.d.periodo) - (b.d.periodo == null ? 99 : b.d.periodo) || a.i - b.i)
      .map(x => x.d);
    tabCorpo.replaceChildren(...lista.map(linhaTabela));
    $('#tab-cont').textContent = lista.length + ' de ' + G.dis.length + ' disciplinas';
  }

  tabCorpo.addEventListener('change', ev => {
    const t = ev.target, tr = t.closest('tr'), c = t.dataset.campo;
    if (!tr || !c) return;
    const d = achar(tr.dataset.id);
    let v;
    if (c === 'feita') v = t.checked;
    else if (c === 'codigo') v = t.value.trim().toUpperCase();
    else if (c === 'nome') v = t.value.trim();
    else if (c === 'aula' || c === 'trab') v = Math.max(0, parseInt(t.value) || 0);
    else if (c === 'periodo') v = t.value ? Number(t.value) : null;
    else if (c === 'blocos') {
      const ks = t.value.toUpperCase().split(/[\s,;]+/).filter(Boolean), ruins = ks.filter(k => !BL[k]);
      if (ruins.length) { tabMsg('Bloco desconhecido: ' + ruins.join(', ') + '. Use: ' + CHAVES.join(', ') + '.'); t.value = d.blocos.join(', '); return; }
      v = [...new Set(ks)];
    } else v = t.value;
    const novo = Object.assign({}, d, { [c]: v });
    if ((c === 'periodo' || c === 'par') && novo.periodo != null && !okPar(novo, novo.periodo)) {
      tabMsg((d.codigo || d.nome || 'Esta disciplina') + ': o ' + novo.periodo + 'º período é ' + letra(novo.periodo) + ' e a disciplina só é oferecida em semestres ' + txtPar(novo) + '.');
      t.value = c === 'par' ? d.par : (d.periodo == null ? '' : String(d.periodo));
      return;
    }
    tabMsg('');
    d[c] = v;
    if (c === 'codigo' || c === 'aula' || c === 'trab') t.value = v;
    if (c === 'blocos') t.value = v.join(', ');
    tr.classList.toggle('feita', d.feita);
    salvar(); desenhar();
  });
  tabCorpo.addEventListener('click', ev => {
    const x = ev.target.closest('.tab-del'); if (!x) return;
    const d = achar(x.closest('tr').dataset.id);
    if (!d || !confirm('Excluir ' + (d.codigo || d.nome || 'esta disciplina') + ' da grade?')) return;
    G.dis = G.dis.filter(e => e !== d); salvar(); desenhar(); desenharTabela();
  });
  $('#tab-busca').addEventListener('input', e => { tabBusca = e.target.value; desenharTabela(); });
  $('#tab-tipo').onchange = e => { tabTipo = e.target.value; desenharTabela(); };
  const selTabPer = $('#tab-per');
  selTabPer.append(new Option('Todos os períodos', 'todos'), new Option('Sem período', 'sem'));
  for (let p = 1; p <= MAXP; p++) selTabPer.append(new Option(p + 'º período (' + letra(p) + ')', String(p)));
  selTabPer.onchange = e => { tabPer = e.target.value; desenharTabela(); };
  $('#tab-nova').onclick = () => {
    const d = normalizar({ tipo: 'obr', aula: 4 });
    G.dis.push(d); tabBusca = ''; tabTipo = 'todos'; tabPer = 'todos';
    $('#tab-busca').value = ''; $('#tab-tipo').value = 'todos'; selTabPer.value = 'todos';
    salvar(); desenhar(); desenharTabela();
    const tr = tabCorpo.querySelector('tr[data-id="' + d.id + '"]');
    tr.scrollIntoView({ block: 'center' }); tr.querySelector('[data-campo="codigo"]').focus();
  };
  $('#pl-tabela').onclick = () => { tabMsg(''); desenharTabela(); dlgTab.showModal(); };
  dlgTab.addEventListener('close', desenhar);

  /* ---------- backup e padrão ---------- */
  const PADRAO_KEY = 'grade-padrao-v1', DESFAZER_KEY = 'grade-desfazer-v1';
  const clonar = o => JSON.parse(JSON.stringify(o));
  const tirar = k => { try { localStorage.removeItem(k); } catch { } };
  const padraoSalvo = () => { const s = LS.get(PADRAO_KEY, null); return s && Array.isArray(s.dis) ? s : null; };
  const estadoDe = s => ({ dis: s.dis.map(normalizar), atual: s.atual || null, recolher: s.recolher !== false });
  const estadoFabrica = () => ({ dis: seed(), atual: null, recolher: true });
  function infoPadrao() {
    const s = padraoSalvo();
    $('#pl-padrao-info').textContent = s
      ? 'Padrão salvo em ' + new Date(s.salvoEm || Date.now()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ' (' + s.dis.length + ' disciplinas). "Voltar ao padrão" restaura esse estado.'
      : 'Nenhum padrão salvo ainda: "Voltar ao padrão" usa as disciplinas originais, sem os seus créditos.';
    $('#pl-desfazer').hidden = !LS.get(DESFAZER_KEY, null);
  }
  const guardarParaDesfazer = () => { LS.set(DESFAZER_KEY, { em: Date.now(), estado: clonar(G) }); };

  document.querySelectorAll('.js-padrao').forEach(b => b.onclick = () => {
    LS.set(PADRAO_KEY, Object.assign(clonar(G), { salvoEm: Date.now() }));
    infoPadrao();
    avisar('Padrão atualizado com a grade atual (' + G.dis.length + ' disciplinas).');
  });
  $('#pl-resetar').onclick = () => {
    const s = padraoSalvo();
    if (!confirm('Voltar ao ' + (s ? 'padrão que você salvou' : 'padrão original') + '? A grade atual será substituída (dá para desfazer em Configurações > Dados e backup).')) return;
    guardarParaDesfazer(); G = s ? estadoDe(s) : estadoFabrica(); salvar(); desenhar(); infoPadrao();
    avisar('Grade restaurada. Para voltar atrás: Configurações → Dados e backup → Desfazer.');
  };
  $('#pl-fabrica').onclick = () => {
    if (!confirm('Apagar o padrão salvo e voltar às disciplinas originais (sem os seus créditos)? Dá para desfazer.')) return;
    guardarParaDesfazer(); tirar(PADRAO_KEY); G = estadoFabrica(); salvar(); desenhar(); infoPadrao();
  };
  $('#pl-desfazer').onclick = () => {
    const d = LS.get(DESFAZER_KEY, null); if (!d) return;
    G = estadoDe(d.estado); salvar(); tirar(DESFAZER_KEY); desenhar(); infoPadrao();
    avisar('Grade anterior recuperada.');
  };
  $('#pl-exportar').onclick = () => {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(G, null, 2)], { type: 'application/json' }));
    a.download = 'grade-licenciatura.json'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#pl-importar').onclick = () => $('#pl-arquivo').click();
  $('#pl-arquivo').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.dis)) throw new Error('formato inesperado');
      if (!confirm('Substituir a grade atual pelas ' + j.dis.length + ' disciplinas do arquivo? (dá para desfazer)')) return;
      guardarParaDesfazer(); G = estadoDe(j); salvar(); desenhar(); infoPadrao();
    } catch (err) { avisar('Não consegui importar: ' + err.message); }
  };

  desenhar();
  infoPadrao();
})();