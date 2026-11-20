import { useState, useEffect } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import AIPanel from '../ui/AIPanel';

const PAGE_TITLES = {
  '/dashboard':    ['Kontrol Paneli',        'Günlük ameliyat programı ve özet'],
  '/kurum':        ['Kurum Yönetimi',        'Merkez Devlet Hastanesi'],
  '/salonlar':     ['Salon Yönetimi',        'Ameliyat salonları ve durum takibi'],
  '/takvim':       ['Doluluk Takvimi',       'Aylık salon doluluk görünümü'],
  '/doktorlar':    ['Doktor Yönetimi',       'Kayıtlı doktorlar ve katılım istekleri'],
  '/personel':     ['Personel Listesi',      'Ameliyathane çalışanları'],
  '/roller':       ['Yetki & Roller',        'Rol tanımları ve izin yönetimi'],
  '/prosedurler':  ['Prosedürler',           'Standart ameliyat prosedürleri'],
  '/hastalar':     ['Hasta Kayıtları',       'Kayıtlı hastalar'],
  '/yeni-hasta':   ['Yeni Hasta Ekle',       'Hasta kartı oluştur'],
  '/calisma':      ['Çalışma Listeleri',     'Vardiya ve nöbet planları'],
  '/mesai':        ['Mesai Hesaplama',       'Çalışma saati ve fazla mesai'],
  '/istatistik':   ['İstatistikler',         'Performans ve analitik veriler'],
  '/raporlar':     ['Raporlar',              'Dönem raporları ve belgeler'],
  '/verimlilik':   ['Salon Verimliliği',     'Salon kullanım oranları'],
  '/onay':         ['Onay Bekleyenler',      'Onay bekleyen ameliyat talepleri'],
  '/ekip':         ['Ekip Planı',            'Ameliyat ekiplerini düzenle'],
  '/anestezi':     ['Anestezi Formu',        'İntraoperatif anestezi kayıtları'],
  '/envanter':     ['Cihaz Envanteri',       'Medikal cihaz takibi'],
  '/setler':       ['Cerrahi Setler',        'Sterilize cerrahi set yönetimi'],
  '/set-takip':    ['Set Takip Paneli',      'QR ile sterilizasyon iş akışı'],
  '/qr-etiket':    ['QR Etiket Üretici',    'Baskıya hazır set etiketleri'],
  '/depo':         ['Steril Depo',           'Raf ve stok yönetimi'],
  '/tekli':        ['Tekli Aletler',         'Ayrı takip edilen cerrahi aletler'],
  '/talep':        ['Ameliyat Talebi',       'Yeni ameliyat isteği oluştur'],
  '/randevu':      ['Randevu Durumlarım',    'Ameliyat randevularımın durumu'],
  '/kartlar':      ['Ameliyat Kartları',     'Ameliyat ve set talep kartlarım'],
  '/profil':       ['Profilim',              'Kişisel bilgiler ve uzmanlık'],
  '/yardim':       ['Yardım & Destek',        'Kullanım kılavuzu ve SSS'],
  '/ayarlar':      ['Ayarlar',                'Sistem ve görünüm tercihleri'],
  '/katkida':      ['Katkıda Bulun',          'Öneri & geri bildirim'],
  '/vaka':         ['Vaka Hazırlığı',        'Ameliyat öncesi set ve malzeme hazırlığı'],
  '/sayim':        ['Sayım Formu',           'İntraoperatif alet sayım formu'],
  '/hasta':        ['Hasta Takibi',          'Anestezi sürecinde vital takip'],
  '/ameliyatlar':  ['Ameliyat Listesi',      'Bugünkü ameliyat programı'],
  '/fiyatlandirma': ['Fiyatlandırma',         'Planlar ve abonelik seçenekleri'],
  '/abonelik':     ['Abonelik Yönetimi',     'Mevcut planınız, faturalar ve limitler'],
  '/ameliyat-kartlari':       ['Ameliyat Kartlarım', 'Ameliyat protokolleriniz ve ekipman listeleriniz'],
  '/randevu-durum':       ['Randevu Durumlarım', 'Ameliyat talep durumu takibi'],
  '/randevu-talep':       ['Ameliyat Randevu Talebi', '3 adımda ameliyat talebi oluşturun'],
  '/salon-verimlilik':       ['Salon Verimliliği', 'Bu aya ait performans metrikleri'],
  '/bildirim':       ['Bildirim & Duyuru', 'Sistem bildirimleri ve personel duyuruları'],
  '/sozluk':       ['Tıbbi Terminoloji Sözlüğü', 'Türkçe ↔ İngilizce tıbbi terimler'],
  '/mesajlasma':   ['Mesajlaşma',              'Ekip içi iletişim'],
  '/onay':         ['Onay Bekleyenler',         'Ameliyat talep onayları'],
  '/takvim':       ['Doluluk Takvimi',          'Ameliyathane salon planlaması'],
  '/calisma':      ['Çalışma Listesi',          'Vardiya planı ve mesai takibi'],
  '/mesai':        ['Mesai Hesaplama',           'Fazla mesai ve ücret hesaplama'],
  '/vaka':              ['Vaka Hazırlığı & Sayım',       'Ameliyat öncesi hazırlık protokolü'],
  '/egitim-yonetim':   ['Eğitim Yönetimi',              '7 aktif eğitim · 4 bu ay · 1 taslak'],
  '/egitim-takvim':    ['Eğitim Takvimi',               '5 yaklaşan eğitim · 2 tamamlanan'],
  '/egitim-kutuphane': ['Eğitim Kütüphanesi',           'Tüm eğitimler, materyaller ve arşiv'],
  '/misafir-hekim':    ['Misafir Hekim Yönetimi',       'Konuk doktor erişim ve randevu takibi'],
  '/steril-setler':    ['Cerrahi Setler',               'Sterilize cerrahi set yönetimi'],
  '/steril-gecmis':    ['Sterilizasyon Takip Geçmişi',  'Set bazlı izlenebilirlik'],
  '/steril-personel':  ['Sterilizasyon Personeli',      'Personel listesi ve görev takibi'],
  '/ameliyat-notu':    ['Ameliyat Notları',             'Ameliyat bazlı not ve kayıtlar'],
  '/dokumanlar':       ['Dokümanlar',                   'Kurumsal belgeler ve protokoller'],
  '/salon-verimlilik': ['Salon Verimliliği',            'Bu aya ait performans metrikleri'],
};

export default function AppLayout({ children }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { t }     = useI18n();
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Aktif path'e göre nav key bul ve t() ile çevir
  const PATH_NAV_KEY = {
    '/dashboard':    ['nav.dashboard',          'dashboard.subtitle'],
    '/salonlar':     ['nav.roomManagement',      ''],
    '/takvim':       ['nav.calendar',            ''],
    '/doktorlar':    ['nav.doctorManagement',    ''],
    '/personel':     ['nav.staffList',           ''],
    '/hastalar':     ['nav.patientRecords',      ''],
    '/setler':       ['nav.sterilesets',         ''],
    '/set-takip':    ['nav.setTracking',         ''],
    '/istatistik':   ['nav.statistics',          ''],
    '/raporlar':     ['nav.reports',             ''],
    '/fiyatlandirma':['nav.pricing',             ''],
    '/abonelik':     ['nav.subscription',        ''],
    '/qr-etiket':    ['nav.qrLabels',            ''],
  };
  const navKeys = PATH_NAV_KEY[location.pathname] || PAGE_TITLES[location.pathname]?.map(s => s) || ['Sayfa', ''];
  const title = navKeys[0].startsWith('nav.') ? t(navKeys[0]) : navKeys[0];
  const crumb = navKeys[1]?.startsWith('dashboard.') ? t(navKeys[1]) : navKeys[1] || '';

  // ⌘K / Ctrl+K kısayolu
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setAiOpen(prev => !prev);
      }
      if (e.key === 'Escape' && aiOpen) {
        setAiOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [aiOpen]);

  return (
    <div className="app">
      <Sidebar
        onAIClick={() => setAiOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onMenuToggle={() => setMobileSidebarOpen(o => !o)}
      />

      {/* Mobil sidebar karartma katmanı */}
      {mobileSidebarOpen && (
        <div className="mobile-overlay" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <div className="app-main">
        <Topbar
          onAIClick={() => setAiOpen(true)}
          onMenuToggle={() => setMobileSidebarOpen(o => !o)}
        />
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Operia AI Paneli */}
      {aiOpen && <AIPanel onClose={() => setAiOpen(false)} />}

      {/* Mesajlaşma FAB — mesajlasma sayfasında gizle */}
      {location.pathname !== '/mesajlasma' && (
        <div onClick={() => navigate('/mesajlasma')} title="Mesajlaşma"
          style={{position:'fixed',bottom:28,right:28,width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,var(--teal),#0891b2)',boxShadow:'0 6px 24px rgba(20,184,166,0.4)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:900,transition:'transform 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
          onMouseLeave={e=>e.currentTarget.style.transform=''}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          <div style={{position:'absolute',top:-4,right:-4,background:'var(--danger)',color:'white',fontSize:9,fontWeight:700,minWidth:17,height:17,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg-body)',padding:'0 3px'}}>5</div>
        </div>
      )}
    </div>
  );
}
