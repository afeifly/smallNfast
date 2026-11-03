import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeLive, setViewDemand } from '../../../util/liveDataSource';
import { formatChannelValue, resolveChannelResolution } from '../../../util/resolution';
import { autoReconnectSavedDevices } from './sensorManagerStorage';

function formatVal(val, resolution = 2) {
  if (val === -8888 || val === -9999 || val === null || val === undefined || isNaN(val)) {
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
  enabled = true
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

  const handleLiveResult = useCallback((res) => {
    if (!res) return;
    const rawList = Array.isArray(res) ? res : (Array.isArray(res.channels) ? res.channels : []);
    if (rawList.length === 0) return;

    // Build lookup maps by channel_id, name, and normalized description
    const byId = new Map();
    const byName = new Map();

    rawList.forEach(item => {
      const id = item.channel_id ?? item.id;
      if (id !== undefined && id !== null) {
        byId.set(String(id), item);
        byId.set(Number(id), item);
      }
      const n = (item.name || item.logic_channel_description || '').trim().toLowerCase();
      if (n) byName.set(n, item);
    });

    let detectedFlowVal = null;

    // Update sensor cards matching bound channels or metric names
    setElements(prevElems => {
      let changed = false;
      const nextElems = prevElems.map(el => {
        if (el.type !== 'sensor_card' || !Array.isArray(el.channels)) {
          return el;
        }

        let cardChanged = false;
        const updatedChannels = el.channels.map(ch => {
          const chKey = String(ch.channel_id || ch.id || '').toLowerCase();
          const chNameKey = (ch.name || '').trim().toLowerCase();
          const chRawNameKey = (ch.rawName || '').trim().toLowerCase();

          // Try match by explicit channel ID, then by original channel name or display name
          const liveItem = byId.get(chKey) || byId.get(Number(chKey)) || byName.get(chRawNameKey) || byName.get(chNameKey);
          if (liveItem) {
            const rawVal = liveItem.current_value !== undefined ? liveItem.current_value : liveItem.value;
            const res = (typeof liveItem.resolution === 'number' && liveItem.resolution >= 0)
              ? liveItem.resolution
              : resolveChannelResolution(liveItem);
            const formatted = formatVal(rawVal, res);
            const status = liveItem.status || 'normal';
            const unit = liveItem.unit || ch.unit;

            if (chNameKey.includes('flow') || (unit && unit.includes('m³'))) {
              if (typeof rawVal === 'number' && !isNaN(rawVal)) {
                detectedFlowVal = rawVal;
              }
            }

            if (ch.val !== formatted || ch.status !== status || ch.unit !== unit) {
              cardChanged = true;
              return {
                ...ch,
                val: formatted,
                unit,
                status
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

    // If flow telemetry detected, dynamically drive pipe animation
    if (detectedFlowVal !== null) {
      setPipes(prevPipes => {
        const nextFlow = detectedFlowVal > 0.05 ? 'forward' : (detectedFlowVal < -0.05 ? 'reverse' : 'off');
        let pipeChanged = false;
        const nextPipes = prevPipes.map(p => {
          if (p.flow !== nextFlow) {
            pipeChanged = true;
            return { ...p, flow: nextFlow };
          }
          return p;
        });
        return pipeChanged ? nextPipes : prevPipes;
      });
    }

    setTelemetryState({
      isConnected: true,
      lastUpdate: new Date(),
      channelCount: rawList.length
    });
  }, [setElements, setPipes]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' && !window.__ENABLE_AUTO_RECONNECT_TEST__) {
      return;
    }
    autoReconnectSavedDevices().catch((err) => {
      console.warn('[ProcessScapeTelemetry] Auto-reconnect note:', err);
    });
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

  return telemetryState;
}

