import { describe, it, expect } from 'vitest';
import DataUtil from './DataUtil';

describe('DataUtil.denoising2', () => {
  it('correctly includes zero values in denoised segment data', () => {
    const input = [
      { time: new Date(1000), value: 10 },
      { time: new Date(2000), value: 0 },
      { time: new Date(3000), value: 20 },
      { time: new Date(4000), value: null }
    ];

    const result = DataUtil.handleSegmentData(input, true, 1000);

    // The segment parser splits by non-null values.
    // The non-null values are at indices 0, 1, 2.
    // So handleSegmentData should process [10, 0, 20] through denoising2.
    // Let's verify that 0 is not skipped and is part of the output dataset.
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    
    const denoisedPoints = result[0];
    expect(denoisedPoints.length).toBe(3);
    
    expect(denoisedPoints[0].value).toBe(10);
    expect(denoisedPoints[1].value).toBe(0); // This was previously skipped because 0 is falsy!
    expect(denoisedPoints[2].value).toBe(20);
  });
});
