import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DATE_FORMATS, NUMBER_FORMATS, SUPPORTED_LANGUAGES } from '../i18n/index.js';

/**
 * useI18n — Operio'nun tüm dil/format işlemleri için tek hook
 *
 * Döndürdükleri:
 *   t(key, opts?)          — çeviri (common namespace)
 *   tm(key, opts?)         — tıbbi çeviri (medical namespace)
 *   lang                   — aktif dil kodu ('tr' | 'en')
 *   setLanguage(code)      — dili değiştir + localStorage'a kaydet
 *   languages              — desteklenen dil listesi
 *   formatDate(date, type) — yerel tarih formatı
 *   formatTime(date)       — yerel saat formatı
 *   formatNumber(n, type)  — yerel sayı formatı
 *   formatCurrency(n)      — yerel para birimi formatı
 *   formatPercent(n)       — yüzde formatı
 *   formatRelative(date)   — "3 dakika önce" vb.
 *   isRTL                  — sağdan sola dil mi?
 */
export function useI18n() {
  const { t, i18n }         = useTranslation('common');
  const { t: tm }           = useTranslation('medical');
  const lang                = i18n.language?.slice(0, 2) || 'tr';
  const dateFormats         = DATE_FORMATS[lang]   || DATE_FORMATS.tr;
  const numberFormats       = NUMBER_FORMATS[lang] || NUMBER_FORMATS.tr;

  // Dil değiştir
  const setLanguage = useCallback(async (code) => {
    await i18n.changeLanguage(code);
    localStorage.setItem('operio-language', code);
  }, [i18n]);

  // ── TARİH FORMATLARI ───────────────────────────────────────
  const formatDate = useCallback((date, type = 'date') => {
    if (!date) return '—';
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      return new Intl.DateTimeFormat(lang, dateFormats[type] || dateFormats.date).format(d);
    } catch { return '—'; }
  }, [lang, dateFormats]);

  const formatTime = useCallback((date) => formatDate(date, 'time'), [formatDate]);

  const formatDateTime = useCallback((date) => formatDate(date, 'dateTime'), [formatDate]);

  // "3 dakika önce" / "3 minutes ago"
  const formatRelative = useCallback((date) => {
    if (!date) return '—';
    try {
      const d       = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      const diffMs  = d - Date.now();
      const diffSec = Math.round(diffMs / 1000);

      const rtf = new Intl.RelativeTimeFormat(lang, dateFormats.relative);

      if (Math.abs(diffSec) < 60)   return rtf.format(diffSec, 'second');
      if (Math.abs(diffSec) < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
      if (Math.abs(diffSec) < 86400)return rtf.format(Math.round(diffSec / 3600), 'hour');
      return rtf.format(Math.round(diffSec / 86400), 'day');
    } catch { return '—'; }
  }, [lang, dateFormats]);

  // ── SAYI FORMATLARI ────────────────────────────────────────
  const formatNumber = useCallback((n, type = 'decimal') => {
    if (n == null || isNaN(n)) return '—';
    try {
      return new Intl.NumberFormat(lang, numberFormats[type] || numberFormats.decimal).format(n);
    } catch { return String(n); }
  }, [lang, numberFormats]);

  const formatCurrency = useCallback((n) => formatNumber(n, 'currency'), [formatNumber]);
  const formatPercent  = useCallback((n) => formatNumber(n / 100, 'percent'), [formatNumber]);

  // Süre formatlama: dakika → "1s 30dk" / "1h 30m"
  const formatDuration = useCallback((minutes) => {
    if (!minutes || isNaN(minutes)) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (lang === 'tr') {
      if (h > 0 && m > 0) return `${h}s ${m}dk`;
      if (h > 0)           return `${h}s`;
      return `${m}dk`;
    } else {
      if (h > 0 && m > 0) return `${h}h ${m}m`;
      if (h > 0)           return `${h}h`;
      return `${m}m`;
    }
  }, [lang]);

  return {
    // Çeviri fonksiyonları
    t,
    tm,
    // Dil durumu
    lang,
    languages:    SUPPORTED_LANGUAGES,
    setLanguage,
    isRTL:        false, // TR ve EN her ikisi de LTR
    // Format fonksiyonları
    formatDate,
    formatTime,
    formatDateTime,
    formatRelative,
    formatNumber,
    formatCurrency,
    formatPercent,
    formatDuration,
  };
}
