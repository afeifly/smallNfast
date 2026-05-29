import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register global notification helper
window.showAppNotification = (title, message, type = 'info') => {
  window.dispatchEvent(new CustomEvent('appNotification', { detail: { title, message, type } }));
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

