// ──────────────────────────────────────────────────────────────
// Cihaz grupları — tek doğruluk kaynağı.
//
// `value` alanları backend'in `controllable_devices.device_group` sütunuyla
// VE operio-backend/src/validators/schemas.js'teki deviceCreateSchema enum'ıyla
// birebir aynı olmak zorunda: 'electrosurgery' | 'endoscopy_imaging' | 'light' | 'table'.
// Önceden CihazKontrol.jsx ve SesliKontrolAyarlari.jsx bunu iki ayrı, birbirinden
// bağımsız (ve kısmen hatalı/uydurma anahtarlı) listeyle tutuyordu — artık ikisi de
// buradan okuyor.
// ──────────────────────────────────────────────────────────────
export const DEVICE_GROUPS = [
  { value: 'electrosurgery',    label: 'Elektrocerrahi',          abbr: 'EC' },
  { value: 'endoscopy_imaging', label: 'Endoskopi / Görüntüleme', abbr: 'EG' },
  { value: 'light',             label: 'Aydınlatma',              abbr: 'IŞ' },
  { value: 'table',             label: 'Ameliyat Masası',         abbr: 'MS' },
];

export function deviceGroupLabel(group) {
  return DEVICE_GROUPS.find(g => g.value === group)?.label || group || 'Genel';
}

// Kart rozeti kısa (1-2 karakter) bir slot için tasarlandı — tam grup adı
// (örn. "Elektrocerrahi") orada taşar/sarılır. Tanımlı olmayan bir grup için
// de kullanıcı arayüzünü bozmayacak güvenli bir varsayılan (ilk 2 harf) üretir.
export function deviceGroupAbbr(group) {
  const found = DEVICE_GROUPS.find(g => g.value === group);
  if (found) return found.abbr;
  if (!group) return '—';
  return group.slice(0, 2).toUpperCase();
}
