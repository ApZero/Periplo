// map.js — mapas con Leaflet + OpenStreetMap (gratis, sin API key)
// Los pines son opcionales: la app funciona igual sin ubicar nada.

const MapHelper = {
  DEFAULT_CENTER: [-22.34, -60.03], // Filadelfia, Chaco, como fallback razonable
  DEFAULT_ZOOM: 12,

  available() {
    return typeof L !== 'undefined';
  },

  // Crea un mini-mapa para elegir una ubicación tocando el mapa, o vía búsqueda.
  // container: elemento DOM ya insertado en el documento (con alto fijo por CSS).
  // initial: {lat, lng} o null.
  // onChange(lat, lng): callback cuando el usuario toca el mapa o mueve el pin.
  // Devuelve { map, setMarker(lat, lng, zoom?) } o null si Leaflet no está disponible.
  initPicker(container, initial, onChange) {
    if (!MapHelper.available()) {
      container.innerHTML = '<p class="map-unavailable">No se pudo cargar el mapa (sin conexión).</p>';
      return null;
    }
    const center = initial && initial.lat ? [initial.lat, initial.lng] : MapHelper.DEFAULT_CENTER;
    const map = L.map(container, { attributionControl: false }).setView(center, initial && initial.lat ? 15 : MapHelper.DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    let marker = initial && initial.lat ? L.marker(center, { draggable: true }).addTo(map) : null;
    if (marker) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });
    }

    function placeMarker(lat, lng) {
      const pos = [lat, lng];
      if (marker) {
        marker.setLatLng(pos);
      } else {
        marker = L.marker(pos, { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          onChange(p.lat, p.lng);
        });
      }
    }

    map.on('click', (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => map.invalidateSize(), 80);

    return {
      map,
      setMarker(lat, lng, zoom) {
        placeMarker(lat, lng);
        map.setView([lat, lng], zoom || 15);
      },
    };
  },

  useMyLocation(onGot, onError) {
    if (!navigator.geolocation) { onError && onError(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => onGot(pos.coords.latitude, pos.coords.longitude),
      () => onError && onError(),
      { timeout: 8000 }
    );
  },

  // Búsqueda de lugares vía Nominatim (OpenStreetMap, gratis, sin API key).
  // bias: {lat, lng} opcional para priorizar resultados cercanos.
  // Devuelve { results, error }. error es null si salió bien (aunque no haya resultados).
  async searchPlaces(query, bias, signal) {
    if (!query || query.trim().length < 3) return { results: [], error: null };
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      addressdetails: '1',
      limit: '6',
    });
    if (bias && bias.lat) {
      const d = 0.6; // ventana aprox. de búsqueda alrededor del punto de sesgo
      params.set('viewbox', `${bias.lng - d},${bias.lat + d},${bias.lng + d},${bias.lat - d}`);
      params.set('bounded', '0');
    }
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    try {
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!res.ok) return { results: [], error: `http_${res.status}` };
      const data = await res.json();
      const results = data.map((r) => ({
        label: r.display_name,
        shortLabel: (r.name && r.name.length) ? r.name : r.display_name.split(',')[0],
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        type: r.type,
        category: r.category,
      }));
      return { results, error: null };
    } catch (err) {
      if (err.name === 'AbortError') return { results: [], error: null };
      return { results: [], error: 'network' };
    }
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
