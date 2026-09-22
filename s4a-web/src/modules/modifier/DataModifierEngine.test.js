import { describe, it, expect } from 'vitest';
import DataModifierEngine from './DataModifierEngine';
import TestAPI from '../../api/TestAPI';

describe('DataModifierEngine', () => {
  it('evaluates arithmetic operations correctly', () => {
    expect(DataModifierEngine.evalOp(10, 20, '+')).toBe(30);
    expect(DataModifierEngine.evalOp(50, 15, '-')).toBe(35);
    expect(DataModifierEngine.evalOp(4, 5, '*')).toBe(20);
    expect(DataModifierEngine.evalOp(100, 4, '/')).toBe(25);
    expect(DataModifierEngine.evalOp(100, 0, '/')).toBeNull();
    expect(DataModifierEngine.evalOp(null, 5, '+')).toBeNull();
    expect(DataModifierEngine.evalOp(5, undefined, '+')).toBeNull();
  });

  it('generates monotonic consumption growth terminating at the exact target value', () => {
    const startVal = 1000.0;
    const targetVal = 1500.0;
    const steps = 100;

    const generator = DataModifierEngine._createConsumptionGenerator(
      startVal,
      targetVal,
      steps,
      'jittered'
    );

    let prev = startVal;
    for (let s = 1; s <= steps; s++) {
      const cur = generator(s);
      // Must be monotonically increasing (or equal)
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }

    // Final step must hit the exact target
    expect(generator(steps)).toBeCloseTo(targetVal, 5);
  });

  it('generates linear consumption step sequence accurately', () => {
    const startVal = 200.0;
    const targetVal = 300.0;
    const steps = 10;

    const generator = DataModifierEngine._createConsumptionGenerator(
      startVal,
      targetVal,
      steps,
      'linear'
    );

    expect(generator(0)).toBe(200.0);
    expect(generator(5)).toBe(250.0);
    expect(generator(10)).toBe(300.0);
  });

  it('correctly handles getChannels returning an object with logging_chs', async () => {
    const origGetChannels = TestAPI.getChannels;
    const origGetTimeRange = TestAPI.getFileTimeRange;
    const origGetNum = TestAPI.getNumOfSamples;
    const origGetTable = TestAPI.getTablePage;

    TestAPI.getChannels = (cb) => {
      cb({
        logging_chs: [
          { channel_id: 0, logic_channel_description: 'Flow', unit_in_ascii: 'm³/h', min: 0, max: 100 },
          { channel_id: 1, logic_channel_description: 'Power', unit_in_ascii: 'kW', min: 0, max: 50 },
        ],
      });
    };
    TestAPI.getFileTimeRange = () => ({ start: 1000, stop: 5000 });
    TestAPI.getNumOfSamples = () => 100;
    TestAPI.getTablePage = (idx, size, ids, cb) => {
      cb({ rows: [{ values: { 0: 10, 1: 20 } }] });
    };

    try {
      const meta = await DataModifierEngine.getBaseMetadata();
      expect(meta).toBeDefined();
      expect(meta.channels.length).toBe(2);
      expect(meta.channels[0].name).toBe('Flow');
      expect(meta.channels[1].name).toBe('Power');
    } finally {
      TestAPI.getChannels = origGetChannels;
      TestAPI.getFileTimeRange = origGetTimeRange;
      TestAPI.getNumOfSamples = origGetNum;
      TestAPI.getTablePage = origGetTable;
    }
  });

  it('filters out removed channels during preview generation', async () => {
    const origGetChannels = TestAPI.getChannels;
    const origGetTimeRange = TestAPI.getFileTimeRange;
    const origGetNum = TestAPI.getNumOfSamples;
    const origGetTable = TestAPI.getTablePage;

    TestAPI.getChannels = (cb) => {
      cb({
        logging_chs: [
          { channel_id: 0, logic_channel_description: 'Ch0', unit_in_ascii: 'A' },
          { channel_id: 1, logic_channel_description: 'Ch1', unit_in_ascii: 'B' },
        ],
      });
    };
    TestAPI.getFileTimeRange = () => ({ start: 0, stop: 10000 });
    TestAPI.getNumOfSamples = () => 10;
    TestAPI.getTablePage = (idx, size, ids, cb) => {
      cb({
        rows: [
          { time: 0, values: { 0: 10, 1: 20 } },
          { time: 1000, values: { 0: 12, 1: 22 } },
        ],
      });
    };

    try {
      const meta = await DataModifierEngine.getBaseMetadata();
      const preview = await DataModifierEngine.generatePreview(meta, {
        extraMinutes: 0,
        combinedChannels: [
          {
            id: 'comb-1',
            name: 'Sum',
            chAId: 0,
            chBId: 1,
            op: '+',
            unit: 'C',
          },
        ],
        scaledChannels: [],
        consumptionSolvers: [],
        removedChannelIds: [0, 'comb-1'],
      });

      expect(preview.channels.length).toBe(1);
      expect(preview.channels[0].channel_id).toBe(1);
      expect(preview.channels[0].name).toBe('Ch1');
    } finally {
      TestAPI.getChannels = origGetChannels;
      TestAPI.getFileTimeRange = origGetTimeRange;
      TestAPI.getNumOfSamples = origGetNum;
      TestAPI.getTablePage = origGetTable;
    }
  });

  it('correctly applies cutdown to trim duration and samples in preview', async () => {
    const origGetChannels = TestAPI.getChannels;
    const origGetTimeRange = TestAPI.getFileTimeRange;
    const origGetNum = TestAPI.getNumOfSamples;
    const origGetTable = TestAPI.getTablePage;

    TestAPI.getChannels = (cb) => {
      cb({
        logging_chs: [
          { channel_id: 0, logic_channel_description: 'Flow', unit_in_ascii: 'm³/h' },
        ],
      });
    };
    // 3600 seconds = 1 hour, 3600 samples at 1Hz
    TestAPI.getFileTimeRange = () => ({ start: 1000000, stop: 1000000 + 3600 * 1000 });
    TestAPI.getNumOfSamples = () => 3600;
    TestAPI.getTablePage = (idx, size, ids, cb) => {
      cb({
        rows: [
          { timestampMs: 1000000, values: { 0: 50 } },
        ],
      });
    };

    try {
      const meta = await DataModifierEngine.getBaseMetadata();
      // Cut 30 minutes from end
      const preview = await DataModifierEngine.generatePreview(meta, {
        cutdown: {
          enabled: true,
          cutMinutes: 30,
          position: 'end',
        },
      });

      expect(preview.hasCutdown).toBe(true);
      expect(preview.newNumSamples).toBe(1800);
      expect(preview.newStopTimeMs).toBe(1000000 + 1799 * 1000);
    } finally {
      TestAPI.getChannels = origGetChannels;
      TestAPI.getFileTimeRange = origGetTimeRange;
      TestAPI.getNumOfSamples = origGetNum;
      TestAPI.getTablePage = origGetTable;
    }
  });

  it('correctly compiles and evaluates formulas like ch1 x 2, ch1 + ch2, and expressions with parentheses', () => {
    const channels = [
      { channel_id: 0, index: 0, name: 'Flow' },
      { channel_id: 1, index: 1, name: 'Pressure' },
      { channel_id: 2, index: 2, name: 'Power' },
    ];

    // Scale formula: ch1 x 2
    const resScale = DataModifierEngine.compileFormula('ch1 x 2', channels);
    expect(resScale.valid).toBe(true);
    expect(resScale.eval({ 0: 15.5 })).toBe(31.0);

    // Alternative multiplier character: ch1 * 2
    const resStar = DataModifierEngine.compileFormula('ch1 * 2', channels);
    expect(resStar.valid).toBe(true);
    expect(resStar.eval({ 0: 20 })).toBe(40);

    // Combine formula: ch1 + ch2
    const resCombine = DataModifierEngine.compileFormula('ch1 + ch2', channels);
    expect(resCombine.valid).toBe(true);
    expect(resCombine.eval({ 0: 10, 1: 25 })).toBe(35);

    // Complex formula with parentheses: (ch1 + ch2) / 2
    const resAvg = DataModifierEngine.compileFormula('(ch1 + ch2) / 2', channels);
    expect(resAvg.valid).toBe(true);
    expect(resAvg.eval({ 0: 20, 1: 40 })).toBe(30);

    // Channel reference by name in brackets: [Flow] * 1.5 + [Pressure]
    const resName = DataModifierEngine.compileFormula('[Flow] * 1.5 + [Pressure]', channels);
    expect(resName.valid).toBe(true);
    expect(resName.eval({ 0: 10, 1: 5 })).toBe(20);

    // Error handling on invalid syntax
    const resErr = DataModifierEngine.compileFormula('ch1 +', channels);
    expect(resErr.valid).toBe(false);

    // Test ch5 x 10 with 6 channels
    const channels6 = Array.from({ length: 6 }, (_, i) => ({
      channel_id: i,
      name: `Sensor ${i + 1}`,
      unit: 'bar',
    }));
    const resCh5 = DataModifierEngine.compileFormula('ch5 x 10', channels6);
    expect(resCh5.valid).toBe(true);
    expect(resCh5.eval({ 4: 7.5 })).toBe(75);

    // Non-existent channel
    const resNonExistent = DataModifierEngine.compileFormula('ch99 * 2', channels);
    expect(resNonExistent.valid).toBe(false);
  });

  it('evaluates formulaChannels correctly in preview generation', async () => {
    const origGetChannels = TestAPI.getChannels;
    const origGetTimeRange = TestAPI.getFileTimeRange;
    const origGetNum = TestAPI.getNumOfSamples;
    const origGetTable = TestAPI.getTablePage;

    TestAPI.getChannels = (cb) => {
      cb({
        logging_chs: [
          { channel_id: 0, logic_channel_description: 'Flow', unit_in_ascii: 'm³/h' },
          { channel_id: 1, logic_channel_description: 'Pressure', unit_in_ascii: 'bar' },
        ],
      });
    };
    TestAPI.getFileTimeRange = () => ({ start: 1000, stop: 5000 });
    TestAPI.getNumOfSamples = () => 2;
    TestAPI.getTablePage = (idx, size, ids, cb) => {
      cb({
        rows: [
          { timestampMs: 1000, values: { 0: 20, 1: 5 } },
          { timestampMs: 3000, values: { 0: 30, 1: 7 } },
        ],
      });
    };

    try {
      const meta = await DataModifierEngine.getBaseMetadata();
      const preview = await DataModifierEngine.generatePreview(meta, {
        formulaChannels: [
          {
            id: 'fc_scaled',
            expression: 'ch1 x 2',
            mode: 'replace',
            targetChId: 0,
          },
          {
            id: 'fc_sum',
            name: 'Total Metric',
            unit: 'units',
            expression: 'ch1 + ch2',
            mode: 'new_channel',
          },
        ],
      });

      expect(preview.channels.length).toBe(3);
      // First row values: ch1 replaced with 20 * 2 = 40, new channel = 20 + 5 = 25
      const row0 = preview.allRows[0].values;
      expect(row0[0]).toBe(40);
      expect(row0['fc_sum']).toBe(25);
    } finally {
      TestAPI.getChannels = origGetChannels;
      TestAPI.getFileTimeRange = origGetTimeRange;
      TestAPI.getNumOfSamples = origGetNum;
      TestAPI.getTablePage = origGetTable;
    }
  });

  it('correctly replaces ch5 in preview generation for a 6-channel dataset', async () => {
    const origGetChannels = TestAPI.getChannels;
    const origGetTimeRange = TestAPI.getFileTimeRange;
    const origGetNum = TestAPI.getNumOfSamples;
    const origGetTable = TestAPI.getTablePage;

    TestAPI.getChannels = (cb) => {
      cb({
        logging_chs: Array.from({ length: 6 }, (_, i) => ({
          channel_id: i,
          logic_channel_description: `Channel ${i + 1}`,
          unit_in_ascii: 'bar',
        })),
      });
    };
    TestAPI.getFileTimeRange = () => ({ start: 1000, stop: 5000 });
    TestAPI.getNumOfSamples = () => 2;
    TestAPI.getTablePage = (idx, size, ids, cb) => {
      const rows = [
        { timestampMs: 1000, values: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 } },
        { timestampMs: 3000, values: { 0: 10, 1: 20, 2: 30, 3: 40, 4: 50, 5: 60 } },
      ];
      cb({
        rows: [rows[idx] || rows[0]],
      });
    };

    try {
      const meta = await DataModifierEngine.getBaseMetadata();
      const preview = await DataModifierEngine.generatePreview(meta, {
        formulaChannels: [
          {
            id: 'fc_ch5_10',
            expression: 'ch5 x 10',
            mode: 'replace',
            targetChId: 4,
          },
        ],
      });

      expect(preview.channels.length).toBe(6);
      expect(preview.channels[4].isModified).toBe(true);
      expect(preview.channels[4].name).toBe('Channel 5'); // Preserves original name when replacing
      expect(preview.allRows[0].values[4]).toBe(50); // 5 * 10
      expect(preview.allRows[1].values[4]).toBe(500); // 50 * 10
    } finally {
      TestAPI.getChannels = origGetChannels;
      TestAPI.getFileTimeRange = origGetTimeRange;
      TestAPI.getNumOfSamples = origGetNum;
      TestAPI.getTablePage = origGetTable;
    }
  });

  it('accurately identifies consumption/totalizer channels based on units, names, and monotonic values', () => {
    // 1. Consumption/Totalizer volume units
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Air Volume', unit: 'm³' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Air Volume', unit: 'm3' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Norm Volume', unit: 'Nm³' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Water Volume', unit: 'L' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Oil Counter', unit: 'l' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Gas Total', unit: 'gal' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Flow Total', unit: 'scf' })).toBe(true);

    // 2. Energy totalizers
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Active Energy', unit: 'kWh' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Grid Energy', unit: 'MWh' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Heat Energy', unit: 'MJ' })).toBe(true);

    // 3. Rate units must NOT be classified as totalizers (they are instantaneous!)
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Air Flow Rate', unit: 'm³/h' })).toBe(false);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Water Flow Rate', unit: 'l/min' })).toBe(false);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Active Power', unit: 'kW' })).toBe(false);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Pressure', unit: 'bar' })).toBe(false);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Temperature', unit: '°C' })).toBe(false);

    // 4. Description keywords
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Totalizer 1', unit: '' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: 'Total Consumption', unit: '' })).toBe(true);
    expect(DataModifierEngine.isConsumptionChannel({ name: '累计流量', unit: '' })).toBe(true);
  });

  it('correctly applies cellOverrides to replace raw values for specific records and channels', () => {
    const config = {
      cellOverrides: {
        5: { 0: 99.5, 1: 123.4 },
        10: { 0: 42.0 }
      },
      channels: [
        { id: 0, name: 'ch0' },
        { id: 1, name: 'ch1' }
      ],
      formulas: [],
      cutdown: { enabled: false },
      consumptionTarget: { enabled: false }
    };

    // Record index 5 with raw values { 0: 10, 1: 20 }
    const res5 = DataModifierEngine.computeRow({ 0: 10, 1: 20 }, false, 0, 5, config);
    expect(res5[0]).toBe(99.5);
    expect(res5[1]).toBe(123.4);

    // Record index 10 with raw values { 0: 10, 1: 20 } - only channel 0 is overridden
    const res10 = DataModifierEngine.computeRow({ 0: 10, 1: 20 }, false, 0, 10, config);
    expect(res10[0]).toBe(42.0);
    expect(res10[1]).toBe(20);

    // Record index 6 without override
    const res6 = DataModifierEngine.computeRow({ 0: 10, 1: 20 }, false, 0, 6, config);
    expect(res6[0]).toBe(10);
    expect(res6[1]).toBe(20);
  });

  it('delegates readSampleRange and patchSampleValues to the underlying API', async () => {
    const origReadExport = TestAPI.readExportRows;
    const origPatch = TestAPI.patchSampleValues;

    try {
      TestAPI.readExportRows = (start, count) => {
        return Promise.resolve([
          { index: start, recordId: start, timestampMs: 1000 + start * 1000, values: { 0: 12.5 } }
        ]);
      };

      const rows = await DataModifierEngine.readSampleRange(10, 1);
      expect(rows).toHaveLength(1);
      expect(rows[0].index).toBe(10);
      expect(rows[0].values[0]).toBe(12.5);

      TestAPI.patchSampleValues = (overrides) => {
        return Promise.resolve({ success: true, persisted: true, count: Object.keys(overrides).length });
      };

      const patchRes = await DataModifierEngine.patchSampleValues({ 10: { 0: 15.0 } });
      expect(patchRes.success).toBe(true);
      expect(patchRes.persisted).toBe(true);
      expect(patchRes.count).toBe(1);
    } finally {
      TestAPI.readExportRows = origReadExport;
      TestAPI.patchSampleValues = origPatch;
    }
  });
});

describe('integral() formula', () => {
  const channels = [
    { channel_id: 1, name: 'Flow', unit: 'm/s', min: 0, max: 10, firstVal: 2, lastVal: 2 },
    { channel_id: 2, name: 'Temp',  unit: '°C',  min: 0, max: 100, firstVal: 20, lastVal: 20 },
  ];

  it('tokenizes integral(ch1) successfully', () => {
    const res = DataModifierEngine.tokenizeFormula('integral(ch1)', channels);
    expect(res.valid).toBe(true);
    expect(res.tokens).toHaveLength(1);
    expect(res.tokens[0].type).toBe('INTEGRAL');
    expect(res.tokens[0].chId).toBe(1);
  });

  it('compileFormula returns isIntegral flag for integral(ch1)', () => {
    const compiled = DataModifierEngine.compileFormula('integral(ch1)', channels, 1);
    expect(compiled.valid).toBe(true);
    expect(compiled.isIntegral).toBe(true);
  });

  it('integral accumulates correctly using trapezoidal rule with dt=1s', () => {
    // Flow is constant 10 m/s, dt=1s → each step adds 10 m
    const compiled = DataModifierEngine.compileFormula('integral(ch1)', channels, 1);
    expect(compiled.valid).toBe(true);

    // Step 1: prev=null → prev is set to current (10), accumulate (10+10)/2 * 1 = 10
    expect(compiled.eval({ 1: 10 })).toBeCloseTo(10, 5);
    // Step 2: (10+10)/2 * 1 = 10 more → total 20
    expect(compiled.eval({ 1: 10 })).toBeCloseTo(20, 5);
    // Step 3: total 30
    expect(compiled.eval({ 1: 10 })).toBeCloseTo(30, 5);
  });

  it('integral resets to 0 after resetAccumulator()', () => {
    const compiled = DataModifierEngine.compileFormula('integral(ch1)', channels, 1);
    compiled.eval({ 1: 5 });
    compiled.eval({ 1: 5 });
    expect(compiled.eval({ 1: 5 })).toBeGreaterThan(0);
    compiled.resetAccumulator();
    // After reset, first call re-initializes prev
    const firstAfterReset = compiled.eval({ 1: 5 });
    expect(firstAfterReset).toBeCloseTo(5, 5);
  });

  it('rejects integral() combined with other operators', () => {
    const compiled = DataModifierEngine.compileFormula('integral(ch1) + ch2', channels, 1);
    expect(compiled.valid).toBe(false);
    expect(compiled.error).toMatch(/cannot be combined/i);
  });

  it('rejects integral() with invalid channel', () => {
    const res = DataModifierEngine.tokenizeFormula('integral(ch99)', channels);
    expect(res.valid).toBe(false);
  });
});
