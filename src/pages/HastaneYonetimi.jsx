import { useState } from 'react';
import { useDataStore, useUIStore } from '../store';
import Modal from '../components/ui/Modal';
import KurumDrawer from '../components/ui/KurumDrawer';
import { PLATFORM_PAKETLERI } from '../data/mockData';

const DURUM_CFG = { Aktif:{tag:'t-green'}, Pasif:{tag:'t-gray'}, 'Deneme Süresi':{tag:'t-orange'} };
const TURLER = ['Devlet Hastanesi', 'Özel Hastane', 'Üniversite Hastanesi'];

const BOS_FORM = { ad:'', tur:TURLER[0], sehir:'', ilce:'', yatak:'', salonSayisi:'', paket:'standard', grupId:'', iletisimAd:'', iletisimTel:'', iletisimEmail:'' };

export default function HastaneYonetimi() {
  const { kurumlar: KURUMLAR } = useDataStore();
  const { kurumlar, kurumGruplari, addKurum, updateKurum, setKurumGrubu, kurumuGruptanCikar } = useDataStore();
  const { showToast } = useUIStore();
  const [arama, setArama] = useState('');
  const [modal, setModal] = useState(null); // null | 'yeni' | kurum obj
  const [form, setForm] = useState(BOS_FORM);
  const [detayModal, setDetayModal] = useState(null);

  const liste = kurumlar.filter(k => {
    const q = arama.toLowerCase();
    return !q || `${k.ad} ${k.sehir}`.toLowerCase().includes(q);
  });

  function mevcutGrup(kurumId) {
    return kurumGruplari.find(g => g.kurumIdler.includes(kurumId));
  }

  function openModal(kurum=null) {
    if (kurum) {
      const grup = mevcutGrup(kurum.id);
      setForm({ ad:kurum.ad, tur:kurum.tur, sehir:kurum.sehir, ilce:kurum.ilce, yatak:String(kurum.yatak), salonSayisi:String(kurum.salonSayisi), paket:kurum.paket.toLowerCase(), grupId: grup?.id || '', iletisimAd:kurum.iletisimAd, iletisimTel:kurum.iletisimTel, iletisimEmail:kurum.iletisimEmail });
      setModal(kurum);
    } else {
      setForm(BOS_FORM);
      setModal('yeni');
    }
  }

  function kaydet() {
    if (!form.ad.trim() || !form.sehir.trim()) { showToast('Hastane adı ve şehir zorunlu'); return; }
    const paketObj = PLATFORM_PAKETLERI.find(p => p.id === form.paket) || PLATFORM_PAKETLERI[0];
    if (modal === 'yeni') {
      const yeniKurum = {
        ad: form.ad, tur: form.tur, sehir: form.sehir, ilce: form.ilce,
        yatak: Number(form.yatak)||0, salonSayisi: Number(form.salonSayisi)||0, kullaniciSayisi: 0,
        durum: 'Deneme Süresi', paket: paketObj.ad, aylikUcret: paketObj.aylikUcret,
        abonelikBaslangic: new Date().toISOString().split('T')[0],
        abonelikBitis: new Date(Date.now()+30*86400000).toISOString().split('T')[0],
        iletisimAd: form.iletisimAd, iletisimTel: form.iletisimTel, iletisimEmail: form.iletisimEmail,
      };
      addKurum(yeniKurum);
      // addKurum store içinde id üretiyor; en güncel kurum listesinin başına ekliyor.
      // Grup ataması bu yüzden bir sonraki tick'te en güncel store'dan okunmalı.
      setTimeout(() => {
        const eklenen = useDataStore.getState().kurumlar[0];
        if (form.grupId && eklenen) setKurumGrubu(eklenen.id, form.grupId);
      }, 0);
      showToast('Hastane eklendi ✓ — 30 günlük deneme süresi başladı');
    } else {
      updateKurum(modal.id, { ad:form.ad, tur:form.tur, sehir:form.sehir, ilce:form.ilce, yatak:Number(form.yatak)||0, salonSayisi:Number(form.salonSayisi)||0, paket:paketObj.ad, aylikUcret:paketObj.aylikUcret, iletisimAd:form.iletisimAd, iletisimTel:form.iletisimTel, iletisimEmail:form.iletisimEmail });
      const eskiGrup = mevcutGrup(modal.id);
      if (form.grupId && form.grupId !== eskiGrup?.id) {
        setKurumGrubu(modal.id, form.grupId);
      } else if (!form.grupId && eskiGrup) {
        kurumuGruptanCikar(modal.id, eskiGrup.id);
      }
      showToast('Hastane güncellendi ✓');
    }
    setModal(null);
  }

  function durumDegistir(id, durum) {
    updateKurum(id, { durum });
    showToast(`Durum güncellendi: ${durum}`);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Hastane Yönetimi</div>
          <div className="page-hd-sub">{kurumlar.length} kayıtlı hastane/kurum</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', width:13, height:13, stroke:'var(--slate-light)', fill:'none' }} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              style={{ border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px 7px 30px', fontSize:12, fontFamily:'var(--font)', background:'var(--surface)', color:'var(--slate)', outline:'none', width:220 }}
              placeholder="Hastane veya şehir ara…"
              value={arama}
              onChange={e => setArama(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => openModal()}>+ Yeni Hastane Ekle</button>
        </div>
      </div>

      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign:'left', minWidth:200 }}>Hastane</th>
              <th>Tür</th><th>Şehir</th><th>Yatak / Salon</th><th>Kullanıcı</th>
              <th>Paket</th><th>Abonelik Bitiş</th><th>Durum</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Kayıtlı hastane yok</td></tr>
            ) : liste.map(k => (
              <tr key={k.id} style={{ cursor:'pointer' }}
                onClick={() => setDetayModal(k)}
                onMouseOver={e => e.currentTarget.style.background = 'var(--table-hover)'}
                onMouseOut={e  => e.currentTarget.style.background = ''}>
                <td>
                  <div style={{ fontSize:'12.5px', fontWeight:700, color:'var(--slate)' }}>{k.ad}</div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{k.id}</div>
                </td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{k.tur}</td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{k.sehir}</td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)', textAlign:'center' }}>{k.yatak} / {k.salonSayisi}</td>
                <td style={{ fontSize:12, fontWeight:700, color:'var(--slate)', textAlign:'center' }}>{k.kullaniciSayisi}</td>
                <td><span className="tag t-teal" style={{ fontSize:'9.5px' }}>{k.paket}</span></td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{k.abonelikBitis}</td>
                <td><span className={`tag ${DURUM_CFG[k.durum]?.tag||'t-gray'}`} style={{ fontSize:'9.5px' }}>{k.durum}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize:'10.5px' }} onClick={() => openModal(k)}>Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Yeni/Düzenle Modal */}
      {modal && (
        <Modal title={modal === 'yeni' ? 'Yeni Hastane Ekle' : 'Hastaneyi Düzenle'} onClose={() => setModal(null)} width={540}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Hastane Adı *</label>
            <input className="fi" value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})} placeholder="Ör: Marmara Devlet Hastanesi" autoFocus/>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Tür</label>
              <select className="fi" value={form.tur} onChange={e=>setForm({...form,tur:e.target.value})}>
                {TURLER.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Paket</label>
              <select className="fi" value={form.paket} onChange={e=>setForm({...form,paket:e.target.value})}>
                {PLATFORM_PAKETLERI.map(p => <option key={p.id} value={p.id}>{p.ad} — ₺{p.aylikUcret.toLocaleString('tr-TR')}/ay</option>)}
              </select>
            </div>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Şehir *</label>
              <input className="fi" value={form.sehir} onChange={e=>setForm({...form,sehir:e.target.value})} placeholder="İstanbul"/>
            </div>
            <div className="fg">
              <label className="fl">İlçe</label>
              <input className="fi" value={form.ilce} onChange={e=>setForm({...form,ilce:e.target.value})} placeholder="Kadıköy"/>
            </div>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Yatak Sayısı</label>
              <input className="fi" type="number" min="0" value={form.yatak} onChange={e=>setForm({...form,yatak:e.target.value})}/>
            </div>
            <div className="fg">
              <label className="fl">Ameliyathane Salon Sayısı</label>
              <input className="fi" type="number" min="0" value={form.salonSayisi} onChange={e=>setForm({...form,salonSayisi:e.target.value})}/>
            </div>
          </div>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Yetkili Kişi</label>
            <input className="fi" value={form.iletisimAd} onChange={e=>setForm({...form,iletisimAd:e.target.value})} placeholder="Dr. Ahmet Yılmaz"/>
          </div>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Kurum Grubu <span style={{ color:'var(--slate-light)', fontWeight:400 }}>(opsiyonel)</span></label>
            <select className="fi" value={form.grupId} onChange={e=>setForm({...form,grupId:e.target.value})}>
              <option value="">Gruba bağlama</option>
              {kurumGruplari.map(g => <option key={g.id} value={g.id}>{g.ad}</option>)}
            </select>
          </div>
          <div className="fr" style={{ marginBottom:14 }}>
            <div className="fg">
              <label className="fl">Telefon</label>
              <input className="fi" value={form.iletisimTel} onChange={e=>setForm({...form,iletisimTel:e.target.value})} placeholder="(0212) 555 00 00"/>
            </div>
            <div className="fg">
              <label className="fl">E-posta</label>
              <input className="fi" type="email" value={form.iletisimEmail} onChange={e=>setForm({...form,iletisimEmail:e.target.value})} placeholder="iletisim@hastane.com"/>
            </div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={kaydet}>{modal === 'yeni' ? 'Hastane Ekle' : 'Güncelle'}</button>
          </div>
        </Modal>
      )}

      {/* Detay Drawer */}
      {detayModal && (
        <KurumDrawer
          kurum={detayModal}
          onClose={() => setDetayModal(null)}
          onDurumDegistir={durumDegistir}
          onDuzenle={openModal}
        />
      )}
    </div>
  );
}
