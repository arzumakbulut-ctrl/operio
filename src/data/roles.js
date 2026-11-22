// ── OPERIO ROL TANIMI ─────────────────────────────────────────
// Kaynak: Operio_Final.html satır 9146 — birebir alındı

export const ROLES = [
  // ── 0: ÜST YÖNETİCİ ──────────────────────────────────────
  {
    id: 0, name: 'Üst Yönetici', full: 'Dr. Üst Yönetici', av: 'ÜY',
    bg: '#14B8A6', color: '#14B8A6',
    nav: [
      { sec: 'Genel', items: [
        { ic: 'dash',  lbl: 'Kontrol Paneli',         path: '/dashboard' },
        { ic: 'hosp',  lbl: 'Kurum Yönetimi',         path: '/kurum' },
        { ic: 'room',  lbl: 'Salon Yönetimi',         path: '/salonlar' },
        { ic: 'cal',   lbl: 'Doluluk Takvimi',        path: '/takvim' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
        { ic: 'set',   lbl: 'Sesli Kontrol Ayarları', path: '/sesli-kontrol-ayarlari' },
      ]},
      { sec: 'Kullanıcılar', items: [
        { ic: 'users', lbl: 'Doktor Yönetimi',        path: '/doktorlar' },
        { ic: 'staff', lbl: 'Personel Listesi',       path: '/personel' },
        { ic: 'key',   lbl: 'Yetki & Roller',         path: '/roller' },
        { ic: 'users', lbl: 'Misafir Hekim Yönetimi', path: '/misafir-hekim' },
      ]},
      { sec: 'Klinik', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
        { ic: 'chat',  lbl: 'Mesajlaşma',             path: '/mesajlasma' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
      { sec: 'Planlama', items: [
        { ic: 'cal',   lbl: 'Çalışma Listeleri',      path: '/calisma' },
        { ic: 'clock', lbl: 'Mesai Hesaplama',        path: '/mesai' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'doc',   lbl: 'Eğitim Yönetimi',        path: '/egitim-yonetim' },
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Raporlar', items: [
        { ic: 'chart', lbl: 'İstatistikler',          path: '/istatistik' },
        { ic: 'ind',   lbl: 'İndikatörler',           path: '/indikatörler' },
        { ic: 'users', lbl: 'Katılım İstekleri',       path: '/katilim-istekleri' },
        { ic: 'doc',   lbl: 'Raporlar',               path: '/raporlar' },
        { ic: 'dash',  lbl: 'Salon Verimliliği',      path: '/salon-verimlilik' },
        { ic: 'bell',  lbl: 'Bildirim & Duyuru',      path: '/bildirim' },
      ]},
      { sec: 'Abonelik', items: [
        { ic: 'key',   lbl: 'Paket & Modül Yönetimi', path: '/abonelik' },
      ]},
    ],
  },

  // ── 1: AMELİYATHANE SORUMLU HEMŞİRESİ ────────────────────
  {
    id: 1, name: 'Ameliyathane Sorumlu Hemşiresi', full: 'Hem. Fatma Şahin', av: 'FŞ',
    bg: '#0284C7', color: '#0284C7',
    nav: [
      { sec: 'Ameliyathane', items: [
        { ic: 'dash',  lbl: 'Ameliyat Listesi',       path: '/ameliyatlar' },
        { ic: 'ane',   lbl: 'Ekip Planı',             path: '/ekip' },
        { ic: 'room',  lbl: 'Salon Yönetimi',         path: '/salonlar' },
        { ic: 'cal',   lbl: 'Doluluk Takvimi',        path: '/takvim' },
        { ic: 'doc',   lbl: 'Randevu Talepleri',        path: '/onay' },
      ]},
      { sec: 'Personel', items: [
        { ic: 'users', lbl: 'Personel Listesi',        path: '/personel' },
        { ic: 'cal',   lbl: 'Çalışma Listesi',        path: '/calisma' },
        { ic: 'clock', lbl: 'Mesai Hesaplama',        path: '/mesai' },
      ]},
      { sec: 'Klinik', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
      { sec: 'Ekipman', items: [
        { ic: 'dev',   lbl: 'Cihaz Envanteri',        path: '/envanter' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
        { ic: 'set',   lbl: 'Cerrahi Setler',         path: '/steril-setler' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'doc',   lbl: 'Eğitim Yönetimi',        path: '/egitim-yonetim' },
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Raporlar', items: [
        { ic: 'chart', lbl: 'İstatistikler',          path: '/istatistik' },
        { ic: 'ind',   lbl: 'İndikatörler',           path: '/indikatörler' },
        { ic: 'dash',  lbl: 'Salon Verimliliği',      path: '/salon-verimlilik' },
        { ic: 'doc',   lbl: 'Raporlar',               path: '/raporlar' },
        { ic: 'bell',  lbl: 'Bildirim & Duyuru',      path: '/bildirim' },
      ]},
    ],
  },

  // ── 2: ANESTEZİ SORUMLUSU ─────────────────────────────────
  {
    id: 2, name: 'Anestezi Sorumlusu', full: 'Uzm. Kemal Arslan', av: 'KA',
    bg: '#7C3AED', color: '#7C3AED',
    nav: [
      { sec: 'Ameliyathane', items: [
        { ic: 'dash',  lbl: 'Ameliyat Listesi',       path: '/ameliyatlar' },
        { ic: 'ane',   lbl: 'Ekip Planı',             path: '/ekip' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
      { sec: 'Kadro', items: [
        { ic: 'users', lbl: 'Teknisyen Kadrosu',      path: '/personel', badge: '1' },
        { ic: 'cal',   lbl: 'Çalışma Listesi',        path: '/calisma' },
        { ic: 'clock', lbl: 'Mesai Hesaplama',        path: '/mesai' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'doc',   lbl: 'Eğitim Yönetimi',        path: '/egitim-yonetim' },
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Raporlar', items: [
        { ic: 'chart', lbl: 'İstatistikler',          path: '/istatistik' },
        { ic: 'ind',   lbl: 'İndikatörler',           path: '/indikatörler' },
        { ic: 'users', lbl: 'Katılım İstekleri',       path: '/katilim-istekleri' },
        { ic: 'doc',   lbl: 'Raporlar',               path: '/raporlar' },
        { ic: 'bell',  lbl: 'Bildirim & Duyuru',      path: '/bildirim' },
      ]},
    ],
  },

  // ── 3: ANESTEZİ TEKNİSYENİ ────────────────────────────────
  {
    id: 3, name: 'Anestezi Teknisyeni', full: 'Tek. Mehmet Arslan', av: 'MA',
    bg: '#059669', color: '#059669',
    nav: [
      { sec: 'Görevlerim', items: [
        { ic: 'dash',  lbl: 'Ameliyat Listem',        path: '/ameliyatlar' },
        { ic: 'cal',   lbl: 'Çalışma Listem',         path: '/calisma' },
        { ic: 'equip', lbl: 'Cihaz Envanteri',        path: '/envanter' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
    ],
  },

  // ── 4: HEMŞİRE & AMELİYATHANE TEKNİKERİ ─────────────────
  {
    id: 4, name: 'Hemşire & Ameliyathane Teknikeri', full: 'Hem. Ayşe Korkmaz', av: 'AK',
    bg: '#EA580C', color: '#EA580C',
    nav: [
      { sec: 'Görevlerim', items: [
        { ic: 'dash',  lbl: 'Ameliyat Listem',        path: '/ameliyatlar' },
        { ic: 'set',   lbl: 'Vaka Hazırlığı',         path: '/vaka' },
        { ic: 'doc',   lbl: 'Sayım Formu',            path: '/sayim' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
        { ic: 'cal',   lbl: 'Çalışma Listem',         path: '/calisma' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
    ],
  },

  // ── 5: AMELİYATHANE PERSONELİ ─────────────────────────────
  {
    id: 5, name: 'Ameliyathane Personeli', full: 'Aml. Hasan Öz', av: 'HÖ',
    bg: '#F59E0B', color: '#F59E0B',
    nav: [
      { sec: 'Görevlerim', items: [
        { ic: 'dash',  lbl: 'Ameliyat Listesi',       path: '/ameliyatlar' },
        { ic: 'cal',   lbl: 'Çalışma Listem',         path: '/calisma' },
        { ic: 'dev',   lbl: 'Cihaz Envanteri',        path: '/envanter' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
      ]},
    ],
  },

  // ── 6: DOKTOR ─────────────────────────────────────────────
  {
    id: 6, name: 'Doktor', full: 'Dr. Ahmet Yılmaz', av: 'AY',
    bg: '#DC2626', color: '#DC2626',
    nav: [
      { sec: 'Ameliyatlarım', items: [
        { ic: 'dash',  lbl: 'Ameliyat Panosu',        path: '/ameliyatlar' },
        { ic: 'plus',  lbl: 'Ameliyat Talebi',        path: '/talep' },
        { ic: 'cal',   lbl: 'Randevu Durumlarım',     path: '/randevu' },
        { ic: 'proc',  lbl: 'Örnek İstemleri',        path: '/ornek-istemi' },
        { ic: 'dev',   lbl: 'Cihaz Kontrolü',         path: '/cihaz-kontrol' },
      ]},
      { sec: 'Hastalarım', items: [
        { ic: 'pat',   lbl: 'Hasta Kayıtları',        path: '/hastalar' },
      ]},
      { sec: 'Ameliyat Kartlarım', items: [
        { ic: 'proc',  lbl: 'Ameliyat Kartları',      path: '/kartlar' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
      { sec: 'Profil', items: [
        { ic: 'staff', lbl: 'Profilim',               path: '/profil' },
      ]},
    ],
  },

  // ── 7: SEKRETERLİK ────────────────────────────────────────
  {
    id: 7, name: 'Sekreterlik', full: 'Sn. Zeynep Öztürk', av: 'ZÖ',
    bg: '#D97706', color: '#D97706',
    nav: [
      { sec: 'Hastalar', items: [
        { ic: 'pat',   lbl: 'Hasta Listesi',           path: '/hastalar' },
        { ic: 'plus',  lbl: 'Yeni Hasta Ekle',        path: '/yeni-hasta' },
      ]},
      { sec: 'Randevular', items: [
        { ic: 'cal',   lbl: 'Ameliyat Listesi',       path: '/ameliyatlar' },
        { ic: 'doc',   lbl: 'Randevu Talepleri',        path: '/onay' },
        { ic: 'room',  lbl: 'Doluluk Takvimi',        path: '/takvim' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'cal',   lbl: 'Eğitim Takvimi',         path: '/egitim-takvim' },
        { ic: 'proc',  lbl: 'Eğitim Kütüphanesi',     path: '/egitim-kutuphane' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
      ]},
    ],
  },

  // ── 8: STERİLİZASYON SORUMLUSU ────────────────────────────
  {
    id: 8, name: 'Sterilizasyon Sorumlusu', full: 'Srl. Meral Doğan', av: 'MD',
    bg: '#0891b2', color: '#0891b2',
    nav: [
      { sec: 'Genel Bakış', items: [
        { ic: 'dash',   lbl: 'Kontrol Paneli',        path: '/dashboard' },
        { ic: 'room',   lbl: 'Salon Durumu',          path: '/salonlar' },
        { ic: 'ane',    lbl: 'Ameliyat Listesi',      path: '/ameliyatlar' },
      ]},
      { sec: 'Sterilizasyon', items: [
        { ic: 'steril', lbl: 'Set Takip Paneli',      path: '/set-takip' },
        { ic: 'raf',    lbl: 'Steril Depo',           path: '/depo' },
        { ic: 'set',    lbl: 'Cerrahi Setler',        path: '/steril-setler' },
        { ic: 'key',    lbl: 'Tekli Aletler',         path: '/tekli' },
        { ic: 'dev',    lbl: 'Cihaz Envanteri',       path: '/envanter' },
        { ic: 'chart',  lbl: 'Takip Geçmişi',        path: '/steril-gecmis' },
      ]},
      { sec: 'Personel', items: [
        { ic: 'users',  lbl: 'Sterilizasyon Personeli', path: '/steril-personel' },
        { ic: 'cal',    lbl: 'Çalışma Listesi',       path: '/calisma' },
        { ic: 'clock',  lbl: 'Mesai Hesaplama',       path: '/mesai' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'doc',    lbl: 'Eğitim Yönetimi',       path: '/egitim-yonetim' },
        { ic: 'cal',    lbl: 'Eğitim Takvimi',        path: '/egitim-takvim' },
        { ic: 'proc',   lbl: 'Eğitim Kütüphanesi',    path: '/egitim-kutuphane' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',   lbl: 'Prosedürler',           path: '/prosedurler' },
      ]},
      { sec: 'Raporlar', items: [
        { ic: 'chart',  lbl: 'İstatistikler',         path: '/istatistik' },
        { ic: 'ind',    lbl: 'İndikatörler',          path: '/indikatörler' },
        { ic: 'users',  lbl: 'Katılım İstekleri',     path: '/katilim-istekleri' },
        { ic: 'doc',    lbl: 'Raporlar',              path: '/raporlar' },
        { ic: 'bell',   lbl: 'Bildirim & Duyuru',     path: '/bildirim' },
      ]},
    ],
  },

  // ── 9: STERİLİZASYON PERSONELİ ────────────────────────────
  {
    id: 9, name: 'Sterilizasyon Personeli', full: 'Srl. Kerim Çelik', av: 'KÇ',
    bg: '#0E7490', color: '#0E7490',
    nav: [
      { sec: 'İş Akışı', items: [
        { ic: 'steril', lbl: 'Set Takip Paneli',      path: '/set-takip' },
        { ic: 'raf',    lbl: 'Steril Depo',           path: '/depo' },
        { ic: 'cal',    lbl: 'Çalışma Listem',        path: '/calisma' },
      ]},
      { sec: 'Eğitim', items: [
        { ic: 'cal',    lbl: 'Eğitim Takvimi',        path: '/egitim-takvim' },
        { ic: 'proc',   lbl: 'Eğitim Kütüphanesi',    path: '/egitim-kutuphane' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',   lbl: 'Prosedürler',           path: '/prosedurler' },
      ]},
    ],
  },

  // ── 10: MİSAFİR HEKİM ─────────────────────────────────────
  {
    id: 10, name: 'Misafir Hekim', full: 'Dr. Misafir Hekim', av: 'MH',
    bg: '#6366F1', color: '#6366F1',
    nav: [
      { sec: 'Ameliyatlarım', items: [
        { ic: 'dash',  lbl: 'Ameliyat Panosu',        path: '/ameliyatlar' },
        { ic: 'plus',  lbl: 'Ameliyat Talebi',        path: '/talep' },
        { ic: 'cal',   lbl: 'Randevu Durumlarım',     path: '/randevu' },
      ]},
      { sec: 'Hastalarım', items: [
        { ic: 'pat',   lbl: 'Hasta Kayıtları',        path: '/hastalar' },
      ]},
      { sec: 'Ameliyat Kartlarım', items: [
        { ic: 'proc',  lbl: 'Ameliyat Kartları',      path: '/kartlar' },
      ]},
      { sec: 'Dokümanlar', items: [
        { ic: 'proc',  lbl: 'Prosedürler',            path: '/prosedurler' },
        { ic: 'doc',   lbl: 'Tıbbi Sözlük',           path: '/sozluk' },
        { ic: 'proc',  lbl: 'İlaç Rehberi',           path: '/ilac-rehberi' },
      ]},
      { sec: 'Profil', items: [
        { ic: 'staff', lbl: 'Profilim',               path: '/profil' },
      ]},
    ],
  },

  // ── 11: BİYOMEDİKAL ─────────────────────────────────────────
  {
    id: 11, name: 'Biyomedikal', full: 'Uzm. Serkan Kaya', av: 'SK',
    bg: '#0891b2', color: '#0891b2',
    nav: [
      { sec: 'Cihaz Yönetimi', items: [
        { ic: 'dash',  lbl: 'Kontrol Paneli',         path: '/biyomedikal' },
        { ic: 'equip', lbl: 'Cihaz Envanteri',        path: '/envanter' },
        { ic: 'cal',   lbl: 'Bakım Planı',            path: '/bakim-plan' },
        { ic: 'proc',  lbl: 'Kalibrasyon Kayıtları',  path: '/kalibrasyon' },
        { ic: 'set',   lbl: 'Sesli Kontrol Ayarları', path: '/sesli-kontrol-ayarlari' },
      ]},
      { sec: 'Servis & Arıza', items: [
        { ic: 'alert', lbl: 'Arıza Bildirimleri',     path: '/ariza-bildirimleri' },
        { ic: 'doc',   lbl: 'İş Emirleri',            path: '/is-emirleri' },
      ]},
      { sec: 'Raporlar', items: [
        { ic: 'dash',  lbl: 'Cihaz Raporları',        path: '/cihaz-raporlari' },
      ]},
    ],
  },

  // ── 12: TEKNİK SERVİS ────────────────────────────────────────
  {
    id: 12, name: 'Teknik Servis', full: 'Tek. Burak Yıldız', av: 'BY',
    bg: '#7C3AED', color: '#7C3AED',
    nav: [
      { sec: 'Servis Paneli', items: [
        { ic: 'dash',  lbl: 'Kontrol Paneli',         path: '/teknik-servis' },
        { ic: 'alert', lbl: 'Açık Servis Talepleri',  path: '/servis-talepleri' },
        { ic: 'doc',   lbl: 'İş Emirleri',            path: '/is-emirleri' },
      ]},
      { sec: 'Cihaz & Bakım', items: [
        { ic: 'equip', lbl: 'Cihaz Listesi',          path: '/envanter' },
        { ic: 'cal',   lbl: 'Bakım Takvimi',          path: '/bakim-takvimi' },
        { ic: 'set',   lbl: 'Sesli Kontrol Ayarları', path: '/sesli-kontrol-ayarlari' },
      ]},
      { sec: 'Stok & Parça', items: [
        { ic: 'proc',  lbl: 'Parça & Sarf Takibi',    path: '/parca-takip' },
      ]},
    ],
  },

  // ── 13: SUPER ADMIN (PLATFORM) ────────────────────────────
  {
    id: 13, name: 'Super Admin', full: 'Sis. Yön. Deniz Korkmaz', av: 'DK',
    bg: '#1E293B', color: '#1E293B',
    nav: [
      { sec: 'Platform', items: [
        { ic: 'dash',  lbl: 'Platform Paneli',       path: '/platform-panel' },
        { ic: 'hosp',  lbl: 'Kurumlar',              path: '/hastaneler' },
        { ic: 'users', lbl: 'Kurum Grupları',        path: '/kurum-gruplari' },
      ]},
      { sec: 'Kullanıcılar', items: [
        { ic: 'users', lbl: 'Tüm Kullanıcılar',      path: '/platform-kullanicilar' },
        { ic: 'key',   lbl: 'Yetki Grupları',        path: '/yetki-gruplari' },
      ]},
      { sec: 'Abonelik & Finans', items: [
        { ic: 'key',   lbl: 'Plan ve Fiyatlar',      path: '/platform-paketler' },
        { ic: 'chart', lbl: 'Gelir Gider',           path: '/gelir-gider' },
        { ic: 'doc',   lbl: 'Faturalar',             path: '/faturalar' },
      ]},
      { sec: 'Destek & İzleme', items: [
        { ic: 'bell',  lbl: 'Kurum Talepleri',       path: '/kurum-talepleri', badge: '3' },
        { ic: 'clock', lbl: 'Aktivite Logları',      path: '/aktivite-loglari' },
      ]},
      { sec: 'Sistem', items: [
        { ic: 'set',   lbl: 'Sistem Ayarları',       path: '/sistem-ayarlari' },
        { ic: 'doc',   lbl: 'Website Yönetimi',      path: '/website-yonetimi' },
      ]},
    ],
  },
];
