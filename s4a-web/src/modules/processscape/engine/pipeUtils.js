import { ASSET_DEFS } from './constants.js';

export function snap(val, step = 2) {
  return Math.round(val / step) * step;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function dist(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function distToSegmentSquared(p, v, w) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

export function distToSegment(p, v, w) {
  return Math.sqrt(distToSegmentSquared(p, v, w));
}

export function pointsToPath(pts) {
  if (!pts || pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
}

export function translatePath(d, dx, dy) {
  return d.replace(/(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/g, (match, x, _, y) => {
    return `${Math.round(parseFloat(x) + dx)},${Math.round(parseFloat(y) + dy)}`;
  });
}

export function getSnapExtensionPoint(extending, rawPt, snapStep = 10) {
  if (!extending || !extending.pipe) return rawPt;
  const pipe = extending.pipe;
  if (!pipe.points || pipe.points.length < 2) return rawPt;
  const p0 = pipe.points[0];
  const p1 = pipe.points[pipe.points.length - 1];
  const isHoriz = Math.abs(p1.y - p0.y) <= Math.abs(p1.x - p0.x);
  const pAnchor = extending.end === 'end' ? p1 : p0;

  const sx = snap(rawPt.x, snapStep);
  const sy = snap(rawPt.y, snapStep);
  const dx = sx - pAnchor.x;
  const dy = sy - pAnchor.y;

  if (isHoriz) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: sx, y: pAnchor.y };
    } else {
      return { x: pAnchor.x, y: sy };
    }
  } else {
    if (Math.abs(dy) >= Math.abs(dx)) {
      return { x: pAnchor.x, y: sy };
    } else {
      return { x: sx, y: pAnchor.y };
    }
  }
}

export function getSnapOrthogonalPoint(pStart, rawPt, snapStep = 10) {
  const sx = snap(rawPt.x, snapStep);
  const sy = snap(rawPt.y, snapStep);
  const dx = sx - pStart.x;
  const dy = sy - pStart.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: sx, y: pStart.y };
  } else {
    return { x: pStart.x, y: sy };
  }
}

export function getPointAlongPipe(pipe, t) {
  if (!pipe || !pipe.points || pipe.points.length < 2) return null;
  const pts = pipe.points;
  const lengths = [];
  let totalLength = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    lengths.push(l);
    totalLength += l;
  }
  if (totalLength === 0) return { x: pts[0].x, y: pts[0].y, nx: 0, ny: -1, angle: 0 };

  const targetDist = Math.max(0, Math.min(1, t)) * totalLength;
  let accumulated = 0;
  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i];
    if (accumulated + segLen >= targetDist || i === lengths.length - 1) {
      const segT = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const x = pts[i].x + (pts[i + 1].x - pts[i].x) * segT;
      const y = pts[i].y + (pts[i + 1].y - pts[i].y) * segT;
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const angle = Math.atan2(dy, dx);
      return { x, y, nx, ny, angle, segmentIndex: i };
    }
    accumulated += segLen;
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, nx: 0, ny: -1, angle: 0 };
}

export function findClosestPointOnPipe(pipe, px, py) {
  if (!pipe || !pipe.points || pipe.points.length < 2) return null;
  const pts = pipe.points;
  let minDistance = Infinity;
  let bestPoint = null;
  let bestT = 0;

  const lengths = [];
  let totalLength = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    lengths.push(l);
    totalLength += l;
  }

  let accumulated = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const v = pts[i];
    const w = pts[i + 1];
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    let segT = 0;
    if (l2 > 0) {
      segT = ((px - v.x) * (w.x - v.x) + (py - v.y) * (w.y - v.y)) / l2;
      segT = Math.max(0, Math.min(1, segT));
    }
    const projX = v.x + segT * (w.x - v.x);
    const projY = v.y + segT * (w.y - v.y);
    const d = Math.hypot(px - projX, py - projY);

    if (d < minDistance) {
      minDistance = d;
      bestPoint = { x: projX, y: projY };
      const distFromStart = accumulated + segT * lengths[i];
      bestT = totalLength > 0 ? distFromStart / totalLength : 0;
    }
    accumulated += lengths[i];
  }

  return { point: bestPoint, distance: minDistance, t: Math.max(0, Math.min(1, bestT)) };
}

export function getClosestPointOnPipe(pipe, pt) {
  if (!pt) return null;
  return findClosestPointOnPipe(pipe, pt.x, pt.y);
}

export function getPipeBoundingBox(pipe) {
  if (!pipe || !pipe.points || pipe.points.length === 0) return { x: 0, y: 0, w: 50, h: 50 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pipe.points.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });
  const pad = (pipe.w || 20) / 2 + 10;
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(20, maxX - minX + pad * 2),
    h: Math.max(20, maxY - minY + pad * 2)
  };
}

export function rectsIntersect(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {
  return !(r2x > r1x + r1w || r2x + r2w < r1x || r2y > r1y + r1h || r2y + r2h < r1y);
}

export function getElementBBox(el) {
  if (!el) return { x: 0, y: 0, w: 0, h: 0 };
  if (el.type === 'sensor_card') {
    const channels = (el.channels && Array.isArray(el.channels))
      ? el.channels
      : [];
    const numChannels = channels.length;
    const tagLines = el.tag && (el.tag.includes('\n') ? el.tag.split('\n') : (el.tag.includes('/') ? el.tag.split('/') : [el.tag])) || ['Sensor'];
    const maxTagLen = Math.max(...tagLines.map(l => l.length));
    const bw = Math.max(50, maxTagLen * 8 + 14);

    let maxNameLen = 4;
    let maxValLen = 4;
    let maxUnitLen = 3;
    channels.forEach(ch => {
      const nLen = (ch.name || '').length;
      const vLen = String(ch.val !== undefined ? ch.val : '').length;
      const uLen = (ch.unit || '').length;
      if (nLen > maxNameLen) maxNameLen = nLen;
      if (vLen > maxValLen) maxValLen = vLen;
      if (uLen > maxUnitLen) maxUnitLen = uLen;
    });

    const nameColW = maxNameLen * 6.8 + 10;
    const valColW = maxValLen * 7.2 + 8;
    const unitColW = maxUnitLen * 6.5 + 4;
    const rowH = 19;
    const channelsH = Math.max(26, numChannels * rowH + 6);

    if (el.titlePosition !== 'left') {
      const headerH = 22;
      const totalW = Math.max(104, nameColW + valColW + unitColW + 28, maxTagLen * 8 + 24);
      const totalH = headerH + 3 + channelsH;
      return { x: el.x - totalW / 2, y: el.y - totalH / 2, w: totalW, h: totalH };
    } else {
      const cw = Math.max(98, nameColW + valColW + unitColW + 28);
      const totalW = bw + 3 + cw;
      const totalH = channelsH;
      return { x: el.x - totalW / 2, y: el.y - totalH / 2, w: totalW, h: totalH };
    }
  }

  if (el.type === 'text_note') {
    const tw = (el.text ? el.text.length : 8) * 8.5;
    const th = (el.fontSize || 13) + 6;
    return { x: el.x - 4, y: el.y - (el.fontSize || 13), w: tw + 8, h: th };
  }

  const def = ASSET_DEFS[el.type];
  const baseW = def ? def.w : (el.w || 100);
  const baseH = def ? def.h : (el.h || 100);
  const scale = (typeof el.scale === 'number' && el.scale > 0)
    ? el.scale
    : (el.w && def ? el.w / def.w : 1);
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  return { x: el.x - w / 2, y: el.y - h / 2, w, h };
}

export function getContentBounds(elements = [], pipes = [], margin = 16) {
  if (elements.length === 0 && pipes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      contentW: 0,
      contentH: 0,
      x: 0,
      y: 0,
      width: margin * 2,
      height: margin * 2,
      margin,
      hasContent: false
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach(el => {
    const bbox = getElementBBox(el);
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.w);
    maxY = Math.max(maxY, bbox.y + bbox.h);
  });

  pipes.forEach(pipe => {
    const bbox = getPipeBoundingBox(pipe);
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.w);
    maxY = Math.max(maxY, bbox.y + bbox.h);
  });

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  // Final picture size adds 16px margin on every edge (left + right = 32px, top + bottom = 32px)
  const finalX = minX - margin;
  const finalY = minY - margin;
  const finalW = contentW + margin * 2;
  const finalH = contentH + margin * 2;

  return {
    minX,
    minY,
    maxX,
    maxY,
    contentW: Math.round(contentW),
    contentH: Math.round(contentH),
    x: Math.round(finalX),
    y: Math.round(finalY),
    width: Math.round(finalW),
    height: Math.round(finalH),
    margin,
    hasContent: true
  };
}

export function arePipesConnected(p1, p2) {
  if (!p1 || !p2 || !p1.points || !p2.points || p1.points.length < 2 || p2.points.length < 2) return false;
  if (p1.id === p2.id) return true;
  if (p1.groupId && p2.groupId && p1.groupId === p2.groupId) return true;

  const endA = [p1.points[0], p1.points[p1.points.length - 1]];
  const endB = [p2.points[0], p2.points[p2.points.length - 1]];

  // Check endpoint to endpoint
  for (const ea of endA) {
    for (const eb of endB) {
      if (Math.hypot(ea.x - eb.x, ea.y - eb.y) <= 20) return true;
    }
  }

  // Check endpoint of A touching segment of B (T-junction)
  const padB = (p2.w || 20) / 2 + 8;
  for (const ea of endA) {
    for (let i = 0; i < p2.points.length - 1; i++) {
      if (distToSegment(ea, p2.points[i], p2.points[i + 1]) <= padB) return true;
    }
  }

  // Check endpoint of B touching segment of A
  const padA = (p1.w || 20) / 2 + 8;
  for (const eb of endB) {
    for (let i = 0; i < p1.points.length - 1; i++) {
      if (distToSegment(eb, p1.points[i], p1.points[i + 1]) <= padA) return true;
    }
  }

  return false;
}

export function getConnectedPipeIds(pipeId, allPipes = []) {
  const targetPipe = allPipes.find(p => p.id === pipeId);
  if (!targetPipe) return [pipeId];

  const connected = new Set([pipeId]);
  let added = true;
  while (added) {
    added = false;
    for (const p of allPipes) {
      if (connected.has(p.id)) continue;
      for (const cId of connected) {
        const cPipe = allPipes.find(cp => cp.id === cId);
        if (cPipe && arePipesConnected(p, cPipe)) {
          connected.add(p.id);
          added = true;
          break;
        }
      }
    }
  }

  return Array.from(connected);
}

export function expandConnectedPipes(selectedPipeIds = [], allPipes = []) {
  const result = new Set(selectedPipeIds);
  selectedPipeIds.forEach(id => {
    const group = getConnectedPipeIds(id, allPipes);
    group.forEach(gId => result.add(gId));
  });
  return Array.from(result);
}

export function isPipeEndpointOpen(pipe, endpointIdx, allPipes = []) {
  if (!pipe || !pipe.points || pipe.points.length < 2) return true;
  if (!Array.isArray(allPipes) || allPipes.length <= 1) return true;

  const pt = endpointIdx === 0 ? pipe.points[0] : pipe.points[pipe.points.length - 1];
  if (!pt) return true;

  for (const other of allPipes) {
    if (other.id === pipe.id || !other.points || other.points.length < 2) continue;

    const otherEnd0 = other.points[0];
    const otherEndN = other.points[other.points.length - 1];
    if (Math.hypot(pt.x - otherEnd0.x, pt.y - otherEnd0.y) <= 18) return false;
    if (Math.hypot(pt.x - otherEndN.x, pt.y - otherEndN.y) <= 18) return false;

    // Check if touching other pipe body (T-junction)
    const pad = (other.w || 20) / 2 + 8;
    for (let i = 0; i < other.points.length - 1; i++) {
      if (distToSegment(pt, other.points[i], other.points[i + 1]) <= pad) return false;
    }
  }

  return true;
}

// Compute coherent fluid flow directions across branching networks and multi-segment pipelines
export function resolvePipelineFlowDirections(allPipes = []) {
  const flowMap = new Map();
  if (!Array.isArray(allPipes) || allPipes.length === 0) return flowMap;

  const visitedPipes = new Set();

  for (const startPipe of allPipes) {
    if (!startPipe || !startPipe.points || startPipe.points.length < 2) continue;
    if (visitedPipes.has(startPipe.id)) continue;

    const componentIds = getConnectedPipeIds(startPipe.id, allPipes);
    const componentPipes = componentIds.map(id => allPipes.find(p => p.id === id)).filter(Boolean);

    componentPipes.forEach(p => visitedPipes.add(p.id));

    // If all pipes in component have flow disabled ('none')
    const allNone = componentPipes.every(p => p.flow === 'none');
    if (allNone) {
      componentPipes.forEach(p => flowMap.set(p.id, 'none'));
      continue;
    }

    // Determine if the component is in global reverse flow mode
    const isGlobalReverse = componentPipes.some(p => p.flow === 'reverse');

    if (componentPipes.length === 1) {
      const p = componentPipes[0];
      const norm = p.flow === 'none' ? 'none' : (p.flow === 'reverse' || isGlobalReverse ? 'reverse' : 'forward');
      flowMap.set(p.id, norm);
      continue;
    }

    // Identify the best root / inlet pipe for this connected network:
    // Prefer pipes with active flow and an open start terminal (inflow)
    const activeFlowPipes = componentPipes.filter(p => p.flow !== 'none' && p.flow !== 'off');
    const searchPipes = activeFlowPipes.length > 0 ? activeFlowPipes : componentPipes;
    let rootPipe = searchPipes[0];
    let rootInNode = rootPipe.points[0];
    let foundInlet = false;

    for (const p of searchPipes) {
      const open0 = isPipeEndpointOpen(p, 0, allPipes);
      const openN = isPipeEndpointOpen(p, p.points.length - 1, allPipes);

      if (!isGlobalReverse) {
        if (open0) {
          rootPipe = p;
          rootInNode = p.points[0];
          foundInlet = true;
          break;
        } else if (openN && !foundInlet) {
          rootPipe = p;
          rootInNode = p.points[p.points.length - 1];
        }
      } else {
        if (openN) {
          rootPipe = p;
          rootInNode = p.points[p.points.length - 1];
          foundInlet = true;
          break;
        } else if (open0 && !foundInlet) {
          rootPipe = p;
          rootInNode = p.points[0];
        }
      }
    }

    // BFS Traversal propagating flow outward along all downstream branches
    const queue = [{ pipe: rootPipe, inNode: rootInNode }];
    const pipeTraversed = new Set([rootPipe.id]);

    while (queue.length > 0) {
      const { pipe, inNode } = queue.shift();

      const p0 = pipe.points[0];
      const pN = pipe.points[pipe.points.length - 1];
      const d0 = Math.hypot(inNode.x - p0.x, inNode.y - p0.y);
      const dN = Math.hypot(inNode.x - pN.x, inNode.y - pN.y);

      if (pipe.flow === 'none') {
        flowMap.set(pipe.id, 'none');
      } else {
        // Fluid enters at inNode and flows towards the opposite terminal
        const dir = d0 <= dN ? 'forward' : 'reverse';
        flowMap.set(pipe.id, dir);
      }

      // The exit terminal where fluid leaves this pipe segment
      const outNode = d0 <= dN ? pN : p0;

      // Find all connected branch pipes and propagate outward
      for (const nextPipe of componentPipes) {
        if (pipeTraversed.has(nextPipe.id)) continue;

        const np0 = nextPipe.points[0];
        const npN = nextPipe.points[nextPipe.points.length - 1];

        // Check if nextPipe connects to this pipe's exit node
        const touch0 = Math.hypot(outNode.x - np0.x, outNode.y - np0.y) <= 15;
        const touchN = Math.hypot(outNode.x - npN.x, outNode.y - npN.y) <= 15;

        let branchJunctionPt = null;
        if (touch0) {
          branchJunctionPt = np0;
        } else if (touchN) {
          branchJunctionPt = npN;
        } else {
          // Check T-junction along the pipe body
          const pad = (pipe.w || 20) / 2 + 6;
          for (let i = 0; i < pipe.points.length - 1; i++) {
            if (distToSegment(np0, pipe.points[i], pipe.points[i + 1]) <= pad) {
              branchJunctionPt = np0;
              break;
            }
            if (distToSegment(npN, pipe.points[i], pipe.points[i + 1]) <= pad) {
              branchJunctionPt = npN;
              break;
            }
          }
        }

        if (branchJunctionPt) {
          pipeTraversed.add(nextPipe.id);
          // Fluid enters nextPipe at branchJunctionPt and radiates outward along the branch
          queue.push({ pipe: nextPipe, inNode: branchJunctionPt });
        }
      }
    }

    // Fallback for any unvisited pipes in component
    componentPipes.forEach(p => {
      if (!flowMap.has(p.id)) {
        if (p.flow === 'none') {
          flowMap.set(p.id, 'none');
        } else if (p.flow === 'reverse') {
          flowMap.set(p.id, 'reverse');
        } else {
          flowMap.set(p.id, isGlobalReverse ? 'reverse' : 'forward');
        }
      }
    });
  }

  return flowMap;
}

// Calculate the total pixel length of a pipe
export function getPipeLength(pipe) {
  if (!pipe || !pipe.points || pipe.points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pipe.points.length - 1; i++) {
    total += Math.hypot(pipe.points[i + 1].x - pipe.points[i].x, pipe.points[i + 1].y - pipe.points[i].y);
  }
  return Math.round(total);
}

// Adjust the length of a single pipe while preserving its orientation and anchored junctions
export function adjustPipeLength(pipe, targetLen, allPipes = []) {
  if (!pipe || !pipe.points || pipe.points.length < 2) return pipe;
  const len = Math.max(10, Math.round(targetLen));
  const pts = pipe.points.map(pt => ({ ...pt }));

  if (pts.length === 2) {
    const p0 = pts[0];
    const p1 = pts[1];
    const isHoriz = Math.abs(p1.y - p0.y) <= Math.abs(p1.x - p0.x);

    // Check which endpoint is open
    const open0 = isPipeEndpointOpen(pipe, 0, allPipes);
    const openN = isPipeEndpointOpen(pipe, 1, allPipes);

    // If p0 is open and p1 is connected, anchor p1 and move p0
    const anchorAtEnd = open0 && !openN;

    if (!anchorAtEnd) {
      // Anchor p0, move p1
      if (isHoriz) {
        const sign = p1.x >= p0.x ? 1 : -1;
        p1.x = p0.x + sign * len;
        p1.y = p0.y;
      } else {
        const sign = p1.y >= p0.y ? 1 : -1;
        p1.y = p0.y + sign * len;
        p1.x = p0.x;
      }
    } else {
      // Anchor p1, move p0
      if (isHoriz) {
        const sign = p0.x >= p1.x ? 1 : -1;
        p0.x = p1.x + sign * len;
        p0.y = p1.y;
      } else {
        const sign = p0.y >= p1.y ? 1 : -1;
        p0.y = p1.y + sign * len;
        p0.x = p1.x;
      }
    }

    return {
      ...pipe,
      points: pts,
      d: pointsToPath(pts)
    };
  } else {
    // Multi-segment pipe: scale all segments proportionally
    const curLen = getPipeLength(pipe);
    if (curLen === 0) return pipe;
    const ratio = len / curLen;
    const p0 = pts[0];
    const newPts = pts.map((pt, i) => {
      if (i === 0) return pt;
      return {
        x: Math.round(p0.x + (pt.x - p0.x) * ratio),
        y: Math.round(p0.y + (pt.y - p0.y) * ratio)
      };
    });
    return {
      ...pipe,
      points: newPts,
      d: pointsToPath(newPts)
    };
  }
}
