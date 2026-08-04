// views-settings.js — ajustes generales: respaldo, restauración e información

Views.renderSettings = async function () {
  App.root.innerHTML = '';
  const header = Utils.el('header', { class: 'topbar' }, [
    Utils.el('button', { class: 'icon-btn', 'aria-label': 'Volver', onclick: () => App.goto('#/trips') }, '←'),
    Utils.el('h1', {}, 'Ajustes'),
  ]);
  App.root.appendChild(header);

  const main = Utils.el('main', { class: 'view view--settings' });
  const meta = await DB.get('meta', 'lastBackupDate');
  const trips = await DB.getAll('trips');

  main.appendChild(Utils.el('section', { class: 'settings-section' }, [
    Utils.el('h2', {}, 'Respaldo de datos'),
    Utils.el('p', { class: 'muted' }, 'Periplo descarga automáticamente un respaldo JSON una vez por día al abrir la app. También podés hacerlo manualmente o restaurar desde un archivo.'),
    Utils.el('p', {}, meta ? `Último respaldo: ${Utils.fmtDate(meta.value)}` : 'Todavía no se generó ningún respaldo.'),
    Utils.el('button', { class: 'btn btn--primary', onclick: () => Backup.downloadNow() }, '⬇️ Descargar respaldo ahora'),
    Utils.el('label', { class: 'btn btn--ghost file-btn' }, [
      '⬆️ Importar respaldo',
      Utils.el('input', {
        type: 'file', accept: 'application/json', style: 'display:none',
        onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const data = await Backup.importFromFile(file);
            const mode = trips.length > 0 ? await Views.askImportMode() : 'replace';
            if (!mode) return;
            await DB.importAll(data, mode);
            Utils.toast('Respaldo importado ✓', 'success');
            App.goto('#/trips');
          } catch (err) {
            Utils.toast(err.message || 'Error al importar', 'error');
          }
          e.target.value = '';
        },
      }),
    ]),
  ]));

  main.appendChild(Utils.el('section', { class: 'settings-section' }, [
    Utils.el('h2', {}, 'Acerca de'),
    Utils.el('p', { class: 'muted' }, `Periplo — planificador de viajes. ${trips.length} viaje(s) guardados en este dispositivo.`),
    Utils.el('p', { class: 'muted muted--sm' }, 'Todos los datos se guardan localmente en tu teléfono. Nada se envía a ningún servidor, salvo la consulta de tasas de cambio.'),
  ]));

  App.root.appendChild(main);
};

Views.askImportMode = function () {
  return new Promise((resolve) => {
    const box = Utils.el('div', { class: 'form' }, [
      Utils.el('h2', {}, 'Ya tenés datos guardados'),
      Utils.el('p', { class: 'muted' }, '¿Cómo querés importar este respaldo?'),
      Utils.el('div', { class: 'form__actions form__actions--stack' }, [
        Utils.el('button', { class: 'btn btn--primary btn--full', onclick: () => { Modal.close(); resolve('replace'); } }, 'Reemplazar todo lo actual'),
        Utils.el('button', { class: 'btn btn--ghost btn--full', onclick: () => { Modal.close(); resolve('merge'); } }, 'Combinar con lo actual'),
        Utils.el('button', { class: 'btn btn--ghost btn--full', onclick: () => { Modal.close(); resolve(null); } }, 'Cancelar'),
      ]),
    ]);
    Modal.open(box, { persistent: true });
  });
};
