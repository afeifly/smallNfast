import React, { useState, useMemo, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import { getLocations, getSavedDevices } from './engine/sensorManagerStorage';
import './ProcessScapeRecordModal.css';

/**
 * ProcessScapeRecordModal
 * Multi-device live recording setup dialog.
 * Presents a clear table of assigned channels:
 * [Log Checkbox] | [Location] | [Measurement Point] | [Channel (with Device Sensor Tooltip)]
 * All channels checked by default ready for recording.
 */
export default function ProcessScapeRecordModal({
  isOpen,
  onClose,
  onStart,
  onOpenSensorManager
}) {
  const [intervalInput, setIntervalInput] = useState('10');
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // Aggregate all assigned channels across locations & measurement points
  const assignedChannels = useMemo(() => {
    if (!isOpen) return [];

    const locs = getLocations();
    const devs = getSavedDevices();
    const list = [];

    locs.forEach(loc => {
      (loc.measurementPoints || []).forEach(mp => {
        (mp.channels || []).forEach(ch => {
          // Identify matching hardware device
          let matchedDev = devs.find(d =>
            (ch.deviceId && d.id === ch.deviceId) ||
            (ch.device && d.name && (ch.device === d.name || ch.device.toLowerCase() === d.name.toLowerCase())) ||
            (ch.id && String(ch.id).includes(d.id))
          );

          if (!matchedDev) {
            matchedDev = {
              id: ch.deviceId || `dev_${ch.device || 'suto'}`,
              name: ch.device || 'SUTO Device',
              serial: 'Hardware Link',
              transportType: 'usb',
              isOnline: true
            };
          }

          const uniqueKey = `${loc.id}_${mp.id}_${ch.id || ch.channel_id || ch.channelId || Math.random().toString(36).substr(2, 6)}`;
          const channelNumber = ch.channel_id ?? ch.channelId ?? (typeof ch.id === 'string' && ch.id.match(/_(\d+)/)?.[1]) ?? 1;

          list.push({
            key: uniqueKey,
            id: ch.id || uniqueKey,
            channel_id: Number(channelNumber) || channelNumber,
            name: ch.customName || ch.displayName || ch.name || `Channel ${channelNumber}`,
            originalName: ch.name || '',
            unit: ch.unit || '',
            resolution: typeof ch.resolution === 'number' ? ch.resolution : 2,
            locationId: loc.id,
            locationName: loc.name || 'Location',
            measurementPointId: mp.id,
            measurementPointName: mp.name || 'Measurement Point',
            deviceId: matchedDev.id,
            deviceName: matchedDev.name || 'SUTO Device',
            deviceSerial: matchedDev.serial || '',
            transportType: matchedDev.transportType || 'usb',
            deviceIp: matchedDev.connectionConfig?.host || matchedDev.ip || '',
            devicePort: matchedDev.connectionConfig?.port || matchedDev.port || (matchedDev.transportType === 'api' ? 8080 : 502)
          });
        });
      });
    });

    return list;
  }, [isOpen]);

  // Default all assigned channels checked ready for recording whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const allKeys = new Set(assignedChannels.map(c => c.key));
      setSelectedKeys(allKeys);
      setIntervalInput('10');
    }
  }, [isOpen, assignedChannels]);

  const handleToggleRow = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isAllChecked = assignedChannels.length > 0 && selectedKeys.size === assignedChannels.length;
  const isIndeterminate = selectedKeys.size > 0 && selectedKeys.size < assignedChannels.length;

  const handleToggleAll = () => {
    if (isAllChecked) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(assignedChannels.map(c => c.key)));
    }
  };

  const handleStartRecording = () => {
    const chosen = assignedChannels.filter(c => selectedKeys.has(c.key));
    if (chosen.length === 0) return;
    const intervalSec = Math.max(1, Math.min(3600, parseInt(intervalInput, 10) || 10));
    onStart({
      intervalSec,
      selectedChannels: chosen
    });
  };

  const totalChannelsCount = assignedChannels.length;
  const selectedCount = selectedKeys.size;
  const intervalPresets = [1, 5, 10, 30, 60];

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="ps-record-modal-root"
      PaperProps={{
        style: {
          borderRadius: 14,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle className="ps-rec-title-bar">
        <div className="ps-rec-title-wrap">
          <span className="ps-rec-title-dot" />
          <span className="ps-rec-title-text">ProcessScape Live Recording</span>
        </div>
        <span className="ps-rec-badge">Multi-Device SCADA</span>
      </DialogTitle>

      <DialogContent dividers className="ps-rec-content">
        {/* Sampling Interval Section */}
        <div className="ps-rec-interval-box">
          <div className="ps-rec-interval-header">
            <label className="ps-rec-section-label" htmlFor="ps-rec-interval-input">
              Sampling Interval
            </label>
            <div className="ps-rec-preset-chips">
              {intervalPresets.map(sec => (
                <button
                  type="button"
                  key={sec}
                  className={`ps-rec-chip ${parseInt(intervalInput, 10) === sec ? 'active' : ''}`}
                  onClick={() => setIntervalInput(String(sec))}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
          <TextField
            id="ps-rec-interval-input"
            type="number"
            size="small"
            fullWidth
            value={intervalInput}
            onChange={(e) => setIntervalInput(e.target.value)}
            inputProps={{ min: 1, max: 3600 }}
            helperText="The first sample is captured immediately, subsequent samples at each interval boundary."
          />
        </div>

        {/* Channels Table Section */}
        <div className="ps-rec-channels-section">
          <div className="ps-rec-section-header">
            <div>
              <span className="ps-rec-section-label">Select Channels to Log</span>
              <span className="ps-rec-count-hint">
                ({selectedCount} of {totalChannelsCount} selected)
              </span>
            </div>
            {totalChannelsCount > 0 && (
              <div className="ps-rec-select-actions">
                <button
                  type="button"
                  className="ps-rec-action-link"
                  onClick={() => setSelectedKeys(new Set(assignedChannels.map(c => c.key)))}
                >
                  Select All
                </button>
                <span className="ps-rec-divider">•</span>
                <button
                  type="button"
                  className="ps-rec-action-link"
                  onClick={() => setSelectedKeys(new Set())}
                >
                  Deselect All
                </button>
              </div>
            )}
          </div>

          {totalChannelsCount === 0 ? (
            <div className="ps-rec-empty-state">
              <div className="ps-rec-empty-icon">📍</div>
              <div className="ps-rec-empty-title">No Assigned Channels Found</div>
              <div className="ps-rec-empty-desc">
                Only channels assigned to a Location and Measurement Point are recorded in ProcessScape.
                Please assign device channels in the Sensor Manager first.
              </div>
              {onOpenSensorManager && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    onClose();
                    onOpenSensorManager();
                  }}
                  style={{ textTransform: 'none', borderColor: '#00ac86', color: '#00ac86', fontWeight: 600 }}
                >
                  ⚙️ Open Sensor & Measurement Point Manager
                </Button>
              )}
            </div>
          ) : (
            <div className="ps-rec-table-wrap">
              <table className="ps-rec-table">
                <thead>
                  <tr>
                    <th className="th-checkbox" style={{ width: 68, textAlign: 'center' }}>
                      <div className="ps-rec-th-check-wrap">
                        <Checkbox
                          size="small"
                          checked={isAllChecked}
                          indeterminate={isIndeterminate}
                          onChange={handleToggleAll}
                          style={{ padding: 2, color: '#00ac86' }}
                          title="Toggle all channels"
                        />
                        <span>Log</span>
                      </div>
                    </th>
                    <th style={{ width: '28%' }}>Location</th>
                    <th style={{ width: '32%' }}>Measurement Point</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedChannels.map(row => {
                    const isChecked = selectedKeys.has(row.key);
                    return (
                      <tr
                        key={row.key}
                        className={`ps-rec-row ${isChecked ? 'selected' : ''}`}
                        onClick={() => handleToggleRow(row.key)}
                      >
                        <td className="td-checkbox" style={{ textAlign: 'center' }}>
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            onChange={() => handleToggleRow(row.key)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: 2, color: '#00ac86' }}
                          />
                        </td>
                        <td>
                          <div className="ps-rec-cell-loc">
                            <span className="ps-rec-loc-icon">📍</span>
                            <span className="ps-rec-loc-name">{row.locationName}</span>
                          </div>
                        </td>
                        <td>
                          <div className="ps-rec-cell-mp">
                            <span className="ps-rec-mp-icon">🎯</span>
                            <span className="ps-rec-mp-name">{row.measurementPointName}</span>
                          </div>
                        </td>
                        <td>
                          <Tooltip
                            arrow
                            placement="top"
                            title={
                              <div style={{ fontSize: 11.5, lineHeight: 1.45, padding: '2px 4px' }}>
                                <div style={{ fontWeight: 800, color: '#00ac86', marginBottom: 2 }}>
                                  📟 {row.deviceName}
                                </div>
                                {row.deviceSerial && <div><strong>Serial:</strong> {row.deviceSerial}</div>}
                                {row.deviceIp && (
                                  <div><strong>Address:</strong> {row.deviceIp}{row.devicePort ? `:${row.devicePort}` : ''}</div>
                                )}
                                <div><strong>Transport:</strong> {row.transportType.toUpperCase()}</div>
                                {row.originalName && row.originalName !== row.name && (
                                  <div><strong>Sensor:</strong> {row.originalName}</div>
                                )}
                              </div>
                            }
                          >
                            <div className="ps-rec-cell-ch">
                              <span className="ps-rec-ch-name">{row.name}</span>
                              {row.unit && <span className="ps-rec-ch-unit">({row.unit})</span>}
                              <span className="ps-rec-ch-id">Ch {row.channel_id}</span>
                              <span className="ps-rec-info-icon" title="Device & Sensor Info">ℹ️</span>
                            </div>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogActions className="ps-rec-actions">
        <Button
          onClick={onClose}
          style={{ textTransform: 'none', color: '#64748b', fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Tooltip
          title={selectedCount === 0 ? 'Select at least 1 channel to start recording' : ''}
          disableHoverListener={selectedCount > 0}
        >
          <span>
            <Button
              variant="contained"
              onClick={handleStartRecording}
              disabled={selectedCount === 0}
              className="ps-rec-start-btn"
              style={{
                textTransform: 'none',
                backgroundColor: selectedCount > 0 ? '#00ac86' : '#cbd5e1',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: 8,
                padding: '6px 18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span className="ps-rec-btn-dot" />
              Start Recording ({selectedCount})
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
