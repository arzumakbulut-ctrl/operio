// ──────────────────────────────────────────────────────────────
// Steril Set (Sterile Set) Adapter
// Backend (İngilizce snake_case + {success,data,meta} zarfı) ile
// UI'ın beklediği Türkçe anahtarlı şekil arasında çeviri yapar.
// NOT: Backend'de DELETE rotası yoktur; bu yüzden silme fonksiyonu
// kasıtlı olarak eklenmemiştir.
// ──────────────────────────────────────────────────────────────

const BASE = 'http://localhost:4000/api';

const STATUS_TO_TR = {
  STERILE:      'Steril — Hazır',
  IN_USE:       'Kullanımda',
  STERILIZING:  'Sterilizasyonda',
  FAULTY:       'Arızalı',
  RETIRED:      'Arızalı',
};

// Yazma (create/update) yönünde kullanılan ters harita: UI etiketi → backend enum.
// STATUS_TO_TR tam tersine çevrilemez çünkü FAULTY ve RETIRED aynı TR etikete
// ('Arızalı') eşleniyor — geri dönüşte FAULTY varsayılan olarak seçildi (daha
// yaygın/tahmin edilebilir durum). 'Eksik Parça' backend'de hiç karşılığı
// olmayan bir UI-only etiket; eksik parça da pratikte "arızalı set" sayıldığı
// için FAULTY'e eşlendi.
export const TR_TO_STATUS = {
  'Steril — Hazır':  'STERILE',
  'Kullanımda':      'IN_USE',
  'Sterilizasyonda': 'STERILIZING',
  'Eksik Parça':     'FAULTY',
  'Arızalı':         'FAULTY',
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization:  'Bearer ' + localStorage.getItem('operio_access'),
  };
}

function mapSet(s) {
  return {
    id:      s.id,
    name:    s.name,
    doktor:  s.code || 'Genel Kullanım',
    raf:     s.shelf_location || '—',
    durum:   STATUS_TO_TR[s.status] || 'Steril — Hazır',
    aletler: (s.instruments || []).map(i => ({ ad: i.name, adet: i.expected_count })),
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
    console.error('[sterileSetsAdapter]', method, path, 'network/parse error', err);
    return null;
  }
  if (!res.ok || !json?.success) {
    console.error('[sterileSetsAdapter]', method, path, res.status, json?.error);
    return null;
  }
  return json;
}

export async function listSterileSets() {
  const result = await apiCall('GET', '/sterile-sets');
  if (!Array.isArray(result?.data)) return [];
  return result.data.map(mapSet);
}

export async function createSterileSet(input) {
  const result = await apiCall('POST', '/sterile-sets', input);
  return result?.data ? mapSet(result.data) : null;
}

export async function updateSterileSet(id, patch) {
  const result = await apiCall('PATCH', '/sterile-sets/' + id, patch);
  return result?.data ? mapSet(result.data) : null;
}
