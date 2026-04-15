import React, { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [configData, setConfigData] = useState(() => {
    // Try to load from localStorage on init
    const saved = localStorage.getItem('s4c_config_data');
    return saved ? JSON.parse(saved) : null;
  });

  // Effect to save to localStorage when configData changes
  useEffect(() => {
    if (configData) {
      // Create a copy without the non-serializable fileMap
      const { fileMap, ...serializableData } = configData;
      localStorage.setItem('s4c_config_data', JSON.stringify(serializableData));
    } else {
      localStorage.removeItem('s4c_config_data');
    }
  }, [configData]);

  return (
    <ConfigContext.Provider value={{ configData, setConfigData }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
