/* Painel de layouts: onde você escolhe, pela tela, como a página é organizada. Abre no Painel ao lado, dentro do modo "Editar layout"
   (js/core/editor-layout.js); o que você muda vale na hora e fica guardado como qualquer ajuste (navegador + Sheets, chave "paginas").
   Cada layout (área) da página é uma caixa que abre e fecha, com:
     Nome do layout          o nome que você quiser (espaços e acentos valem); vazio = volta a mostrar o id
     Largura                 Ampla (aproveita a tela larga) | Normal (a largura do site)
     Espaço entre os blocos  campo "− valor +" com deslizante (1 = normal; 0 = sem espaço); mostra o espaço real em px
     Colunas × linhas        seletor de células: passe o mouse e clique. Só tira colunas/linhas VAZIAS (as do fim); se tiver bloco, explica
     Largura de cada coluna  um campo por coluna, com unidade: fr (parte do que sobra), rem, px ou %
     Altura de cada linha    um campo por linha: auto (a do conteúdo), fr, rem ou px (rem e px = altura MÍNIMA)
     Tamanho de cada bloco   seletor de células: quantas colunas e linhas o bloco ocupa (nunca encosta em outro bloco)
     Posição na página       sobe ou desce o layout (só com 2 ou mais)
     Apagar este layout      só aparece se ele estiver vazio; para esvaziar, arraste os blocos para outro layout
   E, com 2 ou mais layouts, "Espaço entre os layouts" (o vão entre um layout e o outro).
   A grade (colunas, linhas e blocos) só se edita em tela larga (>= 72 rem), como o editor visual; em tela estreita o painel mostra só nome, largura e espaços.
   Layout antigo (tipo/pilha/coluna1) aparece aqui já convertido em colunas e linhas; ao mexer nele ele vira grade livre (o que estava guardado não é apagado).
   O botão "+ Novo layout" (no rodapé) cria um layout vazio no fim da página; arraste um bloco para dentro dele.
   Só quem o chama é o editor de layout:  PainelLayout.abrir({ pid, titulo, contar(idDoLayout) => nº de blocos, blocos(idDoLayout) => [{ id, titulo }],
                                            area(idDoLayout) => elemento do layout, destino() => elemento da página, aoAlterar() })
                                          PainelLayout.atualizar()  redesenha o painel (use depois de mover blocos)
   Carregue depois de painel.js, controles.js e roteador.js (e o editor-grade.js tem de estar carregado até a hora de abrir). Não guarda nada por conta própria:
   tudo passa por Roteador.ajustarPagina e por EditorGrade. */
const PainelLayout = (() => {
  const h = Util.h;
  const LARGURAS = [['ampla', 'Ampla'], ['normal', 'Normal']];
  const MAX = { c: 12, l: 24 };
  const UN_COLUNA = { fr: { min: .1, max: 20, passo: .5, slider: [.5, 6] }, rem: { min: 2, max: 80, passo: 1, slider: [4, 60] }, px: { min: 40, max: 2000, passo: 10, slider: [50, 800] }, '%': { min: 5, max: 100, passo: 5, slider: [5, 100] } };
  const UN_LINHA = { auto: { auto: true }, fr: UN_COLUNA.fr, rem: { min: 1, max: 80, passo: 1, slider: [2, 40] }, px: { min: 20, max: 2000, passo: 10, slider: [30, 600] } };
  const UN_ESPACO = { '×': { min: 0, max: 5, passo: .25, slider: [0, 3] } };
  const UNID = /^(\d+(?:\.\d+)?)(rem|px|%|fr)$/;
  let ctx = null;                  // { pid, titulo, contar, blocos, area, destino, aoAlterar }
  let campos = [];                 // a lista que o Painel está mostrando (trocada por dentro, sem criar outra)
  let mq = null;                   // tela larga? (a grade só se edita nela)
  const nomeDe = l => l.nome || l.id;                // o que aparece na tela: o nome dado (ou o id, se não tiver)
  const pid = () => 'layouts:' + ctx.pid;
  const aberto = () => !!(ctx && Painel.aberto() && Painel.aberto().id === pid());
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  /* ---------- tamanhos de colunas e linhas (texto <-> { n, u }) ---------- */
  function ler(v) {                                  // 1 | '2fr' | '22rem' | '30%' | 'auto'  ->  { n, u }
    if (typeof v === 'number') return { n: v, u: 'fr' };
    const m = UNID.exec(String(v));
    return m ? { n: parseFloat(m[1]), u: m[2] } : { n: 0, u: 'auto' };
  }
  const escrever = v => (v.u === 'auto' ? 'auto' : v.u === 'fr' ? v.n : v.n + v.u);   // fr volta a ser número, como o resto do projeto

  /* ---------- peças do painel ---------- */
  function mudar(id, c) {                            // guarda campos de UM layout (largura, espaço...) e redesenha
    const cur = Roteador.layouts(ctx.pid), l = cur.layouts.find(x => x.id === id);
    if (!l) return;
    Object.assign(l, c);
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts });
    depois();
  }

  function trilha(lid, eixo, i, d) {
    const lista = eixo === 'c' ? d.colunas : d.linhas, px = eixo === 'c' ? d.px.c : d.px.l;
    const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const nova = v => { const l2 = lista.slice(); l2[i] = escrever(v); return l2; };
    const converter = (de, para) => para === 'fr' ? 1 : para === 'rem' ? (px[i] || 0) / raiz : para === 'px' ? (px[i] || 0) : (px[i] || 0) / (d.larguraPx || 1) * 100;   // o tamanho de hoje, na unidade nova
    return Controles.medida({ rotulo: (eixo === 'c' ? 'Coluna ' : 'Linha ') + (i + 1), id: 'tr:' + lid + ':' + eixo + i, valor: ler(lista[i]),
      unidades: eixo === 'c' ? UN_COLUNA : UN_LINHA, converter,
      aoPrevia: v => EditorGrade.previa(lid, eixo, nova(v)),
      aoConfirmar: v => EditorGrade.definir(lid, eixo, nova(v)),
      info: () => { const x = EditorGrade.dados(lid), v = x && (eixo === 'c' ? x.px.c : x.px.l)[i]; return v ? '= ' + Math.round(v) + ' px' : ''; } });   // o tamanho real de agora
  }

  function gradeUI(l) {
    const caixa = h('div', 'pl-grade'), d = EditorGrade.dados(l.id);
    if (!d) { caixa.append(h('p', 'pn-dica', 'A grade (colunas, linhas e blocos) só se edita em tela larga, a partir de 72 rem. Em tela estreita o layout vira uma coluna só.')); return caixa; }
    const nC = d.colunas.length, nL = d.linhas.length;
    caixa.append(h('h4', 'pn-sub', 'Colunas × linhas'),
      Controles.celulas({ colunas: MAX.c, linhas: Math.max(8, nL), atual: { c: nC, l: nL }, nome: 'Colunas e linhas do layout', id: 'cel:' + l.id,
        aoEscolher: (c, lh) => { const r = EditorGrade.tamanho(l.id, c, lh); return r.ok ? undefined : r.msg; } }));
    caixa.append(h('h4', 'pn-sub', 'Largura de cada coluna'));
    d.colunas.forEach((_, i) => caixa.append(trilha(l.id, 'c', i, d)));
    caixa.append(h('h4', 'pn-sub', 'Altura de cada linha'));
    d.linhas.forEach((_, i) => caixa.append(trilha(l.id, 'l', i, d)));
    if (nC * nL > 1 && d.blocos.length) {
      caixa.append(h('h4', 'pn-sub', 'Tamanho de cada bloco'));
      const titulos = new Map(ctx.blocos(l.id).map(b => [b.id, b.titulo]));
      d.blocos.forEach(b => {
        const quadro = h('div', 'pl-bloco');
        quadro.append(h('span', 'md-rot', titulos.get(b.id) || b.id),
          Controles.celulas({ colunas: nC, linhas: Math.min(nL, 12), atual: { c: b.ocupa, l: b.ocupaLin }, nome: 'Tamanho de ' + (titulos.get(b.id) || b.id), id: 'bl:' + l.id + ':' + b.id,
            texto: (c, lh) => 'Ocupa ' + plural(c, 'coluna', 'colunas') + ' × ' + plural(lh, 'linha', 'linhas'),
            aoEscolher: (c, lh) => { const r = EditorGrade.tamanhoBloco(l.id, b.id, c, lh); return r.ok ? undefined : r.msg; } }));
        caixa.append(quadro);
      });
    }
    return caixa;
  }

  // o espaço entre os blocos de um layout (ou entre os layouts, se id for null): × o normal; mostra o espaço real em px
  function espacoUI(rotulo, valor, onde, aoGuardar, previa, id) {
    return Controles.medida({ rotulo, id, valor: { n: Number(valor), u: '×' }, unidades: UN_ESPACO,
      aoPrevia: v => previa(v.n), aoConfirmar: v => aoGuardar(v.n),
      info: () => { const e = onde(); if (!e) return ''; const g = parseFloat(getComputedStyle(e).rowGap); return Number.isFinite(g) ? '= ' + Math.round(g) + ' px' : ''; } });
  }

  function montar() {
    const { layouts, entre } = Roteador.layouts(ctx.pid), n = layouts.length, lista = [];
    layouts.forEach((l, i) => {
      const q = ctx.contar(l.id), dentro = [];
      dentro.push({ chave: 'nome:' + l.id, rotulo: 'Nome do layout', tipo: 'texto', ao: 'change', recarrega: true });
      dentro.push({ tipo: 'custom', montar: () => Controles.segmentado({ rotulo: 'Largura', id: 'larg:' + l.id, opcoes: LARGURAS, valor: l.largura === 'normal' ? 'normal' : 'ampla',
        aoEscolher: v => mudar(l.id, { largura: v }) }) });
      dentro.push({ tipo: 'custom', montar: () => espacoUI('Espaço entre os blocos', l.espaco, () => ctx.area(l.id),
        v => mudar(l.id, { espaco: v }), v => { const a = ctx.area(l.id); if (a) a.style.setProperty('--ct-espaco', String(v)); }, 'esp:' + l.id) });
      dentro.push({ tipo: 'custom', montar: () => gradeUI(l) });
      if (n > 1) dentro.push({ chave: 'pos:' + l.id, rotulo: 'Posição na página', tipo: 'selecao', numero: true, recarrega: true,
        opcoes: layouts.map((_, k) => [k + 1, (k + 1) + 'º' + (k === 0 ? ' (em cima)' : k === n - 1 ? ' (embaixo)' : '')]) });
      if (n > 1 && q === 0) dentro.push({ tipo: 'botao', rotulo: 'Apagar este layout', perigo: true, acao: () => apagar(l.id) });
      else if (n > 1) dentro.push({ tipo: 'custom', montar: () => h('p', 'pn-dica', 'Para apagar este layout, arraste os blocos dele para outro.') });
      lista.push({ tipo: 'grupo', chave: 'g:' + ctx.pid + ':' + l.id, rotulo: 'Layout: ' + nomeDe(l) + ' · ' + plural(q, 'bloco', 'blocos'), aberto: i === 0, campos: dentro });
    });
    if (n > 1) lista.push({ tipo: 'custom', montar: () => espacoUI('Espaço entre os layouts', entre, () => ctx.destino(),
      v => { Roteador.ajustarPagina(ctx.pid, { entre: v }); depois(); }, v => ctx.destino().style.setProperty('--ct-entre', String(v)), 'entre') });
    campos.splice(0, campos.length, ...lista);
  }

  const valores = () => {
    const { layouts } = Roteador.layouts(ctx.pid), v = {};
    layouts.forEach((l, i) => { v['nome:' + l.id] = nomeDe(l); v['pos:' + l.id] = i + 1; });
    return v;
  };

  const depois = () => { ctx.aoAlterar(); montar(); Painel.atualizar(); };

  function aoMudar(chave, valor) {
    const i0 = chave.indexOf(':'), campo = chave.slice(0, i0), id = chave.slice(i0 + 1);
    const cur = Roteador.layouts(ctx.pid), i = cur.layouts.findIndex(l => l.id === id);
    if (i < 0) return;
    if (campo === 'pos') { const [l] = cur.layouts.splice(i, 1); cur.layouts.splice(Math.min(cur.layouts.length, Math.max(0, valor - 1)), 0, l); }
    else if (campo === 'nome') { const t = String(valor).trim().slice(0, 40); if (t && t !== cur.layouts[i].id) cur.layouts[i].nome = t; else delete cur.layouts[i].nome; }   // vazio: volta a mostrar o id
    else cur.layouts[i][campo] = valor;
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts });
    ctx.aoAlterar(); montar();                              // o Painel redesenha logo em seguida (recarrega: true)
  }

  function novo() {
    const cur = Roteador.layouts(ctx.pid); let n = cur.layouts.length + 1;
    while (cur.layouts.some(l => l.id === 'layout-' + n)) n++;
    cur.layouts.push({ id: 'layout-' + n, nome: 'Layout ' + n, tipo: 'coluna', espaco: 1, largura: 'ampla' });
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts });
    depois();
  }

  function apagar(id) {
    const cur = Roteador.layouts(ctx.pid);
    if (cur.layouts.length < 2 || ctx.contar(id) > 0) return;       // nunca apaga o último layout nem um que tenha blocos
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts.filter(l => l.id !== id) });
    depois();
  }

  const larguraMudou = () => atualizar();                  // passou de tela larga para estreita (ou o contrário): a grade aparece ou some

  function abrir(c) {
    ctx = c;
    if (aberto()) return atualizar();                       // já aberto: só redesenha (abrir de novo com o mesmo id fecharia o Painel)
    campos = []; montar();
    mq = matchMedia('(min-width: 72rem)'); mq.addEventListener('change', larguraMudou);
    Painel.abrir({ id: pid(), titulo: 'Layouts', subtitulo: 'Página ' + (c.titulo || c.pid) + ' · vale na hora', campos, valores, aoMudar,
      aoFechar: () => { if (mq) mq.removeEventListener('change', larguraMudou); mq = null; },
      botoes: [{ rotulo: '+ Novo layout', acao: novo }] });
  }
  const atualizar = () => { if (aberto()) { montar(); Painel.atualizar(); } };
  const fechar = () => { if (aberto()) Painel.fechar(); };

  return { abrir, atualizar, fechar, aberto };
})();