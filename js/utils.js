// utils.js — helpers generales

const Utils = {
  $(sel, root = document) { return root.querySelector(sel); },
  $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    const kids = Array.isArray(children) ? children : [children];
    for (const c of kids) {
      if (c === null || c === undefined) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  },

  parseDate(str) {
    // str: 'YYYY-MM-DD' -> local Date at midnight
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  fmtDate(str, opts = {}) {
    if (!str) return '';
    const d = Utils.parseDate(str);
    const short = opts.short;
    const withYear = opts.year !== false;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (short) return `${d.getDate()} ${months[d.getMonth()]}`;
    return `${d.getDate()} ${months[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
  },

  fmtDateRange(start, end) {
    if (!start || !end) return '';
    const s = Utils.parseDate(start);
    const e = Utils.parseDate(end);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${s.getFullYear()}`;
    }
    return `${Utils.fmtDate(start)} – ${Utils.fmtDate(end)}`;
  },

  daysBetween(start, end) {
    // inclusive number of days from start to end (full days of the trip)
    const s = Utils.parseDate(start);
    const e = Utils.parseDate(end);
    return Math.round((e - s) / 86400000) + 1;
  },

  nightsBetween(start, end) {
    const s = Utils.parseDate(start);
    const e = Utils.parseDate(end);
    return Math.max(0, Math.round((e - s) / 86400000));
  },

  dateRangeArray(start, end) {
    const s = Utils.parseDate(start);
    const e = Utils.parseDate(end);
    const out = [];
    let cur = new Date(s);
    while (cur <= e) {
      out.push(Utils.toISO(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  },

  toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  today() { return Utils.toISO(new Date()); },

  fmtMoney(amount, currency) {
    const n = Number(amount) || 0;
    const symbols = { PYG: '₲', USD: 'US$', EUR: '€', ARS: 'AR$', BRL: 'R$', GBP: '£', CLP: 'CL$' };
    const sym = symbols[currency] || (currency ? currency + ' ' : '');
    const decimals = currency === 'PYG' ? 0 : 2;
    const formatted = n.toLocaleString('es-PY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${sym} ${formatted}`;
  },

  round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; },

  debounce(fn, wait = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  },

  toast(msg, type = 'info') {
    const container = Utils.$('#toast-container') || (() => {
      const c = Utils.el('div', { id: 'toast-container', class: 'toast-container' });
      document.body.appendChild(c);
      return c;
    })();
    const t = Utils.el('div', { class: `toast toast--${type}` }, msg);
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => {
      t.classList.remove('toast--show');
      setTimeout(() => t.remove(), 300);
    }, 3200);
  },

  confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = Utils.el('div', { class: 'modal-overlay' });
      const box = Utils.el('div', { class: 'modal modal--confirm' }, [
        Utils.el('p', {}, message),
        Utils.el('div', { class: 'modal__actions' }, [
          Utils.el('button', { class: 'btn btn--ghost', onclick: () => { overlay.remove(); resolve(false); } }, 'Cancelar'),
          Utils.el('button', { class: 'btn btn--danger', onclick: () => { overlay.remove(); resolve(true); } }, 'Eliminar'),
        ]),
      ]);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  },
};

const CATEGORIES = [
  { id: 'vuelos', label: 'Vuelos', icon: '✈️' },
  { id: 'hotel', label: 'Alojamiento', icon: '🏨' },
  { id: 'comida', label: 'Comida', icon: '🍽️' },
  { id: 'auto', label: 'Alquiler de auto', icon: '🚗' },
  { id: 'combustible', label: 'Combustible', icon: '⛽' },
  { id: 'entradas', label: 'Entradas y actividades', icon: '🎟️' },
  { id: 'transporte', label: 'Transporte local', icon: '🚕' },
  { id: 'seguro', label: 'Seguro de viaje', icon: '🛡️' },
  { id: 'compras', label: 'Compras', icon: '🛍️' },
  { id: 'otro', label: 'Otro', icon: '📦' },
];

const COST_TYPES = [
  { id: 'fixed', label: 'Monto fijo', hint: 'Un único costo total, sin recalcular.' },
  { id: 'per_day', label: 'Por día', hint: 'Se multiplica por la cantidad de días del viaje.' },
  { id: 'per_day_person', label: 'Por día y por persona', hint: 'Se multiplica por días × personas.' },
  { id: 'per_person', label: 'Por persona', hint: 'Se multiplica por la cantidad de personas.' },
  { id: 'per_night', label: 'Por noche', hint: 'Se multiplica por la cantidad de noches (para alojamiento).' },
  { id: 'per_km', label: 'Por distancia (precio/km)', hint: 'Cargá el precio por km y sumá los recorridos — el total se calcula solo.' },
];
