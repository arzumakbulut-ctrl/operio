import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import { useAuthStore } from './store';
import AuthScreen from './components/auth/AuthScreen';
import AppLayout from './components/layout/AppLayout';
import Toast from './components/ui/Toast';

// Pages
import Dashboard         from './pages/Dashboard';
import Personel          from './pages/Personel';
import Hastalar          from './pages/Hastalar';
import Doktorlar         from './pages/Doktorlar';
import SterilSetler      from './pages/SterilSetler';
import SalonYonetim      from './pages/SalonYonetim';
import Istatistik        from './pages/Istatistik';
import SetTakip          from './pages/SetTakip';
import QREtiketler       from './pages/QREtiketler';
import Fiyatlandirma     from './pages/Fiyatlandirma';
import EgitimYonetim     from './pages/EgitimYonetim';
import EgitimTakvim      from './pages/EgitimTakvim';
import EgitimKutuphane   from './pages/EgitimKutuphane';
import Dokumanlar        from './pages/Dokumanlar';
import Envanter          from './pages/Envanter';
import MisafirHekimYonetim from './pages/MisafirHekimYonetim';
import Roller            from './pages/Roller';
import SterilDepo        from './pages/SterilDepo';
import TekliAletler      from './pages/TekliAletler';
import SterilGecmis      from './pages/SterilGecmis';
import SterilPersonel    from './pages/SterilPersonel';
import Prosedurler       from './pages/Prosedurler';
import YeniHasta         from './pages/YeniHasta';
import SayimFormu        from './pages/SayimFormu';
import AmeliyatNotu      from './pages/AmeliyatNotu';
import AmeliyatDetay     from './pages/AmeliyatDetay';
import OrnekIstemi       from './pages/OrnekIstemi';
import EkipPlani         from './pages/EkipPlani';
import Anestezi          from './pages/Anestezi';
import Kurum             from './pages/Kurum';
import TibbiSozluk       from './pages/TibbiSozluk';
import AmeliyatTalebi    from './pages/AmeliyatTalebi';
import Profil            from './pages/Profil';
import BildirimDuyuru    from './pages/BildirimDuyuru';
import SalonVerimlilik   from './pages/SalonVerimlilik';
import RandevuDurum      from './pages/RandevuDurum';
import AmeliyatKartlari  from './pages/AmeliyatKartlari';
import Raporlar          from './pages/Raporlar';
import Mesajlasma        from './pages/Mesajlasma';
import OnayBekleyenler   from './pages/OnayBekleyenler';
import DolulukTakvimi    from './pages/DolulukTakvimi';
import CalismaListesi    from './pages/CalismaListesi';
import MesaiHesaplama    from './pages/MesaiHesaplama';
import VakaHazirlik      from './pages/VakaHazirlik';
import Yardim            from './pages/Yardim';
import Ayarlar           from './pages/Ayarlar';
import Katkida           from './pages/Katkida';
import Abonelik          from './pages/Abonelik';
import Ameliyatlar       from './pages/Ameliyatlar';
import Biyomedikal       from './pages/Biyomedikal';
import TeknikServis      from './pages/TeknikServis';
import Indikatörler      from './pages/Indikatörler';
import KatilimIstekleri  from './pages/KatilimIstekleri';
import HastaTakibi       from './pages/HastaTakibi';

function RouteLogger() {
  const location = useLocation();
  useEffect(() => {
    console.log('%c[ROUTE] pathname değişti →', 'color:#0891b2;font-weight:bold', location.pathname, 'state:', location.state);
  }, [location]);
  return null;
}

function ProtectedLayout({ children }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  if (!isLoggedIn) { console.log('[DEBUG] ProtectedLayout → isLoggedIn FALSE, /giris\'e gidiyor'); return <Navigate to="/giris" replace />; }
  return <AppLayout>{children}</AppLayout>;
}

function SocketProvider({ children }) {
  useSocket();
  return children;
}

export default function App() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const logout     = useAuthStore(s => s.logout);

  useEffect(() => {
    function handleAuthExpired() {
      console.log('[DEBUG] operio:auth-expired event tetiklendi! logout çağrılıyor');
      logout();
    }
    window.addEventListener('operio:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('operio:auth-expired', handleAuthExpired);
  }, [logout]);

  const savedTheme = (() => { try { return JSON.parse(localStorage.getItem('operio-theme'))?.state?.theme || 'light'; } catch { return 'light'; } })();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  return (
    <BrowserRouter>
      <SocketProvider>
      <RouteLogger />
      <Routes>
        {/* Auth */}
        <Route path="/giris" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <AuthScreen />} />

        {/* ── GENEL ── */}
        <Route path="/dashboard"   element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/ameliyatlar" element={<ProtectedLayout><Ameliyatlar /></ProtectedLayout>} />
        <Route path="/biyomedikal"       element={<ProtectedLayout><Biyomedikal /></ProtectedLayout>} />
        <Route path="/teknik-servis"     element={<ProtectedLayout><TeknikServis /></ProtectedLayout>} />
        <Route path="/indikatörler"      element={<ProtectedLayout><Indikatörler /></ProtectedLayout>} />
        <Route path="/katilim-istekleri" element={<ProtectedLayout><KatilimIstekleri /></ProtectedLayout>} />
        <Route path="/hasta-takibi"      element={<ProtectedLayout><HastaTakibi /></ProtectedLayout>} />
        <Route path="/bakim-plan"        element={<ProtectedLayout><Biyomedikal /></ProtectedLayout>} />
        <Route path="/kalibrasyon"       element={<ProtectedLayout><Biyomedikal /></ProtectedLayout>} />
        <Route path="/ariza-bildirimleri" element={<ProtectedLayout><Biyomedikal /></ProtectedLayout>} />
        <Route path="/is-emirleri"       element={<ProtectedLayout><TeknikServis /></ProtectedLayout>} />
        <Route path="/cihaz-raporlari"   element={<ProtectedLayout><Biyomedikal /></ProtectedLayout>} />
        <Route path="/servis-talepleri"  element={<ProtectedLayout><TeknikServis /></ProtectedLayout>} />
        <Route path="/parca-takip"       element={<ProtectedLayout><TeknikServis /></ProtectedLayout>} />
        <Route path="/kurum"       element={<ProtectedLayout><Kurum /></ProtectedLayout>} />
        <Route path="/salonlar"    element={<ProtectedLayout><SalonYonetim /></ProtectedLayout>} />
        <Route path="/takvim"      element={<ProtectedLayout><DolulukTakvimi /></ProtectedLayout>} />

        {/* ── KULLANICILAR ── */}
        <Route path="/personel"    element={<ProtectedLayout><Personel /></ProtectedLayout>} />
        <Route path="/doktorlar"   element={<ProtectedLayout><Doktorlar /></ProtectedLayout>} />
        <Route path="/roller"      element={<ProtectedLayout><Roller /></ProtectedLayout>} />
        <Route path="/misafir-hekim" element={<ProtectedLayout><MisafirHekimYonetim /></ProtectedLayout>} />

        {/* ── KLİNİK ── */}
        <Route path="/prosedurler" element={<ProtectedLayout><Prosedurler /></ProtectedLayout>} />
        <Route path="/hastalar"    element={<ProtectedLayout><Hastalar /></ProtectedLayout>} />
        <Route path="/yeni-hasta"  element={<ProtectedLayout><YeniHasta /></ProtectedLayout>} />

        {/* ── AMELİYATHANE ── */}
        <Route path="/ekip"        element={<ProtectedLayout><EkipPlani /></ProtectedLayout>} />
        <Route path="/onay"        element={<ProtectedLayout><OnayBekleyenler /></ProtectedLayout>} />
        <Route path="/anestezi"    element={<ProtectedLayout><Anestezi /></ProtectedLayout>} />
        <Route path="/sayim"       element={<ProtectedLayout><SayimFormu /></ProtectedLayout>} />
        <Route path="/ameliyat-notu" element={<ProtectedLayout><AmeliyatNotu /></ProtectedLayout>} />
        <Route path="/ameliyat-detay" element={<ProtectedLayout>{(() => { console.log('%c[ROUTE-MATCH] /ameliyat-detay eşleşti!', 'color:#059669;font-weight:bold'); return <AmeliyatDetay />; })()}</ProtectedLayout>} />
        <Route path="/ornek-istemi" element={<ProtectedLayout><OrnekIstemi /></ProtectedLayout>} />
        <Route path="/vaka"        element={<ProtectedLayout><VakaHazirlik /></ProtectedLayout>} />
        <Route path="/yardim"      element={<ProtectedLayout><Yardim /></ProtectedLayout>} />
        <Route path="/ayarlar"     element={<ProtectedLayout><Ayarlar /></ProtectedLayout>} />
        <Route path="/katkida"     element={<ProtectedLayout><Katkida /></ProtectedLayout>} />
        <Route path="/hasta"       element={<ProtectedLayout><Hastalar /></ProtectedLayout>} />

        {/* ── PERSONEL ── */}
        <Route path="/calisma"     element={<ProtectedLayout><CalismaListesi /></ProtectedLayout>} />
        <Route path="/mesai"       element={<ProtectedLayout><MesaiHesaplama /></ProtectedLayout>} />

        {/* ── EKİPMAN ── */}
        <Route path="/envanter"    element={<ProtectedLayout><Envanter /></ProtectedLayout>} />
        <Route path="/steril-setler" element={<ProtectedLayout><SterilSetler /></ProtectedLayout>} />
        <Route path="/setler"      element={<ProtectedLayout><SterilSetler /></ProtectedLayout>} />
        <Route path="/set-takip"   element={<ProtectedLayout><SetTakip /></ProtectedLayout>} />
        <Route path="/qr-etiket"   element={<ProtectedLayout><QREtiketler /></ProtectedLayout>} />
        <Route path="/depo"        element={<ProtectedLayout><SterilDepo /></ProtectedLayout>} />
        <Route path="/tekli"       element={<ProtectedLayout><TekliAletler /></ProtectedLayout>} />
        <Route path="/steril-gecmis" element={<ProtectedLayout><SterilGecmis /></ProtectedLayout>} />
        <Route path="/steril-personel" element={<ProtectedLayout><SterilPersonel /></ProtectedLayout>} />

        {/* ── DOKTOR ── */}
        <Route path="/talep"       element={<ProtectedLayout><AmeliyatTalebi /></ProtectedLayout>} />
        <Route path="/randevu"     element={<ProtectedLayout><RandevuDurum /></ProtectedLayout>} />
        <Route path="/kartlar"     element={<ProtectedLayout><AmeliyatKartlari /></ProtectedLayout>} />

        {/* ── EĞİTİM ── */}
        <Route path="/egitim-yonetim"   element={<ProtectedLayout><EgitimYonetim /></ProtectedLayout>} />
        <Route path="/egitim-takvim"    element={<ProtectedLayout><EgitimTakvim /></ProtectedLayout>} />
        <Route path="/egitim-kutuphane" element={<ProtectedLayout><EgitimKutuphane /></ProtectedLayout>} />

        {/* ── RAPORLAR ── */}
        <Route path="/istatistik"  element={<ProtectedLayout><Istatistik /></ProtectedLayout>} />
        <Route path="/raporlar"    element={<ProtectedLayout><Raporlar /></ProtectedLayout>} />
        <Route path="/salon-verimlilik" element={<ProtectedLayout><SalonVerimlilik /></ProtectedLayout>} />
        <Route path="/verimlilik"  element={<ProtectedLayout><SalonVerimlilik /></ProtectedLayout>} />
        <Route path="/bildirim"    element={<ProtectedLayout><BildirimDuyuru /></ProtectedLayout>} />

        {/* ── DİĞER ── */}
        <Route path="/profil"      element={<ProtectedLayout><Profil /></ProtectedLayout>} />
        <Route path="/dokumanlar"  element={<ProtectedLayout><Dokumanlar /></ProtectedLayout>} />
        <Route path="/mesajlasma"  element={<ProtectedLayout><Mesajlasma /></ProtectedLayout>} />
        <Route path="/sozluk"      element={<ProtectedLayout><TibbiSozluk /></ProtectedLayout>} />
        <Route path="/abonelik"    element={<ProtectedLayout><Abonelik /></ProtectedLayout>} />
        <Route path="/fiyat"       element={<ProtectedLayout><Fiyatlandirma /></ProtectedLayout>} />

        {/* Default */}
        <Route path="/" element={<Navigate to={isLoggedIn ? '/dashboard' : '/giris'} replace />} />
        <Route path="*" element={(() => { console.log('%c[CATCH-ALL] hiçbir route eşleşmedi! pathname:', 'color:#DC2626;font-weight:bold', window.location.pathname); return <Navigate to={isLoggedIn ? '/dashboard' : '/giris'} replace />; })()} />
      </Routes>

      <Toast />
      </SocketProvider>
    </BrowserRouter>
  );
}
