import { useState } from 'react';
import { useAuthStore, useThemeStore, useUIStore } from '../store';
import { ROLES } from '../data/roles';

// ── TAB KONFİGÜRASYONU (HTML satır 8324'ten birebir) ─────────
const AYARLAR_TABS = {
  ortak: ['profil','gorunum','bildirimler','guvenlik','hakkinda'],
  0:  ['profil','gorunum','bildirimler','sistem','kullanicilar','raporlar','guvenlik','hakkinda'],
  1:  ['profil','gorunum','bildirimler','ameliyathane','personel','guvenlik','hakkinda'],
  2:  ['profil','gorunum','bildirimler','ameliyathane','guvenlik','hakkinda'],
  3:  ['profil','gorunum','bildirimler','guvenlik','hakkinda'],
  4:  ['profil','gorunum','bildirimler','guvenlik','hakkinda'],
  5:  ['profil','gorunum','bildirimler','guvenlik','hakkinda'],
  6:  ['profil','gorunum','bildirimler','ameliyat','guvenlik','hakkinda'],
  7:  ['profil','gorunum','bildirimler','hasta','guvenlik','hakkinda'],
  8:  ['profil','gorunum','bildirimler','sterilizasyon','personel','guvenlik','hakkinda'],
  9:  ['profil','gorunum','bildirimler','sterilizasyon','guvenlik','hakkinda'],
  10: ['profil','gorunum','bildirimler','ameliyat','guvenlik','hakkinda'],
};

const TAB_CFG = {
  profil:       {ic:'👤', lbl:'Profil'},
  gorunum:      {ic:'🎨', lbl:'Görünüm'},
  bildirimler:  {ic:'🔔', lbl:'Bildirimler'},
  guvenlik:     {ic:'🔒', lbl:'Güvenlik'},
  sistem:       {ic:'⚙️', lbl:'Sistem'},
  kullanicilar: {ic:'👥', lbl:'Kullanıcılar'},
  raporlar:     {ic:'📊', lbl:'Raporlar'},
  ameliyathane: {ic:'🏥', lbl:'Ameliyathane'},
  ameliyat:     {ic:'🩺', lbl:'Ameliyat'},
  personel:     {ic:'👨‍⚕️',lbl:'Personel'},
  hasta:        {ic:'🗂', lbl:'Hasta'},
  sterilizasyon:{ic:'🧪', lbl:'Sterilizasyon'},
  hakkinda:     {ic:'ℹ️', lbl:'Hakkında'},
};

// ── YARDIMCI COMPONENT'LER ────────────────────────────────────
function Tog({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)}
      style={{width:40,height:22,borderRadius:20,background:on?'var(--teal)':'var(--border)',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
      <div style={{position:'absolute',top:3,left:on?18:3,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
    </div>
  );
}

function Row({ lbl, sub, children }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,marginBottom:8}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:'12.5px',fontWeight:600,color:'var(--slate)'}}>{lbl}</div>
        {sub && <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:2}}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Sel({ opts, value, onChange }) {
  return (
    <select className="fi" style={{width:140,padding:'6px 10px',fontSize:12}} value={value} onChange={e=>onChange(e.target.value)}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

function Sec({ title, children }) {
  return (
    <div className="modal-section">
      <div className="modal-stitle">{title}</div>
      {children}
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function Ayarlar() {
  const { curRole } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { showToast } = useUIStore();
  const rol = ROLES[curRole] || ROLES[0];
  const isDark = theme === 'dark';

  const [aktifTab, setAktifTab] = useState('profil');
  const [prefs, setPrefs] = useState({
    bildirim_ameliyat: true, bildirim_steril: true, bildirim_erteleme: true,
    bildirim_randevu: true, bildirim_eksik: true, bildirim_otoklav: false,
    bildirim_sistem: false, bildirim_ses: true, bildirim_masaustu: false,
    bildirim_dnd: false, bildirim_dnd_bas: '22:00', bildirim_dnd_bit: '07:00',
    gorunum_yogun: false, gorunum_animasyon: true, gorunum_font: 'Normal', dil: 'Türkçe',
    sidebar_auto: false, sidebar_badge: true,
    guvenlik_2fa: false, guvenlik_oturum: '30 dk', guvenlik_hatirla: false,
    ameliyat_onay_gerektir: true, takvim_gorunum: 'Haftalık', erken_uyari: '15 dk',
    salon_otomatik: true, salon_cakisma: true, temizlik_suresi: '30 dk',
    vardiya_cakisma: true, min_ekip: false,
    vardiya_otomatik: false, haftalik_saat: '48 saat', izin_otomatik: false,
    mesai_katsayi: '1.5x', gece_farki: true,
    raf_omur_uyari: true, steril_sure: '30 gün', stok_esik: true,
    steril_rapor: false, steril_rapor_fmt: 'PDF',
    otoklav_uyari: '30 dk', steril_otomatik: false, steril_qr: true,
    hasta_oto_id: true, hasta_tc: true, hasta_kurum: 'Merkez Devlet Hastanesi',
    hasta_gizle: false, erisim_log: true,
    takvim_oto: true, hasta_bilgi: false, salon_tercih: 'Fark etmez',
    kart_otokaydet: true, pdf_sablon: 'Standart',
    otomatik_yedek: true, yedek_sikligi: 'Günlük',
    hbys: true, enabiz: false, api: false,
    kullanici_oto_onay: false, email_dogrulama: true, misafir_hekim: true,
    rbac: true, coklu_rol: false, guclu_sifre: true,
    maks_oturum: '8 saat', coklu_oturum: true,
    rapor_gunluk: true, rapor_haftalik: true, rapor_aylik: false,
    rapor_fmt: 'PDF', rapor_logo: true, rapor_grafik: true,
  });
  const [sifre, setSifre] = useState({ mevcut:'', yeni:'', tekrar:'' });
  const [kayitMsg, setKayitMsg] = useState('');

  const p = (key) => prefs[key];
  const setP = (key, val) => setPrefs(prev => ({...prev, [key]: val}));
  const tog = (key) => <Tog on={p(key)} onChange={v => setP(key, v)}/>;
  const sel = (key, opts) => <Sel opts={opts} value={p(key)} onChange={v => setP(key, v)}/>;

  function kaydet() {
    setKayitMsg('✓ Değişiklikler kaydedildi');
    showToast('Ayarlar kaydedildi ✓');
    setTimeout(() => setKayitMsg(''), 3000);
  }

  const tabs = AYARLAR_TABS[curRole] || AYARLAR_TABS.ortak;

  // ── TAB İÇERİKLERİ ───────────────────────────────────────────
  function renderTab() {
    switch (aktifTab) {

      case 'profil': return (
        <>
          <Sec title="Profil Bilgileri">
            <div style={{display:'flex',alignItems:'center',gap:16,padding:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,marginBottom:8}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${rol.bg},${rol.bg}99)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'white',flexShrink:0,border:`3px solid ${rol.bg}44`}}>{rol.av}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>{rol.full}</div>
                <div style={{fontSize:'11.5px',color:'var(--teal)',fontWeight:600,marginTop:3}}>{rol.name}</div>
                <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:2}}>Merkez Devlet Hastanesi</div>
              </div>
              <button className="btn btn-secondary btn-sm">Profili Düzenle →</button>
            </div>
          </Sec>
          <Sec title="Kişisel Bilgiler">
            <div className="fr" style={{marginBottom:8}}>
              <div className="fg"><label className="fl">Ad Soyad</label><input className="fi" defaultValue={rol.full} placeholder="Ad Soyad"/></div>
              <div className="fg"><label className="fl">Unvan</label><input className="fi" defaultValue={rol.name} placeholder="Unvan"/></div>
            </div>
            <div className="fr" style={{marginBottom:8}}>
              <div className="fg"><label className="fl">E-posta</label><input className="fi" defaultValue={`${rol.name.toLowerCase().replace(/\s/g,'.')}@hastane.gov.tr`}/></div>
              <div className="fg"><label className="fl">Telefon</label><input className="fi" defaultValue="+90 532 123 4567"/></div>
            </div>
            <div className="fg"><label className="fl">Biyografi / Not</label><textarea className="fi" rows={2} placeholder="Kendiniz hakkında kısa bir not…"/></div>
          </Sec>
          <Sec title="Kimlik & Sicil">
            <div className="fr">
              <div className="fg"><label className="fl">Sicil No</label><input className="fi" defaultValue={`HN-2025${String(curRole+1).padStart(3,'0')}`} readOnly style={{opacity:0.6}}/></div>
              <div className="fg"><label className="fl">Branş / Birim</label><input className="fi" defaultValue={rol.name.includes('Steril')?'Sterilizasyon Birimi':rol.name.includes('Anestezi')?'Anesteziyoloji':rol.name.includes('Doktor')?'Genel Cerrahi':'Ameliyathane'}/></div>
            </div>
          </Sec>
        </>
      );

      case 'gorunum': return (
        <>
          <Sec title="Tema">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:8}}>
              {[{id:'light',ic:'☀️',lbl:'Açık Mod',alt:'Yeşil tonlu arka plan'},{id:'dark',ic:'🌙',lbl:'Koyu Mod',alt:'Gözlere daha az yük'}].map(t=>(
                <div key={t.id} onClick={() => setTheme(t.id)}
                  style={{padding:16,border:`2px solid ${theme===t.id?'var(--teal)':'var(--border)'}`,borderRadius:12,cursor:'pointer',textAlign:'center',background:theme===t.id?'rgba(20,184,166,0.06)':'var(--surface)'}}>
                  <div style={{fontSize:28,marginBottom:8}}>{t.ic}</div>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>{t.lbl}</div>
                  <div style={{fontSize:10,color:'var(--slate-light)',marginTop:2}}>{t.alt}</div>
                  {theme===t.id && <div style={{marginTop:8,fontSize:'9.5px',fontWeight:700,color:'var(--teal)',background:'rgba(20,184,166,0.1)',padding:'3px 10px',borderRadius:20,display:'inline-block'}}>✓ Aktif</div>}
                </div>
              ))}
            </div>
          </Sec>
          <Sec title="Arayüz">
            <Row lbl="Yoğun Mod" sub="Daha fazla bilgiyi ekranda göster">{tog('gorunum_yogun')}</Row>
            <Row lbl="Animasyonlar" sub="Geçiş ve açılma animasyonları">{tog('gorunum_animasyon')}</Row>
            <Row lbl="Font Boyutu" sub="Metin büyüklüğü">{sel('gorunum_font',['Küçük','Normal','Büyük'])}</Row>
            <Row lbl="Dil" sub="Arayüz dili">{sel('dil',['Türkçe','English'])}</Row>
          </Sec>
          <Sec title="Kenar Çubuğu">
            <Row lbl="Otomatik Daralt" sub="Menüyü hover ile genişlet">{tog('sidebar_auto')}</Row>
            <Row lbl="Rozetleri Göster" sub="Okunmamış sayısını göster">{tog('sidebar_badge')}</Row>
          </Sec>
        </>
      );

      case 'bildirimler': return (
        <>
          <Sec title="Ameliyat Bildirimleri">
            <Row lbl="Ameliyat Başlangıcı" sub="Ameliyat başlamadan 15 dk önce uyar">{tog('bildirim_ameliyat')}</Row>
            <Row lbl="Erteleme & İptal" sub="Ameliyat planı değişikliklerini bildir">{tog('bildirim_erteleme')}</Row>
            <Row lbl="Randevu Onayı" sub="Yeni ameliyat talebi ve onayları">{tog('bildirim_randevu')}</Row>
          </Sec>
          {(curRole<=2||curRole===8) && (
            <Sec title="Sterilizasyon Uyarıları">
              <Row lbl="Set Süresi Dolmak Üzere" sub="Steril raf ömrü bitmeden uyar">{tog('bildirim_steril')}</Row>
              <Row lbl="Eksik Alet Bildirimi" sub="Sayım uyuşmazlıklarında uyar">{tog('bildirim_eksik')}</Row>
              <Row lbl="Otoklav Tamamlandı" sub="Sterilizasyon döngüsü bitince bildir">{tog('bildirim_otoklav')}</Row>
            </Sec>
          )}
          <Sec title="Sistem & Genel">
            <Row lbl="Sistem Duyuruları" sub="Bakım ve güncelleme bildirimleri">{tog('bildirim_sistem')}</Row>
            <Row lbl="Sesli Uyarı" sub="Kritik bildirimlerde ses çal">{tog('bildirim_ses')}</Row>
            <Row lbl="Masaüstü Bildirimi" sub="Tarayıcı bildirimleri">{tog('bildirim_masaustu')}</Row>
          </Sec>
          <Sec title="Bildirim Saatleri">
            <Row lbl="Rahatsız Etme" sub="Belirli saatler arası bildirimleri sustur">{tog('bildirim_dnd')}</Row>
            <div style={{display:'flex',gap:10,marginTop:6}}>
              <div className="fg" style={{flex:1}}><label className="fl">Başlangıç</label><input className="fi" type="time" value={p('bildirim_dnd_bas')} onChange={e=>setP('bildirim_dnd_bas',e.target.value)}/></div>
              <div className="fg" style={{flex:1}}><label className="fl">Bitiş</label><input className="fi" type="time" value={p('bildirim_dnd_bit')} onChange={e=>setP('bildirim_dnd_bit',e.target.value)}/></div>
            </div>
          </Sec>
        </>
      );

      case 'guvenlik': return (
        <>
          <Sec title="Şifre">
            <div className="fg" style={{marginBottom:8}}><label className="fl">Mevcut Şifre</label><input className="fi" type="password" placeholder="••••••••" value={sifre.mevcut} onChange={e=>setSifre(p=>({...p,mevcut:e.target.value}))}/></div>
            <div className="fr" style={{marginBottom:8}}>
              <div className="fg"><label className="fl">Yeni Şifre</label><input className="fi" type="password" placeholder="En az 8 karakter" value={sifre.yeni} onChange={e=>setSifre(p=>({...p,yeni:e.target.value}))}/></div>
              <div className="fg"><label className="fl">Tekrar</label><input className="fi" type="password" placeholder="Yeni şifreyi tekrar girin" value={sifre.tekrar} onChange={e=>setSifre(p=>({...p,tekrar:e.target.value}))}/></div>
            </div>
            <button className="btn btn-secondary btn-sm" style={{fontSize:11}} onClick={()=>showToast('Şifre güncellendi ✓')}>Şifreyi Güncelle</button>
          </Sec>
          <Sec title="Oturum Güvenliği">
            <Row lbl="İki Faktörlü Doğrulama" sub="SMS veya Authenticator ile ekstra güvenlik">{tog('guvenlik_2fa')}</Row>
            <Row lbl="Oturum Süresi" sub="Hareketsizlik sonrası otomatik çıkış">{sel('guvenlik_oturum',['15 dk','30 dk','1 saat','4 saat','Hiçbir zaman'])}</Row>
            <Row lbl="Cihazı Hatırla" sub="Bu cihazda 30 gün oturumu açık tut">{tog('guvenlik_hatirla')}</Row>
          </Sec>
          <Sec title="Aktif Oturumlar">
            {[{cihaz:'Chrome — Windows 11',konum:'İstanbul, TR',sure:'Şu an aktif',aktif:true},{cihaz:'Safari — iPhone 15',konum:'İstanbul, TR',sure:'2 saat önce',aktif:false}].map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,marginBottom:6}}>
                <div style={{width:36,height:36,borderRadius:9,background:'rgba(20,184,166,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>💻</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--slate)'}}>{s.cihaz}</div>
                  <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{s.konum} · {s.sure}</div>
                </div>
                <span style={{fontSize:'9.5px',fontWeight:700,color:s.aktif?'var(--success)':'var(--slate-light)'}}>{s.aktif?'● Aktif':'Sonlandır'}</span>
              </div>
            ))}
          </Sec>
        </>
      );

      case 'ameliyathane': return (
        <>
          <Sec title="Ameliyat Akışı">
            <Row lbl="Onay Gerektir" sub="Ameliyat planı değişikliklerinde onay iste">{tog('ameliyat_onay_gerektir')}</Row>
            <Row lbl="Takvim Görünümü" sub="Varsayılan takvim modu">{sel('takvim_gorunum',['Günlük','Haftalık','Aylık'])}</Row>
            <Row lbl="Erken Uyarı Süresi" sub="Ameliyat başlamadan kaç dk önce uyarı">{sel('erken_uyari',['5 dk','10 dk','15 dk','30 dk'])}</Row>
          </Sec>
          <Sec title="Salon Yönetimi">
            <Row lbl="Otomatik Salon Ata" sub="Müsait salonu otomatik öner">{tog('salon_otomatik')}</Row>
            <Row lbl="Çakışma Uyarısı" sub="Aynı salone çift rezervasyon önle">{tog('salon_cakisma')}</Row>
            <Row lbl="Temizlik Süresi" sub="Ameliyatlar arası zorunlu temizlik süresi">{sel('temizlik_suresi',['15 dk','30 dk','45 dk','1 saat'])}</Row>
          </Sec>
          <Sec title="Ekip Planlaması">
            <Row lbl="Vardiya Çakışması" sub="Fazla mesai çakışmalarında uyar">{tog('vardiya_cakisma')}</Row>
            <Row lbl="Minimum Ekip" sub="Eksik ekip üyesiyle ameliyat onaylama">{tog('min_ekip')}</Row>
          </Sec>
        </>
      );

      case 'ameliyat': return (
        <>
          <Sec title="Ameliyat Talepleri">
            <Row lbl="Otomatik Takvim" sub="Uygun zamanı otomatik öner">{tog('takvim_oto')}</Row>
            <Row lbl="Hasta Bilgilendirme" sub="Ameliyat bilgisi hastaya otomatik gönderilsin">{tog('hasta_bilgi')}</Row>
            <Row lbl="Tercih Edilen Salon" sub="Varsayılan salon tercihi">{sel('salon_tercih',['Fark etmez','Salon 1','Salon 2','Salon 3','Salon 4'])}</Row>
          </Sec>
          <Sec title="Ameliyat Kartları">
            <Row lbl="Otomatik Kaydet" sub="Formu düzenlerken otomatik kaydet">{tog('kart_otokaydet')}</Row>
            <Row lbl="PDF Şablonu" sub="Ameliyat kartı çıktı formatı">{sel('pdf_sablon',['Standart','Detaylı','Özet'])}</Row>
          </Sec>
        </>
      );

      case 'personel': return (
        <>
          <Sec title="Çalışma Listesi">
            <Row lbl="Otomatik Vardiya" sub="Eşit dağılımlı otomatik program oluştur">{tog('vardiya_otomatik')}</Row>
            <Row lbl="Haftalık Saat Limiti" sub="Haftada maksimum çalışma saati">{sel('haftalik_saat',['40 saat','48 saat','56 saat','Sınırsız'])}</Row>
            <Row lbl="İzin Onayı" sub="İzin taleplerini otomatik onayla">{tog('izin_otomatik')}</Row>
          </Sec>
          <Sec title="Mesai Hesaplama">
            <Row lbl="Mesai Katsayısı" sub="Fazla mesai ücret çarpanı">{sel('mesai_katsayi',['1.5x','2x','2.5x'])}</Row>
            <Row lbl="Gece Farkı" sub="Gece vardiyası ek ücret hesapla">{tog('gece_farki')}</Row>
          </Sec>
        </>
      );

      case 'sterilizasyon': return (
        <>
          <Sec title="Set Takip">
            <Row lbl="Otoklav Süre Uyarısı" sub="Sterilizasyon dolmadan kaç dk önce uyar">{sel('otoklav_uyari',['15 dk','30 dk','45 dk','1 saat'])}</Row>
            <Row lbl="Otomatik Akış" sub="Sayım onayı sonrası sonraki adıma geç">{tog('steril_otomatik')}</Row>
            <Row lbl="QR Zorunluluğu" sub="Adım geçişlerinde QR tarama zorunlu olsun">{tog('steril_qr')}</Row>
          </Sec>
          <Sec title="Steril Depo">
            <Row lbl="Raf Ömrü Uyarısı" sub="Steril raf ömrü bitmeden uyar">{tog('raf_omur_uyari')}</Row>
            <Row lbl="Varsayılan Süre" sub="Otoklav sonrası standart steril raf süresi">{sel('steril_sure',['30 gün','60 gün','90 gün','180 gün'])}</Row>
            <Row lbl="Stok Uyarı Eşiği" sub="Kritik stok seviyesi bildir">{tog('stok_esik')}</Row>
          </Sec>
          <Sec title="Raporlama">
            <Row lbl="Otomatik Rapor" sub="Günlük sterilizasyon raporu oluştur">{tog('steril_rapor')}</Row>
            <Row lbl="Rapor Formatı" sub="Çıktı formatı">{sel('steril_rapor_fmt',['PDF','Excel','Her ikisi'])}</Row>
          </Sec>
        </>
      );

      case 'hasta': return (
        <>
          <Sec title="Hasta Kaydı">
            <Row lbl="Otomatik Numara" sub="Hasta ID otomatik atansın">{tog('hasta_oto_id')}</Row>
            <Row lbl="TC Doğrulama" sub="Kayıtta TC kimlik doğrulaması">{tog('hasta_tc')}</Row>
            <Row lbl="Varsayılan Kurum" sub="Yeni hasta için varsayılan hastane">{sel('hasta_kurum',['Merkez Devlet Hastanesi','Eğitim Araştırma','Özel Klinik'])}</Row>
          </Sec>
          <Sec title="Gizlilik">
            <Row lbl="Hasta Bilgisi Gizle" sub="Hasta adlarını maskeleyerek göster">{tog('hasta_gizle')}</Row>
            <Row lbl="Erişim Logu" sub="Hasta dosyası erişimlerini kaydet">{tog('erisim_log')}</Row>
          </Sec>
        </>
      );

      case 'sistem': return (
        <>
          <Sec title="Kurum Ayarları">
            <div className="fg" style={{marginBottom:8}}><label className="fl">Kurum Adı</label><input className="fi" defaultValue="Merkez Devlet Hastanesi"/></div>
            <div className="fr">
              <div className="fg"><label className="fl">Kurum Kodu</label><input className="fi" defaultValue="MDH-001"/></div>
              <div className="fg"><label className="fl">İl</label><input className="fi" defaultValue="İstanbul"/></div>
            </div>
          </Sec>
          <Sec title="Veri & Yedek">
            <Row lbl="Otomatik Yedek" sub="Günlük otomatik yedekleme">{tog('otomatik_yedek')}</Row>
            <Row lbl="Yedek Sıklığı" sub="Yedekleme periyodu">{sel('yedek_sikligi',['Saatlik','Günlük','Haftalık'])}</Row>
            <button className="btn btn-secondary btn-sm" style={{marginTop:6,fontSize:11}} onClick={()=>showToast('Manuel yedek alınıyor…')}>Manuel Yedek Al</button>
          </Sec>
          <Sec title="Entegrasyon">
            <Row lbl="HBYS Entegrasyonu" sub="Hastane Bilgi Yönetim Sistemi bağlantısı">{tog('hbys')}</Row>
            <Row lbl="E-Nabız" sub="E-Nabız sistem entegrasyonu">{tog('enabiz')}</Row>
            <Row lbl="API Erişimi" sub="Harici sistem API erişimi">{tog('api')}</Row>
          </Sec>
        </>
      );

      case 'kullanicilar': return (
        <>
          <Sec title="Kayıt & Onay">
            <Row lbl="Otomatik Onay" sub="Yeni kullanıcı kaydını otomatik onayla">{tog('kullanici_oto_onay')}</Row>
            <Row lbl="E-posta Doğrulama" sub="Kayıtta e-posta doğrulama zorunlu">{tog('email_dogrulama')}</Row>
            <Row lbl="Misafir Hekim Erişimi" sub="Geçici hekim kaydına izin ver">{tog('misafir_hekim')}</Row>
          </Sec>
          <Sec title="Yetki Politikası">
            <Row lbl="Rol Tabanlı Erişim" sub="RBAC politikası uygula">{tog('rbac')}</Row>
            <Row lbl="Çoklu Rol" sub="Kullanıcıya birden fazla rol atanabilsin">{tog('coklu_rol')}</Row>
            <Row lbl="Şifre Politikası" sub="Güçlü şifre zorunluluğu">{tog('guclu_sifre')}</Row>
          </Sec>
          <Sec title="Oturum Politikası">
            <Row lbl="Maks. Oturum Süresi" sub="Kullanıcıların en uzun oturum süresi">{sel('maks_oturum',['1 saat','4 saat','8 saat','24 saat'])}</Row>
            <Row lbl="Eşzamanlı Oturum" sub="Aynı kullanıcı birden fazla cihazda girebilsin">{tog('coklu_oturum')}</Row>
          </Sec>
        </>
      );

      case 'raporlar': return (
        <>
          <Sec title="Otomatik Raporlar">
            <Row lbl="Günlük Özet" sub="Her gün saat 08:00'de özet rapor">{tog('rapor_gunluk')}</Row>
            <Row lbl="Haftalık İstatistik" sub="Pazartesi haftalık istatistik raporu">{tog('rapor_haftalik')}</Row>
            <Row lbl="Aylık Analiz" sub="Aylık detaylı analiz raporu">{tog('rapor_aylik')}</Row>
          </Sec>
          <Sec title="Rapor Formatı">
            <Row lbl="Varsayılan Format" sub="Rapor çıktı formatı">{sel('rapor_fmt',['PDF','Excel','Her ikisi'])}</Row>
            <Row lbl="Logo Ekle" sub="Rapor başlığına kurum logosu ekle">{tog('rapor_logo')}</Row>
            <Row lbl="İstatistik Grafikler" sub="Raporlara grafik ve tablo ekle">{tog('rapor_grafik')}</Row>
          </Sec>
        </>
      );

      case 'hakkinda': return (
        <>
          <div style={{textAlign:'center',padding:'24px 0 16px'}}>
            <div style={{width:72,height:72,borderRadius:20,background:'linear-gradient(135deg,#0F766E,#14B8A6)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 8px 24px rgba(20,184,166,0.3)'}}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.5px'}}>Operio</div>
            <div style={{fontSize:12,color:'var(--slate-light)',marginTop:4}}>Ameliyathane Yönetim Sistemi</div>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:10,padding:'5px 14px',borderRadius:20,background:'rgba(5,150,105,0.1)',border:'1px solid rgba(5,150,105,0.2)'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'var(--success)'}}/>
              <span style={{fontSize:11,fontWeight:700,color:'var(--success)'}}>v1.39 · Güncel</span>
            </div>
          </div>
          <Sec title="Sistem Bilgisi">
            {[{lbl:'Versiyon',val:'1.39.0'},{lbl:'Son Güncelleme',val:'20 Mayıs 2026'},{lbl:'Lisans',val:'Kurumsal'},{lbl:'Sunucu',val:'TR-MER-01'},{lbl:'Veritabanı',val:'PostgreSQL 16'},{lbl:'Aktif Kullanıcı',val:'24'}].map(i=>(
              <div key={i.lbl} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:12,color:'var(--slate-light)'}}>{i.lbl}</span>
                <span style={{fontSize:12,fontWeight:600,color:'var(--slate)'}}>{i.val}</span>
              </div>
            ))}
          </Sec>
          <Sec title="Destek">
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="btn btn-secondary btn-sm" style={{fontSize:11}} onClick={()=>showToast('Kılavuz açılıyor…')}>📖 Kullanım Kılavuzu</button>
              <button className="btn btn-secondary btn-sm" style={{fontSize:11}} onClick={()=>showToast('Hata bildirimi açılıyor…')}>🐛 Hata Bildir</button>
              <button className="btn btn-secondary btn-sm" style={{fontSize:11}} onClick={()=>showToast('Öneri formu açılıyor…')}>💡 Öneri Gönder</button>
            </div>
          </Sec>
        </>
      );

      default: return <div className="empty"><div className="empty-text">Bu sekme yakında</div></div>;
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Başlık */}
      <div style={{padding:'0 0 16px',flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Ayarlar</div>
        <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>{rol.name} · Sistem ve görünüm tercihleri</div>
      </div>

      {/* 2 kolon layout */}
      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:14,flex:1,overflow:'hidden'}}>

        {/* Sol: Tab menüsü */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:2}}>
          {tabs.map(t => {
            const cfg = TAB_CFG[t];
            const isActive = aktifTab === t;
            return (
              <div key={t} onClick={() => setAktifTab(t)}
                style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:600,transition:'all 0.12s',
                  background: isActive ? 'rgba(20,184,166,0.1)' : 'transparent',
                  color: isActive ? 'var(--teal)' : 'var(--slate-mid)'}}>
                <span style={{fontSize:15,lineHeight:1}}>{cfg.ic}</span>
                <span>{cfg.lbl}</span>
              </div>
            );
          })}
        </div>

        {/* Sağ: İçerik */}
        <div style={{background:'var(--card-bg)',border:'1.5px solid var(--border)',borderRadius:16,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:1,overflowY:'auto',padding:'20px 22px'}}>
            {renderTab()}
          </div>
          {/* Footer */}
          <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:12,background:'var(--surface)',flexShrink:0}}>
            <span style={{fontSize:11,color:'var(--success)',fontWeight:600}}>{kayitMsg}</span>
            <button className="btn btn-secondary btn-sm" style={{fontSize:11}}>İptal</button>
            <button className="btn btn-primary btn-sm" style={{fontSize:11}} onClick={kaydet}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:11,height:11}}><polyline points="20 6 9 17 4 12"/></svg>
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
