// ──────────────────────────────────────────────────────────────
// Ameliyat (Surgery) Adapter
// Backend (İngilizce snake_case + {success,data,meta} zarfı) ile
// UI'ın beklediği Türkçe anahtarlı şekil arasında çeviri yapar.
// ──────────────────────────────────────────────────────────────

const BASE = 'http://localhost:4000/api';

const STATUS_TO_TR = {
  WAITING:     'Bekliyor',
  // Final review Finding 1: önceden CANCELLED/PREPARING de 'Bekliyor'a
  // düşüyordu — yazma tarafında (AmeliyatDetay.jsx/OnayBekleyenler.jsx)
  // 'Iptal' yazılan bir ameliyat, okuma tarafında aynı 'Bekliyor' etiketine
  // geri döndüğü için her reload'da iptal/onay durumu kayboluyordu. 'Iptal'
  // ve 'Hazırlanıyor' zaten bu kod tabanında var olan UI etiketleri
  // (AmeliyatDetay.jsx'in durum dropdown'u, EkipPlani.jsx/Ameliyatlar.jsx/
  // Dashboard.jsx'in ST_LBL['dot-prep']) — yeni bir etiket İCAT EDİLMEDİ.
  PREPARING:   'Hazırlanıyor',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED:   'Tamamlandi',
  CANCELLED:   'Iptal',
  // POSTPONED'un ayrı bir UI karşılığı yok — kasıtlı olarak 'Bekliyor'da
  // bırakıldı (bu fix wave'in kapsamı dışında, Finding 1'in notu).
  POSTPONED:   'Bekliyor',
};

// UI'ın Türkçe durum string'i → backend enum'u (STATUS_TO_TR'nin yazma
// yönünde kullanılan tersi). Daha önce AmeliyatDetay.jsx ve
// OnayBekleyenler.jsx bu tabloyu AYRI AYRI kendi dosyalarında tutuyordu —
// biri güncellenip diğeri unutulursa aynı "yazılan durum okunamıyor" hatası
// tekrar oluşurdu. Artık TEK paylaşılan kaynak burada.
export const STATUS_TO_BACKEND = {
  'Bekliyor':      'WAITING',
  'Devam Ediyor':  'IN_PROGRESS',
  'Tamamlandi':    'COMPLETED',
  'Iptal':         'CANCELLED',
};

const STATUS_TO_DOT = {
  IN_PROGRESS: 'dot-active',
  COMPLETED:   'dot-done',
  WAITING:     'dot-wait',
  PREPARING:   'dot-wait',
  CANCELLED:   'dot-wait',
  POSTPONED:   'dot-wait',
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization:  'Bearer ' + localStorage.getItem('operio_access'),
  };
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR');
}

function mapSurgery(s) {
  return {
    id:       s.id,
    saat:     formatTime(s.scheduled_start),
    bitis:    formatTime(s.scheduled_end),
    op:       s.title,
    hasta:    s.patient_name || '',
    dr:       s.surgeon_name || '',
    salon:    s.room_name || '',
    tarih:    formatDate(s.scheduled_start),
    tarihRaw: s.scheduled_start || '',
    st:       STATUS_TO_DOT[s.status] || 'dot-wait',
    brans:    s.branch || '',
    sure:     s.duration_min ? (s.duration_min + ' dk') : '',
    anestezi: '',
    durum:    STATUS_TO_TR[s.status] || 'Bekliyor',
    ekip:     {},
    setler:   [],
    malzeme:  [],
    cihaz:    [],
    ilac:     [],
    tags:     [],
    tlbl:     [],
    hastaDetay: { name: s.patient_name, tc: s.tc_no, bloodType: s.blood_type },
  };
}

// Asla fırlatmaz: hata durumunda loglayıp null döner.
async function apiCall(method, path, body) {
  let res;
  let json;
  try {
    res  = await fetch(BASE + path, {
      method,
      headers: authHeaders(),
      body:    body ? JSON.stringify(body) : undefined,
    });
    json = await res.json();
  } catch (err) {
    console.error('[surgeriesAdapter]', method, path, 'network/parse error', err);
    return null;
  }
  if (!res.ok || !json?.success) {
    console.error('[surgeriesAdapter]', method, path, res.status, json?.error);
    return null;
  }
  return json;
}

export async function listSurgeries() {
  // Finding 3: query param yoksa backend paginationSchema limit'i varsayılan
  // 20'ye düşürüyor (schemas.js:204-208) — 20'den fazla ameliyatı olan bir
  // kurumda liste sessizce kırpılırdı. ?limit=100 şemanın izin verdiği
  // maksimum (tam pagination kapsam dışı, final reviewer'ın onayladığı
  // minimum düzeltme).
  const result = await apiCall('GET', '/surgeries?limit=100');
  if (!Array.isArray(result?.data)) return [];
  return result.data.map(mapSurgery);
}

export async function createSurgery(input) {
  const result = await apiCall('POST', '/surgeries', input);
  return result?.data ? mapSurgery(result.data) : null;
}

export async function updateSurgeryStatus(id, status) {
  const result = await apiCall('PATCH', '/surgeries/' + id, { status });
  return result?.data ? mapSurgery(result.data) : null;
}

export async function assignTeamMember(surgeryId, userId, teamRole) {
  await apiCall('POST', '/surgeries/' + surgeryId + '/team', { userId, teamRole });
}

export async function removeTeamMember(surgeryId, userId) {
  await apiCall('DELETE', '/surgeries/' + surgeryId + '/team/' + userId);
}
