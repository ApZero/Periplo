// views-itinerary.js — qué hacer cada día, organizado por fecha con costo por día

Views.renderItineraryTab = async function (main, trip) {
  main.innerHTML = '<div class="loading">Cargando…</div>';
  const display = App.displayCurrency();
  const days = await Itinerary.ensureAllDays(trip);
  main.innerHTML = '';

  main.appendChild(Utils.el('div', { class: 'tab-header' }, [
    Utils.el('h2', {}, 'Día a día'),
    Utils.el('span', { class: 'muted' }, `${days.length} días`),
  ]));

  const list = Utils.el('div', { class: 'day-list' });
  days.forEach((day, idx) => {
    const dayTotal = Itinerary.dayTotal(day, trip, display);
    const activities = (day.activities || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const card = Utils.el('div', { class: 'day-card' });
    card.appendChild(Utils.el('div', { class: 'day-card__header' }, [
      Utils.el('div', {}, [
        Utils.el('span', { class: 'day-card__number' }, `Día ${idx + 1}`),
        Utils.el('span', { class: 'day-card__date' }, Utils.fmtDate(day.date, { short: false })),
      ]),
      dayTotal > 0 ? Utils.el('span', { class: 'day-card__total' }, Utils.fmtMoney(dayTotal, display)) : null,
    ]));

    const actList = Utils.el('div', { class: 'activity-list' });
    if (activities.length === 0) {
      actList.appendChild(Utils.el('p', { class: 'muted muted--sm' }, 'Sin actividades todavía.'));
    }
    activities.forEach((act) => {
      const type = ACTIVITY_TYPES.find((t) => t.id === act.type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
      actList.appendChild(Utils.el('div', { class: 'activity-row', onclick: () => Views.openActivityForm(trip, day, act) }, [
        Utils.el('span', { class: 'activity-row__time' }, act.time || ''),
        Utils.el('span', { class: 'activity-row__icon' }, type.icon),
        Utils.el('div', { class: 'activity-row__main' }, [
          Utils.el('span', { class: 'activity-row__title' }, act.title),
          act.notes ? Utils.el('span', { class: 'activity-row__notes' }, act.notes) : null,
        ]),
        act.cost ? Utils.el('span', { class: 'activity-row__cost' }, Utils.fmtMoney(act.cost, act.currency || trip.baseCurrency)) : null,
      ]));
    });
    card.appendChild(actList);

    card.appendChild(Utils.el('button', {
      class: 'btn btn--ghost btn--sm btn--full', onclick: () => Views.openActivityForm(trip, day),
    }, '+ Agregar actividad'));

    list.appendChild(card);
  });
  main.appendChild(list);
};

Views.openActivityForm = function (trip, day, activity = null) {
  const isEdit = !!activity;
  const a = activity || { id: uid(), type: 'paseo', time: '', title: '', cost: '', currency: trip.baseCurrency, notes: '', link: '' };

  const form = Utils.el('form', { class: 'form' });
  form.appendChild(Utils.el('h2', {}, isEdit ? 'Editar actividad' : `Agregar a ${Utils.fmtDate(day.date)}`));
  form.appendChild(Field.select('Tipo', 'type', a.type, ACTIVITY_TYPES.map((t) => [t.id, `${t.icon} ${t.label}`])));
  const titleField = Field.text('Título', 'title', a.title, { placeholder: 'Ej: Cerro Catedral', required: true });
  form.appendChild(Utils.el('div', { class: 'form__row' }, [
    Utils.el('label', { class: 'field', style: 'max-width:120px' }, [Utils.el('span', {}, 'Hora'), Utils.el('input', { type: 'time', name: 'time', value: a.time || '' })]),
    titleField,
  ]));
  form.appendChild(Utils.el('div', { class: 'form__row' }, [
    Field.number('Costo estimado (opcional)', 'cost', a.cost, { min: 0, step: 0.01 }),
    Field.select('Moneda', 'currency', a.currency || trip.baseCurrency, trip.currencies.map((c) => [c.code, c.code])),
  ]));
  form.appendChild(Field.textarea('Notas', 'notes', a.notes));
  form.appendChild(Field.text('Enlace (opcional)', 'link', a.link, { placeholder: 'https://…' }));

  const locField = Field.location('Ubicación (opcional)', a.lat ? { lat: a.lat, lng: a.lng } : null, {
    onSelect: (item) => {
      const titleInput = titleField.querySelector('input');
      if (!titleInput.value.trim()) titleInput.value = item.shortLabel;
    },
  });
  form.appendChild(locField.node);

  form.appendChild(Utils.el('div', { class: 'form__actions' }, [
    isEdit ? Utils.el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: async () => {
      const ok = await Utils.confirmDialog('¿Eliminar esta actividad?');
      if (!ok) return;
      day.activities = day.activities.filter((x) => x.id !== a.id);
      await DB.put('itineraryDays', day);
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
    a.type = fd.get('type');
    a.time = fd.get('time');
    a.title = fd.get('title').trim() || 'Actividad';
    a.cost = fd.get('cost') ? Number(fd.get('cost')) : '';
    a.currency = fd.get('currency');
    a.notes = fd.get('notes');
    a.link = fd.get('link');
    const loc = locField.getValue();
    a.lat = loc ? loc.lat : null;
    a.lng = loc ? loc.lng : null;
    day.activities = day.activities || [];
    if (!isEdit) day.activities.push(a);
    else {
      const idx = day.activities.findIndex((x) => x.id === a.id);
      if (idx >= 0) day.activities[idx] = a;
    }
    await DB.put('itineraryDays', day);
    Modal.close();
    Views.renderTripDetail();
  });

  Modal.open(form, { wide: true });
  locField.mount();
};
