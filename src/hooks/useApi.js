const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() { return localStorage.getItem("operio_access"); }

async function apiFetch(method, path, body = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) { console.warn(`[API] ${method} ${path}`, e.message); throw e; }
}

export const api = {
  ameliyatlar: {
    list:   ()         => apiFetch("GET",    "/ameliyatlar"),
    get:    (id)       => apiFetch("GET",    `/ameliyatlar/${id}`),
    create: (body)     => apiFetch("POST",   "/ameliyatlar", body),
    update: (id, body) => apiFetch("PUT",    `/ameliyatlar/${id}`, body),
    delete: (id)       => apiFetch("DELETE", `/ameliyatlar/${id}`),
  },
  hastalar: {
    list:   ()         => apiFetch("GET",  "/hastalar"),
    get:    (id)       => apiFetch("GET",  `/hastalar/${id}`),
    create: (body)     => apiFetch("POST", "/hastalar", body),
    update: (id, body) => apiFetch("PUT",  `/hastalar/${id}`, body),
  },
  personel: {
    list:   ()         => apiFetch("GET",  "/personel"),
    get:    (id)       => apiFetch("GET",  `/personel/${id}`),
    create: (body)     => apiFetch("POST", "/personel", body),
    update: (id, body) => apiFetch("PUT",  `/personel/${id}`, body),
  },
  rooms: {
    list:   ()         => apiFetch("GET", "/rooms"),
    update: (id, body) => apiFetch("PUT", `/rooms/${id}`, body),
  },
  steril: {
    list:   ()         => apiFetch("GET",  "/steril"),
    create: (body)     => apiFetch("POST", "/steril", body),
    update: (id, body) => apiFetch("PUT",  `/steril/${id}`, body),
  },
  messages: {
    conversations: ()       => apiFetch("GET",  "/messages/conversations"),
    msgs:          (id)     => apiFetch("GET",  `/messages/conversations/${id}/messages`),
    send:          (body)   => apiFetch("POST", "/messages/send", body),
    newConv:       (body)   => apiFetch("POST", "/messages/conversations", body),
  },
  notifications: {
    list:     ()    => apiFetch("GET", "/notifications"),
    markRead: (id)  => apiFetch("PUT", `/notifications/${id}/read`),
  },
  kurumlar: {
    list:    ()         => apiFetch("GET",  "/kurumlar"),
    create:  (body)     => apiFetch("POST", "/kurumlar", body),
    update:  (id, body) => apiFetch("PUT",  `/kurumlar/${id}`, body),
    gruplar: ()         => apiFetch("GET",  "/kurumlar/gruplar"),
    grupEkle:(body)     => apiFetch("POST", "/kurumlar/gruplar", body),
  },
  finans: {
    gelirGider:     ()      => apiFetch("GET", "/finans/gelir-gider"),
    faturalar:      ()      => apiFetch("GET", "/finans/faturalar"),
    faturaGuncelle: (id, b) => apiFetch("PUT", `/finans/faturalar/${id}`, b),
  },
  cihazlar: {
    list:      ()         => apiFetch("GET",  "/cihazlar"),
    create:    (body)     => apiFetch("POST", "/cihazlar", body),
    update:    (id, body) => apiFetch("PUT",  `/cihazlar/${id}`, body),
    bakim:     ()         => apiFetch("GET",  "/cihazlar/bakim"),
    bakimEkle: (body)     => apiFetch("POST", "/cihazlar/bakim", body),
    ariza:     ()         => apiFetch("GET",  "/cihazlar/ariza"),
    arizaEkle: (body)     => apiFetch("POST", "/cihazlar/ariza", body),
  },
  logs: {
    list: (p = {}) => { const q = new URLSearchParams(p).toString(); return apiFetch("GET", `/logs${q ? "?" + q : ""}`); },
  },
};

export default api;