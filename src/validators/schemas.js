const { z } = require('zod');

// ── AUTH ────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Geçerli bir e-posta girin').max(200, 'E-posta 200 karakterden uzun olamaz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  roleId:   z.number().int().min(0).max(10).optional(),
});

const registerSchema = z.object({
  email:       z.string().email(),
  password:    z.string().min(8, 'Şifre en az 8 karakter olmalı')
                .regex(/[A-Z]/, 'En az bir büyük harf içermeli')
                .regex(/[0-9]/, 'En az bir rakam içermeli'),
  fullName:    z.string().min(3).max(100),
  roleId:      z.number().int().min(0).max(10),
  institutionId: z.string().uuid().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token gerekli'),
});

// ── PLATFORM ADMIN AUTH ─────────────────────────────────────
// Hastane loginSchema'sından BİLEREK ayrı — roleId alanı burada anlamsız
// (platform-admin kimliği groupSlug ile belirlenir, roleId/institutionId YOK).
const platformAdminLoginSchema = z.object({
  email:    z.string().email('Geçerli bir e-posta girin').max(200, 'E-posta 200 karakterden uzun olamaz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
});

// ── AMELIYAT ────────────────────────────────────────────────
const surgeryCreateSchema = z.object({
  roomId:         z.string().uuid().optional().nullable(),
  patientId:      z.string().uuid().optional().nullable(),
  title:          z.string().min(3).max(200),
  branch:         z.string().max(100).optional().nullable(),
  surgeonName:    z.string().max(100).optional().nullable(),
  scheduledStart: z.string().datetime({ message: 'ISO 8601 tarih formatı gerekli' }),
  scheduledEnd:   z.string().datetime().optional().nullable(),
  durationMin:    z.number().int().positive().optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
});

const surgeryUpdateSchema = surgeryCreateSchema.partial().extend({
  status: z.enum(['WAITING','PREPARING','IN_PROGRESS','COMPLETED','CANCELLED','POSTPONED']).optional(),
});

// ── HASTA ────────────────────────────────────────────────────
const patientCreateSchema = z.object({
  tcNo:        z.string().length(11).regex(/^\d+$/, 'TC sadece rakam içermeli').optional().nullable(),
  firstName:   z.string().min(2).max(50),
  lastName:    z.string().min(2).max(50),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender:      z.enum(['E','K']).optional().nullable(),
  bloodType:   z.enum(['A+','A-','B+','B-','AB+','AB-','0+','0-']).optional().nullable(),
  phone:       z.string().max(20).optional().nullable(),
});

// ── STERİL SET ────────────────────────────────────────────────
const sterileSetCreateSchema = z.object({
  code:          z.string().min(2).max(50),
  name:          z.string().min(2).max(200),
  totalCount:    z.number().int().positive().default(1),
  shelfLocation: z.string().max(50).optional().nullable(),
  status:        z.enum(['STERILE','IN_USE','STERILIZING','FAULTY','RETIRED']).default('STERILE'),
  instruments:   z.array(z.object({
    name:          z.string().min(1),
    expectedCount: z.number().int().positive().default(1),
  })).optional(),
});

const sterileSetUpdateSchema = sterileSetCreateSchema.partial();

const setTrackingSchema = z.object({
  stage:    z.enum(['teslim_alindi','yikama','sterilizasyon','steril','depo']),
  operator: z.string().max(100).optional().nullable(),
  notes:    z.string().max(500).optional().nullable(),
  counts: z.array(z.object({
    instrumentId: z.string().uuid(),
    count:        z.number().int().min(0),
  })).optional(),
});

// ── OPERIO VISION (Sterilizasyon Alet Sayımı) ─────────────────
const visionCountSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType:   z.enum(['image/jpeg','image/png']),
});

// ── SALON ────────────────────────────────────────────────────
const roomCreateSchema = z.object({
  name:       z.string().min(2).max(100),
  roomNumber: z.number().int().positive(),
  branch:     z.string().max(100).optional().nullable(),
  capacity:   z.number().int().min(1).max(20).default(6),
  color:      z.string().max(20).optional().nullable(),
});

const roomStatusSchema = z.object({
  status: z.enum(['ACTIVE','IDLE','RESERVED','MAINTENANCE','CLOSED']),
});

// ── KURUM ────────────────────────────────────────────────────
// email BİLEREK zorunlu (orijinal şemada optional/nullable idi): platform-admin'in
// POST /api/platform-admin/institutions ile kurum oluşturduğu akışta bu adres aynı
// zamanda otomatik oluşturulan ilk kullanıcının (role_id=0) login e-postası olur
// (bkz. institution.service.js'in createInstitution'ı) — bu route'tan geçen her
// oluşturma isteği bir bootstrap e-postası gerektirir.
const institutionCreateSchema = z.object({
  name:        z.string().min(3).max(200),
  type:        z.string().max(100).optional(),
  address:     z.string().max(500).optional().nullable(),
  phone:       z.string().max(20).optional().nullable(),
  email:       z.string().email('Geçerli bir e-posta girin').max(200),
  bedCount:    z.number().int().positive().optional().nullable(),
  city:        z.string().max(100).optional().nullable(),
  district:    z.string().max(100).optional().nullable(),
  contactName: z.string().min(2, 'Yetkili adı en az 2 karakter olmalı').max(200),
});

const institutionUpdateSchema = institutionCreateSchema.partial().extend({
  // planSlug institutions tablosunun bir kolonu DEĞİL — bu kurumun en son aboneliğinin
  // (subscriptions.plan_slug) değerini günceller. Finans grubu PATCH /:id'de SADECE
  // bunu gönderebilir (bkz. institution.service.js'in updateInstitution'ı).
  planSlug: z.string().min(1).max(50).optional(),
});

const institutionStatusSchema = z.object({
  isActive: z.boolean(),
});

// ── KURUM GRUBU (Hastane Zinciri) ───────────────────────────
// POST (createGroup) ve PATCH (updateGroup) için AYNI şema — ikisi de service
// katmanında `name`'i doğrudan ve zorunlu alır (bkz. institutionGroup.service.js).
const institutionGroupCreateSchema = z.object({
  name: z.string().min(2, 'Grup adı en az 2 karakter olmalı').max(200),
});

// ── BİLDİRİM ────────────────────────────────────────────────
const notificationCreateSchema = z.object({
  targetRole:   z.number().int().min(0).max(10).optional().nullable(),
  targetUserId: z.string().uuid().optional().nullable(),
  type:         z.enum(['uyari','tamamlandi','katilim','sistem']),
  title:        z.string().min(1).max(200),
  message:      z.string().min(1).max(1000),
});

// ── CİHAZ (Sesli Kontrol) ────────────────────────────────────
const deviceCreateSchema = z.object({
  name:                    z.string().min(1).max(100),
  deviceGroup:             z.enum(['light', 'table', 'electrosurgery', 'endoscopy_imaging']),
  deviceType:              z.string().min(1).max(50),
  roomId:                  z.string().uuid().optional(),
  requiresPhysicalConfirm: z.boolean().optional(),
  // Verilmezse createDevice, yüksek riskli gruplar (electrosurgery/table) için
  // requiredTeamRoles:['cerrah'] varsayılanını uygular (bkz. defaultCapabilitiesFor).
  capabilities:            z.record(z.any()).optional(),
});

// value'nun gerçek şekli action'a bağlı — paylaşılan `action` alanı yüzünden gerçek bir
// discriminated union pratik olmadığından, action bazında manuel doğrulama yapan bir
// superRefine kullanılıyor.
const deviceCommandSchema = z.object({
  action: z.enum(['turn_on', 'turn_off', 'set_power', 'arm_move', 'invoke_action']),
  value:  z.any().optional(),
}).superRefine((data, ctx) => {
  switch (data.action) {
    case 'set_power': {
      const result = z.number().int().min(0).max(100).safeParse(data.value);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: ['value'],
          message: 'set_power için value, 0-100 arası bir tam sayı olmalı',
        });
      }
      break;
    }
    case 'arm_move': {
      if (data.value !== undefined) {
        const result = z.string().max(50).safeParse(data.value);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom, path: ['value'],
            message: 'arm_move için value, en fazla 50 karakterlik bir metin olmalı',
          });
        }
      }
      break;
    }
    case 'invoke_action': {
      const result = z.object({
        name: z.string(),
        args: z.record(z.any()).optional(),
      }).safeParse(data.value);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: ['value'],
          message: 'invoke_action için value, { name, args? } şeklinde olmalı',
        });
      }
      break;
    }
    // turn_on / turn_off: value gönderilse de yok sayılır, ek doğrulama gerekmez.
    default:
      break;
  }
});

const deviceConfigSchema = z.object({
  driverKey: z.string().optional(),
  mode:      z.enum(['SIM', 'REAL']).optional(),
});

// ── KİOSK (Sesli Asistan) ────────────────────────────────────
// 'real' dahil — kiosk_mock_config.mode CHECK kısıtı (migrations/001_init.sql)
// bu 5 değeri kabul eder; final whole-branch review finding #2: 'real' burada
// eksikti, bu yüzden admin PUT /mock-config 'real'i zod'da 400 ile reddediyordu
// (gerçek mod sadece elle SQL ile açılabiliyordu).
const mockConfigSchema = z.object({
  mode: z.enum(['always_match', 'always_reject_team', 'always_unrecognized', 'cycle', 'real']),
});

// confirmationAnswer BİLEREK optional: Task 6 (TIMEOUT/UNKNOWN) bunu kullanmaz, ama
// cihaz-komutu onay akışının (DEVICE_COMMAND'ın ikinci çağrısı) doğal dil evet/hayır
// cevabı bu alanda gelir — şema şimdiden buna izin veriyor ki ileride gevşetme
// ihtiyacı doğmasın.
const kioskVoiceCommandSchema = z.object({
  transcript: z.string(),
  // audio null/eksik olabilir: kiosk istemcisi henüz bir MediaRecorder parçası yokken
  // (mount sonrası ilk ~3sn) ya da mikrofon izni reddedildiğinde audio: null gönderir.
  // TIMEOUT sese hiç ihtiyaç duymaz; konuşmacı-tanıma gereken dallarda null ses
  // kioskSpeakerAuth → SpeakerVerifier'a "örnek yok" olarak geçer (bkz. kioskSpeakerAuth).
  audio: z.string().nullable().optional(),
  confirmationAnswer: z.string().optional(),
});

// ── SAYFALAMA ────────────────────────────────────────────────
const paginationSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q:     z.string().optional(),
});

module.exports = {
  loginSchema,
  registerSchema,
  refreshSchema,
  platformAdminLoginSchema,
  surgeryCreateSchema,
  surgeryUpdateSchema,
  patientCreateSchema,
  sterileSetCreateSchema,
  sterileSetUpdateSchema,
  setTrackingSchema,
  roomCreateSchema,
  roomStatusSchema,
  institutionCreateSchema,
  institutionUpdateSchema,
  institutionStatusSchema,
  institutionGroupCreateSchema,
  notificationCreateSchema,
  paginationSchema,
  deviceCreateSchema,
  deviceCommandSchema,
  deviceConfigSchema,
  mockConfigSchema,
  kioskVoiceCommandSchema,
  visionCountSchema,
};
