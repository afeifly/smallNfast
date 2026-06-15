import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { saveFileMap, saveOneFileMap, loadFileMap, clearFileMap } from '../util/fileMapStorage';

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

  const [restored, setRestored] = useState(false);

  // Re-attach fileMaps from IndexedDB on startup
  useEffect(() => {
    let cancelled = false;
    console.log('[ConfigContext] Startup: loadFileMap initiated...');
    loadFileMap()
      .then((allFileMaps) => {
        if (cancelled) return;
        if (!allFileMaps) {
          console.warn('[ConfigContext] Startup: loadFileMap returned null/undefined');
          setRestored(true);
          return;
        }
        
        console.log('[ConfigContext] Startup: loadFileMap resolved. Store keys:', Object.keys(allFileMaps));
        
        setState(prev => {
          const newList = prev.configList.map(item => {
            if (allFileMaps[item.id]) {
              console.log(`[ConfigContext] Startup: Restored fileMap for config "${item.fileName}" (ID: ${item.id}). fileMap keys:`, Array.from(allFileMaps[item.id].keys()));
              return { ...item, fileMap: allFileMaps[item.id] };
            }
            console.warn(`[ConfigContext] Startup: No fileMap found in IndexedDB for config "${item.fileName}" (ID: ${item.id})`);
            return item;
          });
          return { ...prev, configList: newList };
        });
        setRestored(true);
      })
      .catch((err) => {
        console.error('[ConfigContext] Startup: Could not restore fileMaps from IndexedDB:', err);
        setRestored(true);
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

      // 2. Save fileMaps to IndexedDB ONLY if we have finished restoring them from IndexedDB!
      if (!restored) {
        console.log('[ConfigContext] Persist: Skipping IndexedDB save because startup restore is not finished yet.');
        return;
      }

      const fileMapCollection = {};
      state.configList.forEach(item => {
        if (item.fileMap) {
          fileMapCollection[item.id] = item.fileMap;
        }
      });
      
      console.log('[ConfigContext] Persist: Saving fileMaps to IndexedDB for config IDs:', Object.keys(fileMapCollection));
      saveFileMap(fileMapCollection)
        .then(() => {
          console.log('[ConfigContext] Persist: Successfully saved fileMaps.');
        })
        .catch((err) => {
          console.error('[ConfigContext] Persist: Failed to save fileMaps to IndexedDB:', err);
        });
    }
  }, [state, restored]);

  // Derived: Current active configData (for backward compatibility)
  const configData = useMemo(() => {
    return state.configList.find(c => c.id === state.activeConfigId) || null;
  }, [state.activeConfigId, state.configList]);

  // Updates the ACTIVE config
  const setConfigData = (newData) => {
    setState(prev => {
      const activeConfig = prev.configList.find(c => c.id === prev.activeConfigId) || null;
      
      if (!prev.activeConfigId) {
        // If no active, and we are setting data, create a new one
        const resolvedData = typeof newData === 'function' ? newData(null) : newData;
        const newId = `cfg-${Date.now()}`;
        return {
          activeConfigId: newId,
          configList: [...prev.configList, { ...resolvedData, id: newId }]
        };
      }

      // If we have an active config:
      const resolvedData = typeof newData === 'function' ? newData(activeConfig) : newData;
      
      // Merge with the existing activeConfig in state to prevent losing fields like fileMap
      const updatedConfig = {
        ...activeConfig,
        ...resolvedData,
        fileMap: resolvedData.fileMap || activeConfig.fileMap,
        id: activeConfig.id // ensure ID is preserved
      };

      const newList = prev.configList.map(c => 
        c.id === prev.activeConfigId ? updatedConfig : c
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
    // Immediately remove this config's fileMap from IndexedDB
    clearFileMap(id).catch(e =>
      console.error(`[ConfigContext] deleteConfig: Failed to clear fileMap for "${id}":`, e)
    );
  };

  const addConfig = (config) => {
    const newId = `cfg-${Date.now()}`;
    const item = { ...config, id: newId };
    setState(prev => ({
      activeConfigId: newId,
      configList: [...prev.configList, item]
    }));
    // *** Critical: save fileMap to IndexedDB immediately, bypassing the restored guard ***
    // The persist effect may be blocked by restored=false, so we save directly here.
    if (item.fileMap) {
      console.log(`[ConfigContext] addConfig: Immediately saving fileMap to IndexedDB for "${item.fileName}" (ID: ${newId})`);
      saveOneFileMap(newId, item.fileMap).catch(e =>
        console.error(`[ConfigContext] addConfig: Failed to save fileMap for "${newId}":`, e)
      );
    }
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
