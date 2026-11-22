import { readFileSync } from 'fs';
test('001_init.sql defines kiosk/voice/spotify tables', () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  for (const table of ['voice_profiles', 'kiosk_tokens', 'kiosk_mock_config', 'user_spotify_connections']) {
    expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test("kiosk_mock_config.mode CHECK allows 'real' alongside the existing modes", () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  expect(sql).toMatch(/CHECK \(mode IN \('always_match','always_reject_team','always_unrecognized','cycle','real'\)\)/);
});
