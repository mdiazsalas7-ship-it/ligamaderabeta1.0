import { useEffect, useState } from 'react';
import './App.css'; 
import { db, auth } from './firebase'; 
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore'; 
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import type { DocumentData } from 'firebase/firestore'; 

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

interface Equipo { id: string; nombre: string; victorias: number; derrotas: number; puntos_favor: number; puntos_contra?: number; puntos?: number; }
interface UsuarioData extends DocumentData { uid: string; email: string | null; rol: 'admin' | 'delegado' | 'pendiente' | 'jugador' | 'fan'; equipoId?: string; }
interface Forma21 extends DocumentData { id: string; delegadoId: string; nombreEquipo: string; fechaRegistro: { seconds: number }; rosterCompleto?: boolean; delegadoEmail?: string; aprobado?: boolean; }

function App() {
  const [user, setUser] = useState<UsuarioData | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [formas21, setFormas21] = useState<Forma21[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // NAVEGACIÓN
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
  
  const [dataRefreshKey, setDataRefreshKey] = useState(0); 

  const refreshData = () => { setDataRefreshKey(prev => prev + 1); closeAllViews(); };

  const closeAllViews = () => {
    setViewRosterId(null); setMatchView(false); setAdminFormView(false); setUsersView(false); setRegistroView(false);
    setSelectedFormId(null); setCalendarView(false); setMesaTecnicaView(false); setStatsView(false); setStandingsView(false); setSelectForma5MatchId(null);
    setLiveMatchId(null); setDetailMatchId(null);
  };
  
  const recalculateStandings = async () => { refreshData(); };
  
  // AUTH SNAPSHOT
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        if (unsubProfile) unsubProfile();
        unsubProfile = onSnapshot(doc(db, 'usuarios', u.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUser({ uid: u.uid, email: u.email, rol: data.rol || 'pendiente', equipoId: data.equipoId });
            } else { setUser({ uid: u.uid, email: u.email, rol: 'pendiente' }); }
            setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        unsubProfile = null; setUser(null); setLoading(false);
      }
    });
    return () => { unsubAuth(); if (unsubProfile) unsubProfile(); };
  }, []);

  useEffect(() => {
    if (!user || user.rol === 'pendiente') return;
    const load = async () => {
        try {
            const eqSnap = await getDocs(collection(db, "equipos"));
            setEquipos(eqSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));
            if (user.rol === 'admin' || user.rol === 'delegado') {
                const fSnap = await getDocs(collection(db, 'forma21s'));
                setFormas21(await Promise.all(fSnap.docs.map(async d => ({ id: d.id, ...d.data(), rosterCompleto: (await getDocs(collection(db, 'forma21s', d.id, 'jugadores'))).docs.length >= 10 } as Forma21))));
            }
        } catch(e) {}
    };
    load();
  }, [user, dataRefreshKey]);

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'var(--primary)'}}>Cargando...</div>;
  if (!user) return <Login />;
  
  if (user.rol === 'pendiente') return (
    <div className="login-wrapper"><div className="login-box"><h2>⏳ Solicitud en Proceso</h2><p>Estamos configurando tu perfil.</p><button onClick={()=>signOut(auth)} className="btn btn-secondary">Salir</button></div></div>
  );

  const currentEquipoName = formas21.find(f => f.id === selectedFormId || f.id === viewRosterId)?.nombreEquipo || 'Equipo';
  const isDashboard = !(viewRosterId || matchView || adminFormView || usersView || registroView || selectedFormId || calendarView || mesaTecnicaView || statsView || standingsView || selectForma5MatchId || liveMatchId || detailMatchId);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-section"><img src="https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg" alt="Logo" className="league-logo" /><h1>LIGA MADERA 15</h1></div>
        <div className="user-info-container"><span style={{fontSize:'0.8rem', fontWeight:'bold', color:'var(--primary)', marginRight:'10px'}}>{user.rol.toUpperCase()}</span><button onClick={()=>signOut(auth)} className="btn btn-logout">Salir</button></div>
      </header>
      
      <main className="main-content">
        {/* VISTAS MODALES */}
        {liveMatchId && <LiveGameViewer matchId={liveMatchId} onClose={() => setLiveMatchId(null)} />}
        {detailMatchId && <MatchDetailViewer matchId={detailMatchId} onClose={() => setDetailMatchId(null)} />}
        
        {/* CALENDARIO CON LA PROPIEDAD onViewDetail CONECTADA */}
        {calendarView && (
            <CalendarViewer 
                rol={user.rol} 
                userEquipoId={user.equipoId || null} 
                onClose={() => setCalendarView(false)} 
                onViewLive={(id) => { setCalendarView(false); setLiveMatchId(id); }} 
                onViewDetail={(id) => { setCalendarView(false); setDetailMatchId(id); }} // <--- ESTA ES LA CLAVE
            />
        )}
        
        {statsView && <StatsViewer onClose={() => setStatsView(false)} />}
        {standingsView && <StandingsViewer equipos={equipos} onClose={() => setStandingsView(false)} />}
        {viewRosterId && <RosterViewer forma21Id={viewRosterId} nombreEquipo={currentEquipoName} onClose={() => setViewRosterId(null)} />}
        {matchView && <MatchForm onSuccess={() => {setMatchView(false); refreshData();}} onClose={() => setMatchView(false)} />}
        {adminFormView && <Forma21AdminViewer onClose={() => setAdminFormView(false)} setViewRosterId={setViewRosterId} />}
        {usersView && <UserManagement onClose={() => setUsersView(false)} />}
        {registroView && <RegistroForma21 onSuccess={refreshData} onClose={() => setRegistroView(false)} />}
        {selectedFormId && <RosterForm forma21Id={selectedFormId} nombreEquipo={currentEquipoName} onSuccess={() => {setSelectedFormId(null); refreshData();}} onClose={() => setSelectedFormId(null)} />}
        {mesaTecnicaView && <MesaTecnica onClose={() => setMesaTecnicaView(false)} onMatchFinalized={recalculateStandings} />}
        {selectForma5MatchId && <Forma5Selector calendarioId={selectForma5MatchId} equipoId={user.equipoId || ''} onSuccess={() => { setSelectForma5MatchId(null); refreshData(); }} onClose={() => setSelectForma5MatchId(null)} />}

        {isDashboard && (
            <div className="animate-fade-in">
                <div className="card" style={{borderLeft:'5px solid var(--primary)', padding:'1.5rem', marginBottom:'25px'}}>
                    <h2 style={{marginTop:0, fontSize:'1.5rem', color:'var(--primary)'}}>Hola, {user.email?.split('@')[0]}</h2>
                    <p style={{color:'var(--text-muted)', marginBottom:0}}>{user.rol === 'fan' ? 'Zona de Fans' : 'Panel de Control'}</p>
                </div>

                <h3 style={{fontSize:'1rem', color:'var(--primary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px'}}>Torneo</h3>
                <div className="dashboard-grid">
                    <div className="dashboard-card" onClick={()=>setCalendarView(true)}><div className="card-icon">📅</div><div className="card-title">Calendario</div></div>
                    <div className="dashboard-card" onClick={()=>setStandingsView(true)}><div className="card-icon">🏆</div><div className="card-title">Tabla General</div></div>
                    <div className="dashboard-card" onClick={()=>setStatsView(true)}><div className="card-icon">📊</div><div className="card-title">Líderes</div></div>
                </div>

                {user.rol === 'delegado' && (
                    <div style={{marginTop:'30px'}}>
                        <h3 style={{fontSize:'1rem', color:'var(--primary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px'}}>Mi Equipo</h3>
                        <DelegadoDashboard formas21={formas21} userUid={user.uid} userEquipoId={user.equipoId||null} refreshData={refreshData} setViewRosterId={setViewRosterId} setSelectedFormId={setSelectedFormId} setSelectForma5MatchId={setSelectForma5MatchId} onRegister={() => setRegistroView(true)} />
                    </div>
                )}

                {user.rol === 'jugador' && <div style={{marginTop:'30px'}}><JugadorDashboard userEquipoId={user.equipoId||null} userName={user.email} formas21={formas21} setViewRosterId={setViewRosterId} /></div>}

                {user.rol === 'admin' && (
                    <div style={{marginTop:'30px'}}>
                        <h3 style={{fontSize:'1rem', color:'var(--primary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px'}}>Admin</h3>
                        <div className="dashboard-grid">
                            <div className="dashboard-card" onClick={()=>setMesaTecnicaView(true)}><div className="card-icon">🏀</div><div className="card-title">Mesa Técnica</div></div>
                            <div className="dashboard-card" onClick={()=>setAdminFormView(true)}><div className="card-icon">📋</div><div className="card-title">Gestionar F-21</div></div>
                            <div className="dashboard-card" onClick={()=>setUsersView(true)}><div className="card-icon">👥</div><div className="card-title">Usuarios</div></div>
                            <div className="dashboard-card" onClick={()=>setMatchView(true)}><div className="card-icon">🖊️</div><div className="card-title">Marcador Manual</div></div>
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