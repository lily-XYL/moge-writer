/* ============ 墨阁 · 本地数据库（IndexedDB，完全离线） ============ */
window.DB = (() => {
  const DB_NAME = 'moge-studio';
  const DB_VERSION = 2;
  const STORES = ['works', 'volumes', 'chapters', 'characters', 'entries', 'outlines',
    'foreshadows', 'timeline', 'ideas', 'dailyStats', 'settings', 'backups', 'relationGraphs'];

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) { reject(e); return; }
      req.onupgradeneeded = e => {
        const db = e.target.result;
        const mk = (name, key, idx) => {
          if (db.objectStoreNames.contains(name)) return;
          const s = db.createObjectStore(name, { keyPath: key });
          (idx || []).forEach(i => s.createIndex(i, i, { unique: false }));
        };
        mk('works', 'id');
        mk('volumes', 'id', ['workId']);
        mk('chapters', 'id', ['workId', 'volumeId']);
        mk('characters', 'id', ['workId']);
        mk('entries', 'id', ['workId']);
        mk('outlines', 'id', ['workId']);
        mk('foreshadows', 'id', ['workId']);
        mk('timeline', 'id', ['workId']);
        mk('ideas', 'id', ['workId']);
        mk('dailyStats', 'id', ['workId']);
        mk('settings', 'key');
        mk('backups', 'id');
        mk('relationGraphs', 'id', ['workId']);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(req.error);
    });
    return dbPromise;
  }

  function reqToPromise(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function getAll(store) {
    return open().then(db => reqToPromise(db.transaction(store, 'readonly').objectStore(store).getAll()));
  }
  function getByIndex(store, index, value) {
    return open().then(db => reqToPromise(db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value)));
  }
  function get(store, id) {
    return open().then(db => reqToPromise(db.transaction(store, 'readonly').objectStore(store).get(id)));
  }
  function put(store, obj) {
    return open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = () => res(obj);
      tx.onerror = () => rej(tx.error);
    }));
  }
  function putMany(store, objs) {
    return open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      objs.forEach(o => s.put(o));
      tx.oncomplete = () => res(objs.length);
      tx.onerror = () => rej(tx.error);
    }));
  }
  function del(store, id) {
    return open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }
  function clearStore(store) {
    return open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }
  function wipe() {
    return Promise.all(STORES.map(clearStore));
  }
  return { open, getAll, getByIndex, get, put, putMany, del, clearStore, wipe, STORES };
})();
