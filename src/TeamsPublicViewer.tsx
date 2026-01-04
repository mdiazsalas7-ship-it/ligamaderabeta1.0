import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

// --- CONFIGURACIÓN DE ESTILO ---
const LEAGUE_LOGO_URL = "https://i.postimg.cc/sDgyKfr4/nuevo_logo.png";
const DEFAULT_PLAYER_IMG = "https://cdn-icons-png.flaticon.com/512/166/166344.png"; 
const DEFAULT_TEAM_LOGO = "https://cdn-icons-png.flaticon.com/512/451/451716.png"; 

interface Team { id: string; nombre: string; logoUrl?: string; }
interface Player { id: string; nombre: string; numero: number; fotoUrl?: string; cedula?: string; }
interface PlayerStats { partidos: number; ppg: string; rpg: string; tpg: string; valpg: string; totalPuntos: number; }

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

    // ESTADO PARA SABER QUIÉNES SON LOS LÍDERES
    const [leagueLeaders, setLeagueLeaders] = useState<{
        mvpId: string | null;
        scorerId: string | null;
        rebounderId: string | null;
        shooterId: string | null;
    }>({ mvpId: null, scorerId: null, rebounderId: null, shooterId: null });

    // 1. Cargar Equipos y CALCULAR LÍDERES (En silencio)
    useEffect(() => {
        const initData = async () => {
            try {
                // A. Cargar Equipos
                const snapTeams = await getDocs(collection(db, 'equipos'));
                const listTeams = snapTeams.docs.map(d => ({ id: d.id, ...d.data() } as Team));
                setTeams(listTeams.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')));

                // B. Calcular Líderes Globales (Para saber si el jugador es especial)
                const snapStats = await getDocs(collection(db, 'stats_partido'));
                const aggregated: Record<string, any> = {};

                snapStats.forEach(doc => {
                    const d = doc.data();
                    if (!aggregated[d.jugadorId]) {
                        aggregated[d.jugadorId] = { 
                            id: d.jugadorId, 
                            pts: 0, reb: 0, tri: 0, flt: 0, games: 0 
                        };
                    }
                    aggregated[d.jugadorId].pts += Number(d.puntos || 0);
                    aggregated[d.jugadorId].reb += Number(d.rebotes || 0);
                    aggregated[d.jugadorId].tri += Number(d.triples || 0);
                    aggregated[d.jugadorId].flt += Number(d.faltasTotales || 0);
                    aggregated[d.jugadorId].games += 1;
                });

                // Procesar promedios
                const allPlayers = Object.values(aggregated).map((p: any) => {
                    const g = p.games || 1;
                    return {
                        id: p.id,
                        ppg: p.pts / g,
                        rpg: p.reb / g,
                        tpg: p.tri / g,
                        valpg: ((p.pts + p.reb) - p.flt) / g
                    };
                }).filter((p: any) => p.games > 0);

                // Encontrar los #1
                if (allPlayers.length > 0) {
                    const mvp = [...allPlayers].sort((a,b) => b.valpg - a.valpg)[0];
                    const scorer = [...allPlayers].sort((a,b) => b.ppg - a.ppg)[0];
                    const rebounder = [...allPlayers].sort((a,b) => b.rpg - a.rpg)[0];
                    const shooter = [...allPlayers].sort((a,b) => b.tpg - a.tpg)[0];

                    setLeagueLeaders({
                        mvpId: mvp?.id || null,
                        scorerId: scorer?.id || null,
                        rebounderId: rebounder?.id || null,
                        shooterId: shooter?.id || null
                    });
                }

            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        initData();
    }, []);

    // 2. Cargar Roster
    const handleSelectTeam = async (team: Team) => {
        setLoading(true);
        setSelectedTeam(team);
        try {
            const rosterRef = collection(db, 'forma21s', team.id, 'jugadores');
            const snap = await getDocs(rosterRef);
            if (snap.empty) setRoster([]);
            else {
                const players = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
                setRoster(players.sort((a,b) => a.numero - b.numero));
            }
            setView('roster');
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // 3. Generar Barajita
    const handleSelectPlayer = async (player: Player) => {
        setSelectedPlayer(player);
        setLoadingStats(true);
        try {
            const q = query(collection(db, 'stats_partido'), where('jugadorId', '==', player.id));
            const snap = await getDocs(q);
            let tp = 0, tr = 0, tt = 0, tf = 0, g = 0;
            snap.forEach(doc => {
                const d = doc.data();
                tp += Number(d.puntos || 0);
                tr += Number(d.rebotes || 0);
                tt += Number(d.triples || 0);
                tf += Number(d.faltasTotales || 0);
                g++;
            });

            const val = (tp + tr) - tf;

            setPlayerStats({
                partidos: g,
                totalPuntos: tp,
                ppg: g > 0 ? (tp / g).toFixed(1) : '0.0',
                rpg: g > 0 ? (tr / g).toFixed(1) : '0.0',
                tpg: g > 0 ? (tt / g).toFixed(1) : '0.0',
                valpg: g > 0 ? (val / g).toFixed(1) : '0.0'
            });
        } catch (e) { console.error(e); } finally { setLoadingStats(false); }
    };

    // --- COMPONENTE: TARJETA INTELIGENTE ---
    const SmartCard = () => {
        if (!selectedPlayer) return null;

        // Determinar si es especial
        let cardType = 'standard';
        if (selectedPlayer.id === leagueLeaders.mvpId) cardType = 'mvp';
        else if (selectedPlayer.id === leagueLeaders.scorerId) cardType = 'scorer';
        else if (selectedPlayer.id === leagueLeaders.rebounderId) cardType = 'rebounder';
        else if (selectedPlayer.id === leagueLeaders.shooterId) cardType = 'shooter';

        // Estilos
        const styles = {
            standard: {
                wrapperBg: '#fff',
                cardBg: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', // Gris oscuro profesional
                border: '#3b82f6', // Azul
                title: 'JUGADOR',
                textColor: '#fff',
                statColor: '#fff',
                glow: '0 0 20px rgba(0,0,0,0.5)',
                anim: 'none'
            },
            mvp: {
                wrapperBg: 'linear-gradient(45deg, #FFD700, #FDB931, #FFD700)',
                cardBg: 'linear-gradient(to bottom, #FFD700 0%, #ffecb3 50%, #FFD700 100%)',
                border: '#fff',
                title: 'MVP LEADER',
                textColor: '#000',
                statColor: '#000',
                glow: '0 0 60px rgba(255, 215, 0, 0.9)',
                anim: 'spin 4s linear infinite'
            },
            scorer: {
                wrapperBg: '#000',
                cardBg: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)', // Rojo
                border: '#fca5a5',
                title: 'TOP SCORER',
                textColor: '#fff',
                statColor: '#fbbf24',
                glow: '0 0 40px rgba(239, 68, 68, 0.8)',
                anim: 'none'
            },
            rebounder: {
                wrapperBg: '#000',
                cardBg: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', // Verde
                border: '#6ee7b7',
                title: 'TOP REBOUNDER',
                textColor: '#fff',
                statColor: '#fff',
                glow: '0 0 40px rgba(16, 185, 129, 0.8)',
                anim: 'none'
            },
            shooter: {
                wrapperBg: '#000',
                cardBg: 'linear-gradient(135deg, #312e81 0%, #8b5cf6 100%)', // Violeta
                border: '#c4b5fd',
                title: 'TOP SHOOTER',
                textColor: '#fff',
                statColor: '#fff',
                glow: '0 0 40px rgba(139, 92, 246, 0.8)',
                anim: 'none'
            }
        };

        const s = styles[cardType as keyof typeof styles];
        const foto = selectedPlayer.fotoUrl || DEFAULT_PLAYER_IMG;

        return (
            <div style={{
                position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.92)', 
                zIndex:3000, display:'flex', justifyContent:'center', alignItems:'center', padding:'20px', backdropFilter: 'blur(8px)'
            }} onClick={() => setSelectedPlayer(null)}>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

                <div onClick={e => e.stopPropagation()} className="animate-scale-in" style={{
                    width: '100%', maxWidth: '350px', borderRadius: '25px', position: 'relative', 
                    boxShadow: s.glow, padding: '5px', background: s.wrapperBg
                }}>
                    {/* Borde Animado para MVP */}
                    {cardType === 'mvp' && <div style={{position:'absolute', top:'-5px', left:'-5px', right:'-5px', bottom:'-5px', background: s.wrapperBg, borderRadius:'30px', zIndex:-1, filter:'blur(15px)', animation: s.anim}}></div>}

                    <div style={{background: s.cardBg, borderRadius: '20px', overflow: 'hidden', height: '520px', display:'flex', flexDirection:'column', position:'relative', border: `3px solid ${s.border}`}}>
                        
                        {/* DECORACIÓN FONDO */}
                        <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0.1, backgroundImage: `url(${LEAGUE_LOGO_URL})`, backgroundSize:'cover', backgroundPosition:'center'}}></div>

                        {/* CABECERA */}
                        <div style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'start', zIndex:2}}>
                            <img src={selectedTeam?.logoUrl || DEFAULT_TEAM_LOGO} style={{width:'65px', height:'65px', objectFit:'contain', filter: cardType==='mvp'?'none':'drop-shadow(0 4px 4px black)'}} onError={(e:any)=>{e.target.src=DEFAULT_TEAM_LOGO}} />
                            
                            <div style={{textAlign:'right'}}>
                                {/* Número Gigante */}
                                <div style={{color: s.statColor, fontWeight:'900', fontSize:'3rem', lineHeight:0.8, textShadow: cardType==='mvp'?'none':'0 2px 4px black', fontFamily:'sans-serif'}}>
                                    {selectedPlayer.numero}
                                </div>
                                <div style={{color: s.textColor, fontSize:'0.7rem', fontWeight:'bold', letterSpacing:'1px', marginTop:'5px'}}>{s.title}</div>
                            </div>
                        </div>

                        {/* FOTO JUGADOR */}
                        <div style={{flex:1, display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:2, marginTop:'-30px'}}>
                            <img src={foto} style={{width:'95%', height:'auto', maxHeight:'380px', objectFit:'contain', filter:'drop-shadow(0 10px 20px rgba(0,0,0,0.6))'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER_IMG}} />
                        </div>

                        {/* NOMBRE Y EQUIPO */}
                        <div style={{
                            position: 'absolute', bottom: 85, width: '100%', textAlign: 'center', zIndex: 3,
                            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                        }}>
                            <h2 style={{
                                margin: 0, color: s.textColor, textTransform: 'uppercase', 
                                fontSize: '2.2rem', fontWeight: '900', letterSpacing: '1px', lineHeight: 0.9
                            }}>
                                {selectedPlayer.nombre.split(' ')[0]}
                            </h2>
                            <h3 style={{
                                margin: 0, color: s.border, textTransform: 'uppercase', 
                                fontSize: '1.6rem', fontWeight: '800'
                            }}>
                                {selectedPlayer.nombre.split(' ').slice(1).join(' ')}
                            </h3>
                        </div>

                        {/* FOOTER DE ESTADÍSTICAS */}
                        <div style={{
                            background: cardType==='mvp' ? '#000' : 'rgba(0,0,0,0.8)', 
                            padding: '15px 10px', display: 'flex', justifyContent: 'space-around', 
                            color: 'white', fontSize: '0.8rem', zIndex: 4, backdropFilter:'blur(5px)'
                        }}>
                            {loadingStats ? <span style={{width:'100%', textAlign:'center'}}>Cargando stats...</span> : (
                                <>
                                    <div style={{textAlign:'center'}}><div style={{color:'#999', fontSize:'0.65rem', fontWeight:'bold'}}>PPG</div><b style={{fontSize:'1.1rem'}}>{playerStats?.ppg}</b></div>
                                    <div style={{textAlign:'center'}}><div style={{color:'#999', fontSize:'0.65rem', fontWeight:'bold'}}>RPG</div><b style={{fontSize:'1.1rem'}}>{playerStats?.rpg}</b></div>
                                    <div style={{textAlign:'center'}}><div style={{color:'#999', fontSize:'0.65rem', fontWeight:'bold'}}>3PG</div><b style={{fontSize:'1.1rem'}}>{playerStats?.tpg}</b></div>
                                    <div style={{textAlign:'center', borderLeft:'1px solid #444', paddingLeft:'10px'}}><div style={{color: cardType==='mvp'?'#fbbf24':'#999', fontSize:'0.65rem', fontWeight:'bold'}}>VAL</div><b style={{fontSize:'1.1rem', color:cardType==='mvp'?'#fbbf24':'white'}}>{playerStats?.valpg}</b></div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f3f4f6', zIndex:1000,
            display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
            {selectedPlayer && <SmartCard />}

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
                    <div style={{display:'flex', justifyContent:'center', marginTop:'50px', color:'#666'}}>Cargando...</div>
                ) : (
                    view === 'list' ? (
                        <>
                            {teams.length === 0 ? (
                                <div style={{textAlign:'center', marginTop:'50px', color:'#6b7280'}}><h3>No hay equipos registrados.</h3></div>
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
                                <div style={{textAlign:'center', padding:'40px', color:'#9ca3af', background:'white', borderRadius:'12px'}}>No hay jugadores cargados.</div>
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
                                                    {p.fotoUrl ? (
                                                        <img src={p.fotoUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                                    ) : (
                                                        <span style={{fontWeight:'bold', color:'#3b82f6'}}>{p.numero}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{fontWeight:'bold', color:'#374151', fontSize:'1rem'}}>
                                                        {p.nombre} 
                                                        {/* INDICADOR SI ES LIDER */}
                                                        {p.id === leagueLeaders.mvpId && <span style={{marginLeft:'5px'}}>👑</span>}
                                                        {p.id === leagueLeaders.scorerId && <span style={{marginLeft:'5px'}}>🔥</span>}
                                                    </div>
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
        </div>
    );
};

export default TeamsPublicViewer;