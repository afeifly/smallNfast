import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register global notification helper
window.showAppNotification = (title, message, type = 'info') => {
  window.dispatchEvent(new CustomEvent('appNotification', { detail: { title, message, type } }));
};

// Register global confirm dialog helper
window.showConfirmDialog = (title, message, options = {}) => {
  return new Promise((resolve) => {
    let resolved = false;
    const onResolve = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(Boolean(result));
      }
    };
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('appConfirmDialog', {
        detail: {
          title,
          message,
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          type: options.type || 'warning',
          onResolve
        }
      }));
    } else {
      resolve(true);
    }
  });
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

