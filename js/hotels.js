// hotels.js — comparador de opciones de hotel y combinaciones por rango de fechas

const Hotels = {
  async listOptions(tripId) {
    const items = await DB.getAll('hotelOptions', 'tripId', tripId);
    return items.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  },

  async listCombos(tripId) {
    return DB.getAll('hotelCombos', 'tripId', tripId);
  },

  optionCost(option) {
    const nights = Utils.nightsBetween(option.startDate, option.endDate);
    const rooms = Number(option.rooms) || 1;
    return nights * Number(option.pricePerNight || 0) * rooms;
  },

  optionCostInCurrency(option, trip, targetCurrency) {
    const cost = Hotels.optionCost(option);
    return Currency.convert(cost, option.currency, targetCurrency, trip);
  },

  // Calcula el costo total de una combinación (lista de segmentos {hotelOptionId, startDate, endDate})
  async comboTotal(combo, trip, targetCurrency, optionsCache = null) {
    const options = optionsCache || (await Hotels.listOptions(trip.id));
    let total = 0;
    const breakdown = [];
    for (const seg of combo.segments) {
      const opt = options.find((o) => o.id === seg.hotelOptionId);
      if (!opt) continue;
      const nights = Utils.nightsBetween(seg.startDate, seg.endDate);
      const rooms = Number(opt.rooms) || 1;
      const costOwn = nights * Number(opt.pricePerNight || 0) * rooms;
      const costConverted = Currency.convert(costOwn, opt.currency, targetCurrency, trip);
      total += costConverted;
      breakdown.push({ option: opt, nights, costOwn, costConverted });
    }
    return { total, breakdown };
  },

  // Detecta huecos o solapamientos de un combo respecto a las fechas del viaje
  validateComboCoverage(combo, trip) {
    const tripNights = Utils.dateRangeArray(trip.startDate, trip.endDate).slice(0, -1); // noches = días menos el último
    const covered = new Set();
    const overlaps = [];
    for (const seg of combo.segments) {
      const segNights = Utils.dateRangeArray(seg.startDate, seg.endDate).slice(0, -1);
      for (const n of segNights) {
        if (covered.has(n)) overlaps.push(n);
        covered.add(n);
      }
    }
    const gaps = tripNights.filter((n) => !covered.has(n));
    return { gaps, overlaps, complete: gaps.length === 0 && overlaps.length === 0 };
  },
};
