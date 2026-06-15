import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock sql.js before importing the module under test
const mockDb = {
  prepare: vi.fn(),
  exec: vi.fn(),
  run: vi.fn(),
  close: vi.fn(),
  export: vi.fn(),
};

const mockSQL = {
  Database: vi.fn(function() { return mockDb; }),
};

vi.mock('sql.js', () => ({
  default: vi.fn(() => Promise.resolve(mockSQL)),
}));

import {
  openAlarmDb,
  readAlarmConfigs,
  insertAlarmConfig,
  updateAlarmConfig,
  deleteAlarmConfig,
  flushAlarmDb,
  ensureSensorExists,
  ensureChannelExists,
  createEmptyAlarmDb,
} from './alarmDbUtils';

describe('readAlarmConfigs', () => {
  it('returns an empty array on error', () => {
    mockDb.prepare.mockImplementation(() => {
      throw new Error('SQL error');
    });
    const result = readAlarmConfigs(mockDb);
    expect(result).toEqual([]);
  });

  it('returns rows from the database', () => {
    const rows = [
      { config_id: 1, sensorName: 'S1', channelName: 'Flow', threshold: 10 },
      { config_id: 2, sensorName: 'S2', channelName: 'Pressure', threshold: 20 },
    ];

    let callIndex = 0;
    const mockStmt = {
      step: vi.fn(() => {
        callIndex++;
        return callIndex <= rows.length;
      }),
      getAsObject: vi.fn(() => rows[callIndex - 1]),
      free: vi.fn(),
    };

    mockDb.prepare.mockReturnValue(mockStmt);

    const result = readAlarmConfigs(mockDb);
    expect(result).toEqual(rows);
    expect(mockStmt.free).toHaveBeenCalled();
    expect(mockStmt.step).toHaveBeenCalledTimes(3); // 2 rows + 1 false
  });
});

describe('insertAlarmConfig', () => {
  it('returns the last inserted row id', () => {
    mockDb.exec.mockReturnValue([{ values: [[42]] }]);

    const alarm = {
      sensor_identify_id: 'sensor-1',
      channel_identify_id: 'ch-1',
    };

    const result = insertAlarmConfig(mockDb, alarm);
    expect(result).toBe(42);
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('uses default values for missing fields', () => {
    mockDb.exec.mockReturnValue([{ values: [[1]] }]);

    const alarm = { sensor_identify_id: 's1', channel_identify_id: 'c1' };
    insertAlarmConfig(mockDb, alarm);

    const callArgs = mockDb.run.mock.calls[mockDb.run.mock.calls.length - 1];
    const params = callArgs[1];
    expect(params[':measurement_point']).toBe('');
    expect(params[':threshold']).toBe(0);
    expect(params[':direction']).toBe('up');
  });
});

describe('updateAlarmConfig', () => {
  it('does nothing when no allowed fields are provided', () => {
    mockDb.run.mockClear();
    updateAlarmConfig(mockDb, 1, { unknown_field: 'x' });
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('updates allowed fields', () => {
    mockDb.run.mockClear();
    updateAlarmConfig(mockDb, 1, { threshold: 50, direction: 'down' });
    expect(mockDb.run).toHaveBeenCalled();
    const sql = mockDb.run.mock.calls[0][0];
    expect(sql).toContain('threshold');
    expect(sql).toContain('direction');
    expect(sql).toContain('WHERE config_id');
  });
});

describe('deleteAlarmConfig', () => {
  it('soft-deletes by setting is_deleted = 1', () => {
    mockDb.run.mockClear();
    deleteAlarmConfig(mockDb, 7);
    const sql = mockDb.run.mock.calls[0][0];
    expect(sql).toContain('is_deleted = 1');
    expect(mockDb.run.mock.calls[0][1][':id']).toBe(7);
  });
});

describe('ensureSensorExists', () => {
  it('inserts a sensor if it does not exist', () => {
    mockDb.exec.mockReturnValue([]);
    mockDb.run.mockClear();

    ensureSensorExists(mockDb, 'sensor-id', 'My Sensor');
    expect(mockDb.run).toHaveBeenCalled();
    const sql = mockDb.run.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO sensor');
  });

  it('skips insert if sensor already exists', () => {
    mockDb.exec.mockReturnValue([{ values: [[1]] }]);
    mockDb.run.mockClear();

    ensureSensorExists(mockDb, 'sensor-id', 'My Sensor');
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});

describe('ensureChannelExists', () => {
  it('inserts a channel if it does not exist', () => {
    mockDb.exec.mockReturnValue([]);
    mockDb.run.mockClear();

    ensureChannelExists(mockDb, 'ch-id', 'sensor-id', 'Flow', 'm3/h');
    expect(mockDb.run).toHaveBeenCalled();
    const sql = mockDb.run.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO channel');
  });

  it('skips insert if channel already exists', () => {
    mockDb.exec.mockReturnValue([{ values: [[1]] }]);
    mockDb.run.mockClear();

    ensureChannelExists(mockDb, 'ch-id', 'sensor-id', 'Flow', 'm3/h');
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});

describe('flushAlarmDb', () => {
  it('exports db and writes to fileMap', () => {
    const exportedData = new Uint8Array([1, 2, 3]);
    mockDb.export.mockReturnValue(exportedData);
    const fileMap = new Map();

    flushAlarmDb(mockDb, 'db/Alarm.db', fileMap);
    expect(fileMap.get('db/Alarm.db')).toBe(exportedData);
  });
});

describe('createEmptyAlarmDb', () => {
  it('initialises database and exports binary data', async () => {
    const exportedData = new Uint8Array([4, 5, 6]);
    mockDb.export.mockReturnValue(exportedData);
    mockDb.run.mockClear();
    mockDb.close.mockClear();

    const result = await createEmptyAlarmDb();
    expect(result).toBe(exportedData);
    expect(mockDb.run).toHaveBeenCalledTimes(3);
    expect(mockDb.export).toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
  });
});
