import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import ChannelSelectModal from '../components/ChannelSelectModal';
import iconBtnEdit from '../assets/images/icon_btn_edit.png';
import iconBtnDelete from '../assets/images/icon_btn_delete.png';
import './sensorconfiguration/SUTOSensor.css';

const Alarm = () => {
  const { configData } = useConfig();
  const [alarms, setAlarms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Extract all channels from all sensors for selection
  const sensors = (
    configData?.configs?.['/config/SUTO-SensorList.sutolist']?.cfgsensor ||
    configData?.configs?.['config/SUTO-SensorList.sutolist']?.cfgsensor ||
    []
  );

  const allChannelsForSelection = [];
  sensors.forEach(sensor => {
    (sensor.cfgchannel || []).forEach((ch, idx) => {
      allChannelsForSelection.push({
        CreateTime: `${sensor.Name}-${idx}-${ch.ChannelDescription}`, // Unique ID for selection
        sensorName: sensor.Name,
        channelName: ch.ChannelDescription,
        unit: ch.UnitInASCII || '---',
        location: '',
        point: ''
      });
    });
  });

  const currentlySelectedIds = alarms.map(a => a.id);

  const updateAlarm = (index, field, value) => {
    setAlarms(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleConfirmSelection = (selectedIds) => {
    // Only add channels that aren't already in the alarm list
    const newSelectedChannels = allChannelsForSelection.filter(ch =>
      selectedIds.includes(ch.CreateTime) && !currentlySelectedIds.includes(ch.CreateTime)
    );

    const newAlarms = newSelectedChannels.map(ch => ({
      id: ch.CreateTime, // Store the ID to track selection
      Sensor: ch.sensorName,
      Channel: ch.channelName,
      Unit: ch.unit,
      Threshold: '0',
      Hysteresis: '0',
      Direction: 'UP',
      Delay: '0',
      Relay: 'RelayX1',
      Pending: true
    }));

    setAlarms(prev => [...prev, ...newAlarms]);
    setIsModalOpen(false);
  };

  return (
    <div className="content-card suto-sensor-page">
      {/* Header */}
      <header className="suto-header">
        <h2 className="suto-title">Alarm list</h2>
        <button
          className="add-sensor-btn"
          onClick={() => setIsModalOpen(true)}
        >
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Create Alarm</span>
        </button>
      </header>

      {/* Body */}
      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table alarm-config-table">
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Channel</th>
                <th style={{ width: '70px' }}>Unit</th>
                <th style={{ width: '100px' }}>Threshold</th>
                <th style={{ width: '100px' }}>Hysteresis</th>
                <th style={{ width: '100px' }}>Direction</th>
                <th style={{ width: '80px' }}>Delay(ms)</th>
                <th style={{ width: '110px' }}>Relay</th>
                <th style={{ width: '60px' }}>Pending</th>
                <th style={{ width: '60px' }} className="col-operate">Action</th>
              </tr>
            </thead>
            <tbody>
              {alarms.length > 0 ? (
                alarms.map((alarm, index) => (
                  <tr key={index}>
                    <td>{alarm.Sensor || '---'}</td>
                    <td>{alarm.Channel || '---'}</td>
                    <td>{alarm.Unit || '---'}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="alarm-inline-input"
                        value={alarm.Threshold}
                        onChange={(e) => updateAlarm(index, 'Threshold', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="alarm-inline-input"
                        value={alarm.Hysteresis}
                        onChange={(e) => updateAlarm(index, 'Hysteresis', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="alarm-inline-input"
                        value={alarm.Direction}
                        onChange={(e) => updateAlarm(index, 'Direction', e.target.value)}
                      >
                        <option value="UP">UP</option>
                        <option value="Down">Down</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        className="alarm-inline-input"
                        value={alarm.Delay}
                        onChange={(e) => updateAlarm(index, 'Delay', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="alarm-inline-input"
                        value={alarm.Relay}
                        onChange={(e) => updateAlarm(index, 'Relay', e.target.value)}
                      >
                        <option value="RelayX1">RelayX1</option>
                        <option value="RelayX2">RelayX2</option>
                        <option value="RelayX3">RelayX3</option>
                        <option value="RelayX4">RelayX4</option>
                        <option value="None">None</option>
                      </select>
                    </td>
                    <td>
                      <div
                        className={`alarm-switch ${alarm.Pending ? 'on' : 'off'}`}
                        onClick={() => updateAlarm(index, 'Pending', !alarm.Pending)}
                      >
                        <div className="switch-knob"></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          className="btn-icon-img"
                          title="Delete"
                          onClick={() => setAlarms(prev => prev.filter((_, i) => i !== index))}
                        >
                          <img src={iconBtnDelete} alt="Delete" style={{ width: 18, height: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="suto-empty-container">
                      No Alarms configured. Click "Create Alarm" to get started.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Pagination */}
      <footer className="suto-footer">
        <div className="pagination-info">
          <span>Items per page:</span>
          <div className="items-per-page">
            <span>10</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="page-counter">
          {alarms.length} of {alarms.length}
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
        maxLimit={null} // No limit for alarms
        selectionMessage="Select channels to create alarms."
        showOperate={false}
        title="Select channels for alarm"
      />
    </div>
  );
};

export default Alarm;
