/**
 * Wide-window chart downsampling.
 *
 * When a view window holds more raw samples than the display cap, the data
 * layer must reduce them before drawing. Two strategies:
 *
 *  - MIN_MAX (default): every bucket of `step` raw samples contributes its
 *    minimum and maximum point. Peaks are never lost — the curve keeps the
 *    true envelope (the stock denoising renderer draws y0=min/y1=max areas).
 *  - STRIDE (legacy): every `step`-th raw sample. Faster for gigantic spans
 *    (reads less bytes), but peaks between kept samples disappear.
 *
 * The mode is a module-level switch for now; it can later be surfaced as a
 * user option ("fast loading" vs "exact envelope").
 */

export const DOWNSAMPLING_MODE = {
  MIN_MAX: 'min-max',
  STRIDE: 'stride',
};

let currentMode = DOWNSAMPLING_MODE.MIN_MAX;

export function getDownsamplingMode() {
  return currentMode;
}

export function setDownsamplingMode(mode) {
  if (Object.values(DOWNSAMPLING_MODE).includes(mode)) {
    currentMode = mode;
  } else {
    console.warn('[downsample] unknown mode, keeping', currentMode, '(got', mode, ')');
  }
}

/**
 * Reduce raw samples [start..end] (inclusive) into bucket extremes.
 *
 * @param {(index: number) => number|null} readValue - random access to one
 *        raw sample by absolute index (null/NaN = invalid sample).
 * @param {number} step - bucket size in raw samples (>1).
 * @returns {{index: number, value: number|null}[]} kept points, chronological
 *          order guaranteed (min/max of a bucket ordered by their index).
 *          An all-invalid bucket yields a single null point at its start.
 */
export function scanBuckets(readValue, start, end, step) {
  const out = [];
  if (!(step > 1)) step = 1;
  for (let b = start; b <= end; b += step) {
    const bucketEnd = Math.min(end, b + step - 1);
    let minV = 0;
    let maxV = 0;
    let minI = -1;
    let maxI = -1;
    for (let s = b; s <= bucketEnd; s++) {
      const v = readValue(s);
      if (v === null || v === undefined || Number.isNaN(v)) {
        continue;
      }
      if (minI === -1 || v < minV) {
        minV = v;
        minI = s;
      }
      if (maxI === -1 || v > maxV) {
        maxV = v;
        maxI = s;
      }
    }
    if (minI === -1) {
      out.push({ index: b, value: null });
    } else if (minI === maxI) {
      out.push({ index: minI, value: minV });
    } else if (minI < maxI) {
      out.push({ index: minI, value: minV }, { index: maxI, value: maxV });
    } else {
      out.push({ index: maxI, value: maxV }, { index: minI, value: minV });
    }
  }
  return out;
}
