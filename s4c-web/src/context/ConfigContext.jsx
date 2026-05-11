import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { saveFileMap, loadFileMap, clearFileMap } from '../util/fileMapStorage';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  // state structure: { activeConfigId: string | null, configList: Array<ConfigItem> }
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('s4c_config_manager_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          activeConfigId: parsed.activeConfigId || null,
          configList: parsed.configList || []
        };
      } catch (e) {
        console.error('Failed to parse saved config state', e);
      }
    }
    
    // Legacy support: check for old s4c_config_data
    const legacy = localStorage.getItem('s4c_config_data');
    if (legacy) {
      try {
        const parsedLegacy = JSON.parse(legacy);
        const legacyId = `legacy-${Date.now()}`;
        return {
          activeConfigId: legacyId,
          configList: [{ ...parsedLegacy, id: legacyId }]
        };
      } catch (e) {}
    }

    return { activeConfigId: null, configList: [] };
  });

  // Re-attach fileMaps from IndexedDB on startup
  useEffect(() => {
    let cancelled = false;
    loadFileMap()
      .then((allFileMaps) => {
        if (cancelled || !allFileMaps) return;
        
        setState(prev => {
          const newList = prev.configList.map(item => {
            if (allFileMaps[item.id]) {
              return { ...item, fileMap: allFileMaps[item.id] };
            }
            return item;
          });
          return { ...prev, configList: newList };
        });
      })
      .catch((err) => {
        console.warn('[ConfigContext] Could not restore fileMaps from IndexedDB:', err);
      });

    return () => { cancelled = true; };
  }, []);

  // Persist to localStorage + IndexedDB
  useEffect(() => {
    if (state) {
      // 1. Save metadata to localStorage (strip fileMaps)
      const serializableState = {
        activeConfigId: state.activeConfigId,
        configList: state.configList.map(({ fileMap, ...rest }) => rest)
      };
      localStorage.setItem('s4c_config_manager_state', JSON.stringify(serializableState));
      
      // Clear old legacy key if it exists
      localStorage.removeItem('s4c_config_data');

      // 2. Save fileMaps to IndexedDB
      const fileMapCollection = {};
      state.configList.forEach(item => {
        if (item.fileMap) fileMapCollection[item.id] = item.fileMap;
      });
      saveFileMap(fileMapCollection).catch((err) =>
        console.warn('[ConfigContext] Failed to save fileMaps to IndexedDB:', err)
      );
    }
  }, [state]);

  // Derived: Current active configData (for backward compatibility)
  const configData = useMemo(() => {
    return state.configList.find(c => c.id === state.activeConfigId) || null;
  }, [state.activeConfigId, state.configList]);

  // Updates the ACTIVE config
  const setConfigData = (newData) => {
    setState(prev => {
      if (!prev.activeConfigId) {
        // If no active, and we are setting data, create a new one
        const newId = `cfg-${Date.now()}`;
        return {
          activeConfigId: newId,
          configList: [...prev.configList, { ...newData, id: newId }]
        };
      }
      // Update existing active config
      const newList = prev.configList.map(c => 
        c.id === prev.activeConfigId ? { ...newData, id: c.id } : c
      );
      return { ...prev, configList: newList };
    });
  };

  const setConfigList = (newList) => setState(prev => ({ ...prev, configList: newList }));
  const setActiveConfigId = (id) => setState(prev => ({ ...prev, activeConfigId: id }));

  const deleteConfig = (id) => {
    setState(prev => {
      const newList = prev.configList.filter(c => c.id !== id);
      let nextActive = prev.activeConfigId;
      if (nextActive === id) {
        nextActive = newList.length > 0 ? newList[0].id : null;
      }
      return { activeConfigId: nextActive, configList: newList };
    });
  };

  const addConfig = (config) => {
    const newId = `cfg-${Date.now()}`;
    const item = { ...config, id: newId };
    setState(prev => ({
      activeConfigId: newId,
      configList: [...prev.configList, item]
    }));
    return newId;
  };

  return (
    <ConfigContext.Provider value={{ 
      configData, 
      setConfigData, 
      configList: state.configList,
      setConfigList,
      activeConfigId: state.activeConfigId,
      setActiveConfigId,
      deleteConfig,
      addConfig
    }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
