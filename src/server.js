require('dotenv').config();
const http = require('http');
const app  = require('./app');
const db   = require('./utils/db');
const { initSocketServer, setIO } = require('./socket');

const PORT = process.env.PORT || 4000;

async function main() {
  // Veritabanı bağlantısı
  try {
    await db.connect();
    console.log('✅ PostgreSQL bağlantısı başarılı');
  } catch (err) {
    console.error('❌ Veritabanı bağlantısı başarısız:', err.message);
    process.exit(1);
  }

  // HTTP server oluştur (Socket.io için Express yerine http.Server gerekli)
  const httpServer = http.createServer(app);

  // Socket.io'yu başlat
  const io = initSocketServer(httpServer);
  setIO(io);

  // Uygulama modüllerine io'yu geç
  app.set('io', io);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Operio API     → http://localhost:${PORT}`);
    console.log(`🔌 WebSocket      → ws://localhost:${PORT}`);
    console.log(`📋 Sağlık kontrolü → http://localhost:${PORT}/health`);
    console.log(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
  });

  // Temiz kapatma
  async function shutdown(signal) {
    console.log(`\n${signal} — kapatılıyor…`);
    httpServer.close(async () => {
      await db.disconnect();
      console.log('✅ Kapatıldı');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main();
