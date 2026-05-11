/**
 * fileMapStorage.js
 *
 * Persists multiple cfgf fileMaps to IndexedDB.
 */

const DB_NAME    = 's4c_config_db_v2'; // Bumped version name for structure change
const DB_VERSION = 1;
const STORE_NAME = 'filemaps';

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
 * Save a collection of fileMaps to IndexedDB.
 * @param {Object} fileMapCollection { [configId: string]: Map<string, Uint8Array> }
 */
export async function saveFileMap(fileMapCollection) {
  if (!fileMapCollection) return;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear old ones first to avoid orphaned data? 
    // Actually, let's just put the new ones.
    Object.entries(fileMapCollection).forEach(([id, fileMap]) => {
      const pairs = Array.from(fileMap.entries());
      store.put(pairs, id);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Load all fileMaps from IndexedDB.
 * @returns {Promise<Object>} { [configId: string]: Map<string, Uint8Array> }
 */
export async function loadFileMap() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const keysReq = store.getAllKeys();

    let results = {};
    
    keysReq.onsuccess = () => {
      const keys = keysReq.result;
      req.onsuccess = () => {
        const allPairs = req.result;
        keys.forEach((id, index) => {
          results[id] = new Map(allPairs[index]);
        });
        resolve(results);
      };
    };
    
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Remove a specific stored fileMap or all of them.
 */
export async function clearFileMap(id = null) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    if (id) {
      store.delete(id);
    } else {
      store.clear();
    }
    
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}
