import React, { useState, useEffect } from 'react';
import intl from 'react-intl-universal';
import './AlarmCenterModal.css';
import { formatChannelValue, getDefaultUnitResolution } from '../util/resolution';
import {
  getActiveAlarms,
  getAlarmHistory,
  clearAlarmHistory,
  acknowledgeAlarm,
  acknowledgeAllAlarms,
  subscribeAlarms
} from '../modules/processscape/engine/alarmEngine';

export default function AlarmCenterModal({
  isOpen,
  onClose,
  onGoToLocation
}) {
  const [activeTab, setActiveTab] = useState('active');
  const [activeAlarms, setActiveAlarms] = useState(() => getActiveAlarms());
  const [alarmHistory, setAlarmHistory] = useState(() => getAlarmHistory());
  const [historyFilter, setHistoryFilter] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveAlarms([...getActiveAlarms()]);
    setAlarmHistory([...getAlarmHistory()]);

    const unsub = subscribeAlarms(({ activeAlarms: newActive, alarmHistory: newHist }) => {
      setActiveAlarms([...newActive]);
      setAlarmHistory([...newHist]);
    });
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportHistoryCsv = () => {
    if (alarmHistory.length === 0) return;
    const headers = ['Timestamp', 'Time Str', 'Event Type', 'Severity', 'Location', 'Measurement Point', 'Channel', 'Current Value', 'Threshold', 'Duration (s)'];
    const rows = alarmHistory.map(h => [
      h.timestamp,
      new Date(h.timestamp).toISOString(),
      h.eventType,
      h.severity || 'critical',
      `"${(h.locationName || '').replace(/"/g, '""')}"`,
      `"${(h.measurementPointName || '').replace(/"/g, '""')}"`,
      `"${(h.channelName || '').replace(/"/g, '""')}"`,
      h.currentValue !== undefined ? h.currentValue : '',
      `"${(String(h.threshold || '')).replace(/"/g, '""')}"`,
      h.durationMs ? (h.durationMs / 1000).toFixed(1) : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `S4A_Alarm_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHistory = alarmHistory.filter(item => {
    if (!historyFilter) return true;
    const q = historyFilter.toLowerCase();
    return (
      (item.locationName && item.locationName.toLowerCase().includes(q)) ||
      (item.measurementPointName && item.measurementPointName.toLowerCase().includes(q)) ||
      (item.channelName && item.channelName.toLowerCase().includes(q)) ||
      (item.eventType && item.eventType.toLowerCase().includes(q))
    );
  });

  const formatTs = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '< 1s';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}m ${remSec}s`;
  };

  const formatDisplayVal = (val, unit, resolution) => {
    if (val === null || val === undefined || val === '') return '--';
    if (val === 'Offline' || val === 'Restored' || val === '--.-') return String(val);
    const num = Number(val);
    if (isNaN(num)) return String(val);
    const res = (typeof resolution === 'number' && resolution >= 0)
      ? resolution
      : getDefaultUnitResolution(unit || '');
    return formatChannelValue(num, res);
  };

  return (
    <div
      className="alarm-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="alarm-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="alarm-modal-header">
          <div className="alarm-modal-title-row">
            <div className="alarm-modal-header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h2 className="alarm-modal-title">{intl.get('ALARM_CENTER') || 'Alarm Center'}</h2>
              <p className="alarm-modal-subtitle">
                {intl.get('ALARM_CENTER_SUBTITLE') || 'System-wide telemetry monitoring across all assigned channels & locations'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="alarm-modal-close-btn"
            onClick={onClose}
            aria-label={intl.get('CLOSE') || 'Close'}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="alarm-modal-tabs">
          <button
            type="button"
            className={`alarm-modal-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            {intl.get('ACTIVE_ALARMS') || 'Active Alarms'}
            <span className={`alarm-tab-badge ${activeAlarms.length > 0 ? 'danger' : 'neutral'}`}>
              {activeAlarms.length}
            </span>
          </button>
          <button
            type="button"
            className={`alarm-modal-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            {intl.get('ALARM_HISTORY') || 'Alarm History'}
            <span className="alarm-tab-badge neutral">
              {alarmHistory.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="alarm-modal-content">
          {activeTab === 'active' ? (
            <div className="alarm-active-view">
              {activeAlarms.length === 0 ? (
                <div className="alarm-empty-state">
                  <div className="alarm-empty-icon">✅</div>
                  <h3 className="alarm-empty-title">{intl.get('ALL_SYSTEMS_NORMAL') || 'All Systems Normal'}</h3>
                  <p className="alarm-empty-desc">
                    {intl.get('NO_ACTIVE_ALARMS_DESC') || 'No active alarms detected across any assigned location channels.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="alarm-active-toolbar">
                    <span className="alarm-toolbar-summary">
                      {intl.get('CHANNELS_REQUIRE_ATTENTION', {
                        count: activeAlarms.length,
                        plural: activeAlarms.length === 1 ? 'channel' : 'channels'
                      }) || `${activeAlarms.length} ${activeAlarms.length === 1 ? 'channel requires' : 'channels require'} attention`}
                    </span>
                    <button
                      type="button"
                      className="alarm-action-btn secondary"
                      onClick={() => {
                        acknowledgeAllAlarms();
                        if (typeof onClose === 'function') {
                          onClose();
                        }
                      }}
                    >
                      {intl.get('ACKNOWLEDGE_ALL') || 'Acknowledge All'}
                    </button>
                  </div>

                  <div className="alarm-card-list">
                    {activeAlarms.map((alarm) => {
                      const isWarn = alarm.severity === 'warning';
                      return (
                        <div key={alarm.id} className={`alarm-card ${isWarn ? 'warning' : 'critical'}`}>
                          <div className="alarm-card-top">
                            <div className="alarm-card-tags">
                              <span className={`alarm-sev-badge ${isWarn ? 'warning' : 'critical'}`}>
                                {isWarn
                                  ? (intl.get('SEVERITY_WARNING') || 'Warning')
                                  : (intl.get('SEVERITY_CRITICAL') || 'Critical')}
                              </span>
                              <span className="alarm-loc-tag" title={intl.get('LOCATION') || 'Location'}>
                                📍 {alarm.locationName || (intl.get('LOCATION') || 'Location')}
                              </span>
                              <span className="alarm-mp-tag" title={intl.get('MEASUREMENT_POINT') || 'Measurement Point'}>
                                ⚡ {alarm.measurementPointName}
                              </span>
                            </div>
                            <span className="alarm-time-tag">
                              {formatTs(alarm.triggeredAt)}
                            </span>
                          </div>

                          <div className="alarm-card-main">
                            <div className="alarm-card-ch-info">
                              <h4 className="alarm-ch-name">
                                {alarm.channelName}
                                {alarm.unit && <span className="alarm-unit">({alarm.unit})</span>}
                              </h4>
                              <div className="alarm-rule-info">
                                <span>{intl.get('CONDITION') || 'Condition'}: <strong>{alarm.ruleType}</strong></span>
                                <span>·</span>
                                <span>{intl.get('THRESHOLD') || 'Threshold'}: <strong>{alarm.threshold} {alarm.unit}</strong></span>
                                {alarm.hysteresis > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{intl.get('HYSTERESIS') || 'Hysteresis'}: <strong>{alarm.hysteresis} {alarm.unit}</strong></span>
                                  </>
                                )}
                              </div>
                              {alarm.message && (
                                <p className="alarm-custom-message">{alarm.message}</p>
                              )}
                            </div>

                            <div className="alarm-current-val-box">
                              <span className="alarm-val-label">{intl.get('CURRENT_VALUE') || 'Current Value'}</span>
                              <span className="alarm-val-num">
                                {formatDisplayVal(alarm.currentValue, alarm.unit, alarm.resolution)} {alarm.unit}
                              </span>
                            </div>
                          </div>

                          <div className="alarm-card-actions">
                            <button
                              type="button"
                              className="alarm-jump-btn"
                              onClick={() => onGoToLocation && onGoToLocation(alarm)}
                              title={`${intl.get('GO_TO_LOCATION') || 'Jump to'} ${alarm.locationName}`}
                            >
                              {intl.get('GO_TO_LOCATION') || 'Go to Location'} →
                            </button>
                            {!alarm.acknowledged ? (
                              <button
                                type="button"
                                className="alarm-ack-btn"
                                onClick={() => acknowledgeAlarm(alarm.id)}
                              >
                                {intl.get('ACKNOWLEDGE') || 'Acknowledge'}
                              </button>
                            ) : (
                              <span className="alarm-acked-label">✓ {intl.get('ACKNOWLEDGED') || 'Acknowledged'}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="alarm-history-view">
              <div className="alarm-history-toolbar">
                <input
                  type="text"
                  className="alarm-history-search"
                  placeholder={intl.get('FILTER_ALARMS_PLACEHOLDER') || 'Filter by location, channel, or event...'}
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="alarm-action-btn secondary"
                    onClick={handleExportHistoryCsv}
                    disabled={alarmHistory.length === 0}
                  >
                    {intl.get('EXPORT_CSV') || 'Export CSV'}
                  </button>
                  <button
                    type="button"
                    className="alarm-action-btn danger-outline"
                    onClick={() => {
                      if (window.confirm(intl.get('CLEAR_HISTORY_CONFIRM') || 'Are you sure you want to clear all alarm history?')) {
                        clearAlarmHistory();
                      }
                    }}
                    disabled={alarmHistory.length === 0}
                  >
                    {intl.get('CLEAR_HISTORY') || 'Clear History'}
                  </button>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="alarm-empty-state">
                  <div className="alarm-empty-icon">📋</div>
                  <h3 className="alarm-empty-title">{intl.get('NO_ALARM_HISTORY') || 'No Alarm History'}</h3>
                  <p className="alarm-empty-desc">
                    {historyFilter
                      ? (intl.get('NO_HISTORY_MATCHING') || 'No events matching your filter.')
                      : (intl.get('NO_HISTORY_DEFAULT') || 'Historical alarm trigger and recovery events will appear here.')}
                  </p>
                </div>
              ) : (
                <div className="alarm-history-table-wrapper">
                  <table className="alarm-history-table">
                    <thead>
                      <tr>
                        <th>{intl.get('TIME') || 'Time'}</th>
                        <th>{intl.get('EVENT') || 'Event'}</th>
                        <th>{intl.get('LOCATION') || 'Location'}</th>
                        <th>{intl.get('MEASUREMENT_POINT') || 'Measurement Point'}</th>
                        <th>{intl.get('CHANNEL') || 'Channel'}</th>
                        <th>{intl.get('TRIGGER_VALUE_RULE') || 'Trigger Value / Rule'}</th>
                        <th>{intl.get('DURATION') || 'Duration'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((item) => {
                        const evt = item.eventType;
                        const evtClass = evt === 'triggered' ? 'triggered' : (evt === 'cleared' ? 'cleared' : 'acknowledged');
                        return (
                          <tr key={item.id}>
                            <td className="alarm-td-time">{formatTs(item.timestamp)}</td>
                            <td>
                              <span className={`alarm-event-badge ${evtClass}`}>
                                {evt === 'triggered'
                                  ? `⚡ ${intl.get('EVENT_TRIGGERED') || 'Triggered'}`
                                  : (evt === 'cleared'
                                      ? `✓ ${intl.get('EVENT_CLEARED') || 'Cleared'}`
                                      : `👁️ ${intl.get('EVENT_ACKED') || 'Acked'}`)}
                              </span>
                            </td>
                            <td>{item.locationName || '--'}</td>
                            <td>{item.measurementPointName || '--'}</td>
                            <td>
                              <strong>{item.channelName}</strong>
                              {item.unit && <span style={{ color: '#64748b', fontSize: 11 }}> ({item.unit})</span>}
                            </td>
                            <td>
                              <span style={{ fontWeight: 700 }}>
                                {formatDisplayVal(item.currentValue, item.unit, item.resolution)}
                                {item.unit && !['Offline', 'Restored'].includes(item.currentValue) ? ` ${item.unit}` : ''}
                              </span>
                              <span style={{ color: '#64748b', fontSize: 11 }}> ({intl.get('ALARM_RULE_LABEL') || 'Rule:'} {item.ruleType} {item.threshold})</span>
                            </td>
                            <td>
                              {item.durationMs ? formatDuration(item.durationMs) : '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

