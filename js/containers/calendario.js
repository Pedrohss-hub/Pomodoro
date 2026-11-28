/* Tipo de container "calendario": mostra o mês inteiro com os itens da Agenda em cada dia.
   Não lê a planilha: pega os itens de quem os publica (ctx.consultar('agenda-itens'), ver agenda.js) e se refaz sozinho quando a agenda
   chega ou muda (evento 'agenda-atualizada'). É só para olhar: para criar, editar ou concluir um item use a Agenda.
   O que aparece:
     - cada dia mostra os itens (hora + descrição); em espaço estreito (celular, coluna lateral) mostra só pontinhos, um por item
     - hoje fica marcado; os dias do mês anterior/seguinte só têm o número mais claro (nada apagado)
     - só os itens que JÁ PASSARAM ficam apagados (dias antes de hoje; hoje, os de hora anterior à de agora); os concluídos também ficam riscados (dá para esconder no ⚙)
     - passar o mouse num dia que tem itens mostra uma dica com eles (dia sem itens não mostra nada); no toque vale o clique
     - itens da categoria em destaque (padrão "Imp", a mesma marca dos gráficos) ficam dourados
     - clicar num dia abre um pop-up com os itens dele; ‹ › trocam de mês e "Hoje" volta ao mês de agora
   Configuração (em js/paginas.js ou no ⚙ do quadro): { titulo, concluidas, inicio, destaque, maximo }
     concluidas  true = mostra também os concluídos, riscados (padrão); false = esconde
     inicio      0 = a semana começa no domingo (padrão); 1 = na segunda
     destaque    categoria em destaque ("" = nenhuma); maximo = quantos itens cabem por dia antes do "+N" (padrão 3)
     corCategoria  true = cada item leva a cor da sua categoria (Categorias e cores); o destaque dourado continua mandando; desligado = como sempre
   Carregue depois de containers.js; estilos em css/calendario.css. Não grava nada. */
Containers.registrar('calendario', ctx => {
  const PADRAO = { titulo: 'Calendário', concluidas: true, inicio: 0, destaque: 'Imp', maximo: 3, corCategoria: false };
  const c = () => Object.assign({}, PADRAO, ctx.def());              // configuração de agora (padrão + o que você mudou)
  const h = Util.h;
  const MESES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const DIA_LONGO = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const DIA_CURTO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
  const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);
  const chave = (a, m, d) => a + '-' + m + '-' + d;
  const hoje = () => { const t = new Date(); return [t.getFullYear(), t.getMonth(), t.getDate()]; };
  let vis = hoje().slice(0, 2);                                       // mês em tela: [ano, mês 0-11]
  let diaHoje = chave(...hoje());

  /* ---------- HTML do container (só texto fixo: nada digitado por você entra aqui) ---------- */
  const raiz = h('section', 'box cal-box');
  raiz.innerHTML = `
    <div class="box-topo"><h2 class="cal-titulo"></h2>
      <div class="acoes-topo">
        <button type="button" class="mini cal-ant" title="Mês anterior" aria-label="Mês anterior">‹</button>
        <strong class="cal-mes" aria-live="polite"></strong>
        <button type="button" class="mini cal-prox" title="Próximo mês" aria-label="Próximo mês">›</button>
        <button type="button" class="mini cal-hoje" title="Voltar para o mês de hoje">Hoje</button>
        <button type="button" class="mini cal-engrenagem" title="Configurar o calendário" aria-label="Configurar o calendário">⚙</button></div>
    </div>
    <div class="cal-semana" aria-hidden="true"></div>
    <div class="cal-grade"></div>`;
  const q = s => raiz.querySelector(s);
  const grade = q('.cal-grade');

  const dlg = Util.dialogo('dlg-cal', `
    <div class="dlg-corpo">
      <div class="dlg-topo"><h2 class="cal-d-titulo"></h2><button type="button" class="fechar">Fechar</button></div>
      <div class="cal-d-lista"></div>
      <p class="dica">Para criar, editar ou concluir itens, use a Agenda.</p>
    </div>`);
  const qd = s => dlg.querySelector(s);

  /* ---------- os itens da agenda, agrupados por dia ---------- */
  function porDia() {
    const mapa = new Map();
    ctx.consultar('agenda-itens').forEach(x => {
      if (!c().concluidas && x.feita) return;
      const k = chave(...x.t); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(x);
    });
    mapa.forEach(l => l.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99')));      // dentro do dia: por hora; sem hora vai para o fim
    return mapa;
  }
  const ehDestaque = x => !!c().destaque && x.cat.toLowerCase() === c().destaque.trim().toLowerCase();
  // já passou? (dia antes de hoje; ou hoje, com hora anterior à de agora; item de hoje sem hora ainda não passou)
  const passou = x => {
    const [a, m, d] = hoje(), dia = new Date(x.t[0], x.t[1], x.t[2]).getTime(), h0 = new Date(a, m, d).getTime();
    if (dia !== h0) return dia < h0;
    if (!x.hora) return false;
    const n = new Date(); return x.hora < String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  };
  // cor da categoria (só com a opção ligada): vai numa variável CSS (--cat) que css/categorias.css usa
  const corar = (el, x) => { const k = c().corCategoria ? Categorias.cor(x.cat) : ''; if (k) { el.classList.add('cat-cor'); el.style.setProperty('--cat', k); } return el; };
  const classeItem = x => (x.feita ? ' feita' : '') + (ehDestaque(x) ? ' imp' : '') + (passou(x) ? ' passado' : '');

  /* ---------- desenhar o mês ---------- */
  function render() {
    q('.cal-titulo').textContent = c().titulo;
    q('.cal-mes').textContent = maiuscula(MESES.format(new Date(vis[0], vis[1], 1)));
    const ini = c().inicio === 1 ? 1 : 0;
    q('.cal-semana').replaceChildren(...Array.from({ length: 7 }, (_, i) => h('span', null, SEMANA[(i + ini) % 7])));
    const primeiro = new Date(vis[0], vis[1], 1), desloc = (primeiro.getDay() - ini + 7) % 7;
    const dias = new Date(vis[0], vis[1] + 1, 0).getDate(), semanas = Math.ceil((desloc + dias) / 7);
    const mapa = porDia(), max = Math.max(1, Math.round(Number(c().maximo)) || 3);
    const cels = [];
    for (let i = 0; i < semanas * 7; i++) {
      const d = new Date(vis[0], vis[1], 1 - desloc + i), k = chave(d.getFullYear(), d.getMonth(), d.getDate()), itens = mapa.get(k) || [];
      const b = h('button', 'cal-dia' + (d.getMonth() !== vis[1] ? ' fora' : '') + (k === diaHoje ? ' hoje' : '') + (itens.length ? ' tem' : ''));
      b.type = 'button'; b.dataset.dia = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      b.setAttribute('aria-label', DIA_CURTO.format(d) + (itens.length ? ', ' + (itens.length === 1 ? '1 item' : itens.length + ' itens') : ', sem itens'));
      b.append(h('span', 'cal-num', String(d.getDate())));
      const lista = h('span', 'cal-itens'), pontos = h('span', 'cal-pontos');
      itens.slice(0, max).forEach(x => {
        const it = corar(h('span', 'cal-item' + classeItem(x)), x);
        if (x.hora) it.append(h('small', null, x.hora));
        it.append(document.createTextNode(x.desc)); lista.append(it);
      });
      if (itens.length > max) lista.append(h('span', 'cal-mais', '+' + (itens.length - max)));
      itens.slice(0, 6).forEach(x => pontos.append(corar(h('i', 'cal-ponto' + classeItem(x)), x)));
      if (itens.length > 6) pontos.append(h('small', null, '+'));
      b.append(lista, pontos); cels.push(b);
    }
    grade.style.setProperty('--cal-linhas', String(semanas));
    esconderDica(); grade.replaceChildren(...cels);
  }

  /* ---------- a dica ao passar o mouse (só em dia com itens; fica no <body>: o .painel-estudo tem transform e prenderia um fixed) ---------- */
  const dica = h('div', 'cal-dica'); dica.setAttribute('role', 'tooltip'); dica.hidden = true; document.body.append(dica);
  let dicaDe = null;
  function esconderDica() { dica.hidden = true; dicaDe = null; }
  function mostrarDica(b) {
    const [a, m, d] = b.dataset.dia.split('-').map(Number), itens = porDia().get(chave(a, m, d)) || [];
    if (!itens.length) return esconderDica();                        // dia vazio: nada de dica
    dicaDe = b;
    dica.replaceChildren(h('strong', 'cal-dica-dia', maiuscula(DIA_CURTO.format(new Date(a, m, d)))), ...itens.map(x => {
      const li = h('div', 'cal-dica-item' + classeItem(x)), meta = h('small', null, x.hora || 'Dia todo');
      li.append(meta, h('span', 'cal-dica-desc', x.desc));
      if (x.cat) li.append(h('em', null, x.cat));
      return li;
    }));
    dica.hidden = false;
    const r = b.getBoundingClientRect(), w = dica.offsetWidth, alt = dica.offsetHeight;
    let top = r.bottom + 6; if (top + alt > innerHeight - 8) top = Math.max(8, r.top - alt - 6);      // sem espaço embaixo: vai para cima
    dica.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px'; dica.style.top = top + 'px';
  }
  const diaDe = ev => ev.target.closest && ev.target.closest('.cal-dia');
  grade.addEventListener('pointerover', ev => { if (ev.pointerType !== 'mouse') return; const b = diaDe(ev); if (b && b !== dicaDe) mostrarDica(b); });
  grade.addEventListener('pointerout', ev => { const b = diaDe(ev); if (b && !b.contains(ev.relatedTarget)) esconderDica(); });
  grade.addEventListener('focusin', ev => { const b = diaDe(ev); if (b) mostrarDica(b); });             // pelo teclado também
  grade.addEventListener('focusout', esconderDica);
  addEventListener('scroll', esconderDica, true);

  /* ---------- o pop-up do dia ---------- */
  function abrirDia(a, m, d) {
    qd('.cal-d-titulo').textContent = maiuscula(DIA_LONGO.format(new Date(a, m, d)));
    const itens = porDia().get(chave(a, m, d)) || [];
    qd('.cal-d-lista').replaceChildren(...(itens.length ? itens.map(x => {
      const li = h('div', 'cal-d-item' + classeItem(x));
      const corpo = h('div'), meta = h('div', 'cal-d-meta');
      meta.append(h('span', null, x.hora || 'Dia todo'));
      if (x.cat) meta.append(corar(h('span', 'ag-tag', x.cat), x));
      if (x.feita) meta.append(h('span', null, '✓ concluído'));
      corpo.append(h('div', 'cal-d-desc', x.desc), meta); li.append(corpo); return li;
    }) : [h('p', 'ag-msg', 'Nada marcado neste dia.')]));
    dlg.showModal();
  }
  grade.addEventListener('click', ev => {
    const b = ev.target.closest('.cal-dia'); if (!b) return;
    esconderDica();
    const [a, m, d] = b.dataset.dia.split('-').map(Number); abrirDia(a, m, d);
  });

  /* ---------- navegação ---------- */
  const mover = n => { const d = new Date(vis[0], vis[1] + n, 1); vis = [d.getFullYear(), d.getMonth()]; render(); };
  q('.cal-ant').onclick = () => mover(-1);
  q('.cal-prox').onclick = () => mover(1);
  q('.cal-hoje').onclick = () => { vis = hoje().slice(0, 2); render(); };

  /* ---------- configuração: o ⚙ abre o painel padrão ao lado ---------- */
  const CAMPOS = [
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
    { chave: 'inicio', rotulo: 'A semana começa na', tipo: 'selecao', numero: true, opcoes: [[0, 'Domingo'], [1, 'Segunda']] },
    { chave: 'concluidas', rotulo: 'Mostrar também os itens concluídos (riscados)', tipo: 'caixa' },
    { chave: 'destaque', rotulo: 'Categoria em destaque', tipo: 'texto', dica: 'Os itens dessa categoria ficam dourados (como nos gráficos). Deixe vazio para não destacar.' },
    { chave: 'maximo', rotulo: 'Itens por dia antes do "+N"', tipo: 'numero', min: 1, max: 8 },
    { chave: 'corCategoria', rotulo: 'Cor das categorias nos itens', tipo: 'caixa', dica: 'Cada item leva a cor da categoria dele (o destaque dourado continua valendo).' },
    { tipo: 'botao', rotulo: 'Categorias e cores…', acao: () => Categorias.abrirEditor() }
  ];
  q('.cal-engrenagem').onclick = () => Painel.abrir({
    id: 'cfg:' + ctx.id, titulo: c().titulo, subtitulo: 'Calendário · as mudanças valem na hora', alvo: raiz, campos: CAMPOS, valores: c,
    aoMudar(chaveCampo, valor) { ctx.ajustar({ [chaveCampo]: valor }); render(); Painel.titulo(c().titulo); }
  });

  document.addEventListener('agenda-atualizada', render);
  document.addEventListener('categorias-mudou', render);             // criou, renomeou ou pintou uma categoria             // a agenda chegou ou mudou (inclusive concluir/desmarcar)
  // a cada minuto: virou o dia (muda a marca de hoje) ou algum item passou da hora (fica apagado); só redesenha se algo mudou, para não sumir com a dica
  const assinatura = () => [...porDia().values()].flat().map(x => (passou(x) ? 1 : 0)).join('');
  let ass = '';
  setInterval(() => { const k = chave(...hoje()), s = assinatura(); if (k !== diaHoje || s !== ass) { diaHoje = k; ass = s; render(); } }, 60000);

  return {
    raiz,
    iniciar() {
      render(); ass = assinatura();
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => raiz.classList.toggle('em-foco', en.isIntersecting), { rootMargin: '0px 0px -45% 0px' }).observe(raiz);
      else raiz.classList.add('em-foco');
    },
    aparecer() { render(); }
  };
});