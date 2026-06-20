import { create } from 'zustand';
import { en, zh } from '../i18n/locales';

export const LOCALE = { EN: 'en', ZH: 'zh' };

const locales = { en, zh };

/**
 * Resolve a dotted key path against a locale object.
 * Supports simple {n} interpolation for numbers.
 */
export function t(locale, key, ...args) {
  const keys = key.split('.');
  let val = locales[locale] || en;
  for (const k of keys) {
    val = val?.[k];
    if (val === undefined) return key; // fallback
  }
  if (typeof val === 'string' && args.length) {
    return val.replace(/\{(\w+)\}/g, (_, name) => {
      const arg = args[0];
      return arg?.[name] !== undefined ? String(arg[name]) : `{${name}}`;
    });
  }
  return val ?? key;
}

const useLocaleStore = create((set) => ({
  locale: LOCALE.EN,
  setLocale: (l) => set({ locale: l }),
  toggleLocale: () =>
    set((s) => ({
      locale: s.locale === LOCALE.EN ? LOCALE.ZH : LOCALE.EN,
    })),
}));

/**
 * Hook returning a t() function bound to the current locale.
 * Usage in components:  const _ = useT();  →  _('title.newGame')
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key, ...args) => t(locale, key, ...args);
}

export default useLocaleStore;
