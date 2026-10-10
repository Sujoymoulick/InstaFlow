/**
 * Instaflow SEO Suite - i18n Translation Engine & Loader
 */

import en from './en.json' assert { type: 'json' };
import es from './es.json' assert { type: 'json' };
import fr from './fr.json' assert { type: 'json' };
import de from './de.json' assert { type: 'json' };

const LOCALES = {
  en,
  es,
  fr,
  de
};

let currentLocale = 'en';

export function setLocale(locale = 'en') {
  if (LOCALES[locale]) {
    currentLocale = locale;
  } else {
    currentLocale = 'en';
  }
}

export function getLocale() {
  return currentLocale;
}

export function t(key, params = {}, locale = null) {
  const loc = locale || currentLocale;
  const dict = LOCALES[loc] || LOCALES.en;

  const parts = key.split('.');
  let val = dict;

  for (const part of parts) {
    if (val && typeof val === 'object' && part in val) {
      val = val[part];
    } else {
      // Fallback to English
      val = getFallback(key);
      break;
    }
  }

  if (typeof val !== 'string') {
    return key;
  }

  return interpolate(val, params);
}

function getFallback(key) {
  const parts = key.split('.');
  let val = LOCALES.en;
  for (const part of parts) {
    if (val && typeof val === 'object' && part in val) {
      val = val[part];
    } else {
      return key;
    }
  }
  return typeof val === 'string' ? val : key;
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? params[paramName] : match;
  });
}

export function getAvailableLocales() {
  return [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
  ];
}
