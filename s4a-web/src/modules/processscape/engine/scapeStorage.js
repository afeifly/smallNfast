/**
 * ProcessScape Storage Engine
 * Manages multi-scape persistence in localStorage (and IndexedDB),
 * active scape selection, and ships with an out-of-the-box realistic industrial plant default.
 */

const STORAGE_KEY_SCAPES = 's4a_processscapes_v1';
const STORAGE_KEY_ACTIVE = 's4a_active_scape_id_v1';

export const DEFAULT_COMPRESSED_AIR_SCAPE = {
  id: 'scape_default_plant',
  title: 'Main Compressor Station',
  description: 'Rotary screw air compressor, buffer receiver tank, refrigerated dryer, and S401 flow meter loop',
  isDefault: true,
  createdAt: 1715000000000,
  updatedAt: 1715000000000,
  tempCanvasSize: { width: 1024, height: 800 },
  zones: [],
  elements: [
    {
      id: 'elem_compressor_1',
      type: 'machine_compressor',
      tag: 'Air Compressor 1',
      desc: 'Rotary screw main compressor unit',
      x: 120,
      y: 190,
      w: 140,
      h: 120,
      status: 'normal',
      zIndex: 20
    },
    {
      id: 'elem_buffer_tank_1',
      type: 'tank_buffer',
      tag: 'Buffer Tank 1',
      desc: 'Wet air receiver storage (1500L)',
      x: 300,
      y: 190,
      w: 90,
      h: 140,
      zIndex: 20
    },
    {
      id: 'elem_dryer_1',
      type: 'machine_dryer',
      tag: 'Refrig Dryer 1',
      desc: 'Refrigerated condensation air dryer',
      x: 460,
      y: 190,
      w: 110,
      h: 110,
      zIndex: 20
    },
    {
      id: 'elem_flow_meter_1',
      type: 'flow_meter',
      tag: 'S401 Main Header',
      desc: 'S401 Insertion thermal mass flow sensor',
      x: 610,
      y: 190,
      w: 50,
      h: 50,
      zIndex: 20
    }
  ],
  pipes: [
    {
      id: 'pipe_main_loop',
      groupId: 'pipe_group_main',
      medium: 'gas',
      w: 18,
      flow: 'forward',
      zIndex: 10,
      points: [
        { x: 100, y: 190 },
        { x: 720, y: 190 }
      ],
      d: 'M 100,190 L 720,190'
    }
  ]
};

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

/**
 * Get all scapes from localStorage. If none exist, initializes with default.
 */
export function getAllScapes() {
  const storage = getStorage();
  if (!storage) return [DEFAULT_COMPRESSED_AIR_SCAPE];

  try {
    const raw = storage.getItem(STORAGE_KEY_SCAPES);
    if (!raw) {
      storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify([DEFAULT_COMPRESSED_AIR_SCAPE]));
      storage.setItem(STORAGE_KEY_ACTIVE, DEFAULT_COMPRESSED_AIR_SCAPE.id);
      return [DEFAULT_COMPRESSED_AIR_SCAPE];
    }
    let list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) {
      storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify([DEFAULT_COMPRESSED_AIR_SCAPE]));
      storage.setItem(STORAGE_KEY_ACTIVE, DEFAULT_COMPRESSED_AIR_SCAPE.id);
      return [DEFAULT_COMPRESSED_AIR_SCAPE];
    }
    // Auto-migrate legacy scapes: remove zone_comp_room, fake sensor cards, and heal disconnected 3-part pipes
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
      if (sc.pipes && sc.pipes.some(p => p.id === 'pipe_main_loop_1')) {
        const hasLegacy3 = sc.pipes.some(p => p.id === 'pipe_main_loop_2') || sc.pipes.some(p => p.id === 'pipe_main_loop_3');
        if (hasLegacy3) {
          const healedPipe = {
            id: 'pipe_main_loop',
            groupId: 'pipe_group_main',
            medium: 'gas',
            w: 18,
            flow: 'forward',
            zIndex: 10,
            points: [
              { x: 100, y: 190 },
              { x: 720, y: 190 }
            ],
            d: 'M 100,190 L 720,190'
          };
          sc.pipes = sc.pipes.filter(p => !['pipe_main_loop_1', 'pipe_main_loop_2', 'pipe_main_loop_3'].includes(p.id)).concat(healedPipe);
          modified = true;
        }
      }
      return sc;
    });
    if (modified) {
      storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(list));
    }
    return list;
  } catch (err) {
    console.warn('[ScapeStorage] Error loading scapes, fallback to default:', err);
    return [DEFAULT_COMPRESSED_AIR_SCAPE];
  }
}

/**
 * Get active scape ID
 */
export function getActiveScapeId() {
  const storage = getStorage();
  if (!storage) return DEFAULT_COMPRESSED_AIR_SCAPE.id;
  const activeId = storage.getItem(STORAGE_KEY_ACTIVE);
  if (activeId) return activeId;
  const all = getAllScapes();
  const firstId = all[0]?.id || DEFAULT_COMPRESSED_AIR_SCAPE.id;
  storage.setItem(STORAGE_KEY_ACTIVE, firstId);
  return firstId;
}

/**
 * Set active scape ID
 */
export function setActiveScapeId(id) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY_ACTIVE, id);
}

/**
 * Get currently active scape object
 */
export function getActiveScape() {
  const all = getAllScapes();
  const activeId = getActiveScapeId();
  const found = all.find(s => s.id === activeId);
  return found || all[0] || DEFAULT_COMPRESSED_AIR_SCAPE;
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
  const updatedScape = {
    ...scape,
    updatedAt: now
  };

  const idx = all.findIndex(s => s.id === scape.id);
  let newList;
  if (idx >= 0) {
    newList = [...all];
    newList[idx] = updatedScape;
  } else {
    newList = [...all, { ...updatedScape, createdAt: updatedScape.createdAt || now }];
  }

  storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(newList));
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
 * Delete a scape (preserves at least one scape)
 */
export function deleteScape(id) {
  const storage = getStorage();
  if (!storage) return false;

  const all = getAllScapes();
  if (all.length <= 1) {
    return false; // Cannot delete the only remaining scape
  }

  const newList = all.filter(s => s.id !== id);
  storage.setItem(STORAGE_KEY_SCAPES, JSON.stringify(newList));

  const activeId = getActiveScapeId();
  if (activeId === id) {
    setActiveScapeId(newList[0].id);
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

