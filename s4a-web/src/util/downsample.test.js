import { describe, it, expect } from 'vitest';
import { DOWNSAMPLING_MODE, getDownsamplingMode, setDownsamplingMode, scanBuckets } from './downsample';

describe('downsample mode switch', () => {
  it('defaults to MIN_MAX and only accepts known modes', () => {
    expect(getDownsamplingMode()).toBe(DOWNSAMPLING_MODE.MIN_MAX);
    setDownsamplingMode(DOWNSAMPLING_MODE.STRIDE);
    expect(getDownsamplingMode()).toBe(DOWNSAMPLING_MODE.STRIDE);
    setDownsamplingMode('bogus');
    expect(getDownsamplingMode()).toBe(DOWNSAMPLING_MODE.STRIDE);
    setDownsamplingMode(DOWNSAMPLING_MODE.MIN_MAX); // restore default
  });
});

describe('scanBuckets', () => {
  const readerFrom = (arr, offset = 0) => (i) => arr[i - offset];

  it('keeps both extremes of every bucket with their real indices', () => {
    // bucket 0 (idx 0-3): peak 47 at idx 2; bucket 1 (idx 4-7): valley 3 at idx 5
    const data = [5, 8, 47, 12, 9, 3, 51, 6];
    const out = scanBuckets(readerFrom(data), 0, 7, 4);
    expect(out).toEqual([
      { index: 0, value: 5 },   // bucket min (first occurrence)
      { index: 2, value: 47 },  // bucket max — the peak survives
      { index: 5, value: 3 },   // valley survives
      { index: 6, value: 51 },
    ]);
  });

  it('orders min/max chronologically within a bucket', () => {
    const data = [10, 1, 2, 3]; // min at idx 1, max at idx 0 → max first
    const out = scanBuckets(readerFrom(data), 0, 3, 4);
    expect(out).toEqual([
      { index: 0, value: 10 },
      { index: 1, value: 1 },
    ]);
  });

  it('skips invalid samples and emits one null for an all-invalid bucket', () => {
    const data = [null, 1, NaN, 4];
    const out = scanBuckets(readerFrom(data), 0, 3, 2);
    expect(out).toEqual([
      { index: 1, value: 1 },   // bucket 0: min=max=1 (only valid)
      { index: 3, value: 4 },   // bucket 1: single valid value
    ]);
    const empty = scanBuckets(() => null, 0, 5, 3);
    expect(empty).toEqual([
      { index: 0, value: null },
      { index: 3, value: null },
    ]);
  });

  it('handles a partial trailing bucket', () => {
    const data = [1, 50, 2];
    const out = scanBuckets(readerFrom(data), 0, 2, 5);
    expect(out).toEqual([{ index: 0, value: 1 }, { index: 1, value: 50 }]);
  });
});
