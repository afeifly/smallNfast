import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import CustomDialog from '../../components/CustomDialog';
import './SUTOSensor.css';

const LayoutSetting = () => {
  const { configData, setConfigData } = useConfig();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({ type: 'info', title: '', body: '' });

  // Dynamically find the config path
  const configPath = Object.keys(configData?.configs || {}).find(p => p.endsWith('SUTO-SensorList.sutolist'));
  const currentConfig = configData?.configs?.[configPath];
  
  // Extract all sensors
  const sensors = currentConfig?.cfgsensor || [];

  const handleUpdate = (sensorIndex, field, value) => {
    const updatedSensors = [...sensors];
    updatedSensors[sensorIndex] = {
      ...updatedSensors[sensorIndex],
      [field]: value
    };

    // Also update all channels of this sensor if they don't have their own location/meapoint or to keep them in sync
    // As per the reference, these settings often apply to the sensor level but affect all its channels
    if (updatedSensors[sensorIndex].cfgchannel) {
      updatedSensors[sensorIndex].cfgchannel = updatedSensors[sensorIndex].cfgchannel.map(ch => ({
        ...ch,
        [field]: value
      }));
    }

    const newConfigData = {
      ...configData,
      configs: {
        ...configData.configs,
        [configPath]: {
          ...currentConfig,
          cfgsensor: updatedSensors
        }
      }
    };

    setConfigData(newConfigData);
  };

  const handleSaveAll = () => {
    setDialogConfig({
      type: 'succ',
      title: 'Success',
      body: 'Layout settings saved successfully.'
    });
    setShowDialog(true);
  };

  return (
    <div className="suto-sensor-page">
      <header className="suto-header">
        <h2 className="suto-title">Layout setting</h2>
        <button className="add-sensor-btn" onClick={handleSaveAll}>
          <span>Save all</span>
        </button>
      </header>

      <div className="suto-body">
        <div className="suto-table-container">
          <table className="suto-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Id</th>
                <th style={{ width: '250px' }}>Location</th>
                <th style={{ width: '250px' }}>Meapoint</th>
                <th>Sensor Name</th>
                <th>Description</th>
                <th style={{ width: '120px' }}>Address</th>
              </tr>
            </thead>
            <tbody>
              {sensors.length > 0 ? (
                sensors.map((sensor, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <input
                        className="alarm-inline-input"
                        value={sensor.Location || ''}
                        onChange={(e) => handleUpdate(idx, 'Location', e.target.value)}
                        placeholder="Enter location"
                      />
                    </td>
                    <td>
                      <input
                        className="alarm-inline-input"
                        value={sensor.Meapoint || ''}
                        onChange={(e) => handleUpdate(idx, 'Meapoint', e.target.value)}
                        placeholder="Enter meapoint"
                      />
                    </td>
                    <td>{sensor.Name || '---'}</td>
                    <td>{sensor.Description || '---'}</td>
                    <td>{sensor.Addr || '---'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="suto-empty-container">
                      No sensors found in configuration.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onConfirm={() => setShowDialog(false)}
        title={dialogConfig.title}
        body={dialogConfig.body}
        type={dialogConfig.type}
        showCancel={false}
      />
    </div>
  );
};

export default LayoutSetting;
