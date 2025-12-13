import { useEffect, useState } from 'react';
import './App.css'; 
import { db, auth } from './firebase'; 
import { collection, getDocs, doc, onSnapshot, query, where } from 'firebase/firestore'; 
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

// Interfaces
interface Equipo { id: string; nombre: string; victorias: number; derrotas: number; puntos_favor: number; puntos_contra?: number; puntos?: number; logoUrl?: string; }
interface UsuarioData extends DocumentData { uid: string; email: string | null; rol: 'admin' | 'delegado' | 'pendiente' | 'jugador' | 'fan'; equipoId?: string; }
interface Forma21 extends DocumentData { id: string; delegadoId: string; nombreEquipo: string; fechaRegistro: { seconds: number }; rosterCompleto?: boolean; delegadoEmail?: string; aprobado?: boolean; logoUrl?: string; }

function App() {
  const [user, setUser] = useState<UsuarioData | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [formas21, setFormas21] = useState<Forma21[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Vistas (Toggle states)
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
  
  const [dataRefreshKey, setDataRefreshKey] = useState(0); 

  const refreshData = () => { setDataRefreshKey(prev => prev + 1); closeAllViews(); };

  const closeAllViews = () => {
    setViewRosterId(null); setMatchView(false); setAdminFormView(false); setUsersView(false); setRegistroView(false);
    setSelectedFormId(null); setCalendarView(false); setMesaTecnicaView(false); setStatsView(false); setStandingsView(false); setSelectForma5MatchId(null);
    setLiveMatchId(null); setDetailMatchId(null); setNewsAdminView(false); setNewsFeedView(false);
  };
  
  // 1. Autenticación
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        const unsubProfile = onSnapshot(doc(db, 'usuarios', u.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUser({ uid: u.uid, email: u.email, rol: data.rol || 'pendiente', equipoId: data.equipoId });
            } else { setUser({ uid: u.uid, email: u.email, rol: 'pendiente' }); }
            setLoading(false);
        });
        return () => unsubProfile();
      } else { setUser(null); setLoading(false); }
    });
    return () => unsubAuth();
  }, []);

  // 2. Carga de Datos (Equipos, Formas)
  useEffect(() => {
    if (!user || user.rol === 'pendiente') return;
    const loadData = async () => {
        try {
            const eqSnap = await getDocs(collection(db, "equipos"));
            setEquipos(eqSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipo)));

            let q;
            if (user.rol === 'admin') q = query(collection(db, 'forma21s')); 
            else if (user.rol === 'delegado') q = query(collection(db, 'forma21s'), where('delegadoId', '==', user.uid)); 
            else q = query(collection(db, 'forma21s')); 

            const fSnap = await getDocs(q);
            const formasProcesadas = await Promise.all(fSnap.docs.map(async d => {
                const jugSnap = await getDocs(collection(db, 'forma21s', d.id, 'jugadores'));
                return { id: d.id, ...d.data(), rosterCompleto: jugSnap.size >= 10 } as Forma21;
            }));
            setFormas21(formasProcesadas);
        } catch(e) { console.error("Error:", e); }
    };
    loadData();
  }, [user, dataRefreshKey]);

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Cargando...</div>;
  if (!user) return <Login />;
  
  if (user.rol === 'pendiente') return (
    <div className="login-wrapper"><div className="login-box"><h2>⏳ Cuenta en Revisión</h2><p>Tu solicitud está siendo procesada.</p><button onClick={()=>signOut(auth)} className="btn">Cerrar Sesión</button></div></div>
  );

  const isDashboard = !(viewRosterId || matchView || adminFormView || usersView || registroView || selectedFormId || calendarView || mesaTecnicaView || statsView || standingsView || selectForma5MatchId || liveMatchId || detailMatchId || newsAdminView || newsFeedView);

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

  return (
    <div className="app-container" style={{backgroundColor: '#f3f4f6', minHeight: '100vh'}}>
      
      {/* HEADER */}
      <header className="header" style={{
          background: 'white', padding: '10px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <img 
                src="https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg" 
                alt="Liga Madera 15" 
                style={{height: '50px', width: 'auto', borderRadius:'4px'}} 
            />
            <h1 style={{fontSize: '1.2rem', margin: 0, color: '#1f2937', fontWeight: '800'}}>LIGA MADERA 15</h1>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)', background: '#eff6ff', padding: '4px 10px', borderRadius: '20px'}}>
                {user.rol.toUpperCase()}
            </span>
            <button onClick={()=>signOut(auth)} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem'}} title="Salir">🚪</button>
        </div>
      </header>
      
      <main className="main-content" style={{padding: '20px', maxWidth: '1200px', margin: '0 auto'}}>
        
        {/* RENDERIZADO DE VISTAS (MODALES Y PANTALLAS COMPLETAS) */}
        
        {/* Noticias */}
        {newsFeedView && <NewsFeed onClose={() => setNewsFeedView(false)} />}
        
        {/* Partido en Vivo (Visor Público) */}
        {liveMatchId && <LiveGameViewer matchId={liveMatchId} onClose={() => setLiveMatchId(null)} />}
        
        {/* Detalle del Partido (Stats Finales) - AQUÍ ESTÁ LA MODIFICACIÓN CLAVE: rol={user.rol} */}
        {detailMatchId && <MatchDetailViewer matchId={detailMatchId} onClose={() => setDetailMatchId(null)} rol={user.rol} />}
        
        {/* Calendario */}
        {calendarView && <CalendarViewer rol={user.rol} userEquipoId={user.equipoId || null} onClose={() => setCalendarView(false)} onViewLive={(id) => { setCalendarView(false); setLiveMatchId(id); }} onViewDetail={(id) => { setCalendarView(false); setDetailMatchId(id); }} />}
        
        {/* Estadísticas Generales */}
        {statsView && <StatsViewer onClose={() => setStatsView(false)} />}
        
        {/* Tabla de Posiciones */}
        {standingsView && <StandingsViewer equipos={equipos} onClose={() => setStandingsView(false)} />}
        
        {/* Admin: Noticias */}
        {newsAdminView && <NewsAdmin onClose={() => setNewsAdminView(false)} />}
        
        {/* Visor Roster */}
        {viewRosterId && <RosterViewer forma21Id={viewRosterId} nombreEquipo={formas21.find(f=>f.id===viewRosterId)?.nombreEquipo || 'Equipo'} onClose={() => setViewRosterId(null)} />}
        
        {/* Admin: Marcador Manual */}
        {matchView && <MatchForm onSuccess={() => {setMatchView(false); refreshData();}} onClose={() => setMatchView(false)} />}
        
        {/* Admin: Inscripciones */}
        {adminFormView && <Forma21AdminViewer onClose={() => setAdminFormView(false)} setViewRosterId={setViewRosterId} />}
        
        {/* Admin: Usuarios */}
        {usersView && <UserManagement onClose={() => setUsersView(false)} />}
        
        {/* Delegado: Registro Equipo */}
        {registroView && <RegistroForma21 onSuccess={refreshData} onClose={() => setRegistroView(false)} />}
        
        {/* Delegado: Editar Forma 21 */}
        {selectedFormId && <RosterForm forma21Id={selectedFormId} nombreEquipo={formas21.find(f=>f.id===selectedFormId)?.nombreEquipo || 'Equipo'} onSuccess={() => {setSelectedFormId(null); refreshData();}} onClose={() => setSelectedFormId(null)} />}
        
        {/* Delegado: Selección Forma 5 */}
        {selectForma5MatchId && <Forma5Selector calendarioId={selectForma5MatchId} equipoId={user.equipoId || ''} onSuccess={() => { setSelectForma5MatchId(null); refreshData(); }} onClose={() => setSelectForma5MatchId(null)} />}
        
        {/* Admin: Mesa Técnica */}
        {mesaTecnicaView && <MesaTecnica onClose={() => setMesaTecnicaView(false)} onMatchFinalized={refreshData} />}

        {/* --- DASHBOARD PRINCIPAL --- */}
        {isDashboard && (
            <div className="animate-fade-in">
                
                {/* HERO SECTION */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                    borderRadius: '16px', padding: '30px', color: 'white', marginBottom: '40px',
                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
                }}>
                    <h2 style={{margin: '0 0 10px 0', fontSize: '1.8rem'}}>Hola, {user.email?.split('@')[0]} 👋</h2>
                    <p style={{margin: 0, opacity: 0.9}}>Bienvenido al panel de control de la Liga Madera 15.</p>
                </div>

                {/* ZONA DE TORNEO (PÚBLICA) */}
                <h3 style={{fontSize: '1.1rem', color: '#6b7280', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Zona de Torneo</h3>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px', marginBottom: '40px'}}>
                    <DashboardCard title="Noticias" icon="📢" color="#ef4444" onClick={()=>setNewsFeedView(true)} />
                    <DashboardCard title="Calendario" icon="📅" color="#3b82f6" onClick={()=>setCalendarView(true)} />
                    <DashboardCard title="Tabla General" icon="🏆" color="#eab308" onClick={()=>setStandingsView(true)} />
                    <DashboardCard title="Líderes" icon="📊" color="#10b981" onClick={()=>setStatsView(true)} />
                </div>

                {/* DASHBOARD DELEGADO */}
                {user.rol === 'delegado' && (
                    <div style={{marginBottom: '40px'}}>
                        <h3 style={{fontSize: '1.1rem', color: '#6b7280', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Mi Equipo</h3>
                        <DelegadoDashboard 
                            formas21={formas21} 
                            userUid={user.uid} 
                            userEquipoId={user.equipoId||null} 
                            refreshData={refreshData} 
                            setViewRosterId={setViewRosterId} 
                            setSelectedFormId={setSelectedFormId} 
                            setSelectForma5MatchId={setSelectForma5MatchId} 
                            onRegister={() => setRegistroView(true)} 
                        />
                    </div>
                )}

                {/* DASHBOARD JUGADOR */}
                {user.rol === 'jugador' && (
                    <div style={{marginTop:'30px'}}>
                        <JugadorDashboard 
                            userEquipoId={user.equipoId||null} 
                            userName={user.email} 
                            formas21={formas21} 
                            setViewRosterId={setViewRosterId} 
                        />
                    </div>
                )}

                {/* DASHBOARD ADMIN */}
                {user.rol === 'admin' && (
                    <div>
                        <h3 style={{fontSize: '1.1rem', color: '#6b7280', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Panel Administrativo</h3>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px'}}>
                            <DashboardCard title="Inscripciones" icon="📋" variant="admin" onClick={()=>setAdminFormView(true)} />
                            <DashboardCard title="Mesa Técnica" icon="🏀" variant="admin" onClick={()=>setMesaTecnicaView(true)} />
                            <DashboardCard title="Publicar Info" icon="✍️" variant="admin" onClick={()=>setNewsAdminView(true)} />
                            <DashboardCard title="Usuarios" icon="👥" variant="admin" onClick={()=>setUsersView(true)} />
                            <DashboardCard title="Marcador Manual" icon="🖊️" variant="admin" onClick={()=>setMatchView(true)} />
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