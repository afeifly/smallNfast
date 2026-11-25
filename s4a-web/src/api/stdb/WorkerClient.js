import StdbWorker from './stdb.worker.js?worker&inline';
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url';

export default class StdbWorkerClient {
  constructor(file, createWorker = () => new StdbWorker()) {
    this.file = file;
    this.files = new Map([[0, file]]);
    this.nextFileId = 0;
    this.worker = createWorker();
    this.pending = new Map();
    this.nextId = 0;
    this.closed = false;
    this.worker.onmessage = event => this.handleMessage(event.data);
    this.worker.onerror = event => this.fail(new Error(event.message || 'STDB worker failed.'));
    this.worker.onmessageerror = () => this.fail(new Error('Invalid response from STDB worker.'));
  }

  async handleMessage(message) {
    if (message.type === 'read') {
      try {
        const file = this.files.get(message.fileId ?? 0);
        if (!file) throw new Error('STDB source file is unavailable.');
        const buffer = await file.slice(message.start, message.end).arrayBuffer();
        if (!this.closed) this.worker.postMessage({ type: 'readResult', id: message.id, buffer }, [buffer]);
      } catch (error) {
        if (!this.closed) this.worker.postMessage({ type: 'readResult', id: message.id, error: error.message || String(error) });
      }
      return;
    }
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.result);
  }

  request(type, payload = {}) {
    if (this.closed) return Promise.reject(new Error('STDB worker is closed.'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, type, payload: type === 'open' || type === 'openCandidate' ? { ...payload, wasmUrl } : payload });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  addFile(file) {
    const id = ++this.nextFileId;
    this.files.set(id, file);
    return id;
  }

  removeFile(id) {
    if (id !== 0) this.files.delete(id);
  }

  fail(error) {
    this.close(error);
  }

  close(error = new Error('STDB file was closed.')) {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
    this.file = null;
    this.files.clear();
  }
}
