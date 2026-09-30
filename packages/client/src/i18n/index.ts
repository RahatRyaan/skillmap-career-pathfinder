/**
 * i18n setup.
 *
 * English is the source of truth; Bangla is a parallel bundle that a native
 * speaker reviews before release. A missing key falls back to English rather
 * than showing the raw key.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import bn from './bn.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bn: { translation: bn },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'bn'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'skillmap.language',
    },
  });

export default i18n;
