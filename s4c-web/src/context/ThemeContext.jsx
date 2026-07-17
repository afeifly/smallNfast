import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const appName = import.meta.env.VITE_APP_NAME || 'S4C-Web';
  const appLogo = import.meta.env.VITE_APP_LOGO || '/logos/suto_logo.png';
  const logoHeight = import.meta.env.VITE_APP_LOGO_HEIGHT || '16px';
  const favicon = import.meta.env.VITE_APP_FAVICON || '/favicon.ico';

  window.__vite_env__ = import.meta.env;

  useEffect(() => {
    // Apply CSS Variables
    const style = document.documentElement.style;
    style.setProperty('--primary-color', import.meta.env.VITE_THEME_PRIMARY || '#FFE000');
    style.setProperty('--accent-color', import.meta.env.VITE_THEME_ACCENT || '#00AB84');
    style.setProperty('--sidebar-bg', import.meta.env.VITE_THEME_SIDEBAR_BG || '#FFFFFF');
    style.setProperty('--bg-color', import.meta.env.VITE_THEME_BG || '#F3F3F3');
    style.setProperty('--border-color', import.meta.env.VITE_THEME_BORDER || '#E7E7E7');
    style.setProperty('--text-primary', import.meta.env.VITE_THEME_TEXT_PRIMARY || 'rgba(0, 0, 0, 0.9)');
    style.setProperty('--btn-primary-text', import.meta.env.VITE_THEME_BTN_TEXT || '#191919');
    style.setProperty('--nav-active-bg', import.meta.env.VITE_THEME_NAV_ACTIVE_BG || '#00AB84');
    style.setProperty('--nav-text', import.meta.env.VITE_THEME_NAV_TEXT || '#333333');
    style.setProperty('--nav-active-text', import.meta.env.VITE_THEME_NAV_ACTIVE_TEXT || '#FFFFFF');
    style.setProperty('--topbar-text', import.meta.env.VITE_THEME_TOPBAR_TEXT || 'rgba(0, 0, 0, 0.9)');
    style.setProperty('--btn-radius', import.meta.env.VITE_THEME_BTN_RADIUS || '4px');

    // Update document title
    document.title = appName;

    // Update favicon
    const link = document.querySelector("link[rel~='icon']");
    if (link) {
      link.href = favicon;
    }
  }, [appName, favicon]);

  return (
    <ThemeContext.Provider value={{ appName, appLogo, logoHeight }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
