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
 * Save a SINGLE fileMap entry to IndexedDB immediately.
 * This is the preferred method — call it directly in addConfig/deleteConfig/alarm flush.
 * @param {string} id - The config ID (key).
 * @param {Map<string, Uint8Array>} fileMap - The fileMap to persist.
 */
export async function saveOneFileMap(id, fileMap) {
  if (!id || !fileMap) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const pairs = Array.from(fileMap.entries());
    console.log(`[fileMapStorage] saveOneFileMap: Writing ${pairs.length} entries for ID "${id}"`);
    store.put(pairs, id);
    tx.oncomplete = () => {
      console.log(`[fileMapStorage] saveOneFileMap: Committed to IndexedDB for ID "${id}"`);
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
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
    
    Object.entries(fileMapCollection).forEach(([id, fileMap]) => {
      const pairs = Array.from(fileMap.entries());
      store.put(pairs, id);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function loadFileMap() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const results = {};

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value) {
          results[cursor.key] = new Map(cursor.value);
          console.log(`[fileMapStorage] loadFileMap: Loaded ${cursor.value.length} entries for ID "${cursor.key}"`);
        }
        cursor.continue();
      } else {
        console.log('[fileMapStorage] loadFileMap: Done. Total keys found:', Object.keys(results));
        resolve(results);
      }
    };

    req.onerror = (e) => reject(e.target.error);
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
