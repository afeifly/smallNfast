const DISPLAY_POINTS = 3000;

function identityKey(channel) {
  const identity = channel.identity;
  if (!identity || [identity.device, identity.sensor, identity.channel].some(value =>
    value === null || value === undefined || value === '') ||
    typeof identity.name !== 'string' || !identity.name.trim() ||
    typeof identity.sensorName !== 'string' || !identity.sensorName.trim() ||
    typeof identity.unit !== 'string' || !identity.unit.trim()) return null;
  return JSON.stringify([
    identity.device, identity.sensor, identity.channel,
    identity.name.trim(), identity.sensorName.trim(), identity.unit.trim()
  ]);
}

function overlaps(a, b) {
  return a.sampleStart !== null && b.sampleStart !== null &&
    a.sampleStart <= b.sampleStop && b.sampleStart <= a.sampleStop;
}

function rangeValue(a, b, combine) {
  const values = [a, b].filter(value => typeof value === 'number' && Number.isFinite(value) && value > -8888);
  return values.length ? combine(...values) : null;
}

export default class CombinedDatabase {
  constructor(sources) {
    if (!sources.length) throw new Error('No STDB sessions to combine.');
    this.sources = sources;
    this.interval = sources[0].result.interval;
    this.session = sources[0].result.session;
    this.start = Math.min(...sources.map(source => source.result.start));
    this.stop = Math.max(...sources.map(source => source.result.stop));
    this.numSamples = sources.reduce((sum, source) => sum + source.result.numSamples, 0);
    this.channels = [];
    this.bindings = sources.map(() => new Map());
    const groups = new Map();
    let sensorId = 0;

    sources.forEach((source, sourceIndex) => {
      if (source.result.interval !== this.interval) throw new Error('Sessions must have the same sample interval.');
      const frequencies = new Map();
      source.result.channels.forEach(channel => {
        const key = identityKey(channel);
        if (key) frequencies.set(key, (frequencies.get(key) || 0) + 1);
      });
      const sensors = new Map();
      source.result.channels.forEach(channel => {
        const key = identityKey(channel);
        const candidates = key && frequencies.get(key) === 1 ? (groups.get(key) || []).filter(group =>
          group.sources.every(index => !overlaps(sources[index].result, source.result))
        ) : [];
        let group = candidates.length === 1 ? candidates[0] : null;
        if (!group) {
          if (!sensors.has(channel.sensor_id)) sensors.set(channel.sensor_id, sensorId++);
          const combined = { ...channel, channel_id: this.channels.length, sensor_id: sensors.get(channel.sensor_id) };
          group = { channel: combined, sources: [] };
          this.channels.push(combined);
          if (key) groups.set(key, [...(groups.get(key) || []), group]);
        } else {
          group.channel.min = rangeValue(group.channel.min, channel.min, Math.min);
          group.channel.max = rangeValue(group.channel.max, channel.max, Math.max);
        }
        group.sources.push(sourceIndex);
        this.bindings[sourceIndex].set(channel.channel_id, group.channel.channel_id);
      });
    });

    const duplicateNames = new Map();
    this.channels.forEach(channel => {
      const key = JSON.stringify([channel.sensor_description, channel.logic_channel_description]);
      duplicateNames.set(key, (duplicateNames.get(key) || 0) + 1);
    });
    this.channels.forEach(channel => {
      const key = JSON.stringify([channel.sensor_description, channel.logic_channel_description]);
      if (duplicateNames.get(key) > 1) {
        const index = this.bindings.findIndex(map => [...map.values()].includes(channel.channel_id));
        const name = sources[index].result.session.LoggerFileName || `Session ${index + 1}`;
        channel.logic_channel_description = `${channel.logic_channel_description} [${name} #${channel.channel_id + 1}]`;
      }
    });
  }

  mapRows(sourceIndex, rows) {
    const bindings = this.bindings[sourceIndex];
    return rows.map(row => ({
      ...row,
      values: Object.fromEntries(Object.entries(row.values).map(([id, value]) => [bindings.get(Number(id)), value]))
    }));
  }

  async page(pageIndex, pageSize, selected) {
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 ||
        !Number.isSafeInteger(pageIndex * pageSize)) throw new Error('Invalid table page.');
    const offset = pageIndex * pageSize;
    const result = { total: this.numSamples, sampleRate: 1 / this.interval, startTimeMs: this.start, stopTimeMs: this.stop, rows: [] };
    if (offset >= this.numSamples) return result;

    const ordered = this.sources.map((source, index) => ({ ...source, index }))
      .filter(source => source.result.numSamples)
      .sort((a, b) => a.result.sampleStart - b.result.sampleStart);
    if (ordered.every((source, index) => index === 0 || ordered[index - 1].result.sampleStop < source.result.sampleStart)) {
      let skip = offset;
      for (const source of ordered) {
        if (skip >= source.result.numSamples) {
          skip -= source.result.numSamples;
          continue;
        }
        const localIds = selected == null ? null : [...this.bindings[source.index]]
          .filter(([, id]) => selected.includes(id)).map(([id]) => id);
        const rows = await source.database.rowsAtOffset(skip, pageSize - result.rows.length, localIds);
        const base = offset + result.rows.length;
        result.rows.push(...this.mapRows(source.index, rows).map((row, i) => ({ ...row, index: base + i })));
        skip = 0;
        if (result.rows.length >= pageSize) break;
      }
      return result;
    }

    const nonempty = this.sources.filter(source => source.result.numSamples);
    let low = Math.min(...nonempty.map(source => source.result.sampleStart));
    let high = Math.max(...nonempty.map(source => source.result.sampleStop));
    if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high)) throw new Error('Invalid STDB sample timestamp.');
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      let count = 0;
      for (const source of this.sources) count += await source.database.countBefore(middle, true);
      if (count > offset) high = middle;
      else low = middle + 1;
    }

    const before = [];
    const at = [];
    for (const source of this.sources) {
      const less = await source.database.countBefore(low);
      before.push(less);
      at.push(await source.database.countBefore(low, true) - less);
    }
    let skip = offset - before.reduce((sum, count) => sum + count, 0);
    const pages = [];
    for (let i = 0; i < this.sources.length; i++) {
      const skipped = Math.min(skip, at[i]);
      skip -= skipped;
      const localIds = selected == null ? null : [...this.bindings[i]]
        .filter(([, id]) => selected.includes(id)).map(([id]) => id);
      const rows = await this.sources[i].database.rowsAtOffset(before[i] + skipped, pageSize, localIds);
      pages.push(this.mapRows(i, rows));
    }
    const positions = pages.map(() => 0);
    while (result.rows.length < pageSize) {
      let sourceIndex = -1;
      for (let i = 0; i < pages.length; i++) {
        const row = pages[i][positions[i]];
        if (row && (sourceIndex < 0 || row.timestampMs < pages[sourceIndex][positions[sourceIndex]].timestampMs)) sourceIndex = i;
      }
      if (sourceIndex < 0) break;
      result.rows.push({ ...pages[sourceIndex][positions[sourceIndex]++], index: offset + result.rows.length });
    }
    return result;
  }

  async exportPage(cursor, limit) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 ||
        (cursor && (!Array.isArray(cursor) || cursor.length !== this.sources.length))) throw new Error('Invalid export page.');
    const cursors = cursor ? cursor.map(value => value && { ...value }) : this.sources.map(() => null);
    const pages = [];
    for (let i = 0; i < this.sources.length; i++) {
      const page = await this.sources[i].database.exportPage(cursors[i], limit);
      pages.push(this.mapRows(i, page.rows));
    }
    const positions = pages.map(() => 0);
    const rows = [];
    while (rows.length < limit) {
      let sourceIndex = -1;
      for (let i = 0; i < pages.length; i++) {
        const row = pages[i][positions[i]];
        if (row && (sourceIndex < 0 || row.timestampMs < pages[sourceIndex][positions[sourceIndex]].timestampMs)) sourceIndex = i;
      }
      if (sourceIndex < 0) break;
      const row = pages[sourceIndex][positions[sourceIndex]++];
      rows.push(row);
      cursors[sourceIndex] = { timestamp: row.timestampMs, id: row.recordId };
    }
    return { rows, cursor: rows.length ? cursors : null };
  }

  async measurement(channelId, start, stop) {
    const id = Number(channelId);
    const channel = this.channels.find(item => item.channel_id === id);
    if (!channel) throw new Error('Invalid measurement request.');
    const bindings = [];
    this.bindings.forEach((map, index) => {
      for (const [localId, combinedId] of map) {
        if (combinedId === id) bindings.push({ index, localId });
      }
    });
    bindings.sort((a, b) => (this.sources[a.index].result.sampleStart ?? Infinity) - (this.sources[b.index].result.sampleStart ?? Infinity));
    const data = [];
    const times = [];
    for (const binding of bindings) {
      const [part] = await this.sources[binding.index].database.measurement(
        binding.localId, start, stop, Math.max(3, Math.floor(DISPLAY_POINTS / bindings.length))
      );
      if (!part.times.length) continue;
      const partTimes = part.times[0];
      if (times.length && partTimes[0] - times[times.length - 1] > this.interval * 1500) {
        times.push(times[times.length - 1] + this.interval * 1000);
        data.push(null);
      }
      times.push(...partTimes);
      data.push(...part.measurementData[0]);
    }
    if (data.length > DISPLAY_POINTS) {
      const reducedData = [];
      const reducedTimes = [];
      const step = Math.ceil(data.length / (DISPLAY_POINTS / 3));
      for (let begin = 0; begin < data.length; begin += step) {
        let min = -1;
        let max = -1;
        let gap = -1;
        for (let i = begin; i < Math.min(begin + step, data.length); i++) {
          if (data[i] === null) {
            if (gap < 0) gap = i;
          } else {
            if (min < 0 || data[i] < data[min]) min = i;
            if (max < 0 || data[i] > data[max]) max = i;
          }
        }
        [...new Set([min, max, gap].filter(index => index >= 0))].sort((a, b) => a - b).forEach(index => {
          reducedData.push(data[index]);
          reducedTimes.push(times[index]);
        });
      }
      data.length = 0;
      times.length = 0;
      data.push(...reducedData);
      times.push(...reducedTimes);
    }
    return [{
      channel_id: id,
      measurementData: data.length ? [data] : [],
      realStartTime: times.length ? [times[0]] : [],
      pointInterval: data.length ? [this.interval * 1000] : [],
      times: times.length ? [times] : [],
      min: channel.min,
      max: channel.max
    }];
  }
}
