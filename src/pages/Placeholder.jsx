import { useNavigate } from 'react-router-dom';

export default function Placeholder({ title, icon = '🚧', desc }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 52 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif" }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--slate-light)', maxWidth: 360, lineHeight: 1.7 }}>
        {desc || 'Bu modül yapım aşamasındadır. Mimari kurulumu tamamlandıktan sonra buraya gerçek içerik eklenecek.'}
      </div>
      <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Geri Dön</button>
    </div>
  );
}
