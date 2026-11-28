/**
 * Backend Test Setup
 * Her test dosyasından önce çalışır.
 * Gerçek DB yerine mock kullanır — testler izole, hızlı ve tekrarlanabilir.
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ── ORTAM DEĞİŞKENLERİ ───────────────────────────────────────
process.env.NODE_ENV          = 'test';
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-minimum-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars-long!';
process.env.PLATFORM_ADMIN_ACCESS_SECRET  = 'test-pa-access-secret-minimum-32-chars-long!!';
process.env.PLATFORM_ADMIN_REFRESH_SECRET = 'test-pa-refresh-secret-minimum-32-chars-long!';
process.env.DATABASE_URL       = 'postgresql://test:test@localhost/test_db';
process.env.ANTHROPIC_API_KEY  = 'test-key';
process.env.IYZICO_API_KEY     = 'test-iyzico';
process.env.IYZICO_SECRET_KEY  = 'test-iyzico-secret';
process.env.STRIPE_SECRET_KEY  = 'sk_test_placeholder';

// ── DB MOCK ───────────────────────────────────────────────────
// Gerçek PostgreSQL bağlantısı yerine mock kullanır
const mockQueryFn = vi.fn();
const mockTransactionFn = vi.fn();

vi.mock('../src/utils/db', () => ({
  default: {
    query:       mockQueryFn,
    transaction: mockTransactionFn,
    connect:     vi.fn().mockResolvedValue(true),
    disconnect:  vi.fn().mockResolvedValue(true),
    pool:        { end: vi.fn() },
  },
  query:       mockQueryFn,
  transaction: mockTransactionFn,
  connect:     vi.fn().mockResolvedValue(true),
  disconnect:  vi.fn().mockResolvedValue(true),
}));

// ── SOCKET MOCK ───────────────────────────────────────────────
vi.mock('../src/socket', () => ({
  EVENTS:              {},
  emitToInstitution:   vi.fn(),
  emitToUser:          vi.fn(),
  pushNotification:    vi.fn().mockResolvedValue(undefined),
  getConnectedUsers:   vi.fn().mockReturnValue([]),
  getConnectedCount:   vi.fn().mockReturnValue(0),
  setIO:               vi.fn(),
  getIO:               vi.fn(),
}));

// ── AUDIT MOCK ────────────────────────────────────────────────
vi.mock('../src/utils/audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ── SECURITY LOGGER MOCK ──────────────────────────────────────
vi.mock('../src/utils/securityLogger', () => ({
  logSecurityEvent:       vi.fn().mockResolvedValue(undefined),
  getFailedLoginsFromIP:  vi.fn().mockResolvedValue(0),
  getSecuritySummary:     vi.fn().mockResolvedValue([]),
}));

// ── GLOBAL YARDIMCILAR ────────────────────────────────────────

/**
 * Mock DB sorgusu ayarla
 * @param {object|object[]} rows — sorgu sonucu
 */
global.mockDBQuery = (rows) => {
  const result = Array.isArray(rows) ? rows : [rows];
  mockQueryFn.mockResolvedValueOnce({ rows: result, rowCount: result.length });
};

/**
 * Birden fazla ardışık sorgu için
 */
global.mockDBQueries = (...rowSets) => {
  rowSets.forEach(rows => {
    const result = Array.isArray(rows) ? rows : [rows];
    mockQueryFn.mockResolvedValueOnce({ rows: result, rowCount: result.length });
  });
};

/**
 * DB hatasını simüle et
 */
global.mockDBError = (message = 'DB Error') => {
  mockQueryFn.mockRejectedValueOnce(new Error(message));
};

/**
 * Transaction mock
 */
global.mockTransaction = (fn) => {
  mockTransactionFn.mockImplementationOnce(fn);
};

/**
 * Geçerli JWT token üret (test için)
 */
global.makeToken = (payload = {}) => {
  const { signAccessToken } = require('../src/utils/jwt');
  return signAccessToken({
    sub:           payload.sub          || 'test-user-uuid',
    email:         payload.email        || 'test@test.com',
    roleId:        payload.roleId       ?? 0,
    institutionId: payload.institutionId || 'test-institution-uuid',
    ...payload,
  });
};

// ── TEMIZLIK ──────────────────────────────────────────────────
beforeEach(() => {
  // Registry'yi sıfırla — her test temiz başlar
  try {
    const { reset } = require('../src/services/_registry');
    reset();
  } catch {}
});

afterEach(() => {
  vi.clearAllMocks();
});
