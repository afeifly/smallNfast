/**
 * ProcessScape Storage Engine
 * Manages multi-scape persistence in localStorage (and IndexedDB),
 * active scape selection, and ships with an out-of-the-box realistic industrial plant default.
 */

import exampleLayoutJson from '../templates/example-compressor-station-layout.json';
import { pointsToPath } from './pipeUtils';

const STORAGE_KEY_SCAPES = 's4a_processscapes_v1';
const STORAGE_KEY_ACTIVE = 's4a_active_scape_id_v1';
const STORAGE_KEY_LOCATIONS = 's4a_sensor_locations_v1';
const STORAGE_KEY_VIEWS = 's4a_processscape_views_v1';

/**
 * Get saved canvas view (pan x, y, and zoom) for a given scape
 */
export function getSavedScapeView(scapeId) {
  const storage = getStorage();
  if (!storage || !scapeId) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_VIEWS);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const v = map[scapeId];
    if (v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.zoom === 'number') {
      return { x: v.x, y: v.y, zoom: v.zoom };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Save canvas view (pan x, y, and zoom) for a given scape
 */
export function saveScapeView(scapeId, view) {
  const storage = getStorage();
  if (!storage || !scapeId || !view) return;
  try {
    const raw = storage.getItem(STORAGE_KEY_VIEWS);
    const map = raw ? JSON.parse(raw) : {};
    map[scapeId] = {
      x: Math.round(view.x || 0),
      y: Math.round(view.y || 0),
      zoom: Number((view.zoom || 1.0).toFixed(3))
    };
    storage.setItem(STORAGE_KEY_VIEWS, JSON.stringify(map));
  } catch (_) {}
}

export function getExampleCompressorStationScape() {
  return {
    id: 'scape_example_demo',
    title: exampleLayoutJson.project || 'Main Compressor Station',
    description: 'Example industrial plant layout (Demonstration)',
    isExample: true,
    createdAt: 1715000000000,
    updatedAt: 1715000000000,
    tempCanvasSize: exampleLayoutJson.tempCanvasSize ? { ...exampleLayoutJson.tempCanvasSize } : { width: 1024, height: 800 },
    screenSize: exampleLayoutJson.screenSize ? { ...exampleLayoutJson.screenSize } : { width: 913, height: 677 },
    viewBox: exampleLayoutJson.viewBox || '93 29 913 677',
    zones: exampleLayoutJson.zones ? JSON.parse(JSON.stringify(exampleLayoutJson.zones)) : [],
    elements: exampleLayoutJson.elements ? JSON.parse(JSON.stringify(exampleLayoutJson.elements)) : [],
    pipes: (exampleLayoutJson.pipes || []).map((p, idx) => ({
      ...JSON.parse(JSON.stringify(p)),
      id: p.id || `pipe_ex_${idx}`,
      d: p.d || (p.points ? pointsToPath(p.points) : '')
    }))
  };
}

export const EXAMPLE_COMPRESSOR_STATION_SCAPE = getExampleCompressorStationScape();
export const DEFAULT_COMPRESSED_AIR_SCAPE = EXAMPLE_COMPRESSOR_STATION_SCAPE;

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

/**
 * Check if the user has any saved locations in the system
 */
export function hasSavedLocations() {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(STORAGE_KEY_LOCATIONS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch (_) {
    return false;
  }
}

/**
 * Get all scapes from localStorage.
 * If no real scapes exist in storage, returns the example demo layout
 * without permanently saving it to localStorage.
 */
export function getAllScapes() {
  const storage = getStorage();
  if (!storage) return [getExampleCompressorStationScape()];

  try {
    const raw = storage.getItem(STORAGE_KEY_SCAPES);
    if (raw === null) {
      // First visit before user has ever saved or deleted scapes: show demo example
      return [getExampleCompressorStationScape()];
    }

    let list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      return [];
    }

    // Auto-clean: purge old hardcoded starter plant if present
    const cleaned = list.filter(s => s.id !== 'scape_default_plant');
    if (cleaned.length !== list.length) {
      list = cleaned;
      storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(list));
    }

    // Auto-migrate legacy scapes: remove zone_comp_room, fake sensor cards, heal pipe flow
    let modified = false;
    list = list.map(scape => {
      let sc = { ...scape };
      if (sc.elements && sc.elements.some(e => e.id === 'elem_sensor_card_1')) {
        sc.elements = sc.elements.filter(e => e.id !== 'elem_sensor_card_1');
        modified = true;
      }
      if (sc.zones && sc.zones.some(z => z.id === 'zone_comp_room')) {
        sc.zones = sc.zones.filter(z => z.id !== 'zone_comp_room');
        modified = true;
      }
      if (Array.isArray(sc.pipes)) {
        sc.pipes = sc.pipes.map(p => {
          if (p.flow === 'off' || !p.flow) {
            modified = true;
            return { ...p, flow: 'forward' };
          }
          return p;
        });
      }
      return sc;
    });
    if (modified) {
      storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(list));
    }
    return list;
  } catch (err) {
    console.warn('[ScapeStorage] Error loading scapes:', err);
    return [];
  }
}

/**
 * Get active scape ID
 */
export function getActiveScapeId() {
  const storage = getStorage();
  if (!storage) return '';
  const activeId = storage.getItem(STORAGE_KEY_ACTIVE);
  // If activeId was explicitly set to empty, respect it (no active scape)
  if (activeId === '') {
    return '';
  }
  // If user has configured/visited locations (storage key exists, e.g. set to [] after deletion),
  // but has 0 locations, do not force-activate any scape!
  const hasLocationsKey = storage.getItem(STORAGE_KEY_LOCATIONS) !== null;
  if (hasLocationsKey && !hasSavedLocations()) {
    return '';
  }
  const all = getAllScapes();
  if (activeId && all.some(s => s.id === activeId)) {
    return activeId;
  }
  // If user has saved locations, pick the first real scape if activeId is missing or invalid
  if (hasSavedLocations()) {
    const realScapes = all.filter(s => !s.isExample);
    if (realScapes.length > 0) {
      return realScapes[0].id;
    }
    return all[0]?.id || '';
  }
  if (hasLocationsKey) {
    return '';
  }
  // First-time demo visit before any locations or scapes were saved:
  const realScapes = all.filter(s => !s.isExample);
  if (realScapes.length > 0) {
    return realScapes[0].id;
  }
  return all[0]?.id || '';
}

/**
 * Set active scape ID
 */
export function setActiveScapeId(id) {
  const storage = getStorage();
  if (!storage) return;
  if (!id) {
    storage.setItem(STORAGE_KEY_ACTIVE, '');
    return;
  }
  storage.setItem(STORAGE_KEY_ACTIVE, id);
}

/**
 * Get currently active scape object
 */
export function getActiveScape() {
  const activeId = getActiveScapeId();
  if (!activeId) {
    return {
      id: '',
      title: 'ProcessScape',
      tempCanvasSize: { width: 1024, height: 800 },
      zones: [],
      elements: [],
      pipes: []
    };
  }
  const all = getAllScapes();
  const found = all.find(s => s.id === activeId);
  if (found) return found;
  return {
    id: '',
    title: 'ProcessScape',
    tempCanvasSize: { width: 1024, height: 800 },
    zones: [],
    elements: [],
    pipes: []
  };
}

/**
 * Save / Update a scape
 */
export function saveScape(scape) {
  if (!scape || !scape.id) return;
  const storage = getStorage();
  if (!storage) return;

  const all = getAllScapes();
  const now = Date.now();
  const sanitizedPipes = Array.isArray(scape.pipes)
    ? scape.pipes.map(p => ({
        ...p,
        flow: (p.flow === 'off' || !p.flow) ? 'forward' : p.flow
      }))
    : scape.pipes;

  const updatedScape = {
    ...scape,
    pipes: sanitizedPipes,
    updatedAt: now
  };
  delete updatedScape.isExample; // Once explicitly saved, it's a real user scape

  const idx = all.findIndex(s => s.id === scape.id);
  let newList;
  if (idx >= 0) {
    newList = [...all];
    newList[idx] = updatedScape;
  } else {
    newList = [...all.filter(s => !s.isExample), { ...updatedScape, createdAt: updatedScape.createdAt || now }];
  }

  storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(newList));
  setActiveScapeId(updatedScape.id);
  return updatedScape;
}

/**
 * Create a new scape
 */
export function createNewScape(title = 'New Plant Scape', description = '') {
  const storage = getStorage();
  const id = `scape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newScape = {
    id,
    title: title.trim() || 'New Plant Scape',
    description: description.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tempCanvasSize: { width: 1024, height: 800 },
    zones: [],
    elements: [],
    pipes: []
  };

  saveScape(newScape);
  setActiveScapeId(id);
  return newScape;
}

/**
 * Duplicate a scape
 */
export function duplicateScape(id) {
  const all = getAllScapes();
  const target = all.find(s => s.id === id);
  if (!target) return null;

  const newId = `scape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cloned = JSON.parse(JSON.stringify(target));
  cloned.id = newId;
  cloned.title = `${cloned.title || 'Plant Scape'} (Copy)`;
  delete cloned.isDefault;
  cloned.createdAt = Date.now();
  cloned.updatedAt = Date.now();

  saveScape(cloned);
  return cloned;
}

/**
 * Delete a scape (even if it is the only one in use)
 */
export function deleteScape(id) {
  const storage = getStorage();
  if (!storage) return false;

  const all = getAllScapes();
  const newList = all.filter(s => s.id !== id);

  storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(newList));

  const activeId = getActiveScapeId();
  if (activeId === id) {
    const nextActiveId = newList[0]?.id || '';
    setActiveScapeId(nextActiveId);
  }
  return true;
}

/**
 * Import a scape from parsed JSON
 */
export function importScapeFromJson(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON format');
  }

  const id = json.id || `scape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = json.title || json.projectTitle || json.project || 'Imported Scape';

  const importedScape = {
    id,
    title,
    description: json.description || json.desc || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tempCanvasSize: {
      width: json.tempCanvasSize?.width || json.screenSize?.w || 1024,
      height: json.tempCanvasSize?.height || json.screenSize?.h || 800
    },
    zones: Array.isArray(json.zones) ? json.zones : [],
    elements: Array.isArray(json.elements) ? json.elements : [],
    pipes: Array.isArray(json.pipes) ? json.pipes : []
  };

  saveScape(importedScape);
  setActiveScapeId(id);
  return importedScape;
}

