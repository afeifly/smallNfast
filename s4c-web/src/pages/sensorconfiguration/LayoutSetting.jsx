import React, { useState, useMemo, useCallback } from 'react';
import { useConfig } from '../../context/ConfigContext';
import CustomDialog from '../../components/CustomDialog';
import ChannelSelectModal from '../../components/ChannelSelectModal';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import './LayoutSetting.css';

// ── Helper: find location config path ────────────────────────────────────────
const findLocationPath = (configs) => {
  if (!configs) return null;
  return Object.keys(configs).find(p => p.endsWith('cfgLocation.json'));
};

// ── Helper: find sensor list path ────────────────────────────────────────────
const findSensorListPath = (configs) => {
  if (!configs) return null;
  return Object.keys(configs).find(p => p.endsWith('SUTO-SensorList.sutolist'));
};

// ── Main Component ───────────────────────────────────────────────────────────
const LayoutSetting = () => {
  const { configData, setConfigData } = useConfig();

  // Selection state
  const [selectedLocationIdx, setSelectedLocationIdx] = useState(null);
  const [selectedMeapointIdx, setSelectedMeapointIdx] = useState(null);

  // (Add-new is handled via inline edit after creation)

  // Rename state
  const [editingLocIdx, setEditingLocIdx] = useState(null);
  const [editingLocName, setEditingLocName] = useState('');
  const [editingMpIdx, setEditingMpIdx] = useState(null);
  const [editingMpName, setEditingMpName] = useState('');

  // Channel select modal
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Dialog
  const [dialogState, setDialogState] = useState({
    isOpen: false, title: '', body: '', type: 'warn', onConfirm: null, showCancel: true
  });
  const closeDialog = () => setDialogState(prev => ({ ...prev, isOpen: false }));

  // ── Derived data ─────────────────────────────────────────────────────────
  const locationPath = findLocationPath(configData?.configs);
  const locationsArray = configData?.configs?.[locationPath]?.Locations || [];

  const sensorListPath = findSensorListPath(configData?.configs);
  const sensors = configData?.configs?.[sensorListPath]?.cfgsensor || [];

  // Build flat channel list from all sensors
  const allChannels = useMemo(() => {
    const result = [];
    sensors.forEach(sensor => {
      (sensor.cfgchannel || []).forEach(ch => {
        result.push({
          CreateTime: String(ch.CreateTime || ''),
          sensorName: sensor.Name || sensor.Description || 'Unknown Sensor',
          channelName: ch.ChannelDescription || 'Unknown Channel',
          unit: ch.UnitInASCII || '',
          location: '',
          point: ''
        });
      });
    });
    return result;
  }, [sensors]);

  // Currently selected location & meapoints
  const selectedLocation = selectedLocationIdx !== null ? locationsArray[selectedLocationIdx] : null;
  const meapoints = selectedLocation?.meapoints || [];

  // Currently selected meapoint & its channels
  const selectedMeapoint = selectedMeapointIdx !== null ? meapoints[selectedMeapointIdx] : null;
  const meapointChannelIds = selectedMeapoint?.channels || [];

  // Resolve channel IDs to channel info
  const resolvedChannels = useMemo(() => {
    return meapointChannelIds.map(id => {
      const ch = allChannels.find(c => c.CreateTime === String(id));
      return ch || { CreateTime: String(id), sensorName: '---', channelName: `Unknown (${id})`, unit: '---' };
    });
  }, [meapointChannelIds, allChannels]);

  // ── Persist helper ───────────────────────────────────────────────────────
  const persistLocations = useCallback((newLocations) => {
    if (!locationPath) {
      // Create the cfgLocation.json entry if it doesn't exist
      const path = 'config/cfgLocation.json';
      setConfigData({
        ...configData,
        configs: {
          ...configData.configs,
          [path]: { Locations: newLocations }
        }
      });
      return;
    }
    setConfigData({
      ...configData,
      configs: {
        ...configData.configs,
        [locationPath]: {
          ...configData.configs[locationPath],
          Locations: newLocations
        }
      }
    });
  }, [configData, setConfigData, locationPath]);

  // ── Location CRUD ────────────────────────────────────────────────────────
  const handleAddLocation = () => {
    // Generate a unique default name
    let num = locationsArray.length + 1;
    let name = `Location ${num}`;
    while (locationsArray.some(l => l.location === name)) {
      num++;
      name = `Location ${num}`;
    }
    const newLoc = { location: name, meapoints: [] };
    const updated = [...locationsArray, newLoc];
    persistLocations(updated);
    const newIdx = updated.length - 1;
    setSelectedLocationIdx(newIdx);
    setSelectedMeapointIdx(null);
    // Enter inline-edit mode immediately
    setEditingLocIdx(newIdx);
    setEditingLocName(name);
  };

  const handleDeleteLocation = (idx) => {
    const loc = locationsArray[idx];
    setDialogState({
      isOpen: true, title: 'Delete Location',
      body: `Delete location "${loc.location}" and all its measurement points?`, type: 'warn',
      showCancel: true,
      onConfirm: () => {
        const updated = locationsArray.filter((_, i) => i !== idx);
        persistLocations(updated);
        if (selectedLocationIdx === idx) {
          setSelectedLocationIdx(null);
          setSelectedMeapointIdx(null);
        } else if (selectedLocationIdx > idx) {
          setSelectedLocationIdx(selectedLocationIdx - 1);
        }
        closeDialog();
      }
    });
  };

  const startEditLocation = (idx) => {
    setEditingLocIdx(idx);
    setEditingLocName(locationsArray[idx].location);
  };

  const confirmEditLocation = () => {
    const name = editingLocName.trim();
    if (!name) { setEditingLocIdx(null); return; }
    const dup = locationsArray.some((l, i) => l.location === name && i !== editingLocIdx);
    if (dup) {
      setDialogState({
        isOpen: true, title: 'Duplicate Location',
        body: `Location "${name}" already exists.`, type: 'err',
        showCancel: false, onConfirm: closeDialog
      });
      return;
    }
    const updated = locationsArray.map((l, i) => {
      if (i !== editingLocIdx) return l;
      // Also update location name inside meapoints
      const updatedMps = (l.meapoints || []).map(mp => ({ ...mp, location: name }));
      return { ...l, location: name, meapoints: updatedMps };
    });
    persistLocations(updated);
    setEditingLocIdx(null);
  };

  // ── Measurement Point CRUD ───────────────────────────────────────────────
  const handleAddMeapoint = () => {
    if (selectedLocationIdx === null) return;
    // Generate a unique default name
    let num = meapoints.length + 1;
    let name = `Point ${num}`;
    while (meapoints.some(mp => mp.meapoint === name)) {
      num++;
      name = `Point ${num}`;
    }
    const newMp = {
      index: meapoints.length,
      is2Height: false,
      location: selectedLocation.location,
      meapoint: name,
      channels: []
    };
    const updatedLocs = locationsArray.map((l, i) => {
      if (i !== selectedLocationIdx) return l;
      return { ...l, meapoints: [...(l.meapoints || []), newMp] };
    });
    persistLocations(updatedLocs);
    const newMpIdx = meapoints.length;
    setSelectedMeapointIdx(newMpIdx);
    // Enter inline-edit mode immediately
    setEditingMpIdx(newMpIdx);
    setEditingMpName(name);
  };

  const handleDeleteMeapoint = (mpIdx) => {
    const mp = meapoints[mpIdx];
    setDialogState({
      isOpen: true, title: 'Delete Measurement Point',
      body: `Delete measurement point "${mp.meapoint}" and unlink its channels?`, type: 'warn',
      showCancel: true,
      onConfirm: () => {
        const updatedLocs = locationsArray.map((l, i) => {
          if (i !== selectedLocationIdx) return l;
          return { ...l, meapoints: (l.meapoints || []).filter((_, mi) => mi !== mpIdx) };
        });
        persistLocations(updatedLocs);
        if (selectedMeapointIdx === mpIdx) setSelectedMeapointIdx(null);
        else if (selectedMeapointIdx > mpIdx) setSelectedMeapointIdx(selectedMeapointIdx - 1);
        closeDialog();
      }
    });
  };

  const startEditMeapoint = (mpIdx) => {
    setEditingMpIdx(mpIdx);
    setEditingMpName(meapoints[mpIdx].meapoint);
  };

  const confirmEditMeapoint = () => {
    const name = editingMpName.trim();
    if (!name) { setEditingMpIdx(null); return; }
    const dup = meapoints.some((mp, i) => mp.meapoint === name && i !== editingMpIdx);
    if (dup) {
      setDialogState({
        isOpen: true, title: 'Duplicate Point',
        body: `Measurement point "${name}" already exists.`, type: 'err',
        showCancel: false, onConfirm: closeDialog
      });
      return;
    }
    const updatedLocs = locationsArray.map((l, i) => {
      if (i !== selectedLocationIdx) return l;
      return {
        ...l,
        meapoints: (l.meapoints || []).map((mp, mi) =>
          mi === editingMpIdx ? { ...mp, meapoint: name } : mp
        )
      };
    });
    persistLocations(updatedLocs);
    setEditingMpIdx(null);
  };

  // ── Channel management ──────────────────────────────────────────────────
  const handleRemoveChannel = (createTime) => {
    if (selectedLocationIdx === null || selectedMeapointIdx === null) return;
    const updatedLocs = locationsArray.map((l, i) => {
      if (i !== selectedLocationIdx) return l;
      return {
        ...l,
        meapoints: (l.meapoints || []).map((mp, mi) => {
          if (mi !== selectedMeapointIdx) return mp;
          return { ...mp, channels: (mp.channels || []).filter(id => String(id) !== String(createTime)) };
        })
      };
    });
    persistLocations(updatedLocs);
  };

  const handleChannelsConfirm = (ids) => {
    if (selectedLocationIdx === null || selectedMeapointIdx === null) return;
    const updatedLocs = locationsArray.map((l, i) => {
      if (i !== selectedLocationIdx) return l;
      return {
        ...l,
        meapoints: (l.meapoints || []).map((mp, mi) => {
          if (mi !== selectedMeapointIdx) return mp;
          return { ...mp, channels: ids };
        })
      };
    });
    persistLocations(updatedLocs);
    setIsChannelModalOpen(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="content-card layout-setting-page">

      {/* Header */}
      <header className="layout-header">
        <div>
          <h2>Layout setting</h2>
          <p>Manage locations, measurement points, and channel assignments.</p>
        </div>
      </header>

      <div className="layout-content">
          {/* Column 1: Location Card */}
          <div className="layout-card location-card">
            <div className="layout-card-header">
              <span>
                <span className="card-title">Locations</span>
                <span className="card-count">({locationsArray.length})</span>
              </span>
              <button className="btn-layout-icon" title="Add Location" onClick={handleAddLocation} style={{ background: '#00AB84', borderRadius: '4px' }}>
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 3V13" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><path d="M3 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="layout-card-body">
              {locationsArray.length > 0 ? (
                locationsArray.map((loc, idx) => (
                  <div
                    key={idx}
                    className={`layout-list-item ${selectedLocationIdx === idx ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedLocationIdx(idx);
                      setSelectedMeapointIdx(null);
                      setEditingLocIdx(null);
                    }}
                  >
                    {editingLocIdx === idx ? (
                      <input
                        className="layout-inline-input"
                        style={{ flex: 1, marginRight: 8 }}
                        value={editingLocName}
                        onChange={e => setEditingLocName(e.target.value)}
                        onBlur={confirmEditLocation}
                        onKeyDown={e => { if (e.key === 'Enter') confirmEditLocation(); if (e.key === 'Escape') setEditingLocIdx(null); }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span className="item-name">{loc.location}</span>
                        <span className="item-badge">{(loc.meapoints || []).length} pts</span>
                      </>
                    )}

                    <div className="item-actions">
                      <button className="btn-layout-icon" title="Rename" onClick={e => { e.stopPropagation(); startEditLocation(idx); }}>
                        <img src={iconBtnEdit} alt="Edit" style={{ width: 16, height: 16 }} />
                      </button>
                      <button className="btn-layout-icon" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteLocation(idx); }}>
                        <img src={iconBtnDelete} alt="Delete" style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="layout-empty">No locations yet. Click '+' to add.</div>
              )}
            </div>
          </div>

          {/* Column 2: Measurement Point Card */}
          <div className="layout-card meapoint-card">
            <div className="layout-card-header">
              <span>
                <span className="card-title">Measurement Points</span>
                {selectedLocation && <span className="card-count">({meapoints.length})</span>}
              </span>
              {selectedLocation && (
                <button className="btn-layout-icon" title="Add Point" onClick={handleAddMeapoint} style={{ background: '#00AB84', borderRadius: '4px' }}>
                  <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 3V13" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><path d="M3 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>

            {selectedLocation ? (
              <>
                <div className="layout-context-bar">
                  <span>Location:</span>
                  <span className="ctx-label">{selectedLocation.location}</span>
                </div>

                <div className="layout-card-body">
                  {meapoints.length > 0 ? (
                    meapoints.map((mp, mpIdx) => (
                      <div
                        key={mpIdx}
                        className={`layout-list-item ${selectedMeapointIdx === mpIdx ? 'active' : ''}`}
                        onClick={() => { setSelectedMeapointIdx(mpIdx); setEditingMpIdx(null); }}
                      >
                        {editingMpIdx === mpIdx ? (
                          <input
                            className="layout-inline-input"
                            style={{ flex: 1, marginRight: 8 }}
                            value={editingMpName}
                            onChange={e => setEditingMpName(e.target.value)}
                            onBlur={confirmEditMeapoint}
                            onKeyDown={e => { if (e.key === 'Enter') confirmEditMeapoint(); if (e.key === 'Escape') setEditingMpIdx(null); }}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span className="item-name">{mp.meapoint}</span>
                            <span className="item-badge">{(mp.channels || []).length} ch</span>
                          </>
                        )}

                        <div className="item-actions">
                          <button className="btn-layout-icon" title="Rename" onClick={e => { e.stopPropagation(); startEditMeapoint(mpIdx); }}>
                            <img src={iconBtnEdit} alt="Edit" style={{ width: 16, height: 16 }} />
                          </button>
                          <button className="btn-layout-icon" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteMeapoint(mpIdx); }}>
                            <img src={iconBtnDelete} alt="Delete" style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="layout-empty">No measurement points. Click '+' to add.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="layout-card-body">
                <div className="layout-empty">Select a location to manage its measurement points.</div>
              </div>
            )}
          </div>

          {/* Column 3: Channel Card */}
          <div className="layout-card channel-card">
          <div className="layout-card-header">
            <span>
              <span className="card-title">Channels</span>
              {selectedMeapoint && <span className="card-count">({meapointChannelIds.length})</span>}
            </span>
            {selectedMeapoint && (
              <button className="btn-layout-action" onClick={() => setIsChannelModalOpen(true)}>
                Select Channels
              </button>
            )}
          </div>

          {selectedMeapoint ? (
            <>
              <div className="layout-context-bar">
                <span>Location:</span>
                <span className="ctx-label">{selectedLocation?.location}</span>
                <span className="ctx-separator">›</span>
                <span>Point:</span>
                <span className="ctx-label">{selectedMeapoint.meapoint}</span>
              </div>

              <div className="layout-card-body">
                {resolvedChannels.length > 0 ? (
                  <table className="layout-channel-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Sensor</th>
                        <th>Channel</th>
                        <th>Unit</th>
                        <th style={{ width: 80 }}>Operate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedChannels.map((ch, idx) => (
                        <tr key={ch.CreateTime || idx}>
                          <td>{idx + 1}</td>
                          <td>{ch.sensorName}</td>
                          <td>{ch.channelName}</td>
                          <td>{ch.unit}</td>
                          <td>
                            <button
                              className="btn-layout-icon"
                              title="Remove channel"
                              onClick={() => handleRemoveChannel(ch.CreateTime)}
                            >
                              <img src={iconBtnDelete} alt="Remove" style={{ width: 16, height: 16 }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="layout-empty">No channels assigned. Click "Select Channels" to add.</div>
                )}
              </div>
            </>
          ) : (
            <div className="layout-card-body">
              <div className="layout-empty">
                {selectedLocation
                  ? 'Select a measurement point to manage its channels.'
                  : 'Select a location and measurement point to manage channels.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Channel Select Modal */}
      <ChannelSelectModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        allChannels={allChannels}
        initialSelectedIds={meapointChannelIds.map(String)}
        onConfirm={handleChannelsConfirm}
        maxLimit={0}
        selectionMessage="Select channels for this measurement point."
        showOperate={false}
        title="Select channels for measurement point"
      />

      {/* Custom Dialog */}
      <CustomDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        body={dialogState.body}
        type={dialogState.type}
        showCancel={dialogState.showCancel}
      />
    </div>
  );
};

export default LayoutSetting;
