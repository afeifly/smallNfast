import { useState, useMemo, useCallback } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
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
  const { t } = useLanguage();

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

  // Pagination state
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

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
        // Find if this channel is assigned to any location / meapoint
        let chLocation = '';
        let chPoint = '';
        locationsArray.forEach(loc => {
          (loc.meapoints || []).forEach(mp => {
            if ((mp.channels || []).some(id => String(id) === String(ch.CreateTime))) {
              chLocation = loc.location;
              chPoint = mp.meapoint;
            }
          });
        });

        result.push({
          CreateTime: String(ch.CreateTime || ''),
          sensorName: sensor.Name || sensor.Description || 'Unknown Sensor',
          channelName: ch.ChannelDescription || 'Unknown Channel',
          unit: ch.UnitInASCII || '',
          location: chLocation,
          point: chPoint
        });
      });
    });
    return result;
  }, [sensors, locationsArray]);

  // Currently selected location inside the editor modal
  const selectedLocation = selectedLocationIdx !== null ? locationsArray[selectedLocationIdx] : null;

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

  // Helper to get resolved layout info from layout config (the single source of truth for card display/layout)
  const getMeapointLayoutInfo = useCallback((mp, locName) => {
    const layoutPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLayout.json'));
    const layoutList = configData?.configs?.[layoutPath]?.LayoutList || [];
    const match = layoutList.find(item => {
      const itemLoc = (item.location || '').trim().toLowerCase();
      const mpLoc = (locName || '').trim().toLowerCase();
      const itemMp = (item.meapoint || item.measurepoint || '').trim().toLowerCase();
      const mpName = (mp.meapoint || '').trim().toLowerCase();
      return itemLoc === mpLoc && itemMp === mpName;
    });
    return {
      is2Height: match ? !!match.is2Height : false,
      index: match && typeof match.index === 'number' ? match.index : null
    };
  }, [configData]);

  // Helper to get resolved is2Height from layout config (the single source of truth for card display heights)
  const getMeapointIs2Height = useCallback((mp, locName) => {
    return getMeapointLayoutInfo(mp, locName).is2Height;
  }, [getMeapointLayoutInfo]);

  // Helper to get next available unique index for new meapoints
  const getNextMeapointIndex = useCallback(() => {
    let maxIdx = -1;
    locationsArray.forEach(loc => {
      (loc.meapoints || []).forEach(mp => {
        if (typeof mp.index === 'number' && mp.index > maxIdx) {
          maxIdx = mp.index;
        }
      });
    });
    const layoutPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLayout.json'));
    const layoutList = configData?.configs?.[layoutPath]?.LayoutList || [];
    layoutList.forEach(item => {
      if (typeof item.index === 'number' && item.index > maxIdx) {
        maxIdx = item.index;
      }
    });
    return maxIdx + 1;
  }, [locationsArray, configData]);

  // Sort meapoints inside the editor modal by layout index while keeping original list index reference
  const meapoints = useMemo(() => {
    if (!selectedLocation) return [];
    const rawMps = selectedLocation.meapoints || [];
    const mapped = rawMps.map((mp, originalIdx) => ({
      ...mp,
      originalIdx
    }));
    return mapped.sort((a, b) => {
      const infoA = getMeapointLayoutInfo(a, selectedLocation.location);
      const infoB = getMeapointLayoutInfo(b, selectedLocation.location);
      const idxA = infoA.index !== null ? infoA.index : (typeof a.index === 'number' ? a.index : 0);
      const idxB = infoB.index !== null ? infoB.index : (typeof b.index === 'number' ? b.index : 0);
      return idxA - idxB;
    });
  }, [selectedLocation, getMeapointLayoutInfo]);

  // Currently selected meapoint & its channels inside the editor modal
  const selectedMeapoint = selectedMeapointIdx !== null ? (selectedLocation?.meapoints || [])[selectedMeapointIdx] : null;
  const meapointChannelIds = selectedMeapoint?.channels || [];

  // Resolve channel IDs to channel info
  const resolvedChannels = useMemo(() => {
    return meapointChannelIds.map(id => {
      const ch = allChannels.find(c => c.CreateTime === String(id));
      return ch || { CreateTime: String(id), sensorName: '---', channelName: `Unknown (${id})`, unit: '---' };
    });
  }, [meapointChannelIds, allChannels]);

  // Channels assigned to any other measurement point in any location
  const blockedChannelIds = useMemo(() => {
    const ids = new Set();
    locationsArray.forEach((loc, lIdx) => {
      (loc.meapoints || []).forEach((mp, mIdx) => {
        // Skip the currently selected measurement point
        if (lIdx === selectedLocationIdx && mIdx === selectedMeapointIdx) {
          return;
        }
        (mp.channels || []).forEach(chId => {
          ids.add(String(chId));
        });
      });
    });
    return Array.from(ids);
  }, [locationsArray, selectedLocationIdx, selectedMeapointIdx]);

  // Derive dashboard cards list (Location / Point -> Channels)
  const cards = useMemo(() => {
    const list = [];
    let fallbackIdx = 0;
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
        const layoutInfo = getMeapointLayoutInfo(mp, loc.location);
        let cardIdx = layoutInfo.index;
        if (cardIdx === null || cardIdx === undefined) {
          cardIdx = typeof mp.index === 'number' ? mp.index : fallbackIdx++;
        }
        list.push({
          title,
          items,
          index: cardIdx,
          is2Height: layoutInfo.is2Height
        });
      });
    });
    return list;
  }, [locationsArray, findChannelInfo, getMeapointLayoutInfo]);

  // Sort and paginate cards preview
  const paginatedPages = useMemo(() => {
    // Sort cards by index ascending
    const sortedCards = [...cards].sort((a, b) => a.index - b.index);

    // Pagination algorithm preferring vertical (column-first) placement without backfilling
    const pages = [];
    let currentPageItems = [];
    let col = 0;
    let row = 0;

    sortedCards.forEach(card => {
      if (card.is2Height) {
        if (row === 1) {
          col += 1;
          row = 0;
        }
        if (col >= 3) {
          pages.push(currentPageItems);
          currentPageItems = [];
          col = 0;
          row = 0;
        }
        currentPageItems.push({ card, col, row, span: 2 });
        col += 1;
        row = 0;
      } else {
        if (col >= 3) {
          pages.push(currentPageItems);
          currentPageItems = [];
          col = 0;
          row = 0;
        }
        currentPageItems.push({ card, col, row, span: 1 });
        if (row === 0) {
          row = 1;
        } else {
          col += 1;
          row = 0;
        }
      }
    });

    if (currentPageItems.length > 0) {
      pages.push(currentPageItems);
    }

    // Fill empty slots with placeholders for all pages
    return pages.map(pageItems => {
      const grid = [
        [false, false, false],
        [false, false, false]
      ];
      pageItems.forEach(({ col, row, span }) => {
        grid[row][col] = true;
        if (span === 2) {
          grid[row + 1][col] = true;
        }
      });

      const finalItems = [...pageItems];
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 2; r++) {
          if (!grid[r][c]) {
            finalItems.push({
              card: { isPlaceholder: true },
              col: c,
              row: r,
              span: 1
            });
            grid[r][c] = true;
          }
        }
      }
      return finalItems;
    });
  }, [cards]);

  const totalPages = paginatedPages.length > 0 ? paginatedPages.length : 1;
  const activePageIndex = Math.min(currentPageIndex, totalPages - 1);
  const activePageItems = paginatedPages[activePageIndex] || [];

  // ── Persist helper ───────────────────────────────────────────────────────
  const persistLocations = useCallback((newLocations) => {
    // Generate synchronized flat LayoutList for cfgLayout.json
    const layoutList = [];
    let fallbackIdx = 0;

    const updatedLocations = newLocations.map(loc => {
      const updatedMps = (loc.meapoints || []).map(mp => {
        let is2Height = mp.is2Height;
        if (is2Height === undefined) {
          is2Height = getMeapointIs2Height(mp, loc.location);
        } else {
          is2Height = !!is2Height;
        }

        const layoutInfo = getMeapointLayoutInfo(mp, loc.location);
        let savedIndex = layoutInfo.index;
        if (savedIndex === null || savedIndex === undefined) {
          savedIndex = typeof mp.index === 'number' ? mp.index : fallbackIdx++;
        }

        layoutList.push({
          location: loc.location,
          meapoint: mp.meapoint,
          measurepoint: mp.meapoint,
          index: savedIndex,
          is2Height,
          channels: mp.channels || []
        });

        return {
          ...mp,
          index: savedIndex,
          is2Height
        };
      });

      return {
        ...loc,
        meapoints: updatedMps
      };
    });

    const locPath = locationPath || 'config/cfgLocation.json';
    const layoutPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('cfgLayout.json')) || 'config/cfgLayout.json';

    setConfigData({
      ...configData,
      configs: {
        ...configData?.configs,
        [locPath]: {
          ...configData?.configs?.[locPath],
          Locations: updatedLocations
        },
        [layoutPath]: {
          ...configData?.configs?.[layoutPath],
          LayoutList: layoutList
        }
      }
    });
  }, [configData, setConfigData, locationPath, getMeapointIs2Height, getMeapointLayoutInfo]);

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
      isOpen: true, 
      title: t({ en: 'Delete Location', de: 'Standort löschen', cn: '删除位置' }),
      body: t({ 
        en: `Delete location "${loc.location}" and all its measurement points?`, 
        de: `Standort "${loc.location}" und alle zugehörigen Messpunkte löschen?`, 
        cn: `确定删除位置 "${loc.location}" 及其所有测量点吗？` 
      }), 
      type: 'warn',
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
        isOpen: true, 
        title: t({ en: 'Duplicate Location', de: 'Standort duplizieren', cn: '位置重复' }),
        body: t({ 
          en: `Location "${name}" already exists.`, 
          de: `Standort "${name}" existiert bereits.`, 
          cn: `位置 "${name}" 已存在。` 
        }), 
        type: 'err',
        showCancel: false, 
        onConfirm: closeDialog
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
      index: getNextMeapointIndex(),
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
    const mp = (selectedLocation?.meapoints || [])[mpIdx];
    if (!mp) return;
    setDialogState({
      isOpen: true, 
      title: t({ en: 'Delete Measurement Point', de: 'Messpunkt löschen', cn: '删除测量点' }),
      body: t({ 
        en: `Delete measurement point "${mp.meapoint}" and unlink its channels?`, 
        de: `Messpunkt "${mp.meapoint}" löschen und Kanäle entkoppeln?`, 
        cn: `确定删除测量点 "${mp.meapoint}" 并取消其通道关联吗？` 
      }), 
      type: 'warn',
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
    const mp = (selectedLocation?.meapoints || [])[mpIdx];
    setEditingMpName(mp ? mp.meapoint : '');
  };

  const confirmEditMeapoint = () => {
    const name = editingMpName.trim();
    if (!name) { setEditingMpIdx(null); return; }
    const dup = (selectedLocation?.meapoints || []).some((mp, i) => mp.meapoint === name && i !== editingMpIdx);
    if (dup) {
      setDialogState({
        isOpen: true, 
        title: t({ en: 'Duplicate Point', de: 'Messpunkt duplizieren', cn: '测量点重复' }),
        body: t({ 
          en: `Measurement point "${name}" already exists.`, 
          de: `Messpunkt "${name}" existiert bereits.`, 
          cn: `测量点 "${name}" 已存在。` 
        }), 
        type: 'err',
        showCancel: false, 
        onConfirm: closeDialog
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

  const handleToggleMeapointHeight = (mpIdx) => {
    if (selectedLocationIdx === null) return;
    const loc = locationsArray[selectedLocationIdx];
    const updatedLocs = locationsArray.map((l, i) => {
      if (i !== selectedLocationIdx) return l;
      return {
        ...l,
        meapoints: (l.meapoints || []).map((mp, mi) => {
          if (mi !== mpIdx) return mp;
          const currentVal = getMeapointIs2Height(mp, loc.location);
          return { ...mp, is2Height: !currentVal };
        })
      };
    });
    persistLocations(updatedLocs);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="content-card layout-setting-page">

      {/* Header */}
      <header className="layout-header">
        <div>
          <h2>{t({ en: 'Layout setting', de: 'Layout-Einstellung', cn: '布局设置' })}</h2>
          <p>{t({ en: 'Manage locations, measurement points, and channel assignments.', de: 'Verwalten Sie Standorte, Messpunkte und Kanalzuweisungen.', cn: '管理位置、测量点和通道分配。' })}</p>
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
          {t({ en: 'Edit Layout', de: 'Layout bearbeiten', cn: '编辑布局' })}
        </button>
      </header>

      {/* Main Content: Card Grid */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', background: '#F8F9FA', overflowY: 'auto', boxSizing: 'border-box' }}>
        {cards.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: 'fit-content', flex: 1 }}>
            {/* Grid Panel */}
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 368px)',
              gridTemplateRows: 'repeat(2, minmax(184px, 1fr))',
              gap: '16px',
              padding: '16px 0',
              justifyContent: 'flex-start',
              alignContent: 'stretch'
            }}>
              {activePageItems.map((itemObj) => {
                const { card, col, row, span } = itemObj;
                const gridStyle = {
                  gridColumn: col + 1,
                  gridRow: `${row + 1} / span ${span}`
                };
                return card.isPlaceholder ? (
                  <div key={`empty-${col}-${row}`} style={gridStyle}>
                    <div style={{ width: 368, height: '100%', background: '#F8F9FA', border: '1px dashed #E5E6EB', borderRadius: 6 }} />
                  </div>
                ) : (
                  <div key={`card-${col}-${row}`} style={{ ...gridStyle, height: '100%' }}>
                    <OnlineValueCard
                       title={card.title}
                       items={card.items}
                       style={{ height: '100%' }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Footer Navigation */}
            <footer style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              padding: '16px 0',
              marginTop: 'auto',
              flexShrink: 0
            }}>
              <button
                onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                disabled={activePageIndex === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: activePageIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: activePageIndex === 0 ? 0.3 : 0.8,
                  color: '#1D2129',
                  padding: '4px'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#4E5969',
                fontFamily: 'PingFang SC, sans-serif'
              }}>
                {activePageIndex + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPageIndex(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={activePageIndex === totalPages - 1}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: activePageIndex === totalPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: activePageIndex === totalPages - 1 ? 0.3 : 0.8,
                  color: '#1D2129',
                  padding: '4px'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </footer>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <img src={iconAlertBig} alt="Alert" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            <span style={{ fontSize: 16, fontWeight: '700', color: '#4E5969' }}>
              {t({
                en: 'No layouts configured yet. Click "Edit Layout" in the top right to start.',
                de: 'Noch keine Layouts konfiguriert. Klicken Sie oben rechts auf "Layout bearbeiten", um zu beginnen.',
                cn: '尚未配置布局。点击右上角的“编辑布局”开始。'
              })}
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
              <div className="config-title">{t({ en: 'Layout Configuration Detail', de: 'Layout-Konfigurationsdetails', cn: '布局配置详情' })}</div>
              <div className="close-btn" onClick={() => setIsEditingLayout(false)}>
                <img src={iconBtnClose} alt={t({ en: 'Close', de: 'Schließen', cn: '关闭' })} style={{ width: 32, height: 32 }} />
              </div>
            </header>

            {/* Modal Content: 3 columns */}
            <div className="config-content" style={{ flex: 1, overflow: 'hidden', padding: '20px 24px', display: 'flex', gap: '20px', background: '#FAFBFC' }}>
              
              {/* Column 1: Locations */}
              <div className="layout-card location-card" style={{ background: 'white' }}>
                <div className="layout-card-header">
                  <span>
                    <span className="card-title">{t({ en: 'Locations', de: 'Standorte', cn: '位置' })}</span>
                    <span className="card-count">({locationsArray.length})</span>
                  </span>
                  <button className="btn-layout-icon" title={t({ en: 'Add Location', de: 'Standort hinzufügen', cn: '添加位置' })} onClick={handleAddLocation} style={{ background: '#00AB84', borderRadius: '4px' }}>
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
                            <span className="item-badge">{(loc.meapoints || []).length} {t({ en: 'pts', de: 'Pkte', cn: '个点' })}</span>
                          </>
                        )}

                        <div className="item-actions">
                          <button className="btn-layout-icon" title={t({ en: 'Rename', de: 'Umbenennen', cn: '重命名' })} onClick={e => { e.stopPropagation(); startEditLocation(idx); }}>
                            <img src={iconBtnEdit} alt={t({ en: 'Edit', de: 'Bearbeiten', cn: '编辑' })} style={{ width: 16, height: 16 }} />
                          </button>
                          <button className="btn-layout-icon" title={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} onClick={e => { e.stopPropagation(); handleDeleteLocation(idx); }}>
                            <img src={iconBtnDelete} alt={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="layout-empty">{t({ en: "No locations yet. Click '+' to add.", de: "Noch keine Standorte. Klicken Sie auf '+', um welche hinzuzufügen.", cn: "暂无位置。点击 '+' 添加。" })}</div>
                  )}
                </div>
              </div>

              {/* Column 2: Measurement Points */}
              <div className="layout-card meapoint-card" style={{ background: 'white' }}>
                <div className="layout-card-header">
                  <span>
                    <span className="card-title">{t({ en: 'Measurement Points', de: 'Messpunkte', cn: '测量点' })}</span>
                    {selectedLocation && <span className="card-count">({meapoints.length})</span>}
                  </span>
                  {selectedLocation && (
                    <button className="btn-layout-icon" title={t({ en: 'Add Point', de: 'Messpunkt hinzufügen', cn: '添加测量点' })} onClick={handleAddMeapoint} style={{ background: '#00AB84', borderRadius: '4px' }}>
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
                      <span>{t({ en: 'Location:', de: 'Standort:', cn: '位置:' })}</span>
                      <span className="ctx-label">{selectedLocation.location}</span>
                    </div>

                    <div className="layout-card-body">
                      {meapoints.length > 0 ? (
                        meapoints.map((mp) => (
                          <div
                            key={mp.originalIdx}
                            className={`layout-list-item ${selectedMeapointIdx === mp.originalIdx ? 'active' : ''}`}
                            onClick={() => { setSelectedMeapointIdx(mp.originalIdx); setEditingMpIdx(null); }}
                          >
                            {editingMpIdx === mp.originalIdx ? (
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
                                <span className="item-badge" style={{ marginRight: '8px' }}>{(mp.channels || []).length} {t({ en: 'ch', de: 'Ch', cn: '通道' })}</span>
                              </>
                            )}

                            <div className="item-actions">
                              <button className="btn-layout-icon" title={t({ en: 'Rename', de: 'Umbenennen', cn: '重命名' })} onClick={e => { e.stopPropagation(); startEditMeapoint(mp.originalIdx); }}>
                                <img src={iconBtnEdit} alt={t({ en: 'Edit', de: 'Bearbeiten', cn: '编辑' })} style={{ width: 16, height: 16 }} />
                              </button>
                              <button className="btn-layout-icon" title={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} onClick={e => { e.stopPropagation(); handleDeleteMeapoint(mp.originalIdx); }}>
                                <img src={iconBtnDelete} alt={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} style={{ width: 16, height: 16 }} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="layout-empty">{t({ en: "No measurement points. Click '+' to add.", de: "Keine Messpunkte. Klicken Sie auf '+', um welche hinzuzufügen.", cn: "暂无测量点。点击 '+' 添加。" })}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="layout-card-body">
                    <div className="layout-empty">{t({ en: 'Select a location to manage its measurement points.', de: 'Wählen Sie einen Standort aus, um seine Messpunkte zu verwalten.', cn: '选择一个位置以管理其测量点。' })}</div>
                  </div>
                )}
              </div>

              {/* Column 3: Channels */}
              <div className="layout-card channel-card" style={{ background: 'white' }}>
                <div className="layout-card-header">
                  <span>
                    <span className="card-title">{t({ en: 'Channels', de: 'Kanäle', cn: '通道' })}</span>
                    {selectedMeapoint && <span className="card-count">({meapointChannelIds.length})</span>}
                  </span>
                  {selectedMeapoint && (
                    <button className="btn-layout-action" onClick={() => setIsChannelModalOpen(true)}>
                      {t({ en: 'Select Channels', de: 'Kanäle auswählen', cn: '选择通道' })}
                    </button>
                  )}
                </div>

                {selectedMeapoint ? (
                  <>
                    <div className="layout-context-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{t({ en: 'Location:', de: 'Standort:', cn: '位置:' })}</span>
                        <span className="ctx-label">{selectedLocation?.location}</span>
                        <span className="ctx-separator">›</span>
                        <span>{t({ en: 'Point:', de: 'Messpunkt:', cn: '测量点:' })}</span>
                        <span className="ctx-label">{selectedMeapoint.meapoint}</span>
                      </div>

                      <label
                        onClick={() => handleToggleMeapointHeight(selectedMeapointIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          margin: 0,
                          padding: 0
                        }}
                      >
                        <span style={{
                          position: 'relative',
                          width: '16px',
                          height: '16px',
                          borderRadius: '3px',
                          border: '1.5px solid ' + (getMeapointIs2Height(selectedMeapoint, selectedLocation.location) ? '#00AB84' : '#D9D9D9'),
                          background: getMeapointIs2Height(selectedMeapoint, selectedLocation.location) ? '#00AB84' : '#FFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          boxSizing: 'border-box',
                          flexShrink: 0
                        }}>
                          {getMeapointIs2Height(selectedMeapoint, selectedLocation.location) && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#1D2129' }}>
                            {t({ en: '2x Height Card', de: 'Doppelt hohe Karte', cn: '双倍高度卡片' })}
                          </span>
                          <span style={{ fontSize: '9px', color: '#86909C' }}>
                            {t({ en: 'Takes 2 rows in dashboard', de: 'Belegt 2 Zeilen im Dashboard', cn: '在仪表盘中占用 2 行' })}
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="layout-card-body">
                      {resolvedChannels.length > 0 ? (
                        <table className="layout-channel-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              <th>{t({ en: 'Sensor', de: 'Sensor', cn: '传感器' })}</th>
                              <th>{t({ en: 'Channel', de: 'Kanal', cn: '通道' })}</th>
                              <th>{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</th>
                              <th style={{ width: 80 }}>{t({ en: 'Operate', de: 'Aktion', cn: '操作' })}</th>
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
                                    title={t({ en: 'Remove channel', de: 'Kanal entfernen', cn: '移除通道' })}
                                    onClick={() => handleRemoveChannel(ch.CreateTime)}
                                  >
                                    <img src={iconBtnDelete} alt={t({ en: 'Remove', de: 'Entfernen', cn: '移除' })} style={{ width: 16, height: 16 }} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="layout-empty">{t({ en: 'No channels assigned. Click "Select Channels" to add.', de: 'Keine Kanäle zugewiesen. Klicken Sie auf "Kanäle auswählen", um welche hinzuzufügen.', cn: '未分配通道。点击“选择通道”进行添加。' })}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="layout-card-body">
                    <div className="layout-empty">
                      {selectedLocation
                        ? t({ en: 'Select a measurement point to manage its channels.', de: 'Wählen Sie einen Messpunkt aus, um seine Kanäle zu verwalten.', cn: '选择一个测量点以管理其通道。' })
                        : t({ en: 'Select a location and measurement point to manage channels.', de: 'Wählen Sie einen Standort und einen Messpunkt aus, um Kanäle zu verwalten.', cn: '选择位置和测量点以管理通道。' })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <footer className="config-footer">
              <button className="btn-confirm" onClick={() => setIsEditingLayout(false)}>{t({ en: 'Done', de: 'Fertig', cn: '完成' })}</button>
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
        blockedSelectedIds={blockedChannelIds}
        onConfirm={handleChannelsConfirm}
        maxLimit={0}
        selectionMessage={t({ en: 'Select channels for this measurement point.', de: 'Wählen Sie Kanäle für diesen Messpunkt aus.', cn: '为此测量点选择通道。' })}
        showOperate={false}
        title={t({ en: 'Select channels for measurement point', de: 'Kanäle für Messpunkt auswählen', cn: '为测量点选择通道' })}
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
