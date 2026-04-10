/**
 * i18n — Bay Area BMR Translation System
 *
 * Simple key-value translation. No framework, no dependencies.
 * Pages call t('key') to get translated text.
 * Language is stored in localStorage and defaults to browser language.
 */

import en from './en.json';
import es from './es.json';
import zh from './zh.json';
import vi from './vi.json';
import tl from './tl.json';
import hi from './hi.json';
import ko from './ko.json';
import ja from './ja.json';
import fa from './fa.json';
import pa from './pa.json';

export const languages = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr' },
  es: { name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  zh: { name: 'Chinese', nativeName: '中文', dir: 'ltr' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr' },
  tl: { name: 'Tagalog', nativeName: 'Tagalog', dir: 'ltr' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
  ko: { name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  ja: { name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  fa: { name: 'Persian', nativeName: 'فارسی', dir: 'rtl' },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr' },
};

const translations = { en, es, zh, vi, tl, hi, ko, ja, fa, pa };

export function getLanguage() {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('bmr-lang');
  if (stored && translations[stored]) return stored;
  const browser = navigator.language?.slice(0, 2);
  if (browser && translations[browser]) return browser;
  return 'en';
}

export function setLanguage(lang) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bmr-lang', lang);
  window.location.reload();
}

export function t(key, lang) {
  const currentLang = lang || getLanguage();
  const dict = translations[currentLang] || translations.en;
  return dict[key] || translations.en[key] || key;
}

export function getDirection(lang) {
  const currentLang = lang || getLanguage();
  return languages[currentLang]?.dir || 'ltr';
}
