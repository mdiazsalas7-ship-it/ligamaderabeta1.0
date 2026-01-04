import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

// --- CONFIGURACIÓN DE ESTILO ---
const LEAGUE_LOGO_URL = "https://i.postimg.cc/sDgyKfr4/nuevo_logo.png";
const DEFAULT_PLAYER_IMG = "https://cdn-icons-png.flaticon.com/512/166/166344.png"; // Silueta gris
const DEFAULT_TEAM_LOGO = "https://cdn-icons-png.flaticon.com/512/451/451716.png"; 

interface Team { id: string; nombre: string; logoUrl?: string; }
// IMPORTANTE: Agregamos fotoUrl a la interfaz
interface Player { id: string; nombre: string; numero: number; fotoUrl?: string; cedula?: string; }
interface PlayerStats { partidos: number; ppg: string; rpg: string; tpg: string; totalPuntos: number; }

const TeamsPublicViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [view, setView] = useState<'list' | 'roster'>('list');
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [roster, setRoster] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estado para la Barajita (Pop-up)
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // 1. Cargar Equipos al iniciar
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const snap = await getDocs(collection(db, 'equipos'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
                setTeams(list.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')));
            } catch (e) { 
                console.error("Error cargando equipos:", e); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchTeams();
    }, []);

    // 2. Cargar Roster al entrar a un equipo
    const handleSelectTeam = async (team: Team) => {
        setLoading(true);
        setSelectedTeam(team);
        try {
            // Buscamos en la subcolección de forma21s
            const rosterRef = collection(db, 'forma21s', team.id, 'jugadores');
            const snap = await getDocs(rosterRef);
            
            if (snap.empty) {
                setRoster([]);
            } else {
                const players = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
                setRoster(players.sort((a,b) => a.numero - b.numero));
            }
            setView('roster');
        } catch (e) { 
            console.error("Error cargando roster:", e); 
        } finally { 
            setLoading(false); 
        }
    };

    // 3. Generar Barajita al seleccionar jugador
    const handleSelectPlayer = async (player: Player) => {
        setSelectedPlayer(player);
        setLoadingStats(true);
        try {
            // Consultamos las estadísticas reales de los partidos
            const q = query(collection(db, 'stats_partido'), where('jugadorId', '==', player.id));
            const snap = await getDocs(q);
            
            let totalPts = 0, totalReb = 0, totalTri = 0, games = 0;
            
            snap.forEach(doc => {
                const d = doc.data();
                totalPts += Number(d.puntos || 0);
                totalReb += Number(d.rebotes || 0);
                totalTri += Number(d.triples || 0);
                games++;
            });

            // Calculamos promedios con 1 decimal
            const stats: PlayerStats = {
                partidos: games,
                totalPuntos: totalPts,
                ppg: games > 0 ? (totalPts / games).toFixed(1) : '0.0',
                rpg: games > 0 ? (totalReb / games).toFixed(1) : '0.0',
                tpg: games > 0 ? (totalTri / games).toFixed(1) : '0.0'
            };
            setPlayerStats(stats);

        } catch (e) { console.error(e); } finally { setLoadingStats(false); }
    };

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f3f4f6', zIndex:1000,
            display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
            
            {/* HEADER DE LA VISTA */}
            <div style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', padding: '15px 20px',
                color: 'white', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}>
                <button onClick={view === 'roster' ? () => setView('list') : onClose} style={{background:'rgba(255,255,255,0.2)', border:'none', color:'white', borderRadius:'50%', width:'40px', height:'40px', cursor:'pointer', fontSize:'1.2rem', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    {view === 'roster' ? '←' : '✕'}
                </button>
                <div>
                    <h2 style={{margin:0, fontSize:'1.2rem'}}>{view === 'list' ? 'Equipos Oficiales' : selectedTeam?.nombre}</h2>
                    <span style={{fontSize:'0.8rem', opacity:0.8}}>Liga Madera 15</span>
                </div>
            </div>

            {/* AREA DE CONTENIDO (Scrollable) */}
            <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                
                {loading ? (
                    <div style={{display:'flex', justifyContent:'center', marginTop:'50px', color:'#666'}}>
                        Cargando...
                    </div>
                ) : (
                    // VISTA 1: LISTA DE EQUIPOS
                    view === 'list' ? (
                        <>
                            {teams.length === 0 ? (
                                <div style={{textAlign:'center', marginTop:'50px', color:'#6b7280'}}>
                                    <div style={{fontSize:'3rem', marginBottom:'10px'}}>🛡️</div>
                                    <h3>No hay equipos registrados.</h3>
                                </div>
                            ) : (
                                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'20px'}}>
                                    {teams.map(team => (
                                        <div key={team.id} onClick={() => handleSelectTeam(team)} className="card" style={{
                                            padding:'20px', display:'flex', flexDirection:'column', alignItems:'center',
                                            cursor:'pointer', transition:'transform 0.2s', border:'1px solid #e5e7eb', background:'white', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'
                                        }}>
                                            <div style={{width:'80px', height:'80px', borderRadius:'50%', background:'#f9fafb', marginBottom:'15px', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #eee', overflow:'hidden'}}>
                                                <img src={team.logoUrl || DEFAULT_TEAM_LOGO} style={{width:'100%', height:'100%', objectFit:'contain'}} onError={(e:any)=>{e.target.src=DEFAULT_TEAM_LOGO}} />
                                            </div>
                                            <div style={{fontWeight:'bold', textAlign:'center', color:'#1f2937', fontSize:'0.95rem'}}>{team.nombre}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        // VISTA 2: ROSTER DEL EQUIPO SELECCIONADO
                        <div style={{maxWidth:'800px', margin:'0 auto'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'20px', marginBottom:'20px', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
                                <div style={{width:'70px', height:'70px', borderRadius:'50%', border:'2px solid #eee', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                    <img src={selectedTeam?.logoUrl || DEFAULT_TEAM_LOGO} style={{width:'100%', height:'100%', objectFit:'contain'}} onError={(e:any)=>{e.target.src=DEFAULT_TEAM_LOGO}} />
                                </div>
                                <div>
                                    <h3 style={{margin:0, color:'#1f2937', fontSize:'1.5rem'}}>{selectedTeam?.nombre}</h3>
                                    <span style={{color:'#6b7280', fontSize:'0.9rem'}}>Plantilla Oficial ({roster.length} Jugadores)</span>
                                </div>
                            </div>

                            {roster.length === 0 ? (
                                <div style={{textAlign:'center', padding:'40px', color:'#9ca3af', background:'white', borderRadius:'12px'}}>
                                    No hay jugadores cargados en este equipo.
                                </div>
                            ) : (
                                <div style={{display:'grid', gap:'10px'}}>
                                    {roster.map(p => (
                                        <div key={p.id} onClick={() => handleSelectPlayer(p)} style={{
                                            display:'flex', alignItems:'center', justifyContent:'space-between',
                                            background:'white', padding:'12px 20px', borderRadius:'8px', cursor:'pointer',
                                            border:'1px solid #e5e7eb', boxShadow:'0 1px 2px rgba(0,0,0,0.02)', transition:'background 0.2s'
                                        }}>
                                            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                                <div style={{
                                                    width:'45px', height:'45px', borderRadius:'50%', overflow:'hidden',
                                                    border: '2px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center',
                                                    background: '#f9fafb'
                                                }}>
                                                    {/* MINIATURA: Si tiene foto usa foto, si no usa número */}
                                                    {p.fotoUrl ? (
                                                        <img src={p.fotoUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                                    ) : (
                                                        <span style={{fontWeight:'bold', color:'#3b82f6'}}>{p.numero}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{fontWeight:'bold', color:'#374151', fontSize:'1rem'}}>{p.nombre}</div>
                                                    <div style={{fontSize:'0.75rem', color:'#3b82f6', fontWeight:'bold'}}>VER BARAJITA</div>
                                                </div>
                                            </div>
                                            <div style={{fontSize:'1.5rem', color:'#d1d5db'}}>›</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* --- MODAL BARAJITA TIPO UPPER DECK --- */}
            {selectedPlayer && (
                <div style={{
                    position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', zIndex:2000,
                    display:'flex', justifyContent:'center', alignItems:'center', padding:'20px', backdropFilter: 'blur(5px)'
                }} onClick={() => setSelectedPlayer(null)}>
                    
                    {/* TARJETA DEL JUGADOR */}
                    <div onClick={e => e.stopPropagation()} className="animate-scale-in" style={{
                        width:'100%', maxWidth:'340px', borderRadius:'20px', overflow:'hidden',
                        background: 'linear-gradient(145deg, #0f172a 0%, #000000 100%)', // Fondo oscuro premium
                        boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 0 4px #fbbf24', // Borde Dorado
                        position: 'relative', color: 'white', display: 'flex', flexDirection: 'column'
                    }}>
                        
                        {/* FONDO DECORATIVO */}
                        <div style={{position:'absolute', top:0, left:0, right:0, height:'100%', opacity:0.15, backgroundImage:`url(${LEAGUE_LOGO_URL})`, backgroundSize:'cover', backgroundPosition:'center', filter: 'grayscale(100%)'}}></div>

                        {/* CABECERA: EQUIPO Y NÚMERO */}
                        <div style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'start', position:'relative', zIndex:2}}>
                            {/* Logo Equipo */}
                            <img src={selectedTeam?.logoUrl || DEFAULT_TEAM_LOGO} style={{width:'60px', height:'60px', objectFit:'contain', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.8))'}} onError={(e:any)=>{e.target.src=DEFAULT_TEAM_LOGO}} />
                            
                            {/* Número Gigante */}
                            <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                                <span style={{fontSize:'4rem', fontWeight:'900', lineHeight:0.8, color:'#fbbf24', textShadow:'3px 3px 0px #000', fontFamily:'sans-serif'}}>
                                    {selectedPlayer.numero}
                                </span>
                            </div>
                        </div>

                        {/* FOTO JUGADOR (RECORTADA) */}
                        <div style={{
                            height:'280px', display:'flex', alignItems:'flex-end', justifyContent:'center', 
                            position:'relative', zIndex:1, marginTop:'-20px', overflow: 'hidden'
                        }}>
                            {/* Círculo de fondo detrás del jugador */}
                            <div style={{position:'absolute', bottom:'-50px', width:'300px', height:'300px', background:'radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(0,0,0,0) 70%)', borderRadius:'50%'}}></div>
                            
                            <img 
                                src={selectedPlayer.fotoUrl || DEFAULT_PLAYER_IMG} 
                                style={{
                                    height:'100%', width:'auto', objectFit:'contain', 
                                    filter: selectedPlayer.fotoUrl ? 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' : 'grayscale(100%) opacity(0.5)'
                                }} 
                                onError={(e:any)=>{e.target.src=DEFAULT_PLAYER_IMG}}
                            />
                        </div>

                        {/* DATOS Y ESTADÍSTICAS */}
                        <div style={{
                            background:'linear-gradient(to top, #000 30%, transparent 100%)', 
                            padding:'10px 20px 25px 20px', position:'relative', zIndex:3, 
                            textAlign:'center', marginTop:'-60px', paddingTop: '60px'
                        }}>
                            <h2 style={{
                                margin:0, fontSize:'1.8rem', textTransform:'uppercase', fontWeight:'800', 
                                letterSpacing:'1px', textShadow:'0 2px 4px black', fontFamily:'sans-serif',
                                background: '-webkit-linear-gradient(#fff, #999)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                            }}>
                                {selectedPlayer.nombre}
                            </h2>
                            <div style={{color:'#fbbf24', fontSize:'0.9rem', fontWeight:'bold', letterSpacing:'2px', marginBottom:'20px', textTransform:'uppercase'}}>
                                {selectedTeam?.nombre}
                            </div>

                            {/* GRID DE ESTADÍSTICAS */}
                            {loadingStats ? <div style={{color:'#999'}}>Calculando estadísticas...</div> : (
                                <div style={{
                                    display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', 
                                    background:'rgba(255,255,255,0.1)', borderRadius:'15px', padding:'15px', 
                                    border:'1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(5px)'
                                }}>
                                    <div>
                                        <div style={{fontSize:'1.5rem', fontWeight:'900', color:'white'}}>{playerStats?.ppg}</div>
                                        <div style={{fontSize:'0.6rem', color:'#fbbf24', fontWeight:'bold', letterSpacing:'1px'}}>PPG</div>
                                    </div>
                                    <div style={{borderLeft:'1px solid rgba(255,255,255,0.2)', borderRight:'1px solid rgba(255,255,255,0.2)'}}>
                                        <div style={{fontSize:'1.5rem', fontWeight:'900', color:'white'}}>{playerStats?.rpg}</div>
                                        <div style={{fontSize:'0.6rem', color:'#fbbf24', fontWeight:'bold', letterSpacing:'1px'}}>REB</div>
                                    </div>
                                    <div>
                                        <div style={{fontSize:'1.5rem', fontWeight:'900', color:'white'}}>{playerStats?.tpg}</div>
                                        <div style={{fontSize:'0.6rem', color:'#fbbf24', fontWeight:'bold', letterSpacing:'1px'}}>3PG</div>
                                    </div>
                                </div>
                            )}
                            
                            <div style={{marginTop:'20px', display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', opacity:0.6}}>
                                <img src={LEAGUE_LOGO_URL} style={{width:'20px'}} />
                                <span style={{fontSize:'0.65rem', color:'#ccc', letterSpacing:'3px', fontWeight:'bold'}}>LIGA MADERA 15 • OFFICIAL</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamsPublicViewer;