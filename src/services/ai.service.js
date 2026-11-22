const Anthropic = require('@anthropic-ai/sdk');
const db = require('../utils/db');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL    = process.env.AI_MODEL      || 'claude-sonnet-4-20250514';
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS) || 1024;

// ── CONTEXT BUILDER ──────────────────────────────────────────
// Kullanıcının kurumuna ait güncel veriyi çekip sistem prompt'una ekler.
// Model "hallüsinasyon" yapmadan gerçek veriye dayalı yanıt üretir.

async function buildContext(institutionId) {
  const today = new Date().toISOString().slice(0, 10);

  const [surgeriesRes, roomsRes, setsRes, usersRes] = await Promise.all([
    db.query(
      `SELECT s.id, s.title, s.branch, s.surgeon_name, s.status,
              s.scheduled_start, s.duration_min, s.notes,
              r.name AS room_name, r.room_number,
              p.first_name || ' ' || p.last_name AS patient_name
       FROM surgeries s
       LEFT JOIN operating_rooms r ON s.room_id = r.id
       LEFT JOIN patients p ON s.patient_id = p.id
       WHERE s.institution_id = $1
         AND s.scheduled_start::date = $2
       ORDER BY s.scheduled_start`,
      [institutionId, today]
    ),
    db.query(
      `SELECT name, room_number, branch, status, capacity
       FROM operating_rooms WHERE institution_id = $1 ORDER BY room_number`,
      [institutionId]
    ),
    db.query(
      `SELECT code, name, status, sterile_count, in_use_count, shelf_location
       FROM sterile_sets ORDER BY name`,
      []
    ),
    db.query(
      `SELECT full_name, role_id FROM users
       WHERE institution_id = $1 AND is_active = TRUE LIMIT 30`,
      [institutionId]
    ),
  ]);

  return {
    today,
    surgeries: surgeriesRes.rows,
    rooms:     roomsRes.rows,
    sets:      setsRes.rows,
    users:     usersRes.rows,
  };
}

// ── SİSTEM PROMPT ────────────────────────────────────────────
function buildSystemPrompt(context, user) {
  const { today, surgeries, rooms, sets, users } = context;

  const formatSurgery = s => {
    const time = s.scheduled_start
      ? new Date(s.scheduled_start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      : '?';
    return `  - ${time} | ${s.room_name || '?'} | ${s.title} | ${s.surgeon_name || 'Cerrah atanmadı'} | Hasta: ${s.patient_name || '—'} | Durum: ${s.status}`;
  };

  const formatRoom = r =>
    `  - ${r.name} (${r.branch || 'Genel'}): ${r.status} — Kapasite: ${r.capacity}`;

  const formatSet = s =>
    `  - [${s.code}] ${s.name}: ${s.status} | Steril: ${s.sterile_count} | Kullanımda: ${s.in_use_count} | Raf: ${s.shelf_location || '?'}`;

  return `Sen Operio'nun akıllı ameliyathane asistanısın. Adın "Operia".

## Kimsin
Türkçe konuşan, klinik ortamda çalışan bir AI asistansın. Kısa, net ve pratik yanıtlar verirsin. Gereksiz kelam etmezsin. Tıbbi terminoloji kullanırsın ama gerektiğinde açıklarsın.

## Kullanıcı Bilgisi
- Ad: ${user.fullName || user.full_name}
- Rol: ${user.role_display_name || user.roleId}
- Kurum: ${user.institutionName || 'Merkez Devlet Hastanesi'}

## Bugünün Tarihi
${today}

## BUGÜNKÜ AMELİYAT PROGRAMI (${surgeries.length} ameliyat)
${surgeries.length > 0 ? surgeries.map(formatSurgery).join('\n') : '  Bugün ameliyat programı boş.'}

## SALON DURUMLARI (${rooms.length} salon)
${rooms.map(formatRoom).join('\n')}

## STERİL SET DURUMLARI (${sets.length} set)
${sets.slice(0, 20).map(formatSet).join('\n')}${sets.length > 20 ? `\n  ... ve ${sets.length - 20} set daha` : ''}

## NÖBETTE PERSONEL (${users.length} kişi)
${users.slice(0, 15).map(u => `  - ${u.full_name}`).join('\n')}

## Neler yapabilirsin
1. Yukarıdaki gerçek veriler hakkında soru yanıtla
2. Ameliyat programını özetle, filtrele, karşılaştır
3. Salon doluluk durumunu analiz et
4. Steril set yeterliliğini değerlendir
5. Doğal dilde ameliyat ekleme / güncelleme talimatı al — JSON olarak döndür (aşağıdaki format)

## Eylem formatı
Kullanıcı bir şey OLUŞTURMAK veya GÜNCELLEMEk isterse, yanıtının sonuna şu bloğu ekle:

\`\`\`action
{
  "type": "CREATE_SURGERY" | "UPDATE_SURGERY" | "UPDATE_ROOM_STATUS",
  "payload": { ... }
}
\`\`\`

### Örnek: "Yarın 10'a Salon 2'ye apendektomi ekle"
\`\`\`action
{
  "type": "CREATE_SURGERY",
  "payload": {
    "title": "Apendektomi",
    "roomName": "Salon 2",
    "scheduledStart": "YYYY-MM-DDT10:00:00+03:00",
    "branch": "Genel Cerrahi",
    "durationMin": 60
  }
}
\`\`\`

## Kısıtlamalar
- Sadece verilen gerçek veriyle çalış, tahmin üretme
- Hasta TC numarasını ve hassas kişisel verileri tekrar etme
- Tanı veya tedavi önerisi verme — bu bir yönetim aracı
- Bilmiyorsan "Bu bilgiye şu an erişimim yok" de
`;
}

// ── ANA CHAT FONKSİYONU (STREAM) ─────────────────────────────
/**
 * streamChat — Claude API'ye istek atar, token stream'ini callback'e iletir.
 *
 * @param {object[]} messages   - { role: 'user'|'assistant', content: string }[]
 * @param {object}   user       - req.user (JWT payload)
 * @param {Function} onToken    - (token: string) => void
 * @param {Function} onDone     - (fullText: string, action?: object) => void
 * @param {Function} onError    - (err: Error) => void
 */
async function streamChat({ messages, user, onToken, onDone, onError }) {
  try {
    // Güncel context'i çek
    const context = user.institutionId
      ? await buildContext(user.institutionId)
      : await buildContext('00000000-0000-0000-0000-000000000001'); // demo fallback

    const systemPrompt = buildSystemPrompt(context, user);

    let fullText = '';

    const stream = await client.messages.stream({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      messages:   messages.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const token = chunk.delta.text;
        fullText += token;
        onToken(token);
      }
    }

    // Action bloğu var mı?
    const actionMatch = fullText.match(/```action\n([\s\S]*?)\n```/);
    let action = null;
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
      } catch {
        console.warn('[AI] Action JSON parse hatası');
      }
    }

    onDone(fullText, action);
  } catch (err) {
    console.error('[AI] Stream hatası:', err.message);
    onError(err);
  }
}

// ── TEK SEFERLIK (NON-STREAM) ─────────────────────────────────
// Kısa arka plan görevleri için (action doğrulama, özet üretme)
async function chat({ messages, user, systemOverride }) {
  const context = user.institutionId
    ? await buildContext(user.institutionId)
    : await buildContext('00000000-0000-0000-0000-000000000001');

  const systemPrompt = systemOverride || buildSystemPrompt(context, user);

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     systemPrompt,
    messages,
  });

  return response.content[0]?.text || '';
}

// ── WEB ARAMA (Operia kiosk WEB_SEARCH) ───────────────────────
/**
 * webSearch — Claude'un yerleşik `web_search` aracıyla gerçek bir web araması
 * yaptırır ve modelin ürettiği metni (özetlenmiş yanıtı) döner.
 *
 * `client.messages.create` yanıtının `content` dizisi, modelin arama yaparken
 * ürettiği birden fazla blok TÜRÜNÜ İÇERİR (server_tool_use, web_search_tool_result,
 * text — bu sırayla, birden fazla arama turu olursa tekrarlı/iç içe olabilir).
 * Yalnızca `type === 'text'` olan bloklar kullanıcıya gösterilecek metindir; bu
 * fonksiyon SADECE onları, göründükleri sırada birleştirip döner — ham arama
 * sonuçları (web_search_tool_result içindeki kaynak/URL listesi) burada hiç
 * işlenmez/döndürülmez (bkz. kiosk.routes.js WEB_SEARCH dalı — audit() sadece
 * soru+özet yazar, ham kaynak metnini hiç görmez).
 *
 * @param {string} query
 * @returns {Promise<string>}
 */
async function webSearch(query) {
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
    messages:   [{ role: 'user', content: query }],
  });

  return response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

module.exports = { streamChat, chat, buildContext, webSearch };
