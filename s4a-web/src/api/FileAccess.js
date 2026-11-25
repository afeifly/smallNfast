import TauriSutoAPI from './TauriSutoAPI';

const IDB_NAME = 'CsdFilesDB';
const IDB_STORE = 'fileHandles';

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = event => event.target.result.createObjectStore(IDB_STORE);
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

export async function putHandle(key, value) {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = event => reject(event.target.error);
    });
  } catch (error) {
    console.warn('[FileAccess] Failed to save file handle:', error);
  }
}

export async function getHandle(key) {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event.target.error);
    });
  } catch (error) {
    console.warn('[FileAccess] Failed to read file handle:', error);
    return undefined;
  }
}

export async function deleteHandle(key) {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = event => reject(event.target.error);
    });
  } catch (error) {
    console.warn('[FileAccess] Failed to delete file handle:', error);
  }
}

export function saveRecentMeta(name, size, path = null) {
  try {
    let list = JSON.parse(localStorage.getItem('recentCsdFiles') || '[]');
    list = list.filter(file => file.name !== name && (!path || file.path !== path));
    list.unshift({ name, size, path, lastOpened: Date.now() });
    localStorage.setItem('recentCsdFiles', JSON.stringify(list.slice(0, 10)));
    if (path && TauriSutoAPI.isAvailable()) {
      TauriSutoAPI.addRecentFile(path).catch(error => console.warn('[FileAccess] Failed to add recent file:', error));
    }
    TauriSutoAPI.pushLocalStateToLanBridge?.().catch?.(() => {});
  } catch (error) {
    console.warn('[FileAccess] Failed to save recent file:', error);
  }
}

function cleanArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes;
  if (!bytes || !bytes.buffer) return new ArrayBuffer(0);
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) return bytes.buffer;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function createFileWrapperFromPath(filePath) {
  if (TauriSutoAPI.isAvailable()) {
    const stats = await TauriSutoAPI.getFileStats(filePath);
    const size = stats.size || 0;
    return {
      name: stats.name || filePath.split(/[/\\]/).pop(),
      path: filePath,
      size,
      slice(start, end) {
        const length = Math.max(0, end - start);
        return {
          arrayBuffer: async () => cleanArrayBuffer(await TauriSutoAPI.readFileSlice(filePath, start, length)),
          text: async () => new TextDecoder().decode(await TauriSutoAPI.readFileSlice(filePath, start, length))
        };
      },
      async arrayBuffer() { return cleanArrayBuffer(await TauriSutoAPI.readFile(filePath)); },
      async text() { return new TextDecoder().decode(await TauriSutoAPI.readFile(filePath)); }
    };
  }
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    const fs = window.require('fs');
    const path = window.require('path');
    const stats = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      slice(start, end) {
        const buffer = new Uint8Array(Math.max(0, end - start));
        const fd = fs.openSync(filePath, 'r');
        try {
          const length = fs.readSync(fd, buffer, 0, buffer.length, start);
          const bytes = buffer.subarray(0, length);
          return {
            arrayBuffer: async () => cleanArrayBuffer(bytes),
            text: async () => new TextDecoder().decode(bytes)
          };
        } finally {
          fs.closeSync(fd);
        }
      },
      async arrayBuffer() { return cleanArrayBuffer(fs.readFileSync(filePath)); },
      async text() { return fs.readFileSync(filePath, 'utf8'); }
    };
  }
  throw new Error('Neither Tauri nor Node.js environment is available to read from path');
}
