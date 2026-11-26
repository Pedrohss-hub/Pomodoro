/* Painel de layouts: onde você escolhe, pela tela, como a página é organizada. Abre no Painel ao lado, dentro do modo "Editar layout"
   (js/core/editor-layout.js); o que você muda vale na hora e fica guardado como qualquer ajuste (navegador + Sheets, chave "paginas").
   Para cada layout (área) da página:
     Grade                   1 coluna | 2 colunas | 3 colunas | lateral (coluna estreita + o resto)
     Largura                 ampla (aproveita a tela larga) | normal (a largura do site)
     Espaço entre os blocos  o espaço DENTRO do layout (Nenhum ... Enorme)
     Largura da 1ª coluna    (só na grade lateral) Padrão ... Muito larga
     Blocos empilhados       (só em 2 colunas e lateral) quantos blocos ficam um embaixo do outro na 1ª coluna, com o seguinte ao lado, na altura deles
     Posição na página       sobe ou desce o layout (só com 2 ou mais)
     Apagar este layout      só aparece se ele estiver vazio; para esvaziar, arraste os blocos para outro layout
   E, com 2 ou mais layouts, o "Espaço entre os layouts" (o vão entre um layout e o outro).
   O botão "+ Novo layout" (no rodapé) cria um layout vazio no fim da página; arraste um bloco para dentro dele.
   Só quem o chama é o editor de layout:  PainelLayout.abrir({ pid, titulo, contar(idDoLayout) => nº de blocos, aoAlterar() })
                                          PainelLayout.atualizar()  redesenha o painel (use depois de mover blocos)
   Carregue depois de painel.js e roteador.js. Não guarda nada por conta própria: tudo passa por Roteador.ajustarPagina. */
const PainelLayout = (() => {
  const GRADES = [['coluna', '1 coluna (um embaixo do outro)'], ['duas', '2 colunas'], ['tres', '3 colunas'], ['lateral', 'Lateral (coluna estreita + o resto)']];
  const LARGURAS = [['ampla', 'Ampla (aproveita a tela larga)'], ['normal', 'Normal (largura do site)']];
  const ESPACOS = [[0, 'Nenhum'], [0.5, 'Pequeno'], [1, 'Normal'], [1.5, 'Grande'], [2, 'Muito grande'], [3, 'Enorme']];
  const COLUNAS1 = [[22, 'Padrão (22 rem)'], [26, 'Um pouco maior (26 rem)'], [30, 'Larga (30 rem)'], [34, 'Muito larga (34 rem)'], [40, 'Enorme (40 rem)']];
  const PILHAS = [[1, 'Nenhum (cada bloco na sua célula)'], [2, '2 blocos'], [3, '3 blocos'], [4, '4 blocos']];
  let ctx = null;                  // { pid, titulo, contar, aoAlterar }
  let campos = [];                 // a lista que o Painel está mostrando (trocada por dentro, sem criar outra)
  const pid = () => 'layouts:' + ctx.pid;
  const aberto = () => !!(ctx && Painel.aberto() && Painel.aberto().id === pid());

  // se o valor de agora não é um dos prontos (veio do paginas.js), ele entra na lista como "×valor"
  const espacos = v => (ESPACOS.some(o => o[0] === v) ? ESPACOS : ESPACOS.concat([[v, '×' + v]]).sort((a, b) => a[0] - b[0]));
  const colunas1 = v => (COLUNAS1.some(o => o[0] === v) ? COLUNAS1 : COLUNAS1.concat([[v, v + ' rem']]).sort((a, b) => a[0] - b[0]));
  const pilhas = v => (PILHAS.some(o => o[0] === v) ? PILHAS : PILHAS.concat([[v, v + ' blocos']]).sort((a, b) => a[0] - b[0]));

  function montar() {
    const { layouts, entre } = Roteador.layouts(ctx.pid), n = layouts.length, lista = [];
    layouts.forEach((l, i) => {
      const q = ctx.contar(l.id);
      lista.push({ tipo: 'titulo', rotulo: 'Layout: ' + l.id + ' · ' + (q === 1 ? '1 bloco' : q + ' blocos'),
        dica: n > 1 && q > 0 ? 'Para apagar este layout, arraste os blocos dele para outro.' : '' });
      lista.push({ chave: 'tipo:' + l.id, rotulo: 'Grade', tipo: 'selecao', opcoes: GRADES, recarrega: true });
      lista.push({ chave: 'largura:' + l.id, rotulo: 'Largura', tipo: 'selecao', opcoes: LARGURAS, recarrega: true });
      lista.push({ chave: 'espaco:' + l.id, rotulo: 'Espaço entre os blocos', tipo: 'selecao', numero: true, opcoes: espacos(l.espaco), recarrega: true });
      if (l.tipo === 'lateral') lista.push({ chave: 'coluna1:' + l.id, rotulo: 'Largura da 1ª coluna', tipo: 'selecao', numero: true, opcoes: colunas1(l.coluna1), recarrega: true });
      if (l.tipo === 'lateral' || l.tipo === 'duas') lista.push({ chave: 'pilha:' + l.id, rotulo: 'Blocos empilhados na 1ª coluna', tipo: 'selecao', numero: true, opcoes: pilhas(l.pilha), recarrega: true,
        dica: 'Em tela larga. O bloco seguinte fica ao lado, na altura da pilha.' });
      if (n > 1) lista.push({ chave: 'pos:' + l.id, rotulo: 'Posição na página', tipo: 'selecao', numero: true, opcoes: layouts.map((_, k) => [k + 1, (k + 1) + 'º' + (k === 0 ? ' (em cima)' : k === n - 1 ? ' (embaixo)' : '')]), recarrega: true });
      if (n > 1 && q === 0) lista.push({ tipo: 'botao', rotulo: 'Apagar este layout', perigo: true, acao: () => apagar(l.id) });
    });
    if (n > 1) {
      lista.push({ tipo: 'titulo', rotulo: 'Entre os layouts' });
      lista.push({ chave: 'entre', rotulo: 'Espaço entre um layout e o outro', tipo: 'selecao', numero: true, opcoes: espacos(entre), recarrega: true });
    }
    campos.splice(0, campos.length, ...lista);
  }

  const valores = () => {
    const { layouts, entre } = Roteador.layouts(ctx.pid), v = { entre };
    layouts.forEach((l, i) => { v['tipo:' + l.id] = l.tipo; v['largura:' + l.id] = l.largura; v['espaco:' + l.id] = l.espaco; v['coluna1:' + l.id] = l.coluna1; v['pilha:' + l.id] = l.pilha; v['pos:' + l.id] = i + 1; });
    return v;
  };

  const depois = () => { ctx.aoAlterar(); montar(); };       // o Painel redesenha logo em seguida (recarrega: true)

  function aoMudar(chave, valor) {
    if (chave === 'entre') { Roteador.ajustarPagina(ctx.pid, { entre: valor }); return depois(); }
    const i0 = chave.indexOf(':'), campo = chave.slice(0, i0), id = chave.slice(i0 + 1);
    const cur = Roteador.layouts(ctx.pid), i = cur.layouts.findIndex(l => l.id === id);
    if (i < 0) return;
    if (campo === 'pos') { const [l] = cur.layouts.splice(i, 1); cur.layouts.splice(Math.min(cur.layouts.length, Math.max(0, valor - 1)), 0, l); }
    else cur.layouts[i][campo] = valor;
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts });
    depois();
  }

  function novo() {
    const cur = Roteador.layouts(ctx.pid); let n = cur.layouts.length + 1;
    while (cur.layouts.some(l => l.id === 'layout-' + n)) n++;
    cur.layouts.push({ id: 'layout-' + n, tipo: 'coluna', espaco: 1, largura: 'ampla' });
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts });
    depois(); Painel.atualizar();
  }

  function apagar(id) {
    const cur = Roteador.layouts(ctx.pid);
    if (cur.layouts.length < 2 || ctx.contar(id) > 0) return;       // nunca apaga o último layout nem um que tenha blocos
    Roteador.ajustarPagina(ctx.pid, { layouts: cur.layouts.filter(l => l.id !== id) });
    depois(); Painel.atualizar();
  }

  function abrir(c) {
    ctx = c;
    if (aberto()) return atualizar();                       // já aberto: só redesenha (abrir de novo com o mesmo id fecharia o Painel)
    campos = []; montar();
    Painel.abrir({ id: pid(), titulo: 'Layouts', subtitulo: 'Página ' + (c.titulo || c.pid) + ' · vale na hora', campos, valores, aoMudar,
      botoes: [{ rotulo: '+ Novo layout', acao: novo }] });
  }
  const atualizar = () => { if (aberto()) { montar(); Painel.atualizar(); } };
  const fechar = () => { if (aberto()) Painel.fechar(); };

  return { abrir, atualizar, fechar, aberto };
})();