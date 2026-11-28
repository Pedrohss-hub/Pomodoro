/* Categorias com cor: a lista que VOCÊ cria pela tela (nome + cor), guardada no Armazém (chave "categorias": navegador + Sheets).
   Nada é apagado de lugar nenhum: as categorias lidas da planilha, as da Agenda e as das Sessões continuam funcionando;
   elas aparecem no editor "sem cor" e ganham cor quando você escolhe uma. Sem nenhuma categoria sua, o site fica exatamente como era.

   Como usar (quem precisa):
     Categorias.cor('Estudo')              cor '#rrggbb' da categoria, ou '' se não tiver (o nome vale sem diferença de maiúscula/acento)
     Categorias.ponto('Estudo')            bolinha <span class="cat-ponto"> com a cor, ou null se não tiver cor
     Categorias.nomes(listaDaPlanilha)     lista do seletor: a da planilha, mais as suas (nenhuma sua = a lista recebida, sem mudar nada)
     Categorias.sugestoes(extra)           para campos de texto com sugestões (Agenda): as suas + extra; se você não criou nenhuma, só o extra
     Categorias.canonico('nome antigo')    o nome de hoje de uma categoria renomeada (as antigas continuam valendo, com a mesma cor)
     Categorias.temPropria()               true se você já criou alguma
     Categorias.fornecer('id', () => [nomes])   um container oferece os nomes que usa, para o editor mostrá-los (ex.: a Agenda)
     Categorias.abrirEditor()              abre o painel para criar, renomear, escolher a cor e apagar
   Aviso (evento): 'categorias-mudou' (você mudou, ou chegou de outro aparelho): quem mostra cores se redesenha.
   Renomear NÃO muda o que já foi gravado na planilha: o nome antigo fica como apelido e continua com a cor. Apagar só tira da sua lista.
   Carregue depois de armazem.js, configuracoes.js e painel.js, e antes de js/containers/. */
const Categorias = (() => {
  const h = Util.h, CHAVE = 'categorias';
  const PALETA = ['#E5484D', '#F76B15', '#F5B800', '#30A46C', '#12A594', '#0091FF', '#3E63DD', '#8E4EC6', '#E93D82', '#6F6F6F'];
  const COR_OK = /^#[0-9a-f]{6}$/i;
  const chave = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();   // igual sem maiúscula/acento

  // limpa o que vem do navegador ou do Sheets: nada fora do formato entra
  function limpar(v) {
    const itens = [], vistos = new Set();
    ((v && Array.isArray(v.itens)) ? v.itens : []).forEach(i => {
      const nome = String(i && i.nome != null ? i.nome : '').trim().slice(0, 40);
      if (!nome || vistos.has(chave(nome))) return;
      vistos.add(chave(nome));
      itens.push({ nome, cor: COR_OK.test(i.cor || '') ? i.cor : '', antes: (Array.isArray(i.antes) ? i.antes : []).map(a => String(a).trim()).filter(Boolean).slice(0, 10) });
    });
    return { itens };
  }
  let dados = limpar(Armazem.obter(CHAVE, null));
  const fornecedores = new Map();                                   // id -> função que devolve nomes (os containers e o cronômetro)

  const salvar = () => { Armazem.guardar(CHAVE, dados); Util.avisar('categorias-mudou'); };
  Armazem.usar(CHAVE, () => { dados = limpar(Armazem.obter(CHAVE, null)); Util.avisar('categorias-mudou'); });   // chegou de outro aparelho

  const achar = nome => { const k = chave(nome); return dados.itens.find(i => chave(i.nome) === k || i.antes.some(a => chave(a) === k)) || null; };
  const cor = nome => { const i = achar(nome); return i ? i.cor : ''; };
  const temPropria = () => dados.itens.length > 0;
  const itens = () => dados.itens.map(i => Object.assign({}, i));
  const canonico = nome => { const i = achar(nome); return i ? i.nome : nome; };

  function ponto(nome) {
    const c = cor(nome); if (!c) return null;
    const e = h('i', 'cat-ponto'); e.style.background = c; e.setAttribute('aria-hidden', 'true'); return e;
  }

  // lista do seletor: a da planilha (na ordem dela; um nome renomeado aparece com o nome novo) + as suas que ainda não estão nela
  function nomes(base) {
    const lista = [], vistos = new Set();
    const por = n => { const k = chave(n); if (k && !vistos.has(k)) { vistos.add(k); lista.push(n); } };
    (base || []).forEach(n => por(canonico(n)));
    dados.itens.forEach(i => por(i.nome));
    return lista;
  }
  function sugestoes(extra) {
    const lista = [], vistos = new Set();
    const por = n => { const k = chave(n); if (k && !vistos.has(k)) { vistos.add(k); lista.push(n); } };
    dados.itens.forEach(i => por(i.nome));
    (extra || []).forEach(n => por(canonico(n)));
    return lista;
  }
  const fornecer = (id, fn) => { fornecedores.set(id, fn); };

  // nomes que já aparecem nos seus dados e ainda NÃO estão na sua lista: [{ nome, de: ['planilha', 'agenda'] }]
  function usadas() {
    const mapa = new Map();
    fornecedores.forEach((fn, id) => {
      let ns = []; try { ns = fn() || []; } catch (e) { ns = []; }
      ns.forEach(n => {
        const t = String(n == null ? '' : n).trim(), k = chave(t); if (!k || achar(t)) return;
        if (!mapa.has(k)) mapa.set(k, { nome: t, de: new Set() });
        mapa.get(k).de.add(id.split(':')[0]);
      });
    });
    return [...mapa.values()].map(x => ({ nome: x.nome, de: [...x.de] }));
  }

  /* ---------- mudanças (cada uma devolve '' se deu certo, ou o texto do problema) ---------- */
  const proximaCor = () => PALETA.find(c => !dados.itens.some(i => i.cor.toLowerCase() === c.toLowerCase())) || PALETA[dados.itens.length % PALETA.length];
  function criar(nome, c) {
    nome = String(nome || '').trim().slice(0, 40);
    if (!nome) return 'Escreva um nome.';
    if (achar(nome)) return 'Já existe uma categoria com esse nome.';
    dados.itens.push({ nome, cor: COR_OK.test(c || '') ? c : proximaCor(), antes: [] }); salvar(); return '';
  }
  function renomear(item, novo) {
    novo = String(novo || '').trim().slice(0, 40);
    if (!novo) return 'O nome não pode ficar vazio.';
    if (chave(novo) === chave(item.nome)) { item.nome = novo; salvar(); return ''; }                 // só mudou maiúscula/acento
    const outro = achar(novo); if (outro && outro !== item) return 'Já existe uma categoria com esse nome.';
    if (!item.antes.some(a => chave(a) === chave(item.nome))) item.antes.push(item.nome);           // o nome antigo vira apelido: dados antigos mantêm a cor
    item.antes = item.antes.filter(a => chave(a) !== chave(novo));
    item.nome = novo; salvar(); return '';
  }
  function colorir(alvo, c) {                                                                         // alvo: item da lista ou um nome que ainda não está nela
    if (c && !COR_OK.test(c)) return 'Cor inválida.';
    if (typeof alvo === 'string') { dados.itens.push({ nome: alvo.trim().slice(0, 40), cor: c || '', antes: [] }); }
    else alvo.cor = c || '';
    salvar(); return '';
  }
  function apagar(item) { dados.itens = dados.itens.filter(i => i !== item); salvar(); }

  /* ---------- o editor (um painel flutuante, o mesmo dos outros containers) ---------- */
  const ROTULO_ORIGEM = { pomodoro: 'planilha de categorias', sessoes: 'sessões', agenda: 'agenda' };

  function editor() {
    const raiz = h('div', 'cat-ed');
    let aberta = null, erro = '', foco = null;                                                         // aberta = categoria com a paleta aberta; foco = campo que volta a ter foco

    const bola = (c, rotulo, aoClicar) => {
      const b = h('button', 'cat-bola' + (c ? '' : ' sem-cor')); b.type = 'button'; b.title = rotulo; b.setAttribute('aria-label', rotulo);
      if (c) b.style.background = c; b.onclick = aoClicar; return b;
    };
    const paleta = item => {
      const p = h('div', 'cat-paleta');
      PALETA.forEach(c => {
        const b = h('button', 'cat-amostra' + (item.cor.toLowerCase() === c.toLowerCase() ? ' atual' : '')); b.type = 'button'; b.style.background = c;
        b.title = b.ariaLabel = 'Usar a cor ' + c; b.onclick = () => { colorir(item, c); };
        p.append(b);
      });
      const livre = h('input', 'cat-livre'); livre.type = 'color'; livre.value = COR_OK.test(item.cor) ? item.cor : PALETA[5]; livre.title = livre.ariaLabel = 'Outra cor';
      livre.onchange = () => { colorir(item, livre.value); };
      const sem = h('button', 'mini cat-sem', 'Sem cor'); sem.type = 'button'; sem.onclick = () => { colorir(item, ''); };
      p.append(livre, sem); return p;
    };

    function desenhar() {
      const filhos = [];
      const lista = h('div', 'cat-lista');
      if (!dados.itens.length) lista.append(h('p', 'pn-dica', 'Você ainda não criou categorias. Escreva um nome abaixo e toque em Adicionar.'));
      dados.itens.forEach(item => {
        const linha = h('div', 'cat-linha');
        const nome = h('input'); nome.type = 'text'; nome.value = item.nome; nome.maxLength = 40; nome.autocomplete = 'off'; nome.setAttribute('aria-label', 'Nome da categoria'); nome.dataset.foco = 'n:' + chave(item.nome);
        nome.onchange = () => { erro = renomear(item, nome.value); if (erro) { nome.value = item.nome; desenhar(); } };
        const x = h('button', 'cat-x', '✕'); x.type = 'button'; x.title = x.ariaLabel = 'Apagar a categoria ' + item.nome;
        x.onclick = () => { if (confirm('Apagar a categoria “' + item.nome + '” da sua lista?\nNada muda na planilha.')) apagar(item); };
        linha.append(bola(item.cor, 'Escolher a cor de ' + item.nome, () => { aberta = aberta === item ? null : item; desenhar(); }), nome, x);
        lista.append(linha);
        if (aberta === item) lista.append(paleta(item));
      });
      filhos.push(lista);

      const nova = h('div', 'cat-nova'), campo = h('input'); campo.type = 'text'; campo.maxLength = 40; campo.placeholder = 'Nova categoria'; campo.autocomplete = 'off'; campo.setAttribute('aria-label', 'Nome da nova categoria'); campo.dataset.foco = 'nova';
      const add = h('button', 'painel-btn', '+ Adicionar'); add.type = 'button';
      const adicionar = () => { foco = 'nova'; erro = criar(campo.value); if (erro) desenhar(); };
      add.onclick = adicionar; campo.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); adicionar(); } };
      nova.append(campo, add); filhos.push(nova);
      const msg = h('p', 'pn-erro', erro); msg.hidden = !erro; filhos.push(msg);

      const ja = usadas();
      if (ja.length) {
        const bloco = h('div', 'cat-usadas');
        bloco.append(h('h3', 'pn-secao', 'Já aparecem nos seus dados (sem cor)'));
        ja.forEach(u => {
          const linha = h('div', 'cat-linha cat-usada');
          const b = bola('', 'Dar uma cor a ' + u.nome, () => { colorir(u.nome, proximaCor()); aberta = achar(u.nome); desenhar(); });
          const t = h('span', 'cat-nome', u.nome), de = h('small', null, 'vem de: ' + u.de.map(d => ROTULO_ORIGEM[d] || d).join(', '));
          linha.append(b, t, de); bloco.append(linha);
        });
        filhos.push(bloco);
      }
      filhos.push(h('p', 'pn-dica', 'As categorias da planilha continuam sendo lidas como sempre. As que você cria ficam no site (e no Sheets do Armazém, se estiver ligado); nada é escrito nas células de categorias da planilha. Renomear não muda o que já foi gravado: o nome antigo continua com a mesma cor. Apagar só tira da sua lista.'));
      raiz.replaceChildren(...filhos);
      const alvo = foco ? [...raiz.querySelectorAll('[data-foco]')].find(n => n.dataset.foco === foco) : null;
      foco = null; if (alvo) alvo.focus({ preventScroll: true });
    }
    const aoMudar = () => { if (!raiz.isConnected) { document.removeEventListener('categorias-mudou', aoMudar); return; } erro = ''; desenhar(); };
    document.addEventListener('categorias-mudou', aoMudar);
    desenhar();
    return raiz;
  }

  function abrirEditor() {
    const aberto = document.querySelector('dialog[open]'); if (aberto) aberto.close();                // o painel flutua por cima da página: fecha as Configurações antes
    Painel.abrir({ id: 'cfg:categorias', titulo: 'Categorias', subtitulo: 'Nome e cor · as mudanças valem na hora', campos: [{ tipo: 'custom', montar: () => editor() }], valores: () => ({}), aoMudar: () => {} });
  }

  // fornecedores do cronômetro (a lista lida da planilha e as sessões já gravadas neste aparelho)
  fornecer('pomodoro', () => (typeof categorias !== 'undefined' ? categorias : []));
  fornecer('sessoes', () => (typeof log !== 'undefined' ? log : []).map(e => e.categoria));

  // entrada nas Configurações (vale para o site todo) e o botão dentro da seção "Planilha" do cronômetro
  try {
    Configuracoes.secao({ id: 'categorias', titulo: 'Categorias e cores', montar: corpo => {
      corpo.append(h('p', 'dica', 'Crie categorias, escolha a cor de cada uma e veja essa cor no seletor, na Agenda, no calendário e nos gráficos.'));
      const b = h('button', null, 'Abrir categorias e cores'); b.type = 'button'; b.onclick = abrirEditor; corpo.append(b);
    } });
  } catch (e) { console.error('categorias: não consegui criar a seção nas Configurações:', e); }
  const bt = document.getElementById('cat-editar'); if (bt) bt.onclick = abrirEditor;

  return { cor, ponto, nomes, sugestoes, canonico, temPropria, itens, fornecer, abrirEditor };
})();