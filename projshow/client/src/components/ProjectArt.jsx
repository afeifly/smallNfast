import React, { useMemo } from 'react';

/**
 * Generates deterministic abstract SVG art based on a seed string.
 * Used as project card cover images.
 */
export default function ProjectArt({ seed, width = 320, height = 160, className = '' }) {
  const art = useMemo(() => generateArt(seed || 'default', width, height), [seed, width, height]);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>{art.defs}</defs>
      {art.elements}
    </svg>
  );
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hsl(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function generateArt(seed, w, h) {
  const hash = hashCode(seed);
  const rand = seededRandom(hash);

  const baseHue = (hash % 360);
  const hue2 = (baseHue + 40 + rand() * 60) % 360;
  const hue3 = (baseHue + 150 + rand() * 80) % 360;

  const gradId = `grad-${hash}`;
  const defs = (
    <>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={hsl(baseHue, 70, 20)} />
        <stop offset="50%" stopColor={hsl(hue2, 60, 15)} />
        <stop offset="100%" stopColor={hsl(hue3, 50, 12)} />
      </linearGradient>
    </>
  );

  const circles = [];
  const circleCount = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < circleCount; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r = 30 + rand() * 80;
    const opacity = 0.08 + rand() * 0.15;
    const fill = hsl((baseHue + rand() * 120) % 360, 60 + rand() * 30, 40 + rand() * 25);
    circles.push(
      <circle key={`c-${i}`} cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />
    );
  }

  // Accent lines
  const lines = [];
  const lineCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < lineCount; i++) {
    const x1 = rand() * w;
    const y1 = rand() * h;
    const x2 = rand() * w;
    const y2 = rand() * h;
    const stroke = hsl((hue2 + rand() * 60) % 360, 70, 55);
    lines.push(
      <line
        key={`l-${i}`}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke} strokeWidth={1 + rand() * 2}
        opacity={0.15 + rand() * 0.2}
      />
    );
  }

  // Small dot grid
  const dots = [];
  const gridSize = 20 + Math.floor(rand() * 15);
  for (let x = gridSize; x < w; x += gridSize) {
    for (let y = gridSize; y < h; y += gridSize) {
      if (rand() > 0.65) {
        dots.push(
          <circle
            key={`d-${x}-${y}`}
            cx={x + (rand() - 0.5) * 6}
            cy={y + (rand() - 0.5) * 6}
            r={1 + rand() * 1.5}
            fill={hsl(baseHue, 30, 50)}
            opacity={0.15 + rand() * 0.2}
          />
        );
      }
    }
  }

  const elements = (
    <>
      <rect width={w} height={h} fill={`url(#${gradId})`} />
      {circles}
      {lines}
      {dots}
    </>
  );

  return { defs, elements };
}
