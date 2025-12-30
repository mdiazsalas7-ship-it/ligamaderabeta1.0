import { useEffect, useState, useRef } from 'react';
import './App.css'; 
import { db, auth } from './firebase'; 
import { collection, getDocs, doc, onSnapshot, query, where, limit, orderBy, updateDoc } from 'firebase/firestore'; 
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import type { DocumentData } from 'firebase/firestore'; 

// Importaciones de Componentes
import Login from './Login';
import UserManagement from './UserManagement'; 
import RegistroForma21 from './RegistroForma21'; 
import RosterForm from './RosterForm'; 
import RosterViewer from './RosterViewer'; 
import MatchForm from './MatchForm'; 
import Forma21AdminViewer from './Forma21AdminViewer'; 
import CalendarViewer from './CalendarViewer'; 
import MesaTecnica from './MesaTecnica'; 
import StatsViewer from './StatsViewer'; 
import DelegadoDashboard from './DelegadoDashboard';
import JugadorDashboard from './JugadorDashboard';
import StandingsViewer from './StandingsViewer'; 
import Forma5Selector from './Forma5Selector';
import LiveGameViewer from './LiveGameViewer';
import MatchDetailViewer from './MatchDetailViewer';
import NewsAdmin from './NewsAdmin'; 
import NewsFeed from './NewsFeed';   
import AdminEquipos from './AdminEquipos';
import PlayoffBracket from './PlayoffBracket'; 
import InstallButton from './InstallButton';

// Interfaces
interface Equipo { 
    id: string; 
    nombre: string; 
    victorias: number; 
    derrotas: number; 
    puntos_favor: number; 
    puntos_contra?: number; 
    puntos: number;
    logoUrl?: string; 
}

interface UsuarioData extends DocumentData { 
    uid: string; 
    email: string | null; 
    rol: 'admin' | 'delegado' | 'pendiente' | 'jugador' | 'fan'; 
    equipoId?: string;
    nombre?: string;
}

interface Forma21 extends DocumentData { 
    id: string; 
    delegadoId: string; 
    nombreEquipo: string; 
    nombreDelegado?: string; 
    fechaRegistro: { seconds: number }; 
    rosterCompleto?: boolean; 
    delegadoEmail?: string; 
    aprobado?: boolean; 
    logoUrl?: string; 
}

function App() {
  const [user, setUser] = useState<UsuarioData | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [formas21, setFormas21] = useState<Forma21[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [liveMatches, setLiveMatches] = useState<any[]>([]);

  // Vistas
  const [viewRosterId, setViewRosterId] = useState<string | null>(null); 
  const [matchView, setMatchView] = useState(false); 
  const [adminFormView, setAdminFormView] = useState(false); 
  const [usersView, setUsersView] = useState(false); 
  const [registroView, setRegistroView] = useState(false); 
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null); 
  const [calendarView, setCalendarView] = useState(false); 
  const [mesaTecnicaView, setMesaTecnicaView] = useState(false); 
  const [statsView, setStatsView] = useState(false); 
  const [standingsView, setStandingsView] = useState(false); 
  const [selectForma5MatchId, setSelectForma5MatchId] = useState<string | null>(null); 
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null);
  const [newsAdminView, setNewsAdminView] = useState(false);
  const [newsFeedView, setNewsFeedView] = useState(false);
  const [adminEquiposView, setAdminEquiposView] = useState(false);
  const [showBracket, setShowBracket] = useState(false); 
  
  const [dataRefreshKey, setDataRefreshKey] = useState(0); 
  
  const initialLoadDone = useRef(false);

  const refreshData = () => { setDataRefreshKey(prev => prev + 1); closeAllViews(); };

  const closeAllViews = () => {
    setViewRosterId(null); setMatchView(false); setAdminFormView(false); setUsersView(false); setRegistroView(false);
    setSelectedFormId(null); setCalendarView(false); setMesaTecnicaView(false); setStatsView(false); setStandingsView(false); setSelectForma5MatchId(null);
    setLiveMatchId(null); setDetailMatchId(null); setNewsAdminView(false); setNewsFeedView(false); setAdminEquiposView(false); setShowBracket(false);
  };
  
  // Notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
  }, []);

  const sendNotification = (title: string, body: string, icon = 'https://cdn-icons-png.flaticon.com/512/33/33308.png') => {
      if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(title, { body, icon, tag: title.replace(/\s/g, '_') });
          } catch (e) {
              console.log("Error push:", e);
          }
      }
  };

  // Detector Cambios
  useEffect(() => {
      const qMatches = query(collection(db, 'calendario')); 
      const unsubMatches = onSnapshot(qMatches, (snap) => {
          const lives = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.estatus === 'vivo');
          setLiveMatches(lives);

          if (initialLoadDone.current) {
              snap.docChanges().forEach((change) => {
                  const data = change.doc.data();
                  if (change.type === 'modified' && data.estatus === 'vivo') {
                      sendNotification("🏀 ¡PARTIDO EN VIVO!", `${data.equipoLocalNombre} vs ${data.equipoVisitanteNombre} ha comenzado.`);
                  }
              });
          }
      });

      const qNews = query(collection(db, 'noticias'), orderBy('fecha', 'desc'), limit(1));
      const unsubNews = onSnapshot(qNews, (snap) => {
          if (initialLoadDone.current) {
             snap.docChanges().forEach((change) => {
                 if (change.type === 'added') {
                     const data = change.doc.data();
                     sendNotification("📢 Nueva Noticia", data.titulo || "Información importante.");
                 }
             });
          }
      });

      setTimeout(() => { initialLoadDone.current = true; }, 2000);
      return () => { unsubMatches(); unsubNews(); };
  }, []);
  
  // Auth
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        const unsubProfile = onSnapshot(doc(db, 'usuarios', u.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUser({ 
                    uid: u.uid, 
                    email: u.email, 
                    rol: data.rol || 'pendiente', 
                    equipoId: data.equipoId,
                    nombre: data.nombre 
                });
            } else { setUser({ uid: u.uid, email: u.email, rol: 'pendiente' }); }
            setLoading(false);
        });
        return () => unsubProfile();
      } else { setUser(null); setLoading(false); }
    });
    return () => unsubAuth();
  }, []);

  // Carga Datos
  useEffect(() => {
    if (!user || user.rol === 'pendiente') return;
    const loadData = async () => {
        try {
            const eqSnap = await getDocs(collection(db, "equipos"));
            setEquipos(eqSnap.docs.map(d => {
                const data = d.data();
                return { id: d.id, ...data, puntos: Number(data.puntos || 0) } as Equipo;
            }));

            let q;
            if (user.rol === 'admin') q = query(collection(db, 'forma21s')); 
            else if (user.rol === 'delegado') q = query(collection(db, 'forma21s'), where('delegadoId', '==', user.uid)); 
            else q = query(collection(db, 'forma21s')); 

            const fSnap = await getDocs(q);
            const formasProcesadas = await Promise.all(fSnap.docs.map(async d => {
                const jugSnap = await getDocs(collection(db, 'forma21s', d.id, 'jugadores'));
                return { id: d.id, ...d.data(), rosterCompleto: jugSnap.size >= 5 } as Forma21;
            }));
            setFormas21(formasProcesadas);
        } catch(e) { console.error("Error:", e); }
    };
    loadData();
  }, [user, dataRefreshKey]);

  // --- ACCIONES DE REGISTRO ---

  // 1. REGISTRO JUGADOR / FAN (PIDE NOMBRE DE UNA VEZ)
  const handleRoleSelect = async (rol: 'jugador' | 'fan') => {
      if (!user) return;
      
      const mensaje = rol === 'jugador' 
          ? "⛹️ Para las estadísticas, ingresa tu Nombre y Apellido:" 
          : "🏀 ¡Hola Fan! ¿Cómo te llamas?";
          
      const nombreIngresado = prompt(mensaje);

      if (!nombreIngresado || nombreIngresado.trim() === "") return;

      try {
          await updateDoc(doc(db, 'usuarios', user.uid), { 
              rol: rol,
              nombre: nombreIngresado.trim() 
          });
      } catch (error) {
          console.error("Error asignando rol:", error);
          alert("Error al asignar rol.");
      }
  };

  // 2. REGISTRO DELEGADO (YA PIDE DATOS EN EL FORMULARIO)
  const handleDelegadoSuccess = async () => {
      if (!user) return;
      try { 
          await updateDoc(doc(db, 'usuarios', user.uid), { rol: 'delegado' }); 
          window.location.reload(); 
      } catch (e) { console.error(e); }
  };

  // 3. EDITAR NOMBRE (SI SE EQUIVOCÓ O ES VIEJO)
  const handleEditName = async () => {
      if (!user) return;
      const nuevoNombre = prompt("Ingresa tu nombre para mostrar en el panel:", user.nombre || "");
      if (nuevoNombre && nuevoNombre.trim() !== "") {
          try { await updateDoc(doc(db, 'usuarios', user.uid), { nombre: nuevoNombre.trim() }); } catch (error) { alert("No se pudo actualizar el nombre."); }
      }
  };

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Cargando...</div>;
  if (!user) return <Login />;
  
  if (user.rol === 'pendiente') {
      return (
        <div className="login-wrapper">
            {registroView ? (
                <RegistroForma21 onSuccess={handleDelegadoSuccess} onClose={() => setRegistroView(false)} />
            ) : (
                <div className="login-box" style={{textAlign:'center', maxWidth:'450px'}}>
                    <h2 style={{color:'#1f2937', marginBottom:'10px'}}>👋 Bienvenido</h2>
                    <p style={{color:'#666', marginBottom:'25px'}}>Selecciona cómo deseas participar:</p>
                    <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                        <button onClick={() => setRegistroView(true)} className="btn btn-primary" style={{padding:'15px', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>📋 Registrar Delegado (Crear Equipo)</button>
                        <button onClick={() => handleRoleSelect('jugador')} className="btn" style={{padding:'15px', fontSize:'1.1rem', background:'#10b981', color:'white', border:'none', borderRadius:'6px', cursor:'pointer'}}>⛹️ Registrar Jugador</button>
                        <button onClick={() => handleRoleSelect('fan')} className="btn btn-secondary" style={{padding:'15px', fontSize:'1.1rem'}}>🏀 Registrar Fan</button>
                    </div>
                    <div style={{marginTop:'30px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                        <button onClick={()=>signOut(auth)} style={{background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'#999'}}>Cerrar Sesión</button>
                    </div>
                </div>
            )}
        </div>
      );
  }

  const isDashboard = !(viewRosterId || matchView || adminFormView || usersView || registroView || selectedFormId || calendarView || mesaTecnicaView || statsView || standingsView || selectForma5MatchId || liveMatchId || detailMatchId || newsAdminView || newsFeedView || adminEquiposView || showBracket);

  const DashboardCard = ({ title, icon, color, onClick, variant = 'normal' }: any) => (
    <div onClick={onClick} className="dashboard-card" style={{
        borderLeft: variant === 'admin' ? '4px solid #f59e0b' : `4px solid ${color}`,
        background: 'white',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '20px', borderRadius: '12px', cursor: 'pointer', transition: 'transform 0.2s',
        height: '140px'
    }}>
        <div style={{fontSize: '2.5rem', marginBottom: '10px'}}>{icon}</div>
        <div style={{fontWeight: 'bold', color: '#374151', fontSize: '0.95rem'}}>{title}</div>
    </div>
  );

  // --- LÓGICA INTELIGENTE DE NOMBRES ---
  let displayName = user.nombre; 
  let displayTeamName = '';
  let displayTeamLogo = '';

  // 1. Si NO tiene nombre en perfil y es DELEGADO, buscamos en su Forma21
  if (!displayName && user.rol === 'delegado') {
      const f21 = formas21.find(f => f.delegadoId === user.uid);
      if (f21 && f21.nombreDelegado) {
          displayName = f21.nombreDelegado; 
      }
  }

  // Si después de buscar sigue vacío, usamos el email
  if (!displayName) {
      displayName = user.email?.split('@')[0] || 'Usuario';
  }

  // Lógica de Equipos
  if (user.equipoId) {
      const eq = equipos.find(e => e.id === user.equipoId);
      if (eq) { displayTeamName = eq.nombre; displayTeamLogo = eq.logoUrl || ''; }
  } else if (user.rol === 'delegado') {
      const f21 = formas21.find(f => f.delegadoId === user.uid);
      if (f21) { displayTeamName = f21.nombreEquipo; displayTeamLogo = f21.logoUrl || ''; }
  }

  return (
    <div className="app-container" style={{
        backgroundImage: 'url(https://i.postimg.cc/wMdsqw2D/unnamed.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh'
    }}>
      <header className="header" style={{background: 'white', padding: '10px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <img src="https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg" alt="Liga Madera 15" style={{height: '50px', width: 'auto', borderRadius:'4px'}} />
            <h1 style={{fontSize: '1.2rem', margin: 0, color: '#1f2937', fontWeight: '800'}}>LIGA MADERA 15</h1>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <InstallButton />
            <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)', background: '#eff6ff', padding: '4px 10px', borderRadius: '20px'}}>{user.rol.toUpperCase()}</span>
            <button onClick={()=>signOut(auth)} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}} title="Salir">🚪</button>
        </div>
      </header>
      
      <main className="main-content" style={{padding: '20px', maxWidth: '1200px', margin: '0 auto'}}>
        
        {newsFeedView && <NewsFeed onClose={() => setNewsFeedView(false)} />}
        {liveMatchId && <LiveGameViewer matchId={liveMatchId} onClose={() => setLiveMatchId(null)} />}
        {detailMatchId && <MatchDetailViewer matchId={detailMatchId} onClose={() => setDetailMatchId(null)} rol={user.rol} />}
        {calendarView && <CalendarViewer rol={user.rol} onClose={() => setCalendarView(false)} onViewLive={(id) => { setCalendarView(false); setLiveMatchId(id); }} onViewDetail={(id) => { setCalendarView(false); setDetailMatchId(id); }} />}
        {statsView && <StatsViewer onClose={() => setStatsView(false)} />}
        {standingsView && <StandingsViewer equipos={equipos} onClose={() => setStandingsView(false)} />}
        {newsAdminView && <NewsAdmin onClose={() => setNewsAdminView(false)} />}
        {adminEquiposView && <AdminEquipos onClose={() => setAdminEquiposView(false)} />}
        {viewRosterId && <RosterViewer forma21Id={viewRosterId} nombreEquipo={formas21.find(f=>f.id===viewRosterId)?.nombreEquipo || 'Equipo'} onClose={() => setViewRosterId(null)} adminMode={user.rol === 'admin'} />}
        {matchView && <MatchForm onSuccess={() => {setMatchView(false); refreshData();}} onClose={() => setMatchView(false)} />}
        {adminFormView && <Forma21AdminViewer onClose={() => setAdminFormView(false)} setViewRosterId={setViewRosterId} />}
        {usersView && <UserManagement onClose={() => setUsersView(false)} />}
        {registroView && <RegistroForma21 onSuccess={refreshData} onClose={() => setRegistroView(false)} />}
        {selectedFormId && <RosterForm forma21Id={selectedFormId} nombreEquipo={formas21.find(f=>f.id===selectedFormId)?.nombreEquipo || 'Equipo'} onSuccess={() => {setSelectedFormId(null); refreshData();}} onClose={() => setSelectedFormId(null)} />}
        {selectForma5MatchId && <Forma5Selector calendarioId={selectForma5MatchId} equipoId={user.equipoId || user.uid} onSuccess={() => { setSelectForma5MatchId(null); refreshData(); }} onClose={() => setSelectForma5MatchId(null)} />}
        {mesaTecnicaView && <MesaTecnica onClose={() => setMesaTecnicaView(false)} onMatchFinalized={refreshData} />}
        {showBracket && <PlayoffBracket adminMode={user.rol === 'admin'} onClose={() => setShowBracket(false)} />}

        {isDashboard && (
            <div className="animate-fade-in">
                
                {/* TARJETA DE BIENVENIDA */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
                    borderRadius: '16px', padding: '25px', color: 'white', marginBottom: '30px', 
                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <h2 style={{margin: '0', fontSize: '1.8rem', fontWeight:'800'}}>Hola, {displayName} 👋</h2>
                            <button onClick={handleEditName} title="Corregir nombre" style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', cursor:'pointer', width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>✏️</button>
                        </div>
                        <p style={{margin: '5px 0 0 0', opacity: 0.9, fontSize:'0.95rem', textTransform:'capitalize'}}>Rol: {user.rol}</p>
                    </div>

                    {displayTeamName && (
                         <div style={{textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                            {displayTeamLogo ? (
                                <img src={displayTeamLogo} alt={displayTeamName} style={{width:'55px', height:'55px', borderRadius:'50%', border:'3px solid rgba(255,255,255,0.8)', objectFit:'cover', marginBottom:'5px', background:'white'}} />
                            ) : (
                                <div style={{width:'55px', height:'55px', borderRadius:'50%', border:'3px solid rgba(255,255,255,0.8)', marginBottom:'5px', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem'}}>🛡️</div>
                            )}
                             <div style={{fontWeight:'bold', fontSize:'1rem'}}>{displayTeamName}</div>
                             <div style={{fontSize:'0.75rem', opacity:0.8}}>Mi Equipo</div>
                         </div>
                    )}
                </div>

                {liveMatches.length > 0 && (
                    <div style={{marginBottom:'30px'}}>
                        <h3 style={{color:'white', marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px', animation:'pulse 2s infinite', textShadow:'0 2px 4px rgba(0,0,0,0.5)'}}>🔴 EN VIVO AHORA</h3>
                        <div style={{display:'grid', gap:'15px'}}>
                            {liveMatches.map((m: any) => (
                                <div key={m.id} onClick={() => setLiveMatchId(m.id)} style={{background: 'linear-gradient(135deg, #111 0%, #222 100%)', borderRadius: '12px', padding: '20px', cursor: 'pointer', border: '2px solid #ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)', color: 'white', display:'flex', flexDirection:'column', alignItems:'center'}}>
                                    <div style={{fontSize:'0.9rem', color:'#fbbf24', fontWeight:'bold', marginBottom:'10px'}}>{m.cancha ? `📍 ${m.cancha}` : '🔥 PARTIDO EN CURSO'}</div>
                                    <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center', marginBottom:'15px'}}>
                                        <div style={{textAlign:'center', flex:1}}><div style={{fontWeight:'bold', fontSize:'1.2rem'}}>{m.equipoLocalNombre}</div><div style={{fontSize:'2.5rem', fontWeight:'bold', lineHeight:1}}>{m.marcadorLocal}</div></div>
                                        <div style={{fontWeight:'bold', color:'#666', fontSize:'1.2rem'}}>VS</div>
                                        <div style={{textAlign:'center', flex:1}}><div style={{fontWeight:'bold', fontSize:'1.2rem'}}>{m.equipoVisitanteNombre}</div><div style={{fontSize:'2.5rem', fontWeight:'bold', lineHeight:1}}>{m.marcadorVisitante}</div></div>
                                    </div>
                                    <button className="btn" style={{background:'#ef4444', color:'white', width:'100%', fontWeight:'bold', padding:'12px', borderRadius:'8px', textTransform:'uppercase'}}>📺 Ver Transmisión Play-by-Play</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <h3 style={{fontSize: '1.1rem', color: 'white', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', textShadow:'0 2px 4px rgba(0,0,0,0.5)'}}>Zona de Torneo</h3>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px', marginBottom: '40px'}}>
                    <DashboardCard title="Noticias" icon="📢" color="#ef4444" onClick={()=>setNewsFeedView(true)} />
                    <DashboardCard title="Calendario" icon="📅" color="#3b82f6" onClick={()=>setCalendarView(true)} />
                    <DashboardCard title="Tabla General" icon="🏆" color="#eab308" onClick={()=>setStandingsView(true)} />
                    <DashboardCard title="Líderes" icon="📊" color="#10b981" onClick={()=>setStatsView(true)} />
                    <DashboardCard title="Fase Final" icon="⚔️" color="#7c3aed" onClick={()=>setShowBracket(true)} />
                </div>

                {user.rol === 'delegado' && (
                    <div style={{marginBottom: '40px'}}>
                        <h3 style={{fontSize: '1.1rem', color: 'white', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', textShadow:'0 2px 4px rgba(0,0,0,0.5)'}}>Mi Equipo</h3>
                        <DelegadoDashboard 
                            formas21={formas21} 
                            userUid={user.uid} 
                            userEquipoId={user.equipoId || user.uid} 
                            refreshData={refreshData} 
                            setViewRosterId={setViewRosterId} 
                            setSelectedFormId={setSelectedFormId} 
                            setSelectForma5MatchId={setSelectForma5MatchId} 
                            onRegister={() => setRegistroView(true)} 
                        />
                    </div>
                )}

                {user.rol === 'jugador' && (
                    <div style={{marginTop:'30px'}}>
                        <JugadorDashboard userEquipoId={user.equipoId||null} userName={user.email} formas21={formas21} setViewRosterId={setViewRosterId} />
                    </div>
                )}

                {user.rol === 'admin' && (
                    <div>
                        <h3 style={{fontSize: '1.1rem', color: 'white', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', textShadow:'0 2px 4px rgba(0,0,0,0.5)'}}>Panel Administrativo</h3>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px'}}>
                            <DashboardCard title="Inscripciones" icon="📋" variant="admin" onClick={()=>setAdminFormView(true)} />
                            <DashboardCard title="Mesa Técnica" icon="🏀" variant="admin" onClick={()=>setMesaTecnicaView(true)} />
                            <DashboardCard title="Publicar Info" icon="✍️" variant="admin" onClick={()=>setNewsAdminView(true)} />
                            <DashboardCard title="Gestionar Logos" icon="🛡️" variant="admin" onClick={()=>setAdminEquiposView(true)} />
                            <DashboardCard title="Usuarios" icon="👥" variant="admin" onClick={()=>setUsersView(true)} />
                            <DashboardCard title="Marcador Manual" icon="🖊️" variant="admin" onClick={()=>setMatchView(true)} />
                            <DashboardCard title="Gestionar Playoffs" icon="⚙️" variant="admin" onClick={()=>setShowBracket(true)} />
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
}
export default App;