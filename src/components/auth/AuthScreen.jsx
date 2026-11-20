import { useState } from 'react';
import { useAuthStore } from '../../store';
import { ROLES } from '../../data/roles';

const DEMO = {
  'admin@hastane.tr':     { password: 'Admin123!',  role_id: 0, full_name: 'Dr. Üst Yönetici' },
  'hemsire@hastane.tr':   { password: 'Demo1234!',  role_id: 1, full_name: 'Hem. Fatma Şahin' },
  'anestezi@hastane.tr':  { password: 'Demo1234!',  role_id: 2, full_name: 'Uzm. Kemal Arslan' },
  'teknisyen@hastane.tr': { password: 'Demo1234!',  role_id: 3, full_name: 'Tek. Mehmet Arslan' },
  'doktor@hastane.tr':    { password: 'Demo1234!',  role_id: 6, full_name: 'Dr. Ahmet Yılmaz' },
  'sekreter@hastane.tr':  { password: 'Demo1234!',  role_id: 7, full_name: 'Syl. Hasan Arslan' },
  'steril@hastane.tr':    { password: 'Demo1234!',  role_id: 8, full_name: 'Hem. Büşra Kaya' },
};

export default function AuthScreen() {
  const login = useAuthStore((s) => s.login);
  const [step, setStep]       = useState('giris');
  const [email, setEmail]     = useState('admin@hastane.tr');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [tfaKod, setTfaKod]   = useState(['','','','','','']);
  const [tfaError, setTfaError] = useState('');

  const roleId   = userData?.user?.role_id ?? 0;
  const roleInfo = ROLES.find(r => r.id === Number(roleId)) || ROLES[0];

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error?.message || 'Giriş başarısız');
        setLoading(false);
        return;
      }
      const { accessToken, refreshToken, user } = body.data;
      localStorage.setItem('operio_access', accessToken);
      localStorage.setItem('operio_refresh', refreshToken);
      setUserData({ user: { id: user.id, role_id: user.role_id, full_name: user.full_name, email: user.email } });
      setStep('rol');
    } catch (err) {
      setError('Sunucuya bağlanılamadı. Backend çalışıyor mu?');
    }
    setLoading(false);
  }

  function handleTfa() {
    const kod = tfaKod.join('');
    if (kod !== '123456') { setTfaError('Hatalı kod. Demo kodu: 123456'); return; }
    login(Number(roleId), userData?.user);
  }

  function tfaInput(val, i) {
    const arr = [...tfaKod]; arr[i] = val.replace(/\D/,'').slice(-1); setTfaKod(arr);
    if (val && i < 5) document.getElementById('tfa'+(i+1))?.focus();
  }
  function tfaKey(e, i) {
    if (e.key==='Backspace' && !tfaKod[i] && i>0) document.getElementById('tfa'+(i-1))?.focus();
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',background:'var(--surface)',zIndex:9999}}>

      {/* Sol panel */}
      <div style={{flex:1,background:'linear-gradient(135deg,#0F766E 0%,#0891b2 100%)',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:'48px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:'50%',background:'rgba(255,255,255,0.05)'}}/>
        <div style={{position:'absolute',bottom:-60,left:-60,width:240,height:240,borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>
        <div style={{position:'relative',zIndex:1,maxWidth:400,width:'100%'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:40}}>
            <div style={{width:48,height:48,borderRadius:14,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{fontSize:28,fontWeight:900,color:'white',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.8px'}}>Operio</span>
          </div>
          <h1 style={{fontSize:40,fontWeight:900,color:'white',fontFamily:"'Outfit',sans-serif",letterSpacing:'-1px',lineHeight:1.15,marginBottom:16}}>
            Ameliyathane<br/>Yönetimini<br/><span style={{color:'#2DD4BF'}}>Dijitalleştirin</span>
          </h1>
          <p style={{fontSize:15,color:'rgba(255,255,255,0.7)',lineHeight:1.7,marginBottom:36}}>
            Planlama, ekip, sterilizasyon ve onay süreçlerini tek platformda yönetin.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[['11','Kullanıcı Rolü'],['40+','Modül'],['%100','Güvenli'],['Her','Cihazda']].map(([v,l])=>(
              <div key={l} style={{background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:22,fontWeight:900,color:'white',fontFamily:"'Outfit',sans-serif"}}>{v}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.55)',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ panel */}
      <div style={{width:480,background:'var(--card-bg)',display:'flex',flexDirection:'column',justifyContent:'center',padding:'48px 40px',overflowY:'auto'}}>

        {/* ── GİRİŞ FORMU ── */}
        {step === 'giris' && (
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:32}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--teal)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:8}}>Hoş Geldiniz</div>
              <h2 style={{fontSize:28,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.5px'}}>Giriş Yapın</h2>
              <p style={{fontSize:13,color:'var(--slate-light)',marginTop:6}}>Kurumsal e-posta ve şifrenizle devam edin</p>
            </div>

            <div className="fg" style={{marginBottom:14}}>
              <label className="fl">E-POSTA</label>
              <input className="fi" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus required
                style={{fontSize:14,padding:'11px 14px'}}/>
            </div>

            <div className="fg" style={{marginBottom:22}}>
              <label className="fl">ŞİFRE</label>
              <input className="fi" type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                style={{fontSize:14,padding:'11px 14px'}}/>
            </div>

            {error && (
              <div style={{padding:'11px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:9,color:'#DC2626',fontSize:12.5,marginBottom:16,lineHeight:1.5}}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{width:'100%',padding:'13px',fontSize:15,fontWeight:700,cursor:'pointer',border:'none',borderRadius:10,background:'var(--teal)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.2px',opacity:loading?0.75:1,transition:'all 0.15s'}}>
              {loading ? (
                <>
                  <div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                  Giriş yapılıyor…
                </>
              ) : 'Giriş Yap →'}
            </button>

            {/* Demo Hesapları */}
            <div style={{marginTop:22,padding:'14px 16px',background:'rgba(20,184,166,0.06)',border:'1px solid rgba(20,184,166,0.15)',borderRadius:12}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--teal)',marginBottom:10}}>Demo Hesapları:</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  ['admin@hastane.tr','Admin123!','Üst Yönetici'],
                  ['hemsire@hastane.tr','Demo1234!','Sorumlu Hemşire'],
                  ['doktor@hastane.tr','Demo1234!','Doktor'],
                  ['steril@hastane.tr','Demo1234!','Sterilizasyon'],
                ].map(([e,p,r])=>(
                  <div key={e}
                    onClick={()=>{setEmail(e);setPassword(p);setError('');}}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px',borderRadius:8,cursor:'pointer',background:'var(--card-bg)',border:'1px solid var(--border)',transition:'all 0.12s'}}
                    onMouseEnter={el=>el.currentTarget.style.borderColor='var(--teal)'}
                    onMouseLeave={el=>el.currentTarget.style.borderColor='var(--border)'}>
                    <div>
                      <div style={{fontSize:11.5,fontWeight:600,color:'var(--slate)'}}>{e}</div>
                      <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1}}>{r} · {p}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* ── ROL ONAY ── */}
        {step === 'rol' && (
          <div>
            <div style={{marginBottom:28}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--teal)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:8}}>Rol Onayı</div>
              <h2 style={{fontSize:24,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>Sisteme Hoş Geldiniz</h2>
              <p style={{fontSize:13,color:'var(--slate-light)',marginTop:6}}>{userData?.user?.full_name || userData?.user?.email}</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px',border:'2px solid var(--teal)',borderRadius:14,background:'rgba(20,184,166,0.06)',marginBottom:24}}>
              <div style={{width:44,height:44,borderRadius:12,background:roleInfo.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'white',flexShrink:0}}>{roleInfo.av}</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>{roleInfo.name}</div>
                <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>Sistemdeki rolünüz</div>
              </div>
              <svg style={{marginLeft:'auto'}} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button style={{flex:1,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid var(--border)',borderRadius:9,background:'var(--surface)',color:'var(--slate-mid)'}}
                onClick={()=>setStep('giris')}>← Geri</button>
              <button style={{flex:2,padding:'11px',fontSize:14,fontWeight:700,cursor:'pointer',border:'none',borderRadius:9,background:'var(--teal)',color:'white',fontFamily:"'Outfit',sans-serif"}}
                onClick={()=>setStep('twofa')}>2FA Doğrulama →</button>
            </div>
          </div>
        )}

        {/* ── 2FA ── */}
        {step === 'twofa' && (
          <div>
            <div style={{marginBottom:28}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--teal)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:8}}>İki Faktörlü Doğrulama</div>
              <h2 style={{fontSize:24,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>Kimliğini Doğrula</h2>
            </div>
            <div style={{background:'rgba(20,184,166,0.06)',border:'1px solid rgba(20,184,166,0.2)',borderRadius:12,padding:'14px 16px',marginBottom:24,fontSize:13,color:'var(--teal)'}}>
              📱 Demo kodu: <strong>123456</strong>
              <div style={{fontSize:11,color:'var(--slate-light)',marginTop:4}}>Üretimde SMS veya TOTP kullanılır</div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:20}}>
              {tfaKod.map((v,i)=>(
                <input key={i} id={`tfa${i}`} maxLength={1} value={v}
                  onChange={e=>tfaInput(e.target.value,i)} onKeyDown={e=>tfaKey(e,i)}
                  style={{width:50,height:56,textAlign:'center',fontSize:24,fontWeight:700,border:'1.5px solid var(--border)',borderRadius:10,background:'var(--input-bg)',color:'var(--slate)',outline:'none',fontFamily:"'Outfit',sans-serif"}}
                  onFocus={e=>e.target.style.borderColor='var(--teal)'}
                  onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              ))}
            </div>
            {tfaError && <div style={{color:'#DC2626',fontSize:12,marginBottom:12,textAlign:'center'}}>{tfaError}</div>}
            <div style={{display:'flex',gap:10}}>
              <button style={{flex:1,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid var(--border)',borderRadius:9,background:'var(--surface)',color:'var(--slate-mid)'}}
                onClick={()=>setStep('rol')}>← Geri</button>
              <button style={{flex:2,padding:'11px',fontSize:14,fontWeight:700,cursor:'pointer',border:'none',borderRadius:9,background:'var(--teal)',color:'white',fontFamily:"'Outfit',sans-serif"}}
                onClick={handleTfa}>Giriş Yap ✓</button>
            </div>
          </div>
        )}

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
