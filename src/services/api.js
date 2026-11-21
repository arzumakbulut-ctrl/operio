// ──────────────────────────────────────────────────────────────
// Operio API İstemcisi
// Zustand store'unu doğrudan import edebilmek için
// sınıf yerine fonksiyon bazlı yaklaşım kullanıldı.
// ──────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Token'ları bellek + localStorage'da tut
let _accessToken  = localStorage.getItem('operio_access')  || null;
let _refreshToken = localStorage.getItem('operio_refresh') || null;

function saveTokens(access, refresh) {
  _accessToken  = access;
  _refreshToken = refresh;
  if (access)  localStorage.setItem('operio_access',  access);
  if (refresh) localStorage.setItem('operio_refresh', refresh);
}

function clearTokens() {
  _accessToken = _refreshToken = null;
  localStorage.removeItem('operio_access');
  localStorage.removeItem('operio_refresh');
}

function getAccessToken()  { return _accessToken;  }
function getRefreshToken() { return _refreshToken; }

// ── TEMEL İSTEK FONKSİYONU ─────────────────────────────────
let _isRefreshing  = false;
let _refreshQueue  = [];

async function request(method, path, body = null, retry = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);

  // Access token süresi dolmuşsa → refresh et ve tekrar dene
  if (res.status === 401 && retry && _refreshToken) {
    if (_isRefreshing) {
      // Başka bir istek zaten refresh yapıyor — kuyruğa ekle
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject });
      }).then(() => request(method, path, body, false));
    }

    _isRefreshing = true;
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });

      if (!refreshRes.ok) {
        clearTokens();
        _refreshQueue.forEach(p => p.reject(new Error('Oturum sona erdi')));
        _refreshQueue = [];
        // Giriş sayfasına yönlendir — tam sayfa reload yerine
        // App.jsx'in dinlediği custom event ile SPA içi yönlendirme
        window.dispatchEvent(new CustomEvent('operio:auth-expired'));
        return;
      }

      const { data } = await refreshRes.json();
      saveTokens(data.accessToken, data.refreshToken);
      _refreshQueue.forEach(p => p.resolve());
      _refreshQueue = [];
      return request(method, path, body, false);

    } finally {
      _isRefreshing = false;
    }
  }

  // Başarılı yanıt
  if (res.status === 204) return null;

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error?.message || 'API hatası');
    err.code    = data.error?.code;
    err.details = data.error?.details;
    err.status  = res.status;
    throw err;
  }

  return data;
}

// Kısayollar
const get    = (path)        => request('GET',    path);
const post   = (path, body)  => request('POST',   path, body);
const patch  = (path, body)  => request('PATCH',  path, body);
const del    = (path)        => request('DELETE', path);

// ── AUTH ────────────────────────────────────────────────────
export const authAPI = {
  login:   async ({ email, password, roleId }) => {
    const res = await post('/auth/login', { email, password, roleId });
    saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  },
  logout:  async () => {
    await post('/auth/logout', { refreshToken: _refreshToken }).catch(() => {});
    clearTokens();
  },
  me:      () => get('/auth/me').then(r => r.data),
  refresh: () => post('/auth/refresh', { refreshToken: _refreshToken }),
};

// ── AMELİYATLAR ─────────────────────────────────────────────
export const surgeriesAPI = {
  list:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/surgeries${q ? '?' + q : ''}`).then(r => r);
  },
  get:    (id)   => get(`/surgeries/${id}`).then(r => r.data),
  create: (body) => post('/surgeries', body).then(r => r.data),
  update: (id, body) => patch(`/surgeries/${id}`, body).then(r => r.data),
  delete: (id)   => del(`/surgeries/${id}`),
  assignTeam:  (id, body) => post(`/surgeries/${id}/team`, body).then(r => r.data),
  removeTeam:  (id, uid)  => del(`/surgeries/${id}/team/${uid}`),
};

// ── HASTALAR ─────────────────────────────────────────────────
export const patientsAPI = {
  list:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/patients${q ? '?' + q : ''}`).then(r => r);
  },
  get:    (id)   => get(`/patients/${id}`).then(r => r.data),
  create: (body) => post('/patients', body).then(r => r.data),
  update: (id, body) => patch(`/patients/${id}`, body).then(r => r.data),
};

// ── SALONLAR ─────────────────────────────────────────────────
export const roomsAPI = {
  list:         ()          => get('/rooms').then(r => r.data),
  get:          (id)        => get(`/rooms/${id}`).then(r => r.data),
  create:       (body)      => post('/rooms', body).then(r => r.data),
  updateStatus: (id, status)=> patch(`/rooms/${id}/status`, { status }).then(r => r.data),
  delete:       (id)        => del(`/rooms/${id}`),
};

// ── STERİL SETLER ────────────────────────────────────────────
export const sterileSetsAPI = {
  list:        (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/sterile-sets${q ? '?' + q : ''}`).then(r => r);
  },
  get:         (id)   => get(`/sterile-sets/${id}`).then(r => r.data),
  create:      (body) => post('/sterile-sets', body).then(r => r.data),
  update:      (id, body) => patch(`/sterile-sets/${id}`, body).then(r => r.data),
  addTracking: (id, body) => post(`/sterile-sets/${id}/tracking`, body).then(r => r.data),
};

// ── DENETİM GÜNLÜĞÜ ─────────────────────────────────────────
export const auditAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/audit${q ? '?' + q : ''}`).then(r => r);
  },
};

// ── CİHAZLAR (sesli cihaz kontrolü) ─────────────────────────
export const deviceAPI = {
  list:          (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/devices${q ? '?' + q : ''}`).then(r => r.data);
  },
  get:           (id)       => get(`/devices/${id}`).then(r => r.data),
  create:        (body)     => post('/devices', body).then(r => r.data),
  updateConfig:  (id, body) => patch(`/devices/${id}/config`, body).then(r => r.data),
  command:       (id, body) => post(`/devices/${id}/command`, body).then(r => r.data),
  physicalConfirm: (id)     => post(`/devices/${id}/physical-confirm`).then(r => r.data),
};

// ── MODÜLLER (satın alınabilir ek özellikler) ───────────────
export const moduleAPI = {
  list:     ()     => get('/billing/modules').then(r => r.data),
  mine:     ()     => get('/billing/modules/mine').then(r => r.data),
  purchase: (slug) => post(`/billing/modules/${slug}/purchase`).then(r => r.data),
};

// ── TOKEN ERİŞİMİ (store için) ───────────────────────────────
export { getAccessToken, getRefreshToken, saveTokens, clearTokens };
