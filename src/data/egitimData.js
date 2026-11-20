// ── EĞİTİM ORTAK VERİ (HTML satır 6393-6419, 7157-7175 birebir) ──

export const EGITIM_KATEGORILER = ['Hasta Güvenliği','Enfeksiyon Kontrol','Anestezi','Sterilizasyon','Cerrahi Teknik','Acil Müdahale','Ekipman Kullanımı','Mevzuat & Etik','Yangın & Tahliye','Diğer'];

export const SORUMLULAR = [
  {ad:'Hem. Fatma Şahin',    rol:'Ameliyathane Sorumlu Hemşiresi'},
  {ad:'Uzm. Kemal Arslan',  rol:'Anestezi Sorumlusu'},
  {ad:'Srl. Meral Doğan',   rol:'Sterilizasyon Sorumlusu'},
  {ad:'Dr. Ahmet Yılmaz',   rol:'Doktor'},
  {ad:'Dr. Üst Yönetici',   rol:'Üst Yönetici'},
  {ad:'Hem. Ayşe Korkmaz',  rol:'Hemşire'},
  {ad:'Aml. Hasan Öz',      rol:'Ameliyathane Personeli'},
];

export const INIT_EGITIMLER = [
  {id:1,baslik:'Ameliyathane Enfeksiyon Kontrol Protokolleri',kategori:'Enfeksiyon Kontrol',aciklama:'El hijyeni, steril alan yönetimi, kişisel koruyucu ekipman kullanımı ve ameliyathane temizlik prosedürleri hakkında kapsamlı eğitim.',egitmen:'Hem. Fatma Şahin',egitmenRol:'Ameliyathane Sorumlu Hemşiresi',hedefKitle:['Hemşire','Ameliyathane Personeli','Anestezi Teknisyeni'],tarih:'2026-06-05',saat:'09:00',sure:120,yer:'Konferans Salonu A',kapasite:20,kayitli:14,durum:'yayinda',tip:'yüz_yüze',zorunlu:true,renk:'#0284C7',ikon:'🦠',malzeme:[{ad:'El Hijyeni Protokol Kılavuzu',tip:'pdf'},{ad:'KKE Kullanım Videosu',tip:'video'}],katilimci:[],tamamlayan:8,taslak:false,olusturanRol:1},
  {id:2,baslik:'Spinal Anestezi Teknik Eğitimi',kategori:'Anestezi',aciklama:'Spinal anestezi endikasyonları, kontrendikasyonlar, uygulama tekniği, komplikasyon yönetimi ve hasta takibi konularında ileri düzey eğitim.',egitmen:'Uzm. Kemal Arslan',egitmenRol:'Anestezi Sorumlusu',hedefKitle:['Anestezi Teknisyeni'],tarih:'2026-06-12',saat:'14:00',sure:90,yer:'Simülasyon Odası',kapasite:8,kayitli:5,durum:'yayinda',tip:'yüz_yüze',zorunlu:false,renk:'#7C3AED',ikon:'💉',malzeme:[{ad:'Spinal Anestezi Protokol Dökümanı',tip:'pdf'},{ad:'Komplikasyon Yönetim Slaytları',tip:'slayt'}],katilimci:[],tamamlayan:0,taslak:false,olusturanRol:2},
  {id:3,baslik:'Otoklav ve Sterilizasyon Doğrulama Prosedürleri',kategori:'Sterilizasyon',aciklama:'Otoklav parametreleri, biyolojik indikatör kullanımı, sterilizasyon başarısızlıklarında yapılacaklar ve dokümantasyon gereklilikleri.',egitmen:'Srl. Meral Doğan',egitmenRol:'Sterilizasyon Sorumlusu',hedefKitle:['Sterilizasyon Personeli'],tarih:'2026-06-18',saat:'10:00',sure:60,yer:'Sterilizasyon Birimi',kapasite:6,kayitli:6,durum:'yayinda',tip:'yüz_yüze',zorunlu:true,renk:'#0891b2',ikon:'🧪',malzeme:[{ad:'Otoklav Kullanım Kılavuzu',tip:'pdf'}],katilimci:[],tamamlayan:0,taslak:false,olusturanRol:8},
  {id:4,baslik:'Acil Resüsitasyon & Kardiyopulmoner Canlandırma',kategori:'Acil Müdahale',aciklama:'Temel yaşam desteği, ileri kardiyak yaşam desteği, defibrilatör kullanımı ve ameliyathanede arrest yönetimi.',egitmen:'Dr. Ahmet Yılmaz',egitmenRol:'Doktor',hedefKitle:['Hemşire','Anestezi Teknisyeni','Ameliyathane Personeli'],tarih:'2026-06-25',saat:'13:00',sure:180,yer:'Konferans Salonu B',kapasite:25,kayitli:18,durum:'yayinda',tip:'yüz_yüze',zorunlu:true,renk:'#DC2626',ikon:'❤️',malzeme:[{ad:'ACLS Protokol Kılavuzu',tip:'pdf'},{ad:'Defibrilatör Kullanım Videosu',tip:'video'},{ad:'Vaka Senaryoları',tip:'slayt'}],katilimci:[],tamamlayan:0,taslak:false,olusturanRol:0},
  {id:5,baslik:'Hasta Kimlik Doğrulama ve Güvenli Cerrahi Kontrol Listesi',kategori:'Hasta Güvenliği',aciklama:'WHO cerrahi güvenlik kontrol listesi uygulaması, hasta kimlik doğrulama prosedürleri ve Time-Out protokolü.',egitmen:'Hem. Fatma Şahin',egitmenRol:'Ameliyathane Sorumlu Hemşiresi',hedefKitle:['Hemşire','Ameliyathane Personeli','Doktor'],tarih:'2026-07-03',saat:'08:30',sure:90,yer:'Ameliyathane Salon 1',kapasite:15,kayitli:9,durum:'yayinda',tip:'yüz_yüze',zorunlu:true,renk:'#059669',ikon:'✅',malzeme:[{ad:'WHO Cerrahi Kontrol Listesi',tip:'pdf'}],katilimci:[],tamamlayan:0,taslak:false,olusturanRol:1},
  {id:6,baslik:'Laparoskopik Ekipman Kullanımı ve Bakımı',kategori:'Ekipman Kullanımı',aciklama:'CO₂ insüflator, kamera sistemi, trokar ve laparoskopik alet bakım ve sorun giderme eğitimi.',egitmen:'Hem. Ayşe Korkmaz',egitmenRol:'Hemşire & Ameliyathane Teknikeri',hedefKitle:['Hemşire','Ameliyathane Personeli'],tarih:'2026-07-10',saat:'10:00',sure:120,yer:'Ekipman Odası',kapasite:10,kayitli:6,durum:'taslak',tip:'yüz_yüze',zorunlu:false,renk:'#D97706',ikon:'🔧',malzeme:[],katilimci:[],tamamlayan:0,taslak:true,olusturanRol:1},
  {id:7,baslik:'Yıllık Yangın Tahliye Tatbikatı ve Eğitimi',kategori:'Yangın & Tahliye',aciklama:'Yangın güvenliği prosedürleri, tahliye planları ve yangın söndürme ekipmanı kullanımı.',egitmen:'Aml. Hasan Öz',egitmenRol:'Ameliyathane Personeli',hedefKitle:['Tüm Personel'],tarih:'2026-04-15',saat:'11:00',sure:60,yer:'Tüm Katlar',kapasite:50,kayitli:48,durum:'tamamlandi',tip:'yüz_yüze',zorunlu:true,renk:'#EA580C',ikon:'🔥',malzeme:[{ad:'Tahliye Planı',tip:'pdf'}],katilimci:[],tamamlayan:48,taslak:false,olusturanRol:0},
  {id:8,baslik:'KVKK ve Hasta Veri Gizliliği Eğitimi',kategori:'Mevzuat & Etik',aciklama:'Kişisel verilerin korunması kanunu kapsamında sağlık verilerinin işlenmesi, saklanması ve paylaşım kuralları.',egitmen:'Dr. Üst Yönetici',egitmenRol:'Üst Yönetici',hedefKitle:['Tüm Personel'],tarih:'2026-03-20',saat:'14:00',sure:90,yer:'Konferans Salonu A',kapasite:40,kayitli:35,durum:'tamamlandi',tip:'online',zorunlu:true,renk:'#6366F1',ikon:'🔒',malzeme:[{ad:'KVKK Eğitim Sunumu',tip:'slayt'},{ad:'Sınav Soruları',tip:'pdf'}],katilimci:[],tamamlayan:35,taslak:false,olusturanRol:0},
];

export const SUNUM_TEMALAR = [
  {id:'koyu',    ad:'Koyu',    bg:'linear-gradient(135deg,#0f172a,#1e293b)', metin:'white', vurgu:'#14B8A6'},
  {id:'teal',    ad:'Teal',    bg:'linear-gradient(135deg,#0F766E,#0891b2)', metin:'white', vurgu:'#fff'},
  {id:'mor',     ad:'Mor',     bg:'linear-gradient(135deg,#4c1d95,#7C3AED)', metin:'white', vurgu:'#A78BFA'},
  {id:'mavi',    ad:'Mavi',    bg:'linear-gradient(135deg,#1e3a5f,#0284C7)', metin:'white', vurgu:'#38BDF8'},
  {id:'kirmizi', ad:'Kırmızı', bg:'linear-gradient(135deg,#7f1d1d,#DC2626)', metin:'white', vurgu:'#FCA5A5'},
  {id:'acik',    ad:'Açık',    bg:'linear-gradient(135deg,#f8fafc,#e2e8f0)', metin:'#0F172A',vurgu:'#0F766E'},
];

export const SLAYT_TIPLERI = [
  {id:'baslik',ad:'Başlık Sayfası',ikon:'🎯'},
  {id:'icerik',ad:'İçerik',ikon:'📝'},
  {id:'liste',ad:'Madde Listesi',ikon:'📋'},
  {id:'gorsel',ad:'Görsel + Metin',ikon:'🖼'},
  {id:'alinti',ad:'Alıntı / Vurgu',ikon:'💬'},
  {id:'soru',ad:'Test Sorusu',ikon:'❓'},
  {id:'bolum',ad:'Bölüm Ayraç',ikon:'🔷'},
  {id:'kapak',ad:'Teşekkür / Kapanış',ikon:'🎉'},
];

export function sunumInitVeri(SUNUM_VERI, egitimId, egitimler) {
  if (SUNUM_VERI[egitimId]) return;
  const e = egitimler.find(x => x.id === egitimId);
  SUNUM_VERI[egitimId] = {
    tema: 'koyu',
    slaytlar: [
      {tip:'baslik',baslik:e?.baslik||'Eğitim Sunumu',altBaslik:(e?.egitmen||'')+(e?.egitmenRol?' · '+e.egitmenRol:''),ikon:e?.ikon||'📚',not:'Hoş geldiniz mesajı ile başlayın.'},
      {tip:'bolum',baslik:'Eğitim Hakkında',alt:e?.kategori||'',renk:e?.renk||'#14B8A6',not:'Bu bölümde eğitimin amacını anlatın.'},
      {tip:'icerik',baslik:'Konu Özeti',metin:e?.aciklama||'Eğitim içeriği buraya eklenecektir.',not:'Açıklamayı kendi cümlelerinizle genişletin.'},
      {tip:'liste',baslik:'Öğrenme Hedefleri',maddeler:['Bu eğitimin sonunda katılımcılar…','Birinci hedef','İkinci hedef','Üçüncü hedef'],not:'Her maddeyi net ve ölçülebilir yazın.'},
      {tip:'bolum',baslik:'Uygulama',alt:'Pratik bilgiler ve prosedürler',renk:e?.renk||'#14B8A6',not:''},
      {tip:'icerik',baslik:'Temel Noktalar',metin:'Bu alana konunun temel noktalarını ekleyin.',not:''},
      {tip:'soru',soru:'Aşağıdakilerden hangisi doğrudur?',secenekler:['A) Birinci seçenek','B) İkinci seçenek','C) Üçüncü seçenek','D) Dördüncü seçenek'],dogru:0,not:'Katılımcılara düşünme süresi verin.'},
      {tip:'kapak',baslik:'Teşekkürler!',altBaslik:'Sorularınız için hazırız · '+(e?.egitmen||''),ikon:'🎉',not:'Son olarak soru-cevap yapın.'},
    ]
  };
}

export function sunumSlaytHTML(slayt, tema, sunumMod) {
  const t = tema;
  const fs = sunumMod
    ? {h1:'3.2vw',h2:'2vw',p:'1.4vw',sm:'1.1vw',ic:'5vw'}
    : {h1:'28px',h2:'18px',p:'13px',sm:'11px',ic:'48px'};

  if (slayt.tip==='baslik') return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px"><div style="font-size:${fs.ic};margin-bottom:16px">${slayt.ikon||'📚'}</div><div style="font-size:${fs.h1};font-weight:900;font-family:var(--font-display);letter-spacing:-0.5px;line-height:1.2;margin-bottom:16px">${slayt.baslik}</div><div style="font-size:${fs.h2};opacity:0.75;font-weight:500">${slayt.altBaslik||''}</div><div style="width:60px;height:3px;border-radius:10px;background:${t.vurgu};margin-top:20px;opacity:0.7"></div></div>`;

  if (slayt.tip==='icerik') return `<div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:${sunumMod?'4vw':'32px'}"><div style="font-size:${fs.h2};font-weight:800;color:${t.vurgu};margin-bottom:${sunumMod?'1.5vw':'12px'};letter-spacing:-0.2px">${slayt.baslik}</div><div style="width:40px;height:3px;background:${t.vurgu};border-radius:10px;margin-bottom:${sunumMod?'2vw':'16px'};opacity:0.6"></div><div style="font-size:${fs.p};line-height:1.75;opacity:0.9">${slayt.metin}</div></div>`;

  if (slayt.tip==='liste') return `<div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:${sunumMod?'4vw':'32px'}"><div style="font-size:${fs.h2};font-weight:800;margin-bottom:${sunumMod?'2vw':'16px'};color:${t.vurgu}">${slayt.baslik}</div><div style="display:flex;flex-direction:column;gap:${sunumMod?'1vw':'10px'}">${(slayt.maddeler||[]).map(m=>`<div style="display:flex;align-items:flex-start;gap:${sunumMod?'1vw':'10px'}"><div style="width:${sunumMod?'0.8vw':'8px'};height:${sunumMod?'0.8vw':'8px'};border-radius:50%;background:${t.vurgu};margin-top:${sunumMod?'0.5vw':'5px'};flex-shrink:0"></div><div style="font-size:${fs.p};line-height:1.5;opacity:0.9">${m}</div></div>`).join('')}</div></div>`;

  if (slayt.tip==='alinti') return `<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:${sunumMod?'6vw':'48px'};text-align:center"><div><div style="font-size:${sunumMod?'4vw':'40px'};color:${t.vurgu};opacity:0.4;line-height:1;margin-bottom:10px">"</div><div style="font-size:${sunumMod?'2.2vw':'20px'};font-weight:600;font-style:italic;line-height:1.5;opacity:0.95;margin-bottom:20px">${slayt.metin}</div>${slayt.kaynak?`<div style="font-size:${fs.sm};opacity:0.6;font-weight:600">— ${slayt.kaynak}</div>`:''}</div></div>`;

  if (slayt.tip==='soru') return `<div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:${sunumMod?'4vw':'32px'}"><div style="font-size:${fs.sm};font-weight:700;color:${t.vurgu};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">❓ Test Sorusu</div><div style="font-size:${sunumMod?'2vw':'18px'};font-weight:700;margin-bottom:${sunumMod?'2vw':'20px'};line-height:1.4">${slayt.soru}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:${sunumMod?'1vw':'10px'}">${(slayt.secenekler||[]).map(s=>`<div style="padding:${sunumMod?'1vw 1.5vw':'10px 14px'};border-radius:10px;border:1.5px solid rgba(255,255,255,0.2);font-size:${fs.p};font-weight:500;background:rgba(255,255,255,0.05)">${s}</div>`).join('')}</div></div>`;

  if (slayt.tip==='bolum') return `<div style="display:flex;align-items:center;justify-content:center;height:100%;text-align:center"><div><div style="width:${sunumMod?'6vw':'64px'};height:4px;background:${slayt.renk||t.vurgu};border-radius:10px;margin:0 auto 20px"></div><div style="font-size:${sunumMod?'3.5vw':'32px'};font-weight:900;font-family:var(--font-display);letter-spacing:-0.3px;margin-bottom:12px">${slayt.baslik}</div><div style="font-size:${fs.p};opacity:0.7">${slayt.alt||''}</div><div style="width:${sunumMod?'6vw':'64px'};height:4px;background:${slayt.renk||t.vurgu};border-radius:10px;margin:20px auto 0;opacity:0.4"></div></div></div>`;

  if (slayt.tip==='gorsel') return `<div style="display:grid;grid-template-columns:1fr 1fr;height:100%"><div style="display:flex;flex-direction:column;justify-content:center;padding:${sunumMod?'4vw':'32px'}"><div style="font-size:${fs.h2};font-weight:800;color:${t.vurgu};margin-bottom:12px">${slayt.baslik}</div><div style="font-size:${fs.p};line-height:1.7;opacity:0.9">${slayt.metin}</div></div><div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);font-size:${sunumMod?'6vw':'64px'}">${slayt.gorselUrl?`<img src="${slayt.gorselUrl}" style="max-width:100%;max-height:100%;object-fit:contain">`:'🖼️'}</div></div>`;

  if (slayt.tip==='kapak') return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px"><div style="font-size:${fs.ic};margin-bottom:16px">${slayt.ikon||'🎉'}</div><div style="font-size:${fs.h1};font-weight:900;font-family:var(--font-display);letter-spacing:-0.5px;margin-bottom:14px">${slayt.baslik}</div><div style="font-size:${fs.h2};opacity:0.7">${slayt.altBaslik||''}</div><div style="margin-top:24px;display:flex;gap:10px"><div style="width:8px;height:8px;border-radius:50%;background:${t.vurgu};opacity:0.8"></div><div style="width:8px;height:8px;border-radius:50%;background:${t.vurgu};opacity:0.5"></div><div style="width:8px;height:8px;border-radius:50%;background:${t.vurgu};opacity:0.3"></div></div></div>`;

  return `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:14px;opacity:0.5">Slayt içeriği</div>`;
}
