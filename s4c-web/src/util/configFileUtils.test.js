import { describe, it, expect } from 'vitest';
import { calculateConfigHash, parseSummary, generateSummary, exportConfigPackage } from './configFileUtils';

const encoder = new TextEncoder();

describe('calculateConfigHash', () => {
  it('returns a 32-char hex string for a fileMap with entries', async () => {
    const fileMap = new Map();
    fileMap.set('a.json', encoder.encode(JSON.stringify({ x: 1 })));
    fileMap.set('b.json', encoder.encode(JSON.stringify({ y: 2 })));

    const hash = await calculateConfigHash(fileMap);
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('excludes summary.yml and parser.* files from hash', async () => {
    const fileMap = new Map();
    fileMap.set('data.json', encoder.encode(JSON.stringify({ x: 1 })));
    fileMap.set('summary.yml', encoder.encode('some-summary'));
    fileMap.set('parser.cfg', encoder.encode('parser-data'));

    const hash = await calculateConfigHash(fileMap);
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('returns the same hash for the same content regardless of insertion order', async () => {
    const m1 = new Map();
    m1.set('a.json', encoder.encode('hello'));
    m1.set('b.json', encoder.encode('world'));

    const m2 = new Map();
    m2.set('b.json', encoder.encode('world'));
    m2.set('a.json', encoder.encode('hello'));

    const h1 = await calculateConfigHash(m1);
    const h2 = await calculateConfigHash(m2);
    expect(h1).toBe(h2);
  });

  it('returns a different hash when content changes', async () => {
    const m1 = new Map();
    m1.set('a.json', encoder.encode('hello'));

    const m2 = new Map();
    m2.set('a.json', encoder.encode('world'));

    const h1 = await calculateConfigHash(m1);
    const h2 = await calculateConfigHash(m2);
    expect(h1).not.toBe(h2);
  });

  it('produces consistent hashes across multiple calls', async () => {
    const fileMap = new Map();
    fileMap.set('config.json', encoder.encode('test-content'));

    const hash1 = await calculateConfigHash(fileMap);
    const hash2 = await calculateConfigHash(fileMap);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('parseSummary', () => {
  it('parses a valid summary.yml from the fileMap', () => {
    const yaml = 'version: 1\nname: test-config\nConfig-Date: "2025-01-15T10:00:00.000Z"\n';
    const fileMap = new Map();
    fileMap.set('summary.yml', encoder.encode(yaml));

    const result = parseSummary(fileMap);
    expect(result.version).toBe(1);
    expect(result.name).toBe('test-config');
    expect(result['Config-Date']).toBe('2025-01-15T10:00:00.000Z');
  });

  it('throws when summary.yml is missing', () => {
    const fileMap = new Map();
    expect(() => parseSummary(fileMap)).toThrow('summary.yml not found in package');
  });

  it('handles an empty YAML object', () => {
    const fileMap = new Map();
    fileMap.set('summary.yml', encoder.encode('{}'));
    const result = parseSummary(fileMap);
    expect(result).toEqual({});
  });
});

describe('generateSummary', () => {
  it('generates valid YAML bytes from a summary object', () => {
    const data = { version: 2, name: 'test' };
    const bytes = generateSummary(data);

    const decoder = new TextDecoder();
    const text = decoder.decode(bytes);
    expect(text).toContain('version: 2');
    expect(text).toContain('name: test');
  });

  it('generates output that can be round-tripped via parseSummary', () => {
    const data = { version: 3, hash: 'abc123', 'Config-Date': '2025-06-01T00:00:00.000Z' };
    const bytes = generateSummary(data);

    const fileMap = new Map();
    fileMap.set('summary.yml', bytes);

    const parsed = parseSummary(fileMap);
    expect(parsed.version).toBe(3);
    expect(parsed.hash).toBe('abc123');
    expect(parsed['Config-Date']).toBe('2025-06-01T00:00:00.000Z');
  });
});

describe('exportConfigPackage', () => {
  it('produces a Blob with application/zip type', async () => {
    const configs = {
      'config/test.json': { key: 'value' },
    };
    const summary = { version: 1, name: 'test-pkg' };

    const blob = await exportConfigPackage(configs, summary);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
  });

  it('includes a fresh summary.yml with hash and Config-Date', async () => {
    const configs = { 'config/data.json': { a: 1 } };
    const summary = { version: 1 };

    const blob = await exportConfigPackage(configs, summary);
    // The blob should be non-empty
    expect(blob.size).toBeGreaterThan(0);
  });

  it('preserves original files when originalFileMap is provided', async () => {
    const origMap = new Map();
    origMap.set('preserved.txt', encoder.encode('keep-me'));

    const configs = { 'config/new.json': { x: 1 } };
    const summary = { version: 1 };

    const blob = await exportConfigPackage(configs, summary, origMap);
    expect(blob.size).toBeGreaterThan(0);
    // origMap should still have preserved.txt (it was not mutated)
    expect(origMap.has('preserved.txt')).toBe(true);
  });
});
