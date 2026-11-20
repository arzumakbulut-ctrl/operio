import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Locale JSON'ları direkt import et (Vite bundle'a dahil eder)
import trCommon  from './locales/tr/common.json';
import trMedical from './locales/tr/medical.json';
import enCommon  from './locales/en/common.json';
import enMedical from './locales/en/medical.json';

// Desteklenen diller
export const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE  = 'tr';
export const FALLBACK_LANGUAGE = 'tr';
export const NAMESPACES = ['common', 'medical'];
export const DEFAULT_NS = 'common';

// Tarih / saat / sayı formatları — her dil için ayrı
export const DATE_FORMATS = {
  tr: {
    date:      { day: 'numeric', month: 'long', year: 'numeric' },
    dateShort: { day: '2-digit', month: '2-digit', year: 'numeric' },
    time:      { hour: '2-digit', minute: '2-digit', hour12: false },
    dateTime:  { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    relative:  { numeric: 'auto' },
  },
  en: {
    date:      { day: 'numeric', month: 'long', year: 'numeric' },
    dateShort: { month: '2-digit', day: '2-digit', year: 'numeric' },
    time:      { hour: '2-digit', minute: '2-digit', hour12: true },
    dateTime:  { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true },
    relative:  { numeric: 'auto' },
  },
};

export const NUMBER_FORMATS = {
  tr: {
    decimal:  { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    currency: { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 },
    percent:  { style: 'percent', minimumFractionDigits: 0 },
  },
  en: {
    decimal:  { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    currency: { style: 'currency', currency: 'USD', minimumFractionDigits: 2 },
    percent:  { style: 'percent', minimumFractionDigits: 0 },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { common: trCommon, medical: trMedical },
      en: { common: enCommon, medical: enMedical },
    },

    // Dil tespiti sırası: localStorage → navigator → fallback
    detection: {
      order:           ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'operio-language',
      caches:          ['localStorage'],
      htmlTag:         document.documentElement,
    },

    lng:            undefined,     // detector'a bırak
    fallbackLng:    FALLBACK_LANGUAGE,
    supportedLngs:  SUPPORTED_LANGUAGES.map(l => l.code),

    ns:             NAMESPACES,
    defaultNS:      DEFAULT_NS,

    interpolation: {
      escapeValue: false, // React zaten XSS koruması yapıyor
    },

    // Geliştirme modunda eksik key uyarısı
    saveMissing:    process.env.NODE_ENV === 'development',
    missingKeyHandler: process.env.NODE_ENV === 'development'
      ? (lngs, ns, key) => console.warn(`[i18n] Missing key: ${ns}:${key} (${lngs})`)
      : undefined,
  });

// HTML lang ve dir attribute'larını güncelle
i18n.on('languageChanged', (lng) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === lng);
  document.documentElement.lang = lng;
  document.documentElement.dir  = lang?.dir || 'ltr';
});

// Yardımcı fonksiyonlar — bileşenlerden direkt import edilebilir
export function getCurrentLanguage() {
  return i18n.language?.split('-')[0] || DEFAULT_LANGUAGE;
}

export function changeLanguage(code) {
  return i18n.changeLanguage(code);
}

export default i18n;
