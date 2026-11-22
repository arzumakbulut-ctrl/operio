const { Server } = require('socket.io');
const { verifyAccessToken } = require('./utils/jwt');
const db = require('./utils/db');

// ── EVENT TANIMLARI ──────────────────────────────────────────
// Tüm eventler tek yerden yönetilir — hem server hem client bu sabitleri kullanır
const EVENTS = {
  // Server → Client
  SURGERY_UPDATED:    'surgery:updated',
  SURGERY_CREATED:    'surgery:created',
  SURGERY_DELETED:    'surgery:deleted',
  ROOM_STATUS_CHANGED:'room:status_changed',
  SET_STATUS_CHANGED: 'set:status_changed',
  DEVICE_STATUS_CHANGED: 'device:status_changed',
  NOTIFICATION:       'notification:new',
  USER_JOINED:        'user:joined',
  USER_LEFT:          'user:left',
  SYSTEM_ALERT:       'system:alert',

  // Client → Server
  JOIN_ROOM:          'join:room',
  PING:               'ping',
};

// Bağlı socket'ları tutan map: socketId → { userId, institutionId, roleId }
const connectedUsers = new Map();

/**
 * Socket.io sunucusunu başlat ve Express http server'ına bağla.
 * @param {http.Server} httpServer
 * @returns {Server} io
 */
function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:      (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
      credentials: true,
      methods:     ['GET', 'POST'],
    },
    // Bağlantı güvenilirliği
    pingTimeout:  20000,
    pingInterval: 25000,
    // Büyük payload'lara karşı limit
    maxHttpBufferSize: 1e5, // 100KB
  });

  // ── JWT MİDDLEWARE ─────────────────────────────────────────
  // Her bağlantı kurulmadan önce token doğrulanır
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Kimlik doğrulama gerekli'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.user = payload; // { sub, email, roleId, institutionId }
      next();
    } catch (err) {
      return next(new Error('Geçersiz veya süresi dolmuş token'));
    }
  });

  // ── BAĞLANTI YÖNETİMİ ──────────────────────────────────────
  io.on('connection', (socket) => {
    const { sub: userId, email, roleId, institutionId } = socket.user;

    // Kuruma özel room'a katıl
    // Her kurum kendi room'unda — farklı kurumların olayları karışmaz
    const institutionRoom = `institution:${institutionId}`;
    const userRoom        = `user:${userId}`;

    socket.join(institutionRoom);
    socket.join(userRoom);

    // Bağlı kullanıcıyı kaydet
    connectedUsers.set(socket.id, { userId, email, roleId, institutionId });

    console.log(`[WS] Bağlandı: ${email} (role=${roleId}) | room=${institutionRoom}`);

    // Kurumun diğer üyelerine bildir
    socket.to(institutionRoom).emit(EVENTS.USER_JOINED, {
      userId, email, roleId,
      timestamp: new Date().toISOString(),
    });

    // ── CLIENT EVENT'LERİ ───────────────────────────────────
    socket.on(EVENTS.PING, (cb) => {
      if (typeof cb === 'function') cb({ pong: true, timestamp: Date.now() });
    });

    // ── BAĞLANTI KESİLME ────────────────────────────────────
    socket.on('disconnect', (reason) => {
      connectedUsers.delete(socket.id);
      console.log(`[WS] Ayrıldı: ${email} | ${reason}`);

      socket.to(institutionRoom).emit(EVENTS.USER_LEFT, {
        userId, email,
        timestamp: new Date().toISOString(),
      });
    });

    // Hata yakalama
    socket.on('error', (err) => {
      console.error(`[WS] Socket hatası (${email}):`, err.message);
    });
  });

  console.log('✅ Socket.io sunucusu başlatıldı');
  return io;
}

// ── EMIT YARDIMCILARI ─────────────────────────────────────────
// Servisler bu fonksiyonları çağırarak ilgili room'a event yollar

let _io = null;

function setIO(io) { _io = io; }
function getIO()   { return _io; }

/**
 * Bir kurumun tüm bağlı kullanıcılarına event yolla
 */
function emitToInstitution(institutionId, event, data) {
  if (!_io) return;
  _io.to(`institution:${institutionId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Belirli bir kullanıcıya event yolla
 */
function emitToUser(userId, event, data) {
  if (!_io) return;
  _io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Kuruma push notification gönder ve DB'ye kaydet
 */
async function pushNotification({ institutionId, targetUserId = null, type, title, message, data = {} }) {
  // DB'ye kaydet
  try {
    await db.query(
      `INSERT INTO notifications (target_user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [targetUserId, type, title, message]
    );
  } catch (err) {
    console.error('[WS] Bildirim DB hatası:', err.message);
  }

  const payload = { type, title, message, data };

  // Belirli kullanıcıya mı yoksa tüm kuruma mı?
  if (targetUserId) {
    emitToUser(targetUserId, EVENTS.NOTIFICATION, payload);
  } else {
    emitToInstitution(institutionId, EVENTS.NOTIFICATION, payload);
  }
}

/**
 * Kaç kullanıcı bağlı?
 */
function getConnectedCount(institutionId) {
  let count = 0;
  for (const [, user] of connectedUsers) {
    if (user.institutionId === institutionId) count++;
  }
  return count;
}

/**
 * Bağlı kullanıcı listesi
 */
function getConnectedUsers(institutionId) {
  const users = [];
  for (const [socketId, user] of connectedUsers) {
    if (user.institutionId === institutionId) {
      users.push({ socketId, ...user });
    }
  }
  return users;
}

module.exports = {
  EVENTS,
  initSocketServer,
  setIO,
  getIO,
  emitToInstitution,
  emitToUser,
  pushNotification,
  getConnectedCount,
  getConnectedUsers,
};
