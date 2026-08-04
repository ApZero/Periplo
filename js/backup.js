// backup.js — respaldo diario automático + exportación/importación manual

const Backup = {
  async downloadNow(silent = false) {
    const data = await DB.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = Utils.today();
    const a = document.createElement('a');
    a.href = url;
    a.download = `periplo-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await DB.put('meta', { key: 'lastBackupDate', value: date });
    if (!silent) Utils.toast('Respaldo descargado ✓', 'success');
  },

  async checkDailyBackup() {
    const meta = await DB.get('meta', 'lastBackupDate');
    const today = Utils.today();
    const trips = await DB.getAll('trips');
    if (trips.length === 0) return; // nada que respaldar todavía
    if (!meta || meta.value !== today) {
      // pequeña espera para no competir con el render inicial
      setTimeout(() => Backup.downloadNow(true), 1200);
    }
  },

  async importFromFile(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('El archivo no es un JSON válido.');
    }
    if (data._app !== 'periplo') {
      throw new Error('Este archivo no parece ser un respaldo de Periplo.');
    }
    return data;
  },
};
