const DB_NAME = 'SUTOVoiceoverDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos');
      }
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios');
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Video Blob Storage
export async function saveVideoFile(projectId, fileBlob) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const store = tx.objectStore('videos');
      const request = store.put(fileBlob, projectId);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to save video to IndexedDB:', err);
  }
}

export async function getVideoFile(projectId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readonly');
      const store = tx.objectStore('videos');
      const request = store.get(projectId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to get video from IndexedDB:', err);
    return null;
  }
}

// Audio ArrayBuffer Storage
export async function saveAudioBuffer(trackId, arrayBuffer) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audios', 'readwrite');
      const store = tx.objectStore('audios');
      const request = store.put(arrayBuffer, trackId);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to save audio to IndexedDB:', err);
  }
}

export async function getAudioBuffer(trackId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audios', 'readonly');
      const store = tx.objectStore('audios');
      const request = store.get(trackId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to get audio from IndexedDB:', err);
    return null;
  }
}

export async function deleteProjectStorage(projectId, trackIds = []) {
  try {
    const db = await openDB();
    const tx = db.transaction(['videos', 'audios'], 'readwrite');
    tx.objectStore('videos').delete(projectId);
    const audioStore = tx.objectStore('audios');
    trackIds.forEach(id => audioStore.delete(id));
  } catch (err) {
    console.error('Failed to delete project storage:', err);
  }
}
