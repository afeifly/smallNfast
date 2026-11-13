import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeLive, setViewDemand, setActiveLocationChannels } from '../../../util/liveDataSource';
import { formatChannelValue, resolveChannelResolution } from '../../../util/resolution';
import { autoReconnectSavedDevices, getSavedDevices, getLocations } from './sensorManagerStorage';
import { isChannelInAlarm, getChannelActiveAlarm, subscribeAlarms } from './alarmEngine';
import { applyModbusChannelScaling } from '../../../api/modbusProtocol';
import TauriSutoAPI from '../../../api/TauriSutoAPI';

function formatVal(val, resolution = 2) {
  if (val === -8888 || val === -9999 || val === -8886 || val === null || val === undefined || isNaN(val)) {
    return '--.-';
  }
  return formatChannelValue(val, resolution);
}

/**
 * Hook connecting ProcessScape to real SUTO device live telemetry.
 * Subscribes to liveDataSource polling loop and updates bound sensor cards & pipes in real time.
 */
export function useProcessScapeTelemetry({
  elements,
  pipes,
  setElements,
  setPipes,
  enabled = true,
  activeLocationId = null,
  onDeviceConnected = null
}) {
  const [telemetryState, setTelemetryState] = useState({
    isConnected: false,
    lastUpdate: null,
    channelCount: 0
  });

  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const pipesRef = useRef(pipes);
  pipesRef.current = pipes;
  const activeLocationIdRef = useRef(activeLocationId);
  activeLocationIdRef.current = activeLocationId;
  const onDeviceConnectedRef = useRef(onDeviceConnected);
  onDeviceConnectedRef.current = onDeviceConnected;

  const handleLiveResult = useCallback((res) => {
    if (!res) return;
    const rawList = Array.isArray(res) ? res : (Array.isArray(res.channels) ? res.channels : []);
    if (rawList.length === 0) return;

    // Build lookup maps by device + channel_id, channel_id, name, and normalized description
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

    // Detect whether multiple distinct devices are transmitting in this telemetry packet
    const distinctLiveDevices = new Set();
    rawList.forEach(item => {
      const devK = item.deviceId || item.device_id || item.serial || item.port || item.device;
      if (devK) distinctLiveDevices.add(String(devK).toLowerCase());
    });
    const hasMultipleLiveDevices = distinctLiveDevices.size > 1;

    // Cache channel -> device mapping from saved devices in storage
    let channelToDevMap = new Map();
    try {
      const devs = getSavedDevices();
      (devs || []).forEach(d => {
        (d.sensors || []).forEach(s => {
          (s.channels || []).forEach(c => {
            if (c.id) {
              channelToDevMap.set(String(c.id), d);
            }
          });
        });
      });
    } catch (_) { }

    // Update sensor cards matching bound channels or metric names
    setElements(prevElems => {
      let changed = false;
      const curLocId = activeLocationIdRef.current;

      const nextElems = prevElems.map(el => {
        if (el.type !== 'sensor_card' || !Array.isArray(el.channels)) {
          return el;
        }

        // Only the sensor in current location can refresh value; background location sensors do not update values
        if (curLocId && curLocId !== 'example_demo' && el.locationId && el.locationId !== curLocId) {
          return el;
        }

        let cardChanged = false;
        const updatedChannels = el.channels.map((ch, chIdx) => {
          const rawChId = (ch.channel_id !== undefined && ch.channel_id !== null)
            ? ch.channel_id
            : ((ch.channelId !== undefined && ch.channelId !== null) ? ch.channelId : ch.id);
          const chKey = String(rawChId ?? '').toLowerCase();
          const chNameKey = (ch.name || '').trim().toLowerCase();
          const chRawNameKey = (ch.rawName || '').trim().toLowerCase();
          const chDisplayKey = (ch.displayName || '').trim().toLowerCase();

          // Resolve device from saved devices mapping or by parsing ch.id
          const savedDev = (ch.id && channelToDevMap.get(String(ch.id))) || null;

          let parsedDevId = null;
          let parsedSn = null;
          let parsedPort = null;
          if (typeof ch.id === 'string') {
            const m = ch.id.match(/^ch_(dev_[a-zA-Z0-9_-]+?)_\d+(?:_\d+)?$/);
            if (m) {
              parsedDevId = m[1];
              const pm = parsedDevId.match(/_(\d{2,5})$/);
              if (pm) parsedPort = pm[1];
              const snm = parsedDevId.match(/_sn_([a-zA-Z0-9_-]+)/);
              if (snm) parsedSn = snm[1];
            }
          }

          // Collect strict instance identifiers for this channel / card
          const targetInstanceKeys = [
            ch.deviceId,
            ch.deviceSerial,
            ch.devicePort ? String(ch.devicePort) : null,
            savedDev?.id,
            savedDev?.serial ? String(savedDev.serial) : null,
            savedDev?.connectionConfig?.port ? String(savedDev.connectionConfig.port) : null,
            parsedDevId,
            parsedSn,
            parsedPort,
            el.deviceId,
            el.serial,
            el.devicePort ? String(el.devicePort) : null,
            el.port ? String(el.port) : null
          ].filter(Boolean);

          const targetModelNames = [
            ch.device,
            savedDev?.name,
            el.device
          ].filter(Boolean);

          let liveItem = null;

          // 1. Try matching with strict hardware instance scoping first (prevents channel cross-talk between multi-devices)
          for (const ik of targetInstanceKeys) {
            const k = String(ik).toLowerCase();
            liveItem = byDevId.get(`${k}_${chKey}`) ||
              byDevId.get(`${k}_${ch.channel_id}`) ||
              byName.get(`${k}_${chRawNameKey}`) ||
              byName.get(`${k}_${chNameKey}`) ||
              byName.get(`${k}_${chDisplayKey}`);
            if (liveItem) break;
          }

          // Fallback to model name only if NO instance keys exist and there are no multiple live devices
          if (!liveItem && targetInstanceKeys.length === 0 && !hasMultipleLiveDevices) {
            for (const mn of targetModelNames) {
              const k = String(mn).toLowerCase();
              liveItem = byDevId.get(`${k}_${chKey}`) ||
                byDevId.get(`${k}_${ch.channel_id}`) ||
                byName.get(`${k}_${chRawNameKey}`) ||
                byName.get(`${k}_${chNameKey}`);
              if (liveItem) break;
            }
          }

          // 2. Fallback to un-scoped lookup ONLY if candidate doesn't conflict with a different device
          if (!liveItem) {
            let candidate = byId.get(chKey) || byId.get(Number(chKey));
            if (!candidate && ch.channel_id !== undefined && ch.channel_id !== null) {
              candidate = byId.get(String(ch.channel_id)) || byId.get(Number(ch.channel_id));
            }
            if (!candidate && ch.channelId !== undefined && ch.channelId !== null) {
              candidate = byId.get(String(ch.channelId)) || byId.get(Number(ch.channelId));
            }
            if (!candidate && typeof ch.id === 'string') {
              const m = ch.id.match(/_(\d+)(?:_\d+)?$/);
              if (m) {
                candidate = byId.get(m[1]) || byId.get(Number(m[1]));
              }
            }
            if (!candidate) {
              candidate = byName.get(chRawNameKey) || byName.get(chNameKey) || byName.get(chDisplayKey);
            }
            if (!candidate && !hasMultipleLiveDevices && targetInstanceKeys.length === 0 && rawList.length === el.channels.length && rawList[chIdx]) {
              candidate = rawList[chIdx];
            }

            if (candidate) {
              const candPort = candidate.port ? Number(candidate.port) : null;
              const candSerial = candidate.serial || candidate.serial_number ? String(candidate.serial || candidate.serial_number) : null;
              const candId = candidate.deviceId || candidate.device_id ? String(candidate.deviceId || candidate.device_id).toLowerCase() : null;

              const chPort = ch.devicePort || savedDev?.connectionConfig?.port || parsedPort || el.devicePort || el.port
                ? Number(ch.devicePort || savedDev?.connectionConfig?.port || parsedPort || el.devicePort || el.port)
                : null;
              const chSerial = ch.deviceSerial || savedDev?.serial || parsedSn || el.serial
                ? String(ch.deviceSerial || savedDev?.serial || parsedSn || el.serial)
                : null;
              const chId = ch.deviceId || savedDev?.id || parsedDevId || el.deviceId
                ? String(ch.deviceId || savedDev?.id || parsedDevId || el.deviceId).toLowerCase()
                : null;

              const isGenericId = (id) => !id || id.startsWith('dev_single_') || id.startsWith('dev_ble_') || id.startsWith('dev_usb_');
              const hasConflict = (candPort && chPort && candPort !== chPort) ||
                (candSerial && chSerial && candSerial !== chSerial) ||
                (candId && chId && !isGenericId(candId) && !isGenericId(chId) && candId !== chId);

              if (!hasConflict) {
                const hasInstanceMatch = (candPort && chPort && candPort === chPort) ||
                  (candSerial && chSerial && candSerial === chSerial) ||
                  (candId && chId && candId === chId);

                if (hasInstanceMatch) {
                  liveItem = candidate;
                } else if (!hasMultipleLiveDevices) {
                  // Only single device transmitting telemetry (e.g. connected BLE/USB sensor)
                  liveItem = candidate;
                }
              }
            }
          }

          if (liveItem) {
            let rawVal = liveItem.current_value !== undefined ? liveItem.current_value : liveItem.value;
            const chHasScaling = Boolean(ch && (
              (typeof ch.mBA1 === 'number' && Math.abs(ch.mBA1 - 1.0) > 1e-9) ||
              (typeof ch.a1 === 'number' && Math.abs(ch.a1 - 1.0) > 1e-9) ||
              (typeof ch.mBA0 === 'number' && Math.abs(ch.mBA0) > 1e-9) ||
              (typeof ch.a0 === 'number' && Math.abs(ch.a0) > 1e-9) ||
              (ch.x0 !== undefined && ch.y1 !== undefined && (Math.abs(ch.x0 - (ch.y0 ?? 0)) > 1e-9 || Math.abs(ch.x1 - (ch.y1 ?? 1)) > 1e-9))
            ));
            if (chHasScaling && liveItem.rawValue !== undefined && liveItem.rawValue !== null) {
              const directScaled = applyModbusChannelScaling(liveItem.rawValue, ch);
              if (directScaled !== null && directScaled !== undefined) {
                rawVal = directScaled;
              }
            }
            const res = (typeof liveItem.resolution === 'number' && liveItem.resolution >= 0)
              ? liveItem.resolution
              : resolveChannelResolution(liveItem);
            const formatted = formatVal(rawVal, res);
            const activeAlarm = getChannelActiveAlarm(ch.id, el.locationId);
            const inAlarm = Boolean(activeAlarm) || (ch.alarmConfig?.enabled && (
              ch.alarmConfig.type === 'high' ? (Number(rawVal) > Number(ch.alarmConfig.threshold)) :
                ch.alarmConfig.type === 'low' ? (Number(rawVal) < Number(ch.alarmConfig.threshold)) :
                  ch.alarmConfig.type === 'out_of_range' ? (Number(rawVal) < Number(ch.alarmConfig.min) || Number(rawVal) > Number(ch.alarmConfig.max)) : false
            ));
            const isAlarmAcked = Boolean(activeAlarm?.acknowledged);
            const status = inAlarm ? 'alarm' : (liveItem.status || 'normal');
            const unit = liveItem.unit || ch.unit;
            const isAlarmChanged = Boolean(ch.isAlarm) !== Boolean(inAlarm);
            const isAckChanged = Boolean(ch.isAlarmAcked) !== isAlarmAcked;

            if (ch.val !== formatted || ch.status !== status || ch.unit !== unit || isAlarmChanged || isAckChanged) {
              cardChanged = true;
              return {
                ...ch,
                val: formatted,
                unit,
                status,
                isAlarm: inAlarm,
                isAlarmAcked: isAlarmAcked
              };
            }
          }
          return ch;
        });

        if (cardChanged) {
          changed = true;
          return { ...el, channels: updatedChannels };
        }
        return el;
      });

      return changed ? nextElems : prevElems;
    });

    setTelemetryState({
      isConnected: true,
      lastUpdate: new Date(),
      channelCount: rawList.length
    });
  }, [setElements]);

  // Subscribe to alarm state changes (trigger, clear, ack, disable) so canvas elements update immediately
  useEffect(() => {
    const unsubAlarms = subscribeAlarms(() => {
      setElements(prevElems => {
        let changed = false;
        const nextElems = (prevElems || []).map(el => {
          if (!el || !Array.isArray(el.channels)) return el;
          let cardChanged = false;
          const updatedChannels = el.channels.map(ch => {
            const activeAlarm = getChannelActiveAlarm(ch.id, el.locationId);
            const inAlarm = Boolean(activeAlarm) || (ch.alarmConfig?.enabled && (
              ch.alarmConfig.type === 'high' ? (Number(ch.val) > Number(ch.alarmConfig.threshold)) :
              ch.alarmConfig.type === 'low' ? (Number(ch.val) < Number(ch.alarmConfig.threshold)) :
              ch.alarmConfig.type === 'out_of_range' ? (Number(ch.val) < Number(ch.alarmConfig.min) || Number(ch.val) > Number(ch.alarmConfig.max)) : false
            ));
            const isAlarmAcked = Boolean(activeAlarm?.acknowledged);
            const status = inAlarm ? 'alarm' : (ch.status === 'alarm' ? 'normal' : ch.status);
            const isAlarmChanged = Boolean(ch.isAlarm) !== Boolean(inAlarm);
            const isAckChanged = Boolean(ch.isAlarmAcked) !== isAlarmAcked;

            if (isAlarmChanged || isAckChanged || (ch.status === 'alarm' && !inAlarm)) {
              cardChanged = true;
              return {
                ...ch,
                status,
                isAlarm: inAlarm,
                isAlarmAcked: isAlarmAcked
              };
            }
            return ch;
          });
          if (cardChanged) {
            changed = true;
            return { ...el, channels: updatedChannels };
          }
          return el;
        });
        return changed ? nextElems : prevElems;
      });
    });
    return () => unsubAlarms();
  }, [setElements]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' && !window.__ENABLE_AUTO_RECONNECT_TEST__) {
      return;
    }

    const tryReconnect = () => {
      autoReconnectSavedDevices((conn) => {
        if (conn && typeof onDeviceConnectedRef.current === 'function') {
          onDeviceConnectedRef.current(conn);
        }
      }).catch((err) => {
        console.warn('[ProcessScapeTelemetry] Auto-reconnect note:', err);
      });
    };

    // Auto-recovery
    tryReconnect();

    // Periodic auto-recovery check every 5 seconds for any disconnected or pending devices
    const interval = setInterval(() => {
      tryReconnect();
    }, 5000);

    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setViewDemand(true);

    const unsubscribe = subscribeLive((res) => {
      handleLiveResult(res);
    });

    return () => {
      unsubscribe();
      setViewDemand(false);
    };
  }, [enabled, handleLiveResult]);

  // Synchronize active location channels with live polling scheduler
  useEffect(() => {
    if (!enabled) {
      setActiveLocationChannels(null);
      return;
    }

    const computeAndSetNeededChannels = () => {
      const curLocId = activeLocationIdRef.current;
      if (!curLocId || curLocId === 'example_demo') {
        setActiveLocationChannels([]);
        return;
      }

      const locs = getLocations();
      const activeLoc = locs.find(l => l.id === curLocId);
      const savedDevs = getSavedDevices() || [];
      const devById = new Map();
      const devByChId = new Map();
      savedDevs.forEach(d => {
        if (d?.id) devById.set(String(d.id), d);
        (d?.sensors || []).forEach(s => {
          (s?.channels || []).forEach(c => {
            if (c?.id) devByChId.set(String(c.id), d);
          });
        });
      });

      const enrichChannelDemand = (ch, extra = {}) => {
        const matchedDev = (ch.deviceId && devById.get(String(ch.deviceId))) || (ch.id && devByChId.get(String(ch.id))) || null;
        return {
          ...ch,
          ...extra,
          deviceId: extra.deviceId || ch.deviceId || matchedDev?.id,
          deviceSerial: extra.deviceSerial || ch.deviceSerial || matchedDev?.serial,
          transport: ch.transport || matchedDev?.connectionConfig?.transport || matchedDev?.transport,
          transportType: ch.transportType || matchedDev?.transportType || matchedDev?.connectionConfig?.transport
        };
      };

      const needed = [];

      if (activeLoc && Array.isArray(activeLoc.measurementPoints)) {
        activeLoc.measurementPoints.forEach(mp => {
          (mp.channels || []).forEach(ch => {
            needed.push(enrichChannelDemand(ch, {
              locationId: activeLoc.id,
              locationName: activeLoc.name,
              measurementPointId: mp.id,
              measurementPointName: mp.name
            }));
          });
        });
      }

      (elementsRef.current || []).forEach(el => {
        if (el.type === 'sensor_card' && el.locationId === curLocId && Array.isArray(el.channels)) {
          el.channels.forEach(ch => {
            needed.push(enrichChannelDemand(ch, {
              locationId: curLocId,
              deviceId: el.deviceId || ch.deviceId,
              deviceSerial: el.serial || ch.deviceSerial
            }));
          });
        }
      });

      setActiveLocationChannels(needed);
    };

    computeAndSetNeededChannels();

    const handleLocationsChanged = () => {
      computeAndSetNeededChannels();
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('sensor-locations-changed', handleLocationsChanged);
    }

    return () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('sensor-locations-changed', handleLocationsChanged);
      }
      setActiveLocationChannels(null);
    };
  }, [enabled, activeLocationId, elements]);

  return telemetryState;
}

