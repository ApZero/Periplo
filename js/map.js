// map.js — mapas con Leaflet + OpenStreetMap (gratis, sin API key)
// Los pines son opcionales: la app funciona igual sin ubicar nada.

const MapHelper = {
  DEFAULT_CENTER: [-22.34, -60.03], // Filadelfia, Chaco, como fallback razonable
  DEFAULT_ZOOM: 12,

  available() {
    return typeof L !== 'undefined';
  },

  // Crea un mini-mapa para elegir una ubicación tocando el mapa.
  // container: elemento DOM ya insertado en el documento (con alto fijo por CSS).
  // initial: {lat, lng} o null.
  // onChange(lat, lng): callback cuando el usuario toca o mueve el pin.
  initPicker(container, initial, onChange) {
    if (!MapHelper.available()) {
      container.innerHTML = '<p class="map-unavailable">No se pudo cargar el mapa (sin conexión).</p>';
      return null;
    }
    const center = initial && initial.lat ? [initial.lat, initial.lng] : MapHelper.DEFAULT_CENTER;
    const map = L.map(container, { attributionControl: false }).setView(center, initial && initial.lat ? 15 : MapHelper.DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    let marker = null;
    if (initial && initial.lat) {
      marker = L.marker(center, { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });
    }

    map.on('click', (e) => {
      if (marker) {
        marker.setLatLng(e.latlng);
      } else {
        marker = L.marker(e.latlng, { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        });
      }
      onChange(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => map.invalidateSize(), 80);
    return map;
  },

  useMyLocation(onGot, onError) {
    if (!navigator.geolocation) { onError && onError(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => onGot(pos.coords.latitude, pos.coords.longitude),
      () => onError && onError(),
      { timeout: 8000 }
    );
  },

  // Renderiza un mapa de solo lectura con varios pines.
  // pins: [{lat, lng, title, subtitle, kind}] kind: 'hotel' | 'actividad'
  renderPinsMap(container, pins) {
    if (!MapHelper.available()) {
      container.innerHTML = '<p class="map-unavailable">No se pudo cargar el mapa (sin conexión).</p>';
      return null;
    }
    const valid = pins.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
    const center = valid.length ? [valid[0].lat, valid[0].lng] : MapHelper.DEFAULT_CENTER;
    const map = L.map(container, { attributionControl: false }).setView(center, valid.length ? 13 : 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    const colors = { hotel: '#C4573D', actividad: '#6C7544' };
    const markers = [];
    valid.forEach((p) => {
      const color = colors[p.kind] || '#C6953C';
      const icon = L.divIcon({
        className: 'map-pin',
        html: `<span style="background:${color}"></span>`,
        iconSize: [16, 16],
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
      m.bindPopup(`<strong>${p.title}</strong>${p.subtitle ? `<br>${p.subtitle}` : ''}`);
      markers.push(m);
    });

    if (valid.length > 1) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
    }
    setTimeout(() => map.invalidateSize(), 80);
    return map;
  },
};
