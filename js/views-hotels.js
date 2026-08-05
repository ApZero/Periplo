// views-hotels.js — comparador de hoteles y combinaciones por fechas

Views.renderHotelsTab = async function (main, trip) {
  main.innerHTML = '<div class="loading">Cargando…</div>';
  const display = App.displayCurrency();
  const options = await Hotels.listOptions(trip.id);
  const combos = await Hotels.listCombos(trip.id);
  main.innerHTML = '';

  main.appendChild(Utils.el('div', { class: 'tab-header' }, [
    Utils.el('h2', {}, 'Opciones de hotel'),
    Utils.el('button', { class: 'btn btn--primary btn--sm', onclick: () => Views.openHotelOptionForm(trip) }, '+ Opción'),
  ]));

  if (options.length === 0) {
    main.appendChild(Utils.el('div', { class: 'empty-state empty-state--inline' }, [
      Utils.el('p', {}, 'Agregá alojamientos candidatos con precio por noche, para qué fechas sirven, y sus pros y contras.'),
    ]));
  } else {
    const grid = Utils.el('div', { class: 'hotel-grid' });
    options.forEach((o) => {
      const nights = Utils.nightsBetween(o.startDate, o.endDate);
      const cost = Hotels.optionCostInCurrency(o, trip, display);
      grid.appendChild(Utils.el('div', { class: 'hotel-card', onclick: () => Views.openHotelOptionForm(trip, o) }, [
        Utils.el('div', { class: 'hotel-card__top' }, [
          Utils.el('h4', {}, o.name),
          Utils.el('span', { class: 'hotel-card__price' }, Utils.fmtMoney(cost, display)),
        ]),
        Utils.el('p', { class: 'hotel-card__dates' }, `${Utils.fmtDateRange(o.startDate, o.endDate)} · ${nights} noches × ${o.rooms || 1} hab.`),
        Utils.el('p', { class: 'hotel-card__rate' }, `${Utils.fmtMoney(o.pricePerNight, o.currency)} / noche`),
        (o.pros || o.cons) ? Utils.el('div', { class: 'hotel-card__proscons' }, [
          o.pros ? Utils.el('div', { class: 'hotel-card__pros' }, [Utils.el('strong', {}, '+ '), o.pros]) : null,
          o.cons ? Utils.el('div', { class: 'hotel-card__cons' }, [Utils.el('strong', {}, '– '), o.cons]) : null,
        ]) : null,
      ]));
    });
    main.appendChild(grid);
  }

  main.appendChild(Utils.el('div', { class: 'tab-header' }, [
    Utils.el('h2', {}, 'Combinaciones'),
    options.length >= 1 ? Utils.el('button', { class: 'btn btn--primary btn--sm', onclick: () => Views.openComboForm(trip, options) }, '+ Combinación') : null,
  ]));

  if (options.length === 0) {
    main.appendChild(Utils.el('p', { class: 'muted' }, 'Agregá al menos una opción de hotel para armar combinaciones.'));
  } else if (combos.length === 0) {
    main.appendChild(Utils.el('p', { class: 'muted' }, 'Una combinación asigna un hotel distinto a cada tramo de fechas del viaje — útil si te movés entre ciudades o querés comparar paquetes completos.'));
  } else {
    for (const combo of combos) {
      const { total, breakdown } = await Hotels.comboTotal(combo, trip, display, options);
      const coverage = Hotels.validateComboCoverage(combo, trip);
      const card = Utils.el('div', { class: 'combo-card' }, [
        Utils.el('div', { class: 'combo-card__top' }, [
          Utils.el('h4', {}, combo.name || 'Combinación'),
          Utils.el('span', { class: 'combo-card__total' }, Utils.fmtMoney(total, display)),
        ]),
        ...breakdown.map((b) => Utils.el('div', { class: 'combo-card__segment' }, [
          Utils.el('span', {}, `${b.option.name} · ${b.nights} noches`),
          Utils.el('span', {}, Utils.fmtMoney(b.costConverted, display)),
        ])),
        !coverage.complete ? Utils.el('p', { class: 'combo-card__warning' },
          coverage.gaps.length ? `⚠️ Faltan ${coverage.gaps.length} noche(s) sin cubrir` : `⚠️ Hay noches solapadas entre tramos`) : null,
        Utils.el('div', { class: 'combo-card__actions' }, [
          Utils.el('button', { class: 'btn btn--ghost btn--sm', onclick: () => Views.openComboForm(trip, options, combo) }, 'Editar'),
          Utils.el('button', { class: 'btn btn--ghost btn--sm', onclick: async () => {
            const ok = await Utils.confirmDialog('¿Eliminar esta combinación?');
            if (!ok) return;
            await DB.delete('hotelCombos', combo.id);
            Views.renderTripDetail();
          } }, 'Eliminar'),
        ]),
      ]);
      main.appendChild(card);
    }
  }
};

Views.openHotelOptionForm = function (trip, option = null) {
  const isEdit = !!option;
  const o = option || {
    id: uid(), tripId: trip.id, name: '', startDate: trip.startDate, endDate: trip.endDate,
    pricePerNight: '', currency: trip.baseCurrency, rooms: 1, pros: '', cons: '', notes: '', link: '',
  };

  const form = Utils.el('form', { class: 'form' });
  form.appendChild(Utils.el('h2', {}, isEdit ? 'Editar opción de hotel' : 'Nueva opción de hotel'));
  const nameField = Field.text('Nombre', 'name', o.name, { placeholder: 'Ej: Hotel Panamericano', required: true });
  form.appendChild(nameField);
  form.appendChild(Utils.el('div', { class: 'form__row' }, [Field.date('Check-in', 'startDate', o.startDate), Field.date('Check-out', 'endDate', o.endDate)]));

  const priceMode = o.priceMode || 'per_night';
  const modeSelect = Field.select('¿Cómo querés cargar el precio?', 'priceMode', priceMode, [
    ['per_night', 'Precio por noche'],
    ['total', 'Precio total de la estadía'],
  ]);
  form.appendChild(modeSelect);

  const priceRow = Utils.el('div', { class: 'form__row' }, [
    Field.number('Precio por noche', 'pricePerNight', o.pricePerNight, { min: 0, step: 0.01 }),
    Field.number('Precio total', 'totalPrice', o.totalPrice, { min: 0, step: 0.01 }),
    Field.select('Moneda', 'currency', o.currency, trip.currencies.map((c) => [c.code, c.code])),
    Field.number('Habitaciones', 'rooms', o.rooms, { min: 1, step: 1 }),
  ]);
  form.appendChild(priceRow);

  const perNightField = priceRow.children[0];
  const totalField = priceRow.children[1];

  const preview = Utils.el('div', { class: 'calc-preview' });
  form.appendChild(preview);

  function applyModeVisibility(mode) {
    perNightField.style.display = mode === 'per_night' ? '' : 'none';
    totalField.style.display = mode === 'total' ? '' : 'none';
  }
  applyModeVisibility(priceMode);

  function updatePreview() {
    const fd = new FormData(form);
    const nights = Utils.nightsBetween(fd.get('startDate'), fd.get('endDate')) || 0;
    const rooms = Number(fd.get('rooms')) || 1;
    const mode = fd.get('priceMode');
    const currency = fd.get('currency');
    if (mode === 'total') {
      const total = Number(fd.get('totalPrice')) || 0;
      const perNight = nights > 0 ? total / (nights * rooms) : 0;
      preview.textContent = `${nights} noches → ${Utils.fmtMoney(perNight, currency)} por noche (por habitación)`;
    } else {
      const perNight = Number(fd.get('pricePerNight')) || 0;
      const total = perNight * nights * rooms;
      preview.textContent = `${nights} noches → total: ${Utils.fmtMoney(total, currency)}`;
    }
  }
  form.addEventListener('input', (ev) => {
    if (ev.target.name === 'priceMode') applyModeVisibility(ev.target.value);
    updatePreview();
  });
  setTimeout(updatePreview, 0);

  form.appendChild(Field.text('Pros', 'pros', o.pros, { placeholder: 'Ej: cerca del centro, desayuno incluido' }));
  form.appendChild(Field.text('Contras', 'cons', o.cons, { placeholder: 'Ej: sin pileta, wifi lento' }));
  form.appendChild(Field.text('Enlace (opcional)', 'link', o.link, { placeholder: 'https://…' }));
  form.appendChild(Field.textarea('Notas', 'notes', o.notes));

  const locField = Field.location('Ubicación (opcional)', o.lat ? { lat: o.lat, lng: o.lng } : null, {
    onSelect: (item) => {
      const nameInput = nameField.querySelector('input');
      if (!nameInput.value.trim()) nameInput.value = item.shortLabel;
    },
  });
  form.appendChild(locField.node);

  form.appendChild(Utils.el('div', { class: 'form__actions' }, [
    isEdit ? Utils.el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: async () => {
      const ok = await Utils.confirmDialog('¿Eliminar esta opción de hotel?');
      if (!ok) return;
      await DB.delete('hotelOptions', o.id);
      Modal.close();
      Views.renderTripDetail();
    } }, 'Eliminar') : Utils.el('span', {}),
    Utils.el('div', {}, [
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => Modal.close() }, 'Cancelar'),
      Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Guardar'),
    ]),
  ]));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    o.name = fd.get('name').trim() || 'Opción sin nombre';
    o.startDate = fd.get('startDate');
    o.endDate = fd.get('endDate');
    o.currency = fd.get('currency');
    o.rooms = Number(fd.get('rooms')) || 1;
    o.priceMode = fd.get('priceMode');
    const nights = Utils.nightsBetween(o.startDate, o.endDate) || 0;
    if (o.priceMode === 'total') {
      o.totalPrice = Number(fd.get('totalPrice')) || 0;
      o.pricePerNight = nights > 0 ? Utils.round2(o.totalPrice / (nights * o.rooms)) : 0;
    } else {
      o.pricePerNight = Number(fd.get('pricePerNight')) || 0;
      o.totalPrice = Utils.round2(o.pricePerNight * nights * o.rooms);
    }
    o.pros = fd.get('pros');
    o.cons = fd.get('cons');
    o.link = fd.get('link');
    o.notes = fd.get('notes');
    const loc = locField.getValue();
    o.lat = loc ? loc.lat : null;
    o.lng = loc ? loc.lng : null;
    await DB.put('hotelOptions', o);
    Modal.close();
    Views.renderTripDetail();
  });

  Modal.open(form, { wide: true });
  locField.mount();
};

Views.openComboForm = function (trip, options, combo = null) {
  const isEdit = !!combo;
  const c = combo || { id: uid(), tripId: trip.id, name: '', segments: [{ hotelOptionId: options[0].id, startDate: trip.startDate, endDate: trip.endDate }] };

  const box = Utils.el('div', { class: 'form' });
  box.appendChild(Utils.el('h2', {}, isEdit ? 'Editar combinación' : 'Nueva combinación'));
  const nameField = Field.text('Nombre de la combinación', 'name', c.name, { placeholder: 'Ej: Centro + playa' });
  box.appendChild(nameField);

  const segmentsBox = Utils.el('div', { class: 'segments-box' });
  box.appendChild(segmentsBox);

  function renderSegments() {
    segmentsBox.innerHTML = '';
    c.segments.forEach((seg, idx) => {
      const row = Utils.el('div', { class: 'segment-row' });
      const select = Utils.el('select', {}, options.map((o) => Utils.el('option', { value: o.id, selected: o.id === seg.hotelOptionId ? 'selected' : null }, o.name)));
      select.addEventListener('change', () => { seg.hotelOptionId = select.value; });
      const startInput = Utils.el('input', { type: 'date', value: seg.startDate });
      startInput.addEventListener('change', () => { seg.startDate = startInput.value; });
      const endInput = Utils.el('input', { type: 'date', value: seg.endDate });
      endInput.addEventListener('change', () => { seg.endDate = endInput.value; });
      const removeBtn = Utils.el('button', { type: 'button', class: 'icon-btn icon-btn--sm', onclick: () => { c.segments.splice(idx, 1); renderSegments(); } }, '✕');
      row.appendChild(select); row.appendChild(startInput); row.appendChild(endInput);
      if (c.segments.length > 1) row.appendChild(removeBtn);
      segmentsBox.appendChild(row);
    });
  }
  renderSegments();

  box.appendChild(Utils.el('button', {
    type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => {
      c.segments.push({ hotelOptionId: options[0].id, startDate: trip.startDate, endDate: trip.endDate });
      renderSegments();
    },
  }, '+ Agregar tramo'));

  box.appendChild(Utils.el('div', { class: 'form__actions' }, [
    isEdit ? Utils.el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: async () => {
      const ok = await Utils.confirmDialog('¿Eliminar esta combinación?');
      if (!ok) return;
      await DB.delete('hotelCombos', c.id);
      Modal.close();
      Views.renderTripDetail();
    } }, 'Eliminar') : Utils.el('span', {}),
    Utils.el('div', {}, [
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => Modal.close() }, 'Cancelar'),
      Utils.el('button', { type: 'button', class: 'btn btn--primary', onclick: async () => {
        c.name = nameField.querySelector('input').value.trim() || 'Combinación';
        await DB.put('hotelCombos', c);
        Modal.close();
        Views.renderTripDetail();
      } }, 'Guardar'),
    ]),
  ]));

  Modal.open(box, { wide: true });
};
