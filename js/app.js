// app.js — router principal y vistas de Periplo

const App = {
  root: null,
  currentTrip: null,
  currentTab: 'resumen',

  async init() {
    App.root = Utils.$('#app');
    window.addEventListener('hashchange', App.route);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    await Backup.checkDailyBackup();
    App.route();
  },

  async route() {
    const hash = location.hash.slice(1) || '/trips';
    const parts = hash.split('/').filter(Boolean);

    if (parts[0] === 'trips' || parts.length === 0) {
      App.currentTrip = null;
      return Views.renderTripsList();
    }
    if (parts[0] === 'trip' && parts[1]) {
      const trip = await DB.get('trips', parts[1]);
      if (!trip) { location.hash = '#/trips'; return; }
      trip.currencies = trip.currencies || [{ code: trip.baseCurrency, rate: 1 }];
      App.currentTrip = trip;
      App.currentTab = parts[2] || 'resumen';
      return Views.renderTripDetail();
    }
    if (parts[0] === 'ajustes') {
      App.currentTrip = null;
      return Views.renderSettings();
    }
    location.hash = '#/trips';
  },

  goto(hash) { location.hash = hash; },

  async saveTrip(trip) {
    await DB.put('trips', trip);
    return trip;
  },

  async refreshCurrentTrip() {
    App.currentTrip = await DB.get('trips', App.currentTrip.id);
    App.currentTrip.currencies = App.currentTrip.currencies || [{ code: App.currentTrip.baseCurrency, rate: 1 }];
  },

  displayCurrency() {
    return App.currentTrip.displayCurrency || App.currentTrip.baseCurrency;
  },
};

const Modal = {
  open(contentNode, opts = {}) {
    const overlay = Utils.el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay && !opts.persistent) Modal.close(); } });
    const box = Utils.el('div', { class: `modal ${opts.wide ? 'modal--wide' : ''}` }, [contentNode]);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    Modal.current = overlay;
    return overlay;
  },
  close() {
    if (Modal.current) { Modal.current.remove(); Modal.current = null; }
  },
};

document.addEventListener('DOMContentLoaded', App.init);
