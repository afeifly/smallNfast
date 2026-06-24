import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useLanguage } from '../context/LanguageContext';
import { saveOneFileMap } from '../util/fileMapStorage';
import ChannelSelectModal from '../components/ChannelSelectModal';
import CustomDialog from '../components/CustomDialog';
import {
  openAlarmDb,
  readAlarmConfigs,
  insertAlarmConfig,
  updateAlarmConfig,
  deleteAlarmConfig,
  flushAlarmDb,
  ensureSensorExists,
  ensureChannelExists,
} from '../util/alarmDbUtils';
import iconBtnDelete from '../assets/images/icon_btn_delete.png';
import './sensorconfiguration/SUTOSensor.css';

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: map a raw alarm_config DB row → React state alarm object
   ───────────────────────────────────────────────────────────────────────────── */
function rowToAlarm(row) {
  return {
    config_id: row.config_id,
    sensor_identify_id: row.sensor_identify_id,
    channel_identify_id: row.channel_identify_id,
    Sensor: row.sensorName || row.sensor_identify_id || '---',
    Channel: row.channelName || row.channel_identify_id || '---',
    Unit: row.channelUnit || '---',
    MeasurementPoint: row.measurement_point ?? '',
    Location: row.location ?? '',
    Threshold: String(row.threshold ?? 0),
    Hysteresis: String(row.hysteresis ?? 0),
    Direction: (row.direction ?? 'up').toLowerCase() === 'up' ? 'UP' : 'Down',
    Delay: String(row.delay ?? 0),
    RelayId: String(row.relay_id ?? 0),
    RelayFlag: Number(row.relay_flag ?? 1),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Debug helper: dump the full alarm_config table to the browser console.
   Call this after every operation that touches the DB.
   ───────────────────────────────────────────────────────────────────────────── */
function logAlarmTable(db, label) {
  if (!db) {
    console.warn('[Alarm.db] logAlarmTable called but db is null');
    return;
  }
  try {
    const stmt = db.prepare('SELECT * FROM alarm_config ORDER BY config_id ASC');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    console.groupCollapsed(`[Alarm.db] ${label} — alarm_config (${rows.length} rows)`);
    console.table(rows);
    console.groupEnd();
  } catch (e) {
    console.error('[Alarm.db] logAlarmTable error:', e);
  }
}

const Alarm = () => {
  const { t } = useLanguage();
  const { configData, setConfigData, activeConfigId } = useConfig();

  /* ── DB handle (kept in a ref so it survives re-renders) ── */
  const dbRef = useRef(null);   // sql.js Database instance
  const dbKey = useRef(null);   // fileMap key for Alarm.db

  /* ── UI state ── */
  const [alarms, setAlarms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'no-db' | 'error'
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    body: '',
    type: 'warn',
  });

  const showAlertDialog = (title, body, type = 'warn') => {
    setDialogState({
      isOpen: true,
      title,
      body,
      type,
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Open / reload Alarm.db whenever configData changes (new cfgf loaded)
     ───────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Close any previously opened DB
      if (dbRef.current) {
        try { dbRef.current.close(); } catch (_) { }
        dbRef.current = null;
        dbKey.current = null;
      }

      const fileMap = configData?.fileMap;
      if (!fileMap) {
        console.log('[Alarm.jsx] load: no fileMap present in configData');
        setDbStatus('idle');
        setAlarms([]);
        return;
      }

      setDbStatus('loading');
      try {
        console.log('[Alarm.jsx] load: opening Alarm.db, fileMap keys:', Array.from(fileMap.keys()));
        const result = await openAlarmDb(fileMap);
        if (cancelled) {
          console.log('[Alarm.jsx] load: cancelled');
          return;
        }

        if (!result) {
          console.warn('[Alarm.jsx] load: openAlarmDb returned null (Alarm.db not found)');
          setDbStatus('no-db');
          setAlarms([]);
          return;
        }

        dbRef.current = result.db;
        dbKey.current = result.key;

        const rows = readAlarmConfigs(result.db);
        console.log('[Alarm.jsx] load: Alarm.db ready, loaded alarms row count:', rows.length);
        setAlarms(rows.map(rowToAlarm));
        setDbStatus('ready');
        logAlarmTable(result.db, 'LOAD — Alarm.db opened');
      } catch (err) {
        if (cancelled) return;
        console.error('[Alarm] Failed to open Alarm.db:', err);
        setDbStatus('error');
        setAlarms([]);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [configData?.fileMap]);

  /* ─────────────────────────────────────────────────────────────────────────
     Flush DB bytes back into the fileMap and persist to context
     ───────────────────────────────────────────────────────────────────────── */
  const persistDb = useCallback(() => {
    if (!dbRef.current || !dbKey.current || !configData?.fileMap) return;
    flushAlarmDb(dbRef.current, dbKey.current, configData.fileMap);
    // Save updated Alarm.db bytes directly to IndexedDB (fire-and-forget).
    // We do this here because flushAlarmDb mutates fileMap in-place — the Map
    // reference stays the same so the persist useEffect won't detect the change.
    if (activeConfigId) {
      console.log('[Alarm.jsx] persistDb: Saving updated alarm fileMap to IndexedDB for ID:', activeConfigId);
      saveOneFileMap(activeConfigId, configData.fileMap).catch(e =>
        console.error('[Alarm.jsx] persistDb: Failed to save fileMap:', e)
      );
    }
    // Also trigger ConfigContext update so export captures the changes
    setConfigData(prev => ({ ...prev }));
  }, [configData, setConfigData, activeConfigId]);

  /* ─────────────────────────────────────────────────────────────────────────
     Build channel list for the selection modal from the sensor list JSON
     ───────────────────────────────────────────────────────────────────────── */
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  );

  const allChannelsForSelection = [];
  sensors.forEach(sensor => {
    (sensor.cfgchannel || []).forEach((ch) => {
      // ch.CreateTime is the channel_identify_id stored in Alarm.db
      // sensor.CreateTime is the sensor_identify_id stored in Alarm.db
      const channelId = String(ch.CreateTime || '');
      const sensorId = String(sensor.CreateTime || '');
      allChannelsForSelection.push({
        CreateTime: channelId,          // used by ChannelSelectModal as row key
        sensorName: sensor.Name || sensor.Description || sensorId,
        sensorId: sensorId,
        sensorDbId: sensor.SensorID || 0,
        channelName: ch.ChannelDescription,
        channelId: channelId,
        channelDbId: ch.ChannelId || 0,
        unit: ch.UnitInASCII || '---',
      });
    });
  });

  // channel_identify_id in DB === CreateTime (used as row key in modal)
  const currentlySelectedIds = alarms.map(a => String(a.channel_identify_id));

  /* ─────────────────────────────────────────────────────────────────────────
     When the user confirms channel selection → INSERT into DB
     ───────────────────────────────────────────────────────────────────────── */
  const handleConfirmSelection = (selectedIds) => {
    if (!dbRef.current) return;

    const newChannels = allChannelsForSelection.filter(ch =>
      selectedIds.includes(ch.CreateTime) &&
      !currentlySelectedIds.includes(ch.channelId)
    );

    const newAlarms = [];
    try {
      for (const ch of newChannels) {
        // Ensure sensor + channel rows exist in DB so the JOIN in
        // readAlarmConfigs always resolves human-readable names & units.
        ensureSensorExists(dbRef.current, ch.sensorId, ch.sensorName, ch.sensorDbId);
        ensureChannelExists(dbRef.current, ch.channelId, ch.sensorId, ch.channelName, ch.unit);

        const newId = insertAlarmConfig(dbRef.current, {
          sensor_identify_id: ch.sensorId,
          channel_identify_id: ch.channelId,
          measurement_point: '',
          location: '',
          threshold: 0,
          hysteresis: 0,
          direction: 'up',
          delay: 0,
          relay_id: 0,
          relay_flag: 0,
        });

        newAlarms.push({
          config_id: newId,
          sensor_identify_id: ch.sensorId,
          channel_identify_id: ch.channelId,
          Sensor: ch.sensorName,
          Channel: ch.channelName,
          Unit: ch.unit,
          MeasurementPoint: '',
          Location: '',
          Threshold: '0',
          Hysteresis: '0',
          Direction: 'UP',
          Delay: '0',
          RelayId: '0',
          RelayFlag: 0,
        });
      }
    } catch (err) {
      console.error('[Alarm.jsx] Failed to insert new alarm(s):', err);
      showAlertDialog(
        t({ en: 'Create Alarm Failed', de: 'Alarmerstellung fehlgeschlagen', cn: '创建报警失败' }),
        `${t({ en: 'Failed to create alarm', de: 'Fehler beim Erstellen des Alarms', cn: '创建报警失败' })}: ${err.message || err}`,
        'err'
      );
      return;
    }

    logAlarmTable(dbRef.current, `ADD ALARM — inserted ${newAlarms.length} row(s)`);
    persistDb();
    setAlarms(prev => [...prev, ...newAlarms]);
    setIsModalOpen(false);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Inline field update → UPDATE in DB + reflect in state
     ───────────────────────────────────────────────────────────────────────── */

  // DB column name lookup (React field name → SQLite column name)
  const DB_FIELD_MAP = {
    Threshold: 'threshold',
    Hysteresis: 'hysteresis',
    Direction: 'direction',
    Delay: 'delay',
    RelayId: 'relay_id',
    RelayFlag: 'relay_flag',
    MeasurementPoint: 'measurement_point',
    Location: 'location',
  };

  const updateAlarm = (index, field, value) => {
    // ── 1. Write to DB first, outside any state updater ──────────────────
    const alarm = alarms[index];
    const dbField = DB_FIELD_MAP[field];

    if (dbRef.current && dbField && alarm?.config_id != null) {
      const dbValue = field === 'Direction' ? value.toLowerCase() : value;
      updateAlarmConfig(dbRef.current, alarm.config_id, { [dbField]: dbValue });
      logAlarmTable(dbRef.current, `UPDATE — config_id=${alarm.config_id} set ${dbField}=${dbValue}`);
      persistDb(); // safe here — not inside a state updater
    }

    // ── 2. Update React state ─────────────────────────────────────────────
    setAlarms(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Delete → soft-delete in DB, remove from state
     ───────────────────────────────────────────────────────────────────────── */
  const handleDelete = (index) => {
    const alarm = alarms[index];
    if (dbRef.current && alarm.config_id != null) {
      deleteAlarmConfig(dbRef.current, alarm.config_id);
      logAlarmTable(dbRef.current, `DELETE — config_id=${alarm.config_id} (soft-deleted)`);
      persistDb();
    }
    setAlarms(prev => prev.filter((_, i) => i !== index));
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Derived UI helpers
     ───────────────────────────────────────────────────────────────────────── */
  const noConfig = !configData;
  const noDb = dbStatus === 'no-db';
  const isDbReady = dbStatus === 'ready';
  const isDbLoading = dbStatus === 'loading';

  console.log('[Alarm.jsx] Render state:', {
    noConfig,
    dbStatus,
    isDbReady,
    alarmsCount: alarms.length,
    sensorsCount: sensors.length,
    allChannelsCount: allChannelsForSelection.length
  });

  /* ─────────────────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">
          {t({ en: 'Alarm List', de: 'Alarmliste', cn: '报警列表' })}
        </h2>
        <button
          className="add-sensor-btn"
          style={{
            background: isDbReady ? '#00AB84' : '#C2C9D1',
            color: isDbReady ? 'white' : '#86909C',
            cursor: 'pointer'
          }}
          onClick={() => {
            console.log('[Alarm.jsx] Clicked Create Alarm button. dbStatus:', dbStatus);
            if (!isDbReady) {
              console.warn('[Alarm.jsx] Create Alarm clicked but database is not ready. Status:', dbStatus);
              showAlertDialog(
                t({ en: 'Database Not Ready', de: 'Datenbank nicht bereit', cn: '数据库未就绪' }),
                t({
                  en: `Cannot create alarm: The alarm database is not ready (Status: ${dbStatus}). Please make sure a valid configuration package containing Alarm.db is active.`,
                  de: `Alarm kann nicht erstellt werden: Die Alarmdatenbank ist nicht bereit (Status: ${dbStatus}). Bitte stellen Sie sicher, dass ein gültiges Konfigurationspaket mit Alarm.db aktiv ist.`,
                  cn: `无法创建报警：报警数据库未就绪 (状态: ${dbStatus})。请确保包含 Alarm.db 的有效配置包已激活。`
                }),
                'warn'
              );
              return;
            }
            setIsModalOpen(true);
          }}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{t({ en: 'Create Alarm', de: 'Alarm erstellen', cn: '创建报警' })}</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        {noConfig ? (
          <div className="suto-empty-container">
            {t({
              en: 'No configuration loaded. Please import a .cfgf file in the Configuration Manager first.',
              de: 'Keine Konfiguration geladen. Bitte importieren Sie zuerst eine .cfgf-Datei in der Konfigurationsverwaltung.',
              cn: '未加载配置。请先在配置管理中导入 .cfgf 文件。'
            })}
          </div>
        ) : (
          <div className="suto-table-container">
            <table className="suto-table alarm-config-table">
              <thead>
                <tr>
                  <th style={{ width: '190px' }}>{t({ en: 'Sensor', de: 'Sensor', cn: '传感器' })}</th>
                  <th style={{ width: '200px' }}>{t({ en: 'Channel', de: 'Kanal', cn: '通道' })}</th>
                  <th style={{ width: '80px' }}>{t({ en: 'Unit', de: 'Einheit', cn: '单位' })}</th>
                  <th style={{ width: '100px' }}>{t({ en: 'Threshold', de: 'Schwellenwert', cn: '报警值' })}</th>
                  <th style={{ width: '100px' }}>{t({ en: 'Hysteresis', de: 'Hysterese', cn: '回差' })}</th>
                  <th style={{ width: '100px' }}>{t({ en: 'Direction', de: 'Richtung', cn: '方向' })}</th>
                  <th style={{ width: '90px' }}>{t({ en: 'Delay (s)', de: 'Verzögerung (s)', cn: '延时 (秒)' })}</th>
                  <th style={{ width: '110px' }}>{t({ en: 'Relay', de: 'Relais', cn: '继电器' })}</th>
                  <th style={{ width: '120px' }}>{t({ en: 'Relay Active', de: 'Relais aktiv', cn: '继电器使能' })}</th>
                  <th style={{ width: '60px' }} className="col-operate">{t({ en: 'Action', de: 'Aktion', cn: '操作' })}</th>
                </tr>
              </thead>
              <tbody>
                {alarms.length > 0 ? (
                  alarms.map((alarm, index) => (
                    <tr key={alarm.config_id ?? index}>
                      <td>{alarm.Sensor}</td>
                      <td>{alarm.Channel}</td>
                      <td>{alarm.Unit}</td>

                      {/* Threshold */}
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="alarm-inline-input"
                          value={alarm.Threshold}
                          onChange={(e) => updateAlarm(index, 'Threshold', e.target.value)}
                        />
                      </td>

                      {/* Hysteresis */}
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="alarm-inline-input"
                          value={alarm.Hysteresis}
                          onChange={(e) => updateAlarm(index, 'Hysteresis', e.target.value)}
                        />
                      </td>

                      {/* Direction */}
                      <td>
                        <select
                          className="alarm-inline-input"
                          value={alarm.Direction}
                          onChange={(e) => updateAlarm(index, 'Direction', e.target.value)}
                        >
                          <option value="UP">{t({ en: 'UP', de: 'UP', cn: '高报' })}</option>
                          <option value="Down">{t({ en: 'Down', de: 'Down', cn: '低报' })}</option>
                        </select>
                      </td>

                      {/* Delay */}
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="alarm-inline-input"
                          value={alarm.Delay}
                          onChange={(e) => updateAlarm(index, 'Delay', e.target.value)}
                        />
                      </td>

                      {/* Relay ID */}
                      <td>
                        <select
                          className="alarm-inline-input"
                          value={alarm.RelayId}
                          onChange={(e) => updateAlarm(index, 'RelayId', e.target.value)}
                        >
                          <option value="0">{t({ en: 'None', de: 'Keine', cn: '无' })}</option>
                          <option value="1">{t({ en: 'Relay', de: 'Relais', cn: '继电器' })} 1</option>
                          <option value="2">{t({ en: 'Relay', de: 'Relais', cn: '继电器' })} 2</option>
                          <option value="3">{t({ en: 'Relay', de: 'Relais', cn: '继电器' })} 3</option>
                          <option value="4">{t({ en: 'Relay', de: 'Relais', cn: '继电器' })} 4</option>
                        </select>
                      </td>

                      {/* Relay Flag (active toggle) */}
                      <td>
                        <div
                          className={`alarm-switch ${alarm.RelayFlag ? 'on' : 'off'}`}
                          onClick={() => updateAlarm(index, 'RelayFlag', alarm.RelayFlag ? 0 : 1)}
                        >
                          <div className="switch-knob" />
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            className="btn-icon-img"
                            title={t({ en: 'Delete', de: 'Löschen', cn: '删除' })}
                            onClick={() => handleDelete(index)}
                          >
                            <img src={iconBtnDelete} alt={t({ en: 'Delete', de: 'Löschen', cn: '删除' })} style={{ width: 18, height: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} style={{ borderBottom: 'none', padding: 0 }}>
                      <div className="suto-empty-container">
                        {isDbLoading
                          ? t({ en: 'Loading alarm configuration…', de: 'Alarmliste wird geladen…', cn: '正在加载报警配置…' })
                          : noDb
                            ? t({ en: 'Alarm.db not found in the loaded config package.', de: 'Alarm.db im geladenen Konfigurationspaket nicht gefunden.', cn: '在加载的配置包中未找到 Alarm.db。' })
                            : t({ en: 'No alarms configured. Click "Create Alarm" to get started.', de: 'Keine Alarme konfiguriert. Klicken Sie auf "Alarm erstellen", um zu beginnen.', cn: '未配置报警。请点击“创建报警”开始配置。' })}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer / Pagination */}
      <footer className="suto-footer">
        <div className="pagination-info">
          <span>{t({ en: 'Items per page:', de: 'Einträge pro Seite:', cn: '每页条数:' })}</span>
          <div className="items-per-page">
            <span>10</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="page-counter">
          {t({
            en: `${alarms.length} of ${alarms.length}`,
            de: `${alarms.length} von ${alarms.length}`,
            cn: `共 ${alarms.length} 条`
          })}
        </div>

        <div className="pagination-controls">
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button className="page-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
            </svg>
          </button>
        </div>
      </footer>

      <ChannelSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allChannels={allChannelsForSelection}
        initialSelectedIds={currentlySelectedIds}
        onConfirm={handleConfirmSelection}
        maxLimit={null}
        selectionMessage={t({ en: 'Select channels to create alarms.', de: 'Kanäle auswählen, um Alarme zu erstellen.', cn: '选择要创建报警的通道。' })}
        showOperate={false}
        title={t({ en: 'Select channels for alarm', de: 'Kanäle für Alarm auswählen', cn: '选择报警通道' })}
      />

      <CustomDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        body={dialogState.body}
        type={dialogState.type}
        showConfirm={true}
        showCancel={false}
        confirmText={t({ en: 'OK', de: 'OK', cn: '确定' })}
        onConfirm={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Alarm;
