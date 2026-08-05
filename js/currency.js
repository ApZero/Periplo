// currency.js — tasas de cambio con caché local, estilo Open-Meteo (API gratuita sin key)

const Currency = {
  ALL: ['PYG', 'USD', 'EUR', 'ARS', 'BRL', 'GBP', 'CLP', 'UYU', 'BOB', 'MXN', 'COP', 'PEN', 'CAD', 'AUD', 'JPY', 'CHF'],

  async fetchRates(base) {
    // Devuelve tasas: 1 unidad de `base` = X unidades de cada moneda
    // v2 de Frankfurter (api.frankfurter.dev) cubre 201 monedas, incluida PYG — la v1 (.app) no la soporta.
    const url = `https://api.frankfurter.dev/v2/rates?base=${base}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('network');
      const data = await res.json(); // [{date, base, quote, rate}, ...]
      const rates = { [base]: 1 };
      for (const row of data) rates[row.quote] = row.rate;
      await DB.put('meta', { key: `rates-${base}`, base, rates, updatedAt: new Date().toISOString() });
      return { rates, updatedAt: new Date().toISOString(), fresh: true };
    } catch (err) {
      const cached = await DB.get('meta', `rates-${base}`);
      if (cached) return { rates: cached.rates, updatedAt: cached.updatedAt, fresh: false };
      return { rates: { [base]: 1 }, updatedAt: null, fresh: false };
    }
  },

  async getRatesForTrip(trip) {
    // trip.currencies: [{code, rate, manual}] — rate = cuántas unidades de `code` por 1 unidad de baseCurrency
    // Si faltan tasas o son viejas (>1 día) y hay red, se refrescan.
    const base = trip.baseCurrency;
    const needed = trip.currencies.map((c) => c.code).filter((c) => c !== base);
    if (needed.length === 0) return trip;

    const cached = await DB.get('meta', `rates-${base}`);
    const isStale = !cached || (Date.now() - new Date(cached.updatedAt).getTime()) > 24 * 3600 * 1000;

    if (isStale && navigator.onLine) {
      const { rates, updatedAt } = await Currency.fetchRates(base);
      trip.currencies = trip.currencies.map((c) => {
        if (c.code === base) return { ...c, rate: 1 };
        if (c.manual) return c;
        return { ...c, rate: rates[c.code] || c.rate || 1, updatedAt };
      });
    }
    return trip;
  },

  convert(amount, fromCode, toCode, trip) {
    if (fromCode === toCode) return amount;
    const base = trip.baseCurrency;
    const currencies = trip.currencies || [];
    const rateOf = (code) => {
      if (code === base) return 1;
      const entry = currencies.find((c) => c.code === code);
      return entry ? Number(entry.rate) || 1 : 1;
    };
    // amount en fromCode -> base -> toCode
    const amountInBase = amount / rateOf(fromCode);
    return amountInBase * rateOf(toCode);
  },

  async refreshTripRates(trip) {
    const base = trip.baseCurrency;
    const { rates, updatedAt, fresh } = await Currency.fetchRates(base);
    trip.currencies = trip.currencies.map((c) => {
      if (c.code === base) return { ...c, rate: 1, updatedAt };
      return { ...c, rate: rates[c.code] || c.rate || 1, updatedAt, manual: false };
    });
    return { trip, fresh };
  },
};
