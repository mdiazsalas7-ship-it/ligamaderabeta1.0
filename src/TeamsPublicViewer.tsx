import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

// --- CONFIGURACIÓN ---
const LEAGUE_LOGO_URL = "https://i.postimg.cc/sDgyKfr4/nuevo_logo.png";
const DEFAULT_PLAYER_IMG = "https://cdn-icons-png.flaticon.com/512/166/166344.png"; // Silueta por defecto

interface Team { id: string; nombre: string; logoUrl?: string; }
interface Player { id: string; nombre: string; numero: number; fotoUrl?: string; posicion?: string; }
interface PlayerStats { partidos: number; ppg: string; rpg: string; tpg: string; totalPuntos: number; }

const TeamsPublicViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [view, setView] = useState<'list' | 'roster'>('list');
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [roster, setRoster] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estado para la Barajita
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // 1. Cargar Equipos
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const snap = await getDocs(collection(db, 'equipos'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
                // Ordenar alfabéticamente
                setTeams(list.sort((a,b) => a.nombre.localeCompare(b.nombre)));
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchTeams();
    }, []);

    // 2. Cargar Roster al seleccionar equipo
    const handleSelectTeam = async (team: Team) => {
        setLoading(true);
        setSelectedTeam(team);
        try {
            // Buscamos en la subcolección de forma21s
            const rosterRef = collection(db, 'forma21s', team.id, 'jugadores');
            const snap = await getDocs(rosterRef);
            const players = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            setRoster(players.sort((a,b) => a.numero - b.numero));
            setView('roster');
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // 3. Cargar Stats al seleccionar jugador (Para la Barajita)
    const handleSelectPlayer = async (player: Player) => {
        setSelectedPlayer(player);
        setLoadingStats(true);
        try {
            // Buscar todos los stats de este jugador en todos los partidos
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

            // Calcular promedios
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
            
            {/* HEADER */}
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

            {/* CONTENIDO PRINCIPAL */}
            <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                
                {loading ? <div style={{textAlign:'center', padding:'40px', color:'#666'}}>Cargando...</div> : (
                    
                    // VISTA 1: LISTA DE EQUIPOS
                    view === 'list' ? (
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'20px'}}>
                            {teams.map(team => (
                                <div key={team.id} onClick={() => handleSelectTeam(team)} className="card" style={{
                                    padding:'20px', display:'flex', flexDirection:'column', alignItems:'center',
                                    cursor:'pointer', transition:'transform 0.2s', border:'1px solid #e5e7eb'
                                }}>
                                    <div style={{width:'80px', height:'80px', borderRadius:'50%', background:'#f9fafb', marginBottom:'15px', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #eee'}}>
                                        <img src={team.logoUrl || DEFAULT_PLAYER_IMG} style={{width:'90%', height:'90%', objectFit:'contain', borderRadius:'50%'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER_IMG}} />
                                    </div>
                                    <div style={{fontWeight:'bold', textAlign:'center', color:'#1f2937'}}>{team.nombre}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // VISTA 2: ROSTER DEL EQUIPO
                        <div style={{maxWidth:'800px', margin:'0 auto'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'20px', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
                                <img src={selectedTeam?.logoUrl} style={{width:'60px', height:'60px', objectFit:'contain'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER_IMG}} />
                                <div>
                                    <h3 style={{margin:0, color:'#1f2937'}}>{selectedTeam?.nombre}</h3>
                                    <span style={{color:'#6b7280'}}>{roster.length} Jugadores Inscritos</span>
                                </div>
                            </div>

                            <div style={{display:'grid', gap:'10px'}}>
                                {roster.map(p => (
                                    <div key={p.id} onClick={() => handleSelectPlayer(p)} style={{
                                        display:'flex', alignItems:'center', justifyContent:'space-between',
                                        background:'white', padding:'12px 20px', borderRadius:'8px', cursor:'pointer',
                                        border:'1px solid #e5e7eb', boxShadow:'0 1px 2px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                            <div style={{width:'35px', height:'35px', background:'#1e40af', color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold'}}>
                                                {p.numero}
                                            </div>
                                            <div>
                                                <div style={{fontWeight:'bold', color:'#374151'}}>{p.nombre}</div>
                                                <div style={{fontSize:'0.8rem', color:'#9ca3af'}}>Ver Ficha de Jugador</div>
                                            </div>
                                        </div>
                                        <div style={{fontSize:'1.5rem', color:'#d1d5db'}}>›</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* --- MODAL BARAJITA (TRADING CARD) --- */}
            {selectedPlayer && (
                <div style={{
                    position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:2000,
                    display:'flex', justifyContent:'center', alignItems:'center', padding:'20px', backdropFilter: 'blur(5px)'
                }} onClick={() => setSelectedPlayer(null)}>
                    
                    {/* TARJETA */}
                    <div onClick={e => e.stopPropagation()} className="animate-scale-in" style={{
                        width:'100%', maxWidth:'320px', borderRadius:'20px', overflow:'hidden',
                        background: 'linear-gradient(145deg, #1a1a1a 0%, #000000 100%)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 2px #f59e0b', // Borde dorado
                        position: 'relative', color: 'white'
                    }}>
                        {/* FONDO DECORATIVO */}
                        <div style={{position:'absolute', top:0, left:0, right:0, height:'100%', opacity:0.1, backgroundImage:`url(${LEAGUE_LOGO_URL})`, backgroundSize:'cover', backgroundPosition:'center'}}></div>

                        {/* CABECERA TARJETA */}
                        <div style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'start', position:'relative'}}>
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                <span style={{fontSize:'3rem', fontWeight:'900', lineHeight:1, color:'#f59e0b', textShadow:'2px 2px 0px #000'}}>
                                    {selectedPlayer.numero}
                                </span>
                                <span style={{fontSize:'0.7rem', fontWeight:'bold', letterSpacing:'1px', color:'#9ca3af'}}>NUM</span>
                            </div>
                            <img src={selectedTeam?.logoUrl} style={{width:'50px', height:'50px', objectFit:'contain', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER_IMG}} />
                        </div>

                        {/* FOTO JUGADOR */}
                        <div style={{height:'220px', display:'flex', alignItems:'flex-end', justifyContent:'center', position:'relative', zIndex:1}}>
                            <img 
                                src={selectedPlayer.fotoUrl || "https://cdn-icons-png.flaticon.com/512/10434/10434252.png"} 
                                style={{height:'100%', objectFit:'contain', filter:'drop-shadow(0 5px 15px rgba(0,0,0,0.8))'}} 
                                onError={(e:any)=>{e.target.src="https://cdn-icons-png.flaticon.com/512/10434/10434252.png"}}
                            />
                        </div>

                        {/* DATOS JUGADOR */}
                        <div style={{background:'linear-gradient(to top, #111 0%, transparent 100%)', padding:'10px 20px 20px 20px', position:'relative', zIndex:2, textAlign:'center', marginTop:'-40px'}}>
                            <h2 style={{margin:0, fontSize:'1.6rem', textTransform:'uppercase', fontWeight:'800', letterSpacing:'-0.5px', textShadow:'0 2px 4px black'}}>
                                {selectedPlayer.nombre}
                            </h2>
                            <div style={{color:'#f59e0b', fontSize:'0.9rem', fontWeight:'bold', marginBottom:'15px'}}>
                                {selectedTeam?.nombre}
                            </div>

                            {/* ESTADÍSTICAS */}
                            {loadingStats ? <div style={{color:'#666'}}>Calculando stats...</div> : (
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'5px', background:'rgba(255,255,255,0.1)', borderRadius:'12px', padding:'10px'}}>
                                    <div>
                                        <div style={{fontSize:'1.2rem', fontWeight:'bold', color:'white'}}>{playerStats?.ppg}</div>
                                        <div style={{fontSize:'0.6rem', color:'#9ca3af', fontWeight:'bold'}}>PPG</div>
                                    </div>
                                    <div style={{borderLeft:'1px solid rgba(255,255,255,0.2)', borderRight:'1px solid rgba(255,255,255,0.2)'}}>
                                        <div style={{fontSize:'1.2rem', fontWeight:'bold', color:'white'}}>{playerStats?.rpg}</div>
                                        <div style={{fontSize:'0.6rem', color:'#9ca3af', fontWeight:'bold'}}>REB</div>
                                    </div>
                                    <div>
                                        <div style={{fontSize:'1.2rem', fontWeight:'bold', color:'white'}}>{playerStats?.tpg}</div>
                                        <div style={{fontSize:'0.6rem', color:'#9ca3af', fontWeight:'bold'}}>3PG</div>
                                    </div>
                                </div>
                            )}
                            
                            <div style={{marginTop:'15px', display:'flex', justifyContent:'center', alignItems:'center', gap:'10px'}}>
                                <img src={LEAGUE_LOGO_URL} style={{width:'30px', opacity:0.8}} />
                                <span style={{fontSize:'0.6rem', color:'#666', letterSpacing:'2px'}}>LIGA MADERA 15</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamsPublicViewer;