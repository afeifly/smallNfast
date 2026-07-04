import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ProjectProvider } from './context/ProjectContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
