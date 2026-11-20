import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SURGERIES, ROOMS, PERSONEL, HASTALAR, STERIL_SETLER, BILDIRIMLER,
  STERIL_SETLER_V2, TEKLI_ALETLER, STERIL_PERSONEL, DURUM_SET_CFG, initSterilAkis,
  KURUMLAR, KURUM_GRUPLARI } from '../data/mockData';

// ── AUTH STORE ────────────────────────────────────────────────
export const useAuthStore = create(persist(
  (set) => ({
    isLoggedIn:    false,
    curRole:       0,
    user:          null,

    login: (roleId, userData) => set({
      isLoggedIn: true,
      curRole:    Number(roleId),
      user:       userData || null,
    }),

    logout: () => set({
      isLoggedIn: false,
      curRole:    0,
      user:       null,
    }),

    switchRole: (roleId) => set({ curRole: Number(roleId) }),

    setUser: (user) => set({ user }),
  }),
  { name: 'operio-auth', partialize: (s) => ({ isLoggedIn: s.isLoggedIn, curRole: s.curRole, user: s.user }) }
));

// ── DATA STORE ────────────────────────────────────────────────
export const useDataStore = create((set, get) => ({
  surgeries:   [],
  rooms:       [],
  personel:    [],
  hastalar:    [],
  sterilSetler:[],
  // Sterilizasyon modülü
  sterilSetlerV2: [...STERIL_SETLER_V2],
  tekliAletler:   [...TEKLI_ALETLER],
  sterilPersonel: [...STERIL_PERSONEL],
  durumSetCfg:    DURUM_SET_CFG,
  sterilAkis:     initSterilAkis(STERIL_SETLER_V2),
  bildirimler: [],
  // Super Admin — platform geneli kurum ve grup yönetimi
  kurumlar:     [],
  kurumGruplari:[],
  cihazlar:[],
  bakimPlanlari:[],
  arizalar:[],
  faturalar:[],
  gelirGider:null,
  ekMesai:     {},  // {'personelId|tarih': vardiyaId} — örn. 'P01|2026-06-15': 'v3'

  // Ameliyatlar
  addSurgery: (s) => set((st) => ({
    surgeries: [...st.surgeries, { ...s, id: Date.now() }],
  })),
  updateSurgery: (id, data) => set((st) => ({
    surgeries: st.surgeries.map((s) => (s.id === id ? { ...s, ...data } : s)),
  })),
  deleteSurgery: (id) => set((st) => ({
    surgeries: st.surgeries.filter((s) => s.id !== id),
  })),

  // Salonlar
  addRoom: (r) => set((st) => ({
    rooms: [...st.rooms, { ...r, id: 'r' + (st.rooms.length + 1) }],
  })),
  updateRoom: (id, data) => set((st) => ({
    rooms: st.rooms.map((r) => (r.id === id ? { ...r, ...data } : r)),
  })),

  deleteRoom: (id) => set((st) => ({
    rooms: st.rooms.filter((r) => r.id !== id),
  })),

  // Personel
  addPersonel: (p) => set((st) => ({
    personel: [...st.personel, { ...p, id: 'P' + String(st.personel.length + 1).padStart(2, '0') }],
  })),
  updatePersonel: (id, data) => set((st) => ({
    personel: st.personel.map((p) => (p.id === id ? { ...p, ...data } : p)),
  })),
  deletePersonel: (id) => set((st) => ({
    personel: st.personel.filter((p) => p.id !== id),
  })),

  // Ek Mesai — key: 'personelId|tarih', value: vardiyaId ('v1'..'v7')
  addEkMesai: (key, vardiyaId) => set((st) => ({
    ekMesai: { ...st.ekMesai, [key]: vardiyaId }
  })),
  resetEkMesai: (key) => set((st) => {
    const next = { ...st.ekMesai };
    delete next[key];
    return { ekMesai: next };
  }),
  // Backend'den yüklenen tüm atamalar için toplu yükleme
  loadEkMesai: (entries) => set((st) => ({
    ekMesai: { ...st.ekMesai, ...entries }
  })),
  getPersonelMesaiToplam: (personelId) => {
    const st = useDataStore.getState();
    return Object.entries(st.ekMesai)
      .filter(([k]) => k.startsWith(personelId + '|'))
      .reduce((t, [, v]) => t + v, 0);
  },

  // Hastalar
  addHasta: (h) => set((st) => ({
    hastalar: [...st.hastalar, { ...h, id: 'H' + String(st.hastalar.length + 1).padStart(3, '0') }],
  })),
  updateHasta: (id, data) => set((st) => ({
    hastalar: st.hastalar.map((h) => (h.id === id ? { ...h, ...data } : h)),
  })),
  deleteHasta: (id) => set((st) => ({
    hastalar: st.hastalar.filter((h) => h.id !== id),
  })),

  // Steril Setler (eski)
  addSterilSet: (s) => set((st) => ({
    sterilSetler: [...st.sterilSetler, { ...s, id: 'S' + String(st.sterilSetler.length + 1).padStart(2, '0') }],
  })),
  updateSterilSet: (id, data) => set((st) => ({
    sterilSetler: st.sterilSetler.map((s) => (s.id === id ? { ...s, ...data } : s)),
  })),

  // Sterilizasyon modülü actions
  addSterilSetV2: (s) => set((st) => {
    const newId = Math.max(0, ...st.sterilSetlerV2.map(x => x.id)) + 1;
    const newSet = { ...s, id: newId };
    const akis = { ...st.sterilAkis };
    akis[newId] = { asama: 'depoda', sure: 45, zamanlar: {}, gercekSayim: {}, log: [] };
    return { sterilSetlerV2: [...st.sterilSetlerV2, newSet], sterilAkis: akis };
  }),
  updateSterilSetV2: (id, data) => set((st) => ({
    sterilSetlerV2: st.sterilSetlerV2.map(s => s.id === id ? { ...s, ...data } : s),
  })),
  deleteSterilSetV2: (id) => set((st) => ({
    sterilSetlerV2: st.sterilSetlerV2.filter(s => s.id !== id),
  })),
  updateSterilAkis: (setId, patch) => set((st) => ({
    sterilAkis: { ...st.sterilAkis, [setId]: { ...st.sterilAkis[setId], ...patch } },
  })),
  sterilAkisGecis: (setId, yeniAsama, ekBilgi) => set((st) => {
    const now = new Date();
    const saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const s = st.sterilSetlerV2.find(x => x.id === setId);
    const aciklamalar = {
      kirli_teslim:    `Ameliyat sonrası kirli set teslim alındı${ekBilgi ? ' — ' + ekBilgi : ''}`,
      yikamada:        `Yıkama işlemi başlatıldı`,
      sterilizasyonda: `Otoklave yüklendi. Sterilizasyon başladı${ekBilgi ? ' — Süre: ' + ekBilgi + ' dk' : ''}`,
      steril:          `QR onayı ile steril teyit edildi`,
      depoda:          `Steril depoya yerleştirildi — Raf: ${s?.raf || '—'}`,
    };
    const durumMap = { kirli_teslim:'Kullanımda', yikamada:'Sterilizasyonda', sterilizasyonda:'Sterilizasyonda', steril:'Steril — Hazır', depoda:'Steril — Hazır' };
    const newLog = [...(st.sterilAkis[setId]?.log || []), { zaman: saat, asama: yeniAsama, aciklama: aciklamalar[yeniAsama], kisi: 'Srl. Kerim Ç.' }];
    const newZamanlar = { ...(st.sterilAkis[setId]?.zamanlar || {}), [yeniAsama]: saat };
    return {
      sterilSetlerV2: st.sterilSetlerV2.map(x => x.id === setId ? { ...x, durum: durumMap[yeniAsama] || x.durum } : x),
      sterilAkis: { ...st.sterilAkis, [setId]: { ...st.sterilAkis[setId], asama: yeniAsama, zamanlar: newZamanlar, log: newLog } },
    };
  }),
  addTekliAlet: (a) => set((st) => ({
    tekliAletler: [...st.tekliAletler, { ...a, id: Math.max(0, ...st.tekliAletler.map(x => x.id)) + 1 }],
  })),
  updateTekliAlet: (id, data) => set((st) => ({
    tekliAletler: st.tekliAletler.map(a => a.id === id ? { ...a, ...data } : a),
  })),
  deleteTekliAlet: (id) => set((st) => ({
    tekliAletler: st.tekliAletler.filter(a => a.id !== id),
  })),
  addSterilPersonel: (p) => set((st) => ({
    sterilPersonel: [...st.sterilPersonel, { ...p, id: Math.max(0, ...st.sterilPersonel.map(x => x.id)) + 1, durum: 'Aktif' }],
  })),
  updateSterilPersonel: (id, data) => set((st) => ({
    sterilPersonel: st.sterilPersonel.map(p => p.id === id ? { ...p, ...data } : p),
  })),
  deleteSterilPersonel: (id) => set((st) => ({
    sterilPersonel: st.sterilPersonel.filter(p => p.id !== id),
  })),


  // API'den veri yükle — mock'un üzerine yazar
  loadSurgeries: (data) => set({ surgeries: data }),
  loadRooms:     (data) => set({ rooms: data }),
  loadPersonel:  (data) => set({ personel: data }),
  loadHastalar:  (data) => set({ hastalar: data }),
  loadSteril:    (data) => set({ sterilSetler: data }),
  loadKurumlar:  (data) => set({ kurumlar: data }),
  loadKurumGruplari: (data) => set({ kurumGruplari: data }),
  loadCihazlar:     (data) => set({ cihazlar: data }),
  loadBakimPlanlari:(data) => set({ bakimPlanlari: data }),
  loadArizalar:     (data) => set({ arizalar: data }),
  loadFaturalar:    (data) => set({ faturalar: data }),
  loadGelirGider:   (data) => set({ gelirGider: data }),
  loadBildirimler:  (data) => set({ bildirimler: data }),

  // Bildirimler
  addBildirim: (b) => set((st) => ({
    bildirimler: [{ ...b, id: Date.now(), okundu: false }, ...st.bildirimler],
  })),
  markAllRead: () => set((st) => ({
    bildirimler: st.bildirimler.map((b) => ({ ...b, okundu: true })),
  })),
  markRead: (id) => set((st) => ({
    bildirimler: st.bildirimler.map((b) => b.id === id ? { ...b, okundu: true } : b),
  })),

  // ── Super Admin: Kurumlar ──────────────────────────────────
  addKurum: (k) => set((st) => ({
    kurumlar: [{ ...k, id: 'K' + String(Date.now()).slice(-6) }, ...st.kurumlar],
  })),
  updateKurum: (id, data) => set((st) => ({
    kurumlar: st.kurumlar.map((k) => k.id === id ? { ...k, ...data } : k),
  })),
  setKurumGrubu: (kurumId, grupId) => set((st) => {
    const kurumlar = st.kurumlar;
    const hesaplaGelir = (idler) => idler.reduce((t, id) => t + (kurumlar.find(k => k.id === id)?.aylikUcret || 0), 0);
    const gruplar = st.kurumGruplari.map((g) => {
      const icinde = g.kurumIdler.includes(kurumId);
      if (g.id === grupId) {
        const yeniIdler = icinde ? g.kurumIdler : [...g.kurumIdler, kurumId];
        return { ...g, kurumIdler: yeniIdler, toplamGelir: hesaplaGelir(yeniIdler) };
      }
      if (icinde) {
        const kalanIdler = g.kurumIdler.filter((id) => id !== kurumId);
        return { ...g, kurumIdler: kalanIdler, toplamGelir: hesaplaGelir(kalanIdler) };
      }
      return g;
    });
    return { kurumGruplari: gruplar };
  }),
  kurumuGruptanCikar: (kurumId, grupId) => set((st) => {
    const kurumlar = st.kurumlar;
    const hesaplaGelir = (idler) => idler.reduce((t, id) => t + (kurumlar.find(k => k.id === id)?.aylikUcret || 0), 0);
    return {
      kurumGruplari: st.kurumGruplari.map((g) => {
        if (g.id !== grupId) return g;
        const kalanIdler = g.kurumIdler.filter((id) => id !== kurumId);
        return { ...g, kurumIdler: kalanIdler, toplamGelir: hesaplaGelir(kalanIdler) };
      }),
    };
  }),
}));

// ── UI STORE ──────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  toastMsg:        '',
  toastVisible:    false,
  sidebarCollapsed:false,
  aiPanelOpen:     false,
  activeModal:     null,
  bekleyenSayisi:  0,

  showToast: (msg) => {
    set({ toastMsg: msg, toastVisible: true });
    setTimeout(() => set({ toastVisible: false }), 2500);
  },

  toggleSidebar:  () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setAIPanel:     (v) => set({ aiPanelOpen: v }),
  openModal:      (id) => set({ activeModal: id }),
  closeModal:     () => set({ activeModal: null }),
  setBekleyenSayisi: (n) => set({ bekleyenSayisi: n }),
}));

// ── THEME STORE ───────────────────────────────────────────────
export const useThemeStore = create(persist(
  (set) => ({
    theme: 'light',
    setTheme: (t) => {
      set({ theme: t });
      document.documentElement.setAttribute('data-theme', t);
    },
  }),
  { name: 'operio-theme' }
));
