import { useEffect, useState } from 'react';
import './App.css'; 
import { db, auth } from './firebase'; 
import { collection, getDocs, doc, onSnapshot, query, where } from 'firebase/firestore'; 
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import type { DocumentData } from 'firebase/firestore'; 

// Importaciones de tus componentes (asegúrate de que los archivos existan)
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

// Interfaces Globales
interface Equipo { id: string; nombre: string; victorias: number; derrotas: number; puntos_favor: number; puntos_contra?: number; puntos?: number; logoUrl?: string; }
interface UsuarioData extends DocumentData { uid: string; email: string | null; rol: 'admin' | 'delegado' | 'pendiente' | 'jugador' | 'fan'; equipoId?: string; }
interface Forma21 extends DocumentData { id: string; delegadoId: string; nombreEquipo: string; fechaRegistro: { seconds: number }; rosterCompleto?: boolean; delegadoEmail?: string; aprobado?: boolean; logoUrl?: string; }

function App() {
  const [user, setUser] = useState<UsuarioData | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [formas21, setFormas21] = useState<Forma21[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // ESTADOS DE NAVEGACIÓN (Vistas)
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
  
  // AUTENTICACIÓN
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Escuchar cambios en el perfil del usuario en tiempo real
        const unsubProfile = onSnapshot(doc(db, 'usuarios', u.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUser({ uid: u.uid, email: u.email, rol: data.rol || 'pendiente', equipoId: data.equipoId });
            } else { setUser({ uid: u.uid, email: u.email, rol: 'pendiente' }); }
            setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setUser(null); setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  // CARGA DE DATOS (Centralizada)
  useEffect(() => {
    if (!user || user.rol === 'pendiente') return;

    const loadData = async () => {
        try {
            // 1. Cargar Tabla de Posiciones (Público)
            const eqSnap = await getDocs(collection(db, "equipos"));
            setEquipos(eqSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipo)));

            // 2. Cargar Formas 21 (Según el Rol)
            let q;
            if (user.rol === 'admin') {
                q = query(collection(db, 'forma21s')); // Admin ve todo
            } else if (user.rol === 'delegado') {
                q = query(collection(db, 'forma21s'), where('delegadoId', '==', user.uid)); // Delegado ve lo suyo
            } else {
                q = query(collection(db, 'forma21s')); // Jugadores/Fans ven todo (limitado visualmente luego)
            }

            const fSnap = await getDocs(q);
            // Procesamos para saber si el roster está completo (>=10 jugadores)
            const formasProcesadas = await Promise.all(fSnap.docs.map(async d => {
                const jugSnap = await getDocs(collection(db, 'forma21s', d.id, 'jugadores'));
                return { 
                    id: d.id, 
                    ...d.data(), 
                    rosterCompleto: jugSnap.size >= 10 
                } as Forma21;
            }));
            setFormas21(formasProcesadas);

        } catch(e) {
            console.error("Error cargando datos:", e);
        }
    };
    loadData();
  }, [user, dataRefreshKey]);

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Cargando sistema...</div>;
  if (!user) return <Login />;
  
  if (user.rol === 'pendiente') return (
    <div className="login-wrapper"><div className="login-box"><h2>⏳ Esperando Activación</h2><p>Tu cuenta está pendiente.</p><button onClick={()=>signOut(auth)} className="btn">Salir</button></div></div>
  );

  const isDashboard = !(viewRosterId || matchView || adminFormView || usersView || registroView || selectedFormId || calendarView || mesaTecnicaView || statsView || standingsView || selectForma5MatchId || liveMatchId || detailMatchId || newsAdminView || newsFeedView);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-section"><h1>LIGA MADERA 15</h1></div>
        <div className="user-info-container">
            <span>{user.rol.toUpperCase()}</span>
            <button onClick={()=>signOut(auth)} className="btn btn-logout">Salir</button>
        </div>
      </header>
      
      <main className="main-content">
        {/* RENDERIZADO DE VISTAS SEGÚN ESTADO */}
        {newsFeedView && <NewsFeed onClose={() => setNewsFeedView(false)} />}
        {liveMatchId && <LiveGameViewer matchId={liveMatchId} onClose={() => setLiveMatchId(null)} />}
        {detailMatchId && <MatchDetailViewer matchId={detailMatchId} onClose={() => setDetailMatchId(null)} />}
        {calendarView && <CalendarViewer rol={user.rol} userEquipoId={user.equipoId || null} onClose={() => setCalendarView(false)} onViewLive={(id) => { setCalendarView(false); setLiveMatchId(id); }} onViewDetail={(id) => { setCalendarView(false); setDetailMatchId(id); }} />}
        {statsView && <StatsViewer onClose={() => setStatsView(false)} />}
        {standingsView && <StandingsViewer equipos={equipos} onClose={() => setStandingsView(false)} />}
        {newsAdminView && <NewsAdmin onClose={() => setNewsAdminView(false)} />}
        {viewRosterId && <RosterViewer forma21Id={viewRosterId} nombreEquipo={formas21.find(f=>f.id===viewRosterId)?.nombreEquipo || 'Equipo'} onClose={() => setViewRosterId(null)} />}
        {matchView && <MatchForm onSuccess={() => {setMatchView(false); refreshData();}} onClose={() => setMatchView(false)} />}
        {adminFormView && <Forma21AdminViewer onClose={() => setAdminFormView(false)} setViewRosterId={setViewRosterId} />}
        {usersView && <UserManagement onClose={() => setUsersView(false)} />}
        {registroView && <RegistroForma21 onSuccess={refreshData} onClose={() => setRegistroView(false)} />}
        {selectedFormId && <RosterForm forma21Id={selectedFormId} nombreEquipo={formas21.find(f=>f.id===selectedFormId)?.nombreEquipo || 'Equipo'} onSuccess={() => {setSelectedFormId(null); refreshData();}} onClose={() => setSelectedFormId(null)} />}
        {selectForma5MatchId && <Forma5Selector calendarioId={selectForma5MatchId} equipoId={user.equipoId || ''} onSuccess={() => { setSelectForma5MatchId(null); refreshData(); }} onClose={() => setSelectForma5MatchId(null)} />}
        {mesaTecnicaView && <MesaTecnica onClose={() => setMesaTecnicaView(false)} onMatchFinalized={refreshData} />}

        {isDashboard && (
            <div className="animate-fade-in">
                {/* DASHBOARD GENERAL (PARA TODOS) */}
                <h3 className="section-title">Torneo</h3>
                <div className="dashboard-grid">
                    <div className="dashboard-card" onClick={()=>setCalendarView(true)}>📅 Calendario</div>
                    <div className="dashboard-card" onClick={()=>setStandingsView(true)}>🏆 Tabla General</div>
                    <div className="dashboard-card" onClick={()=>setStatsView(true)}>📊 Estadísticas</div>
                    <div className="dashboard-card" onClick={()=>setNewsFeedView(true)}>📢 Noticias</div>
                </div>

                {/* DASHBOARD DELEGADO */}
                {user.rol === 'delegado' && (
                    <div style={{marginTop:'30px'}}>
                        <h3 className="section-title">Mi Gestión</h3>
                        <DelegadoDashboard formas21={formas21} userUid={user.uid} userEquipoId={user.equipoId||null} refreshData={refreshData} setViewRosterId={setViewRosterId} setSelectedFormId={setSelectedFormId} setSelectForma5MatchId={setSelectForma5MatchId} onRegister={() => setRegistroView(true)} />
                    </div>
                )}

                {/* DASHBOARD JUGADOR */}
                {user.rol === 'jugador' && <div style={{marginTop:'30px'}}><JugadorDashboard userEquipoId={user.equipoId||null} userName={user.email} formas21={formas21} setViewRosterId={setViewRosterId} /></div>}

                {/* DASHBOARD ADMIN */}
                {user.rol === 'admin' && (
                    <div style={{marginTop:'30px'}}>
                        <h3 className="section-title">Administración</h3>
                        <div className="dashboard-grid">
                            <div className="dashboard-card admin" onClick={()=>setMesaTecnicaView(true)}>🏀 Mesa Técnica</div>
                            <div className="dashboard-card admin" onClick={()=>setNewsAdminView(true)}>✍️ Noticias</div>
                            <div className="dashboard-card admin" onClick={()=>setAdminFormView(true)}>📋 Inscripciones</div>
                            <div className="dashboard-card admin" onClick={()=>setUsersView(true)}>👥 Usuarios</div>
                            <div className="dashboard-card admin" onClick={()=>setMatchView(true)}>🖊️ Marcador Manual</div>
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