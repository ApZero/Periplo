// itinerary.js — planificación de qué hacer cada día del viaje

const Itinerary = {
  async listDays(tripId) {
    const items = await DB.getAll('itineraryDays', 'tripId', tripId);
    return items.sort((a, b) => a.date.localeCompare(b.date));
  },

  async getOrCreateDay(tripId, date) {
    const items = await Itinerary.listDays(tripId);
    let day = items.find((d) => d.date === date);
    if (!day) {
      day = { id: uid(), tripId, date, activities: [] };
      await DB.put('itineraryDays', day);
    }
    return day;
  },

  async ensureAllDays(trip) {
    const dates = Utils.dateRangeArray(trip.startDate, trip.endDate);
    const existing = await Itinerary.listDays(trip.id);
    const existingDates = new Set(existing.map((d) => d.date));
    for (const date of dates) {
      if (!existingDates.has(date)) {
        await DB.put('itineraryDays', { id: uid(), tripId: trip.id, date, activities: [] });
      }
    }
    return Itinerary.listDays(trip.id);
  },

  dayTotal(day, trip, targetCurrency) {
    return (day.activities || []).reduce((sum, a) => {
      if (!a.cost) return sum;
      return sum + Currency.convert(Number(a.cost) || 0, a.currency || trip.baseCurrency, targetCurrency, trip);
    }, 0);
  },
};

const ACTIVITY_TYPES = [
  { id: 'comida', label: 'Comida', icon: '🍽️' },
  { id: 'paseo', label: 'Paseo / visita', icon: '🚶' },
  { id: 'aventura', label: 'Aventura', icon: '⛰️' },
  { id: 'traslado', label: 'Traslado', icon: '🚌' },
  { id: 'descanso', label: 'Descanso', icon: '🛌' },
  { id: 'compras', label: 'Compras', icon: '🛍️' },
  { id: 'tramite', label: 'Trámite', icon: '📋' },
  { id: 'otro', label: 'Otro', icon: '📌' },
];
