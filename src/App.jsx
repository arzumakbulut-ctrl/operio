import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import { useAuthStore, useDataStore } from './store';
import AuthScreen from './components/auth/AuthScreen';
import AppLayout from './components/layout/AppLayout';
import Toast from './components/ui/Toast';
import ConnectionStatus from './components/ui/ConnectionStatus';

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
import CihazKontrol      from './pages/CihazKontrol';
import MisafirHekimYonetim from './pages/MisafirHekimYonetim';
import Roller            from './pages/Roller';
import SterilDepo        from './pages/SterilDepo';
import TekliAletler      from './pages/TekliAletler';
import SterilGecmis      from './pages/SterilGecmis';
import SterilPersonel    from './pages/SterilPersonel';
import Prosedurler       from './pages/Prosedurler';
import YeniHasta         from './pages/YeniHasta';
import SayimFormu        from './pages/SayimFormu';
import AmeliyatDetay     from './pages/AmeliyatDetay';
import OrnekIstemi       from './pages/OrnekIstemi';
import EkipPlani         from './pages/EkipPlani';
import Anestezi          from './pages/Anestezi';
import Kurum             from './pages/Kurum';
import TibbiSozluk       from './pages/TibbiSozluk';
import IlacRehberi       from './pages/IlacRehberi';
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
import BakimPlani        from './pages/BakimPlani';
import KalibrasyonKayitlari from './pages/KalibrasyonKayitlari';
import ArizaBildirimleri from './pages/ArizaBildirimleri';
import CihazRaporlari    from './pages/CihazRaporlari';
import TeknikServis      from './pages/TeknikServis';
import IsEmirleri        from './pages/IsEmirleri';
import ServisTalepleri   from './pages/ServisTalepleri';
import ParcaTakip        from './pages/ParcaTakip';
import BakimTakvimi      from './pages/BakimTakvimi';
import Indikatörler      from './pages/Indikatörler';
import KatilimIstekleri  from './pages/KatilimIstekleri';
import HastaTakibi       from './pages/HastaTakibi';
import PlatformPanel     from './pages/PlatformPanel';
import HastaneYonetimi   from './pages/HastaneYonetimi';
import PlatformPaketler  from './pages/PlatformPaketler';
import PlatformKullanicilar from './pages/PlatformKullanicilar';
import KurumGruplari     from './pages/KurumGruplari';
import YetkiGruplari     from './pages/YetkiGruplari';
import GelirGider        from './pages/GelirGider';
import Faturalar         from './pages/Faturalar';
import KurumTalepleri    from './pages/KurumTalepleri';
import AktiviteLoglari   from './pages/AktiviteLoglari';
import SistemAyarlari    from './pages/SistemAyarlari';
import WebsiteYonetimi   from './pages/WebsiteYonetimi';

function mapSurgery(s){return{id:s.id,saat:s.startTime||"00:00",bitis:s.endTime||"",op:s.type||"",hasta:s.hasta?(s.hasta.name+" "+s.hasta.surname):"",dr:s.doctor?s.doctor.name:"",salon:s.room?s.room.name:"",tarih:s.date?new Date(s.date).toLocaleDateString("tr-TR"):"",tarihRaw:s.date||"",st:s.status==="Devam Ediyor"?"dot-active":s.status==="Tamamlandi"?"dot-done":"dot-wait",brans:"",sure:"",anestezi:"",durum:s.status||"Bekliyor",ekip:s.ekip||{},setler:[],malzeme:[],cihaz:[],ilac:[],tags:[],tlbl:[],hastaDetay:s.hasta||{}};}
function mapHasta(h){return{id:h.id,ad:h.name||"",soyad:h.surname||"",yas:h.birthDate?new Date().getFullYear()-new Date(h.birthDate).getFullYear():"",cinsiyet:h.gender||"",tc:h.tc||"",tel:h.phone||"",kan:h.bloodType||"",alerjiler:h.allergies||"Yok",tani:"",asaSkor:"",agirlik:"",boy:"",son:"",op:"",notlar:h.notes||""};}
function mapPersonel(p){return{id:p.id,ad:p.name||"",rol:p.specialty||"",specialty:p.specialty||"",r:p.specialty||"",av:(p.name||"").split(" ").map(function(w){return w[0]||"";}).join("").slice(0,2).toUpperCase(),bg:"#0284C7",durum:p.status||"Aktif",s:p.status||"Aktif",gun:0,tel:p.phone||"",email:p.email||"",sicil:"",uzmanlik:p.specialty||"",roleId:p.roleId||""};}
function mapRoom(r){var m=r.name.match(/\d+/);return{id:r.id,ad:r.name,_sortNum:m?parseInt(m[0]):999,durum:r.status||"Bos",active:false,brans:"",op:"",ekip:[],time:"",kapasite:r.capacity||4,cihazlar:[]};}
function mapSteril(s){return{id:s.id,ad:s.name,kod:s.code||"",adet:1,raf:s.location||"",durum:s.status||"Steril",sonSteril:s.lastSteril?new Date(s.lastSteril).toLocaleDateString("tr-TR"):"",kullanim:0};}
function useApiLoader(){
  const isLoggedIn=useAuthStore(function(s){return s.isLoggedIn;});
  const store=useDataStore();
  useEffect(function(){
    if(!isLoggedIn)return;
    var token=localStorage.getItem("operio_access");
    if(!token)return;
    var h={"Content-Type":"application/json","Authorization":"Bearer "+token};
    function get(path){return fetch("http://localhost:4000/api"+path,{headers:h}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
    Promise.all([get("/ameliyatlar"),get("/hastalar"),get("/personel"),get("/rooms"),get("/steril"),get("/kurumlar"),get("/kurumlar/gruplar"),get("/cihazlar"),get("/cihazlar/bakim"),get("/cihazlar/ariza"),get("/finans/faturalar"),get("/finans/gelir-gider"),get("/notifications")]).then(function(results){
      var a=results[0],h2=results[1],p=results[2],r=results[3],s=results[4],k=results[5],g=results[6],cih=results[7],bak=results[8],arz=results[9],fat=results[10],gg=results[11],notifs=results[12];
      if(a&&a.length)store.loadSurgeries(a.map(mapSurgery));
      if(h2&&h2.length)store.loadHastalar(h2.map(mapHasta));
      if(p&&p.length)store.loadPersonel(p.map(mapPersonel));
      if(r&&r.length)store.loadRooms(r.map(mapRoom).sort(function(a,b){return a._sortNum-b._sortNum;}));
      if(s&&s.length)store.loadSteril(s.map(mapSteril));
      if(k&&k.length)store.loadKurumlar(k.map(function(x){return{id:x.id,ad:x.name||"",tur:x.type||"",sehir:"",ilce:"",yatak:0,salonSayisi:0,kullaniciSayisi:0,durum:x.status||"Aktif",paket:"standard",abonelikBaslangic:"",abonelikBitis:"",aylikUcret:0,iletisimAd:"",iletisimTel:x.phone||"",iletisimEmail:x.email||"",grupId:x.groupId||""};}));
      if(g&&g.length)store.loadKurumGruplari(g.map(function(x){return{id:x.id,ad:x.name||"",tip:"",kurumIdler:(x.kurumlar||[]).map(function(k){return k.id;}),yetkiliAd:"",yetkiliEmail:"",toplamGelir:0,durum:"Aktif"};}));
      if(cih&&cih.length)store.loadCihazlar(cih.map(function(c){return{id:c.id,ad:c.name||"",kat:c.brand||"",sn:c.code||"",lok:c.location||"",durum:c.status||"Aktif",sonBakim:c.lastMaintDate?new Date(c.lastMaintDate).toLocaleDateString("tr-TR"):"",sonucBakim:c.nextMaintDate?new Date(c.nextMaintDate).toLocaleDateString("tr-TR"):"",kalibrasyon:"",garantiBitis:""};}));
      if(bak&&bak.length)store.loadBakimPlanlari(bak.map(function(b){return{id:b.id,cihaz:b.cihaz?b.cihaz.name:b.cihazId,tip:b.type||"Bakim",sure:"2 saat",teknisyen:"Teknisyen",tarih:b.plannedDate?new Date(b.plannedDate).toLocaleDateString("tr-TR"):"",durum:b.status||"Bekliyor",notes:b.notes||""};}));
      if(arz&&arz.length)store.loadArizalar(arz.map(function(a){return{id:a.id,cihaz:a.cihaz?a.cihaz.name:a.cihazId,bildiren:"Personel",tarih:a.createdAt?new Date(a.createdAt).toLocaleDateString("tr-TR"):"",aciklama:a.description||"",oncelik:a.severity||"Orta",durum:a.status||"Acik"};}));
      if(fat&&fat.length)store.loadFaturalar(fat.map(function(f){return{id:f.id,kurumId:f.hastaId||"",kurumAd:f.hasta?f.hasta.name+" "+f.hasta.surname:f.notes||"Fatura",tutar:f.amount||0,kesimTarihi:f.createdAt?new Date(f.createdAt).toLocaleDateString("tr-TR"):"",vadeTarihi:"",durum:f.status==="Odendi"?"Ödendi":f.status==="Gecikti"?"Gecikti":"Bekliyor",odemeTarihi:null};}));
      if(notifs&&notifs.length)store.loadBildirimler(notifs.map(function(n){return{id:n.id,tip:n.type||"sistem",baslik:n.title||"",mesaj:n.message||"",zaman:n.createdAt?new Date(n.createdAt).toLocaleString("tr-TR"):"",okundu:n.read||false,kategori:"sistem"};}));
      if(gg&&gg.length)store.loadGelirGider({items:gg,ozet:{aylikGelir:gg.filter(x=>x.type==='gelir').reduce((t,x)=>t+x.amount,0),aylikGider:gg.filter(x=>x.type==='gider').reduce((t,x)=>t+x.amount,0),netKar:0,buyumeOrani:12}});
    });
  },[isLoggedIn]);
}
function ProtectedLayout({ children }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/giris" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function SocketProvider({ children }) {
  useSocket();
  return children;
}

export default function App() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const logout     = useAuthStore(s => s.logout);
  useApiLoader();

  // Backend token refresh başarısız olduğunda (services/api.js) tam sayfa
  // reload yerine SPA içi logout — route state'ini bozmadan /giris'e düşer.
  useEffect(() => {
    function handleAuthExpired() {
      logout();
    }
    window.addEventListener('operio:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('operio:auth-expired', handleAuthExpired);
  }, [logout]);

  // Sayfa yüklendiğinde kayıtlı temayı uygula
  const savedTheme = (() => { try { return JSON.parse(localStorage.getItem('operio-theme'))?.state?.theme || 'light'; } catch { return 'light'; } })();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  return (
    <BrowserRouter>
      <SocketProvider>
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
        <Route path="/bakim-plan"        element={<ProtectedLayout><BakimPlani /></ProtectedLayout>} />
        <Route path="/kalibrasyon"       element={<ProtectedLayout><KalibrasyonKayitlari /></ProtectedLayout>} />
        <Route path="/ariza-bildirimleri" element={<ProtectedLayout><ArizaBildirimleri /></ProtectedLayout>} />
        <Route path="/is-emirleri"       element={<ProtectedLayout><IsEmirleri /></ProtectedLayout>} />
        <Route path="/cihaz-raporlari"   element={<ProtectedLayout><CihazRaporlari /></ProtectedLayout>} />
        <Route path="/servis-talepleri"  element={<ProtectedLayout><ServisTalepleri /></ProtectedLayout>} />
        <Route path="/parca-takip"       element={<ProtectedLayout><ParcaTakip /></ProtectedLayout>} />
        <Route path="/bakim-takvimi"     element={<ProtectedLayout><BakimTakvimi /></ProtectedLayout>} />
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
        <Route path="/ameliyat-detay" element={<ProtectedLayout><AmeliyatDetay /></ProtectedLayout>} />
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
        <Route path="/cihaz-kontrol" element={<ProtectedLayout><CihazKontrol /></ProtectedLayout>} />

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
        <Route path="/ilac-rehberi" element={<ProtectedLayout><IlacRehberi /></ProtectedLayout>} />
        <Route path="/abonelik"    element={<ProtectedLayout><Abonelik /></ProtectedLayout>} />
        <Route path="/fiyat"       element={<ProtectedLayout><Fiyatlandirma /></ProtectedLayout>} />

        {/* ── SUPER ADMIN (PLATFORM) ── */}
        <Route path="/platform-panel"       element={<ProtectedLayout><PlatformPanel /></ProtectedLayout>} />
        <Route path="/hastaneler"           element={<ProtectedLayout><HastaneYonetimi /></ProtectedLayout>} />
        <Route path="/platform-paketler"    element={<ProtectedLayout><PlatformPaketler /></ProtectedLayout>} />
        <Route path="/platform-kullanicilar" element={<ProtectedLayout><PlatformKullanicilar /></ProtectedLayout>} />
        <Route path="/kurum-gruplari"        element={<ProtectedLayout><KurumGruplari /></ProtectedLayout>} />
        <Route path="/yetki-gruplari"        element={<ProtectedLayout><YetkiGruplari /></ProtectedLayout>} />
        <Route path="/gelir-gider"           element={<ProtectedLayout><GelirGider /></ProtectedLayout>} />
        <Route path="/faturalar"             element={<ProtectedLayout><Faturalar /></ProtectedLayout>} />
        <Route path="/kurum-talepleri"       element={<ProtectedLayout><KurumTalepleri /></ProtectedLayout>} />
        <Route path="/aktivite-loglari"      element={<ProtectedLayout><AktiviteLoglari /></ProtectedLayout>} />
        <Route path="/sistem-ayarlari"       element={<ProtectedLayout><SistemAyarlari /></ProtectedLayout>} />
        <Route path="/website-yonetimi"      element={<ProtectedLayout><WebsiteYonetimi /></ProtectedLayout>} />

        {/* Default */}
        <Route path="/" element={<Navigate to={isLoggedIn ? '/dashboard' : '/giris'} replace />} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/dashboard' : '/giris'} replace />} />
      </Routes>

      <Toast />
      <ConnectionStatus />
      </SocketProvider>
    </BrowserRouter>
  );
}
