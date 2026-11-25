import CsdAPI from './CsdAPI';
import CsvAPI from './CsvAPI';
import StdbAPI from './StdbAPI';
import TauriSutoAPI from './TauriSutoAPI';
import { checkIsDesktopHost } from '../util/platform';
import { putHandle, getHandle, saveRecentMeta, createFileWrapperFromPath } from './FileAccess';
import { promptLargeCsvChoice, resolveLargeCsvChoice } from './LargeCsvPrompt';

let active = null;
let currentFile = null;
let callbacks = [];
let input;
let appendMode = false;
let loadGeneration = 0;
let pendingStdbSelection = false;
let loadingFile = false;

function notifyLoaded() {
  callbacks.forEach(callback => callback());
}

function progress(file, value, error) {
  window.dispatchEvent(new CustomEvent('fileLoadProgress', {
    detail: { filename: file.name, progress: value, ...(error ? { error: true, errorMessage: error.message } : {}) }
  }));
}

function notifyError(title, error) {
  console.error(`[FileAnalyzeAPI] ${title}:`, error);
  if (window.showAppNotification) window.showAppNotification(title, error.message, 'error');
}

function fileType(file) {
  const name = file?.name?.toLowerCase() || '';
  if (name.endsWith('.stdb')) return 'stdb';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.csd')) return 'csd';
  throw new Error('Only .csd, .csv and .stdb files are supported.');
}

function ensureInput() {
  if (input) return;
  input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csd,.csv,.stdb,application/octet-stream,text/csv,text/plain';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (appendMode === 'stdbCandidate') {
        await FileAnalyzeAPI.setStdbAppendFile(file);
      } else if (appendMode) {
        const result = await FileAnalyzeAPI.appendFile(file);
        if (!result.ok) throw new Error(result.reason);
      } else {
        saveRecentMeta(file.name, file.size);
        await FileAnalyzeAPI.loadFile(file);
      }
    } catch (error) {
      if (appendMode !== 'stdbCandidate' || pendingStdbSelection === 'append') {
        notifyError(appendMode ? 'Append failed' : 'File load failed', error);
      }
    } finally {
      appendMode = false;
      input.value = '';
    }
  });
}

const controls = {
  get hasFSA() { return typeof window !== 'undefined' && 'showOpenFilePicker' in window; },

  async openFile() {
    try {
      if (checkIsDesktopHost() && TauriSutoAPI.isAvailable()) {
        const path = await TauriSutoAPI.pickFile();
        if (path) await this.loadFileFromPath(path);
      } else if (this.hasFSA) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Data files', accept: { 'application/octet-stream': ['.csd', '.csv', '.stdb'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        await putHandle(file.name, handle);
        saveRecentMeta(file.name, file.size);
        await this.loadFile(file);
      } else {
        appendMode = false;
        ensureInput();
        input.click();
      }
    } catch (error) {
      if (error.name !== 'AbortError') notifyError('File load failed', error);
    }
  },

  async openAppend() {
    if (active === StdbAPI) {
      if (pendingStdbSelection) return;
      pendingStdbSelection = 'append';
      const generation = loadGeneration;
      window.dispatchEvent(new CustomEvent('stdbSessionsAvailable', {
        detail: { file: currentFile, sessions: [], mode: 'append', preparing: true }
      }));
      try {
        await StdbAPI.openAppendSelection();
      } catch (error) {
        if (generation !== loadGeneration || pendingStdbSelection !== 'append') return;
        pendingStdbSelection = false;
        window.dispatchEvent(new CustomEvent('stdbSessionsCancelled'));
        notifyError('Append failed', error);
      }
      return;
    }
    try {
      let file;
      if (checkIsDesktopHost() && TauriSutoAPI.isAvailable()) {
        const path = await TauriSutoAPI.pickFile();
        if (path) file = await createFileWrapperFromPath(path);
      } else if (this.hasFSA) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Data files', accept: { 'application/octet-stream': ['.csd', '.csv'] } }],
          multiple: false
        });
        file = await handle.getFile();
      } else {
        appendMode = true;
        ensureInput();
        input.click();
        return;
      }
      if (file) {
        const result = await this.appendFile(file);
        if (!result.ok) throw new Error(result.reason);
      }
    } catch (error) {
      if (error.name !== 'AbortError') notifyError('Append failed', error);
    }
  },

  async openStdbAppendFile() {
    if (pendingStdbSelection !== 'append') throw new Error('No STDB append selection is pending.');
    const generation = loadGeneration;
    try {
      let file;
      if (checkIsDesktopHost() && TauriSutoAPI.isAvailable()) {
        const path = await TauriSutoAPI.pickFile();
        if (path) file = await createFileWrapperFromPath(path);
      } else if (this.hasFSA) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'STDB files', accept: { 'application/octet-stream': ['.stdb'] } }],
          multiple: false
        });
        file = await handle.getFile();
      } else {
        appendMode = 'stdbCandidate';
        ensureInput();
        input.click();
        return;
      }
      if (file && generation === loadGeneration && pendingStdbSelection === 'append') {
        await this.setStdbAppendFile(file);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && generation === loadGeneration && pendingStdbSelection === 'append') notifyError('Append failed', error);
    }
  },

  async setStdbAppendFile(file) {
    if (pendingStdbSelection !== 'append') throw new Error('No STDB append selection is pending.');
    if (fileType(file) !== 'stdb') throw new Error('Only STDB files can be appended to an STDB session.');
    const generation = loadGeneration;
    window.dispatchEvent(new CustomEvent('stdbSessionsPreparing'));
    try {
      await StdbAPI.openAppendSelection(file);
    } finally {
      if (generation === loadGeneration && pendingStdbSelection === 'append') {
        window.dispatchEvent(new CustomEvent('stdbSessionsPrepared'));
      }
    }
  },

  async appendFile(file) {
    if (!active || active === StdbAPI) return { ok: false, reason: 'Appending is unavailable for this file.' };
    const type = fileType(file);
    if ((active === CsvAPI && type !== 'csv') || (active === CsdAPI && type !== 'csd')) {
      return { ok: false, reason: 'The appended file must have the same format as the loaded file.' };
    }
    const result = await active.appendFile(file);
    if (result.ok) notifyLoaded();
    return result;
  },

  async loadFile(file) {
    if (!file) return false;
    if (loadingFile) throw new Error('Another file is already loading.');
    const type = fileType(file);
    loadingFile = true;
    try {
      let convert = false;
      if (type === 'csv' && file.size >= 800 * 1024 * 1024) {
        const choice = await promptLargeCsvChoice(file);
        if (choice === 'cancel') return false;
        convert = choice === 'convert';
      }
      const generation = ++loadGeneration;
      pendingStdbSelection = false;
      window.dispatchEvent(new CustomEvent('stdbSessionsCancelled'));
      StdbAPI.reset();
      CsdAPI.reset();
      active = null;
      currentFile = file;
      if (type !== 'csd') {
        window.dispatchEvent(new CustomEvent('fileLoadStart', { detail: { filename: file.name } }));
        progress(file, 0.1);
      }
      try {
        if (type === 'csd') {
          const loaded = await CsdAPI.loadFile(file);
          if (!loaded || generation !== loadGeneration) return false;
          active = CsdAPI;
        } else if (type === 'csv') {
          if (!await CsvAPI.loadFromFile(file)) throw new Error('Failed to load CSV file.');
          if (generation !== loadGeneration) return false;
          active = CsvAPI;
          progress(file, 1);
        } else {
          const result = await StdbAPI.loadFromFile(file);
          if (!result.ok) throw new Error('Failed to load STDB file.');
          if (generation !== loadGeneration) return false;
          pendingStdbSelection = 'open';
          progress(file, 1);
          return true;
        }
        notifyLoaded();
        if (convert) setTimeout(() => window.dispatchEvent(new CustomEvent('csvLoadedPendingConvert')), 200);
        return true;
      } catch (error) {
        if (generation === loadGeneration) progress(file, 0, error);
        return false;
      }
    } finally {
      loadingFile = false;
    }
  },

  async selectStdbSession(session) {
    if (!pendingStdbSelection) throw new Error('No STDB session selection is pending.');
    const generation = loadGeneration;
    const mode = pendingStdbSelection;
    if (mode === 'append') await StdbAPI.appendSession(session);
    else await StdbAPI.loadSession(session);
    if (generation !== loadGeneration || !pendingStdbSelection) throw new Error('STDB session selection was cancelled.');
    pendingStdbSelection = false;
    active = StdbAPI;
    if (mode === 'append') window.dispatchEvent(new CustomEvent('stdbSessionAppended'));
    notifyLoaded();
  },

  async getStdbSessionDetails(id) {
    if (!pendingStdbSelection) throw new Error('No STDB session selection is pending.');
    const generation = loadGeneration;
    const details = pendingStdbSelection === 'append'
      ? await StdbAPI.getAppendSessionDetails(id)
      : await StdbAPI.getSessionDetails(id);
    if (generation !== loadGeneration || !pendingStdbSelection) throw new Error('STDB session selection was cancelled.');
    return details;
  },

  cancelStdbSession() {
    if (!pendingStdbSelection) return;
    const mode = pendingStdbSelection;
    pendingStdbSelection = false;
    loadGeneration++;
    if (mode === 'append') {
      StdbAPI.cancelAppendSelection().catch(error => notifyError('Append failed', error));
    } else {
      StdbAPI.reset();
      currentFile = null;
    }
  },

  async loadFileFromHandle(handle) {
    try {
      let permission = await handle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'read' });
      if (permission !== 'granted') return false;
      const file = await handle.getFile();
      saveRecentMeta(file.name, file.size);
      return await this.loadFile(file);
    } catch (error) {
      notifyError('File load failed', error);
      return false;
    }
  },

  async loadFileFromPath(path) {
    try {
      const file = await createFileWrapperFromPath(path);
      saveRecentMeta(file.name, file.size, path);
      return await this.loadFile(file);
    } catch (error) {
      notifyError('File load failed', error);
      return false;
    }
  },

  getHandleForFile: getHandle,
  getRecentFiles() { return CsdAPI.getRecentFiles(); },
  removeRecentFile(name) { return CsdAPI.removeRecentFile(name); },
  syncDesktopRecentFiles() { return CsdAPI.syncDesktopRecentFiles(); },
  resolveLargeCsvChoice,
  onFileLoaded(callback) {
    if (!callbacks.includes(callback)) callbacks.push(callback);
    if (active?.isFileLoaded()) setTimeout(callback, 0);
    return () => { callbacks = callbacks.filter(item => item !== callback); };
  },
  isFileLoaded() { return !!active?.isFileLoaded(); },
  isCsvMode() { return active === CsvAPI; },
  isStdbMode() { return active === StdbAPI; },
  getLoadedFilePath() { return currentFile?.path || null; },
  getNumLoadedFiles() { return active?.getNumLoadedFiles?.() || 0; },
  needsRepair() { return active === CsdAPI ? CsdAPI.needsRepair() : null; },
  reset() {
    loadGeneration++;
    pendingStdbSelection = false;
    window.dispatchEvent(new CustomEvent('stdbSessionsCancelled'));
    StdbAPI.reset();
    CsdAPI.reset();
    active = null;
    currentFile = null;
  }
};

const FileAnalyzeAPI = new Proxy(controls, {
  get(target, prop) {
    if (prop in target) return Reflect.get(target, prop);
    if (active === StdbAPI && ['patchSampleValues', 'saveRepairedCopy', 'persistRepair', 'getConsumptionData', 'exportToCsd', 'exportToCsdSplit'].includes(prop)) {
      return async () => { throw new Error('This operation is not supported for read-only STDB files.'); };
    }
    const reader = active && prop in active ? active : CsdAPI;
    const value = reader[prop];
    return typeof value === 'function' ? value.bind(reader) : value;
  }
});

export default FileAnalyzeAPI;
