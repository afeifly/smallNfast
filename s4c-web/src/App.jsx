import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Graphic from './pages/Graphic';
import LoggerSettings from './pages/LoggerSettings';
import ConfigManager from './pages/ConfigManager';
import SUTOSensor from './pages/sensorconfiguration/SUTOSensor';
import ThirdPartySensor from './pages/sensorconfiguration/ThirdPartySensor';
import AnalogDigitalInput from './pages/sensorconfiguration/AnalogDigitalInput';
import VirtualChannel from './pages/sensorconfiguration/VirtualChannel';
import LayoutSetting from './pages/sensorconfiguration/LayoutSetting';
import ModbusRTUMaster from './pages/communication/ModbusRTUMaster';
import ModbusRTUSlave from './pages/communication/ModbusRTUSlave';
import ModbusTCP from './pages/communication/ModbusTCP';
import HoldingRegister from './pages/communication/HoldingRegister';
import Alarm from './pages/Alarm';
import Support from './pages/system/Support';
import DataAnalysis from './pages/DataAnalysis';

import './App.css';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/graphic" element={<Graphic />} />
        <Route path="/logger/settings" element={<LoggerSettings />} />
        <Route path="/config-manager" element={<ConfigManager />} />
        <Route path="/sensor/add-suto" element={<SUTOSensor />} />
        <Route path="/sensor/add-3rd" element={<ThirdPartySensor />} />
        <Route path="/sensor/analog-digital" element={<AnalogDigitalInput />} />
        <Route path="/sensor/virtual-channel" element={<VirtualChannel />} />
        <Route path="/sensor/layout-setting" element={<LayoutSetting />} />
        <Route path="/communication/modbus-rtu-master" element={<ModbusRTUMaster />} />
        <Route path="/communication/modbus-rtu-slave" element={<ModbusRTUSlave />} />
        <Route path="/communication/modbus-tcp" element={<ModbusTCP />} />
        <Route path="/communication/holding-register" element={<HoldingRegister />} />
        <Route path="/alarm" element={<Alarm />} />
        <Route path="/system/support" element={<Support />} />
        <Route path="/analysis" element={<DataAnalysis />} />

      </Routes>
    </Layout>
  );
}

export default App;
