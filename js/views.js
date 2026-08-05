// views.js — renderizado de pantallas

const Views = {};

// ---------- LISTA DE VIAJES ----------

Views.renderTripsList = async function () {
  const trips = await DB.getAll('trips');
  trips.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const today = Utils.today();

  App.root.innerHTML = '';
  const header = Utils.el('header', { class: 'topbar' }, [
    Utils.el('div', { class: 'topbar__brand' }, [
      Utils.el('span', { class: 'topbar__logo' }, '🧭'),
      Utils.el('h1', {}, 'Periplo'),
    ]),
    Utils.el('button', { class: 'icon-btn', 'aria-label': 'Ajustes', onclick: () => App.goto('#/ajustes') }, '⚙️'),
  ]);
  App.root.appendChild(header);

  const main = Utils.el('main', { class: 'view view--trips' });

  if (trips.length === 0) {
    main.appendChild(Utils.el('div', { class: 'empty-state' }, [
      Utils.el('div', { class: 'empty-state__icon' }, '🗺️'),
      Utils.el('h2', {}, 'Todavía no hay viajes'),
      Utils.el('p', {}, 'Creá tu primer viaje para empezar a planificar fechas, presupuesto y actividades.'),
      Utils.el('button', { class: 'btn btn--primary', onclick: () => Views.openTripForm() }, '+ Nuevo viaje'),
    ]));
  } else {
    const upcoming = trips.filter((t) => t.endDate >= today);
    const past = trips.filter((t) => t.endDate < today);

    if (upcoming.length) {
      main.appendChild(Utils.el('h3', { class: 'section-label' }, 'Próximos y en curso'));
      const grid = Utils.el('div', { class: 'trip-grid' });
      upcoming.forEach((t) => grid.appendChild(Views.tripCard(t, today)));
      main.appendChild(grid);
    }
    if (past.length) {
      main.appendChild(Utils.el('h3', { class: 'section-label' }, 'Pasados'));
      const grid = Utils.el('div', { class: 'trip-grid trip-grid--past' });
      past.forEach((t) => grid.appendChild(Views.tripCard(t, today)));
      main.appendChild(grid);
    }
  }

  App.root.appendChild(main);

  const fab = Utils.el('button', { class: 'fab', 'aria-label': 'Nuevo viaje', onclick: () => Views.openTripForm() }, '+');
  App.root.appendChild(fab);
};

Views.tripCard = function (trip, today) {
  const inProgress = trip.startDate <= today && trip.endDate >= today;
  const daysToGo = Math.ceil((Utils.parseDate(trip.startDate) - Utils.parseDate(today)) / 86400000);
  const card = Utils.el('div', {
    class: `trip-card ${inProgress ? 'trip-card--active' : ''}`,
    onclick: () => App.goto(`#/trip/${trip.id}/resumen`),
  }, [
    Utils.el('div', { class: 'trip-card__top' }, [
      Utils.el('h3', {}, trip.name),
      inProgress ? Utils.el('span', { class: 'badge badge--live' }, 'En curso') :
        (daysToGo > 0 ? Utils.el('span', { class: 'badge' }, `en ${daysToGo} días`) : null),
    ]),
    Utils.el('p', { class: 'trip-card__dest' }, trip.destination || ''),
    Utils.el('p', { class: 'trip-card__dates' }, Utils.fmtDateRange(trip.startDate, trip.endDate)),
    Utils.el('div', { class: 'trip-card__meta' }, [
      Utils.el('span', {}, `👥 ${trip.people || 1}`),
      Utils.el('span', {}, `${Utils.daysBetween(trip.startDate, trip.endDate)} días`),
    ]),
  ]);
  return card;
};

Views.openTripForm = function (trip = null) {
  const isEdit = !!trip;
  const t = trip || {
    id: uid(), name: '', destination: '', startDate: Utils.today(), endDate: Utils.today(),
    people: 2, baseCurrency: 'PYG', budget: '', budgetCurrency: 'PYG', currencies: [{ code: 'PYG', rate: 1 }], notes: '',
  };

  const form = Utils.el('form', { class: 'form' }, [
    Utils.el('h2', {}, isEdit ? 'Editar viaje' : 'Nuevo viaje'),
    Field.text('Nombre del viaje', 'name', t.name, { required: true, placeholder: 'Ej: Bariloche en familia' }),
    Field.text('Destino', 'destination', t.destination, { placeholder: 'Ej: Bariloche, Argentina' }),
    Utils.el('div', { class: 'form__row' }, [
      Field.date('Fecha de inicio', 'startDate', t.startDate),
      Field.date('Fecha de fin', 'endDate', t.endDate),
    ]),
    Utils.el('div', { class: 'form__row' }, [
      Field.number('Personas', 'people', t.people, { min: 1, step: 1 }),
      Field.select('Moneda base', 'baseCurrency', t.baseCurrency, Currency.ALL.map((c) => [c, c])),
    ]),
    Utils.el('div', { class: 'form__row' }, [
      Field.number('Presupuesto (opcional)', 'budget', t.budget, { min: 0, step: 0.01 }),
      Field.select('Moneda del presupuesto', 'budgetCurrency', t.budgetCurrency || t.baseCurrency, Currency.ALL.map((c) => [c, c])),
    ]),
    Field.textarea('Notas', 'notes', t.notes),
    Utils.el('div', { class: 'form__actions' }, [
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => Modal.close() }, 'Cancelar'),
      Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? 'Guardar cambios' : 'Crear viaje'),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    t.name = fd.get('name').trim() || 'Viaje sin nombre';
    t.destination = fd.get('destination').trim();
    t.startDate = fd.get('startDate');
    t.endDate = fd.get('endDate') < fd.get('startDate') ? fd.get('startDate') : fd.get('endDate');
    t.people = Number(fd.get('people')) || 1;
    const prevBase = t.baseCurrency;
    t.baseCurrency = fd.get('baseCurrency');
    t.budget = fd.get('budget');
    t.budgetCurrency = fd.get('budgetCurrency');
    t.notes = fd.get('notes');
    if (!t.currencies) t.currencies = [];
    if (!t.currencies.find((c) => c.code === t.baseCurrency)) {
      t.currencies.push({ code: t.baseCurrency, rate: 1 });
    }
    if (!isEdit) t.createdAt = new Date().toISOString();
    await App.saveTrip(t);
    Modal.close();
    if (isEdit && App.currentTrip && App.currentTrip.id === t.id) {
      await App.refreshCurrentTrip();
      Views.renderTripDetail();
    } else {
      App.goto(`#/trip/${t.id}/resumen`);
    }
  });

  Modal.open(form, { wide: true });
};

// ---------- Helpers de campos de formulario ----------

const Field = {
  text(label, name, value = '', opts = {}) {
    return Utils.el('label', { class: 'field' }, [
      Utils.el('span', {}, label),
      Utils.el('input', { type: 'text', name, value: value || '', placeholder: opts.placeholder || '', required: opts.required ? 'required' : null }),
    ]);
  },
  number(label, name, value = '', opts = {}) {
    return Utils.el('label', { class: 'field' }, [
      Utils.el('span', {}, label),
      Utils.el('input', { type: 'number', name, value: value ?? '', min: opts.min ?? null, step: opts.step ?? 'any', placeholder: opts.placeholder || '' }),
    ]);
  },
  date(label, name, value = '') {
    return Utils.el('label', { class: 'field' }, [
      Utils.el('span', {}, label),
      Utils.el('input', { type: 'date', name, value: value || '', required: 'required' }),
    ]);
  },
  select(label, name, value, options) {
    const select = Utils.el('select', { name }, options.map(([val, text]) =>
      Utils.el('option', { value: val, selected: val === value ? 'selected' : null }, text)));
    return Utils.el('label', { class: 'field' }, [Utils.el('span', {}, label), select]);
  },
  textarea(label, name, value = '') {
    return Utils.el('label', { class: 'field' }, [
      Utils.el('span', {}, label),
      Utils.el('textarea', { name, rows: 3 }, value || ''),
    ]);
  },
  checkbox(label, name, checked) {
    return Utils.el('label', { class: 'field field--checkbox' }, [
      Utils.el('input', { type: 'checkbox', name, checked: checked ? 'checked' : null }),
      Utils.el('span', {}, label),
    ]);
  },

  // Selector de ubicación opcional con mini-mapa. Devuelve { node, getValue, mount }.
  // getValue() -> {lat, lng} | null. mount() debe llamarse DESPUÉS de insertar node en el documento.
  location(label, initial) {
    let lat = initial && initial.lat ? initial.lat : null;
    let lng = initial && initial.lng ? initial.lng : null;

    const mapBox = Utils.el('div', { class: 'location-map' });
    const status = Utils.el('p', { class: 'location-status' }, lat ? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Sin ubicación — tocá el mapa para marcarla');
    const clearBtn = Utils.el('button', { type: 'button', class: 'btn btn--ghost btn--sm', style: lat ? '' : 'display:none' }, 'Quitar ubicación');
    const myLocBtn = Utils.el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, '📍 Usar mi ubicación');

    let mapInstance = null;

    function setValue(newLat, newLng) {
      lat = newLat; lng = newLng;
      status.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      clearBtn.style.display = '';
    }

    clearBtn.addEventListener('click', () => {
      lat = null; lng = null;
      status.textContent = 'Sin ubicación — tocá el mapa para marcarla';
      clearBtn.style.display = 'none';
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
      mapBox.innerHTML = '';
      mapInstance = MapHelper.initPicker(mapBox, null, setValue);
    });

    myLocBtn.addEventListener('click', () => {
      MapHelper.useMyLocation(
        (gotLat, gotLng) => {
          setValue(gotLat, gotLng);
          if (mapInstance) mapInstance.setView([gotLat, gotLng], 15);
          if (mapInstance) {
            L.marker([gotLat, gotLng], { draggable: true }).addTo(mapInstance);
          }
        },
        () => Utils.toast('No se pudo obtener tu ubicación', 'error')
      );
    });

    const node = Utils.el('div', { class: 'field field--location' }, [
      Utils.el('span', {}, label),
      mapBox,
      status,
      Utils.el('div', { class: 'location-actions' }, [myLocBtn, clearBtn]),
    ]);

    return {
      node,
      getValue: () => (lat && lng ? { lat, lng } : null),
      mount: () => { mapInstance = MapHelper.initPicker(mapBox, lat ? { lat, lng } : null, setValue); },
    };
  },
};
