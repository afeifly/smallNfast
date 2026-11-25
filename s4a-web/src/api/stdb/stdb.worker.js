import SQLiteFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import StdbDatabase from './Database.js';
import CombinedDatabase from './CombinedDatabase.js';
import { exportHeader, exportRows, exportFooter } from './Export.js';

let database;
let view;
let sources = [];
let candidate;
let nextReadId = 0;
const pendingReads = new Map();
let queue = Promise.resolve();
const encoder = new TextEncoder();

function readSlice(fileId, start, end) {
  const id = ++nextReadId;
  return new Promise((resolve, reject) => {
    pendingReads.set(id, { resolve, reject });
    self.postMessage({ type: 'read', id, fileId, start, end });
  });
}

async function openDatabase(payload) {
    if (payload.size < 80) throw new Error('Invalid STDB header.');
    const fileId = payload.fileId ?? 0;
    const header = await readSlice(fileId, 0, 80);
    const bytes = new Uint8Array(header);
    const decoder = new TextDecoder('ascii');
    if (bytes.length !== 80 || decoder.decode(bytes.subarray(0, 8)) !== 'S332DBOF' ||
        new DataView(header).getUint32(12, true) !== 64 ||
        decoder.decode(bytes.subarray(64, 80)) !== 'SQLite format 3\0') {
      throw new Error('Invalid STDB header.');
    }
    const module = await SQLiteFactory({ locateFile: () => payload.wasmUrl });
    const file = {
      size: payload.size,
      slice: (start, end) => ({ arrayBuffer: () => readSlice(fileId, start, end) })
    };
    return StdbDatabase.open(module, file);
}

async function execute(type, payload) {
  if (type === 'open') {
    database = await openDatabase(payload);
    view = database;
    return database.sessions;
  }
  if (!database) throw new Error('No STDB file is open.');
  if (type === 'session') {
    const result = await database.selectSession(payload.id);
    sources = [{ database, result, fileId: 0 }];
    return result;
  }
  if (type === 'details') return database.getSessionDetails(payload.id);
  if (type === 'openCandidate') {
    if (candidate) throw new Error('An STDB session selection is already pending.');
    const db = await openDatabase(payload);
    candidate = { database: db, fileId: payload.fileId };
    return db.sessions.filter(session => !sources.some(source => source.fileId === candidate.fileId && source.result.session.ID === session.ID));
  }
  if (type === 'candidateDetails') {
    if (!candidate) throw new Error('No STDB append selection is pending.');
    return candidate.database.getSessionDetails(payload.id);
  }
  if (type === 'cancelCandidate') {
    if (candidate) await candidate.database.sqlite.close(candidate.database.db);
    candidate = null;
    return;
  }
  if (type === 'appendSession') {
    if (!candidate) throw new Error('No STDB append selection is pending.');
    if (sources.some(source => source.fileId === candidate.fileId && source.result.session.ID === payload.id)) {
      throw new Error('This session is already included.');
    }
    const result = await candidate.database.selectSession(payload.id);
    const combined = new CombinedDatabase([...sources, { ...candidate, result }]);
    sources.push({ ...candidate, result });
    candidate = null;
    view = combined;
    return { session: combined.session, channels: combined.channels, numSamples: combined.numSamples,
      start: combined.start, stop: combined.stop, interval: combined.interval };
  }
  if (type === 'page') return view.page(payload.pageIndex, payload.pageSize, payload.selected);
  if (type === 'measurement') return view.measurement(payload.channelId, payload.start, payload.stop);
  if (type === 'exportHeader') return encoder.encode(exportHeader(payload.format, view));
  if (type === 'exportPage') {
    const page = await view.exportPage(payload.cursor, payload.limit);
    return { bytes: encoder.encode(exportRows(payload.format, view.channels, page.rows)), count: page.rows.length, cursor: page.cursor };
  }
  if (type === 'exportFooter') return encoder.encode(exportFooter(payload.format));
  throw new Error(`Unknown STDB request: ${type}`);
}

self.onmessage = event => {
  const message = event.data;
  if (message.type === 'readResult') {
    const pending = pendingReads.get(message.id);
    if (pending) {
      pendingReads.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.buffer);
    }
    return;
  }
  queue = queue.then(async () => {
    try {
      const result = await execute(message.type, message.payload);
      const bytes = result instanceof Uint8Array ? result : result?.bytes;
      self.postMessage({ id: message.id, result }, bytes ? [bytes.buffer] : []);
    } catch (error) {
      self.postMessage({ id: message.id, error: error.message || String(error) });
    }
  });
};
