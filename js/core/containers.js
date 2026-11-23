/* Containers: o "lego" do site.
   Um container é um bloco da tela (lista, gráfico, formulário...) descrito por DADOS:
     { id: 'agenda', tipo: 'agenda', titulo: 'Agenda', aba: 'Agenda', intervalo: 'A3:G', ... }
   Cada TIPO de container é um arquivo em js/containers/ que se registra aqui:
     Containers.registrar('agenda', ctx => { ...monta o HTML...; return { raiz, aparecer }; });
   O que o tipo recebe (ctx):  id, def() (a configuração atual), ajustar({campo: valor}) (guarda mudanças), visivel() (a página dele está aberta?),
                               publicar('nome', () => dados) (oferece dados a outros containers) e consultar('nome') (junta os dados oferecidos por todos)
   O que o tipo devolve:       raiz (o elemento a colocar na página), aparecer() opcional (chamado quando a página dele é aberta),
                               iniciar() opcional (chamado logo depois de colocado na página),
                               acoes opcional: [{ rotulo, dica, fazer }] = botões para a barra da página (o Roteador coloca)
   Quem monta os containers de cada página e avisa quando a página muda é o Roteador (js/core/roteador.js).
   As mudanças que você faz nos containers (⚙) são guardadas pelo Armazém (js/core/armazem.js): neste navegador e, se ligado, no Sheets.
   Carregue depois de pomodoro.js (usa LS) e de armazem.js, e antes dos arquivos de js/containers/. */
const Containers = (() => {
  const CHAVE = 'containers';             // nome desta configuração no Armazém (navegador + Sheets)
  const tipos = {};                       // tipo -> fábrica
  const bases = {};                       // id -> configuração padrão (vem do código, em js/paginas.js)
  Armazem.adotar(CHAVE, LS.get('ct-defs-v1', undefined));   // aproveita o que a versão antiga guardava só neste navegador
  const ajustes = Armazem.obter(CHAVE, {});                  // id -> só os campos que você mudou na tela (navegador + Sheets, ver armazem.js)
  const salvar = () => Armazem.guardar(CHAVE, ajustes);
  // chegou uma configuração mais nova de outro aparelho: atualiza aqui dentro e avisa a tela (ela oferece "Recarregar")
  Armazem.usar(CHAVE, () => {
    const novo = Armazem.obter(CHAVE, {});
    Object.keys(ajustes).forEach(k => { delete ajustes[k]; }); Object.assign(ajustes, novo);
    Util.avisar('configuracao-recebida');
  });
  const vivos = [];                       // containers já colocados na página
  const fontes = {};                      // nome -> Map(id do container -> função que devolve uma lista); ver publicar/consultar

  const registrar = (tipo, fabrica) => { tipos[tipo] = fabrica; };
  const def = id => Object.assign({}, bases[id], ajustes[id]);
  const ajustar = (id, campos) => { ajustes[id] = Object.assign({}, ajustes[id], campos); salvar(); };

  // base: a definição. destino: elemento onde entra. opcoes: { antes: elemento, visivel: () => bool, herdar: objeto antigo }
  //   herdar: configuração antiga (de antes do container existir); só vale na 1ª vez e só copia o que difere do padrão.
  function montar(base, destino, opcoes = {}) {
    if (!/^[a-z0-9_-]+$/i.test(base.id || '')) { console.error('container sem id válido (use letras, números, - ou _):', base); return null; }
    bases[base.id] = base;
    if (!ajustes[base.id] && opcoes.herdar) {
      const dif = {};
      Object.keys(base).forEach(k => { if (k in opcoes.herdar && opcoes.herdar[k] !== base[k]) dif[k] = opcoes.herdar[k]; });
      ajustes[base.id] = dif; salvar();
    }
    if (def(base.id).ligado === false) return null;               // "ligado: false" = container desligado
    const fabrica = tipos[base.tipo];
    if (!fabrica) { console.error('tipo de container desconhecido: "' + base.tipo + '" (id ' + base.id + ')'); return null; }
    const visivel = opcoes.visivel || (() => true);
    try {                                                          // um container quebrado não derruba os outros
      const inst = fabrica({ id: base.id, def: () => def(base.id), ajustar: campos => ajustar(base.id, campos), visivel,
        publicar: (nome, fn) => { (fontes[nome] = fontes[nome] || new Map()).set(base.id, fn); },
        consultar: nome => [...(fontes[nome] ? fontes[nome].values() : [])].flatMap(f => f()) });
      destino.insertBefore(inst.raiz, opcoes.antes || null);
      vivos.push({ inst, visivel });
      if (inst.iniciar) inst.iniciar();
      return inst;
    } catch (err) { console.error('container "' + base.id + '" falhou ao montar:', err); return null; }
  }

  // O Roteador chama isto quando a página muda: os containers que ficaram visíveis se atualizam (aparecer)
  const paginaMudou = () => vivos.forEach(v => {
    try { if (v.visivel() && v.inst.aparecer) v.inst.aparecer(); } catch (err) { console.error(err); }
  });

  const todas = () => Object.keys(bases).map(id => def(id));     // definições de agora (padrão + o que você mudou), prontas para colar em js/paginas.js
  const limparAjustes = () => { Object.keys(bases).forEach(id => { ajustes[id] = {}; }); salvar(); };   // {} (e não apagar) para não herdar de novo a configuração antiga

  return { registrar, montar, def, ajustar, paginaMudou, todas, limparAjustes };
})();