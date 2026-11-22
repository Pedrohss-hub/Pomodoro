/* Ferramentas comuns do site: coisas que mais de um container usava com cópias idênticas.
   Não depende de nenhum outro arquivo: carregue antes de pomodoro.js e dos containers.

     Util.h('div', 'classe', 'texto')       cria um elemento (texto entra como texto, nunca como HTML)
     Util.REGEX_INTERVALO                    confere intervalos como A3:G, I3:K14
     Util.textoAtualizado(estado)            "Atualizando…" / "Atualizado há 3 min · falhou: ..." / "Ainda não atualizado"
                                             (estado = { carregando, em, erro }, onde "em" é Date.now() da última leitura)
     Util.exigirInternet()                   lança "sem internet" quando o aparelho está offline
     Util.engrenagem(botao, caixa)           o ⚙ que abre e fecha uma caixa de configuração
     Util.dialogo('classe', html)            cria um <dialog> na página, que fecha no botão .fechar e ao clicar fora; devolve o <dialog>
     Util.avisar('nome')                     avisa a página toda de que algo aconteceu (quem se interessa escuta com
                                             document.addEventListener('nome', ...))

   Avisos (eventos) em uso:
     'sessao-enviada'     o Pomodoro gravou uma sessão na planilha
     'tema-mudou'         as cores ou o tema mudaram (os gráficos se redesenham)
     'agenda-atualizada'  a agenda chegou da planilha ou mudou (os gráficos remarcam os dias "Imp") */
const Util = (() => {
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  const REGEX_INTERVALO = /^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d*$/;

  function textoAtualizado(e) {
    if (e.carregando) return 'Atualizando…';
    const base = e.em ? 'Atualizado há ' + (Date.now() - e.em < 60000 ? 'instantes' : Math.round((Date.now() - e.em) / 60000) + ' min') : 'Ainda não atualizado';
    return base + (e.erro ? ' · falhou: ' + e.erro : '');
  }

  function exigirInternet() { if (!navigator.onLine) throw new Error('sem internet'); }

  function engrenagem(botao, caixa) {
    botao.onclick = () => { caixa.hidden = !caixa.hidden; botao.setAttribute('aria-expanded', String(!caixa.hidden)); };
  }

  function dialogo(classe, html) {
    const d = h('dialog', classe);
    d.innerHTML = html;                       // só texto fixo do código: nada digitado por você entra aqui
    document.body.append(d);
    d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
    const f = d.querySelector('.fechar'); if (f) f.onclick = () => d.close();
    return d;
  }

  const avisar = nome => document.dispatchEvent(new Event(nome));

  return { h, REGEX_INTERVALO, textoAtualizado, exigirInternet, engrenagem, dialogo, avisar };
})();