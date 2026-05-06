import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveFileMap, loadFileMap, clearFileMap } from '../util/fileMapStorage';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [configData, setConfigData] = useState(() => {
    // Restore the JSON-serialisable part from localStorage on init.
    // fileMap is restored asynchronously below (from IndexedDB).
    const saved = localStorage.getItem('s4c_config_data');
    return saved ? JSON.parse(saved) : null;
  });

  /* ── On startup: re-attach the fileMap from IndexedDB ─────────────────── */
  useEffect(() => {
    // Only attempt if we have config metadata but no fileMap yet
    // (i.e. we just restored from localStorage after a refresh)
    if (!configData || configData.fileMap) return;

    let cancelled = false;
    loadFileMap()
      .then((fileMap) => {
        if (cancelled || !fileMap) return;
        setConfigData(prev => prev ? { ...prev, fileMap } : prev);
      })
      .catch((err) => {
        console.warn('[ConfigContext] Could not restore fileMap from IndexedDB:', err);
      });

    return () => { cancelled = true; };
    // Run only once on mount (configData from useState initialiser)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Persist to localStorage (JSON fields) + IndexedDB (fileMap) ──────── */
  useEffect(() => {
    if (configData) {
      // 1. Save serialisable metadata to localStorage
      const { fileMap, ...serializableData } = configData;
      localStorage.setItem('s4c_config_data', JSON.stringify(serializableData));

      // 2. Save binary fileMap to IndexedDB
      if (fileMap) {
        saveFileMap(fileMap).catch((err) =>
          console.warn('[ConfigContext] Failed to save fileMap to IndexedDB:', err)
        );
      }
    } else {
      localStorage.removeItem('s4c_config_data');
      clearFileMap().catch(() => {});
    }
  }, [configData]);

  return (
    <ConfigContext.Provider value={{ configData, setConfigData }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
