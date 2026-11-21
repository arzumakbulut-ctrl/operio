const jwt = require('jsonwebtoken');
const db = require('../utils/db');

/**
 * Bu servis, bir klinisyenin KENDİ Spotify hesabını Profil sayfasından
 * bağlamasını sağlar (kişisel JWT ile korunur — kiosk token sistemiyle
 * ilgisi yoktur). user_spotify_connections.user_id UNIQUE'tir (bkz.
 * migrations/001_init.sql) — kullanıcı başına tek bağlantı.
 */

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';
const SPOTIFY_ME_URL        = 'https://api.spotify.com/v1/me';
const SPOTIFY_SEARCH_URL    = 'https://api.spotify.com/v1/search';

// Sonraki görevlerin (çalma/duraklatma) ihtiyaç duyacağı iki izin.
const SCOPE = 'user-read-playback-state user-modify-playback-state';

// state parametresini imzalamak için JWT_ACCESS_SECRET'tan FARKLI, ayrı bir
// anahtar — amaç ve ömür farklı (sadece OAuth redirect round-trip'i kadar
// yaşar), bu yüzden signAccessToken ile değil burada doğrudan jsonwebtoken
// ile basit bir imzalayıcı kullanılır (jwt.js'teki desenin küçük bir kopyası).
const STATE_SECRET      = process.env.SPOTIFY_STATE_SECRET || 'operio-spotify-state-secret';
const STATE_EXPIRES_IN  = '10m';

// Access token'ı tam sona ermeden biraz önce yenile (saat farkı/ağ gecikmesi
// tamponu) — sınırda bir isteğin "geçerli" sanıp 401 ile geri dönmesini önler.
const REFRESH_BUFFER_MS = 60 * 1000;

/**
 * signState — state parametresi için kısa ömürlü (10dk) bir JWT üretir.
 * Payload sadece { userId } — callback round-trip'i dışında hiçbir değeri yok.
 */
function signState(userId) {
  return jwt.sign({ userId }, STATE_SECRET, { expiresIn: STATE_EXPIRES_IN });
}

/**
 * verifyState — callback route'un state'ten userId'yi güvenle geri almasını
 * sağlar. Geçersiz/süresi dolmuş/değiştirilmiş token'da jwt.verify fırlatır;
 * çağıran (route) bunu yakalayıp ?spotify=error redirect'ine çevirir.
 * @returns {{ userId: string }}
 */
function verifyState(state) {
  return jwt.verify(state, STATE_SECRET);
}

/**
 * getAuthorizeUrl — kullanıcıyı Spotify'ın yetkilendirme sayfasına
 * yönlendirecek tam URL'i üretir. Saf (pure) fonksiyon — ağ çağrısı yapmaz.
 * @param {string} userId
 * @returns {string}
 */
function getAuthorizeUrl(userId) {
  const state = signState(userId);
  const params = new URLSearchParams({
    client_id:     process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri:  process.env.SPOTIFY_REDIRECT_URI,
    scope:         SCOPE,
    state,
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * basicAuthHeader — Spotify'ın /api/token endpoint'i client_id:client_secret'ı
 * Base64 Basic Auth olarak ister (Authorization Code ve Refresh Token akışlarının
 * her ikisinde de aynı — tek bir yardımcıya çıkarıldı).
 */
function basicAuthHeader() {
  const raw = `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/**
 * exchangeCodeForToken — callback'ten gelen authorization code'u Spotify'ın
 * /api/token endpoint'inde access/refresh token'a çevirir, ardından /v1/me
 * ile spotify kullanıcı id'sini alır (saveConnection bunu bekler). Gerçek
 * Spotify API çağrısı — global fetch kullanır (Node >=18, bkz. package.json
 * engines).
 * @param {string} code
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number, spotifyUserId: string }>}
 */
async function exchangeCodeForToken(code) {
  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:  basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Spotify token exchange başarısız: HTTP ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();

  const meRes = await fetch(SPOTIFY_ME_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) {
    throw new Error(`Spotify profil bilgisi alınamadı: HTTP ${meRes.status}`);
  }
  const me = await meRes.json();

  return {
    accessToken:   tokenData.access_token,
    refreshToken:  tokenData.refresh_token,
    expiresIn:     tokenData.expires_in,
    spotifyUserId: me.id,
  };
}

/**
 * saveConnection — kullanıcının Spotify bağlantısını kaydeder (ilk bağlantıda
 * INSERT, yeniden bağlanıldığında upsert — user_id UNIQUE kısıtlamasıyla
 * kullanıcı başına tek bağlantı garanti edilir).
 * @param {string} userId
 * @param {{ accessToken: string, refreshToken: string, expiresIn: number, spotifyUserId: string }} tokenData
 */
async function saveConnection(userId, tokenData) {
  const expiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);
  await db.query(
    `INSERT INTO user_spotify_connections (user_id, spotify_user_id, access_token, refresh_token, expires_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE
       SET spotify_user_id = $2, access_token = $3, refresh_token = $4, expires_at = $5`,
    [userId, tokenData.spotifyUserId, tokenData.accessToken, tokenData.refreshToken, expiresAt]
  );
}

/**
 * getConnection — kullanıcının Spotify bağlantı kaydını getirir, yoksa null.
 * @param {string} userId
 * @returns {Promise<{ spotifyUserId, accessToken, refreshToken, expiresAt, connectedAt } | null>}
 */
async function getConnection(userId) {
  const { rows } = await db.query(
    `SELECT spotify_user_id, access_token, refresh_token, expires_at, connected_at
     FROM user_spotify_connections WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    spotifyUserId: row.spotify_user_id,
    accessToken:   row.access_token,
    refreshToken:  row.refresh_token,
    expiresAt:     row.expires_at,
    connectedAt:   row.connected_at,
  };
}

/**
 * refreshAccessTokenIfNeeded — bağlantının access token'ı süresi dolmak
 * üzereyse (REFRESH_BUFFER_MS tamponuyla) Spotify'dan yeni bir access token
 * alır ve DB'yi günceller; süresi dolmamışsa mevcut access token'ı döner ve
 * HİÇBİR ağ çağrısı yapmaz (gereksiz Spotify API çağrısı/rate-limit riskini
 * önler — bkz. tests/unit/spotify.service.test.js'teki "fetch çağrılmadı"
 * testi).
 * @param {string} userId
 * @returns {Promise<string>} accessToken
 */
async function refreshAccessTokenIfNeeded(userId) {
  const connection = await getConnection(userId);
  if (!connection) {
    throw Object.assign(new Error('Spotify bağlantısı bulunamadı'), { statusCode: 404 });
  }

  const expiresAtMs = new Date(connection.expiresAt).getTime();
  if (expiresAtMs - REFRESH_BUFFER_MS > Date.now()) {
    return connection.accessToken;
  }

  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:  basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Spotify token yenileme başarısız: HTTP ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();

  const newAccessToken  = tokenData.access_token;
  // Spotify refresh akışında yeni bir refresh_token döndürmeyebilir — bu
  // durumda mevcut refresh_token korunur (Spotify dokümantasyonundaki beklenen
  // davranış).
  const newRefreshToken = tokenData.refresh_token || connection.refreshToken;
  const newExpiresAt    = new Date(Date.now() + tokenData.expires_in * 1000);

  await db.query(
    `UPDATE user_spotify_connections
     SET access_token = $1, refresh_token = $2, expires_at = $3
     WHERE user_id = $4`,
    [newAccessToken, newRefreshToken, newExpiresAt, userId]
  );

  return newAccessToken;
}

/**
 * searchTrackOrPlaylist — kiosk'un SPOTIFY_PLAY dalı (kiosk.routes.js) için
 * verilen sorguyu Spotify'da arar. GERÇEK bir Spotify Web API çağrısıdır —
 * ama SADECE arama/resolve içindir. TASARIM KARARI (plandan): gerçek play/
 * transfer-playback endpoint'i bu fazda HİÇ çağrılmaz; burada bulunan
 * {name, uri} sonucu çağıran tarafça (kiosk.routes.js) doğrudan mock
 * sürücüye (MockSpotifyPlaybackDriver) geçirilir, gerçek çalma asla
 * tetiklenmez.
 *
 * type=track,playlist&limit=1 ile AYNI çağrıda hem track hem playlist sonucu
 * istenir (en fazla birer adet). İkisi de doluysa TRACK ÖNCELİKLİDİR — sesli
 * komutun tipik kullanımı "X şarkısını çalsın" gibi tek bir parça istemektir;
 * kullanıcı bir liste istediğinde ("X listesini çalsın") zaten tracks tarafı
 * genelde boş döner, bu da playlist'in doğal olarak seçilmesini sağlar.
 *
 * @param {string} accessToken
 * @param {string} query
 * @returns {Promise<{ name: string, uri: string } | null>}
 */
async function searchTrackOrPlaylist(accessToken, query) {
  const url = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(query)}&type=track,playlist&limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify arama başarısız: HTTP ${res.status}`);
  }
  const data = await res.json();

  const track = data.tracks && data.tracks.items && data.tracks.items[0];
  if (track) {
    return { name: track.name, uri: track.uri };
  }

  const playlist = data.playlists && data.playlists.items && data.playlists.items[0];
  if (playlist) {
    return { name: playlist.name, uri: playlist.uri };
  }

  return null;
}

/**
 * disconnect — kullanıcının Spotify bağlantısını kaldırır.
 * @param {string} userId
 */
async function disconnect(userId) {
  await db.query('DELETE FROM user_spotify_connections WHERE user_id = $1', [userId]);
}

module.exports = {
  getAuthorizeUrl,
  verifyState,
  exchangeCodeForToken,
  saveConnection,
  getConnection,
  refreshAccessTokenIfNeeded,
  searchTrackOrPlaylist,
  disconnect,
};
