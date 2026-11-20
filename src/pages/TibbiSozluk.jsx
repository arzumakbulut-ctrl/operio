import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../i18n';

// Tüm terim çiftlerini (TR ↔ EN) düz liste haline getir
function buildTermList(trTerms, enTerms) {
  const list = [];
  for (const [category, terms] of Object.entries(trTerms)) {
    for (const [key, trValue] of Object.entries(terms)) {
      const enValue = enTerms[category]?.[key] || trValue;
      list.push({ category, key, tr: trValue, en: enValue });
    }
  }
  return list;
}

const CATEGORY_ICONS = {
  procedures:    '🏥',
  anatomy:       '🫀',
  anesthesia:    '💉',
  instruments:   '🔧',
  sterilization: '🧪',
  general:       '📋',
};

export default function TibbiSozluk() {
  const { t, i18n } = useTranslation('medical');
  const lang = getCurrentLanguage();
  const [search, setSearch]       = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode]   = useState('grid'); // grid | table

  // Çeviri verilerini al
  const trTerms = i18n.getResourceBundle('tr', 'medical')?.terms || {};
  const enTerms = i18n.getResourceBundle('en', 'medical')?.terms || {};
  const allTerms = useMemo(() => buildTermList(trTerms, enTerms), []);

  const categories = ['all', ...Object.keys(trTerms)];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allTerms.filter(term => {
      const matchCat = activeCategory === 'all' || term.category === activeCategory;
      if (!q) return matchCat;
      return matchCat && (
        term.tr.toLowerCase().includes(q) ||
        term.en.toLowerCase().includes(q) ||
        term.key.toLowerCase().includes(q)
      );
    });
  }, [allTerms, search, activeCategory]);

  // Kategoriye göre grupla
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(term => {
      if (!g[term.category]) g[term.category] = [];
      g[term.category].push(term);
    });
    return g;
  }, [filtered]);

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-hd-title">{t('title')}</div>
          <div className="page-hd-sub">
            {t('subtitle')} · {allTerms.length} terim
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
            {['grid', 'table'].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: viewMode === m ? 'var(--teal)' : 'transparent', color: viewMode === m ? 'white' : 'var(--slate-light)' }}>
                {m === 'grid' ? '⊞ Kart' : '☰ Tablo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Arama + Filtre */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          className="fi"
          placeholder={t('search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: activeCategory === cat ? 'var(--teal)' : 'var(--surface)',
                color: activeCategory === cat ? 'white' : 'var(--slate-mid)',
                transition: 'all 0.12s',
              }}>
              {cat === 'all' ? '🗂 Tümü' : `${CATEGORY_ICONS[cat] || '📌'} ${t(`categories.${cat}`)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Sonuç sayısı */}
      <div style={{ fontSize: 12, color: 'var(--slate-light)', marginBottom: 14 }}>
        {filtered.length === 0
          ? t('noResult')
          : `${filtered.length} terim`}
      </div>

      {/* Grid görünüm */}
      {viewMode === 'grid' && (
        <div>
          {Object.entries(grouped).map(([category, terms]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--slate-light)',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[category] || '📌'}</span>
                {t(`categories.${category}`)}
                <span style={{ fontSize: 10, background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 20, color: 'var(--slate-mid)' }}>
                  {terms.length}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {terms.map(term => (
                  <div key={term.key}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', transition: 'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal-mid)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}>

                    {/* Türkçe */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>🇹🇷</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>
                        {term.tr}
                      </span>
                    </div>

                    {/* İngilizce */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12 }}>🇬🇧</span>
                      <span style={{ fontSize: 12.5, color: 'var(--slate-mid)' }}>
                        {term.en}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tablo görünüm */}
      {viewMode === 'table' && (
        <div className="panel">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>🇹🇷 Türkçe</th>
                <th>🇬🇧 English</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(term => (
                <tr key={`${term.category}-${term.key}`}>
                  <td>
                    <span className="tag t-gray">
                      {CATEGORY_ICONS[term.category]} {t(`categories.${term.category}`)}
                    </span>
                  </td>
                  <td className="td-name">{term.tr}</td>
                  <td style={{ color: 'var(--slate-mid)', fontSize: 12.5 }}>{term.en}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-light)' }}>{t('noResult')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
