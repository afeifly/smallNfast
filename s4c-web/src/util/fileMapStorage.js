/**
 * fileMapStorage.js
 *
 * Persists the cfgf fileMap (Map<string, Uint8Array>) to IndexedDB so it
 * survives page refreshes.  localStorage is limited to ~5 MB and cannot hold
 * binary data natively; IndexedDB has no practical size limit and stores
 * Uint8Array directly.
 *
 * API
 * ───
 *   saveFileMap(fileMap)  → Promise<void>
 *   loadFileMap()         → Promise<Map<string, Uint8Array> | null>
 *   clearFileMap()        → Promise<void>
 */

const DB_NAME    = 's4c_config_db';
const DB_VERSION = 1;
const STORE_NAME = 'filemap';
const RECORD_KEY = 'current'; // single record: array of [path, Uint8Array] pairs

/** Open (or create) the IndexedDB database. */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Save a fileMap to IndexedDB.
 * @param {Map<string, Uint8Array>} fileMap
 */
export async function saveFileMap(fileMap) {
  if (!fileMap) return;
  const db    = await openDb();
  // Convert Map → plain array so IDB can store it
  const pairs = Array.from(fileMap.entries());

  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(pairs, RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Load the fileMap from IndexedDB.
 * @returns {Promise<Map<string, Uint8Array> | null>}
 */
export async function loadFileMap() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(RECORD_KEY);

    req.onsuccess = (e) => {
      const pairs = e.target.result;
      if (!pairs) { resolve(null); return; }
      // Restore plain array → Map<string, Uint8Array>
      resolve(new Map(pairs));
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Remove the stored fileMap (e.g. when user clears config).
 */
export async function clearFileMap() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}
