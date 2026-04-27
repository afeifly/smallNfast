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
import Alarm from './pages/Alarm';
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
        <Route path="/alarm" element={<Alarm />} />
      </Routes>
    </Layout>
  );
}

export default App;
