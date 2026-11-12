/**
 * Alarm Engine — System-wide telemetry alarm evaluation and history tracking.
 *
 * Evaluates live telemetry values against configured thresholds & hysteresis
 * across all assigned channels and locations, maintains active alarms, and persists
 * an audit history of triggered/acknowledged/cleared alarm events.
 */

import { getLocations, saveLocations } from './sensorManagerStorage';
import { setAlarmChannels } from '../../../util/liveDataSource';
import { formatChannelValue, resolveChannelResolution } from '../../../util/resolution';

export const STORAGE_KEY_ALARM_HISTORY = 's4a_alarm_history_v1';
const MAX_HISTORY_ITEMS = 500;

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

/**
 * Supported Alarm Rule Types:
 * - 'high': val > threshold (clears when val <= threshold - hysteresis)
 * - 'low': val < threshold (clears when val >= threshold + hysteresis)
 * - 'out_of_range': val < min || val > max (clears when val >= min + hysteresis && val <= max - hysteresis)
 * - 'rate_of_change': |dVal / dt_min| > threshold
 * - 'flatline': value unchanged for >= threshold seconds
 * - 'offline': missing/invalid telemetry for >= threshold seconds
 */
export const ALARM_RULE_TYPES = [
  { type: 'high', label: 'High Limit (>)', defaultThreshold: 8.0, unitSuffix: '' },
  { type: 'low', label: 'Low Limit (<)', defaultThreshold: 2.0, unitSuffix: '' },
  { type: 'out_of_range', label: 'Out of Range (< Min or > Max)', defaultMin: 1.0, defaultMax: 10.0 },
  { type: 'rate_of_change', label: 'Rate of Change (|Δ|/min >)', defaultThreshold: 2.0, unitSuffix: '/min' },
  { type: 'flatline', label: 'Flatline / Frozen Sensor', defaultThreshold: 60, unitSuffix: 's' },
  { type: 'offline', label: 'Offline / Signal Loss', defaultThreshold: 30, unitSuffix: 's' }
];

let activeAlarms = [];
let alarmHistory = [];
const subscribers = new Set();

// Bookkeeping for debounce, rate of change, and flatline detection
// channelKey -> { firstViolationTime, lastVal, lastTime, flatlineStartTime }
const evalStateMap = new Map();

function notifySubscribers() {
  for (const fn of subscribers) {
    try {
      fn({ activeAlarms: [...activeAlarms], alarmHistory: [...alarmHistory] });
    } catch (e) {
      console.warn('[AlarmEngine] Subscriber error:', e);
    }
  }
}

/**
 * Load alarm history from storage
 */
export function loadAlarmHistory() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_ALARM_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[AlarmEngine] Error reading history:', e);
    return [];
  }
}

/**
 * Save alarm history to storage (capped at MAX_HISTORY_ITEMS)
 */
function saveAlarmHistory(history) {
  alarmHistory = history.slice(0, MAX_HISTORY_ITEMS);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_ALARM_HISTORY, JSON.stringify(alarmHistory));
  } catch (e) {
    console.warn('[AlarmEngine] Error saving history:', e);
  }
}

/**
 * Append an event to alarm history
 */
function appendHistoryEvent(event) {
  const item = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    ...event
  };
  saveAlarmHistory([item, ...alarmHistory]);
}

/**
 * Get all current active alarms
 */
export function getActiveAlarms() {
  return activeAlarms;
}

/**
 * Get historical alarms
 */
export function getAlarmHistory() {
  if (alarmHistory.length === 0) {
    alarmHistory = loadAlarmHistory();
  }
  return alarmHistory;
}

/**
 * Clear all alarm history
 */
export function clearAlarmHistory() {
  saveAlarmHistory([]);
  notifySubscribers();
}

/**
 * Reset alarm engine state (for tests and clean resets)
 */
export function resetAlarmEngine() {
  activeAlarms = [];
  alarmHistory = [];
  evalStateMap.clear();
  const storage = getStorage();
  if (storage) {
    try { storage.removeItem(STORAGE_KEY_ALARM_HISTORY); } catch (_) {}
  }
  notifySubscribers();
}

/**
 * Acknowledge a specific active alarm
 */
export function acknowledgeAlarm(alarmId) {
  let changed = false;
  activeAlarms = activeAlarms.map(a => {
    if (a.id === alarmId && !a.acknowledged) {
      changed = true;
      appendHistoryEvent({
        alarmId: a.id,
        locationId: a.locationId,
        locationName: a.locationName,
        measurementPointName: a.measurementPointName,
        channelName: a.channelName,
        unit: a.unit,
        ruleType: a.ruleType,
        threshold: a.threshold,
        currentValue: a.currentValue,
        eventType: 'acknowledged',
        severity: a.severity
      });
      return { ...a, acknowledged: true };
    }
    return a;
  });
  if (changed) {
    notifySubscribers();
  }
}

/**
 * Acknowledge all active alarms
 */
export function acknowledgeAllAlarms() {
  let changed = false;
  activeAlarms = activeAlarms.map(a => {
    if (!a.acknowledged) {
      changed = true;
      appendHistoryEvent({
        alarmId: a.id,
        locationId: a.locationId,
        locationName: a.locationName,
        measurementPointName: a.measurementPointName,
        channelName: a.channelName,
        unit: a.unit,
        ruleType: a.ruleType,
        threshold: a.threshold,
        currentValue: a.currentValue,
        eventType: 'acknowledged',
        severity: a.severity
      });
      return { ...a, acknowledged: true };
    }
    return a;
  });
  if (changed) {
    notifySubscribers();
  }
}

/**
 * Subscribe to alarm status and history updates
 */
export function subscribeAlarms(fn) {
  if (typeof fn !== 'function') return () => {};
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Check if a specific channel is currently alarming
 */
export function isChannelInAlarm(channelId, locationId = null) {
  if (!channelId) return false;
  return activeAlarms.some(a => {
    if (locationId && a.locationId !== locationId) return false;
    return a.channelId === channelId;
  });
}

/**
 * Get active alarm for a specific channel (including acknowledged status)
 */
export function getChannelActiveAlarm(channelId, locationId = null) {
  if (!channelId) return null;
  return activeAlarms.find(a => {
    if (locationId && a.locationId !== locationId) return false;
    return a.channelId === channelId;
  }) || null;
}

/**
 * Check if a channel sample value violates the channel's alarm rule (standalone test)
 */
export function isChannelValueInAlarm(channel, val) {
  if (!channel || !channel.alarmConfig || !channel.alarmConfig.enabled) return false;
  if (val === null || val === undefined || val === '--.-' || val === -8888 || val === -9999 || isNaN(val)) {
    return channel.alarmConfig.type === 'offline';
  }
  const num = Number(val);
  const cfg = channel.alarmConfig;
  switch (cfg.type) {
    case 'high':
      return num > Number(cfg.threshold);
    case 'low':
      return num < Number(cfg.threshold);
    case 'out_of_range':
      return num < Number(cfg.min) || num > Number(cfg.max);
    default:
      return false;
  }
}

/**
 * Build consolidated channel list across all locations to demand polling
 */
export function refreshAssignedChannels() {
  const locs = getLocations();
  const demanded = [];
  const seen = new Set();

  locs.forEach(loc => {
    (loc.measurementPoints || []).forEach(mp => {
      (mp.channels || []).forEach(ch => {
        if (!ch) return;
        const key = ch.id || ch.channel_id;
        if (key && !seen.has(key)) {
          demanded.push({
            id: ch.id,
            channel_id: ch.channel_id,
            name: ch.name,
            deviceId: ch.deviceId,
            deviceSerial: ch.deviceSerial,
            devicePort: ch.devicePort,
            device: ch.device
          });
          seen.add(key);
        }
      });
    });
  });

  // Supply demanded channels to global poller so all locations stay actively monitored
  setAlarmChannels(demanded.length > 0 ? demanded : null);
}

/**
 * Evaluate incoming live telemetry against all assigned channels across all locations
 */
export function evaluateLiveTelemetry(res) {
  if (!res) return;
  const rawList = Array.isArray(res) ? res : (Array.isArray(res.channels) ? res.channels : []);
  if (rawList.length === 0) return;

  const locs = getLocations();
  if (!Array.isArray(locs) || locs.length === 0) return;

  // Build telemetry lookup maps
  const byDevId = new Map();
  const byId = new Map();
  const byName = new Map();

  rawList.forEach((item, idx) => {
    const id = (item.channel_id !== undefined && item.channel_id !== null) ? item.channel_id : item.id;
    const devKeys = [
      item.deviceId,
      item.device_id,
      item.serial,
      item.serial_number,
      item.port ? String(item.port) : null,
      item.device
    ].filter(Boolean);

    devKeys.forEach(dk => {
      const k = String(dk).toLowerCase();
      if (id !== undefined && id !== null) {
        byDevId.set(`${k}_${id}`, item);
        byDevId.set(`${k}_idx_${idx + 1}`, item);
      }
    });

    if (id !== undefined && id !== null) {
      byId.set(String(id), item);
      byId.set(Number(id), item);
    }
    byId.set(`idx_${idx + 1}`, item);

    const names = [
      item.name,
      item.channel_name,
      item.logic_channel_description,
      item.description,
      item.full_channel_name
    ];
    names.forEach(n => {
      if (n && typeof n === 'string') {
        byName.set(n.trim().toLowerCase(), item);
        devKeys.forEach(dk => {
          byName.set(`${String(dk).toLowerCase()}_${n.trim().toLowerCase()}`, item);
        });
      }
    });
  });

  const now = Date.now();
  let stateChanged = false;
  const currentAlarmIds = new Set(activeAlarms.map(a => a.id));
  const stillActiveAlarmIds = new Set();

  locs.forEach(loc => {
    (loc.measurementPoints || []).forEach(mp => {
      (mp.channels || []).forEach(ch => {
        const cfg = ch.alarmConfig;
        if (!cfg || !cfg.enabled) return;

        const chKey = String(ch.channel_id ?? ch.id ?? '').toLowerCase();
        const chNameKey = (ch.name || '').trim().toLowerCase();
        const devKey = String(ch.deviceId || ch.deviceSerial || ch.devicePort || ch.device || '').toLowerCase();

        // Find telemetry item matching this assigned channel
        let item = null;
        if (devKey && chKey) {
          item = byDevId.get(`${devKey}_${chKey}`);
        }
        if (!item && devKey && chNameKey) {
          item = byName.get(`${devKey}_${chNameKey}`);
        }
        if (!item) {
          item = byId.get(chKey) || byName.get(chNameKey);
        }

        const rawVal = item ? (item.current_value !== undefined ? item.current_value : item.value) : null;
        const isOffline = (item === null || rawVal === null || rawVal === undefined || isNaN(rawVal) || rawVal === -8888 || rawVal === -9999);
        const val = isOffline ? null : Number(rawVal);
        const res = item ? resolveChannelResolution(item) : resolveChannelResolution(ch);
        const formatVal = (v) => {
          if (v === null || v === undefined) return 'Offline';
          if (typeof v === 'string') return v;
          return formatChannelValue(v, res);
        };

        const channelUniqueKey = `${loc.id}_${mp.id}_${ch.id || ch.channel_id}`;
        let evalState = evalStateMap.get(channelUniqueKey);
        if (!evalState) {
          evalState = {
            firstViolationTime: null,
            lastVal: val,
            lastTime: now,
            flatlineStartTime: now
          };
          evalStateMap.set(channelUniqueKey, evalState);
        }

        const alarmId = `alarm_${loc.id}_${mp.id}_${ch.id || ch.channel_id}_${cfg.type}`;
        const existingAlarm = activeAlarms.find(a => a.id === alarmId);

        // Evaluate violation and recovery
        let isViolating = false;
        let isRecovered = false;
        const hyst = Number(cfg.hysteresis) || 0;
        const thresh = Number(cfg.threshold) || 0;
        const minThresh = Number(cfg.min) || 0;
        const maxThresh = Number(cfg.max) || 0;

        switch (cfg.type) {
          case 'high':
            if (val !== null) {
              if (val > thresh) {
                isViolating = true;
              } else if (val <= thresh - hyst) {
                isRecovered = true;
              }
            } else {
              isRecovered = true;
            }
            break;

          case 'low':
            if (val !== null) {
              if (val < thresh) {
                isViolating = true;
              } else if (val >= thresh + hyst) {
                isRecovered = true;
              }
            } else {
              isRecovered = true;
            }
            break;

          case 'out_of_range':
            if (val !== null) {
              if (val < minThresh || val > maxThresh) {
                isViolating = true;
              } else if (val >= minThresh + hyst && val <= maxThresh - hyst) {
                isRecovered = true;
              }
            } else {
              isRecovered = true;
            }
            break;

          case 'rate_of_change':
            if (val !== null && evalState.lastVal !== null && now > evalState.lastTime) {
              const dtMin = (now - evalState.lastTime) / 60000;
              const rate = Math.abs(val - evalState.lastVal) / Math.max(0.01, dtMin);
              if (rate > thresh) {
                isViolating = true;
              } else if (rate <= Math.max(0, thresh - hyst)) {
                isRecovered = true;
              }
            }
            break;

          case 'flatline':
            if (val !== null && evalState.lastVal !== null) {
              const delta = Math.abs(val - evalState.lastVal);
              if (delta <= (hyst > 0 ? hyst : 0.0001)) {
                const flatDurationSec = (now - evalState.flatlineStartTime) / 1000;
                if (flatDurationSec >= Math.max(5, thresh)) {
                  isViolating = true;
                }
              } else {
                evalState.flatlineStartTime = now;
                isRecovered = true;
              }
            }
            break;

          case 'offline':
            if (isOffline) {
              if (!evalState.firstViolationTime) {
                evalState.firstViolationTime = now;
              }
              const offlineDurationSec = (now - evalState.firstViolationTime) / 1000;
              if (offlineDurationSec >= Math.max(2, thresh)) {
                isViolating = true;
              }
            } else {
              isRecovered = true;
            }
            break;

          default:
            break;
        }

        // Update tracking state
        evalState.lastVal = val;
        evalState.lastTime = now;

        // Apply delay / debounce requirement
        const delayMs = (Number(cfg.delaySeconds) || 0) * 1000;
        if (isViolating) {
          if (!evalState.firstViolationTime) {
            evalState.firstViolationTime = now;
          }
          const violationDurationMs = now - evalState.firstViolationTime;
          if (violationDurationMs >= delayMs) {
            stillActiveAlarmIds.add(alarmId);
            const formattedVal = val !== null ? formatVal(val) : 'Offline';
            const formattedThreshold = cfg.type === 'out_of_range'
              ? `${formatVal(minThresh)} ~ ${formatVal(maxThresh)}`
              : (cfg.type === 'flatline' || cfg.type === 'offline' ? thresh : formatVal(thresh));

            if (!existingAlarm) {
              // Trigger new alarm
              const newAlarm = {
                id: alarmId,
                locationId: loc.id,
                locationName: loc.name,
                scapeId: loc.scapeId,
                measurementPointId: mp.id,
                measurementPointName: mp.name,
                channelId: ch.id,
                channelName: ch.displayName || ch.name,
                unit: ch.unit || '',
                severity: cfg.severity || 'critical',
                ruleType: cfg.type,
                threshold: formattedThreshold,
                hysteresis: hyst,
                currentValue: formattedVal,
                rawValue: val,
                resolution: res,
                triggeredAt: now,
                acknowledged: false,
                message: cfg.message || ''
              };
              activeAlarms.push(newAlarm);
              appendHistoryEvent({
                alarmId,
                locationId: loc.id,
                locationName: loc.name,
                measurementPointName: mp.name,
                channelName: ch.displayName || ch.name,
                unit: ch.unit || '',
                ruleType: cfg.type,
                threshold: newAlarm.threshold,
                currentValue: newAlarm.currentValue,
                eventType: 'triggered',
                severity: cfg.severity || 'critical'
              });
              stateChanged = true;
            } else {
              // Update current value
              existingAlarm.currentValue = formattedVal;
              existingAlarm.rawValue = val;
            }
          }
        } else if (isRecovered) {
          evalState.firstViolationTime = null;
          if (existingAlarm) {
            // Alarm cleared!
            activeAlarms = activeAlarms.filter(a => a.id !== alarmId);
            appendHistoryEvent({
              alarmId,
              locationId: loc.id,
              locationName: loc.name,
              measurementPointName: mp.name,
              channelName: ch.displayName || ch.name,
              unit: ch.unit || '',
              ruleType: cfg.type,
              threshold: existingAlarm.threshold,
              currentValue: val !== null ? formatVal(val) : 'Restored',
              eventType: 'cleared',
              severity: cfg.severity || 'critical',
              durationMs: now - existingAlarm.triggeredAt
            });
            stateChanged = true;
          }
        } else if (existingAlarm) {
          // Inside hysteresis deadband: alarm stays active and reflects latest value
          stillActiveAlarmIds.add(alarmId);
          if (val !== null) {
            existingAlarm.currentValue = formatVal(val);
            existingAlarm.rawValue = val;
          }
        }
      });
    });
  });

  if (stateChanged) {
    notifySubscribers();
  }
}

/**
 * Update a specific channel's alarm configuration
 */
export function setChannelAlarmConfig(locationId, mpId, channelId, alarmConfig) {
  const locs = getLocations();
  let changed = false;

  const nextLocs = locs.map(loc => {
    if (loc.id !== locationId) return loc;
    const nextMps = (loc.measurementPoints || []).map(mp => {
      if (mp.id !== mpId) return mp;
      const nextChs = (mp.channels || []).map(ch => {
        if (ch.id === channelId || ch.channel_id === channelId) {
          changed = true;
          return {
            ...ch,
            alarmConfig: { ...alarmConfig }
          };
        }
        return ch;
      });
      return { ...mp, channels: nextChs };
    });
    return { ...loc, measurementPoints: nextMps };
  });

  if (changed) {
    saveLocations(nextLocs);
    refreshAssignedChannels();
  }
  return changed;
}

// Initialize history on module load
if (typeof window !== 'undefined') {
  alarmHistory = loadAlarmHistory();
}
