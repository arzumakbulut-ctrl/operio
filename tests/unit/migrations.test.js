import { readFileSync } from 'fs';
test('001_init.sql defines kiosk/voice/spotify tables', () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  for (const table of ['voice_profiles', 'kiosk_tokens', 'kiosk_mock_config', 'user_spotify_connections']) {
    expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});
