// ──────────────────────────────────────────────────────────────
// Hasta (Patient) Adapter
// Backend (İngilizce snake_case + {success,data,meta} zarfı) ile
// UI'ın beklediği Türkçe anahtarlı şekil arasında çeviri yapar.
// ──────────────────────────────────────────────────────────────

const BASE = 'http://localhost:4000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization:  'Bearer ' + localStorage.getItem('operio_access'),
  };
}

function calcAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  const birthYear = new Date(dateOfBirth).getFullYear();
  if (Number.isNaN(birthYear)) return '';
  return new Date().getFullYear() - birthYear;
}

function mapPatient(p) {
  return {
    id:        p.id,
    ad:        p.first_name || '',
    soyad:     p.last_name || '',
    yas:       calcAge(p.date_of_birth),
    cinsiyet:  p.gender || '',
    tc:        p.tc_no || '',
    tel:       p.phone || '',
    kan:       p.blood_type || '',
    alerjiler: 'Yok',   // backend'de bu alan yok — sabit varsayılan
    tani:      '',
    asaSkor:   '',
    agirlik:   '',
    boy:       '',
    son:       '',
    op:        '',
    notlar:    '',      // backend'de bu alan yok — sabit varsayılan
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
    console.error('[patientsAdapter]', method, path, 'network/parse error', err);
    return null;
  }
  if (!res.ok || !json?.success) {
    console.error('[patientsAdapter]', method, path, res.status, json?.error);
    return null;
  }
  return json;
}

export async function listPatients() {
  // Finding 3: query param yoksa backend paginationSchema limit'i varsayılan
  // 20'ye düşüyor — ?limit=100 şemanın izin verdiği maksimum.
  const result = await apiCall('GET', '/patients?limit=100');
  if (!Array.isArray(result?.data)) return [];
  return result.data.map(mapPatient);
}

export async function getPatient(id) {
  const result = await apiCall('GET', '/patients/' + id);
  return result?.data ? mapPatient(result.data) : null;
}

export async function createPatient(input) {
  const result = await apiCall('POST', '/patients', input);
  return result?.data ? mapPatient(result.data) : null;
}
