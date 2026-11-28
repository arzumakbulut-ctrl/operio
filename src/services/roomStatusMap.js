// ──────────────────────────────────────────────────────────────
// Salon (Room) durum enum eşlemesi — backend #1 roomStatusSchema
// ('ACTIVE'|'IDLE'|'RESERVED'|'MAINTENANCE'|'CLOSED') <-> UI durum key
// ('active'|'idle'|'reserved'|'maintenance'|'closed').
//
// Final review Finding 2: SalonYonetim.jsx (Task 6) bu tabloyu kendi
// içinde tanımlıyordu; App.jsx'in global useApiLoader'ı ise hiç kullanmıyor,
// mapRoom() ölü bir Türkçe literal ("Bos") varsayıyordu. Aynı eşlemenin iki
// farklı dosyada ayrı ayrı tutulup birbirinden kopması riskini önlemek için
// TEK paylaşılan kaynağa taşındı — SalonYonetim.jsx ve App.jsx AYNI tabloyu
// import eder.
// ──────────────────────────────────────────────────────────────

export const DB_TO_UI = { 'IDLE':'idle', 'ACTIVE':'active', 'RESERVED':'reserved', 'MAINTENANCE':'maintenance', 'CLOSED':'closed' };
export const UI_TO_DB = { idle:'IDLE', active:'ACTIVE', reserved:'RESERVED', maintenance:'MAINTENANCE', closed:'CLOSED' };
