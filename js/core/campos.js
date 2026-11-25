/* Campos padronizados: troca a lista nativa do Chrome (datalist) por uma lista do próprio site, com o mesmo visual em todo lugar.
     Combo.ligar(input, fonte)   fonte = função que devolve uma lista de textos, ou um <datalist>
   Todo <input list="..."> do HTML já é ligado sozinho. Os <select> são padronizados só por CSS (css/planilha.css). */
const Combo = (() => {
  let lista = null, dono = null, indice = -1;
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const opcoesDe = f => typeof f === 'function' ? (f() || []) : [...f.querySelectorAll('option')].map(o => o.value || o.textContent).filter(Boolean);

  function fechar() { if (lista) lista.remove(); lista = null; dono = null; indice = -1; }
  function escolher(inp, v) {
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    fechar();
  }
  function mostrar(inp, fonte, todas) {
    const q = norm(inp.value), ops = opcoesDe(fonte).filter(o => todas || !q || norm(o).includes(q));
    if (!ops.length) return fechar();
    if (!lista) { lista = document.createElement('div'); lista.className = 'combo-lista'; lista.setAttribute('role', 'listbox'); (inp.closest('dialog') || document.body).append(lista); }
    dono = inp; indice = -1;
    lista.replaceChildren(...ops.map(o => {
      const d = document.createElement('div'); d.className = 'combo-op' + (o === inp.value ? ' atual' : ''); d.textContent = o; d.setAttribute('role', 'option');
      d.onpointerdown = ev => { ev.preventDefault(); escolher(inp, o); };      // não tira o foco do campo
      return d;
    }));
    const r = inp.getBoundingClientRect(), abaixo = innerHeight - r.bottom, alt = Math.min(224, lista.scrollHeight);
    lista.style.width = r.width + 'px'; lista.style.left = r.left + 'px';
    if (abaixo < alt + 12 && r.top > abaixo) { lista.style.top = 'auto'; lista.style.bottom = (innerHeight - r.top + 4) + 'px'; }
    else { lista.style.bottom = 'auto'; lista.style.top = (r.bottom + 4) + 'px'; }
  }
  function mover(d) {
    const ops = [...lista.children]; if (!ops.length) return;
    indice = (indice + d + ops.length) % ops.length;
    ops.forEach((o, i) => o.classList.toggle('ativo', i === indice));
    ops[indice].scrollIntoView({ block: 'nearest' });
  }

  function ligar(inp, fonte) {
    if (inp.dataset.combo) return;
    inp.dataset.combo = '1'; inp.setAttribute('autocomplete', 'off');
    inp.addEventListener('focus', () => mostrar(inp, fonte, true));
    inp.addEventListener('click', () => { if (dono !== inp) mostrar(inp, fonte, true); });
    inp.addEventListener('input', () => mostrar(inp, fonte, false));
    inp.addEventListener('blur', () => setTimeout(() => { if (dono === inp) fechar(); }, 120));
    inp.addEventListener('keydown', ev => {
      if (dono !== inp || !lista) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); mover(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); mover(-1); }
      else if (ev.key === 'Enter' && indice >= 0) { ev.preventDefault(); escolher(inp, lista.children[indice].textContent); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fechar(); }
    });
  }

  const auto = n => { if (n.nodeType !== 1) return; [...(n.matches('input[list]') ? [n] : []), ...n.querySelectorAll('input[list]')].forEach(i => {
    const dl = document.getElementById(i.getAttribute('list')); if (dl) { i.removeAttribute('list'); ligar(i, dl); } }); };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(auto))).observe(document.documentElement, { childList: true, subtree: true });
  auto(document.documentElement);
  addEventListener('scroll', ev => { if (lista && ev.target !== lista) fechar(); }, true);
  addEventListener('resize', fechar);

  return { ligar, fechar };
})();