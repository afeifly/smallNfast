import React, { useMemo } from 'react';

/**
 * Background terrain illustration layer.
 * Draws soft, GBA-style nature art for each tile type.
 * This layer sits beneath the interactive unit layer.
 */

// Seeded pseudo-random for stable decorations per tile position
function seededRand(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

// SVG decoration definitions per terrain type
function TerrainDecoration({ tileType, x, y, tileSize }) {
  const r1 = seededRand(x, y, 1);
  const r2 = seededRand(x, y, 2);
  const r3 = seededRand(x, y, 3);

  const px = x * tileSize;
  const py = y * tileSize;
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;

  switch (tileType) {
    case 'forest': {
      // 1–2 trees per forest tile
      const count = r1 > 0.5 ? 2 : 1;
      const offsets = count === 2
        ? [{ dx: -10 + r2 * 6, dy: -4 + r2 * 4 }, { dx: 8 - r3 * 6, dy: 2 + r3 * 4 }]
        : [{ dx: -4 + r2 * 8, dy: -2 + r2 * 4 }];
      return offsets.map((o, i) => {
        const tx = cx + o.dx;
        const ty = cy + o.dy;
        const scale = 0.75 + r1 * 0.35;
        return (
          <g key={i} transform={`translate(${tx}, ${ty}) scale(${scale})`} opacity="0.88">
            {/* trunk */}
            <rect x="-2" y="4" width="4" height="6" fill="#8B6914" rx="1" />
            {/* canopy layers */}
            <polygon points="0,-14 -9,2 9,2" fill="#4a7c3f" />
            <polygon points="0,-9 -7,4 7,4" fill="#5a9448" />
          </g>
        );
      });
    }

    case 'mountain': {
      // Rock peak silhouette
      const scale = 0.8 + r1 * 0.3;
      const dx = -6 + r2 * 12;
      return (
        <g transform={`translate(${cx + dx}, ${cy + 4}) scale(${scale})`} opacity="0.75">
          <polygon points="0,-18 -14,6 14,6" fill="#888" />
          <polygon points="0,-18 -6,-6 6,-6" fill="#eee" /> {/* snow cap */}
          <polygon points="-4,6 4,-8 -14,6" fill="#666" opacity="0.4" />
        </g>
      );
    }

    case 'water': {
      // Ripple lines
      const waveY = cy + r2 * 6 - 3;
      return (
        <g opacity="0.55">
          <path
            d={`M ${px + 6} ${waveY} q 8,-5 16,0 q 8,5 16,0`}
            fill="none" stroke="#4a90c8" strokeWidth="1.5" strokeLinecap="round"
          />
          <path
            d={`M ${px + 10} ${waveY + 8} q 6,-4 12,0 q 6,4 12,0`}
            fill="none" stroke="#6aaad8" strokeWidth="1.2" strokeLinecap="round"
          />
        </g>
      );
    }

    case 'wall': {
      // Stone brick pattern
      const brickW = 14, brickH = 8;
      const rows = Math.ceil(tileSize / brickH);
      return (
        <g opacity="0.3">
          {Array.from({ length: rows }).map((_, row) => {
            const offsetX = row % 2 === 0 ? 0 : brickW / 2;
            const cols = Math.ceil(tileSize / brickW) + 1;
            return Array.from({ length: cols }).map((_, col) => (
              <rect
                key={`${row}-${col}`}
                x={px + col * brickW - offsetX}
                y={py + row * brickH}
                width={brickW - 1}
                height={brickH - 1}
                fill="none"
                stroke="#fff"
                strokeWidth="0.5"
              />
            ));
          })}
        </g>
      );
    }

    case 'fort': {
      // Castle turret silhouette
      return (
        <g transform={`translate(${cx}, ${cy})`} opacity="0.65">
          <rect x="-10" y="-4" width="20" height="12" fill="#bbb" stroke="#888" strokeWidth="0.8" />
          {/* crenellations */}
          {[-8, -3, 2, 7].map(bx => (
            <rect key={bx} x={bx} y="-10" width="3" height="7" fill="#bbb" stroke="#888" strokeWidth="0.8" />
          ))}
          {/* door */}
          <rect x="-3" y="2" width="6" height="6" fill="#444" rx="3" />
        </g>
      );
    }

    case 'throne': {
      // Crown / throne symbol
      return (
        <g transform={`translate(${cx}, ${cy - 2})`} opacity="0.7">
          <polygon points="0,-10 -8,2 -4,-2 0,2 4,-2 8,2" fill="#c8a020" stroke="#906010" strokeWidth="0.8" />
          <rect x="-8" y="2" width="16" height="4" fill="#c8a020" stroke="#906010" strokeWidth="0.8" />
          {/* gems */}
          <circle cx="-4" cy="-1" r="1.5" fill="#e05050" />
          <circle cx="0" cy="-3" r="1.5" fill="#50b0e0" />
          <circle cx="4" cy="-1" r="1.5" fill="#e05050" />
        </g>
      );
    }

    case 'village': {
      // Small house
      return (
        <g transform={`translate(${cx}, ${cy})`} opacity="0.7">
          {/* roof */}
          <polygon points="0,-12 -10,0 10,0" fill="#c85020" />
          {/* walls */}
          <rect x="-8" y="0" width="16" height="10" fill="#e8d8b0" stroke="#a08040" strokeWidth="0.8" />
          {/* door */}
          <rect x="-2" y="4" width="4" height="6" fill="#806030" />
          {/* window */}
          <rect x="-7" y="2" width="4" height="4" fill="#80c0e0" stroke="#a08040" strokeWidth="0.5" />
          <rect x="3" y="2" width="4" height="4" fill="#80c0e0" stroke="#a08040" strokeWidth="0.5" />
        </g>
      );
    }

    case 'road': {
      // Subtle road texture lines
      return (
        <g opacity="0.2">
          <line x1={px + 4} y1={py} x2={px + 4} y2={py + tileSize} stroke="#a09060" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={px + tileSize - 4} y1={py} x2={px + tileSize - 4} y2={py + tileSize} stroke="#a09060" strokeWidth="1" strokeDasharray="4 4" />
        </g>
      );
    }

    case 'gate': {
      // Arch gate
      return (
        <g transform={`translate(${cx}, ${cy})`} opacity="0.7">
          <rect x="-12" y="-6" width="24" height="14" fill="#c8b070" stroke="#806020" strokeWidth="1" />
          <path d="M -6,-6 Q -6,-14 0,-14 Q 6,-14 6,-6" fill="#806020" />
          <rect x="-4" y="-2" width="8" height="10" fill="#402010" rx="4" />
        </g>
      );
    }

    case 'plain':
    default: {
      // Occasional grass tufts
      if (r1 > 0.65) {
        const gx = px + 8 + r2 * (tileSize - 16);
        const gy = py + 8 + r3 * (tileSize - 16);
        return (
          <g opacity="0.35">
            <line x1={gx} y1={gy + 4} x2={gx - 2} y2={gy - 4} stroke="#6a9040" strokeWidth="1.2" strokeLinecap="round" />
            <line x1={gx} y1={gy + 4} x2={gx} y2={gy - 5} stroke="#5a8030" strokeWidth="1.4" strokeLinecap="round" />
            <line x1={gx} y1={gy + 4} x2={gx + 2} y2={gy - 4} stroke="#6a9040" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );
      }
      return null;
    }
  }
}

// Base fill colors per tile type (drawn as SVG rects under decorations)
const TILE_BASE_COLOR = {
  plain:    '#eceae0',
  forest:   '#b8cca0',
  mountain: '#c4bca8',
  wall:     '#282018',
  fort:     '#d8c8a0',
  throne:   '#d8c860',
  village:  '#dfd3a8',
  water:    '#a8c8dc',
  road:     '#d8ceb8',
  gate:     '#d8c860',
};

/**
 * Renders the full SVG background layer for the entire map.
 * Draws base tile colors + decorative art (trees, rocks, water ripples…).
 */
export default function TerrainLayer({ tiles, tileSize }) {
  const height = tiles.length;
  const width  = tiles[0]?.length ?? 0;

  const cells = useMemo(() => {
    const items = [];
    tiles.forEach((row, y) => {
      row.forEach((tileType, x) => {
        items.push({ tileType, x, y });
      });
    });
    return items;
  }, [tiles]);

  return (
    <svg
      className="terrain-layer"
      width={width * tileSize}
      height={height * tileSize}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
    >
      {/* Base fill rectangles — give each tile its terrain color */}
      {cells.map(({ tileType, x, y }) => (
        <rect
          key={`base-${x}-${y}`}
          x={x * tileSize}
          y={y * tileSize}
          width={tileSize}
          height={tileSize}
          fill={TILE_BASE_COLOR[tileType] ?? '#eceae0'}
        />
      ))}

      {/* Terrain art decorations on top of base */}
      {cells.map(({ tileType, x, y }) => (
        <TerrainDecoration
          key={`deco-${x}-${y}`}
          tileType={tileType}
          x={x}
          y={y}
          tileSize={tileSize}
        />
      ))}
    </svg>
  );
}
