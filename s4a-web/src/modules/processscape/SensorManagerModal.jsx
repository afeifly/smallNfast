import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './SensorManagerModal.css';
import DeviceConnectModal from '../../components/DeviceConnectModal';
import TauriSutoAPI from '../../api/TauriSutoAPI';
import {
  getLocations,
  saveLocations,
  getSavedDevices,
  saveDevices,
  buildDeviceFromRawChannels,
  syncAllLocationsToScapes,
  getDeviceChannelAssignments,
  removeDeviceAndUnassignChannels
} from './engine/sensorManagerStorage';
import { getAllScapes, createNewScape } from './engine/scapeStorage';

export default function SensorManagerModal({
  isOpen,
  onClose,
  onSyncToScape,
  activeDeviceInfo,
  onDeviceConnected
}) {
  const [locations, setLocations] = useState(() => getLocations());
  const [scapes, setScapes] = useState(() => getAllScapes());
  const [devices, setDevices] = useState(() => getSavedDevices());
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectInitialTab, setConnectInitialTab] = useState(null);
  const [connectInitialMode, setConnectInitialMode] = useState('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverMpId, setDragOverMpId] = useState(null);
  const [dragOverLocId, setDragOverLocId] = useState(null);
  const [collapsedDevices, setCollapsedDevices] = useState(new Set());
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [pendingDeleteDevice, setPendingDeleteDevice] = useState(null);

  // Set of channel IDs assigned anywhere across all locations (guarantees channel exclusivity)
  const assignedChannelIdSet = useMemo(() => {
    const set = new Set();
    locations.forEach(loc => {
      (loc.measurementPoints || []).forEach(mp => {
        (mp.channels || []).forEach(ch => {
          if (ch.id) set.add(String(ch.id));
          if (ch.channelId) set.add(String(ch.channelId));
          if (ch.channel_id !== undefined && ch.channel_id !== null) {
            set.add(String(ch.channel_id));
            set.add(`cid_${ch.channel_id}`);
          }
        });
      });
    });
    return set;
  }, [locations]);

  const isChannelAssigned = useCallback((ch) => {
    if (!ch) return false;
    if (ch.id && (assignedChannelIdSet.has(String(ch.id)) || assignedChannelIdSet.has(`cid_${ch.id}`))) return true;
    if (ch.channelId && (assignedChannelIdSet.has(String(ch.channelId)) || assignedChannelIdSet.has(`cid_${ch.channelId}`))) return true;
    if (ch.channel_id !== undefined && ch.channel_id !== null &&
      (assignedChannelIdSet.has(String(ch.channel_id)) || assignedChannelIdSet.has(`cid_${ch.channel_id}`))) return true;
    return false;
  }, [assignedChannelIdSet]);

  const totalMps = useMemo(() => {
    return locations.reduce((acc, loc) => acc + (loc.measurementPoints?.length || 0), 0);
  }, [locations]);

  // Actual count of unique channels mapped into measurement points
  const totalAssignedChannelsCount = useMemo(() => {
    return locations.reduce((acc, loc) => {
      return acc + (loc.measurementPoints || []).reduce((mAcc, mp) => mAcc + (mp.channels?.length || 0), 0);
    }, 0);
  }, [locations]);

  // Load saved state on open
  useEffect(() => {
    if (isOpen) {
      setScapes(getAllScapes());
      setLocations(getLocations());
      setDevices(getSavedDevices());
    }
  }, [isOpen]);

  /**
   * Handle real hardware connected from reused DeviceConnectModal
   * One time one sensor, appending to collect as many sensors as needed.
   */
  const handleHardwareConnected = async (conn) => {
    setShowConnectModal(false);
    setLoadingDevices(true);
    setSyncFeedback('Reading sensor channels from hardware...');

    try {
      let rawChs = [];
      let sysInfo = null;

      try {
        if (typeof TauriSutoAPI.getChannels === 'function') {
          rawChs = await TauriSutoAPI.getChannels();
        }
      } catch (err) {
        console.warn('[SensorManager] getChannels note:', err);
      }

      try {
        if (typeof TauriSutoAPI.getSystemInfo === 'function') {
          sysInfo = await TauriSutoAPI.getSystemInfo();
        }
      } catch (err) {
        console.warn('[SensorManager] getSystemInfo note:', err);
      }

      const transport = conn?.transport || TauriSutoAPI?.getActiveTransport?.() || 'USB';
      const transportType = (typeof transport === 'string' ? transport : 'USB').toLowerCase();
      const devName = sysInfo?.device_name || conn?.name || conn?.device || `SUTO ${transport.toUpperCase()} Sensor`;
      const transportLabel = transport.toUpperCase() === 'BLE'
        ? 'Bluetooth (BLE)'
        : transport.toUpperCase() === 'TCP'
        ? `Ethernet (${conn?.host || 'TCP'})`
        : transport.toUpperCase() === 'API'
        ? `S332 API (${conn?.host || 'LAN'})`
        : 'Direct USB';

      const connectionMeta = {
        ...(conn || {}),
        ...(sysInfo || {}),
        host: conn?.host || conn?.ip || sysInfo?.ip || sysInfo?.host || null,
        port: conn?.port || sysInfo?.port || (transportType === 'api' ? 8080 : (transportType === 'tcp' ? 502 : null)),
        transport: conn?.transport || transport
      };

      const newDevice = buildDeviceFromRawChannels(
        rawChs,
        devName,
        transportLabel,
        transportType,
        connectionMeta
      );

      // Append device to collected list (updating if already exists with same id/serial)
      setDevices(prev => {
        const existingMap = new Map(prev.map(d => [d.id, d]));
        existingMap.set(newDevice.id, newDevice);
        const updated = Array.from(existingMap.values());
        saveDevices(updated);
        return updated;
      });

      if (typeof onDeviceConnected === 'function') {
        onDeviceConnected(conn);
      }

      const chCount = newDevice.sensors.reduce((acc, s) => acc + (s.channels?.length || 0), 0);
      setSyncFeedback(`✓ Collected "${devName}" (${chCount} channels) via ${transportLabel}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error('[SensorManager] Hardware read error:', err);
      setSyncFeedback('⚠️ Error reading sensor: ' + (err?.message || err));
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setLoadingDevices(false);
    }
  };

  /**
   * Handle batch devices discovered from Ethernet / LAN auto-detection
   */
  const handleBatchDevicesConnected = (deviceItems) => {
    setShowConnectModal(false);
    if (!Array.isArray(deviceItems) || deviceItems.length === 0) return;

    setDevices(prev => {
      const existingMap = new Map(prev.map(d => [d.id, d]));
      deviceItems.forEach(dev => {
        existingMap.set(dev.id, dev);
      });
      const updated = Array.from(existingMap.values());
      saveDevices(updated);
      return updated;
    });

    const totalChannels = deviceItems.reduce((acc, d) => {
      return acc + (d.sensors || []).reduce((sAcc, s) => sAcc + (s.channels?.length || 0), 0);
    }, 0);

    setSyncFeedback(`✓ Collected ${deviceItems.length} network device(s) (${totalChannels} channels) via Ethernet Auto-Detect`);
    setTimeout(() => setSyncFeedback(null), 5000);

    if (typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification(
        'Sensors Collected',
        `Successfully added ${deviceItems.length} network device(s) with ${totalChannels} channels to Sensor Manager.`,
        'success'
      );
    }
  };

  const handleRequestRemoveDevice = (dev, e) => {
    if (e) e.stopPropagation();
    const assigned = getDeviceChannelAssignments(dev, locations);
    setPendingDeleteDevice({
      device: dev,
      assignedChannels: assigned
    });
  };

  const handleConfirmDeleteDevice = async () => {
    if (!pendingDeleteDevice) return;
    const { device, assignedChannels } = pendingDeleteDevice;

    // 1. Close hardware connection
    try {
      if (typeof TauriSutoAPI.disconnect === 'function') {
        await TauriSutoAPI.disconnect();
      }
    } catch (err) {
      console.warn('[SensorManager] Disconnect on device removal note:', err);
    }

    // 2. Remove device and unassign its channels across all locations and scapes
    const { updatedDevices, updatedLocations, unassignedCount } = removeDeviceAndUnassignChannels(device.id);

    // 3. Update state in modal
    setDevices(updatedDevices);
    setLocations(updatedLocations);
    setPendingDeleteDevice(null);

    // 4. Trigger Scape sync so active scape refreshes sensor cards
    if (onSyncToScape) {
      const allScapes = getAllScapes();
      if (allScapes[0]?.id) {
        onSyncToScape(allScapes[0].id);
      }
    }

    // 5. Toast / Notification feedback
    const msg = unassignedCount > 0
      ? `Disconnected "${device.name}" and removed ${unassignedCount} assigned channel(s).`
      : `Disconnected and removed "${device.name}".`;

    setSyncFeedback(`✓ ${msg}`);
    setTimeout(() => setSyncFeedback(null), 4000);

    if (typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification('Device Removed', msg, 'info');
    }
  };

  const handleUpdateLocations = useCallback((updated) => {
    setLocations(updated);
    saveLocations(updated);
  }, []);

  const handleAddLocation = () => {
    let targetScapeId = scapes.find(s => !s.isExample)?.id;
    if (!targetScapeId) {
      const newScape = createNewScape(`Location ${locations.length + 1} Stage`);
      targetScapeId = newScape.id;
      setScapes(getAllScapes());
    }
    const newLoc = {
      id: `loc_${Date.now()}`,
      name: `Location ${locations.length + 1}`,
      scapeId: targetScapeId,
      measurementPoints: []
    };
    handleUpdateLocations([...locations, newLoc]);
  };

  const handleDeleteLocation = (locId) => {
    handleUpdateLocations(locations.filter(l => l.id !== locId));
  };

  const handleLocationNameChange = (locId, name) => {
    handleUpdateLocations(locations.map(l => l.id === locId ? { ...l, name } : l));
  };

  const handleLocationScapeChange = (locId, scapeId) => {
    handleUpdateLocations(locations.map(l => l.id === locId ? { ...l, scapeId } : l));
  };

  const handleAddMeasurementPoint = (locId) => {
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      const count = (l.measurementPoints || []).length + 1;
      const newMp = {
        id: `mp_${Date.now()}_${count}`,
        name: `Measurement Point ${count}`,
        channels: []
      };
      return {
        ...l,
        measurementPoints: [...(l.measurementPoints || []), newMp]
      };
    }));
  };

  const handleDeleteMeasurementPoint = (locId, mpId) => {
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        measurementPoints: (l.measurementPoints || []).filter(m => m.id !== mpId)
      };
    }));
  };

  const handleMpNameChange = (locId, mpId, name) => {
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        measurementPoints: (l.measurementPoints || []).map(m => m.id === mpId ? { ...m, name } : m)
      };
    }));
  };

  const getDragPayload = (e) => {
    try {
      if (e?.dataTransfer) {
        const raw = e.dataTransfer.getData('text/plain') ||
          e.dataTransfer.getData('text') ||
          e.dataTransfer.getData('application/json');
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && window.__ps_active_drag) {
      return window.__ps_active_drag;
    }
    return null;
  };

  const handleStartDrag = (e, payload) => {
    if (typeof window !== 'undefined') window.__ps_active_drag = payload;
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copyMove';
      const jsonStr = JSON.stringify(payload);
      try {
        e.dataTransfer.setData('text/plain', jsonStr);
        e.dataTransfer.setData('text', jsonStr);
        e.dataTransfer.setData('application/json', jsonStr);
      } catch (_) {}
    }
  };

  const handleEndDrag = () => {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.__ps_active_drag = null;
      }, 200);
    }
  };

  const handleQuickAssignChannel = (ch, sensorName, devName) => {
    if (isChannelAssigned(ch)) return;

    const cleanCh = {
      id: ch.id || ch.channelId || `cid_${ch.channel_id}`,
      channel_id: ch.channel_id ?? ch.channelId,
      name: ch.name || ch.channelName || 'Channel',
      unit: ch.unit,
      device: ch.device || devName
    };

    const updatedLocs = [...locations];

    if (updatedLocs.length === 0) {
      let targetScapeId = scapes.find(s => !s.isExample)?.id;
      if (!targetScapeId) {
        const newScape = createNewScape('Plant Stage');
        targetScapeId = newScape.id;
        setScapes(getAllScapes());
      }
      const newLoc = {
        id: `loc_${Date.now()}`,
        name: 'Location 1',
        scapeId: targetScapeId,
        measurementPoints: [
          {
            id: `mp_${Date.now()}_1`,
            name: sensorName || cleanCh.name || 'Measurement Point',
            channels: [cleanCh]
          }
        ]
      };
      handleUpdateLocations([newLoc]);
      setSyncFeedback(`✓ Created Location 1 and assigned "${cleanCh.name}"`);
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }

    const targetLoc = updatedLocs[0];
    const mps = targetLoc.measurementPoints || [];

    if (mps.length === 0) {
      const newMp = {
        id: `mp_${Date.now()}_1`,
        name: sensorName || cleanCh.name || 'Measurement Point',
        channels: [cleanCh]
      };
      targetLoc.measurementPoints = [newMp];
    } else {
      const targetMp = mps[mps.length - 1];
      const exists = (targetMp.channels || []).some(c => c.id === cleanCh.id);
      if (!exists) {
        targetMp.channels = [...(targetMp.channels || []), cleanCh];
      }
    }

    handleUpdateLocations([...updatedLocs]);
    setSyncFeedback(`✓ Assigned "${cleanCh.name}" to ${targetLoc.name}`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleQuickAssignSensor = (sens, devName) => {
    const unassignedChs = (sens.channels || []).filter(c => !isChannelAssigned(c));
    if (unassignedChs.length === 0) return;

    const chs = unassignedChs.map(c => ({
      id: c.id || c.channelId || `cid_${c.channel_id}`,
      channel_id: c.channel_id ?? c.channelId,
      name: c.name || c.channelName,
      unit: c.unit,
      device: c.device || devName
    }));

    const updatedLocs = [...locations];

    if (updatedLocs.length === 0) {
      let targetScapeId = scapes.find(s => !s.isExample)?.id;
      if (!targetScapeId) {
        const newScape = createNewScape('Plant Stage');
        targetScapeId = newScape.id;
        setScapes(getAllScapes());
      }
      const newLoc = {
        id: `loc_${Date.now()}`,
        name: 'Location 1',
        scapeId: targetScapeId,
        measurementPoints: [
          {
            id: `mp_${Date.now()}_1`,
            name: sens.name || 'Sensor',
            channels: chs
          }
        ]
      };
      handleUpdateLocations([newLoc]);
      setSyncFeedback(`✓ Created Location 1 with "${sens.name}" (${chs.length} channels)`);
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }

    const targetLoc = updatedLocs[0];
    const mps = targetLoc.measurementPoints || [];
    const newMp = {
      id: `mp_${Date.now()}_${mps.length + 1}`,
      name: sens.name || 'Sensor',
      channels: chs
    };
    targetLoc.measurementPoints = [...mps, newMp];

    handleUpdateLocations([...updatedLocs]);
    setSyncFeedback(`✓ Created Measurement Point "${sens.name}" with ${chs.length} channels`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleDropOnLocation = (locId, e) => {
    e.preventDefault();
    setDragOverLocId(null);
    try {
      const payload = getDragPayload(e);
      if (!payload) return;

      if (payload.type === 'move_channel') {
        const cleanCh = {
          id: payload.id,
          channel_id: payload.channel_id,
          name: payload.name,
          unit: payload.unit,
          device: payload.device
        };
        const targetMpName = payload.sensorName || payload.name || 'Measurement Point';

        handleUpdateLocations(locations.map(l => {
          let mps = [...(l.measurementPoints || [])];
          if (l.id === payload.fromLocId) {
            mps = mps.map(m => {
              if (m.id !== payload.fromMpId) return m;
              return {
                ...m,
                channels: (m.channels || []).filter(c => c.id !== payload.id)
              };
            });
          }
          if (l.id === locId) {
            const newMp = {
              id: `mp_${Date.now()}_${mps.length + 1}`,
              name: targetMpName,
              channels: [cleanCh]
            };
            mps.push(newMp);
          }
          return { ...l, measurementPoints: mps };
        }));

        setSyncFeedback(`✓ Moved "${cleanCh.name}" to new Measurement Point`);
        setTimeout(() => setSyncFeedback(null), 2500);
        return;
      }

      if (payload.type === 'sensor' || (payload.channels && Array.isArray(payload.channels))) {
        // Entire sensor moved to location -> create Measurement Point named after sensor (e.g. 'S403')
        const sensName = payload.sensorName || payload.name || 'Sensor';
        const unassignedChs = (payload.channels || []).filter(c => !isChannelAssigned(c));
        if (unassignedChs.length === 0) {
          setSyncFeedback(`⚠️ All channels of "${sensName}" are already assigned`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }

        const chs = unassignedChs.map(c => ({
          id: c.id,
          channel_id: c.channel_id ?? c.id,
          name: c.name,
          unit: c.unit,
          device: c.device || payload.device
        }));

        handleUpdateLocations(locations.map(l => {
          if (l.id !== locId) return l;
          const existingMpIdx = (l.measurementPoints || []).findIndex(m => m.name === sensName);
          if (existingMpIdx >= 0) {
            const updatedMps = [...(l.measurementPoints || [])];
            const curr = updatedMps[existingMpIdx];
            const existingIds = new Set((curr.channels || []).map(c => c.id));
            const newChs = chs.filter(c => !existingIds.has(c.id));
            updatedMps[existingMpIdx] = {
              ...curr,
              channels: [...(curr.channels || []), ...newChs]
            };
            return { ...l, measurementPoints: updatedMps };
          } else {
            const newMp = {
              id: `mp_${Date.now()}_${(l.measurementPoints || []).length + 1}`,
              name: sensName,
              channels: chs
            };
            return {
              ...l,
              measurementPoints: [...(l.measurementPoints || []), newMp]
            };
          }
        }));

        setSyncFeedback(`✓ Created Measurement Point "${sensName}" with ${chs.length} channels`);
        setTimeout(() => setSyncFeedback(null), 3000);
      } else {
        // Single channel moved directly to location
        if (isChannelAssigned(payload)) {
          setSyncFeedback(`⚠️ Channel "${payload.name || payload.channelName}" is already assigned to a Measurement Point`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }

        const ch = payload;
        const sensName = ch.sensorName || ch.device || 'Measurement Point 1';
        const cleanCh = {
          id: ch.id || ch.channelId || `cid_${ch.channel_id}`,
          channel_id: ch.channel_id ?? ch.channelId,
          name: ch.name || ch.channelName,
          unit: ch.unit,
          device: ch.device
        };

        handleUpdateLocations(locations.map(l => {
          if (l.id !== locId) return l;
          const existingMpIdx = (l.measurementPoints || []).findIndex(m => m.name === sensName);
          if (existingMpIdx >= 0) {
            const updatedMps = [...(l.measurementPoints || [])];
            const curr = updatedMps[existingMpIdx];
            const exists = (curr.channels || []).some(c => c.id === cleanCh.id || (c.channel_id && c.channel_id === cleanCh.channel_id));
            if (!exists) {
              updatedMps[existingMpIdx] = {
                ...curr,
                channels: [...(curr.channels || []), cleanCh]
              };
            }
            return { ...l, measurementPoints: updatedMps };
          } else {
            const newMp = {
              id: `mp_${Date.now()}_${(l.measurementPoints || []).length + 1}`,
              name: sensName,
              channels: [cleanCh]
            };
            return {
              ...l,
              measurementPoints: [...(l.measurementPoints || []), newMp]
            };
          }
        }));

        setSyncFeedback(`✓ Created Measurement Point "${sensName}" with "${cleanCh.name}"`);
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err) {
      console.warn('[SensorManager] Drop on location error:', err);
    }
  };

  const handleDropChannel = (locId, mpId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverMpId(null);
    try {
      const payload = getDragPayload(e);
      if (!payload) return;

      if (payload.type === 'move_channel') {
        if (payload.fromLocId === locId && payload.fromMpId === mpId) return;

        handleUpdateLocations(locations.map(l => {
          let mps = [...(l.measurementPoints || [])];
          if (l.id === payload.fromLocId) {
            mps = mps.map(m => {
              if (m.id !== payload.fromMpId) return m;
              return {
                ...m,
                channels: (m.channels || []).filter(c => c.id !== payload.id)
              };
            });
          }
          if (l.id === locId) {
            mps = mps.map(m => {
              if (m.id !== mpId) return m;
              const exists = (m.channels || []).some(c => c.id === payload.id);
              if (exists) return m;
              return {
                ...m,
                channels: [...(m.channels || []), {
                  id: payload.id,
                  channel_id: payload.channel_id,
                  name: payload.name,
                  unit: payload.unit,
                  device: payload.device
                }]
              };
            });
          }
          return { ...l, measurementPoints: mps };
        }));

        setSyncFeedback(`✓ Moved "${payload.name}" to measurement point`);
        setTimeout(() => setSyncFeedback(null), 2500);
        return;
      }

      if (payload.type === 'sensor' || (payload.channels && Array.isArray(payload.channels))) {
        const unassignedChs = (payload.channels || []).filter(c => !isChannelAssigned(c));
        if (unassignedChs.length === 0) {
          setSyncFeedback(`⚠️ All channels of this sensor are already assigned`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }
        const cleanChs = unassignedChs.map(c => ({
          id: c.id || c.channelId || `cid_${c.channel_id}`,
          channel_id: c.channel_id ?? c.channelId,
          name: c.name || c.channelName,
          unit: c.unit,
          device: c.device || payload.device
        }));

        handleUpdateLocations(locations.map(l => {
          if (l.id !== locId) return l;
          return {
            ...l,
            measurementPoints: (l.measurementPoints || []).map(m => {
              if (m.id !== mpId) return m;
              const existingIds = new Set((m.channels || []).map(ch => ch.id));
              const existingCids = new Set((m.channels || []).map(ch => ch.channel_id).filter(Boolean));
              const toAdd = cleanChs.filter(ch => !existingIds.has(ch.id) && !existingCids.has(ch.channel_id));
              return {
                ...m,
                channels: [...(m.channels || []), ...toAdd]
              };
            })
          };
        }));
        setSyncFeedback(`✓ Added ${cleanChs.length} channel(s) to Measurement Point`);
        setTimeout(() => setSyncFeedback(null), 3000);
        return;
      } else {
        if (isChannelAssigned(payload)) {
          setSyncFeedback(`⚠️ Channel "${payload.name || payload.channelName}" is already assigned to a Measurement Point`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }
        assignChannelToMp(locId, mpId, payload);
      }
    } catch (err) {
      console.warn('[SensorManager] Drop error:', err);
    }
  };

  const assignChannelToMp = (locId, mpId, channel) => {
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        measurementPoints: (l.measurementPoints || []).map(m => {
          if (m.id !== mpId) return m;
          const targetId = channel.id || channel.channelId || `cid_${channel.channel_id}`;
          const exists = (m.channels || []).some(c =>
            (c.id && c.id === targetId) ||
            (c.channel_id !== undefined && channel.channel_id !== undefined && c.channel_id === channel.channel_id) ||
            (c.channelId && channel.channelId && c.channelId === channel.channelId)
          );
          if (exists) return m;
          return {
            ...m,
            channels: [...(m.channels || []), {
              id: targetId,
              channel_id: channel.channel_id ?? channel.channelId,
              name: channel.name || channel.channelName,
              unit: channel.unit,
              device: channel.device
            }]
          };
        })
      };
    }));
  };

  const handleRemoveChannelFromMp = (locId, mpId, chId) => {
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        measurementPoints: (l.measurementPoints || []).map(m => {
          if (m.id !== mpId) return m;
          return {
            ...m,
            channels: (m.channels || []).filter(c => c.id !== chId)
          };
        })
      };
    }));
  };

  const handleConfirmAndSyncAll = () => {
    saveLocations(locations);
    const res = syncAllLocationsToScapes(locations);
    if (res.syncCount > 0) {
      setSyncFeedback(`✓ Synced ${res.syncCount} measurement point(s) to ProcessScape`);
      if (onSyncToScape) {
        if (res.affectedScapeIds?.length > 0) {
          onSyncToScape(res.affectedScapeIds[0]);
        } else if (scapes[0]?.id) {
          onSyncToScape(scapes[0].id);
        }
      }
    } else {
      setSyncFeedback('✓ Settings saved');
      if (onSyncToScape && scapes[0]?.id) {
        onSyncToScape(scapes[0].id);
      }
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const toggleDeviceCollapse = (devId) => {
    setCollapsedDevices(prev => {
      const next = new Set(prev);
      if (next.has(devId)) next.delete(devId);
      else next.add(devId);
      return next;
    });
  };

  if (!isOpen) return null;

  // Filter tree channels by search query
  const filteredDevices = devices.map(dev => {
    const matchingSensors = (dev.sensors || []).map(sens => {
      const matchingChannels = (sens.channels || []).filter(ch => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return ch.name?.toLowerCase().includes(q) ||
          ch.unit?.toLowerCase().includes(q) ||
          dev.name?.toLowerCase().includes(q) ||
          sens.name?.toLowerCase().includes(q);
      });
      return { ...sens, channels: matchingChannels };
    }).filter(s => s.channels.length > 0);

    return { ...dev, sensors: matchingSensors };
  }).filter(d => d.sensors.length > 0);

  return (
    <>
      <div
        className="ps-sensor-mgr-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="ps-sensor-mgr-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="ps-sensor-mgr-header">
            <div className="ps-sm-title-group">
              <div className="ps-sm-title-row">
                <h2 className="ps-sm-title">Sensor & Measurement Point Manager</h2>
                <span className="ps-sm-transport-badge">
                  <span className="ps-sm-transport-dot" />
                  Live Communication Link
                </span>
                {syncFeedback && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#00ac86', marginLeft: 8 }}>
                    {syncFeedback}
                  </span>
                )}
              </div>
              <span className="ps-sm-subtitle">
                Detect sensors across communication ways (USB, Ethernet, BLE), create locations and measurement points, and bind channels to ProcessScapes.
              </span>
            </div>

            <div className="ps-sm-header-actions">
              <button
                type="button"
                className="ps-sm-btn primary ps-sm-detect-btn ps-sm-connect-btn"
                onClick={() => { setConnectInitialTab(null); setConnectInitialMode('manual'); setShowConnectModal(true); }}
                disabled={loadingDevices}
                title="Detect sensors across USB, Ethernet TCP, and Bluetooth BLE"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {loadingDevices ? 'Detecting...' : 'Detect'}
              </button>

              <button
                type="button"
                className="ps-sm-close-btn"
                onClick={onClose}
                aria-label="Close Sensor Manager"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Modal Body: Two Columns */}
          <div className="ps-sensor-mgr-body">
            {/* Left Column: Detected Devices & Sensors Tree */}
            <div className="ps-sm-col-left">
              <div className="ps-sm-col-header">
                <span className="ps-sm-col-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                    <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                    <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
                  </svg>
                  Detected Sensors & Channels ({devices.length})
                </span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  Drag channel to right
                </span>
              </div>

              <div className="ps-sm-search-box">
                <input
                  type="text"
                  className="ps-sm-search-input"
                  placeholder="Search sensor channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="ps-sm-tree-container">
                {filteredDevices.length === 0 ? (
                  <div className="ps-sm-empty-tree">
                    <div className="ps-sm-empty-icon">📡</div>
                    <div className="ps-sm-empty-title">No Sensors Collected Yet</div>
                    <div className="ps-sm-empty-desc">
                      Click <strong>"Detect"</strong> above to discover sensors via USB, Ethernet TCP, or Bluetooth BLE. You can detect one sensor at a time to collect all your plant sensors here.
                    </div>
                  </div>
                ) : (
                  filteredDevices.map(dev => {
                    const isCollapsed = collapsedDevices.has(dev.id);
                    return (
                      <div key={dev.id} className="ps-sm-device-node">
                        <div className="ps-sm-device-header" onClick={() => toggleDeviceCollapse(dev.id)}>
                          <span className="ps-sm-device-title">
                            <span>{isCollapsed ? '►' : '▼'}</span>
                            <span>📡 {dev.name}</span>
                          </span>
                          <div className="ps-sm-device-badges">
                            <span className={`ps-sm-device-pill ${dev.transportType || ''}`}>{dev.transport}</span>
                            <button
                              type="button"
                              className="ps-sm-device-del-btn"
                              onClick={(e) => handleRequestRemoveDevice(dev, e)}
                              title="Remove device"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div>
                            {(dev.sensors || []).map((sens, sIdx) => {
                              const allAssigned = (sens.channels || []).length > 0 &&
                                (sens.channels || []).every(c => isChannelAssigned(c));
                              const unassignedChannels = (sens.channels || []).filter(c => !isChannelAssigned(c));

                              return (
                                <div key={sens.id || `${dev.id}_s_${sIdx}`} className="ps-sm-sensor-group">
                                  <div
                                    className={`ps-sm-sensor-name ${allAssigned ? 'is-all-assigned' : ''}`}
                                    draggable={!allAssigned}
                                    onDragStart={(e) => {
                                      if (allAssigned) {
                                        e.preventDefault();
                                        return;
                                      }
                                      handleStartDrag(e, {
                                        type: 'sensor',
                                        sensorName: sens.name,
                                        device: dev.name,
                                        channels: unassignedChannels
                                      });
                                    }}
                                    onDragEnd={handleEndDrag}
                                    title={allAssigned ? 'All channels of this sensor are already assigned' : 'Drag unassigned channels to a Location on the right, or click "+ Assign All"'}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span className="ps-sm-ch-drag-handle">{allAssigned ? '🔒' : '⋮⋮'}</span>
                                      <span>🏷️</span>
                                      <span style={{ fontWeight: 700, color: allAssigned ? '#64748b' : '#0f172a' }}>{sens.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {allAssigned ? (
                                        <span className="ps-sm-channel-assigned-badge">✓ All Assigned</span>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            className="ps-sm-quick-assign-btn sensor-btn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuickAssignSensor(sens, dev.name);
                                            }}
                                            title="Quick-assign all unassigned channels to a measurement point"
                                          >
                                            + Assign All
                                          </button>
                                          <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
                                            {unassignedChannels.length} chs
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="ps-sm-channels-list">
                                    {(sens.channels || []).map((ch, chIdx) => {
                                      const assigned = isChannelAssigned(ch);

                                      return (
                                        <div
                                          key={ch.id || `${sens.id || sIdx}_ch_${chIdx}`}
                                          className={`ps-sm-channel-item ${assigned ? 'is-assigned' : ''}`}
                                          draggable={!assigned}
                                          onDragStart={(e) => {
                                            if (assigned) {
                                              e.preventDefault();
                                              return;
                                            }
                                            handleStartDrag(e, {
                                              type: 'channel',
                                              id: ch.id,
                                              channel_id: ch.channel_id,
                                              name: ch.name,
                                              unit: ch.unit,
                                              device: dev.name,
                                              sensorName: sens.name
                                            });
                                          }}
                                          onDragEnd={handleEndDrag}
                                          title={assigned ? 'Assigned to a Measurement Point (cannot be reused)' : 'Drag and drop onto a Measurement Point on the right, or click "+ Assign"'}
                                        >
                                          <div className="ps-sm-ch-info">
                                            <span className="ps-sm-ch-drag-handle">{assigned ? '🔒' : '⋮⋮'}</span>
                                            <span className="ps-sm-ch-name">{ch.name}</span>
                                            {ch.unit && <span className="ps-sm-ch-unit">{ch.unit}</span>}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {!assigned && (
                                              <button
                                                type="button"
                                                className="ps-sm-quick-assign-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleQuickAssignChannel(ch, sens.name, dev.name);
                                                }}
                                                title="Quick-assign this channel to a Measurement Point"
                                              >
                                                + Assign
                                              </button>
                                            )}
                                            {assigned && (
                                              <span className="ps-sm-channel-assigned-badge">✓ Assigned</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Locations & Measurement Points */}
            <div className="ps-sm-col-right">
              <div className="ps-sm-col-header">
                <span className="ps-sm-col-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Locations & Measurement Points ({locations.length})
                </span>

                <button
                  type="button"
                  className="ps-sm-btn primary"
                  onClick={handleAddLocation}
                  title="Create a new logical plant location"
                >
                  + Add Location
                </button>
              </div>

              <div className="ps-sm-locations-container">
                {locations.length === 0 ? (
                  <div className="ps-sm-empty-locations">
                    <div className="ps-sm-empty-icon">📍</div>
                    <div className="ps-sm-empty-title">No Locations Created Yet</div>
                    <div className="ps-sm-empty-desc">
                      Click <strong>"+ Add Location"</strong> above to create a physical or logical area, bind it to a ProcessScape, and drag sensor channels into measurement points.
                    </div>
                  </div>
                ) : (
                  locations.map(loc => {
                    const mps = loc.measurementPoints || [];
                    return (
                      <div
                        key={loc.id}
                        className={`ps-sm-location-card ${dragOverLocId === loc.id ? 'loc-drag-over' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                          setDragOverLocId(loc.id);
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget === e.target) {
                            setDragOverLocId(null);
                          }
                        }}
                        onDrop={(e) => {
                          if (!e.target.closest('.ps-sm-dropzone')) {
                            handleDropOnLocation(loc.id, e);
                          }
                        }}
                      >
                        {/* Location Card Header */}
                        <div className="ps-sm-loc-top">
                          <div className="ps-sm-loc-name-group">
                            <span className="ps-sm-loc-icon">📍</span>
                            <input
                              type="text"
                              className="ps-sm-loc-title-input"
                              value={loc.name}
                              onChange={(e) => handleLocationNameChange(loc.id, e.target.value)}
                              placeholder="Location Name..."
                            />
                          </div>

                          <div className="ps-sm-loc-match-row">
                            <label className="ps-sm-scape-label">Scape:</label>
                            <select
                              className="ps-sm-scape-select"
                              value={loc.scapeId || ''}
                              onChange={(e) => handleLocationScapeChange(loc.id, e.target.value)}
                            >
                              <option value="">-- Select ProcessScape --</option>
                              {scapes.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.title}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="ps-sm-close-btn"
                              onClick={() => handleDeleteLocation(loc.id)}
                              title="Delete Location"
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {/* Measurement Points inside this location */}
                        <div className="ps-sm-mp-list">
                          {mps.length === 0 ? (
                            <div
                              className={`ps-sm-loc-empty-dropzone ${dragOverLocId === loc.id ? 'drag-over' : ''}`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                                setDragOverLocId(loc.id);
                              }}
                              onDragLeave={() => setDragOverLocId(null)}
                              onDrop={(e) => handleDropOnLocation(loc.id, e)}
                            >
                              <span style={{ fontSize: 16 }}>🎯</span>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#334155' }}>
                                Drag sensor or channel here
                              </span>
                              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                                (Auto-creates Measurement Point named after sensor)
                              </span>
                            </div>
                          ) : (
                            mps.map(mp => (
                              <div key={mp.id} className="ps-sm-mp-card">
                                <div className="ps-sm-mp-top">
                                  <div className="ps-sm-mp-name-group">
                                    <span style={{ fontSize: 12 }}>🎯</span>
                                    <input
                                      type="text"
                                      className="ps-sm-mp-name-input"
                                      value={mp.name}
                                      onChange={(e) => handleMpNameChange(loc.id, mp.id, e.target.value)}
                                      placeholder="Measurement Point Name..."
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    className="ps-sm-close-btn"
                                    onClick={() => handleDeleteMeasurementPoint(loc.id, mp.id)}
                                    title="Delete Measurement Point"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* HTML5 Dropzone for Channels */}
                                <div
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                                    setDragOverMpId(mp.id);
                                  }}
                                  onDragLeave={() => setDragOverMpId(null)}
                                  onDrop={(e) => handleDropChannel(loc.id, mp.id, e)}
                                  className={`ps-sm-dropzone ${dragOverMpId === mp.id ? 'drag-over' : ''}`}
                                >
                                  {(mp.channels || []).length === 0 ? (
                                    <span className="ps-sm-dropzone-empty">
                                      Drag channels from left tree or other points here
                                    </span>
                                  ) : (
                                    (mp.channels || []).map((ch, idx) => (
                                      <span
                                        key={ch.id || ch.channelId || `ch_${idx}`}
                                        className="ps-sm-assigned-tag draggable-tag"
                                        draggable={true}
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          handleStartDrag(e, {
                                            type: 'move_channel',
                                            id: ch.id,
                                            channel_id: ch.channel_id,
                                            name: ch.name,
                                            unit: ch.unit,
                                            device: ch.device,
                                            sensorName: mp.name,
                                            fromLocId: loc.id,
                                            fromMpId: mp.id
                                          });
                                        }}
                                        onDragEnd={handleEndDrag}
                                        title="Drag to move this channel to another Measurement Point"
                                      >
                                        <span className="ps-sm-tag-drag-handle">⋮⋮</span>
                                        <span className="ps-sm-tag-name">{ch.name}</span>
                                        {ch.unit && <span className="ps-sm-ch-unit">{ch.unit}</span>}
                                        <button
                                          type="button"
                                          className="ps-sm-tag-del"
                                          onClick={() => handleRemoveChannelFromMp(loc.id, mp.id, ch.id)}
                                          title="Remove channel"
                                        >
                                          ✕
                                        </button>
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))
                          )}

                          <button
                            type="button"
                            className="ps-sm-btn ps-sm-add-mp-btn"
                            onClick={() => handleAddMeasurementPoint(loc.id)}
                          >
                            + Add Measurement Point
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer Bar */}
          <div className="ps-sensor-mgr-footer">
            <div className="ps-sm-footer-info">
              <span className="ps-sm-footer-stat">
                <strong>{locations.length}</strong> Location{locations.length === 1 ? '' : 's'}
              </span>
              <span className="ps-sm-footer-dot">•</span>
              <span className="ps-sm-footer-stat">
                <strong>{totalMps}</strong> Measurement Point{totalMps === 1 ? '' : 's'}
              </span>
              <span className="ps-sm-footer-dot">•</span>
              <span className="ps-sm-footer-stat">
                <strong>{totalAssignedChannelsCount}</strong> Channel{totalAssignedChannelsCount === 1 ? '' : 's'} Assigned
              </span>
            </div>

            <div className="ps-sm-footer-actions">
              <button
                type="button"
                className="ps-sm-btn ps-sm-footer-cancel-btn"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ps-sm-btn primary ps-sm-footer-confirm-btn"
                onClick={handleConfirmAndSyncAll}
                title="Save all changes and synchronize all measurement points to matched ProcessScapes"
              >
                ✓ Confirm & Sync All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SUTO Multi-Transport Connect Hardware Dialog (sibling to prevent event bubbling) */}
      <DeviceConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnected={handleHardwareConnected}
        onAddMultipleDevices={handleBatchDevicesConnected}
        initialTab={connectInitialTab}
        initialMode={connectInitialMode}
      />

      {/* Device Delete Confirmation & Active Channel Warning Dialog */}
      {pendingDeleteDevice && (
        <div
          className="ps-sm-confirm-backdrop"
          onClick={() => setPendingDeleteDevice(null)}
        >
          <div
            className="ps-sm-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ps-sm-confirm-header">
              <div className="ps-sm-confirm-icon-danger">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="ps-sm-confirm-title">Remove Sensor Device</h3>
                <div className="ps-sm-confirm-device-meta">
                  <span>📡 {pendingDeleteDevice.device?.name}</span>
                  <span className={`ps-sm-device-pill ${pendingDeleteDevice.device?.transportType || ''}`}>
                    {pendingDeleteDevice.device?.transport}
                  </span>
                </div>
              </div>
            </div>

            <div className="ps-sm-confirm-body">
              {pendingDeleteDevice.assignedChannels?.length > 0 ? (
                <>
                  <div className="ps-sm-confirm-warning-banner">
                    <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠️</span>
                      <span>Active Channels in Use ({pendingDeleteDevice.assignedChannels.length})</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.5 }}>
                      This device currently has channels assigned to Measurement Points in your ProcessScape.
                      If you delete this device, its connection will be closed, the device will be removed, and the following channels will be <strong>unassigned and removed from ProcessScape</strong>:
                    </div>
                  </div>

                  <div className="ps-sm-confirm-assigned-list">
                    {pendingDeleteDevice.assignedChannels.map((item, idx) => (
                      <div key={idx} className="ps-sm-confirm-assigned-item">
                        <div className="ps-sm-confirm-ch-title">
                          <span className="ps-sm-assigned-ch-dot" />
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.channelName}</span>
                          {item.channelUnit && (
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>({item.channelUnit})</span>
                          )}
                        </div>
                        <div className="ps-sm-confirm-ch-target">
                          <span>📍 {item.locationName}</span>
                          <span style={{ color: '#cbd5e1' }}>›</span>
                          <span style={{ fontWeight: 600, color: '#00ac86' }}>{item.mpName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="ps-sm-confirm-clean-notice">
                  <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    Are you sure you want to remove <strong>{pendingDeleteDevice.device?.name}</strong>?
                  </p>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                    Its live hardware communication link will be closed and it will be removed from your detected sensors list.
                  </p>
                </div>
              )}
            </div>

            <div className="ps-sm-confirm-actions">
              <button
                type="button"
                className="ps-sm-btn secondary"
                onClick={() => setPendingDeleteDevice(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ps-sm-btn danger"
                onClick={handleConfirmDeleteDevice}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {pendingDeleteDevice.assignedChannels?.length > 0
                  ? 'Unassign & Delete Device'
                  : 'Delete Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
