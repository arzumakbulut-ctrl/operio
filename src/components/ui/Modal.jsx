export default function Modal({ title, onClose, children, width = 520, icon }) {
  return (
    <div className="modal-bg open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width, padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }} onClick={(e) => e.stopPropagation()}>

        {/* Gradient başlık — ikinci resim stili */}
        <div style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #0891b2 100%)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {icon && (
              <div style={{ width:30, height:30, borderRadius:8, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>
                {icon}
              </div>
            )}
            <div style={{ fontSize:15, fontWeight:700, color:'white', fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.3px' }}>{title}</div>
          </div>
          <div onClick={onClose} style={{ color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:20, lineHeight:1, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6, transition:'background 0.15s' }}
            onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
            onMouseOut={e => e.currentTarget.style.background='transparent'}>
            ✕
          </div>
        </div>

        {/* İçerik */}
        <div style={{ padding:'20px 22px', overflowY:'auto', flex:1 }}>
          {children}
        </div>

      </div>
    </div>
  );
}
