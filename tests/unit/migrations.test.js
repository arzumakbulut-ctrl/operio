import { readFileSync } from 'fs';
test('001_init.sql defines kiosk/voice/spotify tables', () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  for (const table of ['voice_profiles', 'kiosk_tokens', 'kiosk_mock_config', 'user_spotify_connections']) {
    expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test('001_init.sql defines vision_counting module, last_suggested_count column, and 6 seeded demo sets', () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  expect(sql).toMatch(/INSERT INTO modules[\s\S]*?'vision_counting'/);
  expect(sql).toMatch(/ALTER TABLE set_instruments ADD COLUMN IF NOT EXISTS last_suggested_count SMALLINT/);
  for (let n = 1; n <= 6; n++) {
    expect(sql).toContain(`10000000-0000-0000-0000-00000000000${n}`);
  }
});
