// ── OPERIO MOCK DATA ─────────────────────────────────────────
// Eski HTML versiyonuyla birebir eşleşen veri yapısı

export const SURGERIES = [
  {
    id: 0, saat: '08:00', bitis: '10:30', op: 'Laparoskopik Kolesistektomi',
    hasta: 'Hüseyin Kara (52 E)', dr: 'Dr. Ahmet Yılmaz', salon: 'Salon 1',
    st: 'dot-active', brans: 'Genel Cerrahi', sure: '150', anestezi: 'Genel Anestezi',
    durum: 'Devam Ediyor',
    ekip: { cerrah: 'Dr. Ahmet Yılmaz', asistan: 'Dr. Selin Ak', scrub: 'Hem. Ayşe Korkmaz', sirkule: 'Hem. Derya Nur', anestezi: 'Uzm. Kemal Arslan', anesteknik: 'Tek. Mehmet Arslan' },
    setler: ['Laparoskopi Seti A', 'Kamera & Optik Sistemi', 'Trokar Seti (3×)'],
    malzeme: ['Metal Klip (10lu) ×2', 'Endobag ×1', 'İrrigasyon Seti ×1', 'Absorbabl Sütür 2-0 ×2', 'Dren (Hemovak) ×1'],
    cihaz: ['Elektrokoter Unit 3', 'CO₂ İnsuflator', 'Laparoskopi Monitör Stantı'],
    ilac: ['Propofol 200mg IV', 'Fentanil 100mcg IV', 'Sevofluran %2', 'Roküronyum 50mg'],
    hastaDetay: { ad: 'Hüseyin Kara', yas: 52, cinsiyet: 'Erkek', tc: '12345678901', tel: '0532 111 22 33', kan: 'B Rh+', alerjiler: 'Penisilin', tani: 'Akut Kolesistit', asaSkor: 'ASA II', agirlik: '82 kg', boy: '178 cm', notlar: 'Hipertansiyon öyküsü mevcut, metoprolol kullanıyor.' },
    lokalProtokol: 'Bupivakain %0.5 20ml + Adrenalin 1:200.000\nUygulama: Port yerlerine subkutan infiltrasyon\nMaksimum doz: 175mg\nKontrol: Enjeksiyon öncesi aspire et',
    tags: ['t-teal', 't-blue'], tlbl: ['Genel Cerrahi', 'Laparoskopi'],
  },
  {
    id: 1, saat: '09:00', bitis: '11:00', op: 'Apendektomi',
    hasta: 'Mehmet Aydın (38 E)', dr: 'Dr. Gigi Hadid', salon: 'Salon 2',
    st: 'dot-wait', brans: 'Genel Cerrahi', sure: '120', anestezi: 'Genel Anestezi',
    durum: 'Bekliyor',
    ekip: { cerrah: 'Dr. Gigi Hadid', asistan: 'Dr. Can Öz', scrub: 'Hem. Selin Yıldız', sirkule: 'Hem. Pınar Yalçın', anestezi: 'Uzm. Kemal Arslan', anesteknik: 'Tek. Fatma Çelik' },
    setler: ['Laparoskopi Seti B', 'Endoloop Aplikatör'],
    malzeme: ['Endoloop ×2', 'Endobag ×1', 'Absorbabl Sütür 3-0 ×2'],
    cihaz: ['Elektrokoter', 'Laparoskopi Kamera Sistemi'],
    ilac: ['Propofol 150mg IV', 'Fentanil 75mcg IV', 'Roküronyum 40mg', 'Sefazolin 1g IV'],
    hastaDetay: { ad: 'Mehmet Aydın', yas: 38, cinsiyet: 'Erkek', tc: '98765432109', tel: '0541 222 33 44', kan: 'A Rh+', alerjiler: 'Yok', tani: 'Akut Apandisit', asaSkor: 'ASA I', agirlik: '75 kg', boy: '175 cm', notlar: 'Semptom başlangıcı 12 saat. CRP: 120 mg/L.' },
    tags: ['t-teal', 't-red'], tlbl: ['Genel Cerrahi', 'Acil'],
  },
  {
    id: 2, saat: '10:00', bitis: '12:30', op: 'Total Diz Artroplastisi',
    hasta: 'Fatma Yıldız (67 K)', dr: 'Dr. Can Özkan', salon: 'Salon 3',
    st: 'dot-wait', brans: 'Ortopedi', sure: '150', anestezi: 'Spinal Anestezi',
    durum: 'Bekliyor',
    ekip: { cerrah: 'Dr. Can Özkan', asistan: 'Dr. Mert Bozkurt', scrub: 'Hem. Büşra Kaya', sirkule: 'Hem. Tuba Özbek', anestezi: 'Uzm. Kemal Arslan', anesteknik: 'Tek. Bülent Taş' },
    setler: ['TDA Ortopedi Seti', 'Kemik Kesici Takımı', 'Sement Hazırlama Seti'],
    malzeme: ['TDA Protez Sistemi (Sağ) ×1', 'Kemik Çimentosu ×2 paket', 'Hemovak Dren ×1'],
    cihaz: ['Pnömatik Turnike Sistemi', 'Elektrokoter', 'C-Arm Floroskopi'],
    ilac: ['Bupivakain Spinal 15mg', 'Fentanil 25mcg', 'Traneksamik Asit 1g IV'],
    hastaDetay: { ad: 'Fatma Yıldız', yas: 67, cinsiyet: 'Kadın', tc: '11122233344', tel: '0505 333 44 55', kan: '0 Rh-', alerjiler: 'NSAID (diklofenak)', tani: 'İleri Evre Gonartoz', asaSkor: 'ASA III', agirlik: '78 kg', boy: '160 cm', notlar: 'Tip 2 DM, metformin kullanıyor.' },
    tags: ['t-orange'], tlbl: ['Ortopedi'],
  },
  {
    id: 3, saat: '11:30', bitis: '13:00', op: 'Tiroidektomi',
    hasta: 'Selin Çelik (45 K)', dr: 'Dr. Ahmet Yılmaz', salon: 'Salon 1',
    st: 'dot-wait', brans: 'Endokrin Cerr.', sure: '90', anestezi: 'Genel Anestezi',
    durum: 'Bekliyor',
    ekip: { cerrah: 'Dr. Ahmet Yılmaz', asistan: 'Dr. Selin Ak', scrub: 'Hem. Ayşe Korkmaz', sirkule: 'Hem. Derya Nur', anestezi: 'Uzm. Kemal Arslan', anesteknik: 'Tek. Esra Kılıç' },
    setler: ['Boyun Cerrahi Seti', 'Nöromonitor Set', 'Harmonik Skalpel Seti'],
    malzeme: ['Hemovak Dren ×1', 'Absorbabl Sütür 2-0 ×2', 'Absorbabl Sütür 3-0 ×2'],
    cihaz: ['Nöromonitor Cihazı (NIM)', 'Elektrokoter', 'Harmonik Skalpel'],
    ilac: ['Propofol 180mg IV', 'Fentanil 100mcg IV', 'Roküronyum 45mg'],
    hastaDetay: { ad: 'Selin Çelik', yas: 45, cinsiyet: 'Kadın', tc: '55566677788', tel: '0543 444 55 66', kan: 'AB Rh+', alerjiler: 'Yok', tani: 'Papiller Tiroid Kanseri (T2N0M0)', asaSkor: 'ASA I', agirlik: '62 kg', boy: '165 cm', notlar: 'TSH normal. Preoperatif sese dikkat. Nöromonitor zorunlu.' },
    tags: ['t-blue'], tlbl: ['Endokrin Cerr.'],
  },
  {
    id: 4, saat: '13:00', bitis: '14:30', op: 'İnguinal Herni Onarımı',
    hasta: 'Ali Arslan (29 E)', dr: 'Dr. Gigi Hadid', salon: 'Salon 2',
    st: 'dot-wait', brans: 'Genel Cerrahi', sure: '90', anestezi: 'Genel Anestezi',
    durum: 'Bekliyor',
    ekip: { cerrah: 'Dr. Gigi Hadid', scrub: 'Hem. Selin Yıldız', sirkule: 'Hem. Pınar Yalçın', anestezi: 'Uzm. Kemal Arslan', anesteknik: 'Tek. Fatma Çelik' },
    setler: ['Laparoskopi Seti B', 'Mesh Aplikatör Seti'],
    malzeme: ['Polipropilen Mesh 15×10 cm ×1', 'Tacker ×1'],
    cihaz: ['Elektrokoter', 'Laparoskopi Kamera Sistemi'],
    ilac: ['Propofol 130mg IV', 'Fentanil 75mcg IV', 'Roküronyum 35mg'],
    hastaDetay: { ad: 'Ali Arslan', yas: 29, cinsiyet: 'Erkek', tc: '33344455566', tel: '0532 555 66 77', kan: 'B Rh-', alerjiler: 'Yok', tani: 'Sağ İnguinal Herni (Direkt)', asaSkor: 'ASA I', agirlik: '70 kg', boy: '180 cm', notlar: 'İlk operasyon.' },
    tags: ['t-green'], tlbl: ['Genel Cerrahi'],
  },
  {
    id: 5, saat: '14:00', bitis: '15:30', op: 'Katarakt Cerrahisi',
    hasta: 'Zübeyde Güneş (74 K)', dr: 'Dr. Mert Akar', salon: 'Salon 4',
    st: 'dot-wait', brans: 'Göz Cerrahisi', sure: '90', anestezi: 'Topikal + Peribulbar',
    durum: 'Bekliyor',
    ekip: { cerrah: 'Dr. Mert Akar', scrub: 'Hem. Büşra Kaya', sirkule: 'Hem. Tuba Özbek', anestezi: 'Uzm. Kemal Arslan', anesteknik: 'Tek. Bülent Taş' },
    setler: ['Fakoemülsifikasyon Seti', 'Göz Mikrocerrahi Aleti Seti'],
    malzeme: ['IOL (İntraokuler Lens) ×1', 'Viskoelastik Madde ×1', 'BSS Solüsyon ×2'],
    cihaz: ['Fakoemülsifikasyon Cihazı', 'Cerrahi Mikroskop'],
    ilac: ['Topikal Tetrakain %0.5', 'Lidokain Peribulbar 3ml', 'Sefazolin 1g IV'],
    hastaDetay: { ad: 'Zübeyde Güneş', yas: 74, cinsiyet: 'Kadın', tc: '77788899900', tel: '0530 666 77 88', kan: 'A Rh+', alerjiler: 'Yok', tani: 'Senil Katarakt (Sağ Göz)', asaSkor: 'ASA II', agirlik: '65 kg', boy: '155 cm', notlar: 'HT, warfarin kullanıyor. INR 1.8.' },
    tags: ['t-purple'], tlbl: ['Göz Cerrahisi'],
  },
];

export const ROOMS = [
  { id: 'r1', ad: 'Salon 1', durum: 'active',   brans: 'Genel Cerrahi', op: 'Laparoskopik Kolesistektomi', ekip: ['AY', 'MA'], time: '10:30\'a kadar', kapasite: 4, cihazlar: ['Elektrokoter', 'Laparoskopi Sistemi', 'CO₂ İnsuflator'] },
  { id: 'r2', ad: 'Salon 2', durum: 'reserved',  brans: 'Genel Cerrahi', op: 'Apendektomi — Bekleniyor',   ekip: ['SY', 'FA'], time: '', kapasite: 4, cihazlar: ['Elektrokoter', 'Laparoskopi Kamera'] },
  { id: 'r3', ad: 'Salon 3', durum: 'reserved',  brans: 'Ortopedi',      op: 'TDA — 10:00\'de başlıyor',   ekip: ['BK'],       time: '', kapasite: 5, cihazlar: ['Pnömatik Turnike', 'C-Arm', 'Elektrokoter'] },
  { id: 'r4', ad: 'Salon 4', durum: 'idle',      brans: '—',             op: 'Boş',                         ekip: [],           time: '', kapasite: 3, cihazlar: ['Fakoemülsifikasyon Cihazı', 'Mikroskop'] },
  { id: 'r5', ad: 'Salon 5', durum: 'reserved',  brans: 'Ortopedi',      op: 'Rezerve',                     ekip: [],           time: '', kapasite: 4, cihazlar: ['Artroskopi Seti', 'Elektrokoter'] },
  { id: 'r6', ad: 'Salon 6', durum: 'idle',      brans: '—',             op: 'Boş',                         ekip: [],           time: '', kapasite: 3, cihazlar: ['Genel Cerrahi Seti'] },
  { id: 'r7', ad: 'Salon 7', durum: 'maintenance',brans: 'KBB',          op: 'Bakımda',                     ekip: [],           time: '', kapasite: 3, cihazlar: [] },
  { id: 'r8', ad: 'Salon 8', durum: 'idle',      brans: '—',             op: 'Boş',                         ekip: [],           time: '', kapasite: 4, cihazlar: [] },
];

export const PERSONEL = [
  { id: 'P01', ad: 'Dr. Ahmet Yılmaz',   rol: 'Genel Cerrahi',         av: 'AY', bg: '#DC2626', durum: 'Aktif',   gun: 22, tel: '0532 001 0001', email: 'ahmet@hastane.tr', sicil: 'DR-001', uzmanlik: 'Laparoskopik Cerrahi' },
  { id: 'P02', ad: 'Dr. Gigi Hadid',     rol: 'Genel Cerrahi',         av: 'GH', bg: '#DC2626', durum: 'Aktif',   gun: 20, tel: '0532 001 0002', email: 'gigi@hastane.tr',  sicil: 'DR-002', uzmanlik: 'Kolorektal Cerrahi' },
  { id: 'P03', ad: 'Dr. Can Özkan',      rol: 'Ortopedi',              av: 'CO', bg: '#DC2626', durum: 'Aktif',   gun: 18, tel: '0532 001 0003', email: 'can@hastane.tr',   sicil: 'DR-003', uzmanlik: 'Artroplasti' },
  { id: 'P04', ad: 'Hem. Ayşe Korkmaz', rol: 'Hemşire',               av: 'AK', bg: '#EA580C', durum: 'Aktif',   gun: 22, tel: '0532 001 0004', email: 'ayse@hastane.tr',  sicil: 'HM-001', uzmanlik: 'Scrub Hemşiresi' },
  { id: 'P05', ad: 'Hem. Selin Yıldız', rol: 'Ameliyathane Teknikeri',av: 'SY', bg: '#EA580C', durum: 'İzinde',  gun: 14, tel: '0532 001 0005', email: 'selin@hastane.tr', sicil: 'HM-002', uzmanlik: 'Sirkülasyon' },
  { id: 'P06', ad: 'Hem. Büşra Kaya',   rol: 'Hemşire',               av: 'BK', bg: '#EA580C', durum: 'Aktif',   gun: 20, tel: '0532 001 0006', email: 'busra@hastane.tr', sicil: 'HM-003', uzmanlik: 'Ortopedi' },
  { id: 'P07', ad: 'Tek. Mehmet Arslan',rol: 'Anestezi Teknisyeni',   av: 'MA', bg: '#059669', durum: 'Aktif',   gun: 22, tel: '0532 001 0007', email: 'mehmet@hastane.tr',sicil: 'TK-001', uzmanlik: 'Genel Anestezi' },
  { id: 'P08', ad: 'Tek. Fatma Çelik',  rol: 'Anestezi Teknisyeni',   av: 'FC', bg: '#059669', durum: 'Aktif',   gun: 21, tel: '0532 001 0008', email: 'fatma@hastane.tr', sicil: 'TK-002', uzmanlik: 'Genel Anestezi' },
  { id: 'P18', ad: 'Tek. Bülent Taş',   rol: 'Anestezi Teknisyeni',   av: 'BT', bg: '#059669', durum: 'Aktif',   gun: 20, tel: '0532 001 0018', email: 'bulent@hastane.tr',sicil: 'TK-003', uzmanlik: 'Kardiyak Anestezi' },
  { id: 'P19', ad: 'Tek. Esra Kılıç',   rol: 'Anestezi Teknisyeni',   av: 'EK', bg: '#059669', durum: 'Aktif',   gun: 19, tel: '0532 001 0019', email: 'esra@hastane.tr',  sicil: 'TK-004', uzmanlik: 'Pediatrik Anestezi' },
  { id: 'P09', ad: 'Uzm. Kemal Arslan', rol: 'Anestezi Uzmanı',       av: 'KA', bg: '#0284C7', durum: 'Aktif',   gun: 22, tel: '0532 001 0009', email: 'kemal@hastane.tr', sicil: 'UZ-001', uzmanlik: 'Genel & Rejyonel' },
  { id: 'P10', ad: 'Dr. Mert Akar',     rol: 'Göz Hastalıkları',      av: 'MA', bg: '#7C3AED', durum: 'Aktif',   gun: 19, tel: '0532 001 0010', email: 'mert@hastane.tr',  sicil: 'DR-004', uzmanlik: 'Katarakt Cerrahisi' },
  { id: 'P11', ad: 'Hem. Pınar Yalçın', rol: 'Hemşire',               av: 'PY', bg: '#D97706', durum: 'Aktif',   gun: 20, tel: '0532 001 0011', email: 'pinar@hastane.tr', sicil: 'HM-004', uzmanlik: 'Sirkülasyon' },
  { id: 'P12', ad: 'Hem. Derya Nur',    rol: 'Hemşire',               av: 'DN', bg: '#be185d', durum: 'Pasif',   gun: 0,  tel: '0532 001 0012', email: 'derya@hastane.tr', sicil: 'HM-005', uzmanlik: '' },
  { id: 'P13', ad: 'Srl. Meral Doğan',  rol: 'Sterilizasyon Sorumlusu', av: 'SM', bg: '#0E7490', durum: 'Aktif', gun: 22, tel: '0532 001 0013', email: 'meral@hastane.tr', sicil: 'ST-001', uzmanlik: 'Sterilizasyon' },
  { id: 'P14', ad: 'Srl. Kerim Çelik',  rol: 'Sterilizasyon Personeli', av: 'KC', bg: '#0E7490', durum: 'Aktif', gun: 20, tel: '0532 001 0014', email: 'kerim@hastane.tr', sicil: 'ST-002', uzmanlik: 'Otoklav' },
  { id: 'P15', ad: 'Srl. Elif Demir',   rol: 'Sterilizasyon Personeli', av: 'ED', bg: '#0E7490', durum: 'Aktif', gun: 18, tel: '0532 001 0015', email: 'elif@hastane.tr',  sicil: 'ST-003', uzmanlik: 'Set Takip' },
  { id: 'P16', ad: 'Aml. Hasan Öz',     rol: 'Yardımcı Personel',      av: 'HÖ', bg: '#F59E0B', durum: 'Aktif', gun: 21, tel: '0532 001 0016', email: 'hasan@hastane.tr', sicil: 'YP-001', uzmanlik: 'Ameliyathane' },
  { id: 'P17', ad: 'Aml. Tuba Özbek',   rol: 'Yardımcı Personel',      av: 'TÖ', bg: '#F59E0B', durum: 'Aktif', gun: 20, tel: '0532 001 0017', email: 'tuba@hastane.tr',  sicil: 'YP-002', uzmanlik: 'Ameliyathane' },
];

export const HASTALAR = [
  { id: 'H001', ad: 'Hüseyin Kara',   yas: 52, cinsiyet: 'Erkek',  tc: '12345678901', tel: '0532 111 22 33', kan: 'B Rh+',  alerjiler: 'Penisilin',          tani: 'Akut Kolesistit',              asaSkor: 'ASA II',  agirlik: '82 kg', boy: '178 cm', son: '15.05.2025', op: 'Lap. Kolesistektomi',       notlar: 'Hipertansiyon öyküsü, metoprolol kullanıyor.' },
  { id: 'H002', ad: 'Mehmet Aydın',   yas: 38, cinsiyet: 'Erkek',  tc: '98765432109', tel: '0541 222 33 44', kan: 'A Rh+',  alerjiler: 'Yok',                tani: 'Akut Apandisit',               asaSkor: 'ASA I',   agirlik: '75 kg', boy: '175 cm', son: '15.05.2025', op: 'Apendektomi',               notlar: 'Semptom başlangıcı 12 saat. CRP: 120 mg/L.' },
  { id: 'H003', ad: 'Fatma Yıldız',   yas: 67, cinsiyet: 'Kadın',  tc: '11122233344', tel: '0505 333 44 55', kan: '0 Rh-',  alerjiler: 'NSAID (diklofenak)', tani: 'İleri Evre Gonartoz',          asaSkor: 'ASA III', agirlik: '78 kg', boy: '160 cm', son: '15.05.2025', op: 'Total Diz Artroplastisi',   notlar: 'Tip 2 DM, metformin kullanıyor.' },
  { id: 'H004', ad: 'Selin Çelik',    yas: 45, cinsiyet: 'Kadın',  tc: '55566677788', tel: '0543 444 55 66', kan: 'AB Rh+', alerjiler: 'Yok',                tani: 'Papiller Tiroid Kanseri',      asaSkor: 'ASA I',   agirlik: '62 kg', boy: '165 cm', son: '15.05.2025', op: 'Tiroidektomi',              notlar: 'TSH normal. Nöromonitor zorunlu.' },
  { id: 'H005', ad: 'Ali Arslan',      yas: 29, cinsiyet: 'Erkek',  tc: '33344455566', tel: '0532 555 66 77', kan: 'B Rh-',  alerjiler: 'Yok',                tani: 'Sağ İnguinal Herni',           asaSkor: 'ASA I',   agirlik: '70 kg', boy: '180 cm', son: '15.05.2025', op: 'İnguinal Herni Onarımı',    notlar: 'İlk operasyon. Semptom süresi 4 ay.' },
  { id: 'H006', ad: 'Zübeyde Güneş',  yas: 74, cinsiyet: 'Kadın',  tc: '77788899900', tel: '0530 666 77 88', kan: 'A Rh+',  alerjiler: 'Yok',                tani: 'Senil Katarakt (Sağ Göz)',     asaSkor: 'ASA II',  agirlik: '65 kg', boy: '155 cm', son: '15.05.2025', op: 'Katarakt Cerrahisi',         notlar: 'HT, warfarin kullanıyor. INR 1.8.' },
  { id: 'H007', ad: 'Kemal Yılmaz',   yas: 55, cinsiyet: 'Erkek',  tc: '44455566677', tel: '0533 777 88 99', kan: 'A Rh+',  alerjiler: 'Aspirin',            tani: 'Lomber Disk Hernisi L4-L5',    asaSkor: 'ASA II',  agirlik: '90 kg', boy: '182 cm', son: '12.05.2025', op: 'Mikrodiskektomi',            notlar: 'Kronik bel ağrısı, 6 aydır konservatif tedavi.' },
  { id: 'H008', ad: 'Ayşe Demir',     yas: 41, cinsiyet: 'Kadın',  tc: '66677788899', tel: '0535 888 99 00', kan: '0 Rh+',  alerjiler: 'Latex',              tani: 'Uterus Myomu (Multipl)',       asaSkor: 'ASA I',   agirlik: '68 kg', boy: '163 cm', son: '10.05.2025', op: 'Laparoskopik Myomektomi',   notlar: 'Latex alerjisi — latex içermeyen malzeme kullanılacak.' },
];

export const STERIL_SETLER = [
  { id: 'S01', ad: 'Laparoskopi Seti A',        kod: 'OPER-SET-LSA-001', adet: 1, raf: 'A-1', durum: 'steril',      sonSteril: '14.05.2025', kullanim: 48 },
  { id: 'S02', ad: 'Laparoskopi Seti B',        kod: 'OPER-SET-LSB-002', adet: 1, raf: 'A-2', durum: 'kullanimda',  sonSteril: '14.05.2025', kullanim: 52 },
  { id: 'S03', ad: 'TDA Ortopedi Seti',         kod: 'OPER-SET-TDA-003', adet: 1, raf: 'B-1', durum: 'steril',      sonSteril: '13.05.2025', kullanim: 31 },
  { id: 'S04', ad: 'Boyun Cerrahi Seti',        kod: 'OPER-SET-BCR-004', adet: 1, raf: 'B-2', durum: 'sterilizasyonda', sonSteril: '12.05.2025', kullanim: 17 },
  { id: 'S05', ad: 'Fakoemülsifikasyon Seti',   kod: 'OPER-SET-FAK-005', adet: 1, raf: 'C-1', durum: 'steril',      sonSteril: '14.05.2025', kullanim: 89 },
  { id: 'S06', ad: 'Nöromonitor Set',           kod: 'OPER-SET-NMN-006', adet: 1, raf: 'C-2', durum: 'steril',      sonSteril: '13.05.2025', kullanim: 24 },
  { id: 'S07', ad: 'Harmonik Skalpel Seti',     kod: 'OPER-SET-HSK-007', adet: 2, raf: 'A-3', durum: 'steril',      sonSteril: '14.05.2025', kullanim: 66 },
  { id: 'S08', ad: 'Kemik Kesici Takımı',       kod: 'OPER-SET-KKT-008', adet: 1, raf: 'B-3', durum: 'arizali',     sonSteril: '10.05.2025', kullanim: 142 },
];

export const BILDIRIMLER = [
  { id: 1, tip: 'uyari',      baslik: 'Ameliyat ertelendi',           mesaj: 'Salon 1 – 08:00 → 08:30. Ekip bilgilendirildi.',   zaman: '5 dk önce',    okundu: false, kategori: 'ameliyat' },
  { id: 2, tip: 'ekipman',    baslik: 'Ekipman uyarısı',             mesaj: 'Laparoskopi kamerası bakımda, yedek sisteme geçildi.', zaman: '30 dk önce',  okundu: false, kategori: 'ekipman' },
  { id: 3, tip: 'tamamlandi', baslik: 'Ameliyat tamamlandı',         mesaj: 'Salon 4 – Katarakt Cerrahisi başarıyla tamamlandı.', zaman: '2 sa önce',   okundu: true,  kategori: 'ameliyat' },
  { id: 4, tip: 'katilim',    baslik: 'Yeni katılım isteği',         mesaj: 'Dr. Mehmet Kaya sisteme katılım isteği gönderdi.',   zaman: '3 sa önce',   okundu: true,  kategori: 'personel' },
  { id: 5, tip: 'sistem',     baslik: 'Steril set hazır',            mesaj: 'TDA Ortopedi Seti sterilizasyondan çıktı, hazır.',   zaman: '4 sa önce',   okundu: true,  kategori: 'steril' },
  { id: 6, tip: 'uyari',      baslik: 'Kritik stok uyarısı',         mesaj: 'Absorbabl Sütür 2-0 stoğu azaldı (son 5 adet).',    zaman: '5 sa önce',   okundu: true,  kategori: 'ekipman' },
];

// ── Sterilizasyon modülü ─────────────────────────────────────
export const DURUM_SET_CFG = {
  'Steril — Hazır':    { color: '#059669', tag: 't-green'  },
  'Kullanımda':        { color: '#0284C7', tag: 't-blue'   },
  'Sterilizasyonda':   { color: '#D97706', tag: 't-orange' },
  'Eksik Parça':       { color: '#DC2626', tag: 't-red'    },
  'Bakımda':           { color: '#7C3AED', tag: 't-purple' },
};

export const STERIL_SETLER_V2 = [
  { id:1, name:'Laparoskopi Seti A', doktor:'Dr. Ahmet Yılmaz', raf:'A-1', durum:'Kullanımda',      color:'#14B8A6',
    aletler:[{ad:'Trokar 10mm',adet:1},{ad:'Trokar 5mm',adet:2},{ad:'Laparoskop 30°',adet:1},{ad:'Grasper',adet:1},{ad:'Koter Elektrotu',adet:1}] },
  { id:2, name:'Apendektomi Seti',   doktor:'Dr. Gigi Hadid',   raf:'A-2', durum:'Sterilizasyonda', color:'#0284C7',
    aletler:[{ad:'Endoloop',adet:2},{ad:'Trokar 5mm',adet:2},{ad:'Disektör',adet:1},{ad:'Grasper',adet:1}] },
  { id:3, name:'TDA Ortopedi Seti',  doktor:'Dr. Can Özkan',    raf:'B-1', durum:'Steril — Hazır',  color:'#7C3AED',
    aletler:[{ad:'Retraktör',adet:2},{ad:'Kemik Raspa',adet:1},{ad:'Osteotom',adet:3},{ad:'Turnike',adet:1},{ad:'Çimento Karıştırıcı',adet:1}] },
  { id:4, name:'Boyun Cerrahi Seti', doktor:'Dr. Ahmet Yılmaz', raf:'B-2', durum:'Steril — Hazır',  color:'#DC2626',
    aletler:[{ad:'Nöromonitor Prob',adet:1},{ad:'Retraktör',adet:2},{ad:'Disektör',adet:1},{ad:'Klip Aplikatörü',adet:1}] },
  { id:5, name:'Fakoemülsifikasyon', doktor:'Dr. Mert Akar',    raf:'C-1', durum:'Steril — Hazır',  color:'#EA580C',
    aletler:[{ad:'Fakoemülsifikatör',adet:1},{ad:'İrigasyon Kılıfı',adet:1},{ad:'Göz Spekülümü',adet:1},{ad:'BSS Kanülü',adet:2}] },
  { id:6, name:'Laparoskopi Seti B', doktor:'Dr. Gigi Hadid',   raf:'A-3', durum:'Steril — Hazır',  color:'#059669',
    aletler:[{ad:'Trokar 10mm',adet:1},{ad:'Trokar 5mm',adet:1},{ad:'Laparoskop 0°',adet:1},{ad:'Endoloop',adet:2}] },
];

export const TEKLI_ALETLER = [
  { id:1, ad:'Koter Penseti',        kat:'Klempler',   raf:'D-1', durum:'Steril — Hazır',  doktor:'' },
  { id:2, ad:'Mayo Makası',          kat:'Makas',      raf:'D-1', durum:'Steril — Hazır',  doktor:'' },
  { id:3, ad:'Metzenbaum Makası',    kat:'Makas',      raf:'D-2', durum:'Steril — Hazır',  doktor:'' },
  { id:4, ad:'Kelly Klemp',          kat:'Klempler',   raf:'D-2', durum:'Kullanımda',       doktor:'Dr. Ahmet Yılmaz' },
  { id:5, ad:'Cushing Forsepsi',     kat:'Forsepsler', raf:'E-1', durum:'Sterilizasyonda',  doktor:'' },
  { id:6, ad:'Finochietto Retraktör',kat:'Retraktörler',raf:'E-1',durum:'Steril — Hazır',  doktor:'' },
];

export const STERIL_PERSONEL = [
  { id:1, ad:'Meral Doğan',    av:'MD', bg:'#0891b2', sicil:'SRL-001', gorev:'Sterilizasyon Sorumlusu',    tel:'0532 111 2233', durum:'Aktif',  notlar:'' },
  { id:2, ad:'Kerim Çelik',    av:'KÇ', bg:'#059669', sicil:'SRL-002', gorev:'Sterilizasyon Teknisyeni',   tel:'0533 222 3344', durum:'Aktif',  notlar:'' },
  { id:3, ad:'Leyla Arslan',   av:'LA', bg:'#7C3AED', sicil:'SRL-003', gorev:'Sterilizasyon Teknisyeni',   tel:'0534 333 4455', durum:'Aktif',  notlar:'' },
  { id:4, ad:'Serkan Yıldız',  av:'SY', bg:'#EA580C', sicil:'SRL-004', gorev:'Sterilizasyon Teknisyeni',   tel:'0535 444 5566', durum:'Pasif',  notlar:'İzinli' },
];

// Her set için iş akışı durumu
export function initSterilAkis(setler) {
  const akis = {};
  setler.forEach(s => {
    const asama = s.durum === 'Kullanımda' ? 'kirli_teslim'
      : s.durum === 'Sterilizasyonda' ? 'sterilizasyonda'
      : s.durum === 'Steril — Hazır' ? 'depoda' : 'depoda';
    akis[s.id] = {
      asama,
      sure: 45,
      zamanlar: {},
      gercekSayim: s.aletler.reduce((o, _, i) => { o[i] = 1; return o; }, {}),
      log: [
        { zaman: '08:30', asama: 'depoda', aciklama: 'Steril depoya yerleştirildi.', kisi: 'Srl. Meral D.' },
      ],
    };
  });
  // Gerçekçi loglar
  if (akis[1]) {
    akis[1].log = [
      { zaman: '07:10', asama: 'depoda',      aciklama: 'Steril depoda hazırdı.',                             kisi: 'Srl. Meral D.' },
      { zaman: '08:05', asama: 'kirli_teslim',aciklama: 'Ameliyat sonrası kirli teslim alındı — Salon 1.',  kisi: 'Srl. Kerim Ç.' },
    ];
  }
  if (akis[2]) {
    akis[2].asama = 'sterilizasyonda';
    akis[2].log = [
      { zaman: '06:00', asama: 'depoda',         aciklama: 'Depodaydı.',                         kisi: 'Srl. Meral D.' },
      { zaman: '07:30', asama: 'kirli_teslim',   aciklama: 'Kirli teslim alındı — Salon 2.',    kisi: 'Srl. Kerim Ç.' },
      { zaman: '07:45', asama: 'yikamada',        aciklama: 'Yıkama işlemi başlatıldı.',          kisi: 'Srl. Kerim Ç.' },
      { zaman: '08:15', asama: 'sterilizasyonda', aciklama: 'Otoklave yüklendi. Süre: 45 dk.',  kisi: 'Srl. Kerim Ç.' },
    ];
  }
  return akis;
}

// ── Zenginleştirilmiş HASTALAR (Sekreterlik modülü) ──────────
export const HASTALAR_V2 = [
  { id:'H001', ad:'Hüseyin', soyad:'Kara',   yas:'52 yaş', cinsiyet:'E', tc:'12345678901', dogum:'1972-03-15', kan:'B Rh+',  tel:'0532 111 22 33', tel2:'', email:'', adres:'Kadıköy Mah. Bağdat Cad. No:12', sehir:'İstanbul', ilce:'Kadıköy', sigortaTip:'SGK', sigortaNo:'123456', sigortaSirket:'', policeNo:'', acilAd:'Fatma Kara', acilTel:'0532 999 88 77', acilYakinlik:'Eş', boy:'178', kilo:'82', alerjiler:'Penisilin', kronik:'Hipertansiyon', ilaclar:'Metoprolol 50mg 1×1', gecmisop:'', notlar:'Hipertansiyon öyküsü, metoprolol kullanıyor.', durum:'Aktif',
    ameliyatlar:[{op:'Laparoskopik Kolesistektomi',tarih:'15.05.2025',sure:'90 dk',cerrah:'Dr. Ahmet Yılmaz',salon:'Salon 1',anestezi:'Genel Anestezi',durum:'Planlandı',notlar:''},{op:'Apendektomi',tarih:'12.03.2021',sure:'60 dk',cerrah:'Dr. Fatma Gül',salon:'Salon 2',anestezi:'Genel Anestezi',durum:'Tamamlandı',notlar:'Komplikasyonsuz seyretti.'}],
    implantlar:[], vitaller:[{tarih:'14.05.2025 08:30',spo2:98,kb:'124/76',kah:74,ates:36.5,notlar:'Normal'},{tarih:'10.05.2025 09:00',spo2:97,kb:'130/82',kah:78,ates:36.6,notlar:'HT kontrolü'}],
    alerjilerDetay:[{ajan:'Penisilin',siddet:'Orta',reaksiyon:'Deri döküntüsü',tarih:'2018-05-10'}],
    testler:[
      { ad:'Tam Kan Sayımı (CBC)', tarih:'14.05.2025 08:10', durum:'Tamamlandı', sonuc:'Normal sınırlarda', kritik:false },
      { ad:'Karaciğer Fonksiyon Testleri', tarih:'14.05.2025 08:10', durum:'Tamamlandı', sonuc:'ALT: 42 U/L, AST: 38 U/L — hafif yüksek', kritik:true },
      { ad:'Kan Grubu (ABO/Rh)', tarih:'12.05.2025 10:00', durum:'Tamamlandı', sonuc:'B Rh+', kritik:false },
      { ad:'Üst Batın USG', tarih:'10.05.2025 14:30', durum:'Tamamlandı', sonuc:'Multipl safra kesesi taşı, duvar kalınlığı normal', kritik:false },
    ],
    gorseller:[
      { ad:'Üst Batın USG', tip:'USG', tarih:'10.05.2025', not:'Safra kesesi taşları görüntülendi' },
      { ad:'Preoperatif EKG', tip:'EKG', tarih:'12.05.2025', not:'Sinüs ritmi, normal' },
    ],
  },
  { id:'H002', ad:'Mehmet', soyad:'Aydın',  yas:'38 yaş', cinsiyet:'E', tc:'98765432109', dogum:'1986-07-22', kan:'A Rh+',  tel:'0541 222 33 44', tel2:'', email:'m.aydin@email.com', adres:'Atatürk Cad. No:45', sehir:'Ankara', ilce:'Çankaya', sigortaTip:'SGK', sigortaNo:'234567', sigortaSirket:'', policeNo:'', acilAd:'Ali Aydın', acilTel:'0541 111 00 99', acilYakinlik:'Baba', boy:'175', kilo:'75', alerjiler:'Yok', kronik:'', ilaclar:'', gecmisop:'', notlar:'Semptom başlangıcı 12 saat. CRP: 120 mg/L.', durum:'Aktif',
    ameliyatlar:[{op:'Apendektomi',tarih:'15.05.2025',sure:'60 dk',cerrah:'Dr. Gigi Hadid',salon:'Salon 2',anestezi:'Genel Anestezi',durum:'Planlandı',notlar:''}],
    implantlar:[], vitaller:[{tarih:'15.05.2025 07:45',spo2:99,kb:'118/72',kah:82,ates:37.2,notlar:'Ateş hafif yüksek'}],
    alerjilerDetay:[],
  },
  { id:'H003', ad:'Fatma', soyad:'Yıldız', yas:'67 yaş', cinsiyet:'K', tc:'11122233344', dogum:'1957-11-08', kan:'0 Rh-',  tel:'0505 333 44 55', tel2:'0505 444 55 66', email:'', adres:'Bahçelievler Mah. 5. Sok. No:8', sehir:'İzmir', ilce:'Bornova', sigortaTip:'SGK', sigortaNo:'345678', sigortaSirket:'', policeNo:'', acilAd:'Mustafa Yıldız', acilTel:'0505 777 66 55', acilYakinlik:'Eş', boy:'160', kilo:'78', alerjiler:'NSAID (diklofenak)', kronik:'Tip 2 DM, Gonartoz', ilaclar:'Metformin 1000mg 2×1, Valsartan 80mg 1×1', gecmisop:'Kolesistektomi (2010)', notlar:'Tip 2 DM, metformin kullanıyor.', durum:'Aktif',
    ameliyatlar:[{op:'Total Diz Artroplastisi',tarih:'15.05.2025',sure:'120 dk',cerrah:'Dr. Can Özkan',salon:'Salon 3',anestezi:'Spinal Anestezi',durum:'Planlandı',notlar:'Sağ diz'},{op:'Kolesistektomi',tarih:'12.06.2010',sure:'90 dk',cerrah:'Dr. Ahmet Yılmaz',salon:'Salon 1',anestezi:'Genel Anestezi',durum:'Tamamlandı',notlar:''}],
    implantlar:[{ad:'Sağ Diz TDA Protezi',tip:'Diz Protezi',marka:'Zimmer Biomet',model:'NexGen CR',seriNo:'ZB2024-45671',lotNo:'L2024-001',boyut:'Size 5',cerrah:'Dr. Can Özkan',tedarikcı:'MedTech TR',takilmaTarihi:'2024-02-15',ameliyat:'Total Diz Artroplastisi (Sağ)',garantiSuresi:'10 yıl',garantiBitis:'2034-02-15',notlar:'',renk:'#7C3AED'}],
    vitaller:[{tarih:'14.05.2025 10:00',spo2:97,kb:'138/86',kah:76,ates:36.4,notlar:'KB kontrolü gerekiyor'}],
    alerjilerDetay:[{ajan:'NSAID (Diklofenak)',siddet:'Orta',reaksiyon:'Mide bulantısı, döküntü',tarih:'2015-03-20'}],
  },
  { id:'H004', ad:'Selin', soyad:'Çelik',  yas:'45 yaş', cinsiyet:'K', tc:'55566677788', dogum:'1979-05-30', kan:'AB Rh+', tel:'0543 444 55 66', tel2:'', email:'selin.celik@mail.com', adres:'Yeşiltepe Mah. Lale Sok. No:3', sehir:'İstanbul', ilce:'Beşiktaş', sigortaTip:'Özel Sigorta', sigortaNo:'456789', sigortaSirket:'Axa Sigorta', policeNo:'AXA-2024-112233', acilAd:'Burak Çelik', acilTel:'0543 000 11 22', acilYakinlik:'Eş', boy:'165', kilo:'62', alerjiler:'Yok', kronik:'', ilaclar:'', gecmisop:'', notlar:'TSH normal. Nöromonitor zorunlu.', durum:'Aktif',
    ameliyatlar:[{op:'Tiroidektomi',tarih:'15.05.2025',sure:'100 dk',cerrah:'Dr. Ahmet Yılmaz',salon:'Salon 4',anestezi:'Genel Anestezi',durum:'Planlandı',notlar:'Nöromonitor kullanılacak'}],
    implantlar:[], vitaller:[{tarih:'14.05.2025 11:00',spo2:99,kb:'115/70',kah:70,ates:36.3,notlar:'Normal'}],
    alerjilerDetay:[],
    testler:[
      { ad:'TSH / sT4', tarih:'10.05.2025 09:00', durum:'Tamamlandı', sonuc:'TSH: 1.8 mIU/L (normal)', kritik:false },
      { ad:'Kalsiyum / PTH', tarih:'10.05.2025 09:00', durum:'Tamamlandı', sonuc:'Normal sınırlarda', kritik:false },
      { ad:'Patoloji (İnce İğne Aspirasyon)', tarih:'02.04.2025 11:00', durum:'Tamamlandı', sonuc:'Papiller Karsinom — Bethesda VI', kritik:true },
    ],
    gorseller:[
      { ad:'Tiroid USG', tip:'USG', tarih:'02.04.2025', not:'Sol lobda 1.8 cm hipoekoik nodül' },
    ],
  },
  { id:'H005', ad:'Ali', soyad:'Arslan',  yas:'29 yaş', cinsiyet:'E', tc:'33344455566', dogum:'1995-09-12', kan:'B Rh-',  tel:'0532 555 66 77', tel2:'', email:'', adres:'Çarşı Cad. No:22', sehir:'Bursa', ilce:'Nilüfer', sigortaTip:'SGK', sigortaNo:'567890', sigortaSirket:'', policeNo:'', acilAd:'Zeynep Arslan', acilTel:'0532 333 44 55', acilYakinlik:'Anne', boy:'180', kilo:'70', alerjiler:'Yok', kronik:'', ilaclar:'', gecmisop:'', notlar:'İlk operasyon. Semptom süresi 4 ay.', durum:'Aktif',
    ameliyatlar:[{op:'İnguinal Herni Onarımı',tarih:'15.05.2025',sure:'90 dk',cerrah:'Dr. Ahmet Yılmaz',salon:'Salon 5',anestezi:'Spinal Anestezi',durum:'Planlandı',notlar:''}],
    implantlar:[{ad:'Hernia Mesh',tip:'Diğer',marka:'Bard Medical',model:'Marlex',seriNo:'BM-2025-001',lotNo:'L2025-A',boyut:'15×15 cm',cerrah:'Dr. Ahmet Yılmaz',tedarikcı:'Bard TR',takilmaTarihi:'2025-05-15',ameliyat:'İnguinal Herni Onarımı',garantiSuresi:'Ömür boyu',garantiBitis:'',notlar:'',renk:'#0284C7'}],
    vitaller:[{tarih:'15.05.2025 07:30',spo2:100,kb:'118/74',kah:68,ates:36.5,notlar:''}],
    alerjilerDetay:[],
    testler:[
      { ad:'Tam Kan Sayımı (CBC)', tarih:'13.05.2025 09:15', durum:'Tamamlandı', sonuc:'Normal sınırlarda', kritik:false },
      { ad:'Kan Grubu (ABO/Rh)', tarih:'13.05.2025 09:15', durum:'Tamamlandı', sonuc:'B Rh-', kritik:false },
    ],
    gorseller:[
      { ad:'Kasık Bölgesi USG', tip:'USG', tarih:'01.05.2025', not:'Sağ inguinal herni, defekt 2.5 cm' },
    ],
  },
  { id:'H006', ad:'Zübeyde', soyad:'Güneş', yas:'74 yaş', cinsiyet:'K', tc:'77788899900', dogum:'1950-01-23', kan:'A Rh+',  tel:'0530 666 77 88', tel2:'', email:'', adres:'Cumhuriyet Mah. No:1', sehir:'Konya', ilce:'Selçuklu', sigortaTip:'Emekli Sandığı', sigortaNo:'678901', sigortaSirket:'', policeNo:'', acilAd:'Hasan Güneş', acilTel:'0530 555 44 33', acilYakinlik:'Çocuk', boy:'155', kilo:'65', alerjiler:'Yok', kronik:'HT, Warfarin kullanan', ilaclar:'Warfarin 5mg 1×1 (INR 1.8)', gecmisop:'', notlar:'HT, warfarin kullanıyor. INR 1.8.', durum:'Aktif',
    ameliyatlar:[{op:'Katarakt Cerrahisi (Sağ Göz)',tarih:'15.05.2025',sure:'45 dk',cerrah:'Dr. Mert Akar',salon:'Salon 6',anestezi:'Topikal + Peribulbar',durum:'Planlandı',notlar:''}],
    implantlar:[{ad:'İntraokuler Lens (Sağ)',tip:'Göz İçi Lens',marka:'Alcon',model:'AcrySof IQ',seriNo:'ALC-2025-789',lotNo:'L2025-B',boyut:'+21.5 D',cerrah:'Dr. Mert Akar',tedarikcı:'Alcon TR',takilmaTarihi:'2025-05-15',ameliyat:'Katarakt Cerrahisi',garantiSuresi:'Ömür boyu',garantiBitis:'',notlar:'',renk:'#EA580C'}],
    vitaller:[{tarih:'15.05.2025 07:15',spo2:97,kb:'148/90',kah:74,ates:36.2,notlar:'KB yüksek, takip et'}],
    alerjilerDetay:[],
  },
  { id:'H007', ad:'Kemal', soyad:'Yılmaz', yas:'55 yaş', cinsiyet:'E', tc:'44455566677', dogum:'1969-12-05', kan:'A Rh+',  tel:'0533 777 88 99', tel2:'', email:'', adres:'Merkez Mah. No:88', sehir:'Ankara', ilce:'Mamak', sigortaTip:'SGK', sigortaNo:'789012', sigortaSirket:'', policeNo:'', acilAd:'Selma Yılmaz', acilTel:'0533 111 22 33', acilYakinlik:'Eş', boy:'182', kilo:'90', alerjiler:'Aspirin', kronik:'Lomber disk hernisi', ilaclar:'Pregabalin 75mg 2×1', gecmisop:'', notlar:'Kronik bel ağrısı, 6 aydır konservatif tedavi.', durum:'Planlı',
    ameliyatlar:[], vitaller:[],
    alerjilerDetay:[{ajan:'Aspirin',siddet:'Hafif',reaksiyon:'Mide yanması',tarih:'2020-01-01'}],
  },
  { id:'H008', ad:'Ayşe', soyad:'Demir',  yas:'41 yaş', cinsiyet:'K', tc:'66677788899', dogum:'1983-04-18', kan:'0 Rh+',  tel:'0535 888 99 00', tel2:'', email:'ayse.demir@email.com', adres:'Bağlar Mah. Çiçek Sok. No:5', sehir:'İzmir', ilce:'Karşıyaka', sigortaTip:'Özel Sigorta', sigortaNo:'890123', sigortaSirket:'Mapfre', policeNo:'MAP-2024-445566', acilAd:'Ercan Demir', acilTel:'0535 000 99 88', acilYakinlik:'Eş', boy:'163', kilo:'68', alerjiler:'Latex', kronik:'Uterus Myomu', ilaclar:'', gecmisop:'', notlar:'Latex alerjisi — latex içermeyen malzeme kullanılacak.', durum:'Aktif',
    ameliyatlar:[{op:'Laparoskopik Myomektomi',tarih:'10.05.2025',sure:'120 dk',cerrah:'Dr. Gigi Hadid',salon:'Salon 1',anestezi:'Genel Anestezi',durum:'Tamamlandı',notlar:'Komplikasyonsuz tamamlandı.'}],
    implantlar:[], vitaller:[{tarih:'09.05.2025 08:00',spo2:99,kb:'112/68',kah:72,ates:36.4,notlar:'Preop normal'}],
    alerjilerDetay:[{ajan:'Latex',siddet:'Orta',reaksiyon:'Ürtiker, anjioödem',tarih:'2016-08-15'}],
  },
];

// ── BİYOMEDİKAL MODÜLÜ ──────────────────────────────────────────
export const CIHAZLAR = [
  { id:'C01', ad:'Anestezi Cihazı 1',   kat:'Anestezi',       sn:'AC-001',  lok:'Salon 1', durum:'Aktif',   sonBakim:'2025-03-01', sonucBakim:'2026-09-01', kalibrasyon:'2025-06-01', garantiBitis:'2027-01-01' },
  { id:'C02', ad:'Anestezi Cihazı 2',   kat:'Anestezi',       sn:'AC-002',  lok:'Salon 2', durum:'Aktif',   sonBakim:'2025-03-01', sonucBakim:'2026-09-01', kalibrasyon:'2025-06-01', garantiBitis:'2027-01-01' },
  { id:'C03', ad:'Elektrokoter Unit 3', kat:'Cerrahi',        sn:'EK-003',  lok:'Salon 3', durum:'Aktif',   sonBakim:'2025-02-15', sonucBakim:'2026-08-15', kalibrasyon:'2025-05-15', garantiBitis:'2026-06-01' },
  { id:'C04', ad:'Artroskopi Kamerası', kat:'Ortopedi',       sn:'AK-001',  lok:'Depo',    durum:'Arızalı', sonBakim:'2025-01-10', sonucBakim:'2026-07-10', kalibrasyon:'2025-04-10', garantiBitis:'2026-03-01' },
  { id:'C05', ad:'C-Arm Floroskopi',    kat:'Görüntüleme',    sn:'CA-001',  lok:'Salon 4', durum:'Aktif',   sonBakim:'2025-04-01', sonucBakim:'2026-10-01', kalibrasyon:'2025-07-01', garantiBitis:'2028-01-01' },
  { id:'C06', ad:'Pulmoner Monitör',    kat:'Monitörizasyon', sn:'PM-001',  lok:'Salon 3', durum:'Bakımda', sonBakim:'2025-04-20', sonucBakim:'2026-10-20', kalibrasyon:'2025-07-20', garantiBitis:'2026-12-01' },
  { id:'C07', ad:'İnfüzyon Pompası',    kat:'Monitörizasyon', sn:'IP-001',  lok:'Salon 1', durum:'Aktif',   sonBakim:'2025-03-15', sonucBakim:'2026-09-15', kalibrasyon:'2025-06-15', garantiBitis:'2026-09-01' },
  { id:'C08', ad:'Laparoskopi Kamerası',kat:'Cerrahi',        sn:'LK-001',  lok:'Salon 2', durum:'Aktif',   sonBakim:'2025-04-10', sonucBakim:'2026-10-10', kalibrasyon:'2025-07-10', garantiBitis:'2027-06-01' },
];

export const BAKIM_PLANLARI = [
  { id:'B01', cihaz:'Anestezi Cihazı 1',   tip:'Periyodik Bakım', tarih:'2025-09-01', sure:'2 saat',  teknisyen:'Uzm. Serkan Kaya',   durum:'Planlandı' },
  { id:'B02', cihaz:'C-Arm Floroskopi',     tip:'Kalibrasyon',     tarih:'2025-07-15', sure:'3 saat',  teknisyen:'Uzm. Serkan Kaya',   durum:'Planlandı' },
  { id:'B03', cihaz:'Elektrokoter Unit 3',  tip:'Periyodik Bakım', tarih:'2025-08-15', sure:'1.5 saat',teknisyen:'Tek. Burak Yıldız',  durum:'Planlandı' },
  { id:'B04', cihaz:'Pulmoner Monitör',     tip:'Korektif Bakım',  tarih:'2025-06-20', sure:'4 saat',  teknisyen:'Uzm. Serkan Kaya',   durum:'Devam Ediyor' },
  { id:'B05', cihaz:'Artroskopi Kamerası',  tip:'Onarım',          tarih:'2025-06-18', sure:'?',       teknisyen:'Tek. Burak Yıldız',  durum:'Bekliyor' },
];

export const ARIZA_BILDIRIMLERI = [
  { id:'A01', cihaz:'Artroskopi Kamerası', bildiren:'Anestezi Teknisyeni', tarih:'2025-06-13', aciklama:'Lens kırık, görüntü yok', oncelik:'Yüksek', durum:'Açık' },
  { id:'A02', cihaz:'Pulmoner Monitör',    bildiren:'Ameliyat Hemşiresi',  tarih:'2025-06-12', aciklama:'Alarm sistemi çalışmıyor',  oncelik:'Yüksek', durum:'İşlemde' },
  { id:'A03', cihaz:'Elektrokoter',        bildiren:'Anestezi Teknisyeni', tarih:'2025-06-10', aciklama:'Zaman zaman kesiliyor',     oncelik:'Orta',   durum:'İşlemde' },
];

// ── TEKNİK SERVİS MODÜLÜ ────────────────────────────────────────
export const SERVIS_TALEPLERI = [
  { id:'ST001', cihaz:'Artroskopi Kamerası', bildiren:'Anestezi Teknisyeni', tarih:'2025-06-13', aciklama:'Lens kırık, görüntü yok',       oncelik:'Acil',   durum:'Açık',      atanan:'Tek. Burak Yıldız',  sure:'—'      },
  { id:'ST002', cihaz:'Pulmoner Monitör',    bildiren:'Ameliyat Hemşiresi',  tarih:'2025-06-12', aciklama:'Alarm sistemi çalışmıyor',      oncelik:'Yüksek', durum:'İşlemde',   atanan:'Tek. Burak Yıldız',  sure:'3 saat' },
  { id:'ST003', cihaz:'Elektrokoter Unit 3', bildiren:'Cerrah',              tarih:'2025-06-10', aciklama:'Zaman zaman kesinti oluyor',    oncelik:'Orta',   durum:'İşlemde',   atanan:'Tek. Burak Yıldız',  sure:'2 saat' },
  { id:'ST004', cihaz:'Anestezi Cihazı 2',  bildiren:'Anestezi Sorumlusu',  tarih:'2025-06-08', aciklama:'Rutin periyodik bakım',         oncelik:'Düşük',  durum:'Tamamlandı',atanan:'Tek. Burak Yıldız',  sure:'2 saat' },
  { id:'ST005', cihaz:'C-Arm Floroskopi',    bildiren:'Radyoloji',           tarih:'2025-06-07', aciklama:'Yıllık kalibrasyon kontrolü',   oncelik:'Düşük',  durum:'Tamamlandı',atanan:'Uzm. Serkan Kaya',   sure:'4 saat' },
];

export const IS_EMIRLERI = [
  { id:'IE001', tip:'Korektif Bakım',  cihaz:'Artroskopi Kamerası', baslangic:'2025-06-13', bitis:'—',          teknisyen:'Tek. Burak Yıldız', durum:'Devam Ediyor', notlar:'Lens değişimi gerekiyor, parça siparişi verildi.' },
  { id:'IE002', tip:'Korektif Bakım',  cihaz:'Pulmoner Monitör',    baslangic:'2025-06-12', bitis:'—',          teknisyen:'Tek. Burak Yıldız', durum:'Devam Ediyor', notlar:'Alarm kartı değiştirilecek.' },
  { id:'IE003', tip:'Periyodik Bakım', cihaz:'Anestezi Cihazı 2',   baslangic:'2025-06-08', bitis:'2025-06-08', teknisyen:'Tek. Burak Yıldız', durum:'Tamamlandı',   notlar:'Filtre değişimi ve genel kontrol yapıldı.' },
  { id:'IE004', tip:'Kalibrasyon',     cihaz:'C-Arm Floroskopi',    baslangic:'2025-06-07', bitis:'2025-06-07', teknisyen:'Uzm. Serkan Kaya',  durum:'Tamamlandı',   notlar:'Yıllık kalibrasyon sertifikası yenilendi.' },
];

export const PARCA_STOK = [
  { id:'P01', ad:'Lens Modülü (Artroskopi)',    kat:'Optik',       stok:0,  kritikStok:1, birim:'adet', tedarikci:'Karl Storz',   siparisDurum:'Sipariş Verildi' },
  { id:'P02', ad:'Alarm Kartı (Monitör)',       kat:'Elektronik',  stok:2,  kritikStok:2, birim:'adet', tedarikci:'Philips',       siparisDurum:'Stokta' },
  { id:'P03', ad:'Filtre Seti (Anestezi)',      kat:'Sarf',        stok:8,  kritikStok:3, birim:'paket',tedarikci:'Dräger',        siparisDurum:'Stokta' },
  { id:'P04', ad:'O-Ring Seti',                 kat:'Mekanik',     stok:15, kritikStok:5, birim:'adet', tedarikci:'Genel Sarf',    siparisDurum:'Stokta' },
  { id:'P05', ad:'Güç Kablosu (Koter)',         kat:'Elektrik',    stok:3,  kritikStok:2, birim:'adet', tedarikci:'Erbe',          siparisDurum:'Stokta' },
  { id:'P06', ad:'Isı Sensörü',                 kat:'Elektronik',  stok:1,  kritikStok:2, birim:'adet', tedarikci:'Genel Sarf',    siparisDurum:'Kritik' },
];

// ── SUPER ADMIN MODÜLÜ — Platform geneli hastane/kurum yönetimi ──
export const KURUMLAR = [
  { id:'K001', ad:'Merkez Devlet Hastanesi', tur:'Devlet Hastanesi', sehir:'İstanbul', ilce:'Bağcılar',
    yatak:450, salonSayisi:8, kullaniciSayisi:64, durum:'Aktif',
    paket:'Standard', abonelikBaslangic:'2024-01-15', abonelikBitis:'2026-12-31', aylikUcret:18500,
    iletisimAd:'Dr. Üst Yönetici', iletisimTel:'(0212) 555 10 20', iletisimEmail:'ameliyathane@merkezdevlet.sag.gov.tr' },
  { id:'K002', ad:'Anadolu Özel Hastanesi', tur:'Özel Hastane', sehir:'Ankara', ilce:'Çankaya',
    yatak:280, salonSayisi:6, kullaniciSayisi:41, durum:'Aktif',
    paket:'Premium', abonelikBaslangic:'2024-06-01', abonelikBitis:'2026-06-01', aylikUcret:32000,
    iletisimAd:'Op. Dr. Selin Korkmaz', iletisimTel:'(0312) 444 20 10', iletisimEmail:'yonetim@anadoluozel.com.tr' },
  { id:'K003', ad:'Ege Üniversite Hastanesi', tur:'Üniversite Hastanesi', sehir:'İzmir', ilce:'Bornova',
    yatak:620, salonSayisi:14, kullaniciSayisi:118, durum:'Aktif',
    paket:'Enterprise', abonelikBaslangic:'2023-09-01', abonelikBitis:'2027-09-01', aylikUcret:54000,
    iletisimAd:'Prof. Dr. Hakan Çelik', iletisimTel:'(0232) 444 30 40', iletisimEmail:'bilgiislem@ege.edu.tr' },
  { id:'K004', ad:'Akdeniz Yaşam Hastanesi', tur:'Özel Hastane', sehir:'Antalya', ilce:'Muratpaşa',
    yatak:150, salonSayisi:4, kullaniciSayisi:23, durum:'Deneme Süresi', paket:'Standard',
    abonelikBaslangic:'2026-05-20', abonelikBitis:'2026-06-19', aylikUcret:18500,
    iletisimAd:'Yön. Burcu Yalçın', iletisimTel:'(0242) 444 50 60', iletisimEmail:'info@akdenizyasam.com.tr' },
  { id:'K005', ad:'Karadeniz Devlet Hastanesi', tur:'Devlet Hastanesi', sehir:'Trabzon', ilce:'Ortahisar',
    yatak:320, salonSayisi:7, kullaniciSayisi:0, durum:'Pasif',
    paket:'Standard', abonelikBaslangic:'2025-01-10', abonelikBitis:'2025-12-31', aylikUcret:18500,
    iletisimAd:'Dr. Murat Aydın', iletisimTel:'(0462) 444 70 80', iletisimEmail:'idare@karadenizdevlet.sag.gov.tr' },
];

export const PLATFORM_PAKETLERI = [
  { id:'standard',  ad:'Standard',  aylikUcret:18500, maxSalon:10, maxKullanici:75,  ozellikler:['Temel ameliyathane yönetimi','Hasta kayıtları','Steril set takibi','E-posta destek'] },
  { id:'premium',   ad:'Premium',   aylikUcret:32000, maxSalon:25, maxKullanici:200, ozellikler:['Standard\'daki her şey','Eğitim modülü','Gelişmiş raporlama','Öncelikli destek'] },
  { id:'enterprise',ad:'Enterprise',aylikUcret:54000, maxSalon:999,maxKullanici:9999,ozellikler:['Premium\'daki her şey','Çoklu kampüs desteği','Özel entegrasyonlar','7/24 telefon destek','Özel hesap yöneticisi'] },
];

// ── Kurum Grupları (hastane zincirleri) ─────────────────────────
export const KURUM_GRUPLARI = [
  { id:'G001', ad:'Acıbadem Sağlık Grubu', tip:'Özel Zincir', kurumIdler:['K002'], yetkiliAd:'Murat Beşer', yetkiliEmail:'kurumsal@acibadem.com', toplamGelir:32000, durum:'Aktif' },
  { id:'G002', ad:'Sağlık Bakanlığı — Marmara Bölgesi', tip:'Kamu Grubu', kurumIdler:['K001'], yetkiliAd:'Dr. Fatih Er', yetkiliEmail:'marmara@saglik.gov.tr', toplamGelir:18500, durum:'Aktif' },
  { id:'G003', ad:'Ege Üniversiteleri Sağlık Birliği', tip:'Üniversite Grubu', kurumIdler:['K003'], yetkiliAd:'Prof. Dr. Hakan Çelik', yetkiliEmail:'birlik@ege.edu.tr', toplamGelir:54000, durum:'Aktif' },
  { id:'G004', ad:'Bağımsız Hastaneler', tip:'Bağımsız', kurumIdler:['K004','K005'], yetkiliAd:'—', yetkiliEmail:'—', toplamGelir:18500, durum:'Aktif' },
];

// ── Yetki Grupları (platform seviyesi roller) ───────────────────
export const YETKI_GRUPLARI = [
  { id:'Y001', ad:'Süper Yöneticiler', aciklama:'Platformun tamamına tam erişim', kullaniciSayisi:2, izinler:['Tüm kurumları görüntüle/düzenle','Faturalama yönetimi','Sistem ayarları','Kullanıcı yönetimi'] },
  { id:'Y002', ad:'Destek Ekibi', aciklama:'Müşteri desteği ve kurum talepleri', kullaniciSayisi:5, izinler:['Kurum talepleri görüntüle/yanıtla','Aktivite logları görüntüle','Kullanıcıları görüntüle (salt okunur)'] },
  { id:'Y003', ad:'Finans Ekibi', aciklama:'Faturalama ve gelir-gider takibi', kullaniciSayisi:3, izinler:['Faturalar görüntüle/düzenle','Gelir-gider raporları','Plan ve fiyat yönetimi'] },
  { id:'Y004', ad:'İçerik Yöneticileri', aciklama:'Website ve pazarlama içerikleri', kullaniciSayisi:2, izinler:['Website içerik düzenleme','Blog yönetimi','SEO ayarları'] },
];

// ── Gelir / Gider ────────────────────────────────────────────────
export const GELIR_GIDER = {
  ozet: { aylikGelir: 123000, aylikGider: 38500, netKar: 84500, buyumeOrani: 12.4 },
  aylikGelirTrend: [
    { ay:'Ocak',   gelir:98000,  gider:32000 },
    { ay:'Şubat',  gelir:101500, gider:33200 },
    { ay:'Mart',   gelir:105000, gider:34000 },
    { ay:'Nisan',  gelir:110500, gider:35500 },
    { ay:'Mayıs',  gelir:118000, gider:37000 },
    { ay:'Haziran',gelir:123000, gider:38500 },
  ],
  giderKategorileri: [
    { kategori:'Sunucu & Altyapı', tutar:14500, renk:'#0284C7' },
    { kategori:'Personel',         tutar:16000, renk:'#7C3AED' },
    { kategori:'Pazarlama',        tutar:5000,  renk:'#D97706' },
    { kategori:'Destek Araçları',  tutar:2000,  renk:'#059669' },
    { kategori:'Diğer',            tutar:1000,  renk:'#94A3B8' },
  ],
  gelirKaynagi: [
    { kurum:'Ege Üniversite Hastanesi', tutar:54000 },
    { kurum:'Anadolu Özel Hastanesi',   tutar:32000 },
    { kurum:'Merkez Devlet Hastanesi',  tutar:18500 },
    { kurum:'Akdeniz Yaşam Hastanesi',  tutar:18500 },
  ],
};

// ── Faturalar ──────────────────────────────────────────────────
export const FATURALAR = [
  { id:'FT-2026-0601', kurumId:'K001', kurumAd:'Merkez Devlet Hastanesi', tutar:18500, kesimTarihi:'2026-06-01', vadeTarihi:'2026-06-15', durum:'Ödendi', odemeTarihi:'2026-06-10' },
  { id:'FT-2026-0602', kurumId:'K002', kurumAd:'Anadolu Özel Hastanesi',  tutar:32000, kesimTarihi:'2026-06-01', vadeTarihi:'2026-06-15', durum:'Ödendi', odemeTarihi:'2026-06-08' },
  { id:'FT-2026-0603', kurumId:'K003', kurumAd:'Ege Üniversite Hastanesi',tutar:54000, kesimTarihi:'2026-06-01', vadeTarihi:'2026-06-15', durum:'Bekliyor', odemeTarihi:null },
  { id:'FT-2026-0604', kurumId:'K004', kurumAd:'Akdeniz Yaşam Hastanesi', tutar:18500, kesimTarihi:'2026-06-01', vadeTarihi:'2026-06-15', durum:'Gecikti', odemeTarihi:null },
  { id:'FT-2026-0505', kurumId:'K001', kurumAd:'Merkez Devlet Hastanesi', tutar:18500, kesimTarihi:'2026-05-01', vadeTarihi:'2026-05-15', durum:'Ödendi', odemeTarihi:'2026-05-09' },
  { id:'FT-2026-0506', kurumId:'K002', kurumAd:'Anadolu Özel Hastanesi',  tutar:32000, kesimTarihi:'2026-05-01', vadeTarihi:'2026-05-15', durum:'Ödendi', odemeTarihi:'2026-05-11' },
];

// ── Kurum Talepleri (destek/satış talepleri) ────────────────────
export const KURUM_TALEPLERI = [
  { id:'KT001', kurumAd:'Akdeniz Yaşam Hastanesi', tip:'Teknik Destek', konu:'QR etiket yazıcısı entegrasyon sorunu', tarih:'2026-06-18', oncelik:'Yüksek', durum:'Açık', atanan:'Destek Ekibi',
    yorumlar:[
      { yazan:'Yön. Burcu Yalçın', rol:'Kurum', tarih:'2026-06-18 09:15', mesaj:'Yazıcı QR etiketleri doğru basmıyor, set takibinde sorun yaşıyoruz.' },
    ] },
  { id:'KT002', kurumAd:'Ege Üniversite Hastanesi', tip:'Özellik Talebi', konu:'Çoklu kampüs raporlama istek', tarih:'2026-06-17', oncelik:'Orta', durum:'İşlemde', atanan:'Murat Demir',
    yorumlar:[
      { yazan:'Prof. Dr. Hakan Çelik', rol:'Kurum', tarih:'2026-06-17 11:00', mesaj:'3 farklı kampüsümüz var, raporları tek ekrandan karşılaştırmalı görmek istiyoruz.' },
      { yazan:'Murat Demir', rol:'Operio', tarih:'2026-06-17 14:30', mesaj:'Talebinizi ürün ekibimize ilettik, yol haritasına ekledik. Geri dönüş yapacağız.' },
    ] },
  { id:'KT003', kurumAd:'Karadeniz Devlet Hastanesi', tip:'Faturalama', konu:'Abonelik yeniden aktifleştirme talebi', tarih:'2026-06-15', oncelik:'Yüksek', durum:'Açık', atanan:'Finans Ekibi',
    yorumlar:[
      { yazan:'Dr. Murat Aydın', rol:'Kurum', tarih:'2026-06-15 08:40', mesaj:'Bütçe onayımız çıktı, hesabımızı tekrar aktifleştirmek istiyoruz.' },
    ] },
  { id:'KT004', kurumAd:'Anadolu Özel Hastanesi', tip:'Satış', konu:'Enterprise pakete geçiş görüşmesi', tarih:'2026-06-10', oncelik:'Orta', durum:'Tamamlandı', atanan:'Selin Korkmaz',
    yorumlar:[
      { yazan:'Op. Dr. Selin Korkmaz', rol:'Kurum', tarih:'2026-06-10 10:00', mesaj:'Enterprise paket fiyatlandırması hakkında görüşmek istiyoruz.' },
      { yazan:'Selin Korkmaz', rol:'Operio', tarih:'2026-06-11 09:00', mesaj:'Görüşme planlandı, teklif gönderildi.' },
      { yazan:'Selin Korkmaz', rol:'Operio', tarih:'2026-06-12 16:00', mesaj:'Anlaşma sağlandı, geçiş süreci tamamlandı.' },
    ] },
  { id:'KT005', kurumAd:'Merkez Devlet Hastanesi', tip:'Teknik Destek', konu:'Personel listesi içe aktarma hatası', tarih:'2026-06-05', oncelik:'Düşük', durum:'Tamamlandı', atanan:'Destek Ekibi',
    yorumlar:[
      { yazan:'Dr. Üst Yönetici', rol:'Kurum', tarih:'2026-06-05 13:20', mesaj:'Excel ile personel içe aktarırken hata alıyoruz.' },
      { yazan:'Destek Ekibi', rol:'Operio', tarih:'2026-06-05 15:00', mesaj:'Dosya formatınızı inceledik, sütun sırası hatalıydı. Düzeltme rehberi gönderdik.' },
      { yazan:'Dr. Üst Yönetici', rol:'Kurum', tarih:'2026-06-06 09:10', mesaj:'Teşekkürler, sorun çözüldü.' },
    ] },
];

// ── Aktivite Logları (sistem geneli işlem kayıtları) ────────────
export const AKTIVITE_LOGLARI = [
  { id:'L001', tarih:'2026-06-21 09:42', kullanici:'Sis. Yön. Deniz Korkmaz', islem:'Kurum durumu değiştirildi', detay:'Karadeniz Devlet Hastanesi → Pasif', tip:'kurum' },
  { id:'L002', tarih:'2026-06-21 08:15', kullanici:'Dr. Üst Yönetici', islem:'Yeni personel eklendi', detay:'Merkez Devlet Hastanesi — Hem. Ayşe Korkmaz', tip:'kullanici' },
  { id:'L003', tarih:'2026-06-20 17:30', kullanici:'Sistem', islem:'Otomatik fatura kesildi', detay:'FT-2026-0603 — Ege Üniversite Hastanesi', tip:'fatura' },
  { id:'L004', tarih:'2026-06-20 14:05', kullanici:'Op. Dr. Selin Korkmaz', islem:'Plan yükseltildi', detay:'Anadolu Özel Hastanesi: Premium → Enterprise (teklif aşamasında)', tip:'abonelik' },
  { id:'L005', tarih:'2026-06-19 11:20', kullanici:'Sis. Yön. Deniz Korkmaz', islem:'Yeni kurum eklendi', detay:'Akdeniz Yaşam Hastanesi — Deneme süresi başlatıldı', tip:'kurum' },
  { id:'L006', tarih:'2026-06-18 16:48', kullanici:'Destek Ekibi', islem:'Talep yanıtlandı', detay:'KT005 — Personel listesi içe aktarma hatası çözüldü', tip:'destek' },
  { id:'L007', tarih:'2026-06-17 10:12', kullanici:'Dr. Ahmet Yılmaz', islem:'Oturum açıldı', detay:'Merkez Devlet Hastanesi — Doktor girişi', tip:'oturum' },
];

// ── Sistem Ayarları ──────────────────────────────────────────────
export const SISTEM_AYARLARI = {
  platformAdi: 'Operio',
  destekEmail: 'destek@operio.com',
  faturaEmail: 'fatura@operio.com',
  denemeSuresiGun: 30,
  otomatikFaturalama: true,
  bakimModu: false,
  smtpSunucu: 'smtp.operio.com',
  smtpPort: 587,
  maxDosyaBoyutuMB: 50,
  yedeklemeSikligi: 'Günlük',
  sonYedekleme: '2026-06-21 03:00',
};

// ── Website Yönetimi (pazarlama sitesi içerik) ──────────────────
export const WEBSITE_ICERIK = {
  anaSayfaBaslik: 'Ameliyathaneler için Akıllı Yönetim Platformu',
  anaSayfaAltBaslik: 'Operio ile ameliyat planlamadan sterilizasyon takibine, tüm süreçlerinizi tek platformdan yönetin.',
  iletisimEmail: 'info@operio.com',
  iletisimTel: '(0850) 532 10 20',
  demoTalepSayisi: 14,
  blogYazilari: [
    { id:'B1', baslik:'Ameliyathane Verimliliğini Artırmanın 5 Yolu', yayinTarihi:'2026-06-10', durum:'Yayında', goruntulenme:842 },
    { id:'B2', baslik:'Dijital Sterilizasyon Takibi Neden Önemli?', yayinTarihi:'2026-05-28', durum:'Yayında', goruntulenme:611 },
    { id:'B3', baslik:'JCI Akreditasyonu için Dijital Dönüşüm', yayinTarihi:'2026-06-22', durum:'Taslak', goruntulenme:0 },
  ],
};

// ── İlaç Rehberi ──────────────────────────────────────────────
// Bilgi amaçlı genel referans listesidir; doz, etkileşim ve kontrendikasyon
// bilgisi İÇERMEZ. Klinik karar için resmi prospektüs/protokoller esastır.
export const ILAC_REHBERI = [
  { id:'I001', ad:'Propofol', kategori:'Anestezik (IV)', kullanimAlani:'Genel anestezi indüksiyonu ve idamesi, sedasyon', notlar:'Hızlı etki başlangıcı ve kısa yarılanma ömrü ile bilinir.' },
  { id:'I002', ad:'Sevofluran', kategori:'Anestezik (İnhalasyon)', kullanimAlani:'Genel anestezi idamesi', notlar:'İnhalasyon yoluyla uygulanan, hızlı indüksiyon/derlenme sağlayan ajan.' },
  { id:'I003', ad:'Fentanil', kategori:'Opioid Analjezik', kullanimAlani:'Perioperatif ağrı yönetimi, anestezi desteği', notlar:'Güçlü, kısa etkili opioid; solunum depresyonu riski nedeniyle yakın izlem gerektirir.' },
  { id:'I004', ad:'Remifentanil', kategori:'Opioid Analjezik', kullanimAlani:'İntraoperatif analjezi', notlar:'Çok kısa etki süresi; sürekli infüzyon şeklinde kullanılır.' },
  { id:'I005', ad:'Rokuronyum', kategori:'Nöromüsküler Bloker', kullanimAlani:'Entübasyon kolaylaştırma, cerrahi gevşeme', notlar:'Orta etkili, non-depolarizan kas gevşetici.' },
  { id:'I006', ad:'Süksinilkolin', kategori:'Nöromüsküler Bloker', kullanimAlani:'Hızlı entübasyon (RSI)', notlar:'Depolarizan tip, hızlı başlangıç ve kısa etki süresi.' },
  { id:'I007', ad:'Midazolam', kategori:'Benzodiazepin', kullanimAlani:'Premedikasyon, sedasyon, anksiyoliz', notlar:'Amnestik etkisi ile preoperatif anksiyete yönetiminde sık kullanılır.' },
  { id:'I008', ad:'Atropin', kategori:'Antikolinerjik', kullanimAlani:'Bradikardi yönetimi, sekresyon azaltma', notlar:'Acil kart/crash cart ilaçlarından biridir.' },
  { id:'I009', ad:'Efedrin', kategori:'Vazopresör', kullanimAlani:'Anestezi ile ilişkili hipotansiyon yönetimi', notlar:'Hızlı etkili, sık kullanılan vazopresör ajan.' },
  { id:'I010', ad:'Noradrenalin', kategori:'Vazopresör', kullanimAlani:'Ciddi hipotansiyon, hemodinamik destek', notlar:'Sürekli infüzyon ve yakın monitörizasyon gerektirir.' },
  { id:'I011', ad:'Lidokain', kategori:'Lokal Anestezik', kullanimAlani:'Lokal/bölgesel anestezi, antiaritmik amaçlı', notlar:'Hem lokal anestezik hem antiaritmik etkisi olan çok yönlü ajan.' },
  { id:'I012', ad:'Bupivakain', kategori:'Lokal Anestezik', kullanimAlani:'Spinal/epidural anestezi, periferik sinir blokları', notlar:'Uzun etkili lokal anestezik.' },
  { id:'I013', ad:'Parasetamol (IV)', kategori:'Analjezik (Non-opioid)', kullanimAlani:'Postoperatif ağrı yönetimi', notlar:'Multimodal analjezi protokollerinde sıkça yer alır.' },
  { id:'I014', ad:'Deksametazon', kategori:'Kortikosteroid', kullanimAlani:'PONV (postop bulantı-kusma) profilaksisi, antiinflamatuar', notlar:'Anestezi indüksiyonunda profilaktik amaçla sık kullanılır.' },
  { id:'I015', ad:'Ondansetron', kategori:'Antiemetik', kullanimAlani:'Postoperatif bulantı-kusma profilaksisi ve tedavisi', notlar:'5-HT3 reseptör antagonisti.' },
  { id:'I016', ad:'Neostigmin', kategori:'Kolinesteraz İnhibitörü', kullanimAlani:'Nöromüsküler blok antagonizasyonu (reversal)', notlar:'Genellikle bir antikolinerjik (atropin/glikopirolat) ile birlikte uygulanır.' },
  { id:'I017', ad:'Sugammadeks', kategori:'Selektif Bağlayıcı Ajan', kullanimAlani:'Rokuronyum/vekuronyum bloğunun hızlı reversal\'ı', notlar:'Hızlı ve öngörülebilir reversal sağlar.' },
  { id:'I018', ad:'Heparin', kategori:'Antikoagülan', kullanimAlani:'Tromboprofilaksi, kardiyak/vasküler cerrahide antikoagülasyon', notlar:'Etkisi protamin sülfat ile geri döndürülebilir.' },
  { id:'I019', ad:'Traneksamik Asit', kategori:'Antifibrinolitik', kullanimAlani:'Perioperatif kanama kontrolü', notlar:'Özellikle ortopedik ve kardiyak cerrahide kan kaybını azaltmak için kullanılır.' },
  { id:'I020', ad:'Sefazolin', kategori:'Antibiyotik (Sefalosporin)', kullanimAlani:'Cerrahi profilaksi', notlar:'Birçok cerrahi prosedürde standart profilaktik antibiyotik.' },
];
