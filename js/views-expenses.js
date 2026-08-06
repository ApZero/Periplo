// views-expenses.js — gestión de gastos por categoría con recálculo automático

Views.renderExpensesTab = async function (main, trip) {
  main.innerHTML = '<div class="loading">Cargando…</div>';
  const display = App.displayCurrency();
  const items = await Expenses.listForTrip(trip.id);
  main.innerHTML = '';

  const header = Utils.el('div', { class: 'tab-header' }, [
    Utils.el('h2', {}, 'Gastos'),
    Utils.el('button', { class: 'btn btn--primary btn--sm', onclick: () => Views.openExpenseForm(trip) }, '+ Gasto'),
  ]);
  main.appendChild(header);

  if (items.length === 0) {
    main.appendChild(Utils.el('div', { class: 'empty-state empty-state--inline' }, [
      Utils.el('p', {}, 'Todavía no cargaste gastos. Agregá vuelos, comida, entradas y más.'),
    ]));
    return;
  }

  const byCat = {};
  items.forEach((e) => { (byCat[e.category] = byCat[e.category] || []).push(e); });

  CATEGORIES.forEach((cat) => {
    const catItems = byCat[cat.id];
    if (!catItems || catItems.length === 0) return;
    const catTotal = catItems.reduce((s, e) => s + Expenses.computeTotalInCurrency(e, trip, display), 0);
    main.appendChild(Utils.el('div', { class: 'expense-cat-header' }, [
      Utils.el('span', {}, `${cat.icon} ${cat.label}`),
      Utils.el('span', { class: 'expense-cat-header__total' }, Utils.fmtMoney(catTotal, display)),
    ]));
    const list = Utils.el('div', { class: 'expense-list' });
    catItems.forEach((e) => list.appendChild(Views.expenseRow(e, trip, display)));
    main.appendChild(list);
  });
};

Views.expenseRow = function (expense, trip, display) {
  const total = Expenses.computeTotalInCurrency(expense, trip, display);
  const costTypeLabel = (COST_TYPES.find((c) => c.id === expense.costType) || {}).label || '';
  const showOwnCurrency = expense.currency !== display;
  let meta = `${costTypeLabel}${showOwnCurrency ? ` · ${Utils.fmtMoney(expense.amount, expense.currency)} c/u` : ''}`;
  if (expense.costType === 'per_km') {
    const km = Expenses.totalKm(expense);
    meta = `${km} km × ${Utils.fmtMoney(expense.amount, expense.currency)}/km${expense.routes && expense.routes.length > 1 ? ` (${expense.routes.length} recorridos)` : ''}`;
  }
  return Utils.el('div', { class: 'expense-row', onclick: () => Views.openExpenseForm(trip, expense) }, [
    Utils.el('div', { class: 'expense-row__main' }, [
      Utils.el('span', { class: 'expense-row__name' }, expense.name || costTypeLabel),
      Utils.el('span', { class: 'expense-row__meta' }, meta),
    ]),
    Utils.el('span', { class: 'expense-row__amount' }, Utils.fmtMoney(total, display)),
  ]);
};

Views.openExpenseForm = function (trip, expense = null) {
  const isEdit = !!expense;
  const e = expense || {
    id: uid(), tripId: trip.id, category: 'comida', name: '', costType: 'per_day_person',
    amount: '', currency: trip.baseCurrency, overrideDays: '', overrideNights: '', overridePeople: '', routes: [], notes: '',
  };
  if (!e.routes) e.routes = [];

  const form = Utils.el('form', { class: 'form' });
  form.appendChild(Utils.el('h2', {}, isEdit ? 'Editar gasto' : 'Nuevo gasto'));
  form.appendChild(Field.select('Categoría', 'category', e.category, CATEGORIES.map((c) => [c.id, `${c.icon} ${c.label}`])));
  form.appendChild(Field.text('Descripción', 'name', e.name, { placeholder: 'Ej: Vuelo Asunción–Bariloche' }));

  const costTypeSelect = Field.select('Tipo de costo', 'costType', e.costType, COST_TYPES.map((c) => [c.id, c.label]));
  form.appendChild(costTypeSelect);
  const hint = Utils.el('p', { class: 'field-hint' }, (COST_TYPES.find((c) => c.id === e.costType) || {}).hint || '');
  form.appendChild(hint);
  costTypeSelect.querySelector('select').addEventListener('change', (ev) => {
    hint.textContent = (COST_TYPES.find((c) => c.id === ev.target.value) || {}).hint || '';
    updateOverridesVisibility(ev.target.value);
    updateRoutesVisibility(ev.target.value);
    updateAmountLabel(ev.target.value);
    updatePreview();
  });

  const amountField = Field.number('Monto', 'amount', e.amount, { min: 0, step: 0.01 });
  form.appendChild(Utils.el('div', { class: 'form__row' }, [
    amountField,
    Field.select('Moneda', 'currency', e.currency, trip.currencies.map((c) => [c.code, c.code])),
  ]));
  const amountLabelSpan = amountField.querySelector('span');
  function updateAmountLabel(costType) {
    amountLabelSpan.textContent = costType === 'per_km' ? 'Precio por km' : 'Monto';
  }
  updateAmountLabel(e.costType);

  const overridesBox = Utils.el('div', { class: 'form__row overrides-box' }, [
    Field.number('Días (si no, usa los del viaje)', 'overrideDays', e.overrideDays, { min: 0, step: 1 }),
    Field.number('Noches (si no, usa las del viaje)', 'overrideNights', e.overrideNights, { min: 0, step: 1 }),
    Field.number('Personas (si no, usa las del viaje)', 'overridePeople', e.overridePeople, { min: 0, step: 1 }),
  ]);
  form.appendChild(overridesBox);

  function updateOverridesVisibility(costType) {
    const fields = Utils.$all('.field', overridesBox);
    const [daysF, nightsF, peopleF] = fields;
    daysF.style.display = (costType === 'per_day' || costType === 'per_day_person') ? '' : 'none';
    nightsF.style.display = (costType === 'per_night') ? '' : 'none';
    peopleF.style.display = (costType === 'per_day_person' || costType === 'per_person') ? '' : 'none';
  }
  updateOverridesVisibility(e.costType);

  // ---- Recorridos (para "Por distancia") ----
  const routesList = Utils.el('div', { class: 'routes-list' });
  const routesTotal = Utils.el('p', { class: 'routes-total' });
  const routesWrap = Utils.el('div', { class: 'routes-wrap' }, [
    Utils.el('span', { class: 'field-hint field-hint--label' }, 'Recorridos'),
    routesList,
    routesTotal,
    Utils.el('button', {
      type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => {
        e.routes.push({ id: uid(), label: '', km: '' });
        renderRoutes();
      },
    }, '+ Agregar recorrido'),
  ]);
  form.appendChild(routesWrap);

  function updateRoutesTotalText() {
    routesTotal.textContent = `Distancia total: ${Expenses.totalKm(e)} km`;
  }

  function renderRoutes() {
    routesList.innerHTML = '';
    e.routes.forEach((r, idx) => {
      const labelInput = Utils.el('input', { type: 'text', placeholder: 'Ej: Asunción → Encarnación', value: r.label || '' });
      labelInput.addEventListener('input', () => { r.label = labelInput.value; });
      const kmInput = Utils.el('input', { type: 'number', min: 0, step: 'any', placeholder: 'km', value: r.km ?? '' });
      kmInput.addEventListener('input', () => { r.km = Number(kmInput.value) || 0; updateRoutesTotalText(); updatePreview(); });
      const removeBtn = Utils.el('button', {
        type: 'button', class: 'icon-btn icon-btn--sm', onclick: () => { e.routes.splice(idx, 1); renderRoutes(); updatePreview(); },
      }, '✕');
      routesList.appendChild(Utils.el('div', { class: 'route-row' }, [labelInput, kmInput, removeBtn]));
    });
    updateRoutesTotalText();
  }
  renderRoutes();

  function updateRoutesVisibility(costType) {
    routesWrap.style.display = costType === 'per_km' ? '' : 'none';
  }
  updateRoutesVisibility(e.costType);

  const preview = Utils.el('div', { class: 'calc-preview' });
  form.appendChild(preview);

  function updatePreview() {
    const fd = new FormData(form);
    const costType = fd.get('costType');
    const currency = fd.get('currency');
    let total;
    if (costType === 'per_km') {
      total = (Number(fd.get('amount')) || 0) * Expenses.totalKm(e);
    } else {
      const draft = {
        costType, amount: fd.get('amount'), currency,
        overrideDays: fd.get('overrideDays'), overrideNights: fd.get('overrideNights'), overridePeople: fd.get('overridePeople'),
      };
      total = Expenses.computeTotal(draft, trip);
    }
    preview.textContent = `Total calculado: ${Utils.fmtMoney(total, currency)}`;
  }
  form.addEventListener('input', updatePreview);
  setTimeout(updatePreview, 0);

  form.appendChild(Field.textarea('Notas', 'notes', e.notes));

  const actions = Utils.el('div', { class: 'form__actions' }, [
    isEdit ? Utils.el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: async () => {
      const ok = await Utils.confirmDialog('¿Eliminar este gasto?');
      if (!ok) return;
      await DB.delete('expenses', e.id);
      Modal.close();
      Views.renderTripDetail();
    } }, 'Eliminar') : Utils.el('span', {}),
    Utils.el('div', {}, [
      Utils.el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => Modal.close() }, 'Cancelar'),
      Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Guardar'),
    ]),
  ]);
  form.appendChild(actions);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    e.category = fd.get('category');
    e.name = fd.get('name').trim();
    e.costType = fd.get('costType');
    e.amount = Number(fd.get('amount')) || 0;
    e.currency = fd.get('currency');
    e.overrideDays = fd.get('overrideDays') || '';
    e.overrideNights = fd.get('overrideNights') || '';
    e.overridePeople = fd.get('overridePeople') || '';
    e.routes = e.costType === 'per_km' ? e.routes.filter((r) => r.km) : [];
    e.notes = fd.get('notes');
    if (!isEdit) e.createdAt = new Date().toISOString();
    await DB.put('expenses', e);
    Modal.close();
    Views.renderTripDetail();
  });

  Modal.open(form, { wide: true });
};
