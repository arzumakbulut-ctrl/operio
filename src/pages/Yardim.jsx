import { useState, useEffect, useRef } from 'react';

// ── YARDIM İÇERİĞİ (HTML satır 4746'dan birebir) ─────────────
const YARDIM_ICERIGI = {
  baslangic: {
    lbl: '🚀 Başlangıç',
    konular: [
      { id:'giris', baslik:'Sisteme Giriş', ikon:'🔐', icerik:`
        <h3>Sisteme Nasıl Giriş Yapılır?</h3>
        <p>Operio'ya giriş yapmak için kurumsal e-posta adresiniz ve şifrenizi kullanın.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Giriş Ekranı</strong> — E-posta ve şifrenizi girin</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>Rol Seçimi</strong> — Kurumunuzdaki rolünüzü seçin (Hemşire, Doktor, Anestezi vb.)</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>2FA Doğrulama</strong> — Güvenlik kodu e-postanıza gönderilir</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Ana Ekran</strong> — Rolünüze göre özelleştirilmiş panel açılır</div></div>
        <div class="yh-ipucu">💡 Şifrenizi unuttuysanız "Şifremi Unuttum" bağlantısına tıklayın. Kurumsal e-postanıza sıfırlama bağlantısı gönderilir.</div>
      `},
      { id:'panel', baslik:'Kontrol Paneli', ikon:'🏠', icerik:`
        <h3>Kontrol Paneli Kullanımı</h3>
        <p>Ana ekran rolünüze göre en sık kullanacağınız bilgileri özetler.</p>
        <div class="yh-adim"><span class="yh-no">⬅</span><div><strong>Sol Menü (Sidebar)</strong> — Tüm modüllere erişim buradan sağlanır</div></div>
        <div class="yh-adim"><span class="yh-no">🔍</span><div><strong>AI Arama (⌘K)</strong> — Her konuyu, ameliyatı, seti yapay zeka ile arayabilirsiniz</div></div>
        <div class="yh-adim"><span class="yh-no">💬</span><div><strong>Mesajlaşma (FAB)</strong> — Sağ alttaki buton ile anlık mesajlaşma açılır</div></div>
        <div class="yh-adim"><span class="yh-no">🌙</span><div><strong>Tema</strong> — Sidebar altından açık/koyu mod seçimi yapılır</div></div>
        <div class="yh-ipucu">💡 Topbar'daki konuma tıklayarak aktif lokasyonunuzu görüntüleyebilirsiniz.</div>
      `},
      { id:'arama', baslik:'AI Arama', ikon:'🤖', icerik:`
        <h3>Yapay Zeka ile Arama</h3>
        <p>Operio'nun AI asistanı Claude tarafından desteklenmektedir. Sistem verilerinizi anlayarak akıllı sonuçlar üretir.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Kısayol</strong> — <code>⌘K</code> veya <code>Ctrl+K</code> ile arama açılır</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>Serbest Soru</strong> — "Bugün hangi ameliyatlar var?", "Bupivakain dozu nedir?" gibi doğal dil sorguları</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Sistem Verisi</strong> — Ameliyatlar, steril setler, personel bilgileri otomatik dahil edilir</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Tam Sayfa</strong> — "Tam Sayfa →" ile detaylı arama sonuçları ekranı açılır</div></div>
        <div class="yh-ipucu">💡 AI Asistan modülü paket yönetiminden aktif edilmiş olmalıdır.</div>
      `},
    ]
  },
  ameliyat: {
    lbl: '🏥 Ameliyat',
    konular: [
      { id:'ameliyat-liste', baslik:'Ameliyat Listesi', ikon:'📋', icerik:`
        <h3>Günlük Ameliyat Listesi</h3>
        <p>Bugünkü tüm ameliyatları saat, salon, cerrah ve durum bilgileriyle görüntüleyin.</p>
        <div class="yh-adim"><span class="yh-no">🟢</span><div><strong>Devam Ediyor</strong> — Aktif ameliyatlar yeşil rozet ile gösterilir</div></div>
        <div class="yh-adim"><span class="yh-no">🟡</span><div><strong>Bekliyor</strong> — Başlamamış ameliyatlar sarı rozet ile gösterilir</div></div>
        <div class="yh-adim"><span class="yh-no">✅</span><div><strong>Tamamlandı</strong> — Biten ameliyatlar teal rozet ile gösterilir</div></div>
        <div class="yh-adim"><span class="yh-no">👁</span><div><strong>Detay</strong> — Ameliyat kartına tıklayarak ekip, hasta, set bilgilerini görün</div></div>
      `},
      { id:'vaka-hazirlik', baslik:'Vaka Hazırlığı', ikon:'🛡️', icerik:`
        <h3>Vaka Hazırlık Süreci</h3>
        <p>Hemşire rolünde ameliyat öncesi hazırlık adımlarını takip edin.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Vaka Seçin</strong> — Sol listeden hazırlanacak ameliyatı seçin</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>QR ile Set Teslim</strong> — Steril setleri QR okutarak sisteme teslim alın</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Checklist</strong> — Sarf, cihaz ve genel hazırlık maddelerini işaretleyin</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Tamamla</strong> — Tüm maddeler işaretlenince "Hazırlık Tamamlandı" butonuna basın</div></div>
        <div class="yh-ipucu">💡 Geri Al butonu ile onayı kaldırabilir ve düzeltme yapabilirsiniz.</div>
      `},
      { id:'sayim', baslik:'Sayım Formu', ikon:'📋', icerik:`
        <h3>İntraoperatif Sayım Formu</h3>
        <p>Yasal zorunluluk olan alet ve gazlı bez sayımını kayıt altına alın.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Başlangıç Sayımı</strong> — Ameliyat öncesi tüm malzeme adedini girin</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>1. Bitiş</strong> — Kapama öncesi sayım — başlangıçla eşleşmeli</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>2. Bitiş</strong> — Kapama sonrası kontrol sayımı</div></div>
        <div class="yh-adim"><span class="yh-no">⚠</span><div><strong>Uyuşmazlık</strong> — Kırmızı hücreler uyuşmazlık bildirir, cerrah mutlaka bilgilendirilmeli</div></div>
        <div class="yh-adim"><span class="yh-no">✍</span><div><strong>İmzalar</strong> — Scrub, Sirkule ve Cerrah imzası zorunludur</div></div>
      `},
      { id:'ameliyat-notu', baslik:'Ameliyat Notu', ikon:'🩺', icerik:`
        <h3>Operatif Rapor / Ameliyat Notu</h3>
        <p>Cerrah olarak vaka sonrası operatif özet ve bulgular girilir.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Vaka Seçin</strong> — Sol listeden ameliyatı seçin</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>Preoperatif</strong> — Anestezi tipi, ASA skoru, pozisyon bilgileri</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Operatif Özet</strong> — Teknik, bulgular, kanama miktarı</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Postop Plan</strong> — Komplikasyon, dren, postoperatif öneriler</div></div>
        <div class="yh-adim"><span class="yh-no">✍</span><div><strong>İmzalayın</strong> — İmza alanına tıklayarak saat+tarih damgası ile imzalayın</div></div>
      `},
    ]
  },
  steril: {
    lbl: '🧪 Sterilizasyon',
    konular: [
      { id:'set-takip', baslik:'Set Takip Paneli', ikon:'🔄', icerik:`
        <h3>Sterilizasyon İş Akışı</h3>
        <p>Set takip paneli sterilizasyon sürecini adım adım yönetir.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Kirli Teslim</strong> — QR ile gelen kirli setleri teslim alın</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>Yıkama</strong> — Set yıkamaya alındı olarak işaretleyin</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Otoklav</strong> — Sterilizasyon süresini girin ve işlemi başlatın</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Steril Depo</strong> — İşlemi tamamlanan seti rafa yerleştirin</div></div>
        <div class="yh-ipucu">💡 Her adımda sistem tarih/saat damgası ve personel bilgisini otomatik kaydeder.</div>
      `},
      { id:'takip-gecmis', baslik:'Takip Geçmişi', ikon:'📊', icerik:`
        <h3>İzlenebilirlik & Geçmiş</h3>
        <p>Hangi set hangi vakada kullanıldı, sterilizasyon koşulları neydi — tüm süreç kayıt altında.</p>
        <div class="yh-adim"><span class="yh-no">🛡</span><div><strong>Set Seçin</strong> — Sol listeden seti seçerek tüm geçmişi görün</div></div>
        <div class="yh-adim"><span class="yh-no">🔄</span><div><strong>Süreç Zinciri</strong> — Kirli teslim → Yıkama → Otoklav → Depo → Vaka</div></div>
        <div class="yh-adim"><span class="yh-no">🏥</span><div><strong>Vaka Kullanımı</strong> — Setin hangi ameliyatlarda kullanıldığı listelenir</div></div>
      `},
    ]
  },
  egitim: {
    lbl: '📚 Eğitim',
    konular: [
      { id:'egitim-olustur', baslik:'Eğitim Oluşturma', ikon:'✏️', icerik:`
        <h3>Yeni Eğitim Oluşturma</h3>
        <p>Sorumlular (Üst Yönetici, Hemşire Sorumlusu, Anestezi Sorumlusu, Sterilizasyon Sorumlusu) eğitim oluşturabilir.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Eğitim Oluştur</strong> butonu — Başlık, açıklama, kategori, tip seçin</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>Eğitmen Ata</strong> — Listeden eğitimi verecek kişiyi seçin</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Hedef Kitle</strong> — Hangi personelin bu eğitimi göreceğini belirleyin</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Taslak / Yayınla</strong> — Taslak olarak kaydedip sonra yayınlayabilirsiniz</div></div>
        <div class="yh-ipucu">💡 "Operio Sunumu Oluştur" ile slayt tabanlı interaktif eğitim hazırlayabilirsiniz.</div>
      `},
      { id:'sunum', baslik:'Sunum Editörü', ikon:'🎬', icerik:`
        <h3>Operio Sunum Editörü</h3>
        <p>Slayt tabanlı eğitimler doğrudan Operio içinde oluşturulur ve sunulur.</p>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>8 Slayt Tipi</strong> — Başlık, İçerik, Liste, Görsel, Alıntı, Test Sorusu, Bölüm, Kapanış</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>6 Tema</strong> — Koyu, Teal, Mor, Mavi, Kırmızı, Açık</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Konuşmacı Notu</strong> — Her slayda not ekleyebilirsiniz</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>Sunum Modu</strong> — Tam ekran, ←→ tuşları, süre sayacı, test sorusu interaksiyonu</div></div>
        <div class="yh-adim"><span class="yh-no">5</span><div><strong>Kütüphane</strong> — Tüm eğitimlerden "🎬 Başlat" ile sunum başlatılır</div></div>
      `},
    ]
  },
  paket: {
    lbl: '📦 Paket & Abonelik',
    konular: [
      { id:'paket-modul', baslik:'Modül Yönetimi', ikon:'🔧', icerik:`
        <h3>Paket & Modül Yönetimi</h3>
        <p>Üst Yönetici → Abonelik → Paket & Modül Yönetimi sayfasından yönetilir.</p>
        <div class="yh-adim"><span class="yh-no">📦</span><div><strong>Temel Paket</strong> — Zorunlu temel pakettir, kaldırılamaz</div></div>
        <div class="yh-adim"><span class="yh-no">🔧</span><div><strong>Modül Ekle/Kaldır</strong> — Sterilizasyon, Anestezi, Klinik Belgeler, Analitik, AI vb.</div></div>
        <div class="yh-adim"><span class="yh-no">📈</span><div><strong>Yükseltme</strong> — Anında aktif, dönem fiyat farkı faturalanır</div></div>
        <div class="yh-adim"><span class="yh-no">📉</span><div><strong>Düşürme</strong> — Dönem sonunda geçerli, veriler 90 gün saklanır</div></div>
        <div class="yh-ipucu">💡 Logo yanındaki paket rozeti (Basic/Standard/Pro) tıklanarak paket sayfasına ulaşılır.</div>
      `},
      { id:'misafir-hekim-paket', baslik:'Misafir Hekim Paketi', ikon:'👥', icerik:`
        <h3>Misafir Hekim Paketleri</h3>
        <p>3 farklı misafir hekim paketi mevcuttur.</p>
        <div class="yh-adim"><span class="yh-no">🔵</span><div><strong>Starter</strong> — 5 hekime kadar · 990₺/ay</div></div>
        <div class="yh-adim"><span class="yh-no">🟣</span><div><strong>Growth</strong> — 15 hekime kadar · 1.790₺/ay</div></div>
        <div class="yh-adim"><span class="yh-no">🟢</span><div><strong>Unlimited</strong> — Sınırsız hekim · 2.990₺/ay</div></div>
        <div class="yh-adim"><span class="yh-no">⚠</span><div><strong>Limit Kontrolü</strong> — Aktif slot dolduğunda yeni onay yapılamaz</div></div>
      `},
    ]
  },
  misafir: {
    lbl: '👨‍⚕️ Misafir Hekim',
    konular: [
      { id:'mh-basvuru', baslik:'Başvuru Süreci', ikon:'📋', icerik:`
        <h3>Misafir Hekim Başvuru Akışı</h3>
        <div class="yh-adim"><span class="yh-no">1</span><div><strong>Davet</strong> — Üst Yönetici e-posta ile davet gönderir</div></div>
        <div class="yh-adim"><span class="yh-no">2</span><div><strong>Kayıt Formu</strong> — Ad, uzmanlık, TC, diploma no, erişim süresi bilgileri girilir</div></div>
        <div class="yh-adim"><span class="yh-no">3</span><div><strong>Belge Yükleme</strong> — Diploma ve uzmanlık belgesi PDF olarak yüklenir</div></div>
        <div class="yh-adim"><span class="yh-no">4</span><div><strong>İnceleme</strong> — Üst Yönetici belgeler ve bilgileri inceler</div></div>
        <div class="yh-adim"><span class="yh-no">5</span><div><strong>Onay / Red</strong> — Onaylanırsa sisteme erişim açılır, reddedilirse bildirim gönderilir</div></div>
        <div class="yh-ipucu">💡 Misafir Hekim sadece kendi ameliyatlarını görür, başka hasta verilerine erişemez.</div>
      `},
      { id:'mh-yonetim', baslik:'Hekim Yönetimi', ikon:'⚙️', icerik:`
        <h3>Misafir Hekim Yönetim Ekranı</h3>
        <p>Üst Yönetici → Kullanıcılar → Misafir Hekim Yönetimi</p>
        <div class="yh-adim"><span class="yh-no">⏳</span><div><strong>Bekleyen</strong> — Onay bekleyen başvuruları listeler, hızlı Onayla/Reddet butonları</div></div>
        <div class="yh-adim"><span class="yh-no">✅</span><div><strong>Aktif</strong> — Sisteme erişimi olan hekimler</div></div>
        <div class="yh-adim"><span class="yh-no">⏸</span><div><strong>Askıya Al</strong> — Erişimi geçici olarak durdurur, veriler korunur</div></div>
        <div class="yh-adim"><span class="yh-no">❌</span><div><strong>Red Formu</strong> — Neden seçip açıklama yazarak reddedilebilir</div></div>
      `},
    ]
  },
  sorun: {
    lbl: '🆘 Sorun & Destek',
    konular: [
      { id:'siksorulan', baslik:'Sık Sorulan Sorular', ikon:'❓', icerik:`
        <h3>Sık Sorulan Sorular</h3>
        <div class="yh-sss">
          <div class="yh-sss-s" onclick="this.classList.toggle('open')">
            <div class="yh-sss-q">🔐 Şifremi unuttum, ne yapmalıyım?</div>
            <div class="yh-sss-a">Giriş ekranındaki "Şifremi Unuttum" bağlantısına tıklayın. Kurumsal e-postanıza şifre sıfırlama bağlantısı gönderilir. Bağlantı 30 dakika geçerlidir.</div>
          </div>
          <div class="yh-sss-s" onclick="this.classList.toggle('open')">
            <div class="yh-sss-q">🔒 Verilerim güvende mi?</div>
            <div class="yh-sss-a">Tüm veriler şifrelenerek saklanır. KVKK uyumlu veri işleme politikası uygulanır. Rol bazlı erişim kontrolü ile her kullanıcı yalnızca yetkili olduğu verilere ulaşabilir.</div>
          </div>
          <div class="yh-sss-s" onclick="this.classList.toggle('open')">
            <div class="yh-sss-q">📱 Mobil cihazdan kullanabilir miyim?</div>
            <div class="yh-sss-a">Operio tarayıcı tabanlıdır, mobil tarayıcıdan kullanılabilir. Tam mobil uygulama yakında hizmete girecektir.</div>
          </div>
          <div class="yh-sss-s" onclick="this.classList.toggle('open')">
            <div class="yh-sss-q">🖨 Formları yazdırabilir miyim?</div>
            <div class="yh-sss-a">Sayım Formu, Ameliyat Notu ve Anestezi Kayıt Formu sayfalarındaki "Yazdır" butonunu kullanın. PDF olarak kaydedebilir veya yazıcıya gönderebilirsiniz.</div>
          </div>
          <div class="yh-sss-s" onclick="this.classList.toggle('open')">
            <div class="yh-sss-q">💊 Anestezi Kayıt Formunda kritik değerler nasıl gösterilir?</div>
            <div class="yh-sss-a">KB 160/100 üstü veya 90/50 altı, SpO₂ %95 altı, NB 120 üstü değerler kırmızı renkte gösterilir. EtCO₂ 30-45 dışı sarı uyarı verir.</div>
          </div>
          <div class="yh-sss-s" onclick="this.classList.toggle('open')">
            <div class="yh-sss-q">📦 Paketime modül ekleyebilir miyim?</div>
            <div class="yh-sss-a">Üst Yönetici rolündeyseniz Abonelik → Paket & Modül Yönetimi sayfasından modül ekleyebilirsiniz. Değişiklik hemen aktif olur, fark tutarı dönem sonunda faturalanır.</div>
          </div>
        </div>
      `},
      { id:'iletisim', baslik:'İletişim & Destek', ikon:'📞', icerik:`
        <h3>Teknik Destek & İletişim</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:11px">
            <div style="font-size:22px;margin-bottom:8px">📧</div>
            <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:3px">E-posta Destek</div>
            <div style="font-size:12px;color:var(--teal);font-weight:600">destek@operio.com.tr</div>
            <div style="font-size:10px;color:var(--slate-light);margin-top:2px">7/24 yanıt</div>
          </div>
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:11px">
            <div style="font-size:22px;margin-bottom:8px">📞</div>
            <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:3px">Telefon</div>
            <div style="font-size:12px;color:var(--teal);font-weight:600">0850 123 45 67</div>
            <div style="font-size:10px;color:var(--slate-light);margin-top:2px">Hafta içi 08-18</div>
          </div>
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:11px">
            <div style="font-size:22px;margin-bottom:8px">💬</div>
            <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:3px">Canlı Destek</div>
            <div style="font-size:12px;color:var(--teal);font-weight:600">Sistem içi chat</div>
            <div style="font-size:10px;color:var(--slate-light);margin-top:2px">Çalışma saatlerinde</div>
          </div>
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:11px">
            <div style="font-size:22px;margin-bottom:8px">📚</div>
            <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:3px">Dokümantasyon</div>
            <div style="font-size:12px;color:var(--teal);font-weight:600">docs.operio.com.tr</div>
            <div style="font-size:10px;color:var(--slate-light);margin-top:2px">Güncel kılavuzlar</div>
          </div>
        </div>
        <div style="padding:14px 16px;border-radius:12px;background:rgba(20,184,166,0.06);border:1.5px solid rgba(20,184,166,0.2)">
          <div style="font-size:12px;font-weight:700;color:var(--teal);margin-bottom:6px">🚀 Özellik İsteği & Geri Bildirim</div>
          <div style="font-size:11.5px;color:var(--slate-mid);margin-bottom:10px">Yeni özellik öneriniz mi var? Sidebar altındaki "Katkıda Bulun" bölümünden iletebilirsiniz.</div>
          <button class="btn btn-secondary btn-sm" style="font-size:11px">⭐ Öneri Gönder</button>
        </div>
      `},
    ]
  },
};

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function Yardim() {
  const tumKonular = Object.values(YARDIM_ICERIGI).flatMap(k => k.konular);
  const [arama,   setArama]   = useState('');
  const [aktifKat, setAktifKat] = useState('baslangic');
  const [seciliId, setSeciliId] = useState('giris');
  const icerikRef = useRef(null);

  const filtreli = arama
    ? tumKonular.filter(k =>
        k.baslik.toLowerCase().includes(arama.toLowerCase()) ||
        k.icerik.toLowerCase().includes(arama.toLowerCase())
      )
    : (YARDIM_ICERIGI[aktifKat]?.konular || []);

  const seciliKonu = tumKonular.find(k => k.id === seciliId) || filtreli[0];

  // İlk yüklemede ilk konuyu seç
  useEffect(() => {
    if (filtreli.length && !filtreli.find(k => k.id === seciliId)) {
      setSeciliId(filtreli[0].id);
    }
  }, [arama, aktifKat]);

  function konuSec(id, katId) {
    setSeciliId(id);
    if (katId) setAktifKat(katId);
    if (icerikRef.current) icerikRef.current.scrollTop = 0;
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>

      {/* Başlık */}
      <div style={{padding:'0 0 16px',display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Yardım & Destek</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>Operio kullanım kılavuzu ve SSS</div>
        </div>
        {/* Arama */}
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:13,height:13,stroke:'var(--slate-light)',fill:'none'}} viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            style={{border:'1.5px solid var(--border)',borderRadius:9,padding:'8px 12px 8px 32px',fontSize:12,fontFamily:'var(--font)',outline:'none',background:'var(--input-bg)',color:'var(--slate)',width:220,transition:'border-color 0.15s'}}
            placeholder="Konu ara…"
            value={arama}
            onChange={e => setArama(e.target.value)}
            onFocus={e => e.target.style.borderColor='var(--teal-mid)'}
            onBlur={e => e.target.style.borderColor='var(--border)'}
          />
        </div>
      </div>

      {/* İki kolon grid */}
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:14,flex:1,overflow:'hidden'}}>

        {/* Sol: Kategori & Konu listesi */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:2}}>
          {arama ? (
            /* Arama sonuçları */
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'6px 10px 4px'}}>
                {filtreli.length} sonuç
              </div>
              {filtreli.map(k => (
                <div key={k.id}
                  onClick={() => konuSec(k.id, null)}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:500,transition:'all 0.12s',
                    background: seciliId===k.id ? 'rgba(20,184,166,0.1)' : 'transparent',
                    color: seciliId===k.id ? 'var(--teal)' : 'var(--slate-mid)'}}
                  onMouseEnter={e => { if(seciliId!==k.id) e.currentTarget.style.background='var(--surface)'; }}
                  onMouseLeave={e => { if(seciliId!==k.id) e.currentTarget.style.background='transparent'; }}>
                  <span style={{fontSize:15}}>{k.ikon}</span>{k.baslik}
                </div>
              ))}
              {!filtreli.length && (
                <div style={{padding:'20px 10px',textAlign:'center',color:'var(--slate-light)',fontSize:12}}>Sonuç bulunamadı</div>
              )}
            </div>
          ) : (
            /* Normal kategori listesi */
            Object.entries(YARDIM_ICERIGI).map(([katId, kat]) => (
              <div key={katId} style={{marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'6px 10px 4px'}}>{kat.lbl}</div>
                {kat.konular.map(k => (
                  <div key={k.id}
                    onClick={() => konuSec(k.id, katId)}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:500,transition:'all 0.12s',
                      background: seciliId===k.id ? 'rgba(20,184,166,0.1)' : 'transparent',
                      color: seciliId===k.id ? 'var(--teal)' : 'var(--slate-mid)'}}
                    onMouseEnter={e => { if(seciliId!==k.id) e.currentTarget.style.background='var(--surface)'; }}
                    onMouseLeave={e => { if(seciliId!==k.id) e.currentTarget.style.background='transparent'; }}>
                    <span style={{fontSize:15}}>{k.ikon}</span>{k.baslik}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Sağ: İçerik */}
        <div ref={icerikRef}
          style={{background:'var(--card-bg)',border:'1.5px solid var(--border)',borderRadius:16,overflowY:'auto',padding:'24px 28px'}}>
          {seciliKonu ? (
            <div className="yardim-icerik-html"
              dangerouslySetInnerHTML={{__html: seciliKonu.icerik}}/>
          ) : (
            <div style={{textAlign:'center',padding:60,color:'var(--slate-light)'}}>
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <div style={{fontSize:15,fontWeight:700,color:'var(--slate)'}}>Sonuç bulunamadı</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
