// views-map.js — mapa combinado de hoteles y actividades con ubicación

Views.renderMapTab = async function (main, trip) {
  main.innerHTML = '<div class="loading">Cargando…</div>';
  const [hotels, days] = await Promise.all([Hotels.listOptions(trip.id), Itinerary.listDays(trip.id)]);
  main.innerHTML = '';

  main.appendChild(Utils.el('div', { class: 'tab-header' }, [Utils.el('h2', {}, 'Mapa del viaje')]));

  const pins = [];
  hotels.forEach((h) => {
    if (typeof h.lat === 'number') {
      pins.push({ lat: h.lat, lng: h.lng, title: `🏨 ${h.name}`, subtitle: Utils.fmtDateRange(h.startDate, h.endDate), kind: 'hotel' });
    }
  });
  days.forEach((day) => {
    (day.activities || []).forEach((act) => {
      if (typeof act.lat === 'number') {
        pins.push({ lat: act.lat, lng: act.lng, title: `📌 ${act.title}`, subtitle: Utils.fmtDate(day.date, { short: true }), kind: 'actividad' });
      }
    });
  });

  if (pins.length === 0) {
    main.appendChild(Utils.el('div', { class: 'empty-state empty-state--inline' }, [
      Utils.el('p', {}, 'Todavía no marcaste ninguna ubicación. Podés agregar una al editar un hotel o una actividad del itinerario.'),
    ]));
    return;
  }

  main.appendChild(Utils.el('div', { class: 'map-legend' }, [
    Utils.el('span', {}, [Utils.el('i', { class: 'map-legend__dot', style: 'background:#C4573D' }), ' Hoteles']),
    Utils.el('span', {}, [Utils.el('i', { class: 'map-legend__dot', style: 'background:#6C7544' }), ' Actividades']),
  ]));

  const mapContainer = Utils.el('div', { class: 'map-full' });
  main.appendChild(mapContainer);
  MapHelper.renderPinsMap(mapContainer, pins);
};
