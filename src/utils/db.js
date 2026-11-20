const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool hatası:', err.message);
});

/**
 * Tek sorgu çalıştır
 * @param {string} text  — SQL sorgusu ($1, $2 parametreleri)
 * @param {any[]}  params — Parametreler
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] ${Date.now() - start}ms — ${text.slice(0, 80)}`);
  }
  return res;
}

/**
 * Transaction çalıştır
 * @param {Function} fn — async (client) => { ... }
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function connect() { await pool.query('SELECT 1'); }
async function disconnect() { await pool.end(); }

module.exports = { query, transaction, connect, disconnect, pool };
