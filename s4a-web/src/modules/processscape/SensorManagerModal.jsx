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
  removeDeviceAndUnassignChannels,
  upsertDeviceList,
  isSameDevice
} from './engine/sensorManagerStorage';
import { getAllScapes, createNewScape, getActiveScapeId, setActiveScapeId } from './engine/scapeStorage';

export default function SensorManagerModal({
  isOpen,
  onClose,
  onSyncToScape,
  activeDeviceInfo,
  onDeviceConnected,
  activeLocationId: initialLocationId = null
}) {
  const [locations, setLocations] = useState(() => getLocations());
  const [scapes, setScapes] = useState(() => getAllScapes());
  const [devices, setDevices] = useState(() => getSavedDevices());
  const [activeTargetLocId, setActiveTargetLocId] = useState(() => initialLocationId || getLocations()[0]?.id || null);
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

  // Set of channel keys assigned anywhere across all locations (guarantees channel exclusivity per device & channel)
  const assignedChannelIdSet = useMemo(() => {
    const set = new Set();
    locations.forEach(loc => {
      (loc.measurementPoints || []).forEach(mp => {
        (mp.channels || []).forEach(ch => {
          if (!ch) return;
          // 1. Add full unique channel ID, ignoring non-scoped generic IDs (e.g. '1' or 'cid_1')
          const isGenericId = !ch.id || /^(?:cid_)?\d+$/i.test(String(ch.id)) || /^ch_\d+$/i.test(String(ch.id));
          if (ch.id && !isGenericId) {
            set.add(String(ch.id));
          }

          const sn = ch.deviceSerial || (ch.deviceId && ch.deviceId.includes('_sn_') ? ch.deviceId.split('_sn_')[1] : null);
          const dId = ch.deviceId;
          const cid = ch.channel_id ?? ch.channelId;
          const chName = (ch.name || ch.channelName || '').toLowerCase();
          const sensKey = (ch.sensorName || ch.sensorId || ch.sensor_description || ch.sensorDescription || '').trim().toLowerCase();
          const reg = ch.mBValueAddr;

          // 2. Modbus register address compound key (physical register on device)
          if (reg !== undefined && reg !== null) {
            if (sn) set.add(`sn_${sn}_reg_${reg}`);
            if (dId) set.add(`dev_${dId}_reg_${reg}`);
          }

          // 3. Sensor-card-scoped compound keys (guarantees sensor card isolation within device!)
          if (sensKey) {
            if (sn) {
              if (cid !== undefined && cid !== null) set.add(`sn_${sn}_sens_${sensKey}_ch_${cid}`);
              if (chName) set.add(`sn_${sn}_sens_${sensKey}_name_${chName}`);
            }
            if (dId) {
              if (cid !== undefined && cid !== null) set.add(`dev_${dId}_sens_${sensKey}_ch_${cid}`);
              if (chName) set.add(`dev_${dId}_sens_${sensKey}_name_${chName}`);
            }
          } else {
            // Only if sensor card is truly unspecified (legacy single-sensor device)
            if (sn) {
              if (cid !== undefined && cid !== null) set.add(`sn_${sn}_ch_${cid}`);
              if (chName) set.add(`sn_${sn}_name_${chName}`);
            }
            if (dId) {
              if (cid !== undefined && cid !== null) set.add(`dev_${dId}_ch_${cid}`);
              if (chName) set.add(`dev_${dId}_name_${chName}`);
            }
          }

          // 4. Device Name fallback (only if neither serial nor deviceId is known)
          const dev = ch.device;
          if (!sn && !dId && dev) {
            if (sensKey) {
              if (cid !== undefined && cid !== null) set.add(`name_${dev}_sens_${sensKey}_ch_${cid}`);
              if (chName) set.add(`name_${dev}_sens_${sensKey}_name_${chName}`);
            } else {
              if (cid !== undefined && cid !== null) set.add(`name_${dev}_ch_${cid}`);
              if (chName) set.add(`name_${dev}_name_${chName}`);
            }
          }
        });
      });
    });
    return set;
  }, [locations]);

  const isChannelAssigned = useCallback((ch, devName = '', devId = '', devSerial = '', sensName = '', sensId = '') => {
    if (!ch) return false;
    // 1. Exact full channel ID match (highest priority, definitive unique ID)
    const isGenericId = !ch.id || /^(?:cid_)?\d+$/i.test(String(ch.id)) || /^ch_\d+$/i.test(String(ch.id));
    if (ch.id && !isGenericId && assignedChannelIdSet.has(String(ch.id))) return true;

    const cid = ch.channel_id ?? ch.channelId;
    const chName = (ch.name || ch.channelName || '').toLowerCase();
    const sn = ch.deviceSerial || devSerial || (ch.deviceId && ch.deviceId.includes('_sn_') ? ch.deviceId.split('_sn_')[1] : null);
    const dId = ch.deviceId || devId;
    const dName = ch.device || devName;
    const sensKey = (sensName || sensId || ch.sensorName || ch.sensorId || ch.sensor_description || ch.sensorDescription || '').trim().toLowerCase();
    const reg = ch.mBValueAddr;

    // 2. Modbus register address match
    if (reg !== undefined && reg !== null) {
      if (sn && assignedChannelIdSet.has(`sn_${sn}_reg_${reg}`)) return true;
      if (dId && assignedChannelIdSet.has(`dev_${dId}_reg_${reg}`)) return true;
    }

    // 3. Sensor-card-scoped match (guarantees separate sensor cards NEVER cross-match!)
    if (sensKey) {
      if (sn) {
        if (cid !== undefined && cid !== null && assignedChannelIdSet.has(`sn_${sn}_sens_${sensKey}_ch_${cid}`)) return true;
        if (chName && assignedChannelIdSet.has(`sn_${sn}_sens_${sensKey}_name_${chName}`)) return true;
      }
      if (dId) {
        if (cid !== undefined && cid !== null && assignedChannelIdSet.has(`dev_${dId}_sens_${sensKey}_ch_${cid}`)) return true;
        if (chName && assignedChannelIdSet.has(`dev_${dId}_sens_${sensKey}_name_${chName}`)) return true;
      }
      if (!sn && !dId && dName) {
        if (cid !== undefined && cid !== null && assignedChannelIdSet.has(`name_${dName}_sens_${sensKey}_ch_${cid}`)) return true;
        if (chName && assignedChannelIdSet.has(`name_${dName}_sens_${sensKey}_name_${chName}`)) return true;
      }
      // Sensor card is known: NEVER fall through to unscoped channel indices of other sensor cards!
      return false;
    }

    // 4. Fallback for legacy single-sensor devices where sensKey is not specified:
    if (sn) {
      if (cid !== undefined && cid !== null && assignedChannelIdSet.has(`sn_${sn}_ch_${cid}`)) return true;
      if (chName && assignedChannelIdSet.has(`sn_${sn}_name_${chName}`)) return true;
    }
    if (dId) {
      if (cid !== undefined && cid !== null && assignedChannelIdSet.has(`dev_${dId}_ch_${cid}`)) return true;
      if (chName && assignedChannelIdSet.has(`dev_${dId}_name_${chName}`)) return true;
    }
    if (!sn && !dId && dName) {
      if (cid !== undefined && cid !== null && assignedChannelIdSet.has(`name_${dName}_ch_${cid}`)) return true;
      if (chName && assignedChannelIdSet.has(`name_${dName}_name_${chName}`)) return true;
    }

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

  // Filter tree channels by search query (MUST be declared before any conditional return!)
  const filteredDevices = useMemo(() => {
    if (!searchQuery) return devices;
    const q = searchQuery.toLowerCase();
    return devices.map(dev => {
      const devMatches = dev.name?.toLowerCase().includes(q);
      const matchingSensors = (dev.sensors || []).map(sens => {
        const sensMatches = sens.name?.toLowerCase().includes(q);
        const matchingChannels = (sens.channels || []).filter(ch => {
          return ch.name?.toLowerCase().includes(q) ||
            ch.unit?.toLowerCase().includes(q) ||
            devMatches || sensMatches;
        });
        return { ...sens, channels: matchingChannels };
      }).filter(s => s.channels.length > 0 || devMatches);

      return { ...dev, sensors: matchingSensors };
    }).filter(d => d.sensors.length > 0 || d.name?.toLowerCase().includes(q));
  }, [devices, searchQuery]);

  // Load saved state on open
  useEffect(() => {
    if (isOpen) {
      const locs = getLocations();
      setScapes(getAllScapes());
      setLocations(locs);
      setDevices(getSavedDevices());
      if (initialLocationId && locs.some(l => l.id === initialLocationId)) {
        setActiveTargetLocId(initialLocationId);
      } else if (locs.length > 0 && (!activeTargetLocId || !locs.some(l => l.id === activeTargetLocId))) {
        setActiveTargetLocId(locs[0].id);
      }
    }
  }, [isOpen, initialLocationId]);

  /**
   * Handle real hardware connected from reused DeviceConnectModal
   * One time one sensor, appending to collect as many sensors as needed.
   */
  const handleHardwareConnected = async (conn) => {
    setShowConnectModal(false);
    setLoadingDevices(true);
    setSyncFeedback('Reading sensor channels from hardware...');

    try {
      if (conn?.deviceItem) {
        const incomingDev = conn.deviceItem;
        const currentDevs = getSavedDevices();
        const alreadyExists = currentDevs.some(d => isSameDevice(d, incomingDev)) || devices.some(d => isSameDevice(d, incomingDev));
        if (alreadyExists) {
          setSyncFeedback(`⚠️ "${incomingDev.name}" is already in Sensor Manager`);
          setLoadingDevices(false);
          setTimeout(() => setSyncFeedback(null), 3500);
          return;
        }
        setDevices(prev => {
          const updated = upsertDeviceList(prev, [incomingDev]);
          saveDevices(updated);
          return updated;
        });
        if (typeof onDeviceConnected === 'function') {
          onDeviceConnected(conn);
        }
        const chCount = (incomingDev.sensors || []).reduce((acc, s) => acc + (s.channels?.length || 0), 0);
        setSyncFeedback(`✓ Collected "${incomingDev.name}" (${chCount} channels) via ${incomingDev.transport}`);
        setTimeout(() => setSyncFeedback(null), 4000);
        return;
      }
      let rawChs = [];
      let sysInfo = null;

      const transport = conn?.transport || TauriSutoAPI?.getActiveTransport?.() || 'USB';
      const transportType = (typeof transport === 'string' ? transport : 'USB').toLowerCase();
      const isBle = transportType.includes('ble') || (conn?.activeTab || '').toLowerCase().includes('ble');

      if (isBle) {
        // Read ONLY BLE channels! Never mix with Modbus or previous connections
        try {
          if (typeof BleSutoAPI?.getChannels === 'function') {
            rawChs = await BleSutoAPI.getChannels();
          }
        } catch (_) {}
        if (!rawChs || rawChs.length === 0) {
          try {
            if (typeof TauriSutoAPI.getChannels === 'function') {
              rawChs = await TauriSutoAPI.getChannels();
            }
          } catch (_) {}
        }
        // Strict guard: filter out any leaked Modbus channels from previous sessions
        rawChs = (Array.isArray(rawChs) ? rawChs : []).filter(c => {
          const devDesc = (c.device_description || c.device || '').toLowerCase();
          const name = (c.name || c.channel_name || '').toLowerCase();
          return !devDesc.includes('modbus') && !name.startsWith('modbus');
        });
        // SysInfo strictly from BLE
        try {
          if (typeof BleSutoAPI?.getSystemInfo === 'function') {
            sysInfo = await BleSutoAPI.getSystemInfo();
          }
        } catch (_) {}
      } else {
        try {
          if (typeof TauriSutoAPI.getChannels === 'function') {
            rawChs = await TauriSutoAPI.getChannels({ transport });
          }
        } catch (err) {
          console.warn('[SensorManager] getChannels note:', err);
        }

        if (!rawChs || rawChs.length === 0) {
          // Give connection a brief moment to stabilize and retry once
          await new Promise(r => setTimeout(r, 400));
          try {
            if (typeof TauriSutoAPI.getChannels === 'function') {
              rawChs = await TauriSutoAPI.getChannels({ transport });
            }
          } catch (_) {}
        }

        // Strict guard: Non-Modbus hardware (USB, TCP, API) must NEVER leak Modbus channels!
        if (!transportType.includes('modbus')) {
          rawChs = (Array.isArray(rawChs) ? rawChs : []).filter(c => {
            const devDesc = (c.device_description || c.device || c.device_desc || '').toLowerCase();
            const name = (c.name || c.channel_name || '').toLowerCase();
            const sDesc = (c.sensor_description || c.sensor_desc || '').toLowerCase();
            return !devDesc.includes('modbus') && !name.startsWith('modbus') && !sDesc.includes('modbus');
          });
        }
      }

      if (!sysInfo) {
        try {
          if (typeof TauriSutoAPI.getSystemInfo === 'function') {
            sysInfo = await TauriSutoAPI.getSystemInfo({ transport });
          }
        } catch (err) {
          console.warn('[SensorManager] getSystemInfo note:', err);
        }
      }

      const devName = (isBle ? (conn?.name || conn?.device || sysInfo?.device_name) : (sysInfo?.device_name || conn?.name || conn?.device)) || `SUTO ${transport.toUpperCase()} Sensor`;
      const devSerial = isBle ? (conn?.serial || conn?.serial_number || sysInfo?.serial_number) : (sysInfo?.serial_number || conn?.serial || conn?.serial_number);
      const host = conn?.host || conn?.ip || sysInfo?.ip || sysInfo?.host || null;
      const port = conn?.port || sysInfo?.port || (transportType === 'api' ? 8080 : (transportType === 'tcp' ? 502 : null));

      const transportLabel = transport.toUpperCase() === 'BLE'
        ? 'Bluetooth (BLE)'
        : transport.toUpperCase() === 'TCP'
        ? (host ? `Ethernet (${host}${port ? `:${port}` : ''})` : 'Ethernet (TCP)')
        : transport.toUpperCase() === 'API'
        ? (host ? `S332 API (${host}${port ? `:${port}` : ''})` : 'S332 API')
        : 'Direct USB';

      const connectionMeta = {
        ...(conn || {}),
        ...(sysInfo || {}),
        serial: devSerial,
        serial_number: devSerial,
        name: devName,
        device_name: devName,
        host,
        port,
        transport: conn?.transport || transport
      };

      const newDevice = buildDeviceFromRawChannels(
        rawChs,
        devName,
        transportLabel,
        transportType,
        connectionMeta
      );

      // Guard: do not add again if this device is already in Sensor Manager's left side
      const currentDevs = getSavedDevices();
      const alreadyExists = currentDevs.some(d => isSameDevice(d, newDevice)) || devices.some(d => isSameDevice(d, newDevice));
      if (alreadyExists) {
        setSyncFeedback(`⚠️ "${devName}" is already in Sensor Manager`);
        setLoadingDevices(false);
        setTimeout(() => setSyncFeedback(null), 3500);
        return;
      }

      // Append new device in collected list
      setDevices(prev => {
        const updated = upsertDeviceList(prev, [newDevice]);
        saveDevices(updated);
        return updated;
      });

      if (typeof onDeviceConnected === 'function') {
        onDeviceConnected(conn);
      }

      const chCount = (newDevice.sensors || []).reduce((acc, s) => acc + (s.channels?.length || 0), 0);
      if (chCount > 0) {
        setSyncFeedback(`✓ Collected "${devName}" (${chCount} channels) via ${transportLabel}`);
      } else {
        setSyncFeedback(`✓ Connected "${devName}" via ${transportLabel}`);
      }
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

    const currentDevs = getSavedDevices();
    const newItems = deviceItems.filter(incoming =>
      !currentDevs.some(existing => isSameDevice(existing, incoming)) &&
      !devices.some(existing => isSameDevice(existing, incoming))
    );

    if (newItems.length === 0) {
      setSyncFeedback('⚠️ Selected device(s) are already in Sensor Manager');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    setDevices(prev => {
      const updated = upsertDeviceList(prev, newItems);
      saveDevices(updated);
      return updated;
    });

    const totalChannels = newItems.reduce((acc, d) => {
      return acc + (d.sensors || []).reduce((sAcc, s) => sAcc + (s.channels?.length || 0), 0);
    }, 0);

    const skippedCount = deviceItems.length - newItems.length;
    const skipMsg = skippedCount > 0 ? ` (${skippedCount} already in manager)` : '';

    setSyncFeedback(`✓ Collected ${newItems.length} network device(s) (${totalChannels} channels) via Ethernet Auto-Detect${skipMsg}`);
    setTimeout(() => setSyncFeedback(null), 5000);

    if (typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification(
        'Sensors Collected',
        `Successfully added ${deviceItems.length} network device(s) with ${totalChannels} channels to Sensor Manager.`,
        'success'
      );
    }
  };

  /**
   * Reconnect to a saved device
   */
  const handleReconnectDevice = async (dev, e) => {
    if (loadingDevices) return;
    if (e) e.stopPropagation();
    setLoadingDevices(true);
    setSyncFeedback(`Connecting to "${dev.name}"...`);
    try {
      const config = dev.connectionConfig || {};
      const transport = (config.transport || dev.transportType || dev.transport || '').toLowerCase();
      let conn = null;

      if (transport.includes('modbus')) {
        const host = config.host || dev.host || dev.ip || (typeof dev.transport === 'string' && dev.transport.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]) || '127.0.0.1';
        const port = config.port || dev.port || (typeof dev.transport === 'string' && dev.transport.match(/:(\d+)/)?.[1]) || 502;
        const slaveId = config.slaveId || dev.slaveId || 1;
        const allDevChannels = [];
        (dev.sensors || []).forEach(s => {
          if (Array.isArray(s.channels)) allDevChannels.push(...s.channels);
        });
        conn = await TauriSutoAPI.connectModbusTcp({
          host,
          port: parseInt(port, 10),
          slaveId: parseInt(slaveId, 10),
          name: dev.name,
          serial: dev.serial || config.serial,
          isRtu: Boolean(config.isRtu || transport.includes('rtu')),
          serialPort: config.serialPort || null,
          baudRate: config.baudRate || null,
          parity: config.parity || null,
          channels: allDevChannels
        });
        setDevices(prev => {
          const updated = prev.map(d => d.id === dev.id ? { ...d, isOnline: true } : d);
          saveDevices(updated);
          return updated;
        });
        if (typeof onDeviceConnected === 'function' && conn) {
          onDeviceConnected(conn);
        }
        setSyncFeedback(`✓ Connected to "${dev.name}"`);
        setTimeout(() => setSyncFeedback(null), 4000);
        setLoadingDevices(false);
        return;
      } else if (transport.includes('ble')) {
        conn = await TauriSutoAPI.resumeBleConnection({
          deviceId: config.deviceId || dev.id,
          name: config.name || dev.name
        }).catch(async (resumeErr) => {
          // If resume fails (e.g. requires browser picker permission renewal), prompt user
          return await TauriSutoAPI.connectBle({ acceptAll: false });
        });

        // Query strictly BLE channels to refresh this specific device; never leak Modbus channels
        let rawChs = [];
        try {
          if (typeof BleSutoAPI?.getChannels === 'function') {
            rawChs = await BleSutoAPI.getChannels();
          }
        } catch (_) {}
        rawChs = (Array.isArray(rawChs) ? rawChs : []).filter(c => {
          const devDesc = (c.device_description || c.device || '').toLowerCase();
          const name = (c.name || c.channel_name || '').toLowerCase();
          return !devDesc.includes('modbus') && !name.startsWith('modbus');
        });

        if (rawChs.length > 0) {
          const connectionMeta = {
            serial_number: conn?.serial_number || conn?.serial || dev.serial,
            device_name: conn?.name || conn?.device || dev.name,
            device_id: conn?.device_id || conn?.deviceId || dev.id,
            deviceId: conn?.deviceId || config.deviceId || dev.id,
            transport: 'BLE'
          };
          const refreshed = buildDeviceFromRawChannels(
            rawChs,
            dev.name,
            dev.transport,
            dev.transportType,
            connectionMeta
          );
          setDevices(prev => {
            const updated = upsertDeviceList(prev, [refreshed]);
            saveDevices(updated);
            return updated;
          });
        } else {
          setDevices(prev => {
            const updated = prev.map(d => d.id === dev.id ? { ...d, isOnline: true } : d);
            saveDevices(updated);
            return updated;
          });
        }

        if (typeof onDeviceConnected === 'function' && conn) {
          onDeviceConnected(conn);
        }
        setSyncFeedback(`✓ Connected to "${dev.name}"`);
        setTimeout(() => setSyncFeedback(null), 4000);
        setLoadingDevices(false);
        return;
      } else if (transport.includes('api')) {
        const host = config.host || dev.host || dev.ip || (typeof dev.transport === 'string' && dev.transport.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]);
        const port = config.port || dev.port || (typeof dev.transport === 'string' && dev.transport.match(/:(\d+)/)?.[1]) || 8080;
        conn = await TauriSutoAPI.connectApi(host, parseInt(port, 10));
      } else if (transport.includes('tcp') || transport.includes('ethernet') || transport.includes('lan')) {
        const host = config.host || dev.host || dev.ip || (typeof dev.transport === 'string' && dev.transport.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]) || (typeof dev.name === 'string' && dev.name.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1]);
        const port = config.port || dev.port || (typeof dev.transport === 'string' && dev.transport.match(/:(\d+)/)?.[1]) || 502;
        conn = await TauriSutoAPI.connectTcp(host, parseInt(port, 10));
      } else if (transport.includes('usb')) {
        conn = await TauriSutoAPI.connectUsb();
      }

      // Re-read channels if available
      if (typeof TauriSutoAPI.getChannels === 'function') {
        const targetTransport = dev.transportType || dev.transport || transport;
        let rawChs = await TauriSutoAPI.getChannels({ transport: targetTransport });
        if (!String(targetTransport).toLowerCase().includes('modbus')) {
          rawChs = (Array.isArray(rawChs) ? rawChs : []).filter(c => {
            const devDesc = (c.device_description || c.device || c.device_desc || '').toLowerCase();
            const name = (c.name || c.channel_name || '').toLowerCase();
            const sDesc = (c.sensor_description || c.sensor_desc || '').toLowerCase();
            return !devDesc.includes('modbus') && !name.startsWith('modbus') && !sDesc.includes('modbus');
          });
        }
        const sysInfo = await TauriSutoAPI.getSystemInfo?.({ transport: targetTransport }).catch(() => null);
        const connectionMeta = {
          serial_number: sysInfo?.serial_number || conn?.serial_number || conn?.serial || dev.serial,
          device_name: sysInfo?.device_name || conn?.name || conn?.device || dev.name,
          device_id: sysInfo?.device_id || conn?.device_id || conn?.deviceId,
          deviceId: conn?.deviceId || config.deviceId,
          host: conn?.host || config.host,
          port: conn?.port || config.port,
          path: conn?.path || config.path,
          transport: conn?.transport || transport
        };
        const refreshed = buildDeviceFromRawChannels(
          rawChs,
          dev.name,
          dev.transport,
          dev.transportType,
          connectionMeta
        );
        setDevices(prev => {
          const updated = upsertDeviceList(prev, [refreshed]);
          saveDevices(updated);
          return updated;
        });
      } else {
        setDevices(prev => {
          const updated = prev.map(d => d.id === dev.id ? { ...d, isOnline: true } : d);
          saveDevices(updated);
          return updated;
        });
      }

      if (typeof onDeviceConnected === 'function' && conn) {
        onDeviceConnected(conn);
      }

      setSyncFeedback(`✓ Connected to "${dev.name}"`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.warn('[SensorManager] Reconnect error:', err);
      setSyncFeedback('⚠️ Could not connect: ' + (err?.message || err));
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRequestRemoveDevice = (dev, e) => {
    if (loadingDevices) return;
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

    // 1. Close hardware connection for this specific device
    try {
      if (typeof TauriSutoAPI.disconnectDevice === 'function') {
        await TauriSutoAPI.disconnectDevice(device);
      } else if (typeof TauriSutoAPI.disconnect === 'function') {
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

    // 5. Feedback
    const msg = unassignedCount > 0
      ? `Disconnected "${device.name}" and removed ${unassignedCount} assigned channel(s).`
      : `Disconnected and removed "${device.name}".`;

    setSyncFeedback(`✓ ${msg}`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleUpdateLocations = useCallback((updated) => {
    setLocations(updated);
    saveLocations(updated);
    if (!updated || updated.length === 0) {
      setActiveScapeId('');
    }
  }, []);

  const createUniqueDefaultScape = useCallback((existingScapes = []) => {
    const existingTitles = new Set(
      (existingScapes || [])
        .filter(s => !s.isExample && s.title)
        .map(s => s.title.trim())
    );
    let title = 'Default Plant';
    if (existingTitles.has(title)) {
      let idx = 2;
      while (existingTitles.has(`Default Plant ${idx}`)) {
        idx++;
      }
      title = `Default Plant ${idx}`;
    }
    const fresh = createNewScape(title);
    setScapes(getAllScapes());
    return fresh;
  }, []);

  const getTargetScapeId = useCallback(() => {
    const currentScapes = getAllScapes();
    const realScapes = currentScapes.filter(s => !s.isExample);
    if (realScapes.length === 0) {
      const fresh = createUniqueDefaultScape(realScapes);
      return fresh.id;
    }
    // If there is an unassigned real scape (not mapped to any location yet), use it
    const assignedScapeIds = new Set((locations || []).map(l => l.scapeId).filter(Boolean));
    const unassignedScape = realScapes.find(s => !assignedScapeIds.has(s.id));
    if (unassignedScape) {
      return unassignedScape.id;
    }
    // All existing real scapes are already occupied by other locations:
    // create another clean empty default scape rather than reusing another location's scape!
    const fresh = createUniqueDefaultScape(realScapes);
    return fresh.id;
  }, [locations, createUniqueDefaultScape]);

  const handleAddLocation = () => {
    if (loadingDevices) return;
    const targetScapeId = getTargetScapeId();
    if (targetScapeId) {
      setActiveScapeId(targetScapeId);
    }
    const newLoc = {
      id: `loc_${Date.now()}`,
      name: `Location ${locations.length + 1}`,
      scapeId: targetScapeId,
      measurementPoints: []
    };
    handleUpdateLocations([...locations, newLoc]);
    setActiveTargetLocId(newLoc.id);
  };

  const handleDeleteLocation = (locId) => {
    if (loadingDevices) return;
    const remaining = locations.filter(l => l.id !== locId);
    handleUpdateLocations(remaining);
    if (remaining.length === 0) {
      setActiveScapeId('');
      if (onSyncToScape) {
        onSyncToScape('', null);
      }
    }
    if (activeTargetLocId === locId) {
      setActiveTargetLocId(remaining[0]?.id || null);
    }
  };

  const handleLocationNameChange = (locId, name) => {
    if (loadingDevices) return;
    handleUpdateLocations(locations.map(l => l.id === locId ? { ...l, name } : l));
  };

  const handleLocationScapeChange = (locId, scapeId) => {
    if (loadingDevices) return;
    handleUpdateLocations(locations.map(l => l.id === locId ? { ...l, scapeId } : l));
  };

  const handleAddMeasurementPoint = (locId) => {
    if (loadingDevices) return;
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
    if (loadingDevices) return;
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        measurementPoints: (l.measurementPoints || []).filter(m => m.id !== mpId)
      };
    }));
  };

  const handleMpNameChange = (locId, mpId, name) => {
    if (loadingDevices) return;
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
    if (loadingDevices) {
      if (e?.preventDefault) e.preventDefault();
      return;
    }
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

  const handleQuickAssignChannel = (ch, sensorName, devInfo, sensInfo) => {
    if (loadingDevices) return;
    const devName = typeof devInfo === 'object' ? devInfo?.name : devInfo;
    const devId = typeof devInfo === 'object' ? devInfo?.id : (ch.deviceId || null);
    const devSerial = typeof devInfo === 'object' ? devInfo?.serial : (ch.deviceSerial || null);
    const devPort = typeof devInfo === 'object' ? devInfo?.connectionConfig?.port : (ch.devicePort || null);
    const sensName = sensorName || (typeof sensInfo === 'object' ? sensInfo?.name : null) || ch.sensorName || ch.sensor_description || '';
    const sensId = (typeof sensInfo === 'object' ? sensInfo?.id : null) || ch.sensorId || '';

    if (isChannelAssigned(ch, devName, devId, devSerial, sensName, sensId)) return;

    const cleanSerial = devSerial ? String(devSerial).replace(/[^a-zA-Z0-9_-]/g, '_') : null;
    const cleanSensKey = sensName ? String(sensName).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : (sensId ? String(sensId).replace(/[^a-zA-Z0-9_-]/g, '_') : '');
    const isGenericId = !ch.id || /^(?:cid_)?\d+$/i.test(String(ch.id)) || /^ch_\d+$/i.test(String(ch.id));
    const channelUniqueId = (!isGenericId && ch.id) ? ch.id : (cleanSerial ? `ch_sn_${cleanSerial}_${cleanSensKey ? `${cleanSensKey}_` : ''}${ch.channel_id ?? ch.name}` : (devId ? `ch_${devId}_${cleanSensKey ? `${cleanSensKey}_` : ''}${ch.channel_id ?? ch.name}` : `cid_${ch.channel_id}`));

    const cleanCh = {
      id: channelUniqueId,
      channel_id: ch.channel_id ?? ch.channelId,
      channelId: ch.channel_id ?? ch.channelId,
      name: ch.name || ch.channelName || 'Channel',
      unit: ch.unit,
      device: ch.device || devName,
      deviceId: ch.deviceId || devId,
      deviceSerial: ch.deviceSerial || devSerial,
      devicePort: ch.devicePort || devPort,
      sensorName: sensName,
      sensorId: sensId,
      slaver_addr: ch.slaver_addr,
      mBValueAddr: ch.mBValueAddr
    };

    const updatedLocs = [...locations];

    if (updatedLocs.length === 0) {
      const targetScapeId = getTargetScapeId();
      if (targetScapeId) {
        setActiveScapeId(targetScapeId);
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
      setActiveTargetLocId(newLoc.id);
      setSyncFeedback(`✓ Created Location 1 and assigned "${cleanCh.name}"`);
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }

    const targetLoc = (activeTargetLocId && updatedLocs.find(l => l.id === activeTargetLocId))
      || updatedLocs[0];
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

  const handleQuickAssignSensor = (sens, devInfo) => {
    if (loadingDevices) return;
    const devName = typeof devInfo === 'object' ? devInfo?.name : devInfo;
    const devId = typeof devInfo === 'object' ? devInfo?.id : null;
    const devSerial = typeof devInfo === 'object' ? devInfo?.serial : null;
    const devPort = typeof devInfo === 'object' ? devInfo?.connectionConfig?.port : null;

    const unassignedChs = (sens.channels || []).filter(c => !isChannelAssigned(c, devName, devId, devSerial, sens.name, sens.id));
    if (unassignedChs.length === 0) return;

    const cleanSerial = devSerial ? String(devSerial).replace(/[^a-zA-Z0-9_-]/g, '_') : null;
    const cleanSensKey = sens.name ? String(sens.name).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : (sens.id ? String(sens.id).replace(/[^a-zA-Z0-9_-]/g, '_') : '');

    const chs = unassignedChs.map((c, idx) => {
      const isGenericId = !c.id || /^(?:cid_)?\d+$/i.test(String(c.id)) || /^ch_\d+$/i.test(String(c.id));
      const channelUniqueId = (!isGenericId && c.id) ? c.id : (cleanSerial ? `ch_sn_${cleanSerial}_${cleanSensKey ? `${cleanSensKey}_` : ''}${c.channel_id ?? idx + 1}` : (devId ? `ch_${devId}_${cleanSensKey ? `${cleanSensKey}_` : ''}${c.channel_id ?? idx + 1}` : `cid_${c.channel_id}`));
      return {
        id: channelUniqueId,
        channel_id: c.channel_id ?? c.channelId,
        channelId: c.channel_id ?? c.channelId,
        name: c.name || c.channelName,
        unit: c.unit,
        device: c.device || devName,
        deviceId: c.deviceId || devId,
        deviceSerial: c.deviceSerial || devSerial,
        devicePort: c.devicePort || devPort,
        sensorName: sens.name,
        sensorId: sens.id,
        slaver_addr: c.slaver_addr,
        mBValueAddr: c.mBValueAddr
      };
    });

    const updatedLocs = [...locations];

    if (updatedLocs.length === 0) {
      const targetScapeId = getTargetScapeId();
      if (targetScapeId) {
        setActiveScapeId(targetScapeId);
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
      setActiveTargetLocId(newLoc.id);
      setSyncFeedback(`✓ Created Location 1 with "${sens.name}" (${chs.length} channels)`);
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }

    const targetLoc = (activeTargetLocId && updatedLocs.find(l => l.id === activeTargetLocId))
      || updatedLocs[0];
    const mps = targetLoc.measurementPoints || [];
    const newMp = {
      id: `mp_${Date.now()}_${mps.length + 1}`,
      name: sens.name || 'Sensor',
      channels: chs
    };
    targetLoc.measurementPoints = [...mps, newMp];

    handleUpdateLocations([...updatedLocs]);
    setSyncFeedback(`✓ Created Measurement Point "${sens.name}" in ${targetLoc.name} (${chs.length} channels)`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleDropOnLocation = (locId, e) => {
    if (loadingDevices) return;
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
          device: payload.device,
          deviceId: payload.deviceId,
          deviceSerial: payload.deviceSerial,
          devicePort: payload.devicePort
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
        const pDev = payload.device || payload.name;
        const pDevId = payload.deviceId || payload.id;
        const pSerial = payload.deviceSerial || payload.serial;
        const unassignedChs = (payload.channels || []).filter(c => !isChannelAssigned(c, pDev, pDevId, pSerial, sensName, payload.id));
        if (unassignedChs.length === 0) {
          setSyncFeedback(`⚠️ All channels of "${sensName}" are already assigned`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }

        const cleanSerial = pSerial ? String(pSerial).replace(/[^a-zA-Z0-9_-]/g, '_') : null;
        const cleanSensKey = sensName ? String(sensName).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : '';

        const chs = unassignedChs.map((c, idx) => {
          const isGenericId = !c.id || /^(?:cid_)?\d+$/i.test(String(c.id)) || /^ch_\d+$/i.test(String(c.id));
          const channelUniqueId = (!isGenericId && c.id) ? c.id : (cleanSerial ? `ch_sn_${cleanSerial}_${cleanSensKey ? `${cleanSensKey}_` : ''}${c.channel_id ?? idx + 1}` : (pDevId ? `ch_${pDevId}_${cleanSensKey ? `${cleanSensKey}_` : ''}${c.channel_id ?? idx + 1}` : `cid_${c.channel_id}`));
          return {
            id: channelUniqueId,
            channel_id: c.channel_id ?? c.id,
            channelId: c.channel_id ?? c.id,
            name: c.name,
            unit: c.unit,
            device: c.device || pDev,
            deviceId: c.deviceId || pDevId,
            deviceSerial: c.deviceSerial || pSerial,
            devicePort: c.devicePort || payload.devicePort || payload.port,
            sensorName: sensName,
            sensorId: payload.id,
            slaver_addr: c.slaver_addr,
            mBValueAddr: c.mBValueAddr
          };
        });

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
        const pDev = payload.device || payload.sensorName;
        const pDevId = payload.deviceId;
        const pSerial = payload.deviceSerial || payload.serial;
        const pSensName = payload.sensorName;
        const pSensId = payload.sensorId;
        if (isChannelAssigned(payload, pDev, pDevId, pSerial, pSensName, pSensId)) {
          setSyncFeedback(`⚠️ Channel "${payload.name || payload.channelName}" is already assigned to a Measurement Point`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }

        const ch = payload;
        const sensName = ch.sensorName || ch.device || 'Measurement Point 1';
        const cleanSerial = pSerial ? String(pSerial).replace(/[^a-zA-Z0-9_-]/g, '_') : null;
        const cleanSensKey = sensName ? String(sensName).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : '';
        const isGenericId = !ch.id || /^(?:cid_)?\d+$/i.test(String(ch.id)) || /^ch_\d+$/i.test(String(ch.id));
        const channelUniqueId = (!isGenericId && ch.id) ? ch.id : (cleanSerial ? `ch_sn_${cleanSerial}_${cleanSensKey ? `${cleanSensKey}_` : ''}${ch.channel_id ?? ch.name}` : (pDevId ? `ch_${pDevId}_${cleanSensKey ? `${cleanSensKey}_` : ''}${ch.channel_id ?? ch.name}` : `cid_${ch.channel_id}`));

        const cleanCh = {
          id: channelUniqueId,
          channel_id: ch.channel_id ?? ch.channelId,
          channelId: ch.channel_id ?? ch.channelId,
          name: ch.name || ch.channelName,
          unit: ch.unit,
          device: ch.device || pDev,
          deviceId: ch.deviceId || pDevId,
          deviceSerial: ch.deviceSerial || pSerial,
          devicePort: ch.devicePort || payload.devicePort || payload.port,
          sensorName: pSensName,
          sensorId: pSensId,
          slaver_addr: ch.slaver_addr,
          mBValueAddr: ch.mBValueAddr
        };

        handleUpdateLocations(locations.map(l => {
          if (l.id !== locId) return l;
          const existingMpIdx = (l.measurementPoints || []).findIndex(m => m.name === sensName);
          if (existingMpIdx >= 0) {
            const updatedMps = [...(l.measurementPoints || [])];
            const curr = updatedMps[existingMpIdx];
            const exists = (curr.channels || []).some(c =>
              c.id === cleanCh.id ||
              (c.channel_id && c.channel_id === cleanCh.channel_id && (c.device || '') === (cleanCh.device || ''))
            );
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
    if (loadingDevices) return;
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
                  displayName: payload.displayName,
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
        const sensName = payload.sensorName || payload.name || 'Sensor';
        const pDev = payload.device || payload.name;
        const pDevId = payload.deviceId || payload.id;
        const pSerial = payload.deviceSerial || payload.serial;
        const unassignedChs = (payload.channels || []).filter(c => !isChannelAssigned(c, pDev, pDevId, pSerial, sensName, payload.id));
        if (unassignedChs.length === 0) {
          setSyncFeedback(`⚠️ All channels of this sensor are already assigned`);
          setTimeout(() => setSyncFeedback(null), 2500);
          return;
        }
        const cleanSerial = pSerial ? String(pSerial).replace(/[^a-zA-Z0-9_-]/g, '_') : null;
        const cleanSensKey = sensName ? String(sensName).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : '';
        const cleanChs = unassignedChs.map((c, idx) => {
          const isGenericId = !c.id || /^(?:cid_)?\d+$/i.test(String(c.id)) || /^ch_\d+$/i.test(String(c.id));
          const channelUniqueId = (!isGenericId && c.id) ? c.id : (cleanSerial ? `ch_sn_${cleanSerial}_${cleanSensKey ? `${cleanSensKey}_` : ''}${c.channel_id ?? idx + 1}` : (pDevId ? `ch_${pDevId}_${cleanSensKey ? `${cleanSensKey}_` : ''}${c.channel_id ?? idx + 1}` : `cid_${c.channel_id}`));
          return {
            id: channelUniqueId,
            channel_id: c.channel_id ?? c.channelId ?? (idx + 1),
            channelId: c.channel_id ?? c.channelId ?? (idx + 1),
            name: c.name || c.channelName,
            unit: c.unit,
            device: c.device || pDev,
            deviceId: c.deviceId || pDevId,
            deviceSerial: c.deviceSerial || pSerial,
            devicePort: c.devicePort || payload.devicePort || payload.port,
            sensorName: sensName,
            sensorId: payload.id,
            slaver_addr: c.slaver_addr,
            mBValueAddr: c.mBValueAddr
          };
        });

        handleUpdateLocations(locations.map(l => {
          if (l.id !== locId) return l;
          return {
            ...l,
            measurementPoints: (l.measurementPoints || []).map(m => {
              if (m.id !== mpId) return m;
              const existingIds = new Set((m.channels || []).map(ch => ch.id));
              const existingDevCids = new Set((m.channels || []).map(ch => `${ch.deviceId || ch.device || ''}_${ch.sensorName || ''}_${ch.channel_id}`).filter(Boolean));
              const toAdd = cleanChs.filter(ch => !existingIds.has(ch.id) && !existingDevCids.has(`${ch.deviceId || ch.device || ''}_${ch.sensorName || ''}_${ch.channel_id}`));
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
        const pDev = payload.device || payload.sensorName;
        const pDevId = payload.deviceId;
        const pSerial = payload.deviceSerial || payload.serial;
        const pSensName = payload.sensorName;
        const pSensId = payload.sensorId;
        if (isChannelAssigned(payload, pDev, pDevId, pSerial, pSensName, pSensId)) {
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
          const chSerial = channel.deviceSerial || channel.serial;
          const cleanSerial = chSerial ? String(chSerial).replace(/[^a-zA-Z0-9_-]/g, '_') : null;
          const sensName = channel.sensorName || channel.device || '';
          const cleanSensKey = sensName ? String(sensName).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : '';
          const isGenericId = !channel.id || /^(?:cid_)?\d+$/i.test(String(channel.id)) || /^ch_\d+$/i.test(String(channel.id));
          const targetId = (!isGenericId && channel.id) ? channel.id : (cleanSerial ? `ch_sn_${cleanSerial}_${cleanSensKey ? `${cleanSensKey}_` : ''}${channel.channel_id ?? 1}` : (channel.deviceId ? `ch_${channel.deviceId}_${cleanSensKey ? `${cleanSensKey}_` : ''}${channel.channel_id ?? 1}` : `cid_${channel.channel_id}`));
          const chDev = channel.device || channel.sensorName || '';
          const chDevId = channel.deviceId || '';
          const exists = (m.channels || []).some(c => {
            const cSens = c.sensorName;
            const cSensId = c.sensorId;
            const matchesSensor = (!channel.sensorName && !cSens) ||
              (channel.sensorName && cSens && channel.sensorName === cSens) ||
              (channel.sensorId && cSensId && channel.sensorId === cSensId);
            return (c.id && c.id === targetId) ||
              (matchesSensor && chSerial && c.deviceSerial && c.deviceSerial === chSerial && (
                (c.channel_id !== undefined && channel.channel_id !== undefined && c.channel_id === channel.channel_id) ||
                (c.channelId && channel.channelId && c.channelId === channel.channelId)
              )) ||
              (matchesSensor && chDevId && c.deviceId && c.deviceId === chDevId && (
                (c.channel_id !== undefined && channel.channel_id !== undefined && c.channel_id === channel.channel_id) ||
                (c.channelId && channel.channelId && c.channelId === channel.channelId)
              ));
          });
          if (exists) return m;
          return {
            ...m,
            channels: [...(m.channels || []), {
              id: targetId,
              channel_id: channel.channel_id ?? channel.channelId,
              channelId: channel.channel_id ?? channel.channelId,
              name: channel.name || channel.channelName,
              unit: channel.unit,
              device: channel.device || channel.sensorName,
              deviceId: channel.deviceId,
              deviceSerial: chSerial,
              devicePort: channel.devicePort,
              sensorName: channel.sensorName,
              sensorId: channel.sensorId,
              slaver_addr: channel.slaver_addr,
              mBValueAddr: channel.mBValueAddr
            }]
          };
        })
      };
    }));
  };

  const handleRemoveChannelFromMp = (locId, mpId, chId) => {
    if (loadingDevices) return;
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

  const handleChannelDisplayNameChange = (locId, mpId, chId, displayName) => {
    if (loadingDevices) return;
    handleUpdateLocations(locations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        measurementPoints: (l.measurementPoints || []).map(m => {
          if (m.id !== mpId) return m;
          return {
            ...m,
            channels: (m.channels || []).map(c => {
              if (c.id !== chId) return c;
              return {
                ...c,
                displayName: displayName
              };
            })
          };
        })
      };
    }));
  };

  const handleConfirmAndSyncAll = () => {
    if (loadingDevices) return;
    saveLocations(locations);
    if (locations.length === 0) {
      setActiveScapeId('');
      if (onSyncToScape) {
        onSyncToScape('', null);
      }
      onClose();
      return;
    }
    const res = syncAllLocationsToScapes(locations);
    const activeLoc = locations.find(l => l.id === activeTargetLocId) || locations[0];
    const targetScapeId = activeLoc?.scapeId || '';
    const targetLocId = activeLoc?.id || null;

    if (res.syncCount > 0) {
      setSyncFeedback(`✓ Synced ${res.syncCount} measurement point(s) to ProcessScape`);
      if (onSyncToScape) {
        onSyncToScape(targetScapeId, targetLocId);
      }
      setTimeout(() => {
        onClose();
      }, 300);
    } else {
      if (onSyncToScape) {
        onSyncToScape(targetScapeId, targetLocId);
      }
      onClose();
    }
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

  return (
    <>
      <div
        className="ps-sensor-mgr-backdrop"
        onClick={(e) => {
          if (loadingDevices) return;
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className={`ps-sensor-mgr-dialog ${loadingDevices ? 'is-loading-busy' : ''}`} onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="ps-sensor-mgr-header">
            <div className="ps-sm-title-group">
              <div className="ps-sm-title-row">
                <h2 className="ps-sm-title">Location and Sensors</h2>
                {syncFeedback && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#00ac86', marginLeft: 8 }}>
                    {syncFeedback}
                  </span>
                )}
              </div>
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
                disabled={loadingDevices}
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
                  Drag to right
                </span>
              </div>

              <div className="ps-sm-search-box">
                <input
                  type="text"
                  className="ps-sm-search-input"
                  placeholder="Search sensor channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loadingDevices}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="ps-sm-search-clear-btn"
                    onClick={() => setSearchQuery('')}
                    disabled={loadingDevices}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="ps-sm-tree-container">
                {loadingDevices && (
                  <div className="ps-sm-tree-loading-overlay">
                    <div className="ps-sm-spinner-circle" />
                    <div className="ps-sm-loading-text">Connecting & reading sensor channels...</div>
                    <div className="ps-sm-loading-subtext">Please wait while device information is retrieved</div>
                  </div>
                )}
                {!loadingDevices && filteredDevices.length === 0 ? (
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
                    const displayName = (dev.name || 'Sensor')
                      .replace(dev.serial ? new RegExp(`\\s*\\(${dev.serial}\\)$`, 'i') : '', '')
                      .replace(/\s*\(\d{6,10}\)$/, '')
                      .trim();

                    const cleanTransport = (dev.transport || '')
                      .replace(/:502(?=[^0-9]|$)/, '')
                      .replace(/\s+ID:\d+/i, '')
                      .replace(/\s+SN:[a-zA-Z0-9_-]+/i, '')
                      .trim();

                    return (
                      <div key={dev.id} className="ps-sm-device-node">
                            <div className="ps-sm-device-header" onClick={() => toggleDeviceCollapse(dev.id)}>
                              <span className="ps-sm-device-title">
                                <span>{isCollapsed ? '►' : '▼'}</span>
                                <span>📡 {displayName}</span>
                                {dev.serial && !/^SN-(USB|TCP|BLE|API)-/i.test(dev.serial) && (
                                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px', fontFamily: 'monospace' }}>
                                    (SN: {dev.serial})
                                  </span>
                                )}
                              </span>
                              <div className="ps-sm-device-badges">
                                <span className={`ps-sm-device-pill ${dev.transportType || ''}`}>{cleanTransport || dev.transport}</span>
                            <button
                              type="button"
                              className="ps-sm-device-reconnect-btn"
                              onClick={(e) => handleReconnectDevice(dev, e)}
                              title={`Reconnect to ${dev.name}`}
                              disabled={loadingDevices}
                            >
                              ↻
                            </button>
                            <button
                              type="button"
                              className="ps-sm-device-del-btn"
                              onClick={(e) => handleRequestRemoveDevice(dev, e)}
                              title="Remove device"
                              disabled={loadingDevices}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div>
                            {(dev.sensors || []).map((sens, sIdx) => {
                              const allAssigned = (sens.channels || []).length > 0 &&
                                (sens.channels || []).every(c => isChannelAssigned(c, dev.name, dev.id, dev.serial, sens.name, sens.id));
                              const unassignedChannels = (sens.channels || []).filter(c => !isChannelAssigned(c, dev.name, dev.id, dev.serial, sens.name, sens.id));

                              return (
                                <div key={sens.id || `${dev.id}_s_${sIdx}`} className="ps-sm-sensor-group">
                                  <div
                                    className={`ps-sm-sensor-name ${allAssigned ? 'is-all-assigned' : ''}`}
                                    draggable={!loadingDevices && !allAssigned}
                                    onDragStart={(e) => {
                                      if (loadingDevices || allAssigned) {
                                        e.preventDefault();
                                        return;
                                      }
                                      handleStartDrag(e, {
                                        type: 'sensor',
                                        sensorName: sens.name,
                                        sensorId: sens.id,
                                        device: dev.name,
                                        deviceId: dev.id,
                                        deviceSerial: dev.serial,
                                        devicePort: dev.connectionConfig?.port,
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
                                              handleQuickAssignSensor(sens, dev);
                                            }}
                                            disabled={loadingDevices}
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
                                      const assigned = isChannelAssigned(ch, dev.name, dev.id, dev.serial, sens.name, sens.id);

                                      return (
                                        <div
                                          key={ch.id || `${sens.id || sIdx}_ch_${chIdx}`}
                                          className={`ps-sm-channel-item ${assigned ? 'is-assigned' : ''}`}
                                          draggable={!loadingDevices && !assigned}
                                          onDragStart={(e) => {
                                            if (loadingDevices || assigned) {
                                              e.preventDefault();
                                              return;
                                            }
                                            handleStartDrag(e, {
                                              type: 'channel',
                                              id: ch.id,
                                              channel_id: ch.channel_id,
                                              channelId: ch.channelId || ch.channel_id,
                                              name: ch.name,
                                              unit: ch.unit,
                                              device: dev.name,
                                              deviceId: dev.id,
                                              deviceSerial: dev.serial || ch.deviceSerial,
                                              devicePort: dev.connectionConfig?.port,
                                              sensorName: sens.name,
                                              sensorId: sens.id,
                                              slaver_addr: ch.slaver_addr,
                                              mBValueAddr: ch.mBValueAddr
                                            });
                                          }}
                                          onDragEnd={handleEndDrag}
                                          title={assigned ? 'Assigned to a Measurement Point (cannot be reused)' : 'Drag and drop onto a Measurement Point on the right, or click "+ Assign"'}
                                        >
                                          <div className="ps-sm-ch-info">
                                            <span className="ps-sm-ch-drag-handle">{assigned ? '🔒' : '⋮⋮'}</span>
                                            <span className="ps-sm-ch-name">{ch.name}</span>
                                            {ch.unit && <span className="ps-sm-ch-unit">{ch.unit}</span>}
                                            {ch.mBValueAddr !== undefined && (
                                              <span className="ps-sm-ch-unit" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '9.5px', fontFamily: 'monospace' }}>
                                                Reg 0x{ch.mBValueAddr.toString(16).toUpperCase().padStart(4, '0')}
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {!assigned && (
                                              <button
                                                type="button"
                                                className="ps-sm-quick-assign-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleQuickAssignChannel(ch, sens.name, dev, sens);
                                                }}
                                                disabled={loadingDevices}
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
                  Locations
                </span>

                <button
                  type="button"
                  className="ps-sm-btn primary"
                  onClick={handleAddLocation}
                  disabled={loadingDevices}
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
                    const isActiveTarget = loc.id === activeTargetLocId;
                    return (
                      <div
                        key={loc.id}
                        className={`ps-sm-location-card ${isActiveTarget ? 'is-active-target' : ''} ${dragOverLocId === loc.id ? 'loc-drag-over' : ''}`}
                        onClick={() => {
                          if (!isActiveTarget) setActiveTargetLocId(loc.id);
                        }}
                        onDragOver={(e) => {
                          if (loadingDevices) return;
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
                          if (loadingDevices) return;
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
                              disabled={loadingDevices}
                            />
                            {isActiveTarget && (
                              <span className="ps-sm-loc-active-pill" title="New sensors and quick assignments will be added to this active location">
                                ● Active
                              </span>
                            )}
                          </div>

                          <div className="ps-sm-loc-match-row">
                            <label className="ps-sm-scape-label">Scape:</label>
                            <select
                              className="ps-sm-scape-select"
                              value={loc.scapeId || ''}
                              onChange={(e) => handleLocationScapeChange(loc.id, e.target.value)}
                              disabled={loadingDevices}
                            >
                              <option value="">-- No ProcessScape (Empty) --</option>
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
                              disabled={loadingDevices}
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
                                if (loadingDevices) return;
                                e.preventDefault();
                                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                                setDragOverLocId(loc.id);
                              }}
                              onDragLeave={() => setDragOverLocId(null)}
                              onDrop={(e) => {
                                if (loadingDevices) return;
                                handleDropOnLocation(loc.id, e);
                              }}
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
                                {/* Sensor Card Style Header (Yellow Industrial Accent Badge) */}
                                <div className="ps-sm-mp-top">
                                  <div className="ps-sm-mp-name-group">
                                    <span className="ps-sm-mp-badge-tag-icon">⚡</span>
                                    <input
                                      type="text"
                                      className="ps-sm-mp-name-input"
                                      value={mp.name}
                                      onChange={(e) => handleMpNameChange(loc.id, mp.id, e.target.value)}
                                      placeholder="Measurement Point Name..."
                                      disabled={loadingDevices}
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    className="ps-sm-close-btn ps-sm-mp-del-btn"
                                    onClick={() => handleDeleteMeasurementPoint(loc.id, mp.id)}
                                    disabled={loadingDevices}
                                    title="Delete Measurement Point"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* HTML5 Dropzone for Channels (Sensor Card Body Panel) */}
                                <div
                                  onDragOver={(e) => {
                                    if (loadingDevices) return;
                                    e.preventDefault();
                                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                                    setDragOverMpId(mp.id);
                                  }}
                                  onDragLeave={() => setDragOverMpId(null)}
                                  onDrop={(e) => {
                                    if (loadingDevices) return;
                                    handleDropChannel(loc.id, mp.id, e);
                                  }}
                                  className={`ps-sm-dropzone ${dragOverMpId === mp.id ? 'drag-over' : ''}`}
                                >
                                  {(mp.channels || []).length === 0 ? (
                                    <div className="ps-sm-dropzone-empty">
                                      <span style={{ fontSize: 13, opacity: 0.8 }}>⚡</span>
                                      <span>Drag channels from left tree or other points here</span>
                                    </div>
                                  ) : (
                                    (mp.channels || []).map((ch, idx) => (
                                      <div
                                        key={ch.id || ch.channelId || `ch_${idx}`}
                                        className="ps-sm-assigned-tag draggable-tag"
                                        draggable={!loadingDevices}
                                        onDragStart={(e) => {
                                          if (loadingDevices) {
                                            e.preventDefault();
                                            return;
                                          }
                                          e.stopPropagation();
                                          handleStartDrag(e, {
                                            type: 'move_channel',
                                            id: ch.id,
                                            channel_id: ch.channel_id,
                                            name: ch.name,
                                            displayName: ch.displayName,
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
                                        <div className="ps-sm-tag-left">
                                          <span className="ps-sm-tag-drag-handle">⋮⋮</span>
                                          <span className="ps-sm-tag-dot" />
                                          <input
                                            type="text"
                                            className="ps-sm-tag-name-input"
                                            value={ch.displayName !== undefined ? ch.displayName : ch.name}
                                            placeholder={ch.name}
                                            onChange={(e) => handleChannelDisplayNameChange(loc.id, mp.id, ch.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            draggable={false}
                                            disabled={loadingDevices}
                                            title="Click to rename display name"
                                          />
                                          <span className="ps-sm-tag-name" style={{ display: 'none' }}>
                                            {ch.displayName || ch.name}
                                          </span>
                                        </div>
                                        <div className="ps-sm-tag-right">
                                          <span className="ps-sm-tag-val">--.-</span>
                                          {ch.unit && <span className="ps-sm-ch-unit">{ch.unit}</span>}
                                          <button
                                            type="button"
                                            className="ps-sm-tag-del"
                                            onClick={() => handleRemoveChannelFromMp(loc.id, mp.id, ch.id)}
                                            disabled={loadingDevices}
                                            title="Remove channel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
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
                            disabled={loadingDevices}
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
                disabled={loadingDevices}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ps-sm-btn primary ps-sm-footer-confirm-btn"
                onClick={handleConfirmAndSyncAll}
                disabled={loadingDevices}
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
        singleDeviceMode={false}
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
