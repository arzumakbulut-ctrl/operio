// ──────────────────────────────────────────────────────────────
// Ameliyat (Surgery) Adapter
// Backend (İngilizce snake_case + {success,data,meta} zarfı) ile
// UI'ın beklediği Türkçe anahtarlı şekil arasında çeviri yapar.
// ──────────────────────────────────────────────────────────────

const BASE = 'http://localhost:4000/api';

const STATUS_TO_TR = {
  WAITING:     'Bekliyor',
  PREPARING:   'Bekliyor',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED:   'Tamamlandi',
  CANCELLED:   'Bekliyor',
  POSTPONED:   'Bekliyor',
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
  const result = await apiCall('GET', '/surgeries');
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
