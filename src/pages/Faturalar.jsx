import { useState, useEffect } from 'react';
import { useUIStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';
import jsPDF from 'jspdf';

const DURUM_CFG = { 'Ödendi':{tag:'t-green'}, 'Bekliyor':{tag:'t-orange'}, 'Gecikti':{tag:'t-red'} };

export default function Faturalar() {
  const { faturalar: FATURALAR } = useDataStore();
  const { showToast } = useUIStore();
  const [faturalar, setFaturalar] = useState(FATURALAR);
  useEffect(() => { if(FATURALAR.length) setFaturalar(FATURALAR); }, [FATURALAR.length]);
  const [detayModal, setDetayModal] = useState(null);

  const toplamOdenen = faturalar.filter(f=>f.durum==='Ödendi').reduce((t,f)=>t+f.tutar,0);
  const toplamBekleyen = faturalar.filter(f=>f.durum!=='Ödendi').reduce((t,f)=>t+f.tutar,0);
  const gecikenSayisi = faturalar.filter(f=>f.durum==='Gecikti').length;

  function odendiIsaretle(id) {
    const token = localStorage.getItem('operio_access');
    fetch('http://localhost:4000/api/finans/faturalar/'+id, {method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({status:'Odendi'})}).catch(()=>{});
    setFaturalar(p => p.map(f => f.id===id ? {...f, durum:'Ödendi', odemeTarihi:new Date().toISOString().split('T')[0]} : f));
    showToast('Fatura ödendi olarak işaretlendi ✓');
  }

  function pdfIndir(f) {
    const doc = new jsPDF();
    const sayfaGenislik = doc.internal.pageSize.getWidth();

    // Üst başlık bandı
    doc.setFillColor(20, 184, 166);
    doc.rect(0, 0, sayfaGenislik, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Operio', 15, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Ameliyathane Yonetim Sistemi', 15, 27);

    doc.setTextColor(0, 0, 0);

    // Fatura başlığı + no
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FATURA', sayfaGenislik - 15, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(f.id, sayfaGenislik - 15, 27, { align: 'right' });

    let y = 46;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Fatura Edilen Kurum:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(f.kurumAd, 15, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Fatura Bilgileri:', sayfaGenislik - 15, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Kesim Tarihi: ${f.kesimTarihi}`, sayfaGenislik - 15, y + 6, { align: 'right' });
    doc.text(`Vade Tarihi: ${f.vadeTarihi}`, sayfaGenislik - 15, y + 12, { align: 'right' });

    y += 28;
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, sayfaGenislik - 15, y);

    // Kalem tablosu
    y += 12;
    doc.setFillColor(245, 245, 245);
    doc.rect(15, y - 6, sayfaGenislik - 30, 9, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Aciklama', 18, y);
    doc.text('Tutar', sayfaGenislik - 18, y, { align: 'right' });

    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text('Operio Platform Abonelik Ucreti (Aylik)', 18, y);
    doc.text(`${f.tutar.toLocaleString('tr-TR')} TL`, sayfaGenislik - 18, y, { align: 'right' });

    y += 16;
    doc.line(15, y, sayfaGenislik - 15, y);

    y += 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Toplam:', sayfaGenislik - 55, y);
    doc.setTextColor(20, 184, 166);
    doc.text(`${f.tutar.toLocaleString('tr-TR')} TL`, sayfaGenislik - 18, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    y += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Odeme Durumu:', 15, y);
    doc.setFont('helvetica', 'normal');
    const durumTr = f.durum === 'Ödendi' ? 'Odendi' : f.durum === 'Bekliyor' ? 'Bekliyor' : 'Gecikti';
    doc.text(durumTr, 55, y);
    if (f.odemeTarihi) {
      y += 6;
      doc.text(`Odeme Tarihi: ${f.odemeTarihi}`, 15, y);
    }

    // Alt bilgi
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text('Bu fatura Operio platformu tarafindan otomatik olusturulmustur.', 15, 280);

    doc.save(`${f.id}.pdf`);
    showToast('Fatura PDF indirildi ✓');
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Faturalar</div>
          <div className="page-hd-sub">{faturalar.length} fatura — platform genelinde abonelik faturalandırması</div>
        </div>
        <button className="btn btn-primary" onClick={() => showToast('Manuel fatura oluşturuluyor…')}>+ Fatura Oluştur</button>
      </div>

      <div className="stat-row" style={{ marginBottom:16 }}>
        {[
          { val:`₺${(toplamOdenen/1000).toFixed(1)}K`, lbl:'Tahsil Edilen', trend:'Bu dönem', cls:'stat-card-1', si:'si-teal' },
          { val:`₺${(toplamBekleyen/1000).toFixed(1)}K`, lbl:'Bekleyen Tutar', trend:'Henüz ödenmedi', cls:'stat-card-3', si:'si-orange' },
          { val:gecikenSayisi, lbl:'Geciken Fatura', trend:'Acil takip gerekli', cls:'stat-card-4', si:'si-purple' },
        ].map((item,i) => (
          <div key={i} className={`stat-card ${item.cls}`}>
            <div className="stat-card-glow"/><div className="stat-card-glow2"/>
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
            <div className="stat-trend">{item.trend}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th style={{textAlign:'left'}}>Fatura No</th><th>Kurum</th><th>Tutar</th><th>Kesim Tarihi</th><th>Vade</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {faturalar.map(f => (
              <tr key={f.id} style={{cursor:'pointer'}} onClick={() => setDetayModal(f)}
                onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                onMouseOut={e=>e.currentTarget.style.background=''}>
                <td style={{fontFamily:'monospace',fontSize:11,color:'var(--slate-light)'}}>{f.id}</td>
                <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{f.kurumAd}</td>
                <td style={{fontSize:12,fontWeight:700,color:'var(--teal)'}}>₺{f.tutar.toLocaleString('tr-TR')}</td>
                <td style={{fontSize:11.5,color:'var(--slate-mid)'}}>{f.kesimTarihi}</td>
                <td style={{fontSize:11.5,color:'var(--slate-mid)'}}>{f.vadeTarihi}</td>
                <td><span className={`tag ${DURUM_CFG[f.durum]?.tag||'t-gray'}`} style={{fontSize:'9.5px'}}>{f.durum}</span></td>
                <td onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:5}}>
                    {f.durum !== 'Ödendi' && (
                      <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => odendiIsaretle(f.id)}>Ödendi İşaretle</button>
                    )}
                    <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => pdfIndir(f)}>📄 PDF</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detayModal && (
        <Modal title={detayModal.id} onClose={() => setDetayModal(null)} width={460}>
          {[['Kurum',detayModal.kurumAd],['Tutar',`₺${detayModal.tutar.toLocaleString('tr-TR')}`],['Kesim Tarihi',detayModal.kesimTarihi],['Vade Tarihi',detayModal.vadeTarihi],['Ödeme Tarihi',detayModal.odemeTarihi||'—'],['Durum',detayModal.durum]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:130,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            <button className="btn btn-primary" onClick={() => pdfIndir(detayModal)}>📄 PDF İndir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
