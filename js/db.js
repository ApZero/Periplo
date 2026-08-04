// db.js — capa de acceso a IndexedDB para Periplo
const DB_NAME = 'periplo-db';
const DB_VERSION = 1;
const STORES = ['trips', 'expenses', 'hotelOptions', 'hotelCombos', 'itineraryDays', 'meta'];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const s = db.createObjectStore('expenses', { keyPath: 'id' });
        s.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!db.objectStoreNames.contains('hotelOptions')) {
        const s = db.createObjectStore('hotelOptions', { keyPath: 'id' });
        s.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!db.objectStoreNames.contains('hotelCombos')) {
        const s = db.createObjectStore('hotelCombos', { keyPath: 'id' });
        s.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!db.objectStoreNames.contains('itineraryDays')) {
        const s = db.createObjectStore('itineraryDays', { keyPath: 'id' });
        s.createIndex('tripId', 'tripId', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async getAll(storeName, indexName = null, query = null) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const source = indexName ? store.index(indexName) : store;
      const req = query !== null ? source.getAll(query) : source.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async get(storeName, id) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  },
  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async deleteWhere(storeName, indexName, value) {
    const items = await DB.getAll(storeName, indexName, value);
    for (const item of items) {
      await DB.delete(storeName, item.id);
    }
  },
  async clearStore(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async exportAll() {
    const data = {};
    for (const s of STORES) {
      data[s] = await DB.getAll(s);
    }
    data._exportedAt = new Date().toISOString();
    data._app = 'periplo';
    data._version = DB_VERSION;
    return data;
  },
  async importAll(data, mode = 'replace') {
    for (const s of STORES) {
      if (!data[s]) continue;
      if (mode === 'replace') await DB.clearStore(s);
      for (const item of data[s]) {
        await DB.put(s, item);
      }
    }
  },
};

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
