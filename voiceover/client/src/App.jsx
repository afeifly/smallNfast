import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Editor from './pages/Editor';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);

  useEffect(() => {
    const authed = sessionStorage.getItem('suto_auth') === 'true';
    setIsAuthenticated(authed);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('suto_auth');
    setIsAuthenticated(false);
    setCurrentProject(null);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentProject) {
    return <Editor project={currentProject} onBack={() => setCurrentProject(null)} />;
  }

  return (
    <Projects 
      onSelectProject={(proj) => setCurrentProject(proj)} 
      onLogout={handleLogout} 
    />
  );
}
