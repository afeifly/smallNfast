import React, { useState, useMemo, useCallback } from 'react';
import { useConfig } from '../../context/ConfigContext';
import CustomDialog from '../../components/CustomDialog';
import ChannelSelectModal from '../../components/ChannelSelectModal';
import OnlineValueCard from '../../components/OnlineValueCard';
import iconBtnEdit from '../../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../../assets/images/icon_btn_delete.png';
import iconBtnClose from '../../assets/images/icon_btn_close.png';
import iconAlertBig from '../../assets/images/icon_alert_big.png';
import './LayoutSetting.css';
import './SensorConfigModal.css';

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

  // Dialog and Modal open states
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Selection states inside the editor dialog
  const [selectedLocationIdx, setSelectedLocationIdx] = useState(null);
  const [selectedMeapointIdx, setSelectedMeapointIdx] = useState(null);

  // Rename states inside the editor dialog
  const [editingLocIdx, setEditingLocIdx] = useState(null);
  const [editingLocName, setEditingLocName] = useState('');
  const [editingMpIdx, setEditingMpIdx] = useState(null);
  const [editingMpName, setEditingMpName] = useState('');

  // Confirmation dialog state
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

  // Currently selected location & meapoints inside the editor modal
  const selectedLocation = selectedLocationIdx !== null ? locationsArray[selectedLocationIdx] : null;
  const meapoints = selectedLocation?.meapoints || [];

  // Currently selected meapoint & its channels inside the editor modal
  const selectedMeapoint = selectedMeapointIdx !== null ? meapoints[selectedMeapointIdx] : null;
  const meapointChannelIds = selectedMeapoint?.channels || [];

  // Resolve channel IDs to channel info
  const resolvedChannels = useMemo(() => {
    return meapointChannelIds.map(id => {
      const ch = allChannels.find(c => c.CreateTime === String(id));
      return ch || { CreateTime: String(id), sensorName: '---', channelName: `Unknown (${id})`, unit: '---' };
    });
  }, [meapointChannelIds, allChannels]);

  // Helper to find channel info by UID (matching CreateTime) across all sensors for the dashboard cards
  const findChannelInfo = useCallback((uid) => {
    for (const sensor of sensors) {
      if (!sensor.cfgchannel) continue;
      const channel = sensor.cfgchannel.find(ch => String(ch.CreateTime) === String(uid));
      if (channel) return {
        channelName: channel.ChannelDescription || `CH ${uid}`,
        unit: channel.UnitInASCII || ''
      };
    }
    return null;
  }, [sensors]);

  // Derive dashboard cards list (Location / Point -> Channels)
  const cards = useMemo(() => {
    const list = [];
    locationsArray.forEach(loc => {
      (loc.meapoints || []).forEach(mp => {
        const title = `${loc.location} / ${mp.meapoint}`;
        const items = (mp.channels || []).map(uid => {
          const info = findChannelInfo(uid);
          return {
            label: info ? info.channelName : `CH ${uid}`,
            value: '---',
            unit: info ? info.unit : ''
          };
        });
        list.push({ title, items });
      });
    });
    return list;
  }, [locationsArray, findChannelInfo]);

  // ── Persist helper ───────────────────────────────────────────────────────
  const persistLocations = useCallback((newLocations) => {
    if (!locationPath) {
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
      const updatedMps = (l.meapoints || []).map(mp => ({ ...mp, location: name }));
      return { ...l, location: name, meapoints: updatedMps };
    });
    persistLocations(updated);
    setEditingLocIdx(null);
  };

  // ── Measurement Point CRUD ───────────────────────────────────────────────
  const handleAddMeapoint = () => {
    if (selectedLocationIdx === null) return;
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
        <button
          className="btn-layout-action"
          onClick={() => {
            // Pre-select first location when opening editor
            if (locationsArray.length > 0) {
              setSelectedLocationIdx(0);
              setSelectedMeapointIdx(null);
            }
            setIsEditingLayout(true);
          }}
          style={{
            background: '#00AB84',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          Edit Layout
        </button>
      </header>

      {/* Main Content: Card Grid (Like Home.jsx but no Empty placeholders) */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#F8F9FA' }}>
        {cards.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 368px)', gap: '16px', justifyContent: 'flex-start' }}>
            {cards.map((card, i) => (
              <OnlineValueCard
                key={i}
                title={card.title}
                items={card.items}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <img src={iconAlertBig} alt="Alert" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            <span style={{ fontSize: 16, fontWeight: '700', color: '#4E5969' }}>
              No layouts configured yet. Click "Edit Layout" in the top right to start.
            </span>
          </div>
        )}
      </div>

      {/* Immersive Overlay Editor Modal */}
      {isEditingLayout && (
        <div className="modal-overlay">
          <div className="config-modal" style={{ width: 1200, maxWidth: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Modal Header */}
            <header className="config-header">
              <div className="config-title">Layout Configuration Detail</div>
              <div className="close-btn" onClick={() => setIsEditingLayout(false)}>
                <img src={iconBtnClose} alt="Close" style={{ width: 32, height: 32 }} />
              </div>
            </header>

            {/* Modal Content: 3 columns */}
            <div className="config-content" style={{ flex: 1, overflow: 'hidden', padding: '20px 24px', display: 'flex', gap: '20px', background: '#FAFBFC' }}>
              
              {/* Column 1: Locations */}
              <div className="layout-card location-card" style={{ background: 'white' }}>
                <div className="layout-card-header">
                  <span>
                    <span className="card-title">Locations</span>
                    <span className="card-count">({locationsArray.length})</span>
                  </span>
                  <button className="btn-layout-icon" title="Add Location" onClick={handleAddLocation} style={{ background: '#00AB84', borderRadius: '4px' }}>
                    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                      <path d="M8 3V13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M3 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
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

              {/* Column 2: Measurement Points */}
              <div className="layout-card meapoint-card" style={{ background: 'white' }}>
                <div className="layout-card-header">
                  <span>
                    <span className="card-title">Measurement Points</span>
                    {selectedLocation && <span className="card-count">({meapoints.length})</span>}
                  </span>
                  {selectedLocation && (
                    <button className="btn-layout-icon" title="Add Point" onClick={handleAddMeapoint} style={{ background: '#00AB84', borderRadius: '4px' }}>
                      <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                        <path d="M8 3V13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M3 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
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

              {/* Column 3: Channels */}
              <div className="layout-card channel-card" style={{ background: 'white' }}>
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

            {/* Modal Footer */}
            <footer className="config-footer">
              <button className="btn-confirm" onClick={() => setIsEditingLayout(false)}>Done</button>
            </footer>

          </div>
        </div>
      )}

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
