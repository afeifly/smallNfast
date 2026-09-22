/**
 * DataModifierEngine.js
 *
 * Engine for transforming, extending, and synthesizing sensor log data in s4a-web.
 * Generates interactive previews and exports 100% compliant binary CSD and CSV files.
 */

import TestAPI from '../../api/TestAPI';

const FILE_HEADER_LEN = 34;
const PROTOCOL_HEADER_LEN = 3552;
const CHANNEL_HEADER_LEN = 918;
const RECORD_ID_LEN = 4;
const CHANNEL_VALUE_LEN = 8; // Float64
const DATA_INVALID = -9999.0;

export class DataModifierEngine {
  /**
   * Identifies whether a channel is a consumption / totalizer channel.
   * Totalizer channels accumulate monotonically over time and usually have huge absolute values
   * (e.g. 50,000+ m³ or kWh), so they should not be plotted on the same chart axis by default.
   */
  static isConsumptionChannel(ch) {
    if (!ch) return false;
    const unit = (ch.unit_in_ascii || ch.unit || '').trim();
    const desc = (ch.logic_channel_description || ch.full_channel_name || ch.name || '').trim();
    const u = unit.toLowerCase();
    const d = desc.toLowerCase();

    // 1. Instantaneous rate units should NOT be treated as consumption totalizers
    // e.g. m³/h, m3/min, l/min, kg/h, cfm, kW, MW, etc.
    if (/\/(h|hr|hour|min|minute|s|sec|second|d|day)|per\s*(h|hr|min|s)/i.test(u)) {
      return false;
    }
    // Pressure, temperature, percentage, speed, vibration, electrical rate units
    if (/^(bar|psi|kpa|mpa|pa|°c|°f|c|f|k|%|pct|kw|mw|w|a|v|hz|rpm|mm\/s|m\/s|g)$/i.test(u)) {
      return false;
    }

    // 2. Direct unit match for volume, energy, counts
    // Volume: m³, m3, Nm³, Nm3, Sm³, Sm3, L, l, ml, kl, hl, gal, cf, scf, kcf, mcf, mmcf, ft³, ft3
    // Energy: kWh, MWh, GWh, Wh, kvarh, kvah, MJ, GJ, BTU, MMBTU, therm, therms, kcal
    // Pulses / Counts: pulse, pulses, imp, count, counts
    const consumptionUnits = [
      'm³', 'm3', 'm^3', 'nm³', 'nm3', 'sm³', 'sm3',
      'l', 'l.', 'ltr', 'liter', 'liters', 'litre', 'litres', 'ml', 'kl', 'hl',
      'gal', 'gallon', 'gallons', 'bbl', 'cu m', 'cum', 'cu ft', 'cuft', 'cf', 'scf', 'kcf', 'mcf', 'mmcf', 'ft³', 'ft3',
      'kwh', 'mwh', 'gwh', 'wh', 'kvarh', 'kvah', 'mj', 'gj', 'btu', 'mmbtu', 'kbtu', 'therm', 'therms', 'kcal',
      'pulse', 'pulses', 'imp', 'count', 'counts',
    ];
    if (consumptionUnits.includes(u)) {
      return true;
    }

    // 3. Keyword match in channel description or name
    if (/\b(total|totalizer|totaliser|totalized|totalised|accumulated|accumulation|cumulative|consumption|counter|integral|tot)\b/i.test(d)) {
      return true;
    }
    if (/(累计|总计|消耗|用电|用气|用水|电度|积算|总用量)/.test(d)) {
      return true;
    }

    // 4. Mass unit (kg, t, ton, lb) combined with total/steam/flow integration keywords
    if (/^(kg|t|ton|tonne|lb|lbs)$/i.test(u) && /(mass|steam|feed|flow|air|gas|water|oil|prod|cum)/i.test(d)) {
      return true;
    }

    // 5. Value heuristic: strictly positive monotonic large values (> 1000)
    const firstVal = typeof ch.firstVal === 'number' ? ch.firstVal : 0;
    const lastVal = typeof ch.lastVal === 'number' ? ch.lastVal : (typeof ch.max === 'number' ? ch.max : 0);
    const min = typeof ch.min === 'number' ? ch.min : 0;
    const max = typeof ch.max === 'number' ? ch.max : 0;
    if (firstVal >= 0 && lastVal >= 1000 && lastVal >= firstVal && min >= 0 && max >= 1000) {
      if (/(air|gas|water|power|energy|heat|production|meter)/i.test(d)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reads initial file metadata and channel baselines.
   */
  static async getBaseMetadata() {
    return new Promise((resolve) => {
      TestAPI.getChannels(async (res) => {
        const rawChannels = Array.isArray(res) ? res : (res && res.logging_chs) ? res.logging_chs : [];
        const timeRange = TestAPI.getFileTimeRange ? TestAPI.getFileTimeRange() : null;
        const startTimeMs = timeRange ? timeRange.start : 0;
        const stopTimeMs = timeRange ? (timeRange.stop ?? timeRange.end ?? 0) : 0;
        const numSamples = TestAPI.getNumOfSamples ? TestAPI.getNumOfSamples() : 0;
        const sampleRate = TestAPI.getSampleRate ? TestAPI.getSampleRate() : 1;
        const loadedFileName = TestAPI.getLoadedFileName ? TestAPI.getLoadedFileName() : 'file';

        // Read last values for realistic initial rule presets
        const lastVals = {};
        const firstVals = {};
        try {
          if (TestAPI.readSamples && numSamples > 0) {
            await new Promise((r) => {
              TestAPI.readSamples(0, Math.min(10, numSamples), (samples) => {
                if (samples && samples.length > 0) {
                  const s = samples[0];
                  rawChannels.forEach((ch, idx) => {
                    const id = ch.channel_id ?? idx;
                    firstVals[id] = s[idx] !== undefined && s[idx] !== DATA_INVALID ? s[idx] : 0;
                  });
                }
                r();
              });
            });
            await new Promise((r) => {
              const startIdx = Math.max(0, numSamples - 10);
              TestAPI.readSamples(startIdx, numSamples - startIdx, (samples) => {
                if (samples && samples.length > 0) {
                  const s = samples[samples.length - 1];
                  rawChannels.forEach((ch, idx) => {
                    const id = ch.channel_id ?? idx;
                    lastVals[id] = s[idx] !== undefined && s[idx] !== DATA_INVALID ? s[idx] : 0;
                  });
                }
                r();
              });
            });
          }
        } catch (e) {
          console.warn('[DataModifierEngine] Failed to read edge sample values:', e);
        }

        const channelBaselines = rawChannels.map((ch, idx) => {
          const desc = ch.logic_channel_description || ch.full_channel_name || `CH${idx + 1}`;
          const unit = ch.unit_in_ascii || '';
          const rawMin = typeof ch.min === 'number' ? ch.min : (typeof ch._min === 'number' ? ch._min : 0);
          const rawMax = typeof ch.max === 'number' ? ch.max : (typeof ch._max === 'number' ? ch._max : 100);
          const lastVal = lastVals[ch.channel_id ?? idx] ?? lastVals[idx] ?? (rawMax + rawMin) / 2;
          const firstVal = firstVals[ch.channel_id ?? idx] ?? firstVals[idx] ?? rawMin;

          const curMin = !isNaN(rawMin) ? rawMin : 0;
          let curMax = !isNaN(rawMax) && rawMax > curMin ? rawMax : (curMin + 100);
          if (typeof lastVal === 'number' && lastVal > curMax) {
            curMax = Math.round(lastVal * 1.2);
          }

          const isConsumptionCandidate = DataModifierEngine.isConsumptionChannel({
            ...ch,
            name: desc,
            unit,
            firstVal,
            lastVal,
            min: curMin,
            max: curMax,
          });

          return {
            index: idx,
            channel_id: ch.channel_id ?? idx,
            name: desc,
            unit: unit,
            resolution: ch.resolution !== undefined ? ch.resolution : 2,
            min: curMin,
            max: curMax,
            firstVal: typeof firstVal === 'number' && !isNaN(firstVal) ? firstVal : 0,
            lastVal: typeof lastVal === 'number' && !isNaN(lastVal) ? lastVal : 0,
            isConsumptionCandidate,
            color: ch.color || null,
          };
        });

        resolve({
          fileName: loadedFileName,
          startTimeMs,
          stopTimeMs,
          numSamples,
          sampleRate: sampleRate > 0 ? sampleRate : 1,
          intervalSec: sampleRate > 0 ? 1 / sampleRate : 1,
          channels: channelBaselines,
        });
      });
    });
  }

  /**
   * Generates downsampled preview data for the D3 preview chart.
   */
  static async generatePreview(baseMeta, config) {
    const { startTimeMs, stopTimeMs, numSamples, sampleRate, channels } = baseMeta;
    const {
      removedChannelIds = [],
      scaledChannels = [],
      combinedChannels = [],
      formulaChannels = [],
      timeExtension,
      cutdown,
      consumptionSolvers,
    } = config;

    // Evaluate cutdown if enabled
    let effectiveSampleStart = 0;
    let effectiveSampleEnd = numSamples;
    let hasCutdown = false;

    if (cutdown && cutdown.enabled && cutdown.cutMinutes > 0 && numSamples > 1) {
      const maxCuttableSec = Math.max(0, (numSamples - 2) / sampleRate);
      const cutSec = Math.min(cutdown.cutMinutes * 60, maxCuttableSec);
      const cutSamples = Math.round(cutSec * sampleRate);

      if (cutSamples > 0) {
        hasCutdown = true;
        if (cutdown.position === 'start') {
          effectiveSampleStart = Math.min(cutSamples, numSamples - 2);
          effectiveSampleEnd = numSamples;
        } else {
          effectiveSampleStart = 0;
          effectiveSampleEnd = Math.max(2, numSamples - cutSamples);
        }
      }
    }

    const effectiveNumSamples = Math.max(1, effectiveSampleEnd - effectiveSampleStart);
    const effectiveStartTimeMs = startTimeMs + (effectiveSampleStart / sampleRate) * 1000;
    const effectiveStopTimeMs = startTimeMs + ((effectiveSampleEnd - 1) / sampleRate) * 1000;

    // Precompile formula channels (intervalSec used for integral dt)
    const previewIntervalSec = sampleRate > 0 ? 1 / sampleRate : 1;
    const compiledFormulas = (formulaChannels || []).map((fc) => ({
      ...fc,
      compiled: this.compileFormula(fc.expression, channels, previewIntervalSec),
    }));

    const PREVIEW_POINTS = 600;
    const originalRows = [];

    if (numSamples > 0) {
      const step = Math.max(1, Math.floor(numSamples / PREVIEW_POINTS));
      const pageIndices = [];
      for (let s = 0; s < numSamples; s += step) {
        pageIndices.push(s);
      }
      // Ensure the very last sample is included
      if (pageIndices[pageIndices.length - 1] !== numSamples - 1) {
        pageIndices.push(numSamples - 1);
      }

      // Fetch sample rows
      for (const s of pageIndices) {
        await new Promise((res) => {
          TestAPI.getTablePage(s, 1, null, (data) => {
            if (data && data.rows && data.rows[0]) {
              const r = data.rows[0];
              const values = { ...r.values };

              // Apply channel scaling on preview
              scaledChannels.forEach((sc) => {
                const origVal = values[sc.sourceChId];
                if (origVal !== null && origVal !== undefined && !isNaN(origVal)) {
                  const newVal = origVal * sc.multiplier + sc.offset;
                  if (sc.mode === 'replace') {
                    values[sc.sourceChId] = newVal;
                  } else {
                    values[sc.id] = newVal;
                  }
                } else if (sc.mode === 'new_channel') {
                  values[sc.id] = null;
                }
              });

              // Apply combinations on preview
              combinedChannels.forEach((cc) => {
                const valA = values[cc.chA ?? cc.chAId];
                const valB = values[cc.chB ?? cc.chBId];
                values[cc.id] = this.evalOp(valA, valB, cc.op);
              });

              // Apply formula channels on preview using snapshot context
              const evalContext = { ...values };
              compiledFormulas.forEach((fc) => {
                if (fc.compiled && fc.compiled.valid) {
                  const fVal = fc.compiled.eval(evalContext);
                  if (fc.mode === 'replace') {
                    values[fc.targetChId] = fVal;
                    if (fc.targetChId !== undefined) {
                      values[String(fc.targetChId)] = fVal;
                    }
                  } else {
                    values[fc.id] = fVal;
                  }
                }
              });

              originalRows.push({
                timestampMs: r.timestampMs || (startTimeMs + (s / sampleRate) * 1000),
                isExtended: false,
                values,
              });
            }
            res();
          });
        });
      }
    }

    // Extended section
    const extendedRows = [];
    let newStopTimeMs = effectiveStopTimeMs;
    let newNumSamples = effectiveNumSamples;

    if (timeExtension && timeExtension.enabled && timeExtension.extraMinutes > 0) {
      const extraSec = timeExtension.extraMinutes * 60;
      const extraSamplesTotal = Math.round(extraSec * sampleRate);
      newStopTimeMs = effectiveStopTimeMs + extraSec * 1000;
      newNumSamples = effectiveNumSamples + extraSamplesTotal;

      const EXT_PREVIEW_POINTS = 200;
      const extStep = Math.max(1, Math.floor(extraSamplesTotal / EXT_PREVIEW_POINTS));

      // Build consumption sequence generator for the extended interval
      const consumptionGenerators = {};
      Object.entries(consumptionSolvers || {}).forEach(([chId, solver]) => {
        if (solver && solver.enabled) {
          consumptionGenerators[chId] = this._createConsumptionGenerator(
            solver.startVal,
            solver.targetVal,
            extraSamplesTotal,
            solver.profile
          );
        }
      });

      // Memory tracking for smooth random walk
      const walkState = {};
      channels.forEach((ch) => {
        walkState[ch.channel_id] = ch.lastVal;
      });

      for (let s = 1; s <= extraSamplesTotal; s += extStep) {
        const timeMs = stopTimeMs + (s / sampleRate) * 1000;
        const values = {};

        channels.forEach((ch) => {
          const chId = ch.channel_id;

          // Check if consumption solver controls this channel
          if (consumptionGenerators[chId]) {
            values[chId] = consumptionGenerators[chId](s);
            return;
          }

          // Otherwise check time extension rule
          const rule = timeExtension.channelRules && timeExtension.channelRules[chId];
          if (rule) {
            if (rule.mode === 'constant') {
              values[chId] = rule.constantVal !== undefined ? rule.constantVal : ch.lastVal;
            } else if (rule.mode === 'smooth_walk') {
              const range = rule.max - rule.min;
              const delta = (Math.random() - 0.5) * (range > 0 ? range * 0.05 : 1);
              let val = (walkState[chId] ?? ch.lastVal) + delta;
              val = Math.max(rule.min, Math.min(rule.max, val));
              walkState[chId] = val;
              values[chId] = val;
            } else {
              // Bounded random range
              const min = rule.min !== undefined ? rule.min : ch.min;
              const max = rule.max !== undefined ? rule.max : ch.max;
              values[chId] = min + Math.random() * (max - min);
            }
          } else {
            // Default: random fluctuation around last value
            values[chId] = ch.lastVal;
          }
        });

        // Apply scaling
        scaledChannels.forEach((sc) => {
          const origVal = values[sc.sourceChId];
          if (origVal !== null && origVal !== undefined && !isNaN(origVal)) {
            const newVal = origVal * sc.multiplier + sc.offset;
            if (sc.mode === 'replace') {
              values[sc.sourceChId] = newVal;
            } else {
              values[sc.id] = newVal;
            }
          } else if (sc.mode === 'new_channel') {
            values[sc.id] = null;
          }
        });

        // Apply combinations
        combinedChannels.forEach((cc) => {
          const valA = values[cc.chA ?? cc.chAId];
          const valB = values[cc.chB ?? cc.chBId];
          values[cc.id] = this.evalOp(valA, valB, cc.op);
        });

        // Apply formula channels on extended rows using snapshot context
        const extEvalContext = { ...values };
        compiledFormulas.forEach((fc) => {
          if (fc.compiled && fc.compiled.valid) {
            const fVal = fc.compiled.eval(extEvalContext);
            if (fc.mode === 'replace') {
              values[fc.targetChId] = fVal;
            } else {
              values[fc.id] = fVal;
            }
          }
        });

        extendedRows.push({
          timestampMs: timeMs,
          isExtended: true,
          values,
        });
      }
    }

    // Build virtual channel descriptor list
    const previewChannels = [];

    channels.forEach((ch) => {
      if (removedChannelIds.includes(ch.channel_id)) return;
      const rf = (formulaChannels || []).find(
        (f) => f.mode === 'replace' && (f.targetChId === ch.channel_id || String(f.targetChId) === String(ch.channel_id))
      );
      const sc = scaledChannels.find(
        (s) => (s.sourceChId === ch.channel_id || String(s.sourceChId) === String(ch.channel_id)) && s.mode === 'replace'
      );

      if (rf) {
        previewChannels.push({
          ...ch,
          name: rf.name || ch.name,
          unit: rf.unit || ch.unit,
          isModified: true,
        });
      } else if (sc) {
        previewChannels.push({
          ...ch,
          name: `${ch.name} (x${sc.multiplier})`,
          isModified: true,
        });
      } else {
        previewChannels.push({ ...ch });
      }
    });

    scaledChannels.forEach((sc) => {
      if (sc.mode === 'new_channel' && !removedChannelIds.includes(sc.id)) {
        previewChannels.push({
          channel_id: sc.id,
          name: sc.newName || `CH${sc.sourceChId + 1} (x${sc.multiplier})`,
          unit: sc.newUnit || '',
          resolution: 2,
          isDerived: true,
          color: '#FFAB00',
        });
      }
    });

    combinedChannels.forEach((cc) => {
      if (!removedChannelIds.includes(cc.id)) {
        previewChannels.push({
          channel_id: cc.id,
          name: cc.name,
          unit: cc.unit,
          resolution: cc.resolution || 2,
          isDerived: true,
          color: '#00B8D9',
        });
      }
    });

    (formulaChannels || []).forEach((fc) => {
      if (fc.mode === 'new_channel' && !removedChannelIds.includes(fc.id)) {
        previewChannels.push({
          channel_id: fc.id,
          name: fc.name || fc.expression,
          unit: fc.unit || '',
          resolution: 2,
          isDerived: true,
          color: fc.color || '#00ac86',
        });
      }
    });

    const cutSplitTime = hasCutdown
      ? (cutdown.position === 'start' ? effectiveStartTimeMs : effectiveStopTimeMs)
      : null;

    return {
      allRows: [...originalRows, ...extendedRows],
      originalRange: [startTimeMs, stopTimeMs],
      extendedRange: [stopTimeMs, newStopTimeMs],
      hasExtension: Boolean(timeExtension && timeExtension.enabled && timeExtension.extraMinutes > 0),
      hasCutdown,
      cutSplitTime,
      cutPosition: cutdown ? cutdown.position || 'end' : 'end',
      newStartTimeMs: effectiveStartTimeMs,
      newStopTimeMs,
      newNumSamples,
      channels: previewChannels,
    };
  }

  /**
   * Helper: Arithmetic operator evaluation
   */
  static evalOp(a, b, op) {
    if (a === null || a === undefined || isNaN(a)) return null;
    if (b === null || b === undefined || isNaN(b)) return null;
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : null;
      default: return null;
    }
  }

  /**
   * Safely tokenizes a formula string into a list of syntax tokens.
   */
  static tokenizeFormula(expression, channels = []) {
    if (!expression || typeof expression !== 'string' || !expression.trim()) {
      return { valid: false, error: 'Formula expression is empty' };
    }

    // Strip optional leading assignment syntax: e.g. "ch5 = ...", "ch5 := ...", "ch5: ..."
    let str = expression.trim();
    const assignMatch = str.match(/^(?:ch|channel)\s*(\d+)\s*(?:=|:=|:|->)\s*(.+)$/i);
    if (assignMatch) {
      str = assignMatch[2].trim();
    }

    const tokens = [];
    let i = 0;
    const len = str.length;

    while (i < len) {
      const char = str[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Operators & Parentheses
      if (char === '+') {
        tokens.push({ type: 'OP', value: '+', pos: i });
        i++;
        continue;
      }
      if (char === '-') {
        tokens.push({ type: 'OP', value: '-', pos: i });
        i++;
        continue;
      }
      if (char === '*' || char === '×') {
        tokens.push({ type: 'OP', value: '*', pos: i });
        i++;
        continue;
      }
      if (char === '/' || char === '÷') {
        tokens.push({ type: 'OP', value: '/', pos: i });
        i++;
        continue;
      }
      if (char === '(') {
        tokens.push({ type: 'LPAREN', pos: i });
        i++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', pos: i });
        i++;
        continue;
      }

      // Channel reference by bracket: [Channel Name]
      if (char === '[') {
        const closeIdx = str.indexOf(']', i + 1);
        if (closeIdx === -1) {
          return { valid: false, error: `Unclosed bracket starting at position ${i + 1}` };
        }
        const chName = str.substring(i + 1, closeIdx).trim().toLowerCase();
        const found = channels.find((c, idx) =>
          (c.name && c.name.toLowerCase() === chName) ||
          (`ch${idx + 1}` === chName) ||
          (`ch${c.channel_id}` === chName)
        );
        if (!found) {
          return { valid: false, error: `Channel "[${str.substring(i + 1, closeIdx)}]" not found` };
        }
        tokens.push({
          type: 'CH',
          chId: found.channel_id,
          chIndex: found.index ?? channels.indexOf(found),
          name: found.name,
          pos: i,
        });
        i = closeIdx + 1;
        continue;
      }

      // Channel reference by chN or CHN (e.g. ch1, ch2, ch10)
      const chMatch = str.substring(i).match(/^(ch|channel)\s*(\d+)/i);
      if (chMatch) {
        const num = parseInt(chMatch[2], 10);
        // 1-based indexing: ch1 corresponds to index 0
        let targetCh = null;
        if (num >= 1 && num <= channels.length) {
          targetCh = channels[num - 1];
        } else {
          targetCh = channels.find((c) => c.channel_id === num || c.channel_id === num - 1);
        }

        if (!targetCh) {
          return {
            valid: false,
            error: `Channel ${chMatch[0]} does not exist (File has ${channels.length} channels: ch1..ch${channels.length})`,
          };
        }

        tokens.push({
          type: 'CH',
          chId: targetCh.channel_id,
          chIndex: targetCh.index ?? (num - 1),
          name: targetCh.name,
          raw: chMatch[0],
          pos: i,
        });
        i += chMatch[0].length;
        continue;
      }

      // Number (integer or float, e.g. 10, 2.5, .5)
      const numMatch = str.substring(i).match(/^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/);
      if (numMatch) {
        const val = parseFloat(numMatch[0]);
        if (isNaN(val)) {
          return { valid: false, error: `Invalid number format at position ${i + 1}: "${numMatch[0]}"` };
        }
        tokens.push({ type: 'NUM', value: val, pos: i });
        i += numMatch[0].length;
        continue;
      }

      // Multiplication by 'x' or 'X' (e.g. ch1 x 2 or 5 x 10)
      if (char === 'x' || char === 'X') {
        tokens.push({ type: 'OP', value: '*', pos: i });
        i++;
        continue;
      }

      // integral(chN) – cumulative trapezoidal integration of a channel
      const integralMatch = str.substring(i).match(/^integral\s*\(\s*((ch|channel)\s*\d+|\[[^\]]+\])\s*\)/i);
      if (integralMatch) {
        const innerExpr = integralMatch[1].trim();
        // Tokenize just the inner channel reference
        const innerTok = this.tokenizeFormula(innerExpr, channels);
        if (!innerTok.valid || innerTok.tokens.length !== 1 || innerTok.tokens[0].type !== 'CH') {
          return { valid: false, error: `integral() expects a single channel reference, e.g. integral(ch1)` };
        }
        tokens.push({ type: 'INTEGRAL', chId: innerTok.tokens[0].chId, chIndex: innerTok.tokens[0].chIndex, name: innerTok.tokens[0].name, pos: i });
        i += integralMatch[0].length;
        continue;
      }

      return { valid: false, error: `Unexpected character "${char}" at position ${i + 1}` };
    }

    if (tokens.length === 0) {
      return { valid: false, error: 'No tokens found in expression' };
    }

    return { valid: true, tokens };
  }

  /**
   * Recursive-descent AST parser for mathematical expressions.
   */
  static parseTokens(tokens) {
    let curr = 0;
    const peek = () => tokens[curr];
    const consume = (expectedType, expectedVal) => {
      const t = tokens[curr];
      if (!t) throw new Error('Unexpected end of formula');
      if (expectedType && t.type !== expectedType) {
        throw new Error(`Expected token ${expectedType}, found ${t.type}`);
      }
      if (expectedVal !== undefined && t.value !== expectedVal) {
        throw new Error(`Expected "${expectedVal}", found "${t.value}"`);
      }
      curr++;
      return t;
    };

    // Expression := Term (( '+' | '-' ) Term)*
    const parseExpression = () => {
      let node = parseTerm();
      while (curr < tokens.length && peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const op = consume('OP').value;
        const right = parseTerm();
        node = { type: 'binary', op, left: node, right };
      }
      return node;
    };

    // Term := Factor (( '*' | '/' ) Factor)*
    const parseTerm = () => {
      let node = parseFactor();
      while (curr < tokens.length && peek() && peek().type === 'OP' && (peek().value === '*' || peek().value === '/')) {
        const op = consume('OP').value;
        const right = parseFactor();
        node = { type: 'binary', op, left: node, right };
      }
      return node;
    };

    // Factor := '+' Factor | '-' Factor | Primary
    const parseFactor = () => {
      if (curr < tokens.length && peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const op = consume('OP').value;
        const sub = parseFactor();
        return { type: 'unary', op, expr: sub };
      }
      return parsePrimary();
    };

    // Primary := NUM | CH | '(' Expression ')'
    const parsePrimary = () => {
      const t = peek();
      if (!t) throw new Error('Unexpected end of formula');
      if (t.type === 'NUM') {
        consume('NUM');
        return { type: 'num', value: t.value };
      }
      if (t.type === 'CH') {
        consume('CH');
        return { type: 'ch', chId: t.chId, chIndex: t.chIndex, name: t.name };
      }
      if (t.type === 'LPAREN') {
        consume('LPAREN');
        const node = parseExpression();
        if (!peek() || peek().type !== 'RPAREN') {
          throw new Error('Missing closing parenthesis ")"');
        }
        consume('RPAREN');
        return node;
      }
      throw new Error(`Unexpected token "${t.value || t.type}"`);
    };

    const ast = parseExpression();
    if (curr < tokens.length) {
      throw new Error(`Unexpected token "${peek().value || peek().type}"`);
    }
    return ast;
  }

  /**
   * Safely evaluates an AST node given current row values.
   */
  static evaluateAst(node, values) {
    if (!node) return null;
    if (node.type === 'num') {
      return node.value;
    }
    if (node.type === 'ch') {
      let v = values[node.chId];
      if (v === undefined && node.chIndex !== undefined) v = values[node.chIndex];
      if (v === undefined && node.chId !== undefined) v = values[String(node.chId)];
      if (v === undefined && node.chIndex !== undefined) v = values[String(node.chIndex)];
      if (v === undefined && node.name) v = values[node.name];
      if (v === undefined && node.raw) v = values[node.raw.toLowerCase()];

      if (v === null || v === undefined || isNaN(v) || v <= DATA_INVALID) {
        return null;
      }
      return v;
    }
    if (node.type === 'unary') {
      const v = this.evaluateAst(node.expr, values);
      if (v === null) return null;
      return node.op === '-' ? -v : v;
    }
    if (node.type === 'binary') {
      const left = this.evaluateAst(node.left, values);
      const right = this.evaluateAst(node.right, values);
      if (left === null || right === null) return null;
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : null;
        default: return null;
      }
    }
    return null;
  }

  /**
   * Compiles an expression into an evaluator function.
   */
  static compileFormula(expression, channels = [], intervalSec = 1) {
    const tokRes = this.tokenizeFormula(expression, channels);
    if (!tokRes.valid) {
      return { valid: false, error: tokRes.error, eval: () => null };
    }

    // Special case: pure integral(chN) formula — stateful accumulator
    const integralToks = tokRes.tokens.filter((t) => t.type === 'INTEGRAL');
    if (tokRes.tokens.length === 1 && integralToks.length === 1) {
      const tok = integralToks[0];
      let accumulator = 0;
      let prevVal = null;
      return {
        valid: true,
        error: null,
        isIntegral: true,
        referencedChIds: [tok.chId],
        resetAccumulator: () => { accumulator = 0; prevVal = null; },
        eval: (values) => {
          let v = values[tok.chId];
          if (v === undefined && tok.chIndex !== undefined) v = values[tok.chIndex];
          if (v === undefined) v = values[String(tok.chId)];
          if (v === null || v === undefined || isNaN(v) || v <= DATA_INVALID) return accumulator;
          // Trapezoidal rule: area = (prev + cur) / 2 * dt
          const dt = intervalSec;
          const prev = prevVal !== null ? prevVal : v;
          accumulator += ((prev + v) / 2) * dt;
          prevVal = v;
          return accumulator;
        },
      };
    }

    // If any INTEGRAL token appears in a compound expression, reject (not supported)
    if (integralToks.length > 0) {
      return { valid: false, error: 'integral() cannot be combined with other operators. Use it as a standalone formula: integral(ch1)', eval: () => null };
    }

    try {
      const ast = this.parseTokens(tokRes.tokens);
      const referencedChIds = [];
      const collectChs = (n) => {
        if (!n) return;
        if (n.type === 'ch') {
          if (!referencedChIds.includes(n.chId)) referencedChIds.push(n.chId);
        } else if (n.type === 'unary') {
          collectChs(n.expr);
        } else if (n.type === 'binary') {
          collectChs(n.left);
          collectChs(n.right);
        }
      };
      collectChs(ast);

      return {
        valid: true,
        error: null,
        ast,
        referencedChIds,
        eval: (values) => this.evaluateAst(ast, values),
      };
    } catch (err) {
      return { valid: false, error: err.message || 'Syntax error in formula', eval: () => null };
    }
  }

  /**
   * Helper: Consumption monotonic step generator reaching targetVal exactly.
   */
  static _createConsumptionGenerator(startVal, targetVal, totalSteps, profile = 'jittered') {
    const totalDelta = targetVal - startVal;
    if (totalSteps <= 1 || Math.abs(totalDelta) < 1e-9) {
      return () => targetVal;
    }

    if (profile === 'linear') {
      const stepDelta = totalDelta / totalSteps;
      return (s) => startVal + s * stepDelta;
    }

    // Monotonic jittered profile: generate random positive weights
    // that integrate exactly to 1.0 over totalSteps
    const weights = new Float64Array(totalSteps + 1);
    let sumWeights = 0;

    for (let i = 1; i <= totalSteps; i++) {
      // 10% chance of small pause/idle (zero delta), else random weight between 0.3 and 1.7
      const w = Math.random() < 0.1 ? 0 : 0.3 + Math.random() * 1.4;
      weights[i] = w;
      sumWeights += w;
    }

    if (sumWeights === 0) sumWeights = 1;

    // Cumulative sum array
    const cum = new Float64Array(totalSteps + 1);
    let running = 0;
    cum[0] = startVal;
    for (let i = 1; i <= totalSteps; i++) {
      running += (weights[i] / sumWeights) * totalDelta;
      let stepVal = startVal + running;
      if (stepVal < cum[i - 1]) stepVal = cum[i - 1];
      if (i === totalSteps || stepVal > targetVal) stepVal = targetVal;
      cum[i] = stepVal;
    }
    cum[totalSteps] = targetVal;

    return (s) => {
      const idx = Math.max(1, Math.min(totalSteps, Math.round(s)));
      return cum[idx];
    };
  }

  /**
   * Applies point-by-point cell overrides and transformations to a single row of values.
   */
  static computeRow(rawValues, isExt, extStepIdx, recordIndex, config = {}) {
    const curValues = { ...rawValues };
    if (!isExt && recordIndex !== undefined && config && config.cellOverrides && config.cellOverrides[recordIndex]) {
      Object.assign(curValues, config.cellOverrides[recordIndex]);
    }
    return curValues;
  }

  /**
   * Performs full streaming export into either CSD or CSV format.
   */
  static async exportModifiedFile(baseMeta, config, format = 'csd', onProgress) {
    const { startTimeMs, stopTimeMs, numSamples, sampleRate, channels } = baseMeta;
    const {
      removedChannelIds = [],
      scaledChannels = [],
      combinedChannels = [],
      formulaChannels = [],
      timeExtension,
      cutdown,
      consumptionSolvers,
    } = config;

    // Evaluate cutdown if enabled
    let effectiveSampleStart = 0;
    let effectiveSampleEnd = numSamples;

    if (cutdown && cutdown.enabled && cutdown.cutMinutes > 0 && numSamples > 1) {
      const maxCuttableSec = Math.max(0, (numSamples - 2) / sampleRate);
      const cutSec = Math.min(cutdown.cutMinutes * 60, maxCuttableSec);
      const cutSamples = Math.round(cutSec * sampleRate);

      if (cutSamples > 0) {
        if (cutdown.position === 'start') {
          effectiveSampleStart = Math.min(cutSamples, numSamples - 2);
          effectiveSampleEnd = numSamples;
        } else {
          effectiveSampleStart = 0;
          effectiveSampleEnd = Math.max(2, numSamples - cutSamples);
        }
      }
    }

    const effectiveNumSamples = Math.max(1, effectiveSampleEnd - effectiveSampleStart);
    const effectiveStartTimeMs = startTimeMs + (effectiveSampleStart / sampleRate) * 1000;
    const effectiveStopTimeMs = startTimeMs + ((effectiveSampleEnd - 1) / sampleRate) * 1000;

    const extraMinutes = (timeExtension && timeExtension.enabled) ? Math.max(0, timeExtension.extraMinutes) : 0;
    const extraSamples = Math.round(extraMinutes * 60 * sampleRate);
    const totalSamples = effectiveNumSamples + extraSamples;
    const newStopTimeMs = effectiveStopTimeMs + extraMinutes * 60 * 1000;
    const intervalSec = sampleRate > 0 ? 1 / sampleRate : 1;
    const intervalMs = intervalSec * 1000;

    // ── Build Output Channel Schemas ──────────────────────────────────────────
    const outputChannels = [];
    const sourceMap = []; // Describes how each output column is computed

    channels.forEach((ch, origIdx) => {
      if (removedChannelIds.includes(ch.channel_id)) return;
      const replaceFormula = (formulaChannels || []).find(
        (f) => f.mode === 'replace' && (f.targetChId === ch.channel_id || String(f.targetChId) === String(ch.channel_id))
      );
      const replaceScale = scaledChannels.find(
        (s) => (s.sourceChId === ch.channel_id || String(s.sourceChId) === String(ch.channel_id)) && s.mode === 'replace'
      );

      if (replaceFormula) {
        const compiled = this.compileFormula(replaceFormula.expression, channels, intervalSec);
        outputChannels.push({
          name: replaceFormula.name || ch.name,
          unit: replaceFormula.unit || ch.unit,
          resolution: ch.resolution,
          sensor_id: ch.channel_id,
        });
        sourceMap.push({
          type: 'formula',
          compiled,
          targetChId: ch.channel_id,
        });
      } else if (replaceScale) {
        outputChannels.push({
          name: `${ch.name} (x${replaceScale.multiplier})`,
          unit: ch.unit,
          resolution: ch.resolution,
          sensor_id: ch.channel_id,
        });
        sourceMap.push({
          type: 'scaled',
          sourceChId: ch.channel_id,
          multiplier: replaceScale.multiplier,
          offset: replaceScale.offset,
        });
      } else {
        outputChannels.push({
          name: ch.name,
          unit: ch.unit,
          resolution: ch.resolution,
          sensor_id: ch.channel_id,
        });
        sourceMap.push({
          type: 'direct',
          sourceChId: ch.channel_id,
        });
      }
    });

    // Scaled as new channel
    scaledChannels.forEach((sc) => {
      if (removedChannelIds.includes(sc.id)) return;
      if (sc.mode === 'new_channel') {
        outputChannels.push({
          name: sc.newName || `CH${sc.sourceChId + 1} (x${sc.multiplier})`,
          unit: sc.newUnit || '',
          resolution: 2,
          sensor_id: 100 + outputChannels.length,
        });
        sourceMap.push({
          type: 'scaled',
          sourceChId: sc.sourceChId,
          multiplier: sc.multiplier,
          offset: sc.offset,
        });
      }
    });

    // Combined channels
    combinedChannels.forEach((cc) => {
      if (removedChannelIds.includes(cc.id)) return;
      outputChannels.push({
        name: cc.name,
        unit: cc.unit,
        resolution: cc.resolution || 2,
        sensor_id: 200 + outputChannels.length,
      });
      sourceMap.push({
        type: 'combined',
        chA: cc.chA ?? cc.chAId,
        chB: cc.chB ?? cc.chBId,
        op: cc.op,
      });
    });

    // Formula channels as new channel
    (formulaChannels || []).forEach((fc) => {
      if (removedChannelIds.includes(fc.id)) return;
      if (fc.mode === 'new_channel') {
        const compiled = this.compileFormula(fc.expression, channels, intervalSec);
        outputChannels.push({
          name: fc.name || fc.expression,
          unit: fc.unit || '',
          resolution: fc.resolution !== undefined ? fc.resolution : 2,
          sensor_id: 300 + outputChannels.length,
        });
        sourceMap.push({
          type: 'formula',
          compiled,
        });
      }
    });

    const numOutChannels = outputChannels.length;
    if (numOutChannels === 0) {
      throw new Error('Cannot export file: all channels have been removed. Please keep at least one channel.');
    }

    const channelMin = Array(numOutChannels).fill(Infinity);
    const channelMax = Array(numOutChannels).fill(-Infinity);

    // Prompt user for file destination
    const cleanBaseName = (baseMeta.fileName || 'data').replace(/\.[^/.]+$/, '') + '_modified';
    let fileHandle = null;
    let writableStream = null;

    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: `${cleanBaseName}.${format}`,
          types: format === 'csd' ? [{
            description: 'CSD Binary Log Files',
            accept: { 'application/octet-stream': ['.csd'] }
          }] : [{
            description: 'CSV Data Files',
            accept: { 'text/csv': ['.csv'] }
          }],
        });
        writableStream = await fileHandle.createWritable();
      } catch (err) {
        if (err.name === 'AbortError') {
          return { aborted: true };
        }
        console.warn('[DataModifierEngine] showSaveFilePicker failed or cancelled, falling back to memory export:', err);
      }
    }

    if (onProgress) onProgress(0.05);

    // ── Pre-calculate Consumption & Random Walk Generators for Extension ──────
    const consumptionGenerators = {};
    Object.entries(consumptionSolvers || {}).forEach(([chId, solver]) => {
      if (solver && solver.enabled && extraSamples > 0) {
        consumptionGenerators[chId] = this._createConsumptionGenerator(
          solver.startVal,
          solver.targetVal,
          extraSamples,
          solver.profile
        );
      }
    });

    const walkState = {};
    channels.forEach((ch) => {
      walkState[ch.channel_id] = ch.lastVal;
    });

    // Helper to evaluate a full row of output values
    const computeRow = (rawValues, isExt, extStepIdx, recordIndex) => {
      const curValues = { ...rawValues };

      // Apply point-by-point cell overrides if provided
      if (!isExt && recordIndex !== undefined && config.cellOverrides && config.cellOverrides[recordIndex]) {
        Object.assign(curValues, config.cellOverrides[recordIndex]);
      }

      // If extended, generate base channels first
      if (isExt) {
        channels.forEach((ch) => {
          const chId = ch.channel_id;
          if (consumptionGenerators[chId]) {
            curValues[chId] = consumptionGenerators[chId](extStepIdx);
          } else {
            const rule = timeExtension && timeExtension.channelRules && timeExtension.channelRules[chId];
            if (rule) {
              if (rule.mode === 'constant') {
                curValues[chId] = rule.constantVal !== undefined ? rule.constantVal : ch.lastVal;
              } else if (rule.mode === 'smooth_walk') {
                const range = rule.max - rule.min;
                const delta = (Math.random() - 0.5) * (range > 0 ? range * 0.05 : 1);
                let val = (walkState[chId] ?? ch.lastVal) + delta;
                val = Math.max(rule.min, Math.min(rule.max, val));
                walkState[chId] = val;
                curValues[chId] = val;
              } else {
                const min = rule.min !== undefined ? rule.min : ch.min;
                const max = rule.max !== undefined ? rule.max : ch.max;
                curValues[chId] = min + Math.random() * (max - min);
              }
            } else {
              curValues[chId] = ch.lastVal;
            }
          }
        });
      }

      // Map to output channels
      const rowOut = new Float64Array(numOutChannels);
      for (let c = 0; c < numOutChannels; c++) {
        const spec = sourceMap[c];
        let val = null;
        if (spec.type === 'direct') {
          val = curValues[spec.sourceChId];
        } else if (spec.type === 'scaled') {
          const base = curValues[spec.sourceChId];
          val = (base !== null && base !== undefined && !isNaN(base)) ? (base * spec.multiplier + spec.offset) : null;
        } else if (spec.type === 'combined') {
          val = this.evalOp(curValues[spec.chA], curValues[spec.chB], spec.op);
        } else if (spec.type === 'formula') {
          val = spec.compiled ? spec.compiled.eval(curValues) : null;
          if (spec.targetChId !== undefined) {
            curValues[spec.targetChId] = val;
            curValues[String(spec.targetChId)] = val;
          }
        }

        const numericVal = (val === null || val === undefined || isNaN(val)) ? DATA_INVALID : val;
        rowOut[c] = numericVal;

        if (numericVal > DATA_INVALID) {
          if (numericVal < channelMin[c]) channelMin[c] = numericVal;
          if (numericVal > channelMax[c]) channelMax[c] = numericVal;
        }
      }

      return rowOut;
    };

    // ── Export Format: CSV ───────────────────────────────────────────────────
    if (format === 'csv') {
      const csvChunks = [];
      const textEncoder = new TextEncoder();

      // Header line
      const headerLine = ['Record ID', 'Timestamp', ...outputChannels.map((c) => `"${c.name} [${c.unit}]"`)].join(',') + '\r\n';
      if (writableStream) {
        await writableStream.write(textEncoder.encode(headerLine));
      } else {
        csvChunks.push(headerLine);
      }

      let recordSeq = 1;
      const CHUNK_SIZE = 2000;
      const startPage = Math.floor(effectiveSampleStart / CHUNK_SIZE);
      const endPage = Math.floor((effectiveSampleEnd - 1) / CHUNK_SIZE);

      // Stream original samples within the cutdown window
      for (let p = startPage; p <= endPage; p++) {
        const pageRows = await new Promise((res) => {
          TestAPI.getTablePage(p, CHUNK_SIZE, null, (data) => {
            res((data && data.rows) || []);
          });
        });

        let chunkStr = '';
        for (let r = 0; r < pageRows.length; r++) {
          const globalIdx = p * CHUNK_SIZE + r;
          if (globalIdx < effectiveSampleStart || globalIdx >= effectiveSampleEnd) {
            continue;
          }
          const rowData = pageRows[r];
          const outVals = computeRow(rowData.values, false, 0, globalIdx);
          const d = new Date(rowData.timestampMs || (startTimeMs + (globalIdx / sampleRate) * 1000));
          const tsStr = d.toISOString().replace('T', ' ').substring(0, 19);

          chunkStr += `${recordSeq++},${tsStr},${Array.from(outVals).map((v) => (v === DATA_INVALID ? '' : v.toFixed(2))).join(',')}\r\n`;
        }

        if (chunkStr.length > 0) {
          if (writableStream) {
            await writableStream.write(textEncoder.encode(chunkStr));
          } else {
            csvChunks.push(chunkStr);
          }
        }

        if (onProgress) {
          onProgress(0.05 + 0.65 * ((p - startPage + 1) / Math.max(1, endPage - startPage + 1)));
        }
      }

      // Stream extended samples
      let extChunkStr = '';
      for (let e = 1; e <= extraSamples; e++) {
        const timeMs = effectiveStopTimeMs + (e / sampleRate) * 1000;
        const outVals = computeRow({}, true, e);
        const d = new Date(timeMs);
        const tsStr = d.toISOString().replace('T', ' ').substring(0, 19);

        extChunkStr += `${recordSeq++},${tsStr},${Array.from(outVals).map((v) => (v === DATA_INVALID ? '' : v.toFixed(2))).join(',')}\r\n`;

        if (e % CHUNK_SIZE === 0 || e === extraSamples) {
          if (writableStream) {
            await writableStream.write(textEncoder.encode(extChunkStr));
          } else {
            csvChunks.push(extChunkStr);
          }
          extChunkStr = '';
          if (onProgress) {
            onProgress(0.70 + 0.28 * (e / extraSamples));
          }
        }
      }

      if (writableStream) {
        await writableStream.close();
        if (onProgress) onProgress(1.0);
        return { success: true, fileName: `${cleanBaseName}.csv`, fileHandle };
      } else {
        const blob = new Blob(csvChunks, { type: 'text/csv;charset=utf-8;' });
        this._downloadBlob(blob, `${cleanBaseName}.csv`);
        const fileObj = new File([blob], `${cleanBaseName}.csv`, { type: 'text/csv' });
        if (onProgress) onProgress(1.0);
        return { success: true, fileName: `${cleanBaseName}.csv`, file: fileObj };
      }
    }

    // ── Export Format: CSD Binary ─────────────────────────────────────────────
    const recordLen = RECORD_ID_LEN + numOutChannels * CHANNEL_VALUE_LEN;

    function writeStr(dv, offset, str, maxLen) {
      const enc = new TextEncoder().encode(str || '');
      const len = Math.min(enc.length, maxLen - 1);
      for (let i = 0; i < len; i++) dv.setUint8(offset + i, enc[i]);
      for (let i = len; i < maxLen; i++) dv.setUint8(offset + i, 0);
    }

    const CHUNK_RECORDS = 5000;
    let dataRecordChunks = [];
    let curChunkBuf = new ArrayBuffer(Math.min(CHUNK_RECORDS, totalSamples) * recordLen);
    let curChunkDv = new DataView(curChunkBuf);
    let curChunkOffset = 0;

    let globalRecordSeq = 1;
    const startCsdPage = Math.floor(effectiveSampleStart / CHUNK_RECORDS);
    const endCsdPage = Math.floor((effectiveSampleEnd - 1) / CHUNK_RECORDS);

    // Process original samples within cutdown window
    for (let p = startCsdPage; p <= endCsdPage; p++) {
      const pageRows = await new Promise((res) => {
        TestAPI.getTablePage(p, CHUNK_RECORDS, null, (data) => {
          res((data && data.rows) || []);
        });
      });

      for (let r = 0; r < pageRows.length; r++) {
        const globalIdx = p * CHUNK_RECORDS + r;
        if (globalIdx < effectiveSampleStart || globalIdx >= effectiveSampleEnd) {
          continue;
        }
        const outVals = computeRow(pageRows[r].values, false, 0, globalIdx);

        curChunkDv.setInt32(curChunkOffset, globalRecordSeq++, false);
        for (let c = 0; c < numOutChannels; c++) {
          curChunkDv.setFloat64(curChunkOffset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN, outVals[c], false);
        }
        curChunkOffset += recordLen;

        if (curChunkOffset >= curChunkBuf.byteLength) {
          dataRecordChunks.push(curChunkBuf);
          const nextCount = Math.min(CHUNK_RECORDS, totalSamples - globalRecordSeq + 1);
          if (nextCount > 0) {
            curChunkBuf = new ArrayBuffer(nextCount * recordLen);
            curChunkDv = new DataView(curChunkBuf);
            curChunkOffset = 0;
          }
        }
      }

      if (onProgress) {
        onProgress(0.05 + 0.60 * ((p - startCsdPage + 1) / Math.max(1, endCsdPage - startCsdPage + 1)));
      }
    }

    // Process extended samples
    for (let e = 1; e <= extraSamples; e++) {
      const outVals = computeRow({}, true, e);

      curChunkDv.setInt32(curChunkOffset, globalRecordSeq++, false);
      for (let c = 0; c < numOutChannels; c++) {
        curChunkDv.setFloat64(curChunkOffset + RECORD_ID_LEN + c * CHANNEL_VALUE_LEN, outVals[c], false);
      }
      curChunkOffset += recordLen;

      if (curChunkOffset >= curChunkBuf.byteLength) {
        dataRecordChunks.push(curChunkBuf);
        const nextCount = Math.min(CHUNK_RECORDS, totalSamples - globalRecordSeq + 1);
        if (nextCount > 0) {
          curChunkBuf = new ArrayBuffer(nextCount * recordLen);
          curChunkDv = new DataView(curChunkBuf);
          curChunkOffset = 0;
        }
      }

      if (e % CHUNK_RECORDS === 0 && onProgress) {
        onProgress(0.65 + 0.25 * (e / extraSamples));
      }
    }

    if (curChunkOffset > 0) {
      dataRecordChunks.push(curChunkBuf.slice(0, curChunkOffset));
    }

    if (onProgress) onProgress(0.92);

    // ── Build Headers ─────────────────────────────────────────────────────────
    // 1. File Header (34 bytes)
    const fileHeader = new ArrayBuffer(FILE_HEADER_LEN);
    const fhDv = new DataView(fileHeader);
    fhDv.setInt32(0, 1, false); // version = 1
    writeStr(fhDv, 4, 'SUTO CSD', 10);

    // 2. Protocol Header (3552 bytes)
    const protoHeader = new ArrayBuffer(PROTOCOL_HEADER_LEN);
    const phDv = new DataView(protoHeader);
    writeStr(phDv, 506, 'SUTO S4A Log', 32);
    phDv.setInt32(3016, numOutChannels, false);
    phDv.setInt32(3020, totalSamples, false);
    phDv.setInt32(3024, Math.round(intervalSec), false);
    phDv.setBigInt64(3032, BigInt(effectiveStartTimeMs), false);
    phDv.setBigInt64(3040, BigInt(newStopTimeMs), false);

    // 3. Channel Headers (918 bytes * numOutChannels)
    const chHeadersBuf = new ArrayBuffer(CHANNEL_HEADER_LEN * numOutChannels);
    const chDv = new DataView(chHeadersBuf);

    outputChannels.forEach((ch, idx) => {
      const base = idx * CHANNEL_HEADER_LEN;
      chDv.setBigInt64(base + 0, BigInt(0), false);

      // Channel description
      const desc = ch.name || `CH${idx + 1}`;
      const descEnc = new TextEncoder().encode(desc);
      const descLen = Math.min(descEnc.length, 126);
      chDv.setInt16(base + 8, descLen, false);
      for (let i = 0; i < descLen; i++) chDv.setUint8(base + 10 + i, descEnc[i]);

      // Sensor desc
      const senEnc = new TextEncoder().encode(desc);
      const senLen = Math.min(senEnc.length, 17);
      chDv.setInt16(base + 289, senLen, false);
      for (let i = 0; i < senLen; i++) chDv.setUint8(base + 291 + i, senEnc[i]);

      // Unit
      const FP = 788;
      const unitEnc = new TextEncoder().encode(ch.unit || '');
      const unitLen = Math.min(unitEnc.length, 56);
      chDv.setInt16(base + FP, unitLen, false);
      for (let i = 0; i < unitLen; i++) chDv.setUint8(base + FP + 2 + i, unitEnc[i]);

      // Stats
      const statsBase = FP + 60; // 848
      chDv.setInt32(base + statsBase, ch.resolution !== undefined ? ch.resolution : 2, false);
      const finalMin = channelMin[idx] < Infinity ? channelMin[idx] : 0;
      const finalMax = channelMax[idx] > -Infinity ? channelMax[idx] : 100;
      chDv.setFloat64(base + statsBase + 4, finalMin, false);
      chDv.setFloat64(base + statsBase + 12, finalMax, false);
      chDv.setInt32(base + statsBase + 28, ch.sensor_id || idx, false);
    });

    // Assemble final output
    const allParts = [fileHeader, protoHeader, chHeadersBuf, ...dataRecordChunks];

    if (writableStream) {
      for (const part of allParts) {
        await writableStream.write(part);
      }
      await writableStream.close();
      if (onProgress) onProgress(1.0);
      return { success: true, fileName: `${cleanBaseName}.csd`, fileHandle };
    } else {
      const blob = new Blob(allParts, { type: 'application/octet-stream' });
      this._downloadBlob(blob, `${cleanBaseName}.csd`);
      const fileObj = new File([blob], `${cleanBaseName}.csd`, { type: 'application/octet-stream' });
      if (onProgress) onProgress(1.0);
      return { success: true, fileName: `${cleanBaseName}.csd`, file: fileObj };
    }
  }

  /**
   * Patches sample values in memory and persists to original file if supported.
   * @param {Object} overrides - { [recordIndex]: { [channelId]: newValue } }
   * @returns {Promise<{ success: boolean, persisted: boolean, count: number }>}
   */
  static async patchSampleValues(overrides) {
    if (TestAPI.patchSampleValues) {
      return await TestAPI.patchSampleValues(overrides);
    }
    return { success: false, persisted: false, count: 0 };
  }

  /**
   * Reads a contiguous slice of sample records for tabular view.
   * @param {number} startSample - Starting global sample index
   * @param {number} count - Number of samples to read
   * @returns {Promise<Array<{ index: number, timestampMs: number, values: Object }>>}
   */
  static async readSampleRange(startSample, count) {
    if (TestAPI.readExportRows) {
      const rows = await TestAPI.readExportRows(startSample, count);
      return rows.map((r, i) => ({
        index: r.index !== undefined ? r.index : (startSample + i),
        timestampMs: r.timestampMs,
        values: r.values || {},
      }));
    }
    // Fallback: use getTablePage
    return new Promise((resolve) => {
      if (!TestAPI.getTablePage) return resolve([]);
      const pageIndex = count > 0 ? Math.floor(startSample / count) : 0;
      TestAPI.getTablePage(pageIndex, count, null, (data) => {
        const rows = (data && data.rows) || [];
        resolve(rows.map((r, i) => ({
          index: r.index !== undefined ? r.index : (startSample + i),
          timestampMs: r.timestampMs,
          values: r.values || {},
        })));
      });
    });
  }

  static _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export default DataModifierEngine;
