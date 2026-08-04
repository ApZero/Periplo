// expenses.js — lógica de cálculo de gastos según tipo de costo

const Expenses = {
  // Calcula el total de un gasto individual en su propia moneda (antes de convertir)
  computeTotal(expense, trip) {
    const amount = Number(expense.amount) || 0;
    const days = expense.overrideDays ? Number(expense.overrideDays) : Utils.daysBetween(trip.startDate, trip.endDate);
    const nights = expense.overrideNights ? Number(expense.overrideNights) : Utils.nightsBetween(trip.startDate, trip.endDate);
    const people = expense.overridePeople ? Number(expense.overridePeople) : Number(trip.people) || 1;

    switch (expense.costType) {
      case 'fixed':
        return amount;
      case 'per_day':
        return amount * days;
      case 'per_day_person':
        return amount * days * people;
      case 'per_person':
        return amount * people;
      case 'per_night':
        return amount * nights;
      default:
        return amount;
    }
  },

  computeTotalInCurrency(expense, trip, targetCurrency) {
    const totalInOwnCurrency = Expenses.computeTotal(expense, trip);
    return Currency.convert(totalInOwnCurrency, expense.currency, targetCurrency, trip);
  },

  async listForTrip(tripId) {
    const items = await DB.getAll('expenses', 'tripId', tripId);
    return items.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  },

  async summaryByCategory(trip, displayCurrency) {
    const items = await Expenses.listForTrip(trip.id);
    const byCat = {};
    let total = 0;
    for (const cat of CATEGORIES) byCat[cat.id] = 0;
    for (const e of items) {
      const t = Expenses.computeTotalInCurrency(e, trip, displayCurrency);
      byCat[e.category] = (byCat[e.category] || 0) + t;
      total += t;
    }
    return { byCat, total, count: items.length };
  },

  async budgetVsActual(trip, displayCurrency) {
    const { total } = await Expenses.summaryByCategory(trip, displayCurrency);
    const budget = Currency.convert(Number(trip.budget) || 0, trip.budgetCurrency || trip.baseCurrency, displayCurrency, trip);
    return { budget, spent: total, remaining: budget - total };
  },
};
