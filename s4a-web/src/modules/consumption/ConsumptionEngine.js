/**
 * ConsumptionEngine.js
 *
 * Pure computation for consumption/energy reports.
 * Works for both CSD and CSV data — only needs rows with { timestampMs, values: {chId: number} }.
 *
 * Algorithm: totalizer subtraction
 *   consumption = last valid reading at END of bucket – first valid reading at START of bucket
 */

export function generateTimeBuckets(startMs, endMs, period) {
  const buckets = [];
  // Align cursor to start of day or start of hour
  const cursor = new Date(startMs);
  if (period === 'hourly') {
    cursor.setMinutes(0, 0, 0);
  } else {
    cursor.setHours(0, 0, 0, 0);
  }

  while (cursor.getTime() < endMs) {
    const bucketStart = cursor.getTime();
    const next = new Date(cursor);

    if (period === 'hourly') {
      next.setHours(next.getHours() + 1);
    } else if (period === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (period === 'weekly') {
      // Advance to next Monday-aligned start
      const dow = next.getDay(); // 0=Sun
      next.setDate(next.getDate() + (7 - dow + 1) % 7 || 7); // next Monday
    } else if (period === 'monthly') {
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
    }

    if (period !== 'hourly') {
      next.setHours(0, 0, 0, 0);
    } else {
      next.setMinutes(0, 0, 0);
    }

    const bucketEnd = Math.min(next.getTime(), endMs);
    buckets.push({
      label: formatBucketLabel(new Date(bucketStart), period),
      startMs: bucketStart,
      endMs: bucketEnd,
    });

    cursor.setTime(next.getTime());
    if (bucketStart === cursor.getTime()) break; // safety guard
  }
  return buckets;
}

function formatBucketLabel(date, period) {
  const pad = n => String(n).padStart(2, '0');
  if (period === 'hourly') {
    return `${pad(date.getHours())}:00`;
  } else if (period === 'daily') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  } else if (period === 'weekly') {
    // ISO week label
    const tmp = new Date(date);
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
    const yearStart = new Date(tmp.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
    return `${tmp.getFullYear()}-W${pad(weekNo)}`;
  } else if (period === 'monthly') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Find the first valid (non-null, finite) value for channelId at or after startMs (within range).
 * rows: sorted array of { timestampMs, values: {chId: number|null} }
 */
function getFirstValid(rows, channelId, startMs, endMs) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.timestampMs < startMs) continue;
    if (r.timestampMs > endMs) break;
    const v = r.values[channelId];
    if (v !== null && v !== undefined && isFinite(v) && v > 0) return v;
  }
  return null;
}

/**
 * Find the last valid value for channelId at or before endMs (within range).
 */
function getLastValid(rows, channelId, startMs, endMs) {
  let result = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.timestampMs < startMs) continue;
    if (r.timestampMs > endMs) break;
    const v = r.values[channelId];
    if (v !== null && v !== undefined && isFinite(v) && v > 0) result = v;
  }
  return result;
}

/**
 * Calculate consumption for one channel across one time bucket.
 * Returns a number (≥0) or null if insufficient data.
 */
export function calcConsumptionForPeriod(rows, channelId, startMs, endMs) {
  const first = getFirstValid(rows, channelId, startMs, endMs);
  const last  = getLastValid(rows, channelId, startMs, endMs);
  if (first === null || last === null) return null;
  const delta = last - first;
  return delta >= 0 ? delta : null; // guard counter reset
}

/**
 * Full report computation.
 *
 * @param {Array}  groups     Array of group config objects:
 *                            { id, name, subChannelIds: [int], mainChannelId: int|null, needsSum: bool }
 * @param {Array}  allRows    All data rows: [{ timestampMs, values: {chId: number|null} }]
 * @param {Array}  channels   Channel metadata: [{ channel_id, logic_channel_description, unit_in_ascii }]
 * @param {number} startMs    Report start timestamp
 * @param {number} endMs      Report end timestamp
 * @param {string} period     'daily' | 'weekly' | 'monthly'
 * @param {number} costPerUnit Cost per unit (e.g. cost per m³)
 * @param {string} currency   Currency symbol e.g. 'USD'
 *
 * @returns {object} { columns, buckets, rows, totals, averages, costs }
 */
export function runReport(groups, allRows, channels, startMs, endMs, period, costPerUnit, currency) {
  const buckets = generateTimeBuckets(startMs, endMs, period);
  const totalHours = (endMs - startMs) / (1000 * 3600);

  // Build flat column list: for each group → subChannels → [sum col if needed] → [main col]
  // column: { key, label, groupId, isSum, isMain, channelId }
  const columns = [];
  const chMap = {};
  channels.forEach(ch => { chMap[ch.channel_id] = ch; });

  groups.forEach(g => {
    g.subChannelIds.forEach(cid => {
      const ch = chMap[cid];
      columns.push({
        key: `ch_${cid}`,
        label: ch ? (ch.logic_channel_description || `Ch${cid}`) : `Ch${cid}`,
        unit: ch ? ch.unit_in_ascii : '',
        groupId: g.id,
        isSum: false,
        isMain: false,
        channelId: cid,
      });
    });
    if (g.needsSum && g.subChannelIds.length > 1) {
      columns.push({
        key: `sum_${g.id}`,
        label: `${g.name} Sum`,
        unit: g.subChannelIds.length > 0 ? (chMap[g.subChannelIds[0]]?.unit_in_ascii || '') : '',
        groupId: g.id,
        isSum: true,
        isMain: false,
        channelId: null,
      });
    }
    if (g.mainChannelId != null) {
      const ch = chMap[g.mainChannelId];
      columns.push({
        key: `main_${g.mainChannelId}`,
        label: ch ? (ch.logic_channel_description || `Ch${g.mainChannelId}`) : `Ch${g.mainChannelId}`,
        unit: ch ? ch.unit_in_ascii : '',
        groupId: g.id,
        isSum: false,
        isMain: true,
        channelId: g.mainChannelId,
      });
    }
  });

  // Compute per-bucket rows
  const dataRows = buckets.map(bucket => {
    const rowValues = {};
    groups.forEach(g => {
      let groupSum = 0;
      let groupSumValid = false;

      g.subChannelIds.forEach(cid => {
        const val = calcConsumptionForPeriod(allRows, cid, bucket.startMs, bucket.endMs);
        rowValues[`ch_${cid}`] = val;
        if (val !== null) { groupSum += val; groupSumValid = true; }
      });

      if (g.needsSum && g.subChannelIds.length > 1) {
        rowValues[`sum_${g.id}`] = groupSumValid ? groupSum : null;
      }

      if (g.mainChannelId != null) {
        const val = calcConsumptionForPeriod(allRows, g.mainChannelId, bucket.startMs, bucket.endMs);
        rowValues[`main_${g.mainChannelId}`] = val;
      }
    });
    return { label: bucket.label, startMs: bucket.startMs, endMs: bucket.endMs, values: rowValues };
  });

  // Compute totals, averages, costs per column
  const totals = {};
  const averages = {};
  const costs = {};

  columns.forEach(col => {
    let sum = 0;
    let count = 0;
    dataRows.forEach(row => {
      const v = row.values[col.key];
      if (v !== null && v !== undefined) { sum += v; count++; }
    });
    totals[col.key]   = count > 0 ? sum : null;
    averages[col.key] = (count > 0 && totalHours > 0) ? sum / totalHours : null;
    costs[col.key]    = count > 0 ? sum * costPerUnit : null;
  });

  return { columns, buckets, rows: dataRows, totals, averages, costs, currency, costPerUnit };
}
