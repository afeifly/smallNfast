export const STORE_KEY = 's4a-processscape-layout';

export const EQUIPMENT_COLOR_THEMES = {
  blue:   { id: 'blue',   name: 'Industrial Blue',   main: '#0ea5e9', dark: '#0284c7', light: '#7dd3fc' },
  cyan:   { id: 'cyan',   name: 'Process Cyan',      main: '#06b6d4', dark: '#0891b2', light: '#67e8f9' },
  green:  { id: 'green',  name: 'Eco Green',         main: '#22c55e', dark: '#16a34a', light: '#86efac' },
  yellow: { id: 'yellow', name: 'Machinery Yellow',  main: '#facc15', dark: '#ca8a04', light: '#fef08a' },
  orange: { id: 'orange', name: 'Safety Orange',     main: '#f97316', dark: '#ea580c', light: '#fed7aa' },
  red:    { id: 'red',    name: 'Safety Red',        main: '#ef4444', dark: '#dc2626', light: '#fca5a5' },
  slate:  { id: 'slate',  name: 'Modern Slate',      main: '#64748b', dark: '#475569', light: '#cbd5e1' },
  white:  { id: 'white',  name: 'Cleanroom White',   main: '#e2e8f0', dark: '#94a3b8', light: '#f8fafc' }
};

export function getEquipmentTheme(node) {
  const key = (node && node.colorTheme) ? node.colorTheme : 'blue';
  return EQUIPMENT_COLOR_THEMES[key] || EQUIPMENT_COLOR_THEMES.blue;
}

export const ASSET_DEFS = {
  // 1. Vessels & Storage
  tank_buffer: {
    type: 'tank_buffer',
    name: 'Buffer Tank (Air Receiver)',
    category: 'vessels',
    w: 120, h: 220,
    defaultTag: 'Air Receiver',
    defaultDesc: 'Vertical Air Storage Receiver'
  },
  cylinder_bank: {
    type: 'cylinder_bank',
    name: 'Air Cylinders Bank',
    category: 'vessels',
    w: 100, h: 140,
    defaultTag: 'Air Cylinders',
    defaultDesc: 'High-Pressure Cylinder Bank'
  },
  tank_horizontal: {
    type: 'tank_horizontal',
    name: 'Horizontal Pressure Tank',
    category: 'vessels',
    w: 190, h: 120,
    defaultTag: 'Horiz Tank',
    defaultDesc: 'Horizontal pressure vessel with saddle mounts'
  },
  tank_cryogenic: {
    type: 'tank_cryogenic',
    name: 'Cryogenic Liquid Vessel',
    category: 'vessels',
    w: 130, h: 230,
    defaultTag: 'Cryo Tank',
    defaultDesc: 'Vacuum-insulated cryogenic gas storage vessel'
  },
  tank_spherical: {
    type: 'tank_spherical',
    name: 'Spherical Gas Holder',
    category: 'vessels',
    w: 160, h: 190,
    defaultTag: 'Sphere Tank',
    defaultDesc: 'High-pressure Horton spherical gas vessel'
  },
  tank_separator: {
    type: 'tank_separator',
    name: 'Moisture Separator Vessel',
    category: 'vessels',
    w: 90, h: 170,
    defaultTag: 'Separator',
    defaultDesc: 'Cyclone oil and water condensate separator'
  },

  // 2. Industrial Machines & Equipment
  machine_compressor: {
    type: 'machine_compressor',
    name: 'Air Compressor',
    category: 'machines',
    w: 170, h: 140,
    defaultTag: 'Air Compressor',
    defaultDesc: 'Main rotary screw air compressor unit'
  },
  machine_compressor_piston: {
    type: 'machine_compressor_piston',
    name: 'Piston Compressor',
    category: 'machines',
    w: 180, h: 150,
    defaultTag: 'Piston Compressor',
    defaultDesc: 'Reciprocating piston compressor with bottom receiver tank'
  },
  machine_dryer: {
    type: 'machine_dryer',
    name: 'Air Dryer',
    category: 'machines',
    w: 130, h: 130,
    defaultTag: 'Air Dryer',
    defaultDesc: 'Refrigerated condensation air dryer unit'
  },
  machine_chiller: {
    type: 'machine_chiller',
    name: 'Industrial Water Chiller',
    category: 'machines',
    w: 160, h: 135,
    defaultTag: 'Chiller Unit',
    defaultDesc: 'Packaged process water chiller with condenser fan & controller'
  },
  filter_line: {
    type: 'filter_line',
    name: 'In-Line Air Filter',
    category: 'machines',
    w: 80, h: 130,
    defaultTag: 'Air Filter',
    defaultDesc: 'Coalescing in-line compressed air filter'
  },
  filter_stage3: {
    type: 'filter_stage3',
    name: '3-Stage Filter Bank',
    category: 'machines',
    w: 160, h: 130,
    defaultTag: 'Filter Bank',
    defaultDesc: 'Pre-filter, micro-filter, and activated carbon bank'
  },
  machine_pump: {
    type: 'machine_pump',
    name: 'Booster Pump Skid',
    category: 'machines',
    w: 150, h: 110,
    defaultTag: 'Booster Pump',
    defaultDesc: 'Motor-driven fluid booster pump skid'
  },
  machine_cnc: {
    type: 'machine_cnc',
    name: 'Industrial CNC Machine',
    category: 'machines',
    w: 160, h: 130,
    defaultTag: 'CNC Machine',
    defaultDesc: 'Automated Processing Machine'
  },
  machine_robot: {
    type: 'machine_robot',
    name: 'Automotive Robot Cell',
    category: 'machines',
    w: 170, h: 130,
    defaultTag: 'Robot Cell',
    defaultDesc: 'Dual-arm Robotic Spray Cell'
  },
  machine_laser: {
    type: 'machine_laser',
    name: 'Fiber Laser Cutter',
    category: 'machines',
    w: 180, h: 130,
    defaultTag: 'Laser Cutter',
    defaultDesc: 'Gantry fiber laser cutting and welding table'
  },
  machine_injection: {
    type: 'machine_injection',
    name: 'Injection Molding Machine',
    category: 'machines',
    w: 210, h: 120,
    defaultTag: 'Injection Unit',
    defaultDesc: 'High-tonnage hydraulic molding machine'
  },

  // 3. Central Cabinets & Gateways
  logger_cabinet: {
    type: 'logger_cabinet',
    name: 'Stationary Display',
    category: 'gateways',
    w: 106, h: 120,
    defaultTag: 'Stationary Display',
    defaultDesc: 'Wall-mounted touchscreen display & gateway'
  },
  logger_case: {
    type: 'logger_case',
    name: 'Portable Logger Case',
    category: 'gateways',
    w: 104, h: 114,
    defaultTag: 'Portable Logger',
    defaultDesc: 'Mobile Field Data Acquisition Case'
  },

  // 4. Sensors & Transmitters
  dewpoint_meter: {
    type: 'dewpoint_meter',
    name: 'Dew Point Meter',
    category: 'sensors',
    w: 64, h: 130,
    defaultTag: 'Dew Point Meter',
    defaultDesc: 'S220 Dew point & temp transmitter'
  },
  leak_detection: {
    type: 'leak_detection',
    name: 'Leak Detection',
    category: 'sensors',
    w: 64, h: 124,
    defaultTag: 'Leak Detection',
    defaultDesc: 'S530 Ultrasonic acoustic leak detector'
  },
  compact_flow_meter: {
    type: 'compact_flow_meter',
    name: 'Compact Flow Meter',
    category: 'sensors',
    w: 124, h: 80,
    defaultTag: 'Compact Flow',
    defaultDesc: 'S415 Inline thermal mass flow meter'
  },
  flow_meter: {
    type: 'flow_meter',
    name: 'Flow Meter',
    category: 'sensors',
    w: 64, h: 176,
    defaultTag: 'Flow Meter',
    defaultDesc: 'S401 Insertion thermal mass flow meter'
  },
  leak_detector: {
    type: 'leak_detection',
    name: 'Leak Detection',
    category: 'sensors',
    w: 64, h: 124,
    defaultTag: 'Leak Detection',
    defaultDesc: 'S530 Ultrasonic acoustic leak detector',
    isAlias: true
  },

  // 5. Perimeter Walls & Partitions
  wall_perimeter_h: {
    type: 'wall_perimeter_h',
    name: 'Horizontal Brick Wall',
    category: 'others',
    w: 220, h: 36,
    defaultTag: 'Brick Wall',
    defaultDesc: 'Horizontal red brick wall with running bond masonry'
  },
  wall_perimeter_v: {
    type: 'wall_perimeter_v',
    name: 'Vertical Brick Wall',
    category: 'others',
    w: 36, h: 220,
    defaultTag: 'Brick Wall',
    defaultDesc: 'Vertical red brick wall with running bond masonry'
  }
};

export const SENSOR_CARD_TEMPLATES = {
  sensor: {
    tag: 'Sensor',
    title: 'Live Telemetry Card',
    desc: 'Binds to physical sensor channels',
    channels: [],
    metric: 'flow',
    style: 'badge',
    titlePosition: 'top'
  }
};

export const PIPE_PRESETS = [
  {
    id: 'pipe_horiz_gas',
    name: 'Horizontal Gas Pipe (→)',
    category: 'piping',
    medium: 'gas',
    w: 20,
    flow: 'forward',
    points: [{ dx: -80, dy: 0 }, { dx: 80, dy: 0 }],
    desc: 'Straight horizontal gas pipe'
  },
  {
    id: 'pipe_vert_gas',
    name: 'Vertical Gas Riser (↓)',
    category: 'piping',
    medium: 'gas',
    w: 20,
    flow: 'forward',
    points: [{ dx: 0, dy: -80 }, { dx: 0, dy: 80 }],
    desc: 'Straight vertical gas riser pipe'
  },
  {
    id: 'pipe_horiz_liquid',
    name: 'Horizontal Liquid Pipe (→)',
    category: 'piping',
    medium: 'liquid',
    w: 20,
    flow: 'forward',
    points: [{ dx: -80, dy: 0 }, { dx: 80, dy: 0 }],
    desc: 'Straight horizontal blue liquid supply pipe'
  },
  {
    id: 'pipe_vert_liquid',
    name: 'Vertical Liquid Riser (↓)',
    category: 'piping',
    medium: 'liquid',
    w: 20,
    flow: 'forward',
    points: [{ dx: 0, dy: -80 }, { dx: 0, dy: 80 }],
    desc: 'Straight vertical blue liquid riser pipe'
  }
];

export const RESOLUTION_PRESETS = [
  { label: 'Mobile Tall (1200 × 1350)', w: 1200, h: 1350 },
  { label: 'Widescreen 16:9 (1920 × 1080)', w: 1920, h: 1080 },
  { label: 'Standard 4:3 (1440 × 1080)', w: 1440, h: 1080 },
  { label: 'Square 1:1 (1200 × 1200)', w: 1200, h: 1200 }
];

export const TIPS_LIST = [
  'Pro Tip: Hold Spacebar and drag with your mouse, or use two-finger trackpad swipe to pan freely across the entire factory plant canvas.',
  'Pro Tip: Double-click an empty area on a pipeline to insert a corner bend point, or double-click an existing bend point to remove it.',
  'Pro Tip: Yellow Sensor Cards attach directly to physical transmitters and display real-time flow, dewpoint, pressure, and power telemetry.',
  'Pro Tip: Select any tank or compressor and pick a color swatch in the Inspector to apply custom industrial plant color themes.',
  'Pro Tip: Drag an asset or text note close to a pipeline to mount it with an automatic snap and dashed guide wire.',
  'Pro Tip: Toggle between Top and Left card title layouts in the Inspector for optimized horizontal or vertical card positioning.',
  'Pro Tip: Press "[" and "]" keys to quickly reorder overlapping equipment and pipelines forward or backward in the z-stack.',
  'Pro Tip: Use the Resolution Dialog on the HUD to switch between 16:9 widescreen, 4:3 standard, square, and custom screen dimensions.'
];

export const NOTE_OUTLINE_STYLES = [
  { id: 'none',   name: 'None',        desc: 'Plain text without border' },
  { id: 'single', name: 'Thin Single', desc: 'Thin single-line rectangular border' },
  { id: 'double', name: 'Thin Double', desc: 'Thin double-line architectural border' },
  { id: 'dotted', name: 'Dotted',      desc: 'Dotted outline border' },
  { id: 'dashed', name: 'Dashed',      desc: 'Dashed outline border' },
  { id: 'pill',   name: 'Rounded Pill', desc: 'Soft pill-shaped border' }
];

export const NOTE_COLOR_PALETTE = [
  { id: 'slate',   name: 'Slate',     hex: '#475569' },
  { id: 'dark',    name: 'Charcoal',  hex: '#0f172a' },
  { id: 'teal',    name: 'SUTO Teal', hex: '#00ac86' },
  { id: 'blue',    name: 'Blue',      hex: '#0284c7' },
  { id: 'amber',   name: 'Amber',     hex: '#d97706' },
  { id: 'red',     name: 'Alert Red', hex: '#dc2626' },
  { id: 'violet',  name: 'Violet',    hex: '#7c3aed' },
  { id: 'emerald', name: 'Green',     hex: '#16a34a' }
];

export function isSensorOrGateway(e) {
  if (!e || !e.type) return false;
  if (e.type === 'sensor_card') return false;
  const def = ASSET_DEFS[e.type];
  if (!def) return false;
  return def.category === 'sensors' || def.category === 'gateways';
}
