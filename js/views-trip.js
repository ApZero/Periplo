// views-trip.js — cabecera del viaje, navegación por pestañas y resumen/presupuesto

Views.renderTripDetail = async function () {
  const trip = App.currentTrip;
  await Currency.getRatesForTrip(trip);
  await App.saveTrip(trip);

  App.root.innerHTML = '';

  const header = Utils.el('header', { class: 'topbar topbar--trip' }, [
    Utils.el('button', { class: 'icon-btn', 'aria-label': 'Volver', onclick: () => App.goto('#/trips') }, '←'),
    Utils.el('div', { class: 'topbar__trip-info', onclick: () => Views.openTripForm(trip) }, [
      Utils.el('h1', {}, trip.name),
      Utils.el('span', {}, Utils.fmtDateRange(trip.startDate, trip.endDate)),
    ]),
    Views.currencySwitcher(trip),
  ]);
  App.root.appendChild(header);

  const main = Utils.el('main', { class: 'view view--trip', id: 'trip-main' });
  App.root.appendChild(main);

  const tabs = [
    ['resumen', '📊', 'Resumen'],
    ['gastos', '💵', 'Gastos'],
    ['hoteles', '🏨', 'Hoteles'],
    ['itinerario', '🗓️', 'Días'],
    ['mapa', '🗺️', 'Mapa'],
  ];
  const nav = Utils.el('nav', { class: 'bottom-nav' }, tabs.map(([id, icon, label]) =>
    Utils.el('button', {
      class: `bottom-nav__item ${App.currentTab === id ? 'bottom-nav__item--active' : ''}`,
      onclick: () => App.goto(`#/trip/${trip.id}/${id}`),
    }, [Utils.el('span', { class: 'bottom-nav__icon' }, icon), Utils.el('span', {}, label)])
  ));
  App.root.appendChild(nav);

  const renderers = {
    resumen: Views.renderSummaryTab,
    gastos: Views.renderExpensesTab,
    hoteles: Views.renderHotelsTab,
    itinerario: Views.renderItineraryTab,
    mapa: Views.renderMapTab,
  };
  (renderers[App.currentTab] || Views.renderSummaryTab)(main, trip);
};

Views.currencySwitcher = function (trip) {
  const codes = trip.currencies.map((c) => c.code);
  const select = Utils.el('select', {
    class: 'currency-switcher',
    onchange: async (e) => {
      trip.displayCurrency = e.target.value;
      await App.saveTrip(trip);
      Views.renderTripDetail();
    },
  }, codes.map((c) => Utils.el('option', { value: c, selected: c === App.displayCurrency() ? 'selected' : null }, c)));
  return select;
};

Views.renderSummaryTab = async function (main, trip) {
  main.innerHTML = '<div class="loading">Cargando…</div>';
  const display = App.displayCurrency();
  const { byCat, total } = await Expenses.summaryByCategory(trip, display);
  const { budget, remaining } = await Expenses.budgetVsActual(trip, display);
  const days = Utils.daysBetween(trip.startDate, trip.endDate);
  const nights = Utils.nightsBetween(trip.startDate, trip.endDate);
  const perPerson = total / (Number(trip.people) || 1);
  const perDay = total / days;

  main.innerHTML = '';

  const hero = Utils.el('section', { class: 'summary-hero' }, [
    Utils.el('div', { class: 'summary-hero__total' }, [
      Utils.el('span', { class: 'summary-hero__label' }, 'Total planificado'),
      Utils.el('span', { class: 'summary-hero__amount' }, Utils.fmtMoney(total, display)),
    ]),
    budget > 0 ? Utils.el('div', { class: `summary-hero__budget ${remaining < 0 ? 'summary-hero__budget--over' : ''}` }, [
      Utils.el('div', { class: 'progress-bar' }, [
        Utils.el('div', { class: 'progress-bar__fill', style: `width:${Math.min(100, (total / budget) * 100)}%` }),
      ]),
      Utils.el('span', {}, remaining >= 0
        ? `${Utils.fmtMoney(remaining, display)} disponible de ${Utils.fmtMoney(budget, display)}`
        : `${Utils.fmtMoney(Math.abs(remaining), display)} por encima del presupuesto de ${Utils.fmtMoney(budget, display)}`),
    ]) : Utils.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => Views.openTripForm(trip) }, '+ Definir presupuesto'),
  ]);
  main.appendChild(hero);

  main.appendChild(Utils.el('div', { class: 'stat-row' }, [
    Utils.el('div', { class: 'stat-chip' }, [Utils.el('strong', {}, String(days)), Utils.el('span', {}, 'días')]),
    Utils.el('div', { class: 'stat-chip' }, [Utils.el('strong', {}, String(nights)), Utils.el('span', {}, 'noches')]),
    Utils.el('div', { class: 'stat-chip' }, [Utils.el('strong', {}, String(trip.people || 1)), Utils.el('span', {}, 'personas')]),
    Utils.el('div', { class: 'stat-chip' }, [Utils.el('strong', {}, Utils.fmtMoney(perPerson, display)), Utils.el('span', {}, 'por persona')]),
    Utils.el('div', { class: 'stat-chip' }, [Utils.el('strong', {}, Utils.fmtMoney(perDay, display)), Utils.el('span', {}, 'por día')]),
  ]));

  main.appendChild(Utils.el('h3', { class: 'section-label' }, 'Por categoría'));
  const catList = Utils.el('div', { class: 'category-breakdown' });
  const maxVal = Math.max(1, ...Object.values(byCat));
  CATEGORIES.forEach((cat) => {
    const val = byCat[cat.id] || 0;
    if (val === 0) return;
    catList.appendChild(Utils.el('div', { class: 'category-row' }, [
      Utils.el('span', { class: 'category-row__icon' }, cat.icon),
      Utils.el('span', { class: 'category-row__label' }, cat.label),
      Utils.el('div', { class: 'category-row__bar' }, [
        Utils.el('div', { class: 'category-row__fill', style: `width:${(val / maxVal) * 100}%` }),
      ]),
      Utils.el('span', { class: 'category-row__amount' }, Utils.fmtMoney(val, display)),
    ]));
  });
  if (Object.values(byCat).every((v) => v === 0)) {
    catList.appendChild(Utils.el('p', { class: 'muted' }, 'Todavía no cargaste gastos.'));
  }
  main.appendChild(catList);

  main.appendChild(Utils.el('h3', { class: 'section-label' }, 'Monedas del viaje'));
  const curBox = Utils.el('div', { class: 'currency-box' });
  trip.currencies.forEach((c) => {
    let rateText = 'moneda base';
    if (c.code !== trip.baseCurrency) {
      const rate = Number(c.rate) || 1;
      // Si la tasa directa da un número muy chico para leer, mostramos la inversa.
      rateText = rate >= 1
        ? `1 ${trip.baseCurrency} = ${Utils.round2(rate)} ${c.code}`
        : `1 ${c.code} = ${Utils.round2(1 / rate)} ${trip.baseCurrency}`;
    }
    curBox.appendChild(Utils.el('div', { class: 'currency-row' }, [
      Utils.el('span', { class: 'currency-row__code' }, c.code),
      Utils.el('span', { class: 'currency-row__rate' }, rateText),
    ]));
  });
  main.appendChild(curBox);
  main.appendChild(Utils.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => Views.openCurrencyManager(trip) }, '💱 Gestionar monedas'));

  if (trip.notes) {
    main.appendChild(Utils.el('h3', { class: 'section-label' }, 'Notas'));
    main.appendChild(Utils.el('p', { class: 'trip-notes' }, trip.notes));
  }

  main.appendChild(Utils.el('div', { class: 'danger-zone' }, [
    Utils.el('button', { class: 'btn btn--danger btn--sm', onclick: async () => {
      const ok = await Utils.confirmDialog(`¿Eliminar "${trip.name}" y todos sus datos? Esta acción no se puede deshacer.`);
      if (!ok) return;
      await DB.delete('trips', trip.id);
      await DB.deleteWhere('expenses', 'tripId', trip.id);
      await DB.deleteWhere('hotelOptions', 'tripId', trip.id);
      await DB.deleteWhere('hotelCombos', 'tripId', trip.id);
      await DB.deleteWhere('itineraryDays', 'tripId', trip.id);
      Utils.toast('Viaje eliminado', 'success');
      App.goto('#/trips');
    } }, '🗑️ Eliminar viaje'),
  ]));
};

Views.openCurrencyManager = function (trip) {
  const box = Utils.el('div', { class: 'form' });
  box.appendChild(Utils.el('h2', {}, 'Monedas del viaje'));
  box.appendChild(Utils.el('p', { class: 'muted' }, `Moneda base: ${trip.baseCurrency}. Las tasas se actualizan desde internet una vez al día. Podés cargar la tasa desde cualquiera de los dos lados y darla vuelta con ⇄.`));

  const list = Utils.el('div', { class: 'currency-manage-list' });

  function fmtRateNum(n) {
    if (!isFinite(n) || n === null) return '';
    const rounded = parseFloat(n.toFixed(6));
    return String(rounded);
  }

  const renderList = () => {
    list.innerHTML = '';
    trip.currencies.forEach((c) => {
      if (c.code === trip.baseCurrency) {
        list.appendChild(Utils.el('div', { class: 'currency-manage-row' }, [
          Utils.el('span', { class: 'currency-manage-row__code' }, c.code),
          Utils.el('span', { class: 'muted' }, 'moneda base'),
        ]));
        return;
      }

      const dir = c.rateDirection || 'direct'; // 'direct': 1 base = X code · 'inverse': 1 code = X base
      const rate = Number(c.rate) || 1;
      const displayValue = dir === 'direct' ? rate : (rate ? 1 / rate : 0);
      const fromCode = dir === 'direct' ? trip.baseCurrency : c.code;
      const toCode = dir === 'direct' ? c.code : trip.baseCurrency;

      const valueInput = Utils.el('input', {
        type: 'number', step: 'any', value: fmtRateNum(displayValue),
        oninput: (e) => {
          const v = Number(e.target.value) || 0;
          c.rate = dir === 'direct' ? (v || 1) : (v ? 1 / v : 1);
          c.manual = true;
        },
      });

      const flipBtn = Utils.el('button', {
        type: 'button', class: 'icon-btn icon-btn--sm', title: 'Invertir dirección',
        onclick: () => { c.rateDirection = dir === 'direct' ? 'inverse' : 'direct'; renderList(); },
      }, '⇄');

      const deleteBtn = Utils.el('button', {
        type: 'button', class: 'icon-btn icon-btn--sm', onclick: () => {
          trip.currencies = trip.currencies.filter((x) => x.code !== c.code);
          if (trip.displayCurrency === c.code) trip.displayCurrency = trip.baseCurrency;
          renderList();
        },
      }, '✕');

      list.appendChild(Utils.el('div', { class: 'currency-manage-row currency-manage-row--rate' }, [
        Utils.el('div', { class: 'currency-manage-row__top' }, [
          Utils.el('span', { class: 'currency-manage-row__code' }, c.code),
          deleteBtn,
        ]),
        Utils.el('div', { class: 'currency-manage-row__rate-line' }, [
          Utils.el('span', { class: 'currency-manage-row__unit' }, `1 ${fromCode} =`),
          valueInput,
          Utils.el('span', { class: 'currency-manage-row__unit' }, toCode),
          flipBtn,
        ]),
      ]));
    });
  };
  renderList();
  box.appendChild(list);

  const addRow = Utils.el('div', { class: 'form__row' });
  const select = Utils.el('select', {}, Currency.ALL.filter((c) => !trip.currencies.find((x) => x.code === c)).map((c) => Utils.el('option', { value: c }, c)));
  addRow.appendChild(select);
  addRow.appendChild(Utils.el('button', {
    type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => {
      const code = select.value;
      if (!code || trip.currencies.find((c) => c.code === code)) return;
      trip.currencies.push({ code, rate: 1 });
      renderList();
    },
  }, '+ Agregar moneda'));
  box.appendChild(addRow);

  box.appendChild(Utils.el('div', { class: 'form__actions' }, [
    Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: async () => {
      const { fresh } = await Currency.refreshTripRates(trip);
      Utils.toast(fresh ? 'Tasas actualizadas ✓' : 'Sin conexión — se usó la última tasa guardada', fresh ? 'success' : 'info');
      renderList();
    } }, '🔄 Actualizar tasas ahora'),
    Utils.el('button', { type: 'button', class: 'btn btn--primary', onclick: async () => {
      await App.saveTrip(trip);
      Modal.close();
      await App.refreshCurrentTrip();
      Views.renderTripDetail();
    } }, 'Guardar'),
  ]));

  Modal.open(box, { wide: true });
};
