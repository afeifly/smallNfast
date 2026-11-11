import { ASSET_DEFS, EQUIPMENT_COLOR_THEMES, SENSOR_CARD_TEMPLATES } from './constants.js';
import { getPointAlongPipe, isPipeEndpointOpen, measureTextNoteBox, resolvePipelineFlowDirections } from './pipeUtils.js';

// Helper to create an SVG element with attributes and optional text content
export function svgEl(tag, attrs = {}, textContent = null) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) {
      el.setAttribute(k, v);
    }
  }
  if (textContent != null) {
    el.textContent = textContent;
  }
  return el;
}

// Get equipment color theme with solid flat colors (strictly zero gradients)
export function getEquipmentTheme(node) {
  const key = (node && node.colorTheme) ? node.colorTheme : 'blue';
  return EQUIPMENT_COLOR_THEMES[key] || EQUIPMENT_COLOR_THEMES.blue;
}

// Identify whether an element is a physical sensor or gateway that can host Sensor Mode telemetry
export function isSensorOrGateway(el) {
  if (!el || !el.type) return false;
  const def = ASSET_DEFS[el.type];
  if (!def) return false;
  return def.category === 'sensors' || def.category === 'gateways';
}

// Get channels array from card
export function getCardChannels(card) {
  if (Array.isArray(card?.channels)) {
    return card.channels;
  }
  return [];
}

// Render equipment tag label with constant visual font size regardless of equipment scale ("text is text")
// Supports empty string or null to render nothing
export function renderEquipmentTag(g, node, x, y, theme, defaultTag, extraAttrs = {}) {
  // If tag is explicitly empty or null, do not render any tag text
  if (node.tag === '' || node.tag === null) {
    return null;
  }
  const tagText = (node.tag !== undefined) ? node.tag : defaultTag;
  if (!tagText) return null;

  const scale = (typeof node.scale === 'number' && node.scale > 0) ? node.scale : 1;
  const baseFontSize = extraAttrs['font-size'] || 11;
  // Keep constant visual font size on screen regardless of equipment scale ("text is text")
  const effectiveFontSize = Math.round((baseFontSize / scale) * 100) / 100;

  let adjustedY = y;
  if (!extraAttrs.inside && typeof y === 'number') {
    const baseH = node.h || 100;
    const gap = 16;
    if (y > 20) {
      adjustedY = (baseH / 2) + (gap / scale);
    } else if (y < -20) {
      adjustedY = -(baseH / 2) - (gap / scale);
    }
  }

  const { inside, ...domAttrs } = extraAttrs;

  const attrs = {
    x,
    y: adjustedY,
    'text-anchor': 'middle',
    'font-size': effectiveFontSize,
    'font-weight': 700,
    fill: (theme?.id === 'white' || theme?.id === 'yellow') ? '#0f172a' : (theme?.dark || '#475569'),
    'font-family': 'sans-serif',
    ...domAttrs,
    'font-size': effectiveFontSize
  };

  const tag = svgEl('text', attrs);
  tag.textContent = tagText;
  g.appendChild(tag);
  return tag;
}

// --- SVG Asset Illustrators (Clean Flat Solid Colors, Zero Gradients) ---

export function drawBufferTank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic' });
  const w = 110, h = 210;

  const body = svgEl('path', {
    d: `M ${-w/2},${-h/2 + 35} 
        A ${w/2} 35 0 0 1 ${w/2} ${-h/2 + 35} 
        L ${w/2},${h/2 - 35} 
        A ${w/2} 35 0 0 1 ${-w/2} ${h/2 - 35} Z`,
    fill: theme.main,
    stroke: theme.dark,
    'stroke-width': 2
  });
  g.appendChild(body);

  g.appendChild(svgEl('path', { d: `M ${-w/2 + 15},${h/2 - 30} L ${-w/2 + 10},${h/2} L ${-w/2 + 25},${h/2} Z`, fill: '#475569' }));
  g.appendChild(svgEl('path', { d: `M ${w/2 - 15},${h/2 - 30} L ${w/2 - 10},${h/2} L ${w/2 - 25},${h/2} Z`, fill: '#475569' }));

  g.appendChild(svgEl('line', { x1: 0, y1: h/2 - 35, x2: 0, y2: h/2 - 15, stroke: theme.dark, 'stroke-width': 4 }));
  g.appendChild(svgEl('circle', { cx: 0, cy: h/2 - 15, r: 6, fill: theme.dark }));

  renderEquipmentTag(g, node, 0, -h/2 + 55, theme, 'Air Receiver', {
    inside: true,
    'font-size': 13,
    fill: (theme.id === 'white' || theme.id === 'yellow') ? '#0f172a' : '#ffffff',
    'letter-spacing': '1px'
  });
  return g;
}

export function drawCylinderBank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic' });
  const count = 3;
  const cylW = 20, cylH = 95, spacing = 28;
  const startX = -((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    const cx = startX + i * spacing;
    g.appendChild(svgEl('rect', {
      x: cx - cylW / 2, y: -cylH / 2 + 10, width: cylW, height: cylH - 10, rx: 4,
      fill: theme.main, stroke: theme.dark, 'stroke-width': 1.2
    }));
    g.appendChild(svgEl('path', {
      d: `M ${cx - cylW/2},${-cylH/2 + 10} A ${cylW/2} 10 0 0 1 ${cx + cylW/2} ${-cylH/2 + 10} Z`,
      fill: theme.light
    }));
    g.appendChild(svgEl('path', {
      d: `M ${cx},${-cylH/2 + 2} L ${cx},${-cylH/2 - 12} L ${cx + 8},${-cylH/2 - 12}`,
      fill: 'none', stroke: '#64748b', 'stroke-width': 2.5
    }));
  }

  g.appendChild(svgEl('rect', {
    x: startX - 25, y: -cylH / 2 - 16, width: (count * spacing) + 20, height: 8, rx: 2,
    fill: '#cbd5e1', stroke: '#94a3b8'
  }));

  renderEquipmentTag(g, node, 0, cylH / 2 + 18, theme, 'Air Cylinders', { 'font-size': 13, fill: theme.dark });
  return g;
}

export function drawCNCMachine(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic' });
  const w = 150, h = 110;

  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2, width: w, height: h, rx: 6,
    fill: '#ffffff', stroke: '#1e293b', 'stroke-width': 2.5, filter: 'url(#softCardShadow)'
  }));
  g.appendChild(svgEl('rect', {
    x: 10, y: -h / 2 + 8, width: 55, height: h - 16, rx: 3,
    fill: theme.main, stroke: theme.dark
  }));
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 14, y: -h / 2 + 16, width: 50, height: 42, rx: 2,
    fill: '#f1f5f9', stroke: '#94a3b8'
  }));
  g.appendChild(svgEl('rect', { x: -w / 2 + 10, y: h / 2, width: 20, height: 8, fill: '#0f172a' }));
  g.appendChild(svgEl('rect', { x: w / 2 - 30, y: h / 2, width: 20, height: 8, fill: '#0f172a' }));

  renderEquipmentTag(g, node, 0, h / 2 + 22, theme, 'Consumer', { 'font-size': 12, 'font-weight': 600, fill: '#475569' });
  return g;
}

export function drawRobotCell(node) {
  const g = svgEl('g', { class: 'asset-graphic' });

  g.appendChild(svgEl('path', {
    d: `M -34,16 Q -28,-6 -14,-10 L 14,-10 Q 28,-6 34,16 L -34,16 Z`,
    fill: '#ef4444', stroke: '#b91c1c', 'stroke-width': 1.5
  }));
  g.appendChild(svgEl('path', {
    d: `M -20,10 Q -10,-2 0,-2 Q 10,-2 20,10 Z`,
    fill: '#e0f2fe', stroke: '#38bdf8', 'stroke-width': 1
  }));
  g.appendChild(svgEl('circle', { cx: -26, cy: 12, r: 3, fill: '#fef08a' }));
  g.appendChild(svgEl('circle', { cx: 26, cy: 12, r: 3, fill: '#fef08a' }));

  g.appendChild(svgEl('rect', { x: -75, y: 8, width: 18, height: 26, rx: 3, fill: '#64748b' }));
  g.appendChild(svgEl('circle', { cx: -66, cy: 8, r: 7, fill: '#334155' }));
  g.appendChild(svgEl('path', { d: `M -66,8 L -54,-18 L -36,-14`, fill: 'none', stroke: '#94a3b8', 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
  g.appendChild(svgEl('circle', { cx: -36, cy: -14, r: 4, fill: '#0284c7' }));

  g.appendChild(svgEl('rect', { x: 57, y: 8, width: 18, height: 26, rx: 3, fill: '#64748b' }));
  g.appendChild(svgEl('circle', { cx: 66, cy: 8, r: 7, fill: '#334155' }));
  g.appendChild(svgEl('path', { d: `M 66,8 L 54,-18 L 36,-14`, fill: 'none', stroke: '#94a3b8', 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
  g.appendChild(svgEl('circle', { cx: 36, cy: -14, r: 4, fill: '#0284c7' }));

  g.appendChild(svgEl('rect', { x: -85, y: 34, width: 170, height: 6, rx: 2, fill: '#334155' }));

  renderEquipmentTag(g, node, 0, 56, null, 'Consumer', { 'font-size': 12, 'font-weight': 600, fill: '#475569' });
  return g;
}

export function drawHorizontalTank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic tank-horizontal' });
  const def = ASSET_DEFS.tank_horizontal || { w: 190, h: 120 };
  const w = node.w || def.w;
  const h = node.h || def.h;
  const rY = Math.max(15, (h - 40) / 2);
  const capW = 24;

  // Saddles / Cradle Base Mounts
  const saddleW = 22;
  const saddleH = 24;
  [-w / 4, w / 4].forEach(sx => {
    g.appendChild(svgEl('rect', {
      x: sx - saddleW / 2 - 6, y: h / 2 - 8, width: saddleW + 12, height: 8, rx: 1.5,
      fill: '#334155', stroke: '#1e293b', 'stroke-width': 1
    }));
    g.appendChild(svgEl('path', {
      d: `M ${sx - saddleW / 2},${h / 2 - 8} L ${sx - saddleW / 2 + 4},${h / 2 - saddleH} L ${sx + saddleW / 2 - 4},${h / 2 - saddleH} L ${sx + saddleW / 2},${h / 2 - 8} Z`,
      fill: '#475569', stroke: '#334155', 'stroke-width': 1
    }));
  });

  const bodyPath = `
    M ${-w / 2 + capW},${-rY}
    L ${w / 2 - capW},${-rY}
    A ${capW} ${rY} 0 0 1 ${w / 2 - capW},${rY}
    L ${-w / 2 + capW},${rY}
    A ${capW} ${rY} 0 0 1 ${-w / 2 + capW},${-rY} Z
  `;
  g.appendChild(svgEl('path', {
    d: bodyPath,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 2
  }));

  g.appendChild(svgEl('line', {
    x1: -w / 2 + capW, y1: -rY, x2: -w / 2 + capW, y2: rY,
    stroke: theme.dark, 'stroke-width': 1.5, 'stroke-dasharray': '3 2'
  }));
  g.appendChild(svgEl('line', {
    x1: w / 2 - capW, y1: -rY, x2: w / 2 - capW, y2: rY,
    stroke: theme.dark, 'stroke-width': 1.5, 'stroke-dasharray': '3 2'
  }));

  g.appendChild(svgEl('rect', {
    x: -14, y: -rY - 14, width: 28, height: 14, fill: '#64748b', stroke: '#475569', 'stroke-width': 1.2
  }));
  g.appendChild(svgEl('rect', {
    x: -18, y: -rY - 18, width: 36, height: 5, rx: 1.5, fill: '#475569', stroke: '#334155', 'stroke-width': 1
  }));
  [-12, -4, 4, 12].forEach(bx => {
    g.appendChild(svgEl('circle', { cx: bx, cy: -rY - 15.5, r: 1.2, fill: '#cbd5e1' }));
  });

  g.appendChild(svgEl('circle', { cx: w / 4, cy: -rY - 12, r: 8, fill: '#ffffff', stroke: '#475569', 'stroke-width': 1.5 }));
  g.appendChild(svgEl('line', { x1: w / 4, y1: -rY - 12, x2: w / 4 + 4, y2: -rY - 16, stroke: '#ef4444', 'stroke-width': 1.5 }));

  g.appendChild(svgEl('rect', {
    x: -30, y: -10, width: 60, height: 20, rx: 3, fill: '#f1f5f9', stroke: '#94a3b8', 'stroke-width': 1
  }));
  g.appendChild(svgEl('rect', {
    x: -26, y: -2, width: 52, height: 10, rx: 2, fill: theme.light
  }));

  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Horiz Tank', { 'font-size': 12, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawCryogenicTank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic tank-cryogenic' });
  const def = ASSET_DEFS.tank_cryogenic || { w: 130, h: 230 };
  const w = node.w || def.w;
  const h = node.h || def.h;
  const bodyW = w - 24;
  const bodyH = h - 60;
  const domeH = 26;

  const legX1 = -bodyW / 2 + 8;
  const legX2 = bodyW / 2 - 8;
  g.appendChild(svgEl('line', { x1: legX1, y1: bodyH / 2 - 10, x2: legX1, y2: h / 2 - 6, stroke: '#475569', 'stroke-width': 5 }));
  g.appendChild(svgEl('line', { x1: legX2, y1: bodyH / 2 - 10, x2: legX2, y2: h / 2 - 6, stroke: '#475569', 'stroke-width': 5 }));
  g.appendChild(svgEl('rect', { x: legX1 - 8, y: h / 2 - 6, width: 16, height: 6, rx: 1, fill: '#334155' }));
  g.appendChild(svgEl('rect', { x: legX2 - 8, y: h / 2 - 6, width: 16, height: 6, rx: 1, fill: '#334155' }));

  const tankPath = `
    M ${-bodyW / 2},${-bodyH / 2 + domeH}
    A ${bodyW / 2} ${domeH} 0 0 1 ${bodyW / 2},${-bodyH / 2 + domeH}
    L ${bodyW / 2},${bodyH / 2 - domeH}
    A ${bodyW / 2} ${domeH} 0 0 1 ${-bodyW / 2},${bodyH / 2 - domeH} Z
  `;
  g.appendChild(svgEl('path', {
    d: tankPath, fill: '#f8fafc', stroke: '#64748b', 'stroke-width': 2
  }));

  g.appendChild(svgEl('rect', {
    x: -bodyW / 2 - 2, y: -15, width: bodyW + 4, height: 30, rx: 3,
    fill: 'none', stroke: theme.main, 'stroke-width': 2, 'stroke-dasharray': '5 3'
  }));

  g.appendChild(svgEl('path', {
    d: `M ${bodyW / 2},${-30} L ${bodyW / 2 + 14},${-30} L ${bodyW / 2 + 14},${40} L ${bodyW / 2},${40}`,
    fill: 'none', stroke: theme.main, 'stroke-width': 3, 'stroke-linecap': 'round'
  }));

  g.appendChild(svgEl('line', { x1: 0, y1: -bodyH / 2 + 2, x2: 0, y2: -bodyH / 2 - 16, stroke: '#475569', 'stroke-width': 3.5 }));
  g.appendChild(svgEl('path', {
    d: `M -8,${-bodyH / 2 - 16} L 8,${-bodyH / 2 - 16} L 0,${-bodyH / 2 - 24} Z`, fill: '#ef4444'
  }));

  renderEquipmentTag(g, node, 0, h / 2 + 18, theme, 'Cryo Tank', { 'font-size': 12, fill: theme.main });
  return g;
}

export function drawSphericalTank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic tank-spherical' });
  const def = ASSET_DEFS.tank_spherical || { w: 160, h: 190 };
  const w = node.w || def.w;
  const h = node.h || def.h;
  const r = Math.min(58, w * 0.38);
  const cy = -15;

  const legYBottom = h / 2 - 6;
  const angles = [-0.75, -0.4, 0, 0.4, 0.75];
  angles.forEach(ang => {
    const sx = Math.sin(ang) * (r - 2);
    const sy = cy + Math.cos(ang) * (r - 2);
    g.appendChild(svgEl('line', {
      x1: sx, y1: sy, x2: sx * 1.3, y2: legYBottom,
      stroke: '#475569', 'stroke-width': 3.5
    }));
    g.appendChild(svgEl('rect', {
      x: sx * 1.3 - 5, y: legYBottom - 3, width: 10, height: 6, rx: 1, fill: '#334155'
    }));
  });

  g.appendChild(svgEl('circle', {
    cx: 0, cy: cy, r: r, fill: theme.main, stroke: theme.dark, 'stroke-width': 2.5
  }));

  g.appendChild(svgEl('ellipse', {
    cx: 0, cy: cy, rx: r - 1, ry: 16, fill: 'none', stroke: theme.dark, 'stroke-width': 1.5, 'stroke-dasharray': '4 2'
  }));

  g.appendChild(svgEl('line', { x1: 0, y1: cy - r, x2: 0, y2: cy - r - 18, stroke: '#475569', 'stroke-width': 3 }));
  g.appendChild(svgEl('path', {
    d: `M -6,${cy - r - 18} L 6,${cy - r - 18} L 0,${cy - r - 26} Z`, fill: '#ef4444'
  }));

  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Sphere Tank', { 'font-size': 12, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawSeparatorTank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic tank-separator' });
  const def = ASSET_DEFS.tank_separator || { w: 90, h: 170 };
  const w = node.w || def.w;
  const h = node.h || def.h;
  const bodyW = 54;
  const bodyH = 75;

  g.appendChild(svgEl('rect', {
    x: -bodyW / 2, y: -h / 2 + 25, width: bodyW, height: bodyH, rx: 6,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 2
  }));

  g.appendChild(svgEl('polygon', {
    points: `${-bodyW / 2},${-h / 2 + 25 + bodyH} ${bodyW / 2},${-h / 2 + 25 + bodyH} 10,${-h / 2 + 25 + bodyH + 30} -10,${-h / 2 + 25 + bodyH + 30}`,
    fill: theme.dark, stroke: theme.dark, 'stroke-width': 1.5
  }));

  const drainY = -h / 2 + 25 + bodyH + 30;
  g.appendChild(svgEl('rect', {
    x: -12, y: drainY, width: 24, height: 20, rx: 3, fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 1
  }));
  g.appendChild(svgEl('line', {
    x1: 0, y1: drainY + 20, x2: 0, y2: drainY + 28, stroke: theme.main, 'stroke-width': 3
  }));

  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Separator', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawCompressor(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-compressor' });
  const def = ASSET_DEFS.machine_compressor || { w: 170, h: 140 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2, width: w, height: h - 14, rx: 6,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 2, filter: 'url(#softCardShadow)'
  }));

  g.appendChild(svgEl('rect', {
    x: -w / 2 + 16, y: -h / 2 - 6, width: 60, height: 6, rx: 1.5, fill: '#334155'
  }));

  const louverW = 44;
  const louverH = 75;
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 14, y: -h / 2 + 18, width: louverW, height: louverH, rx: 3,
    fill: '#0f172a', stroke: '#1e293b', 'stroke-width': 1
  }));
  for (let i = 0; i < 5; i++) {
    g.appendChild(svgEl('line', {
      x1: -w / 2 + 18, y1: -h / 2 + 28 + i * 13, x2: -w / 2 + 14 + louverW - 4, y2: -h / 2 + 28 + i * 13,
      stroke: '#475569', 'stroke-width': 2.5
    }));
  }

  const doorX = 4;
  const doorW = w / 2 - 14;
  g.appendChild(svgEl('rect', {
    x: doorX, y: -h / 2 + 14, width: doorW, height: h - 42, rx: 3,
    fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 1.5
  }));

  g.appendChild(svgEl('rect', {
    x: doorX + 10, y: -h / 2 + 24, width: doorW - 20, height: 32, rx: 3,
    fill: '#0f172a', stroke: '#334155', 'stroke-width': 1.5
  }));
  g.appendChild(svgEl('circle', {
    cx: doorX + 18, cy: -h / 2 + 34, r: 3, fill: '#10b981'
  }));
  g.appendChild(svgEl('line', {
    x1: doorX + 26, y1: -h / 2 + 34, x2: doorX + doorW - 20, y2: -h / 2 + 34,
    stroke: theme.light, 'stroke-width': 2, 'stroke-linecap': 'round'
  }));

  g.appendChild(svgEl('circle', { cx: doorX + doorW / 2, cy: -h / 2 + 75, r: 8, fill: '#facc15' }));
  g.appendChild(svgEl('circle', { cx: doorX + doorW / 2, cy: -h / 2 + 75, r: 5.5, fill: '#ef4444' }));

  g.appendChild(svgEl('rect', { x: -w / 2 + 14, y: h / 2 - 14, width: 24, height: 8, rx: 1, fill: '#0f172a' }));
  g.appendChild(svgEl('rect', { x: w / 2 - 38, y: h / 2 - 14, width: 24, height: 8, rx: 1, fill: '#0f172a' }));

  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Air Compressor', { 'font-size': 12, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawRefrigeratedDryer(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-dryer' });
  const def = ASSET_DEFS.machine_dryer || { w: 130, h: 130 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2, width: w, height: h - 12, rx: 5,
    fill: '#f8fafc', stroke: '#94a3b8', 'stroke-width': 2, filter: 'url(#softCardShadow)'
  }));
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2, width: w, height: 18, rx: 4, fill: theme.main
  }));

  const grillW = w - 24;
  const grillH = 46;
  g.appendChild(svgEl('rect', {
    x: -grillW / 2, y: 0, width: grillW, height: grillH, rx: 3,
    fill: '#1e293b', stroke: '#334155', 'stroke-width': 1
  }));
  for (let i = 0; i < 4; i++) {
    g.appendChild(svgEl('line', {
      x1: -grillW / 2 + 6, y1: 8 + i * 10, x2: grillW / 2 - 6, y2: 8 + i * 10,
      stroke: '#475569', 'stroke-width': 2
    }));
  }

  g.appendChild(svgEl('rect', {
    x: -30, y: -24, width: 60, height: 18, rx: 2, fill: '#0f172a', stroke: '#334155', 'stroke-width': 1
  }));
  g.appendChild(svgEl('circle', { cx: -20, cy: -15, r: 2.5, fill: '#10b981' }));
  g.appendChild(svgEl('line', {
    x1: -12, y1: -15, x2: 20, y2: -15, stroke: '#10b981', 'stroke-width': 1.5, 'stroke-linecap': 'round'
  }));

  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Air Dryer', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawChiller(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-chiller' });
  const def = ASSET_DEFS.machine_chiller || { w: 160, h: 135 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Heavy Base Skid & Vibration Mounts
  const baseW = 138;
  const baseH = 82;
  const baseY = -35;

  // Vibration dampening mounting feet
  [-50, -18, 18, 50].forEach(fx => {
    g.appendChild(svgEl('rect', {
      x: fx - 8, y: baseY + baseH, width: 16, height: 6, rx: 1,
      fill: '#0f172a', stroke: '#334155', 'stroke-width': 1
    }));
  });

  // Main Industrial Chiller Cabinet
  g.appendChild(svgEl('rect', {
    x: -baseW / 2, y: baseY, width: baseW, height: baseH, rx: 4,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 1.6,
    filter: 'url(#softCardShadow)'
  }));

  // Lower Reinforced Steel Plinth
  g.appendChild(svgEl('rect', {
    x: -baseW / 2, y: baseY + baseH - 8, width: baseW, height: 8, rx: 1,
    fill: theme.dark
  }));

  // Cabinet Vertical Access Panel Joint Line
  g.appendChild(svgEl('line', {
    x1: -5, y1: baseY + 2, x2: -5, y2: baseY + baseH - 8,
    stroke: theme.dark, 'stroke-width': 1.4
  }));

  // Left Section: Condenser Air Cooling Fan
  const fanCX = -38;
  const fanCY = baseY + 28;
  const fanR = 21;

  g.appendChild(svgEl('circle', {
    cx: fanCX, cy: fanCY, r: fanR,
    fill: '#0f172a', stroke: theme.dark, 'stroke-width': 1.5
  }));
  // Fan safety wire rings
  g.appendChild(svgEl('circle', { cx: fanCX, cy: fanCY, r: 14, fill: 'none', stroke: theme.light, 'stroke-width': 0.8, opacity: 0.6 }));
  g.appendChild(svgEl('circle', { cx: fanCX, cy: fanCY, r: 7.5, fill: 'none', stroke: theme.light, 'stroke-width': 0.8, opacity: 0.6 }));
  // 4 Fan blades
  g.appendChild(svgEl('line', { x1: fanCX - 16, y1: fanCY - 16, x2: fanCX + 16, y2: fanCY + 16, stroke: '#64748b', 'stroke-width': 3, 'stroke-linecap': 'round' }));
  g.appendChild(svgEl('line', { x1: fanCX - 16, y1: fanCY + 16, x2: fanCX + 16, y2: fanCY - 16, stroke: '#64748b', 'stroke-width': 3, 'stroke-linecap': 'round' }));
  // Center motor hub
  g.appendChild(svgEl('circle', { cx: fanCX, cy: fanCY, r: 4.5, fill: theme.light, stroke: '#ffffff', 'stroke-width': 1 }));

  // Lower Ventilation Louver Slots (Air condenser intake)
  [baseY + 56, baseY + 62, baseY + 68].forEach(ly => {
    g.appendChild(svgEl('rect', {
      x: -58, y: ly, width: 42, height: 3, rx: 1,
      fill: '#0f172a', opacity: 0.85
    }));
  });

  // Right Section: Digital Temperature Microprocessor Controller
  const pnlX = 5;
  const pnlY = baseY + 8;
  const pnlW = 58;
  const pnlH = 42;

  g.appendChild(svgEl('rect', {
    x: pnlX, y: pnlY, width: pnlW, height: pnlH, rx: 2.5,
    fill: '#0f172a', stroke: '#334155', 'stroke-width': 1.2
  }));

  // Digital LED Screen (Chilled Water Setpoint & Reading)
  g.appendChild(svgEl('rect', {
    x: pnlX + 5, y: pnlY + 5, width: 48, height: 18, rx: 1.5,
    fill: '#020617', stroke: '#1e293b', 'stroke-width': 0.8
  }));

  // Chilled Water Temp Readout
  const tempTxt = svgEl('text', {
    x: pnlX + 9, y: pnlY + 17, 'font-size': 9, 'font-weight': 900,
    fill: theme.light, 'font-family': 'JetBrains Mono, monospace'
  });
  tempTxt.textContent = '--.-°C';
  g.appendChild(tempTxt);

  const chwTxt = svgEl('text', {
    x: pnlX + 49, y: pnlY + 11, 'text-anchor': 'end', 'font-size': 4, 'font-weight': 700,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  chwTxt.textContent = 'CHW';
  g.appendChild(chwTxt);

  // Indicator LEDs: RUN (Green), COMP (Amber), ALM (Off/Red)
  const ledLabels = ['RUN', 'CMP', 'ALM'];
  const ledColors = ['#22c55e', '#f59e0b', '#334155'];
  ledLabels.forEach((lbl, i) => {
    const lx = pnlX + 8 + i * 16;
    g.appendChild(svgEl('circle', {
      cx: lx, cy: pnlY + 28, r: 2.2, fill: ledColors[i], stroke: '#0f172a', 'stroke-width': 0.5
    }));
    const lText = svgEl('text', {
      x: lx, y: pnlY + 36, 'text-anchor': 'middle', 'font-size': 3.5, 'font-weight': 700,
      fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
    });
    lText.textContent = lbl;
    g.appendChild(lText);
  });

  // Dual Refrigerant Pressure Gauge
  const gCX = pnlX + 16;
  const gCY = baseY + 63;
  g.appendChild(svgEl('circle', { cx: gCX, cy: gCY, r: 8, fill: '#ffffff', stroke: '#334155', 'stroke-width': 1 }));
  g.appendChild(svgEl('line', { x1: gCX, y1: gCY, x2: gCX + 4, y2: gCY - 4, stroke: '#ef4444', 'stroke-width': 1 }));
  g.appendChild(svgEl('circle', { cx: gCX, cy: gCY, r: 1.5, fill: '#0f172a' }));

  // Emergency Stop / Rotary Power Switch
  const esX = pnlX + 44;
  const esY = baseY + 63;
  g.appendChild(svgEl('circle', { cx: esX, cy: esY, r: 6.5, fill: '#facc15', stroke: '#ca8a04', 'stroke-width': 0.8 }));
  g.appendChild(svgEl('circle', { cx: esX, cy: esY, r: 4, fill: '#dc2626' }));

  // Process Chilled Water Ports on Right Side (Supply & Return)
  // CHW Supply OUT
  g.appendChild(svgEl('rect', {
    x: baseW / 2, y: baseY + 48, width: 8, height: 14, rx: 1,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 1
  }));
  g.appendChild(svgEl('circle', { cx: baseW / 2 + 8, cy: baseY + 55, r: 3, fill: theme.light }));

  // CHW Return IN
  g.appendChild(svgEl('rect', {
    x: baseW / 2, y: baseY + 20, width: 8, height: 14, rx: 1,
    fill: '#64748b', stroke: '#475569', 'stroke-width': 1
  }));
  g.appendChild(svgEl('circle', { cx: baseW / 2 + 8, cy: baseY + 27, r: 3, fill: '#94a3b8' }));

  // Equipment Label
  renderEquipmentTag(g, node, 0, baseY + baseH + 20, theme, 'Industrial Chiller', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawInlineFilter(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic filter-line' });
  const def = ASSET_DEFS.filter_line || { w: 80, h: 130 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Top Cast Filter Head Block
  const headW = 56;
  const headH = 26;
  const headY = -h / 2 + 18;
  g.appendChild(svgEl('rect', {
    x: -headW / 2, y: headY, width: headW, height: headH, rx: 3,
    fill: '#334155', stroke: '#1e293b', 'stroke-width': 1.5
  }));

  // Left Inlet Port & Right Outlet Port Flanges
  g.appendChild(svgEl('rect', { x: -w / 2, y: headY + 5, width: (w - headW) / 2, height: 16, fill: '#64748b', stroke: '#475569', 'stroke-width': 1 }));
  g.appendChild(svgEl('rect', { x: headW / 2, y: headY + 5, width: (w - headW) / 2, height: 16, fill: '#64748b', stroke: '#475569', 'stroke-width': 1 }));

  // Direction arrow on head
  const arrTxt = svgEl('text', {
    x: 0, y: headY + 17, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 900,
    fill: '#ffffff', 'font-family': 'sans-serif'
  });
  arrTxt.textContent = '→';
  g.appendChild(arrTxt);

  // 2. Top Differential Pressure (Δp) Pop-up Indicator / Gauge
  g.appendChild(svgEl('rect', {
    x: -9, y: headY - 12, width: 18, height: 12, rx: 5, fill: '#e2e8f0', stroke: '#475569', 'stroke-width': 1
  }));
  g.appendChild(svgEl('rect', { x: -7, y: headY - 10, width: 7, height: 8, fill: '#22c55e' }));
  g.appendChild(svgEl('rect', { x: 0, y: headY - 10, width: 7, height: 8, fill: '#ef4444' }));

  // 3. Filter Bowl Housing
  const bowlW = 44;
  const bowlH = 65;
  const bowlY = headY + headH;
  g.appendChild(svgEl('rect', {
    x: -bowlW / 2 - 3, y: bowlY, width: bowlW + 6, height: 6, rx: 1, fill: '#475569'
  }));
  g.appendChild(svgEl('path', {
    d: `M ${-bowlW / 2},${bowlY + 6} L ${bowlW / 2},${bowlY + 6} L ${bowlW / 2 - 4},${bowlY + bowlH} L ${-bowlW / 2 + 4},${bowlY + bowlH} Z`,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 1.8
  }));

  // Vertical Liquid Level Sight Glass Window
  g.appendChild(svgEl('rect', {
    x: -4, y: bowlY + 14, width: 8, height: 36, rx: 2, fill: '#f8fafc', stroke: '#64748b', 'stroke-width': 1
  }));
  g.appendChild(svgEl('rect', {
    x: -2.5, y: bowlY + 28, width: 5, height: 20, rx: 1, fill: theme.light
  }));

  // 4. Automatic Float Condensate Drain at Bottom
  g.appendChild(svgEl('rect', {
    x: -7, y: bowlY + bowlH, width: 14, height: 12, rx: 2, fill: '#0f172a', stroke: '#1e293b', 'stroke-width': 1
  }));
  g.appendChild(svgEl('line', {
    x1: 0, y1: bowlY + bowlH + 12, x2: 0, y2: bowlY + bowlH + 22, stroke: theme.main, 'stroke-width': 3
  }));

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Air Filter', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawBoosterPump(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-pump' });
  const def = ASSET_DEFS.machine_pump || { w: 150, h: 110 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // Structural Base Skid
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: h / 2 - 16, width: w, height: 16, rx: 2, fill: '#334155', stroke: '#1e293b', 'stroke-width': 1.5
  }));

  // Electric Drive Motor on Left
  const motW = 56;
  const motH = 48;
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 12, y: -motH / 2 + 5, width: motW, height: motH, rx: 4,
    fill: theme.main, stroke: theme.dark, 'stroke-width': 1.8
  }));
  for (let f = 0; f < 4; f++) {
    g.appendChild(svgEl('line', {
      x1: -w / 2 + 22 + f * 9, y1: -motH / 2 + 8, x2: -w / 2 + 22 + f * 9, y2: motH / 2 + 2,
      stroke: theme.dark, 'stroke-width': 1.5
    }));
  }
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 24, y: -motH / 2 - 6, width: 20, height: 11, rx: 1.5, fill: '#0f172a'
  }));

  // Shaft Coupling Safety Guard in Center (Caution Yellow)
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 12 + motW + 4, y: -8, width: 16, height: 26, rx: 2, fill: '#facc15', stroke: '#ca8a04', 'stroke-width': 1
  }));

  // Centrifugal Pump Casing on Right
  const pumpCX = w / 2 - 32;
  const pumpCY = 5;
  g.appendChild(svgEl('circle', {
    cx: pumpCX, cy: pumpCY, r: 24, fill: '#475569', stroke: '#334155', 'stroke-width': 2
  }));
  g.appendChild(svgEl('circle', {
    cx: pumpCX, cy: pumpCY, r: 10, fill: '#64748b', stroke: '#1e293b', 'stroke-width': 1.5
  }));
  g.appendChild(svgEl('rect', {
    x: pumpCX - 7, y: -h / 2 + 12, width: 14, height: 18, fill: '#64748b', stroke: '#475569', 'stroke-width': 1
  }));
  g.appendChild(svgEl('rect', {
    x: pumpCX - 11, y: -h / 2 + 8, width: 22, height: 5, rx: 1, fill: '#334155'
  }));
  g.appendChild(svgEl('circle', { cx: pumpCX + 14, cy: -h / 2 + 6, r: 6, fill: '#ffffff', stroke: '#475569', 'stroke-width': 1 }));
  g.appendChild(svgEl('line', { x1: pumpCX + 14, y1: -h / 2 + 6, x2: pumpCX + 17, y2: -h / 2 + 3, stroke: '#ef4444', 'stroke-width': 1 }));

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Booster Pump', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawPistonCompressor(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-compressor-piston' });
  const def = ASSET_DEFS.machine_compressor_piston || { w: 180, h: 150 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Bottom Horizontal Air Receiver Tank
  const tankY = 24;
  const tankH = 50;
  const tankW = w - 24;
  const capW = 16;
  const rY = tankH / 2;

  // Support feet
  g.appendChild(svgEl('rect', { x: -tankW / 2 + 10, y: tankY + rY, width: 14, height: 10, rx: 1, fill: '#334155' }));
  g.appendChild(svgEl('rect', { x: tankW / 2 - 24, y: tankY + rY, width: 14, height: 10, rx: 1, fill: '#334155' }));
  // Tank drain spigot
  g.appendChild(svgEl('line', { x1: 0, y1: tankY + rY, x2: 0, y2: tankY + rY + 8, stroke: theme.main, 'stroke-width': 2.5 }));

  // Tank body with dish ends
  const tankPath = `
    M ${-tankW / 2 + capW},${tankY - rY}
    L ${tankW / 2 - capW},${tankY - rY}
    A ${capW} ${rY} 0 0 1 ${tankW / 2 - capW},${tankY + rY}
    L ${-tankW / 2 + capW},${tankY + rY}
    A ${capW} ${rY} 0 0 1 ${-tankW / 2 + capW},${tankY - rY} Z
  `;
  g.appendChild(svgEl('path', { d: tankPath, fill: theme.main, stroke: theme.dark, 'stroke-width': 2 }));
  g.appendChild(svgEl('circle', { cx: tankW / 2 - 10, cy: tankY - 6, r: 6, fill: '#ffffff', stroke: '#475569', 'stroke-width': 1.2 }));

  // 2. Top Equipment Deck Plate
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 14, y: tankY - rY - 6, width: w - 28, height: 6, rx: 1.5, fill: '#475569'
  }));

  // 3. Electric Drive Motor on Right
  const motX = 15;
  const motY = -12;
  g.appendChild(svgEl('rect', {
    x: motX, y: motY, width: 44, height: 32, rx: 3, fill: theme.dark, stroke: theme.dark, 'stroke-width': 1.5
  }));
  for (let f = 0; f < 3; f++) {
    g.appendChild(svgEl('line', { x1: motX + 10 + f * 10, y1: motY + 4, x2: motX + 10 + f * 10, y2: motY + 28, stroke: theme.light, 'stroke-width': 1.5 }));
  }

  // 4. Two-Stage V-Twin Cast Pump Head on Left
  const pumpX = -45;
  const pumpY = -18;
  // Crankcase
  g.appendChild(svgEl('rect', {
    x: pumpX - 16, y: pumpY + 12, width: 32, height: 26, rx: 2, fill: '#334155', stroke: '#1e293b', 'stroke-width': 1.5
  }));
  // Finned cylinders
  g.appendChild(svgEl('path', {
    d: `M ${pumpX - 14},${pumpY + 12} L ${pumpX - 24},${pumpY - 14} L ${pumpX - 4},${pumpY - 14} L ${pumpX},${pumpY + 12} Z`,
    fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 1.2
  }));
  g.appendChild(svgEl('path', {
    d: `M ${pumpX},${pumpY + 12} L ${pumpX + 4},${pumpY - 14} L ${pumpX + 24},${pumpY - 14} L ${pumpX + 14},${pumpY + 12} Z`,
    fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 1.2
  }));
  // Air filter canister on top
  g.appendChild(svgEl('circle', { cx: pumpX - 14, cy: pumpY - 20, r: 8, fill: '#0f172a', stroke: '#475569', 'stroke-width': 1 }));

  // Copper discharge tube from pump to tank
  g.appendChild(svgEl('path', {
    d: `M ${pumpX + 8},${pumpY - 8} Q ${pumpX + 26},${pumpY} ${pumpX + 24},${tankY - rY}`,
    fill: 'none', stroke: '#ea580c', 'stroke-width': 2.5
  }));

  // 5. Belt & Pulley Wire-Mesh Safety Guard in Center
  g.appendChild(svgEl('path', {
    d: `M ${pumpX + 12},${pumpY + 4} L ${motX + 22},${motY + 2} L ${motX + 22},${motY + 28} L ${pumpX + 12},${pumpY + 34} Z`,
    fill: 'rgba(250, 204, 21, 0.25)', stroke: '#facc15', 'stroke-width': 1.5, 'stroke-dasharray': '2 1.5'
  }));

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Piston Compressor', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawFilterBank(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic filter-stage3' });
  const def = ASSET_DEFS.filter_stage3 || { w: 160, h: 130 };
  const w = node.w || def.w;
  const h = node.h || def.h;
  const colSpacing = 44;
  const bowlW = 34;
  const bowlH = 58;

  // Top Continuous Header Manifold Rail
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2 + 20, width: w, height: 14, rx: 2, fill: '#334155', stroke: '#1e293b', 'stroke-width': 1.5
  }));

  // 3 Stages: [-colSpacing, 0, colSpacing]
  const stages = [
    { color: '#10b981', label: 'PRE' },
    { color: theme.main, label: '0.01μ' },
    { color: '#1e293b', label: 'ACT' }
  ];

  [-colSpacing, 0, colSpacing].forEach((fx, idx) => {
    const st = stages[idx];
    const headY = -h / 2 + 14;

    // Top Δp Gauge Dial
    g.appendChild(svgEl('circle', { cx: fx, cy: headY - 8, r: 7, fill: '#ffffff', stroke: '#475569', 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: fx, cy: headY - 8, x2: fx + 3, y2: headY - 12, stroke: '#ef4444', 'stroke-width': 1.2 }));

    // Grade identification colored collar band
    g.appendChild(svgEl('rect', {
      x: fx - bowlW / 2 - 1, y: headY + 20, width: bowlW + 2, height: 6, rx: 1, fill: st.color
    }));

    // Bowl body
    g.appendChild(svgEl('path', {
      d: `M ${fx - bowlW / 2},${headY + 26} L ${fx + bowlW / 2},${headY + 26} L ${fx + bowlW / 2 - 3},${headY + 26 + bowlH} L ${fx - bowlW / 2 + 3},${headY + 26 + bowlH} Z`,
      fill: theme.main, stroke: theme.dark, 'stroke-width': 1.5
    }));

    // Grade label text
    const stTxt = svgEl('text', {
      x: fx, y: headY + 54, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 900,
      fill: (theme.id === 'white' || theme.id === 'yellow') ? '#0f172a' : '#ffffff', 'font-family': 'JetBrains Mono, sans-serif'
    });
    stTxt.textContent = st.label;
    g.appendChild(stTxt);

    // Auto drain spigot
    g.appendChild(svgEl('rect', {
      x: fx - 4, y: headY + 26 + bowlH, width: 8, height: 8, rx: 1, fill: '#0f172a'
    }));
    g.appendChild(svgEl('line', {
      x1: fx, y1: headY + 34 + bowlH, x2: fx, y2: headY + 42 + bowlH, stroke: theme.main, 'stroke-width': 2.5
    }));
  });

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Filter Bank', { 'font-size': 11, fill: theme.id === 'white' ? '#475569' : theme.dark });
  return g;
}

export function drawLaserCutter(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-laser' });
  const def = ASSET_DEFS.machine_laser || { w: 180, h: 130 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // Heavy Machine Body Base
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2, width: w, height: h - 16, rx: 5,
    fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 2
  }));

  // Tinted Amber Laser Safety Glass Window
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 16, y: -h / 2 + 16, width: w - 50, height: h - 50, rx: 3,
    fill: '#f59e0b', stroke: '#d97706', 'stroke-width': 1.5, opacity: 0.85
  }));

  // Overhead Gantry Beam and Laser Cutting Nozzle
  g.appendChild(svgEl('line', {
    x1: -w / 2 + 16, y1: -8, x2: w / 2 - 34, y2: -8, stroke: '#475569', 'stroke-width': 4
  }));
  g.appendChild(svgEl('rect', {
    x: -12, y: -14, width: 24, height: 18, rx: 2, fill: '#0f172a'
  }));
  g.appendChild(svgEl('line', { x1: 0, y1: 4, x2: 0, y2: 14, stroke: '#cbd5e1', 'stroke-width': 2.5 }));
  g.appendChild(svgEl('circle', { cx: 0, cy: 15, r: 2.5, fill: '#ef4444' }));

  // Operator Swivel Console on Right
  g.appendChild(svgEl('rect', {
    x: w / 2 - 28, y: -h / 2 + 20, width: 20, height: 34, rx: 2, fill: '#334155', stroke: '#475569'
  }));
  g.appendChild(svgEl('rect', {
    x: w / 2 - 25, y: -h / 2 + 24, width: 14, height: 14, fill: theme.main
  }));

  // Exhaust Extraction Duct on Top
  g.appendChild(svgEl('rect', {
    x: -20, y: -h / 2 - 8, width: 40, height: 8, rx: 2, fill: '#64748b'
  }));

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Laser Cutter', { 'font-size': 11, fill: '#f59e0b' });
  return g;
}

export function drawInjectionMolder(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic machine-injection' });
  const def = ASSET_DEFS.machine_injection || { w: 210, h: 120 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // Heavy Machine Bed Base
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: h / 2 - 24, width: w, height: 24, rx: 2, fill: '#334155', stroke: '#1e293b', 'stroke-width': 1.5
  }));

  // Left Side: Clamping Unit & Tie Bars
  const clampW = w * 0.45;
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 10, y: -h / 2 + 16, width: 20, height: h - 42, rx: 2, fill: '#64748b'
  }));
  g.appendChild(svgEl('rect', {
    x: -w / 2 + clampW - 20, y: -h / 2 + 16, width: 20, height: h - 42, rx: 2, fill: '#64748b'
  }));
  [-15, 0, 15].forEach(by => {
    g.appendChild(svgEl('line', {
      x1: -w / 2 + 30, y1: by, x2: -w / 2 + clampW - 20, y2: by,
      stroke: '#cbd5e1', 'stroke-width': 3.5
    }));
  });
  g.appendChild(svgEl('rect', {
    x: -w / 2 + clampW / 2 - 8, y: -18, width: 16, height: 36, rx: 1.5, fill: theme.main
  }));

  // Right Side: Plasticizing Injection Barrel & Hopper
  const injX = -w / 2 + clampW + 10;
  const injW = w - clampW - 20;
  g.appendChild(svgEl('rect', {
    x: injX, y: -10, width: injW, height: 20, rx: 2, fill: '#475569', stroke: '#334155', 'stroke-width': 1
  }));
  [injX + 15, injX + 35, injX + 55].forEach(hx => {
    g.appendChild(svgEl('rect', {
      x: hx, y: -12, width: 10, height: 24, rx: 1, fill: '#f97316'
    }));
  });

  // Conical Resin Feed Hopper on Top
  g.appendChild(svgEl('polygon', {
    points: `${injX + injW - 28},${-10} ${injX + injW - 6},${-10} ${injX + injW - 2},${-h / 2 + 14} ${injX + injW - 32},${-h / 2 + 14}`,
    fill: '#f1f5f9', stroke: '#94a3b8', 'stroke-width': 1.5
  }));

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 16, theme, 'Injection Unit', { 'font-size': 11, fill: '#475569' });
  return g;
}

export function drawTwinTowerDryer(node) {
  const theme = getEquipmentTheme(node);
  const g = svgEl('g', { class: 'asset-graphic tank-twin-tower' });
  const def = ASSET_DEFS.tank_twin_tower || { w: 150, h: 210 };
  const w = node.w || def.w;
  const h = node.h || def.h;
  const colW = 44;
  const colH = 120;
  const gap = 20;
  const startX = -(colW + gap / 2);

  // Structural Base Skid
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: h / 2 - 20, width: w, height: 16, rx: 3, fill: '#334155', stroke: '#1e293b', 'stroke-width': 1.5
  }));

  // Tower A (Left) & Tower B (Right)
  [startX, gap / 2].forEach((tx, idx) => {
    g.appendChild(svgEl('rect', {
      x: tx, y: -colH / 2, width: colW, height: colH, rx: 12,
      fill: theme.main, stroke: theme.dark, 'stroke-width': 2
    }));
    g.appendChild(svgEl('line', {
      x1: tx, y1: -colH / 2 + 25, x2: tx + colW, y2: -colH / 2 + 25,
      stroke: theme.dark, 'stroke-width': 1.5, 'stroke-dasharray': '3 2'
    }));
    g.appendChild(svgEl('line', {
      x1: tx, y1: colH / 2 - 25, x2: tx + colW, y2: colH / 2 - 25,
      stroke: theme.dark, 'stroke-width': 1.5, 'stroke-dasharray': '3 2'
    }));
    const tBadge = svgEl('text', {
      x: tx + colW / 2, y: 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 900,
      fill: (theme.id === 'white' || theme.id === 'yellow') ? '#0f172a' : '#ffffff', 'font-family': 'JetBrains Mono, sans-serif'
    });
    tBadge.textContent = idx === 0 ? 'TOWER A' : 'TOWER B';
    g.appendChild(tBadge);
  });

  // Top Interconnecting Piping Manifold with Shuttle Valve
  g.appendChild(svgEl('path', {
    d: `M ${startX + colW / 2},${-colH / 2} L ${startX + colW / 2},${-colH / 2 - 18} L ${gap / 2 + colW / 2},${-colH / 2 - 18} L ${gap / 2 + colW / 2},${-colH / 2}`,
    fill: 'none', stroke: '#475569', 'stroke-width': 4, 'stroke-linecap': 'round'
  }));
  g.appendChild(svgEl('polygon', {
    points: `-8,${-colH / 2 - 24} 8,${-colH / 2 - 24} 0,${-colH / 2 - 12}`, fill: theme.main
  }));

  // Bottom Purge Exhaust Mufflers / Silencers
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 4, y: colH / 2 + 2, width: 14, height: 18, rx: 2, fill: '#475569'
  }));
  g.appendChild(svgEl('rect', {
    x: w / 2 - 18, y: colH / 2 + 2, width: 14, height: 18, rx: 2, fill: '#475569'
  }));

  // Label
  renderEquipmentTag(g, node, 0, h / 2 + 14, theme, 'Twin Towers', { 'font-size': 11, fill: '#475569' });
  return g;
}

export function drawStationaryDisplay(node) {
  const g = svgEl('g', { class: 'asset-graphic stationary-display' });
  const w = 106, h = 88;

  // 1. Molded White / Light Grey Wall Enclosure (Polycarbonate housing with ergonomic curved waist indent)
  const r = 10;
  const bodyD = `M ${-w / 2 + r},${-h / 2} L ${w / 2 - r},${-h / 2} A ${r} ${r} 0 0 1 ${w / 2},${-h / 2 + r} L ${w / 2},${-14} C ${w / 2 - 6},${-8} ${w / 2 - 6},${16} ${w / 2},${22} L ${w / 2},${h / 2 - r} A ${r} ${r} 0 0 1 ${w / 2 - r},${h / 2} L ${-w / 2 + r},${h / 2} A ${r} ${r} 0 0 1 ${-w / 2},${h / 2 - r} L ${-w / 2},${-h / 2 + r} A ${r} ${r} 0 0 1 ${-w / 2 + r},${-h / 2} Z`;
  g.appendChild(svgEl('path', {
    d: bodyD,
    fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 2,
    filter: 'url(#softCardShadow)'
  }));

  // Inner contour styling groove
  const inD = `M ${-w / 2 + r},${-h / 2 + 3.5} L ${w / 2 - r},${-h / 2 + 3.5} A ${r - 2} ${r - 2} 0 0 1 ${w / 2 - 3.5},${-h / 2 + r} L ${w / 2 - 3.5},${-13} C ${w / 2 - 8.5},${-7} ${w / 2 - 8.5},${15} ${w / 2 - 3.5},${21} L ${w / 2 - 3.5},${h / 2 - r} A ${r - 2} ${r - 2} 0 0 1 ${w / 2 - r},${h / 2 - 3.5} L ${-w / 2 + r},${h / 2 - 3.5} A ${r - 2} ${r - 2} 0 0 1 ${-w / 2 + 3.5},${h / 2 - r} L ${-w / 2 + 3.5},${-h / 2 + r} A ${r - 2} ${r - 2} 0 0 1 ${-w / 2 + r},${-h / 2 + 3.5} Z`;
  g.appendChild(svgEl('path', {
    d: inD,
    fill: 'none', stroke: '#f1f5f9', 'stroke-width': 1.5
  }));

  // 2. Four Corner Mounting Screws with Phillips Crossheads
  const screwOffsets = [
    [-w / 2 + 8, -h / 2 + 8],
    [w / 2 - 8, -h / 2 + 8],
    [-w / 2 + 8, h / 2 - 8],
    [w / 2 - 8, h / 2 - 8]
  ];
  screwOffsets.forEach(([sx, sy]) => {
    // Recessed outer circle
    g.appendChild(svgEl('circle', { cx: sx, cy: sy, r: 3.5, fill: '#e2e8f0', stroke: '#cbd5e1', 'stroke-width': 0.8 }));
    // Metallic screw head
    g.appendChild(svgEl('circle', { cx: sx, cy: sy, r: 2, fill: '#94a3b8' }));
    // Crosshead slot
    g.appendChild(svgEl('line', { x1: sx - 1.2, y1: sy, x2: sx + 1.2, y2: sy, stroke: '#475569', 'stroke-width': 0.8 }));
    g.appendChild(svgEl('line', { x1: sx, y1: sy - 1.2, x2: sx, y2: sy + 1.2, stroke: '#475569', 'stroke-width': 0.8 }));
  });

  // 3. Top Center Brand Logo: .SUTO (with green dot inside the O)
  const logoTxt = svgEl('text', {
    x: -6, y: -h / 2 + 15, 'text-anchor': 'middle',
    'font-size': 8.5, 'font-weight': 900, fill: '#0f172a',
    'font-family': 'JetBrains Mono, sans-serif'
  });
  logoTxt.textContent = '.SUT';
  g.appendChild(logoTxt);

  // SUTO 'O' with green center dot
  g.appendChild(svgEl('circle', { cx: 8, cy: -h / 2 + 12.5, r: 3.8, fill: 'none', stroke: '#0f172a', 'stroke-width': 1.6 }));
  g.appendChild(svgEl('circle', { cx: 8, cy: -h / 2 + 12.5, r: 1.8, fill: '#00a876' }));

  // 4. Main Multi-Touch Graphical Color Display Screen (Light / White Touchscreen as in real device)
  const scrX = -36;
  const scrY = -18;
  const scrW = 62;
  const scrH = 46;

  // Screen frame & bright white display surface
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY, width: scrW, height: scrH, rx: 2.5,
    fill: '#ffffff', stroke: '#94a3b8', 'stroke-width': 1.2
  }));

  // Top status / alarm banner
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY, width: scrW, height: 4.5, rx: 1, fill: '#f1f5f9'
  }));
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY, width: 22, height: 4.5, rx: 1, fill: '#f59e0b'
  }));
  // Small status indicator dots on top right
  g.appendChild(svgEl('circle', { cx: scrX + scrW - 14, cy: scrY + 2.5, r: 1.2, fill: '#64748b' }));
  g.appendChild(svgEl('circle', { cx: scrX + scrW - 9, cy: scrY + 2.5, r: 1.2, fill: '#64748b' }));
  g.appendChild(svgEl('circle', { cx: scrX + scrW - 4, cy: scrY + 2.5, r: 1.2, fill: '#10b981' }));

  // Light grid lines across white display
  g.appendChild(svgEl('line', {
    x1: scrX + 1, y1: scrY + 16, x2: scrX + 48, y2: scrY + 16,
    stroke: '#e2e8f0', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('line', {
    x1: scrX + 1, y1: scrY + 26, x2: scrX + 48, y2: scrY + 26,
    stroke: '#e2e8f0', 'stroke-width': 0.8
  }));

  // Multi-channel Trend Lines (High-contrast curves on light background)
  // Channel 1: Magenta / Rose
  g.appendChild(svgEl('path', {
    d: `M ${scrX + 2},${scrY + 12} L ${scrX + 10},${scrY + 9} L ${scrX + 20},${scrY + 14} L ${scrX + 32},${scrY + 8} L ${scrX + 46},${scrY + 11}`,
    fill: 'none', stroke: '#e11d48', 'stroke-width': 1.4, 'stroke-linecap': 'round'
  }));
  // Channel 2: Lime / Emerald Green
  g.appendChild(svgEl('path', {
    d: `M ${scrX + 2},${scrY + 18} L ${scrX + 12},${scrY + 21} L ${scrX + 24},${scrY + 17} L ${scrX + 34},${scrY + 22} L ${scrX + 46},${scrY + 18}`,
    fill: 'none', stroke: '#15803d', 'stroke-width': 1.4, 'stroke-linecap': 'round'
  }));
  // Channel 3: Cyan / Royal Blue
  g.appendChild(svgEl('path', {
    d: `M ${scrX + 2},${scrY + 29} L ${scrX + 14},${scrY + 28} L ${scrX + 26},${scrY + 32} L ${scrX + 36},${scrY + 27} L ${scrX + 46},${scrY + 30}`,
    fill: 'none', stroke: '#0284c7', 'stroke-width': 1.4, 'stroke-linecap': 'round'
  }));

  // Right Channel Legend Stack (clean light panel with colored indicator tags)
  const legX = scrX + scrW - 13;
  g.appendChild(svgEl('rect', {
    x: legX, y: scrY, width: 13, height: scrH, fill: '#f8fafc', stroke: '#e2e8f0', 'stroke-width': 0.8
  }));
  const legColors = ['#f97316', '#ef4444', '#10b981', '#0284c7'];
  legColors.forEach((lc, idx) => {
    g.appendChild(svgEl('rect', {
      x: legX + 1.5, y: scrY + 2 + idx * 8.5, width: 10, height: 6.5, rx: 1, fill: lc
    }));
  });

  // Bottom Screen Menu Bar
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY + scrH - 6.5, width: scrW, height: 6.5, fill: '#334155'
  }));
  // MENU yellow highlight tab
  g.appendChild(svgEl('rect', {
    x: scrX + 24, y: scrY + scrH - 6, width: 14, height: 5, rx: 1, fill: '#facc15'
  }));
  const menuTxt = svgEl('text', {
    x: scrX + 31, y: scrY + scrH - 2.2, 'text-anchor': 'middle',
    'font-size': 3.5, 'font-weight': 900, fill: '#0f172a',
    'font-family': 'sans-serif'
  });
  menuTxt.textContent = 'MENU';
  g.appendChild(menuTxt);

  // 5. Right Side Bright Yellow USB Port Rubber Cap (with USB trident)
  const usbX = 37;
  const usbY = 4;
  // Rubber tether tab at top
  g.appendChild(svgEl('path', {
    d: `M ${usbX - 2.5},${usbY - 14} C ${usbX - 2.5},${usbY - 18} ${usbX + 2.5},${usbY - 18} ${usbX + 2.5},${usbY - 14} L ${usbX + 2.5},${usbY - 6} L ${usbX - 2.5},${usbY - 6} Z`,
    fill: '#facc15', stroke: '#ca8a04', 'stroke-width': 0.8
  }));
  // Circular rubber cap
  g.appendChild(svgEl('circle', {
    cx: usbX, cy: usbY, r: 7.5, fill: '#facc15', stroke: '#ca8a04', 'stroke-width': 1
  }));
  // USB Trident symbol in black
  g.appendChild(svgEl('line', {
    x1: usbX, y1: usbY - 3, x2: usbX, y2: usbY + 3.5, stroke: '#0f172a', 'stroke-width': 0.9
  }));
  g.appendChild(svgEl('line', {
    x1: usbX - 3, y1: usbY - 0.5, x2: usbX + 3, y2: usbY - 0.5, stroke: '#0f172a', 'stroke-width': 0.9
  }));
  g.appendChild(svgEl('circle', { cx: usbX - 3, cy: usbY - 1.8, r: 0.8, fill: '#0f172a' }));
  g.appendChild(svgEl('circle', { cx: usbX + 3, cy: usbY - 1.8, r: 0.8, fill: '#0f172a' }));
  g.appendChild(svgEl('rect', { x: usbX - 0.8, y: usbY - 4.5, width: 1.6, height: 1.6, fill: '#0f172a' }));

  // 6. Bottom Flange Heavy-Duty PG Industrial Cable Glands (4 Glands)
  const glandX = [-30, -10, 10, 30];
  glandX.forEach((gx, idx) => {
    // Hexagonal mounting nut
    g.appendChild(svgEl('rect', {
      x: gx - 6, y: h / 2 - 2, width: 12, height: 4.5, rx: 1,
      fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 0.8
    }));
    // Compression dome nut
    g.appendChild(svgEl('rect', {
      x: gx - 5, y: h / 2 + 2.5, width: 10, height: 8.5, rx: 1.5,
      fill: '#e2e8f0', stroke: '#94a3b8', 'stroke-width': 0.8
    }));
    // Nut facet grooves
    g.appendChild(svgEl('line', { x1: gx - 2, y1: h / 2 + 3, x2: gx - 2, y2: h / 2 + 10, stroke: '#94a3b8', 'stroke-width': 0.6 }));
    g.appendChild(svgEl('line', { x1: gx + 2, y1: h / 2 + 3, x2: gx + 2, y2: h / 2 + 10, stroke: '#94a3b8', 'stroke-width': 0.6 }));
    // Rubber seal ring
    g.appendChild(svgEl('rect', {
      x: gx - 3.5, y: h / 2 + 11, width: 7, height: 3, rx: 1,
      fill: '#0f172a'
    }));
  });

  // Flexible Black Industrial Cables running out of the glands
  // Leftmost cable (curving outward left)
  g.appendChild(svgEl('path', {
    d: `M -30,${h / 2 + 14} Q -30,${h / 2 + 26} -42,${h / 2 + 38}`,
    fill: 'none', stroke: '#0f172a', 'stroke-width': 3.5, 'stroke-linecap': 'round'
  }));
  // Rightmost cable (curving outward right)
  g.appendChild(svgEl('path', {
    d: `M 30,${h / 2 + 14} Q 30,${h / 2 + 26} 42,${h / 2 + 38}`,
    fill: 'none', stroke: '#0f172a', 'stroke-width': 3.5, 'stroke-linecap': 'round'
  }));
  // Center connector plugs
  [-10, 10].forEach(gx => {
    g.appendChild(svgEl('circle', {
      cx: gx, cy: h / 2 + 14.5, r: 2.2, fill: '#0f172a'
    }));
  });

  // 7. Label
  renderEquipmentTag(g, node, 0, h / 2 + 36, null, 'Stationary Display', { 'font-size': 11, fill: '#475569' });

  return g;
}

export function drawCabinet(node) {
  return drawStationaryDisplay(node);
}

export function drawCase(node) {
  const g = svgEl('g', { class: 'asset-graphic portable-logger-case' });
  const w = 104;
  const lidH = 46;
  const baseH = 54;
  const lidY = -50;
  const baseY = 0;

  // 1. Top Open Lid (Heavy-duty black hard case shell standing vertically)
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: lidY, width: w, height: lidH, rx: 6,
    fill: '#18181b', stroke: '#09090b', 'stroke-width': 2
  }));

  // Top Lid Outer Latches (projecting upward from top rim)
  [-24, 24].forEach(lx => {
    g.appendChild(svgEl('rect', {
      x: lx - 5, y: lidY - 4, width: 10, height: 5, rx: 1.5,
      fill: '#27272a', stroke: '#09090b', 'stroke-width': 1
    }));
  });

  // Top Lid Inner Recessed Cavity
  g.appendChild(svgEl('rect', {
    x: -w / 2 + 6, y: lidY + 5, width: w - 12, height: lidH - 9, rx: 4,
    fill: '#0f172a', stroke: '#27272a', 'stroke-width': 1
  }));

  // Inner Lid Structural Ribs & Molded Indentations (as in Pelican lid)
  [-22, 22].forEach(cx => {
    g.appendChild(svgEl('circle', {
      cx: cx, cy: lidY + lidH / 2, r: 8, fill: '#18181b', stroke: '#1e293b', 'stroke-width': 0.8
    }));
  });
  g.appendChild(svgEl('rect', {
    x: -12, y: lidY + 9, width: 24, height: lidH - 17, rx: 2,
    fill: '#18181b', stroke: '#1e293b', 'stroke-width': 0.8
  }));

  // 2. Center Heavy-Duty Hinges
  [-30, 30].forEach(hx => {
    g.appendChild(svgEl('rect', {
      x: hx - 6, y: -4, width: 12, height: 6, rx: 1.5,
      fill: '#27272a', stroke: '#09090b', 'stroke-width': 1
    }));
  });

  // 3. Lower Main Unit Base (Black hard case base)
  g.appendChild(svgEl('rect', {
    x: -w / 2, y: baseY, width: w, height: baseH, rx: 6,
    fill: '#18181b', stroke: '#09090b', 'stroke-width': 2,
    filter: 'url(#softCardShadow)'
  }));

  // 4. Inset Anodized Aluminum Faceplate (Silver metallic deck)
  const panelX = -w / 2 + 5;
  const panelY = baseY + 4;
  const panelW = w - 10;
  const panelH = baseH - 8;
  g.appendChild(svgEl('rect', {
    x: panelX, y: panelY, width: panelW, height: panelH, rx: 3,
    fill: '#e2e8f0', stroke: '#94a3b8', 'stroke-width': 1.5
  }));

  // Corner Hex Bolts / Screws on faceplate
  [
    [panelX + 3, panelY + 3],
    [panelX + panelW - 3, panelY + 3],
    [panelX + 3, panelY + panelH - 3],
    [panelX + panelW - 3, panelY + panelH - 3],
    [0, panelY + 2],
    [0, panelY + panelH - 2]
  ].forEach(([bx, by]) => {
    g.appendChild(svgEl('circle', { cx: bx, cy: by, r: 1.2, fill: '#64748b' }));
  });

  // 5. Left Raised Display Console Module (White housing with SUTO logo)
  const conX = panelX + 4;
  const conY = panelY + 4;
  const conW = 54;
  const conH = panelH - 8;
  g.appendChild(svgEl('rect', {
    x: conX, y: conY, width: conW, height: conH, rx: 3.5,
    fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1
  }));

  // Brand Label on Top of Console
  const logoTxt = svgEl('text', {
    x: conX + conW / 2 - 4, y: conY + 7, 'text-anchor': 'middle',
    'font-size': 5.5, 'font-weight': 900, fill: '#0f172a',
    'font-family': 'JetBrains Mono, sans-serif'
  });
  logoTxt.textContent = 'SUTO';
  g.appendChild(logoTxt);

  // Color Touchscreen Display Screen (Bright White Industrial Screen)
  const scrX = conX + 4;
  const scrY = conY + 9;
  const scrW = 38;
  const scrH = conH - 12;
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY, width: scrW, height: scrH, rx: 1.5,
    fill: '#ffffff', stroke: '#94a3b8', 'stroke-width': 1
  }));

  // Screen Top Menu Bar
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY, width: scrW, height: 4.5, fill: '#0284c7'
  }));

  // Screen light grid line
  g.appendChild(svgEl('line', {
    x1: scrX + 1, y1: scrY + 16, x2: scrX + scrW - 1, y2: scrY + 16,
    stroke: '#e2e8f0', 'stroke-width': 0.8
  }));

  // Multi-channel Trend Lines / Waveforms (Cyan, Amber, Rose curves on white screen)
  g.appendChild(svgEl('path', {
    d: `M ${scrX + 2},${scrY + 12} L ${scrX + 10},${scrY + 8} L ${scrX + 20},${scrY + 14} L ${scrX + 28},${scrY + 7} L ${scrX + 36},${scrY + 10}`,
    fill: 'none', stroke: '#0284c7', 'stroke-width': 1.3, 'stroke-linecap': 'round'
  }));
  g.appendChild(svgEl('path', {
    d: `M ${scrX + 2},${scrY + 18} L ${scrX + 12},${scrY + 14} L ${scrX + 22},${scrY + 19} L ${scrX + 30},${scrY + 13} L ${scrX + 36},${scrY + 16}`,
    fill: 'none', stroke: '#e11d48', 'stroke-width': 1.3, 'stroke-linecap': 'round'
  }));

  // Screen Bottom Status / Navigation Bar
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY + scrH - 3.5, width: scrW, height: 3.5, fill: '#f1f5f9'
  }));

  // Yellow Circular Power/Operation Button (as seen in photo)
  const btnX = conX + conW - 6.5;
  const btnY = conY + conH / 2;
  g.appendChild(svgEl('circle', {
    cx: btnX, cy: btnY, r: 4, fill: '#facc15', stroke: '#ca8a04', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', {
    cx: btnX, cy: btnY, r: 2, fill: '#16a34a'
  }));

  // 6. Center Auxiliary Digital Display & Keylock
  const auxX = panelX + conW + 7;
  const auxY = panelY + 6;
  // Auxiliary LCD window (Reflective light LCD screen)
  g.appendChild(svgEl('rect', {
    x: auxX, y: auxY, width: 13, height: 9, rx: 1,
    fill: '#dcfce7', stroke: '#94a3b8', 'stroke-width': 0.8
  }));
  // Digits inside aux LCD
  g.appendChild(svgEl('line', {
    x1: auxX + 2.5, y1: auxY + 4.5, x2: auxX + 10.5, y2: auxY + 4.5, stroke: '#15803d', 'stroke-width': 1.5, 'stroke-dasharray': '2 1.5'
  }));

  // Pressure Port / Keylock below aux screen
  const portY = auxY + 18;
  g.appendChild(svgEl('circle', {
    cx: auxX + 6.5, cy: portY, r: 3.5, fill: '#94a3b8', stroke: '#475569', 'stroke-width': 1
  }));
  g.appendChild(svgEl('line', {
    x1: auxX + 6.5, y1: portY - 2, x2: auxX + 6.5, y2: portY + 2, stroke: '#1e293b', 'stroke-width': 1.2
  }));

  // 7. Right Wiring Schematic & Channel Terminal Plate
  const schX = panelX + panelW - 17;
  const schY = panelY + 5;
  const schW = 14;
  const schH = panelH - 10;
  g.appendChild(svgEl('rect', {
    x: schX, y: schY, width: schW, height: schH, rx: 1.5,
    fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 0.8
  }));

  // Terminal Diagram Schematic Lines & Socket Circles
  g.appendChild(svgEl('line', {
    x1: schX + 2, y1: schY + 5, x2: schX + schW - 2, y2: schY + 5, stroke: '#64748b', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', { cx: schX + 4.5, cy: schY + 10, r: 1.6, fill: '#0f172a', stroke: '#475569', 'stroke-width': 0.6 }));
  g.appendChild(svgEl('circle', { cx: schX + schW - 4.5, cy: schY + 10, r: 1.6, fill: '#0f172a', stroke: '#475569', 'stroke-width': 0.6 }));

  g.appendChild(svgEl('line', {
    x1: schX + 2, y1: schY + 16, x2: schX + schW - 2, y2: schY + 16, stroke: '#64748b', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', { cx: schX + 4.5, cy: schY + 21, r: 1.6, fill: '#0f172a', stroke: '#475569', 'stroke-width': 0.6 }));
  g.appendChild(svgEl('circle', { cx: schX + schW - 4.5, cy: schY + 21, r: 1.6, fill: '#0f172a', stroke: '#475569', 'stroke-width': 0.6 }));

  // Technical marking lines at bottom of schematic panel
  g.appendChild(svgEl('line', { x1: schX + 2, y1: schY + schH - 3, x2: schX + schW - 4, y2: schY + schH - 3, stroke: '#94a3b8', 'stroke-width': 0.6 }));

  // 8. Bottom Latches & Carry Handle
  [-24, 24].forEach(lx => {
    g.appendChild(svgEl('rect', {
      x: lx - 5, y: baseY + baseH - 3, width: 10, height: 5, rx: 1,
      fill: '#27272a', stroke: '#09090b', 'stroke-width': 1
    }));
  });

  // Heavy-Duty Molded Carry Handle
  g.appendChild(svgEl('path', {
    d: `M -18,${baseY + baseH} L -18,${baseY + baseH + 9} L 18,${baseY + baseH + 9} L 18,${baseY + baseH}`,
    fill: 'none', stroke: '#09090b', 'stroke-width': 5, 'stroke-linecap': 'round'
  }));

  // 9. Label
  renderEquipmentTag(g, node, 0, baseY + baseH + 22, null, 'Portable Logger', { 'font-size': 11, fill: '#475569' });

  return g;
}

export function drawDewPointMeter(node) {
  const g = svgEl('g', { class: 'asset-graphic dewpoint-meter' });
  const def = ASSET_DEFS['dewpoint_meter'] || { w: 52, h: 120 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Top M12 Electrical Connector Plug & Cable Gland
  g.appendChild(svgEl('rect', {
    x: -5, y: -58, width: 10, height: 8, rx: 1,
    fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 1
  }));
  g.appendChild(svgEl('circle', { cx: 0, cy: -58, r: 2.5, fill: '#09090b' }));

  // 2. Yellow Housing Top Head (SUTO S220 Signal Yellow Enclosure)
  const headPath = `M -18,-50 L 18,-50 L 20,-46 L 20,-16 L -20,-16 L -20,-46 Z`;
  g.appendChild(svgEl('path', {
    d: headPath,
    fill: '#fed72a', stroke: '#ca8a04', 'stroke-width': 1.6
  }));

  // Beveled corner line accents on yellow head
  g.appendChild(svgEl('line', { x1: -18, y1: -50, x2: -20, y2: -46, stroke: '#eab308', 'stroke-width': 1 }));
  g.appendChild(svgEl('line', { x1: 18, y1: -50, x2: 20, y2: -46, stroke: '#eab308', 'stroke-width': 1 }));

  // 3. Digital LCD Screen Display
  g.appendChild(svgEl('rect', {
    x: -15, y: -44, width: 30, height: 18, rx: 2,
    fill: '#0f172a', stroke: '#334155', 'stroke-width': 1
  }));
  // Reading: -49.2 °C Td
  const valText = svgEl('text', {
    x: -12, y: -32, 'font-size': 7.5, 'font-weight': 900,
    fill: '#38bdf8', 'font-family': 'JetBrains Mono, monospace'
  });
  valText.textContent = '--.-';
  g.appendChild(valText);

  const unitText = svgEl('text', {
    x: 12, y: -33, 'text-anchor': 'end', 'font-size': 4.5, 'font-weight': 700,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  unitText.textContent = '°C Td';
  g.appendChild(unitText);

  // Minor status line in display
  g.appendChild(svgEl('line', {
    x1: -13, y1: -28, x2: 13, y2: -28,
    stroke: '#0284c7', 'stroke-width': 0.8
  }));

  // 4. Stainless Steel Socket Screw on yellow body
  g.appendChild(svgEl('circle', {
    cx: 0, cy: -20, r: 2.2,
    fill: '#cbd5e1', stroke: '#64748b', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', {
    cx: 0, cy: -20, r: 1, fill: '#475569'
  }));

  // 5. Stainless Steel Transition Neck
  g.appendChild(svgEl('rect', {
    x: -11, y: -16, width: 22, height: 6,
    fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 1
  }));

  // 6. Hexagonal Mounting Nut (Wrench Flats for Installation)
  g.appendChild(svgEl('rect', {
    x: -15, y: -10, width: 30, height: 12, rx: 1,
    fill: '#e2e8f0', stroke: '#94a3b8', 'stroke-width': 1.2
  }));
  // Hex facet vertical lines
  g.appendChild(svgEl('line', { x1: -7, y1: -10, x2: -7, y2: 2, stroke: '#94a3b8', 'stroke-width': 1 }));
  g.appendChild(svgEl('line', { x1: 7, y1: -10, x2: 7, y2: 2, stroke: '#94a3b8', 'stroke-width': 1 }));

  // 7. Cylindrical Body with SUTO Identification Label
  g.appendChild(svgEl('rect', {
    x: -10, y: 2, width: 20, height: 14,
    fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 1
  }));
  // SUTO Label badge
  g.appendChild(svgEl('rect', {
    x: -8, y: 4, width: 16, height: 10, rx: 0.5,
    fill: '#ffffff', stroke: '#94a3b8', 'stroke-width': 0.6
  }));
  const sutoTxt = svgEl('text', {
    x: 0, y: 11, 'text-anchor': 'middle', 'font-size': 4.5, 'font-weight': 900,
    fill: '#0f172a', 'font-family': 'JetBrains Mono, monospace'
  });
  sutoTxt.textContent = '.SUTO';
  g.appendChild(sutoTxt);

  // 8. Process Connection Thread (G 1/2" Male Thread)
  g.appendChild(svgEl('rect', {
    x: -9, y: 16, width: 18, height: 14,
    fill: '#94a3b8', stroke: '#64748b', 'stroke-width': 1
  }));
  [19, 22, 25, 28].forEach(ty => {
    g.appendChild(svgEl('line', {
      x1: -9, y1: ty, x2: 9, y2: ty,
      stroke: '#e2e8f0', 'stroke-width': 1
    }));
  });

  // 9. Sintered Stainless Steel Porous Filter Cap (Probe Tip)
  g.appendChild(svgEl('rect', {
    x: -7, y: 30, width: 14, height: 26, rx: 2.5,
    fill: '#94a3b8', stroke: '#475569', 'stroke-width': 1.2
  }));
  [-4, 0, 4].forEach(px => {
    [35, 41, 47, 52].forEach(py => {
      g.appendChild(svgEl('circle', {
        cx: px, cy: py, r: 0.8, fill: '#334155'
      }));
    });
  });

  // 10. Tag / Label (Shown at top of sensor)
  renderEquipmentTag(g, node, 0, -64, null, 'Dew Point Meter', { 'font-size': 11, fill: '#475569' });

  return g;
}

export function drawLeakDetector(node) {
  const g = svgEl('g', { class: 'asset-graphic leak-detector' });
  const def = ASSET_DEFS['leak_detection'] || { w: 64, h: 124 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Top Acoustic Focus Horn / Parabolic Sensor Funnel
  const hornPath = `M -8,-32 L -18,-54 L 18,-54 L 8,-32 Z`;
  g.appendChild(svgEl('path', {
    d: hornPath,
    fill: '#0f172a', stroke: '#334155', 'stroke-width': 1.4
  }));
  // Acoustic horn lip & inner opening
  g.appendChild(svgEl('ellipse', {
    cx: 0, cy: -54, rx: 18, ry: 4,
    fill: '#1e293b', stroke: '#475569', 'stroke-width': 1.2
  }));
  // Central ultrasonic microphone pickup sensor
  g.appendChild(svgEl('circle', {
    cx: 0, cy: -46, r: 3,
    fill: '#94a3b8', stroke: '#cbd5e1', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', { cx: 0, cy: -46, r: 1.2, fill: '#09090b' }));

  // 2. Handheld Main Upper Housing (Ergonomic Casing)
  g.appendChild(svgEl('rect', {
    x: -24, y: -32, width: 48, height: 50, rx: 5,
    fill: '#18181b', stroke: '#334155', 'stroke-width': 1.5
  }));

  // 3. High-Resolution Color Graphic Screen
  g.appendChild(svgEl('rect', {
    x: -19, y: -28, width: 38, height: 26, rx: 2,
    fill: '#020617', stroke: '#1e293b', 'stroke-width': 1
  }));
  // Cyan / Blue Status Banner
  g.appendChild(svgEl('rect', {
    x: -19, y: -28, width: 38, height: 5, rx: 1,
    fill: '#0284c7'
  }));
  const modelTxt = svgEl('text', {
    x: -16, y: -24.2, 'font-size': 3.8, 'font-weight': 900,
    fill: '#ffffff', 'font-family': 'JetBrains Mono, monospace'
  });
  modelTxt.textContent = 'SUTO S530';
  g.appendChild(modelTxt);

  // Leak Rating Pyramid / Decibel Intensity Bars
  const barColors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
  barColors.forEach((color, i) => {
    const bh = 3 + i * 2.5;
    g.appendChild(svgEl('rect', {
      x: -16 + i * 4, y: -8 - bh, width: 3, height: bh, rx: 0.5,
      fill: color
    }));
  });

  // Decibel Reading Text
  const dbTxt = svgEl('text', {
    x: 6, y: -14, 'text-anchor': 'middle', 'font-size': 6.5, 'font-weight': 900,
    fill: '#22c55e', 'font-family': 'JetBrains Mono, monospace'
  });
  dbTxt.textContent = '-- dB';
  g.appendChild(dbTxt);

  const leakTxt = svgEl('text', {
    x: 6, y: -8, 'text-anchor': 'middle', 'font-size': 4, 'font-weight': 700,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  leakTxt.textContent = 'STANDBY';
  g.appendChild(leakTxt);

  // 4. Pushbutton Keypad: Yellow Action Buttons & D-Pad
  [-13, 0, 13].forEach(bx => {
    g.appendChild(svgEl('circle', {
      cx: bx, cy: 4, r: 2.8,
      fill: '#fed72a', stroke: '#ca8a04', 'stroke-width': 0.8
    }));
    g.appendChild(svgEl('circle', {
      cx: bx, cy: 4, r: 1.2, fill: '#09090b'
    }));
  });
  // Navigation Pad / Cross key
  g.appendChild(svgEl('circle', {
    cx: 0, cy: 12, r: 4,
    fill: '#27272a', stroke: '#3f3f46', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', {
    cx: 0, cy: 12, r: 1.5, fill: '#52525b'
  }));

  // 5. Ergonomic Pistol Grip Handle (Lower Section)
  const handlePath = `M -10,18 L -14,48 A 4 4 0 0 0 -10,54 L 10,54 A 4 4 0 0 0 14,48 L 10,18 Z`;
  g.appendChild(svgEl('path', {
    d: handlePath,
    fill: '#09090b', stroke: '#18181b', 'stroke-width': 1.2
  }));

  // Finger Grip Ridges / Rubber Texture on handle
  [26, 33, 40, 47].forEach(gy => {
    g.appendChild(svgEl('line', {
      x1: -10, y1: gy, x2: 10, y2: gy,
      stroke: '#27272a', 'stroke-width': 1.2
    }));
  });

  // Lanyard Strap Eyelet at base
  g.appendChild(svgEl('circle', {
    cx: 0, cy: 51, r: 2,
    fill: '#334155', stroke: '#475569', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('circle', { cx: 0, cy: 51, r: 1, fill: '#09090b' }));

  // 6. Tag / Label
  renderEquipmentTag(g, node, 0, 68, null, 'Leak Detection', { 'font-size': 11, fill: '#475569' });

  return g;
}

export function drawCompactFlowMeter(node) {
  const g = svgEl('g', { class: 'asset-graphic compact-flow-meter' });
  const def = ASSET_DEFS['compact_flow_meter'] || { w: 124, h: 80 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Horizontal Process Pipes & Union Fittings (Round Stainless Pipe Running Straight Through)
  const pipeY = 17;
  // Left extension pipe
  g.appendChild(svgEl('rect', {
    x: -60, y: pipeY - 6, width: 22, height: 12, rx: 1,
    fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 1
  }));
  g.appendChild(svgEl('line', {
    x1: -60, y1: pipeY - 2, x2: -38, y2: pipeY - 2,
    stroke: '#ffffff', 'stroke-width': 1.2
  }));

  // Right extension pipe
  g.appendChild(svgEl('rect', {
    x: 38, y: pipeY - 6, width: 22, height: 12, rx: 1,
    fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 1
  }));
  g.appendChild(svgEl('line', {
    x1: 38, y1: pipeY - 2, x2: 60, y2: pipeY - 2,
    stroke: '#ffffff', 'stroke-width': 1.2
  }));

  // Left Threaded Union Hex Nut
  g.appendChild(svgEl('rect', {
    x: -43, y: pipeY - 9, width: 8, height: 18, rx: 1,
    fill: '#94a3b8', stroke: '#64748b', 'stroke-width': 1.2
  }));
  g.appendChild(svgEl('line', { x1: -39, y1: pipeY - 9, x2: -39, y2: pipeY + 9, stroke: '#cbd5e1', 'stroke-width': 0.8 }));

  // Right Threaded Union Hex Nut
  g.appendChild(svgEl('rect', {
    x: 35, y: pipeY - 9, width: 8, height: 18, rx: 1,
    fill: '#94a3b8', stroke: '#64748b', 'stroke-width': 1.2
  }));
  g.appendChild(svgEl('line', { x1: 39, y1: pipeY - 9, x2: 39, y2: pipeY + 9, stroke: '#cbd5e1', 'stroke-width': 0.8 }));

  // 2. Bottom Part: Solid Stainless Steel Square/Rectangular Pipe Block
  const blockX = -36;
  const blockY = 5;
  const blockW = 72;
  const blockH = 24;

  // Top Chamfer / Bevel Rim of the stainless block
  const bevelPath = `M ${blockX},${blockY + 3} L ${blockX + 2},${blockY} L ${blockX + blockW - 2},${blockY} L ${blockX + blockW},${blockY + 3} Z`;
  g.appendChild(svgEl('path', {
    d: bevelPath,
    fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 0.8
  }));

  // Front vertical face of the stainless block
  g.appendChild(svgEl('rect', {
    x: blockX, y: blockY + 3, width: blockW, height: blockH - 3, rx: 1,
    fill: '#94a3b8', stroke: '#64748b', 'stroke-width': 1.4
  }));

  // Horizontal brushed metal hairline texture on the stainless steel block
  [blockY + 8, blockY + 15, blockY + 22].forEach(ly => {
    g.appendChild(svgEl('line', {
      x1: blockX + 2, y1: ly, x2: blockX + blockW - 2, y2: ly,
      stroke: '#cbd5e1', 'stroke-width': 0.7
    }));
  });

  // 3. Top Part: Molded White Housing
  // Sits directly on top of the stainless steel block
  const caseLeft = -25;
  const caseRight = 24;
  const caseBottom = blockY + 1; // y = 6
  const caseTop = -32;
  const caseMidY = -12;

  // Vertical front face of white casing with curved / sloped right shoulder
  const frontPath = `M ${caseLeft},${caseBottom} L ${caseLeft},${caseMidY} L ${caseRight - 8},${caseMidY} Q ${caseRight},${caseMidY} ${caseRight},${caseMidY + 6} L ${caseRight},${caseBottom} Z`;
  g.appendChild(svgEl('path', {
    d: frontPath,
    fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 1.4
  }));

  // Three Embossed Directional Chevrons on front face of the white casing ( > > > )
  [-11, 0, 11].forEach(cx => {
    g.appendChild(svgEl('path', {
      d: `M ${cx - 4},${caseMidY + 5} L ${cx + 2},${caseMidY + 10} L ${cx - 4},${caseMidY + 15}`,
      fill: 'none', stroke: '#cbd5e1', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
    g.appendChild(svgEl('path', {
      d: `M ${cx - 4},${caseMidY + 5} L ${cx + 2},${caseMidY + 10} L ${cx - 4},${caseMidY + 15}`,
      fill: 'none', stroke: '#ffffff', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
  });

  // 4. Slanted Top Deck / Top Face with Digital Display
  const deckPath = `M ${caseLeft},${caseMidY} L ${caseLeft + 2},${caseTop} L ${caseRight - 8},${caseTop} Q ${caseRight},${caseTop} ${caseRight - 2},${caseTop + 6} L ${caseRight - 8},${caseMidY} Z`;
  g.appendChild(svgEl('path', {
    d: deckPath,
    fill: '#ffffff', stroke: '#cbd5e1', 'stroke-width': 1.4
  }));

  // Yellow SUTO Brand Badge on Left Side of Top Deck
  const badgeX = caseLeft + 4;
  const badgeY = caseTop + 2.5;
  const badgeW = 9;
  const badgeH = 15;
  g.appendChild(svgEl('rect', {
    x: badgeX, y: badgeY, width: badgeW, height: badgeH, rx: 1.5,
    fill: '#fed72a', stroke: '#ca8a04', 'stroke-width': 0.8
  }));

  // Rotated .SUTO Brand Text inside Yellow Badge
  const badgeG = svgEl('g', { transform: `translate(${badgeX + badgeW / 2}, ${badgeY + badgeH / 2}) rotate(-90)` });
  const sutoTxt = svgEl('text', {
    x: 0, y: 1.8, 'text-anchor': 'middle', 'font-size': 4.5, 'font-weight': 900,
    fill: '#0f172a', 'font-family': 'JetBrains Mono, monospace'
  });
  sutoTxt.textContent = '.SUTO';
  badgeG.appendChild(sutoTxt);
  g.appendChild(badgeG);

  // Black Digital LED Screen on Right Side of Top Deck
  const scrX = badgeX + badgeW + 3;
  const scrY = badgeY;
  const scrW = 26;
  const scrH = 15;
  g.appendChild(svgEl('rect', {
    x: scrX, y: scrY, width: scrW, height: scrH, rx: 1.8,
    fill: '#09090b', stroke: '#27272a', 'stroke-width': 0.9
  }));

  // Screen Header & Footer Micro Labels (Rec. / lpm / Stat. / bar)
  const recTxt = svgEl('text', {
    x: scrX + 2, y: scrY + 3.2, 'font-size': 2.4, 'font-weight': 700,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  recTxt.textContent = 'Rec.';
  g.appendChild(recTxt);

  const lpmTxt = svgEl('text', {
    x: scrX + scrW - 2, y: scrY + 3.2, 'text-anchor': 'end', 'font-size': 2.6, 'font-weight': 800,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  lpmTxt.textContent = 'lpm';
  g.appendChild(lpmTxt);

  const statTxt = svgEl('text', {
    x: scrX + 2, y: scrY + scrH - 1.8, 'font-size': 2.4, 'font-weight': 700,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  statTxt.textContent = 'Stat.';
  g.appendChild(statTxt);

  const barTxt = svgEl('text', {
    x: scrX + scrW - 2, y: scrY + scrH - 1.8, 'text-anchor': 'end', 'font-size': 2.6, 'font-weight': 800,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  barTxt.textContent = 'bar';
  g.appendChild(barTxt);

  // Bright Red 7-Segment Digital Flow Readout: 183.6
  const ledTxt = svgEl('text', {
    x: scrX + scrW / 2, y: scrY + scrH / 2 + 2.5, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 900,
    fill: '#ef4444', 'font-family': 'JetBrains Mono, monospace', 'letter-spacing': '0.5px'
  });
  ledTxt.textContent = '---.-';
  g.appendChild(ledTxt);

  // Status LED dot indicator
  g.appendChild(svgEl('circle', {
    cx: scrX + scrW - 2.5, cy: scrY + scrH / 2, r: 0.8, fill: '#ef4444'
  }));

  // 5. Left Side Electrical Connectors (M12 Plug & Ground Port)
  g.appendChild(svgEl('rect', {
    x: caseLeft - 3, y: -9, width: 3, height: 6, rx: 0.5,
    fill: '#cbd5e1', stroke: '#64748b', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('rect', {
    x: caseLeft - 13, y: -10, width: 10, height: 8, rx: 1.5,
    fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 0.8
  }));
  g.appendChild(svgEl('path', {
    d: `M ${caseLeft - 13},-6 C ${caseLeft - 22},-6 ${caseLeft - 24},2 ${caseLeft - 24},14 L ${caseLeft - 24},32`,
    fill: 'none', stroke: '#18181b', 'stroke-width': 1.8, 'stroke-linecap': 'round'
  }));

  g.appendChild(svgEl('rect', {
    x: caseLeft - 2.5, y: -1, width: 2.5, height: 4, rx: 0.5,
    fill: '#94a3b8', stroke: '#64748b', 'stroke-width': 0.6
  }));

  // 6. Tag / Label
  renderEquipmentTag(g, node, 0, 40, null, 'Compact Flow', { 'font-size': 11, fill: '#475569' });

  return g;
}

export function drawFlowMeter(node) {
  const g = svgEl('g', { class: 'asset-graphic flow-meter' });
  const def = ASSET_DEFS['flow_meter'] || { w: 56, h: 160 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  // 1. Top Transmitter Head (White Beveled Enclosure)
  const headPath = `M -18,-74 L 18,-74 L 22,-68 L 22,-26 L -22,-26 L -22,-68 Z`;
  g.appendChild(svgEl('path', {
    d: headPath,
    fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 1.6
  }));

  // Dual Yellow Accent Stripes (Signature SUTO S401 Design)
  g.appendChild(svgEl('rect', {
    x: -21, y: -68, width: 42, height: 3.5,
    fill: '#fed72a'
  }));
  g.appendChild(svgEl('rect', {
    x: -21, y: -34, width: 42, height: 3.5,
    fill: '#fed72a'
  }));

  // 2. Integrated Digital Graphic Display
  g.appendChild(svgEl('rect', {
    x: -16, y: -62, width: 32, height: 21, rx: 2,
    fill: '#0f172a', stroke: '#334155', 'stroke-width': 1
  }));

  // Primary Flow Reading: 37.3
  const flowTxt = svgEl('text', {
    x: -12, y: -50, 'font-size': 7.5, 'font-weight': 900,
    fill: '#38bdf8', 'font-family': 'JetBrains Mono, monospace'
  });
  flowTxt.textContent = '--.-';
  g.appendChild(flowTxt);

  // Unit: m³/h
  const unitTxt = svgEl('text', {
    x: 13, y: -50, 'text-anchor': 'end', 'font-size': 4.5, 'font-weight': 700,
    fill: '#94a3b8', 'font-family': 'JetBrains Mono, monospace'
  });
  unitTxt.textContent = 'm³/h';
  g.appendChild(unitTxt);

  // Secondary line: --.- bar
  const secTxt = svgEl('text', {
    x: -12, y: -43.5, 'font-size': 4.2, 'font-weight': 700,
    fill: '#22c55e', 'font-family': 'JetBrains Mono, monospace'
  });
  secTxt.textContent = '--.- bar';
  g.appendChild(secTxt);

  // 3. SUTO Brand Name below display
  const logoTxt = svgEl('text', {
    x: 0, y: -28, 'text-anchor': 'middle', 'font-size': 4.5, 'font-weight': 900,
    fill: '#0f172a', 'font-family': 'JetBrains Mono, monospace'
  });
  logoTxt.textContent = '.SUTO';
  g.appendChild(logoTxt);

  // 4. Hex Locking Collar Nut & Safety Ring
  g.appendChild(svgEl('rect', {
    x: -12, y: -26, width: 24, height: 12, rx: 1,
    fill: '#e2e8f0', stroke: '#94a3b8', 'stroke-width': 1.2
  }));
  g.appendChild(svgEl('line', { x1: -4, y1: -26, x2: -4, y2: -14, stroke: '#94a3b8', 'stroke-width': 1 }));
  g.appendChild(svgEl('line', { x1: 4, y1: -26, x2: 4, y2: -14, stroke: '#94a3b8', 'stroke-width': 1 }));

  // Blue safety locking lever / ring
  g.appendChild(svgEl('rect', {
    x: -15, y: -19, width: 6, height: 3, rx: 1,
    fill: '#0284c7', stroke: '#0369a1', 'stroke-width': 0.6
  }));

  // 5. Long Stainless Steel Insertion Probe Shaft (with etched measurement scale)
  g.appendChild(svgEl('rect', {
    x: -4, y: -14, width: 8, height: 60,
    fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 1
  }));

  // Etched millimeter / centimeter scale markings along probe shaft
  for (let sy = -10; sy <= 42; sy += 5) {
    const isMajor = (sy % 10 === 0);
    g.appendChild(svgEl('line', {
      x1: isMajor ? -3 : 0, y1: sy, x2: 3, y2: sy,
      stroke: '#475569', 'stroke-width': isMajor ? 0.9 : 0.6
    }));
  }

  // 6. Process Connection Fitting (G 1/2" Ball Valve Adapter / Union Nut)
  g.appendChild(svgEl('rect', {
    x: -13, y: 46, width: 26, height: 18, rx: 1.5,
    fill: '#94a3b8', stroke: '#64748b', 'stroke-width': 1.2
  }));
  // Knurled grips on adapter nut
  [-8, -4, 0, 4, 8].forEach(nx => {
    g.appendChild(svgEl('line', {
      x1: nx, y1: 47, x2: nx, y2: 63,
      stroke: '#cbd5e1', 'stroke-width': 0.8
    }));
  });

  // 7. Sensor Tip with Dual Thermal Pin Elements
  g.appendChild(svgEl('rect', {
    x: -3, y: 64, width: 6, height: 8, rx: 1,
    fill: '#cbd5e1', stroke: '#64748b', 'stroke-width': 0.8
  }));
  // Heated sensor pin & reference temperature pin
  g.appendChild(svgEl('circle', {
    cx: -1.5, cy: 71, r: 1.2, fill: '#ef4444'
  }));
  g.appendChild(svgEl('circle', {
    cx: 1.5, cy: 71, r: 1.2, fill: '#38bdf8'
  }));

  // 8. Tag / Label (Shown at top of sensor)
  renderEquipmentTag(g, node, 0, -80, null, 'Flow Meter', { 'font-size': 11, fill: '#475569' });

  return g;
}

export function drawExZone(node) {
  const g = svgEl('g', { class: 'asset-graphic' });
  const w = 240, h = 240;

  g.appendChild(svgEl('rect', {
    x: -w / 2, y: -h / 2, width: w, height: h, rx: 8,
    fill: 'none', stroke: '#94a3b8', 'stroke-width': 1.5, 'stroke-dasharray': '8 6'
  }));

  const hex = svgEl('polygon', {
    points: `-70,55 -55,45 -35,45 -20,55 -35,65 -55,65`,
    fill: '#ffffff', stroke: '#0f172a', 'stroke-width': 2.5
  });
  const exTxt = svgEl('text', {
    x: -45, y: 59, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 900,
    fill: '#0f172a', 'font-family': 'sans-serif'
  });
  exTxt.textContent = 'Ex';
  g.appendChild(hex);
  g.appendChild(exTxt);
  return g;
}

export function renderBrickMasonry(x, y, w, h, opts = {}) {
  const g = svgEl('g', { class: 'brick-masonry' });
  const bW = opts.brickW || 14;
  const bH = opts.brickH || 7;
  const mortar = opts.mortar || 1;
  const brickColors = ['#c2410c', '#b91c1c', '#9a3412', '#a1441a', '#b43a0e', '#ea580c'];

  g.appendChild(svgEl('rect', {
    x: x, y: y, width: w, height: h, fill: '#cbd5e1'
  }));

  const numRows = Math.floor((h - mortar) / (bH + mortar));
  for (let r = 0; r <= numRows; r++) {
    const curY = y + mortar + r * (bH + mortar);
    if (curY >= y + h) break;
    const actualH = Math.min(bH, (y + h) - curY);
    if (actualH <= 0.5) continue;

    const isOdd = (r % 2 === 1);
    const xStart = isOdd ? -(bW / 2) : 0;
    const numCols = Math.ceil((w - xStart) / (bW + mortar)) + 1;

    for (let c = 0; c < numCols; c++) {
      const curX = x + xStart + c * (bW + mortar);
      const bx1 = Math.max(x, curX);
      const bx2 = Math.min(x + w, curX + bW);
      if (bx2 > bx1 + 0.5) {
        const cIdx = Math.abs((r * 4 + c * 7 + (isOdd ? 2 : 0)) % brickColors.length);
        g.appendChild(svgEl('rect', {
          x: bx1, y: curY, width: bx2 - bx1, height: actualH,
          fill: brickColors[cIdx], rx: 0.5
        }));
      }
    }
  }
  return g;
}

export function drawBrickWallH(node) {
  const g = svgEl('g', { class: 'asset-graphic wall-perimeter-h' });
  const def = ASSET_DEFS.wall_perimeter_h || { w: 220, h: 36 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  g.appendChild(renderBrickMasonry(-w / 2, -h / 2, w, h, { brickW: 14, brickH: 7, mortar: 1 }));

  renderEquipmentTag(g, node, 0, h / 2 + 13, null, '', { 'font-size': 9, fill: '#64748b' });
  return g;
}

export function drawBrickWallV(node) {
  const g = svgEl('g', { class: 'asset-graphic wall-perimeter-v' });
  const def = ASSET_DEFS.wall_perimeter_v || { w: 36, h: 220 };
  const w = node.w || def.w;
  const h = node.h || def.h;

  g.appendChild(renderBrickMasonry(-w / 2, -h / 2, w, h, { brickW: 14, brickH: 7, mortar: 1 }));

  renderEquipmentTag(g, node, 0, h / 2 + 13, null, '', { 'font-size': 9, fill: '#64748b' });
  return g;
}

// Aliases
export const drawCryogenicVessel = drawCryogenicTank;
export const drawMoistureSeparator = drawSeparatorTank;
export const drawCncMachine = drawCNCMachine;

// --- Node Renderer ---
export function renderAssetNode(node, selectedIds = new Set(), pipes = [], showAnchorLine = true) {
  const isSel = selectedIds.has(node.id);

  if (node.type === 'text_note') {
    const tG = svgEl('g', {
      class: `plant-text-group ${isSel ? 'selected' : ''}`,
      'data-text-id': node.id,
      transform: `translate(${node.x}, ${node.y})`,
      cursor: 'move'
    });

    const noteColor = node.color || '#64748b';
    const box = measureTextNoteBox(node);

    // Hit-test background / outline border
    const borderAttrs = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: box.outlineStyle === 'pill' ? Math.round(box.height / 2) : (box.outlineStyle === 'double' ? 4 : 3),
      fill: box.outlineStyle === 'pill' ? 'rgba(15, 23, 42, 0.03)' : 'transparent',
      stroke: box.hasBorder ? noteColor : 'none',
      'stroke-width': box.outlineStyle === 'dotted' ? 1.4 : (box.outlineStyle === 'double' ? 1 : (box.hasBorder ? 1.1 : 0))
    };
    if (box.outlineStyle === 'dotted') {
      borderAttrs['stroke-dasharray'] = '1.5 3';
      borderAttrs['stroke-linecap'] = 'round';
    } else if (box.outlineStyle === 'dashed') {
      borderAttrs['stroke-dasharray'] = '5 3';
    }
    tG.appendChild(svgEl('rect', borderAttrs));

    if (box.outlineStyle === 'double') {
      tG.appendChild(svgEl('rect', {
        x: box.x + 2.5,
        y: box.y + 2.5,
        width: Math.max(4, box.width - 5),
        height: Math.max(4, box.height - 5),
        rx: 2,
        fill: 'none',
        stroke: noteColor,
        'stroke-width': 0.9,
        'pointer-events': 'none'
      }));
    }

    const txtEl = svgEl('text', {
      x: 0,
      y: 0,
      fill: noteColor,
      'font-size': box.fontSize,
      'font-weight': 700,
      'font-family': 'JetBrains Mono, sans-serif'
    });
    box.lines.forEach((lineStr, lineIdx) => {
      const tspan = svgEl('tspan', {
        x: 0,
        dy: lineIdx === 0 ? 0 : box.lineHeight
      });
      tspan.textContent = lineStr === '' ? '\u00A0' : lineStr;
      txtEl.appendChild(tspan);
    });
    tG.appendChild(txtEl);

    // Dotted line connecting anchor point to the pipe branch (shown in modify/editor mode only)
    if (showAnchorLine && node.attachedPipeId && node.pipeT != null) {
      const pipe = pipes.find(p => p.id === node.attachedPipeId);
      if (pipe) {
        const contactPt = getPointAlongPipe(pipe, node.pipeT);
        if (contactPt) {
          const relX = contactPt.x - node.x;
          const relY = contactPt.y - node.y;
          if (Math.hypot(relX, relY) > 4) {
            tG.appendChild(svgEl('line', {
              class: 'element-anchor-line',
              'data-element-id': node.id,
              x1: 0, y1: 0, x2: relX, y2: relY,
              stroke: isSel ? '#00ac86' : '#94a3b8',
              'stroke-width': isSel ? 2 : 1.5,
              'stroke-dasharray': '4 3',
              'pointer-events': 'none'
            }));
          }
        }
      }
    }

    if (isSel) {
      tG.appendChild(svgEl('rect', {
        x: box.x - 3,
        y: box.y - 3,
        width: box.width + 6,
        height: box.height + 6,
        rx: 4,
        fill: 'rgba(0, 168, 118, 0.08)',
        stroke: '#00a876',
        'stroke-width': 1.5,
        'stroke-dasharray': '3 2',
        'pointer-events': 'none'
      }));

      const anchorG = svgEl('g', {
        class: 'element-anchor-handle',
        'data-element-id': node.id,
        transform: 'translate(0, 0)',
        style: 'cursor: grab;'
      });
      anchorG.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 16, fill: 'transparent' }));
      anchorG.appendChild(svgEl('circle', { class: 'anchor-handle-core', cx: 0, cy: 0, r: 6.5, fill: '#00ac86', stroke: '#ffffff', 'stroke-width': 2 }));
      anchorG.appendChild(svgEl('line', { x1: -3, y1: 0, x2: 3, y2: 0, stroke: '#ffffff', 'stroke-width': 1.2 }));
      anchorG.appendChild(svgEl('line', { x1: 0, y1: -3, x2: 0, y2: 3, stroke: '#ffffff', 'stroke-width': 1.2 }));
      tG.appendChild(anchorG);
    }
    return tG;
  }

  const g = svgEl('g', {
    class: `plant-node ${isSel ? 'selected' : ''}`,
    'data-node-id': node.id,
    transform: `translate(${node.x}, ${node.y})`
  });

  // 1. Dotted line for anchor point connecting to attached pipe branch (shown in modify/editor mode only)
  if (showAnchorLine && node.attachedPipeId && node.pipeT != null) {
    const pipe = pipes.find(p => p.id === node.attachedPipeId);
    if (pipe) {
      const contactPt = getPointAlongPipe(pipe, node.pipeT);
      if (contactPt) {
        const relX = contactPt.x - node.x;
        const relY = contactPt.y - node.y;
        if (Math.hypot(relX, relY) > 6) {
          g.appendChild(svgEl('line', {
            class: 'element-anchor-line',
            'data-element-id': node.id,
            x1: 0, y1: 0, x2: relX, y2: relY,
            stroke: isSel ? '#00ac86' : '#94a3b8',
            'stroke-width': isSel ? 2 : 1.5,
            'stroke-dasharray': '4 3',
            'pointer-events': 'none'
          }));
        }
      }
    }
  }

  // 2. Dispatch to equipment drawing functions (equipment rendered cleanly over lead line)
  const def = ASSET_DEFS[node.type] || { w: 100, h: 100 };
  const baseW = def.w || 100;
  const baseH = def.h || 100;
  const scale = (typeof node.scale === 'number' && node.scale > 0)
    ? node.scale
    : (node.w ? node.w / baseW : 1);
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);

  const baseNode = { ...node, w: baseW, h: baseH, scale };
  const graphicGroup = svgEl('g', {
    class: 'asset-scale-wrapper',
    transform: scale !== 1 ? `scale(${scale})` : null
  });

  if (node.type === 'tank_buffer') graphicGroup.appendChild(drawBufferTank(baseNode));
  else if (node.type === 'cylinder_bank') graphicGroup.appendChild(drawCylinderBank(baseNode));
  else if (node.type === 'tank_horizontal') graphicGroup.appendChild(drawHorizontalTank(baseNode));
  else if (node.type === 'tank_cryogenic') graphicGroup.appendChild(drawCryogenicTank(baseNode));
  else if (node.type === 'tank_spherical') graphicGroup.appendChild(drawSphericalTank(baseNode));
  else if (node.type === 'tank_separator') graphicGroup.appendChild(drawSeparatorTank(baseNode));
  else if (node.type === 'tank_twin_tower') graphicGroup.appendChild(drawTwinTowerDryer(baseNode));
  else if (node.type === 'machine_compressor') graphicGroup.appendChild(drawCompressor(baseNode));
  else if (node.type === 'machine_compressor_piston') graphicGroup.appendChild(drawPistonCompressor(baseNode));
  else if (node.type === 'machine_cnc') graphicGroup.appendChild(drawCNCMachine(baseNode));
  else if (node.type === 'machine_robot') graphicGroup.appendChild(drawRobotCell(baseNode));
  else if (node.type === 'machine_dryer') graphicGroup.appendChild(drawRefrigeratedDryer(baseNode));
  else if (node.type === 'machine_chiller') graphicGroup.appendChild(drawChiller(baseNode));
  else if (node.type === 'filter_line') graphicGroup.appendChild(drawInlineFilter(baseNode));
  else if (node.type === 'filter_stage3') graphicGroup.appendChild(drawFilterBank(baseNode));
  else if (node.type === 'machine_laser') graphicGroup.appendChild(drawLaserCutter(baseNode));
  else if (node.type === 'machine_injection') graphicGroup.appendChild(drawInjectionMolder(baseNode));
  else if (node.type === 'machine_pump') graphicGroup.appendChild(drawBoosterPump(baseNode));
  else if (node.type === 'logger_cabinet') graphicGroup.appendChild(drawCabinet(baseNode));
  else if (node.type === 'logger_case') graphicGroup.appendChild(drawCase(baseNode));
  else if (node.type === 'leak_detector' || node.type === 'leak_detection') graphicGroup.appendChild(drawLeakDetector(baseNode));
  else if (node.type === 'dewpoint_meter') graphicGroup.appendChild(drawDewPointMeter(baseNode));
  else if (node.type === 'compact_flow_meter') graphicGroup.appendChild(drawCompactFlowMeter(baseNode));
  else if (node.type === 'flow_meter') graphicGroup.appendChild(drawFlowMeter(baseNode));
  else if (node.type === 'zone_ex') graphicGroup.appendChild(drawExZone(baseNode));
  else if (node.type === 'wall_perimeter_h') graphicGroup.appendChild(drawBrickWallH(baseNode));
  else if (node.type === 'wall_perimeter_v') graphicGroup.appendChild(drawBrickWallV(baseNode));
  else {
    graphicGroup.appendChild(drawCabinet(baseNode));
  }
  g.appendChild(graphicGroup);

  // 3. Selection frame & Anchor Handle appended LAST so they are rendered ON TOP of equipment
  if (isSel) {
    // Selection dashed boundary
    g.appendChild(svgEl('rect', {
      x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 12, rx: 6,
      fill: 'rgba(0, 168, 118, 0.08)', stroke: '#00a876', 'stroke-width': 1.8, 'stroke-dasharray': '5 3'
    }));

    // Anchor handle centered at (0, 0), on top of the machine artwork
    const anchorG = svgEl('g', {
      class: 'element-anchor-handle',
      'data-element-id': node.id,
      transform: 'translate(0, 0)',
      style: 'cursor: grab;'
    });
    anchorG.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 18, fill: 'transparent' }));
    anchorG.appendChild(svgEl('circle', {
      class: 'anchor-handle-core',
      cx: 0, cy: 0, r: 8,
      fill: node.attachedPipeId ? '#00ac86' : '#0ea5e9',
      stroke: '#ffffff',
      'stroke-width': 2.5
    }));
    anchorG.appendChild(svgEl('line', { x1: -4, y1: 0, x2: 4, y2: 0, stroke: '#ffffff', 'stroke-width': 1.5 }));
    anchorG.appendChild(svgEl('line', { x1: 0, y1: -4, x2: 0, y2: 4, stroke: '#ffffff', 'stroke-width': 1.5 }));

    g.appendChild(anchorG);
  }

  return g;
}

// --- Sensor Card Renderer ---
export function renderSensorCard(card, selectedIds = new Set(), elements = [], isLiveDnd = false) {
  const isSel = selectedIds.has(card.id) || isLiveDnd;
  const g = svgEl('g', {
    class: `sensor-badge-group ${isSel ? 'selected' : ''} ${isLiveDnd ? 'live-dnd-active' : ''}`,
    'data-card-id': card.id,
    transform: `translate(${card.x}, ${card.y})`,
    style: isLiveDnd ? 'cursor: grab;' : ''
  });

  // Attached to an equipment item, tank, machine, or sensor (any item except pipe)
  if (card.attachedAssetId) {
    const target = elements.find(e => e.id === card.attachedAssetId);
    if (target) {
      const relX = target.x - card.x;
      const relY = target.y - card.y;
      g.appendChild(svgEl('line', {
        x1: relX, y1: relY, x2: 0, y2: 0,
        stroke: isSel ? '#00a876' : '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '4 3'
      }));
      g.appendChild(svgEl('circle', {
        cx: relX, cy: relY, r: 5.5,
        fill: '#00a876', stroke: '#ffffff', 'stroke-width': 1.8
      }));
      g.appendChild(svgEl('circle', {
        cx: relX, cy: relY, r: 2.2, fill: '#ffffff'
      }));
    }
  }

  const channels = getCardChannels(card);
  const numChannels = channels.length;

  const tagStr = card.tag || card.name || 'Sensor';
  const tagLines = tagStr.includes('\n') ? tagStr.split('\n') : (tagStr.includes('/') ? tagStr.split('/') : [tagStr]);
  const isMultiLine = tagLines.length > 1;
  const maxTagLen = Math.max(...tagLines.map(l => l.length));
  const bw = Math.max(68, maxTagLen * 9.5 + 20);

  let maxNameLen = 4;
  let maxValLen = 4;
  let maxUnitLen = 0;
  channels.forEach(ch => {
    const nLen = (ch.name || '').length;
    const vLen = String(ch.val !== undefined && ch.val !== null ? ch.val : '--').length;
    const uLen = (ch.unit || '').length;
    if (nLen > maxNameLen) maxNameLen = nLen;
    if (vLen > maxValLen) maxValLen = vLen;
    if (uLen > maxUnitLen) maxUnitLen = uLen;
  });

  const nameColW = Math.max(50, maxNameLen * 8.2 + 8);
  const valColW = Math.max(46, maxValLen * 9.6 + 6);
  const unitColW = maxUnitLen > 0 ? Math.max(28, maxUnitLen * 8.2 + 4) : 0;
  const isTop = card.titlePosition !== 'left';
  const rowH = 26;
  const channelsH = Math.max(34, numChannels * rowH + 10);

  const minChannelsW = 24 + nameColW + valColW + (unitColW > 0 ? 6 + unitColW : 0) + 14;

  let totalW, totalH, badgeX, badgeY, badgeW, badgeH, panelX, panelY, panelW, panelH;

  if (isTop) {
    badgeH = 28;
    totalW = Math.max(148, minChannelsW, maxTagLen * 9.5 + 32);
    totalH = badgeH + channelsH; // Seamless: 0 space between header and body
    badgeX = -totalW / 2;
    badgeY = -totalH / 2;
    badgeW = totalW;
    panelX = -totalW / 2;
    panelY = badgeY + badgeH; // Directly attached at bottom of header badge
    panelW = totalW;
    panelH = channelsH;
  } else {
    const cw = Math.max(140, minChannelsW);
    totalW = bw + cw; // Seamless: 0 space between left header and right body
    totalH = channelsH;
    badgeX = -totalW / 2;
    badgeY = -totalH / 2;
    badgeW = bw;
    badgeH = totalH;
    panelX = badgeX + bw;
    panelY = -totalH / 2;
    panelW = cw;
    panelH = totalH;
  }

  // Unified Card Background Container (White card with shadow and outer border)
  const cardBorder = svgEl('rect', {
    x: -totalW / 2,
    y: -totalH / 2,
    width: totalW,
    height: totalH,
    rx: 4,
    fill: '#ffffff',
    stroke: isSel ? '#00ac86' : '#cbd5e1',
    'stroke-width': isSel ? 1.8 : 1.2,
    filter: 'url(#badgeShadow)',
    class: 'sensor-card-border'
  });
  g.appendChild(cardBorder);

  // Tag Badge (Yellow Industrial Accent) - seamlessly attached to body with 0 space
  if (isTop) {
    const badge = svgEl('path', {
      d: `M ${badgeX + 4},${badgeY} ` +
         `L ${badgeX + badgeW - 4},${badgeY} ` +
         `Q ${badgeX + badgeW},${badgeY} ${badgeX + badgeW},${badgeY + 4} ` +
         `L ${badgeX + badgeW},${badgeY + badgeH} ` +
         `L ${badgeX},${badgeY + badgeH} ` +
         `L ${badgeX},${badgeY + 4} ` +
         `Q ${badgeX},${badgeY} ${badgeX + 4},${badgeY} Z`,
      fill: '#fed72a',
      class: 'badge-rect'
    });
    g.appendChild(badge);

    // Subtle header bottom divider line
    g.appendChild(svgEl('line', {
      x1: badgeX,
      y1: badgeY + badgeH,
      x2: badgeX + badgeW,
      y2: badgeY + badgeH,
      stroke: '#eab308',
      'stroke-width': 1
    }));
  } else {
    const badge = svgEl('path', {
      d: `M ${badgeX + 4},${badgeY} ` +
         `L ${badgeX + badgeW},${badgeY} ` +
         `L ${badgeX + badgeW},${badgeY + badgeH} ` +
         `L ${badgeX + 4},${badgeY + badgeH} ` +
         `Q ${badgeX},${badgeY + badgeH} ${badgeX},${badgeY + badgeH - 4} ` +
         `L ${badgeX},${badgeY + 4} ` +
         `Q ${badgeX},${badgeY} ${badgeX + 4},${badgeY} Z`,
      fill: '#fed72a',
      class: 'badge-rect'
    });
    g.appendChild(badge);

    // Subtle header right divider line
    g.appendChild(svgEl('line', {
      x1: badgeX + badgeW,
      y1: badgeY,
      x2: badgeX + badgeW,
      y2: badgeY + badgeH,
      stroke: '#eab308',
      'stroke-width': 1
    }));
  }

  if (isTop) {
    const tagTxt = svgEl('text', {
      x: badgeX + badgeW / 2,
      y: badgeY + badgeH / 2 + 4.5,
      'text-anchor': 'middle',
      'font-size': 12,
      'font-weight': 800,
      fill: '#18181b',
      'font-family': 'JetBrains Mono, ui-monospace, monospace'
    });
    tagTxt.textContent = tagStr.replace('\n', ' / ');
    g.appendChild(tagTxt);
  } else if (isMultiLine) {
    tagLines.forEach((l, idx) => {
      const t = svgEl('text', {
        x: badgeX + badgeW / 2,
        y: badgeY + (idx === 0 ? badgeH / 2 - 3 : badgeH / 2 + 11),
        'text-anchor': 'middle',
        'font-size': 11,
        'font-weight': 800,
        fill: '#18181b',
        'font-family': 'JetBrains Mono, ui-monospace, monospace'
      });
      t.textContent = l;
      g.appendChild(t);
    });
  } else {
    const tagTxt = svgEl('text', {
      x: badgeX + badgeW / 2,
      y: badgeY + badgeH / 2 + 4.5,
      'text-anchor': 'middle',
      'font-size': 12,
      'font-weight': 800,
      fill: '#18181b',
      'font-family': 'JetBrains Mono, ui-monospace, monospace'
    });
    tagTxt.textContent = tagStr;
    g.appendChild(tagTxt);
  }

  // Channel Row Column Layout:
  // - Channel name starts at panelX + 24 (align left)
  // - Channel value ends at valRightX (align right)
  // - Channel unit starts at unitLeftX (align left)
  const unitLeftX = unitColW > 0 ? (panelX + panelW - unitColW - 14) : 0;
  const valRightX = unitColW > 0 ? (unitLeftX - 6) : (panelX + panelW - 16);

  channels.forEach((ch, idx) => {
    const rowY = panelY + 18 + idx * rowH;
    const chStatus = ch.status || 'normal';
    const chStatusColor = chStatus === 'alarm' ? '#dc2626' : (chStatus === 'warn' ? '#eab308' : '#16a34a');
    
    // Status dot
    g.appendChild(svgEl('circle', {
      cx: panelX + 14, cy: rowY - 4.5, r: 4.2, fill: chStatusColor
    }));

    // 1. Channel Name (align left)
    const nameTxt = svgEl('text', {
      x: panelX + 24, y: rowY, 'font-size': 11, 'font-weight': 700,
      'text-anchor': 'start',
      fill: '#475569', 'font-family': 'JetBrains Mono, ui-monospace, monospace'
    });
    nameTxt.textContent = `${ch.name}:`;
    g.appendChild(nameTxt);

    // 2. Channel Value (align right)
    const valStr = (ch.val !== undefined && ch.val !== null) ? String(ch.val) : '--';
    const valTxt = svgEl('text', {
      x: valRightX, y: rowY, 'font-size': 13.5, 'font-weight': 800,
      'text-anchor': 'end',
      fill: '#0f172a', 'font-family': 'JetBrains Mono, ui-monospace, monospace'
    });
    valTxt.textContent = valStr;
    g.appendChild(valTxt);

    // 3. Channel Unit (align left)
    if (ch.unit) {
      const unitTxt = svgEl('text', {
        x: unitLeftX, y: rowY, 'font-size': 11, 'font-weight': 600,
        'text-anchor': 'start',
        fill: '#64748b', 'font-family': 'JetBrains Mono, ui-monospace, monospace'
      });
      unitTxt.textContent = ch.unit;
      g.appendChild(unitTxt);
    }
  });

  if (isSel) {
    let hX = 0, hY = 0;
    if (card.attachedAssetId) {
      const target = elements.find(e => e.id === card.attachedAssetId);
      if (target) {
        hX = target.x - card.x;
        hY = target.y - card.y;
      }
    }

    const anchorG = svgEl('g', {
      class: 'element-anchor-handle',
      'data-element-id': card.id,
      transform: `translate(${hX}, ${hY})`,
      style: isLiveDnd ? 'cursor: grab;' : ''
    });
    anchorG.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 16, fill: 'transparent' }));
    anchorG.appendChild(svgEl('circle', { class: 'anchor-handle-core', cx: 0, cy: 0, r: 7.5, fill: '#00a876', stroke: '#ffffff', 'stroke-width': 2.5 }));
    anchorG.appendChild(svgEl('line', { x1: -4, y1: 0, x2: 4, y2: 0, stroke: '#ffffff', 'stroke-width': 1.5 }));
    anchorG.appendChild(svgEl('line', { x1: 0, y1: -4, x2: 0, y2: 4, stroke: '#ffffff', 'stroke-width': 1.5 }));

    g.appendChild(anchorG);
  }

  return g;
}

// Create industrial flange interface (法兰盘) at pipe endpoints (130% of pipeline diameter)
export function createFlangeInterface(endpoint, angleDeg, strokeW, isLiquid) {
  const g = svgEl('g', {
    class: 'pipe-flange-interface',
    transform: `translate(${endpoint.x}, ${endpoint.y}) rotate(${angleDeg})`,
    'pointer-events': 'none'
  });

  const flangeH = strokeW * 1.30; // exactly 130% of pipeline diameter as requested
  const flangeT = Math.max(5, Math.round(strokeW * 0.3)); // flange plate thickness along pipe axis
  const collarH = strokeW * 1.08; // raised weld neck
  const collarT = 3; // weld collar length

  const bodyColor = isLiquid ? '#0284c7' : '#94a3b8';
  const plateFill = isLiquid ? '#0369a1' : '#64748b';
  const plateHighlight = isLiquid ? '#38bdf8' : '#cbd5e1';
  const rimStroke = isLiquid ? '#0c4a6e' : '#334155';
  const holeFill = isLiquid ? '#082f49' : '#1e293b';

  // 1. Weld Neck / Collar (step between pipe and flange disc)
  const collar = svgEl('rect', {
    x: -flangeT - collarT,
    y: -collarH / 2,
    width: collarT + 0.5,
    height: collarH,
    fill: bodyColor,
    stroke: rimStroke,
    'stroke-width': 0.8
  });
  g.appendChild(collar);

  // 2. Main Flange Plate / Disc (perpendicular to pipe axis, height = 130% of diameter)
  const plate = svgEl('rect', {
    x: -flangeT,
    y: -flangeH / 2,
    width: flangeT,
    height: flangeH,
    rx: 1.5,
    fill: plateFill,
    stroke: rimStroke,
    'stroke-width': 1
  });
  g.appendChild(plate);

  // 3. Metallic highlight bar on flange plate
  const highlight = svgEl('rect', {
    x: -flangeT + 1,
    y: -flangeH / 2 + 1,
    width: Math.max(1.5, flangeT * 0.35),
    height: flangeH - 2,
    rx: 0.8,
    fill: plateHighlight,
    opacity: 0.6
  });
  g.appendChild(highlight);

  // 4. Industrial Flange Bolt Holes (top and bottom ears matching the uploaded image)
  const holeR = Math.max(1.4, Math.min(2.5, (flangeH - strokeW) * 0.4));
  const holeYOffset = flangeH / 2 - holeR - 1.5;

  const topHole = svgEl('ellipse', {
    cx: -flangeT / 2,
    cy: -holeYOffset,
    rx: Math.max(1.2, holeR * 0.8),
    ry: holeR,
    fill: holeFill,
    stroke: rimStroke,
    'stroke-width': 0.6
  });
  g.appendChild(topHole);

  const botHole = svgEl('ellipse', {
    cx: -flangeT / 2,
    cy: holeYOffset,
    rx: Math.max(1.2, holeR * 0.8),
    ry: holeR,
    fill: holeFill,
    stroke: rimStroke,
    'stroke-width': 0.6
  });
  g.appendChild(botHole);

  // 5. Outer Sealing Face / Bevel Lip
  const sealFace = svgEl('line', {
    x1: 0,
    y1: -flangeH / 2 + 1,
    x2: 0,
    y2: flangeH / 2 - 1,
    stroke: plateHighlight,
    'stroke-width': 1.2,
    'stroke-linecap': 'round',
    opacity: 0.8
  });
  g.appendChild(sealFace);

  return g;
}

// --- Pipe Renderer ---
export function renderPipe(pipe, selectedIds = new Set(), allPipes = [], flowDirections = null) {
  const isSel = selectedIds.has(pipe.id);
  const g = svgEl('g', { class: `plant-pipe-group ${isSel ? 'selected' : ''}`, 'data-pipe-id': pipe.id });

  const isLiquid = pipe.medium === 'liquid';
  const pipeColor = isLiquid ? '#0284c7' : '#94a3b8';
  const strokeW = pipe.w || 20;

  if (isSel) {
    g.appendChild(svgEl('path', {
      d: pipe.d, fill: 'none', stroke: '#00ac86', 'stroke-width': strokeW + 8,
      'stroke-linecap': 'butt', 'stroke-linejoin': 'round', opacity: 0.5, class: 'pipe-selection-halo'
    }));

    // Selection halo for connected turning points and elbows
    if (pipe.points && pipe.points.length >= 2) {
      const pts = pipe.points;
      if (!isPipeEndpointOpen(pipe, 0, allPipes)) {
        g.appendChild(svgEl('circle', {
          cx: pts[0].x, cy: pts[0].y, r: (strokeW + 8) / 2, fill: '#00ac86', opacity: 0.5,
          class: 'pipe-selection-halo'
        }));
      }
      if (!isPipeEndpointOpen(pipe, pts.length - 1, allPipes)) {
        g.appendChild(svgEl('circle', {
          cx: pts[pts.length - 1].x, cy: pts[pts.length - 1].y, r: (strokeW + 8) / 2, fill: '#00ac86', opacity: 0.5,
          class: 'pipe-selection-halo'
        }));
      }
      for (let i = 1; i < pts.length - 1; i++) {
        g.appendChild(svgEl('circle', {
          cx: pts[i].x, cy: pts[i].y, r: (strokeW + 8) / 2, fill: '#00ac86', opacity: 0.5,
          class: 'pipe-selection-halo'
        }));
      }
    }
  }

  g.appendChild(svgEl('path', {
    d: pipe.d, fill: 'none', stroke: pipeColor, 'stroke-width': strokeW,
    'stroke-linecap': 'butt', 'stroke-linejoin': 'round', class: 'pipe-metal-body'
  }));

  // Turning point / elbow round joins at connected junctions and interior vertices (smooth old way)
  if (pipe.points && pipe.points.length >= 2) {
    const pts = pipe.points;
    if (!isPipeEndpointOpen(pipe, 0, allPipes)) {
      g.appendChild(svgEl('circle', {
        cx: pts[0].x, cy: pts[0].y, r: strokeW / 2, fill: pipeColor,
        class: 'pipe-metal-body pipe-elbow-junction'
      }));
    }
    if (!isPipeEndpointOpen(pipe, pts.length - 1, allPipes)) {
      g.appendChild(svgEl('circle', {
        cx: pts[pts.length - 1].x, cy: pts[pts.length - 1].y, r: strokeW / 2, fill: pipeColor,
        class: 'pipe-metal-body pipe-elbow-junction'
      }));
    }
    for (let i = 1; i < pts.length - 1; i++) {
      g.appendChild(svgEl('circle', {
        cx: pts[i].x, cy: pts[i].y, r: strokeW / 2, fill: pipeColor,
        class: 'pipe-metal-body pipe-elbow-junction'
      }));
    }
  }

  // Moving Dashed Flow Direction Line inside pipe (Hardware-accelerated CSS animated)
  let flowDir = pipe.flow;
  if (flowDirections && flowDirections.has(pipe.id)) {
    flowDir = flowDirections.get(pipe.id);
  } else if (allPipes && allPipes.length > 1) {
    const computed = resolvePipelineFlowDirections(allPipes);
    flowDir = computed.get(pipe.id);
  }

  // Normalize flow direction: only 'none' turns it off, otherwise 'reverse' or default 'forward'
  if (flowDir === 'none' || pipe.flow === 'none') {
    flowDir = 'none';
  } else if (flowDir === 'reverse' || pipe.flow === 'reverse') {
    flowDir = 'reverse';
  } else {
    flowDir = 'forward';
  }

  if (flowDir === 'forward' || flowDir === 'reverse') {
    const flowStroke = isLiquid ? '#e0f2fe' : '#ffffff';
    const flowW = Math.max(2.5, Math.min(5, Math.round(strokeW * 0.16)));
    g.appendChild(svgEl('path', {
      d: pipe.d,
      fill: 'none',
      stroke: flowStroke,
      'stroke-width': flowW,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-dasharray': '8 12',
      opacity: 0.85,
      class: `pipe-flow-dash flow-${flowDir}`,
      'pointer-events': 'none'
    }));
  }

  // Industrial Flange Interface at open endpoints (width = 130% of pipeline diameter)
  if (pipe.points && pipe.points.length >= 2) {
    const pts = pipe.points;
    const p0 = pts[0];
    const p1 = pts[1];
    const pN = pts[pts.length - 1];
    const pPrev = pts[pts.length - 2];

    // Start endpoint flange
    if (isPipeEndpointOpen(pipe, 0, allPipes)) {
      const v0 = { x: p0.x - p1.x, y: p0.y - p1.y };
      const angle0 = Math.atan2(v0.y, v0.x) * (180 / Math.PI);
      g.appendChild(createFlangeInterface(p0, angle0, strokeW, isLiquid));
    }

    // End endpoint flange
    if (isPipeEndpointOpen(pipe, pts.length - 1, allPipes)) {
      const vN = { x: pN.x - pPrev.x, y: pN.y - pPrev.y };
      const angleN = Math.atan2(vN.y, vN.x) * (180 / Math.PI);
      g.appendChild(createFlangeInterface(pN, angleN, strokeW, isLiquid));
    }
  }

  if (isSel && pipe.points && pipe.points.length >= 2) {
    pipe.points.forEach((pt, pIdx) => {
      const hCircle = svgEl('circle', {
        cx: pt.x, cy: pt.y, r: 7, fill: '#0284c7', stroke: '#ffffff', 'stroke-width': 2,
        class: 'pipe-drag-handle', 'data-pipe-id': pipe.id, 'data-point-idx': pIdx
      });
      g.appendChild(hCircle);
    });

    // Start (+)
    const p0 = pipe.points[0];
    const extStart = svgEl('g', {
      class: 'pipe-extend-group', 'data-pipe-id': pipe.id, 'data-end': 'start',
      transform: `translate(${p0.x}, ${p0.y})`, cursor: 'pointer'
    });
    extStart.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 10, fill: '#16a34a', stroke: '#ffffff', 'stroke-width': 1.5, class: 'pipe-extend-handle' }));
    extStart.appendChild(svgEl('text', { x: 0, y: 3.5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 900, fill: '#ffffff', 'pointer-events': 'none' }, '+'));
    g.appendChild(extStart);

    // End (+)
    const pEnd = pipe.points[pipe.points.length - 1];
    const extEnd = svgEl('g', {
      class: 'pipe-extend-group', 'data-pipe-id': pipe.id, 'data-end': 'end',
      transform: `translate(${pEnd.x}, ${pEnd.y})`, cursor: 'pointer'
    });
    extEnd.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 10, fill: '#16a34a', stroke: '#ffffff', 'stroke-width': 1.5, class: 'pipe-extend-handle' }));
    extEnd.appendChild(svgEl('text', { x: 0, y: 3.5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 900, fill: '#ffffff', 'pointer-events': 'none' }, '+'));
    g.appendChild(extEnd);
  }

  return g;
}
