require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ROLES = [
  { id:0,  name:'ust_yonetici',       display_name:'Üst Yönetici' },
  { id:1,  name:'sorumlu_hemsire',     display_name:'Ameliyathane Sorumlu Hemşiresi' },
  { id:2,  name:'anestezi_sorumlusu',  display_name:'Anestezi Sorumlusu' },
  { id:3,  name:'anestezi_teknisyeni', display_name:'Anestezi Teknisyeni' },
  { id:4,  name:'hemsire',             display_name:'Hemşire & Ameliyathane Teknikeri' },
  { id:5,  name:'aml_personeli',       display_name:'Ameliyathane Personeli' },
  { id:6,  name:'doktor',              display_name:'Doktor' },
  { id:7,  name:'sekreter',            display_name:'Sekreterlik' },
  { id:8,  name:'steril_sorumlusu',    display_name:'Sterilizasyon Sorumlusu' },
  { id:9,  name:'steril_personeli',    display_name:'Sterilizasyon Personeli' },
  { id:10, name:'misafir_hekim',       display_name:'Misafir Hekim' },
];

const DEMO_USERS = [
  { email:'admin@hastane.tr',     password:'Admin123!', fullName:'Dr. Üst Yönetici',     roleId:0 },
  { email:'hemsire@hastane.tr',   password:'Demo1234!', fullName:'Hem. Fatma Şahin',      roleId:1 },
  { email:'anestezi@hastane.tr',  password:'Demo1234!', fullName:'Uzm. Kemal Arslan',     roleId:2 },
  { email:'teknisyen@hastane.tr', password:'Demo1234!', fullName:'Tek. Mehmet Arslan',    roleId:3 },
  { email:'hemsire2@hastane.tr',  password:'Demo1234!', fullName:'Hem. Ayşe Korkmaz',     roleId:4 },
  { email:'doktor@hastane.tr',    password:'Demo1234!', fullName:'Dr. Ahmet Yılmaz',      roleId:6 },
  { email:'sekreter@hastane.tr',  password:'Demo1234!', fullName:'Sn. Zeynep Öztürk',    roleId:7 },
  { email:'steril@hastane.tr',    password:'Demo1234!', fullName:'Srl. Meral Doğan',      roleId:8 },
];

async function main() {
  console.log('🌱 Seed başlıyor…');

  // Roller
  for (const r of ROLES) {
    await pool.query(
      `INSERT INTO roles (id, name, display_name) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name`,
      [r.id, r.name, r.display_name]
    );
  }
  console.log(`✅ ${ROLES.length} rol`);

  // Demo kurum
  const { rows: instRows } = await pool.query(
    `INSERT INTO institutions (id, name, type, address, phone, email)
     VALUES ('00000000-0000-0000-0000-000000000001','Merkez Devlet Hastanesi','Devlet Hastanesi',
             'Bağcılar Mah. Tıp Cad. No:42, Bağcılar / İstanbul','(0212) 555 10 20','ameliyathane@merkezdevlet.sag.gov.tr')
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name RETURNING id`
  );
  const instId = instRows[0].id;
  console.log('✅ Kurum: Merkez Devlet Hastanesi');

  // Kullanıcılar
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, institution_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name, role_id=EXCLUDED.role_id`,
      [u.email, hash, u.fullName, u.roleId, instId]
    );
  }
  console.log(`✅ ${DEMO_USERS.length} kullanıcı`);

  // Salonlar
  const ROOMS = [
    { name:'Salon 1', num:1, branch:'Genel Cerrahi', cap:6, status:'ACTIVE' },
    { name:'Salon 2', num:2, branch:'Ortopedi',      cap:8, status:'ACTIVE' },
    { name:'Salon 3', num:3, branch:'Göz',           cap:4, status:'IDLE' },
    { name:'Salon 4', num:4, branch:'Genel',         cap:6, status:'IDLE' },
    { name:'Salon 5', num:5, branch:'Ortopedi',      cap:8, status:'RESERVED' },
    { name:'Salon 6', num:6, branch:'—',             cap:6, status:'MAINTENANCE' },
  ];
  for (const r of ROOMS) {
    await pool.query(
      `INSERT INTO operating_rooms (institution_id, name, room_number, branch, capacity, status)
       VALUES ($1,$2,$3,$4,$5,$6::room_status)
       ON CONFLICT (institution_id, room_number) DO NOTHING`,
      [instId, r.name, r.num, r.branch, r.cap, r.status]
    );
  }
  console.log(`✅ ${ROOMS.length} salon`);

  // Steril setler
  const SETS = [
    { code:'LAP-A-001', name:'Laparoskopi Seti A',      total:3, sterile:2, in_use:1, shelf:'A-1', status:'STERILE' },
    { code:'GEN-001',   name:'Genel Cerrahi Seti',      total:4, sterile:3, in_use:1, shelf:'A-2', status:'STERILE' },
    { code:'ORT-P-001', name:'Ortopedi Protez Seti',    total:2, sterile:1, in_use:1, shelf:'B-1', status:'IN_USE' },
    { code:'GOZ-001',   name:'Göz Mikrocerrahisi Seti', total:2, sterile:2, in_use:0, shelf:'C-1', status:'STERILE' },
    { code:'NRO-001',   name:'Nörocerrahisi Seti',      total:1, sterile:0, in_use:0, shelf:'D-1', status:'STERILIZING' },
  ];
  for (const s of SETS) {
    await pool.query(
      `INSERT INTO sterile_sets (code, name, total_count, sterile_count, in_use_count, shelf_location, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::set_status)
       ON CONFLICT (code) DO NOTHING`,
      [s.code, s.name, s.total, s.sterile, s.in_use, s.shelf, s.status]
    );
  }
  console.log(`✅ ${SETS.length} steril set`);

  // Demo ameliyatlar
  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email=$1', ['doktor@hastane.tr']);
  const drId = userRows[0]?.id;
  const { rows: roomRows } = await pool.query('SELECT id FROM operating_rooms WHERE institution_id=$1 ORDER BY room_number', [instId]);

  if (drId && roomRows.length >= 2) {
    const SURGERIES = [
      { room:roomRows[0].id, title:'Laparoskopik Kolesistektomi', branch:'Genel Cerrahi', surgeon:'Dr. Ahmet Yılmaz', start:'08:00', dur:90, status:'COMPLETED' },
      { room:roomRows[1].id, title:'Total Diz Protezi (Sol)',      branch:'Ortopedi',      surgeon:'Dr. Can Özkan',   start:'08:30', dur:150, status:'IN_PROGRESS' },
      { room:roomRows[0].id, title:'Apendektomi',                  branch:'Genel Cerrahi', surgeon:'Dr. Ahmet Yılmaz', start:'11:00', dur:90, status:'WAITING' },
    ];
    const today = new Date().toISOString().slice(0,10);
    for (const s of SURGERIES) {
      // `surgeries`'de (institution_id, room_id, title) için gerçek bir UNIQUE
      // constraint yok (ve prod verisinde olmamalı — aynı salon+başlıkla
      // tekrarlanan gerçek ameliyatlar meşrudur), bu yüzden eski
      // "ON CONFLICT DO NOTHING" hiçbir şeye çarpmıyordu: her container
      // restart'ında (docker-compose bunu HER başlangıçta çalıştırıyor) bu 3
      // demo kaydı yeniden ekleniyordu. Demo seed'inin kendisi idempotent
      // olmalı; bunu şema seviyesinde değil, burada (varlık kontrolüyle)
      // sağlıyoruz.
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM surgeries WHERE institution_id=$1 AND room_id=$2 AND title=$3 LIMIT 1',
        [instId, s.room, s.title]
      );
      if (existing.length > 0) continue;

      await pool.query(
        `INSERT INTO surgeries (institution_id, room_id, title, branch, surgeon_name, scheduled_start, duration_min, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::surgery_status)`,
        [instId, s.room, s.title, s.branch, s.surgeon, `${today}T${s.start}:00+03:00`, s.dur, s.status]
      );
    }
    console.log(`✅ ${SURGERIES.length} demo ameliyat`);
  }

  // Platform admin (ilk süper yönetici hesabı)
  const PLATFORM_ADMIN_EMAIL = 'super@operio.com';
  const PLATFORM_ADMIN_PASSWORD = 'PlatformAdmin123!'; // demo/geliştirme — prod'da env'den okunmalı
  const hash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO platform_admins (email, password_hash, full_name, group_slug)
     VALUES ($1,$2,'Operio Süper Yönetici','super')
     ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name`,
    [PLATFORM_ADMIN_EMAIL, hash]
  );
  console.log('✅ Platform admin: super@operio.com');

  console.log('\n🎉 Seed tamamlandı!');
  console.log('\nDemo giriş bilgileri:');
  console.log('  admin@hastane.tr   / Admin123!  → Üst Yönetici');
  console.log('  doktor@hastane.tr  / Demo1234!  → Doktor');
  console.log('  steril@hastane.tr  / Demo1234!  → Sterilizasyon Sorumlusu');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => pool.end());

// Not: Güvenlik tabloları migration sırasında oluşturulur.
// Seed sadece uygulama verilerini ekler.
// Güvenlik tabloları migration/001_init.sql içinde tanımlıdır.
