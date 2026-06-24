import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import de from '../locales/de.json';
import cn from '../locales/cn.json';

const LanguageContext = createContext();

const globalDict = {
  EN: en,
  DE: de,
  CN: cn
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('s4c_language') || 'EN';
  });

  useEffect(() => {
    localStorage.setItem('s4c_language', language);
  }, [language]);

  const t = (param) => {
    if (typeof param === 'string') {
      return globalDict[language]?.[param] || param;
    }
    if (param && typeof param === 'object') {
      const upper = language.toUpperCase();
      const lower = language.toLowerCase();
      return param[upper] || param[lower] || param['EN'] || param['en'] || '';
    }
    return '';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
