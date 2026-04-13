import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Graphic from './pages/Graphic';
import LoggerSettings from './pages/LoggerSettings';
import './App.css';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/graphic" element={<Graphic />} />
        <Route path="/logger/settings" element={<LoggerSettings />} />
      </Routes>
    </Layout>
  );
}

export default App;
