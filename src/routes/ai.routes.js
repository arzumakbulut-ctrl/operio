const router      = require('express').Router();
const rateLimit   = require('express-rate-limit');
const { z }       = require('zod');
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const { ok, badRequest, serverError } = require('../utils/response');
const aiService   = require('../services/ai.service');
const surgeryService = require('../services/surgery.service');
const roomService    = require('../services/room.service');
const { audit }      = require('../utils/audit');

// AI endpoint'lerine özel rate limit (LLM maliyetli)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 dakika
  max: 20,               // dakikada 20 mesaj
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Çok fazla AI isteği, lütfen bekleyin' } },
});

// ── STREAM CHAT ────────────────────────────────────────────────
// POST /api/ai/chat
// Body: { messages: [{role, content}][] }
// Response: text/event-stream (SSE)

router.post('/chat',
  authenticate,
  aiLimiter,
  validate(z.object({
    messages: z.array(z.object({
      role:    z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000),
    })).min(1).max(50),
  })),
  async (req, res) => {
    // Anthropic API key yoksa anlamlı hata ver
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-...') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'AI servisi yapılandırılmamış. ANTHROPIC_API_KEY ayarlanmamış.',
        },
      });
    }

    // SSE başlıkları
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx buffer'ı kapat
    res.flushHeaders();

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    await aiService.streamChat({
      messages: req.body.messages,
      user:     req.user,

      onToken: (token) => {
        send('token', { token });
      },

      onDone: async (fullText, action) => {
        send('done', { action: action ?? null });
        res.end();

        // Audit log
        await audit({
          userId:   req.user.sub,
          action:   'AI_CHAT',
          resource: 'ai',
          newData: {
            messageCount: req.body.messages.length,
            hasAction: !!action,
            actionType: action?.type ?? null,
          },
        });
      },

      onError: (err) => {
        send('error', {
          message: process.env.NODE_ENV === 'production'
            ? 'AI yanıt oluşturulurken hata oluştu'
            : err.message,
        });
        res.end();
      },
    });
  }
);

// ── ACTION EXECUTOR ────────────────────────────────────────────
// POST /api/ai/action
// AI'nin döndürdüğü action bloğunu gerçek API çağrısına dönüştürür.
// Kullanıcı onayından SONRA çağrılır.

router.post('/action',
  authenticate,
  validate(z.object({
    type:    z.enum(['CREATE_SURGERY', 'UPDATE_SURGERY', 'UPDATE_ROOM_STATUS']),
    payload: z.record(z.unknown()),
  })),
  async (req, res) => {
    const { type, payload } = req.body;
    const { institutionId, sub: userId } = req.user;

    try {
      let result;

      if (type === 'CREATE_SURGERY') {
        // Oda adından ID bul
        let roomId = null;
        if (payload.roomName) {
          const rooms = await require('../utils/db').query(
            `SELECT id FROM operating_rooms WHERE institution_id=$1 AND name ILIKE $2 LIMIT 1`,
            [institutionId, `%${payload.roomName}%`]
          );
          roomId = rooms.rows[0]?.id ?? null;
        }

        result = await surgeryService.createSurgery({
          data: {
            title:          payload.title,
            branch:         payload.branch ?? null,
            surgeonName:    payload.surgeonName ?? null,
            scheduledStart: payload.scheduledStart,
            scheduledEnd:   payload.scheduledEnd ?? null,
            durationMin:    payload.durationMin ? parseInt(payload.durationMin) : null,
            notes:          payload.notes ?? null,
            roomId,
          },
          institutionId,
          userId,
          req,
        });

      } else if (type === 'UPDATE_SURGERY') {
        result = await surgeryService.updateSurgery({
          id:            payload.id,
          data:          payload,
          institutionId,
          userId,
          req,
        });

      } else if (type === 'UPDATE_ROOM_STATUS') {
        // Oda adından ID bul
        let roomId = payload.roomId;
        if (!roomId && payload.roomName) {
          const rooms = await require('../utils/db').query(
            `SELECT id FROM operating_rooms WHERE institution_id=$1 AND name ILIKE $2 LIMIT 1`,
            [institutionId, `%${payload.roomName}%`]
          );
          roomId = rooms.rows[0]?.id;
        }
        if (!roomId) return badRequest(res, 'Salon bulunamadı');

        result = await roomService.updateRoomStatus({
          id: roomId, status: payload.status, institutionId, userId, req,
        });
      }

      return ok(res, { result, type });

    } catch (err) {
      return serverError(res, err);
    }
  }
);

// ── CONTEXT ÖNİZLEME (DEBUG) ─────────────────────────────────
// GET /api/ai/context — AI'nin gördüğü veriyi döndür (sadece admin)
router.get('/context',
  authenticate,
  async (req, res) => {
    if (req.user.roleId !== 0) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }
    try {
      const context = await aiService.buildContext(req.user.institutionId);
      return ok(res, context);
    } catch (err) {
      return serverError(res, err);
    }
  }
);

module.exports = router;
