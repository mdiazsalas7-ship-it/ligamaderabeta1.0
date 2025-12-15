import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, getDocs, where } from 'firebase/firestore';

// --- INTERFACES ---
interface GameEvent {
    id: string; text: string; time: string;
    team: 'local' | 'visitante' | 'system';
    type: 'score' | 'stat' | 'foul' | 'sub' | 'period' | 'timeout' | 'system';
}

interface PlayerStats {
    jugadorId: string; nombre: string; equipo: string; numero: number;
    puntos: number; faltasTotales: number; triples: number;
    rebotes?: number; asistencias?: number;
    isStarter?: boolean; 
    isCaptain?: boolean;
}

interface MatchData {
    id: string;
    equipoLocalNombre: string; equipoVisitanteNombre: string;
    marcadorLocal: number; marcadorVisitante: number;
    cuarto: number; estatus: string;
    faltasLocal: number; faltasVisitante: number;
    timeoutsLocal: number; timeoutsVisitante: number;
    gameLog?: GameEvent[];
    forma5?: any; 
    relojTiro?: number; 
}

const LiveGameViewer: React.FC<{ matchId: string, onClose: () => void }> = ({ matchId, onClose }) => {
    const [match, setMatch] = useState<MatchData | null>(null);
    const [logos, setLogos] = useState<{local: string, visitante: string}>({ local: '', visitante: '' });
    const [stats, setStats] = useState<PlayerStats[]>([]);
    const [activeTab, setActiveTab] = useState<'pbp' | 'box'>('pbp');

    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    // 1. Cargar datos del partido
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'calendario', matchId), (docSnap) => {
            if (docSnap.exists()) {
                setMatch({ id: docSnap.id, ...docSnap.data() } as any);
            }
        });
        return () => unsub();
    }, [matchId]);

    // 2. Cargar Estadísticas y Fusionar Roles
    useEffect(() => {
        const q = query(collection(db, 'stats_partido'), where('partidoId', '==', matchId));
        const unsub = onSnapshot(q, (snap) => {
            let list = snap.docs.map(d => d.data() as PlayerStats);
            
            if (match?.forma5) {
                Object.keys(match.forma5).forEach(equipoId => {
                    // Soporte para estructura nueva y vieja
                    const formaData = match.forma5[equipoId];
                    const starters = new Set(formaData.startersIds || []); 
                    // Si es estructura vieja (array), asumimos los 5 primeros, pero idealmente usamos startersIds
                    const captain = formaData.captainId;

                    list = list.map(player => {
                        if (player.jugadorId && starters.has(player.jugadorId)) {
                            player.isStarter = true;
                        }
                        if (player.jugadorId && player.jugadorId === captain) {
                            player.isCaptain = true;
                        }
                        return player;
                    });
                });
            }
            setStats(list);
        });
        return () => unsub();
    }, [matchId, match?.forma5]);

    // 3. Cargar Logos (Lógica Robusta con Default)
    useEffect(() => {
        const fetchLogos = async () => {
            if (!match) return;
            try {
                const q = query(collection(db, 'equipos'));
                const snap = await getDocs(q);
                let lLocal = DEFAULT_LOGO;
                let lVisitante = DEFAULT_LOGO;

                snap.forEach(d => {
                    const data = d.data();
                    // Buscamos por nombre (asegúrate que los nombres coincidan exactamente)
                    if (data.nombre === match.equipoLocalNombre && data.logoUrl) lLocal = data.logoUrl;
                    if (data.nombre === match.equipoVisitanteNombre && data.logoUrl) lVisitante = data.logoUrl;
                });
                setLogos({ local: lLocal, visitante: lVisitante });
            } catch (error) {
                console.error("Error al cargar logos:", error);
            }
        };
        fetchLogos();
    }, [match?.equipoLocalNombre, match?.equipoVisitanteNombre]);

    // --- RENDERIZADO DEL BOX SCORE ---
    const renderBoxScore = (teamName: string, isLocalTeam: boolean) => {
        const teamStats = stats.filter(s => s.equipo === teamName).sort((a,b) => (b.isStarter ? 1 : a.isStarter ? -1 : 0) || a.numero - b.numero);
        
        const primaryColor = isLocalTeam ? '#3b82f6' : '#f59e0b';
        const secondaryColor = isLocalTeam ? '#eff6ff' : '#fff7ed';
        const teamLogo = isLocalTeam ? logos.local : logos.visitante;

        const totalPts = teamStats.reduce((sum, s) => sum + s.puntos, 0);
        const totalReb = teamStats.reduce((sum, s) => sum + (s.rebotes || 0), 0);
        const totalAst = teamStats.reduce((sum, s) => sum + (s.asistencias || 0), 0);
        const totalFouls = teamStats.reduce((sum, s) => sum + (s.faltasTotales || 0), 0);

        return (
            <div style={{marginTop:'20px', border: `1px solid ${primaryColor}`, borderRadius:'8px', overflow:'hidden'}}>
                <div style={{
                    background: primaryColor, color:'white', padding:'10px 15px',
                    display:'flex', justifyContent:'space-between', alignItems:'center'
                }}>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        {/* Logo pequeño en la tabla */}
                        <img src={teamLogo} alt="" style={{width:'25px', height:'25px', borderRadius:'50%', border:'1px solid white', background:'white'}} onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}/>
                        <span style={{fontWeight:'bold', fontSize:'1rem'}}>{teamName}</span>
                    </div>
                    <span style={{fontSize:'1.2rem', fontWeight:'900'}}>PTS: {totalPts}</span>
                </div>
                
                <table style={{width:'100%', fontSize:'0.85rem', borderCollapse:'collapse'}}>
                    <thead>
                        <tr style={{background:'#f3f4f6', color:'#666'}}>
                            <th style={{textAlign:'left', padding:'8px 10px'}}>JUGADOR</th>
                            <th style={{width:'40px'}}>PTS</th>
                            <th style={{width:'40px'}}>AST</th>
                            <th style={{width:'40px'}}>REB</th>
                            <th style={{width:'40px', color:'red'}}>FLT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teamStats.length === 0 ? (
                            <tr><td colSpan={5} style={{textAlign:'center', padding:'15px', color:'#999'}}>Sin datos de Box Score en vivo.</td></tr>
                        ) : (
                            teamStats.map((s, idx) => {
                                const isStarter = s.isStarter;
                                const isCaptain = s.isCaptain;
                                
                                return (
                                    <tr key={idx} style={{background: isStarter ? secondaryColor : 'white', borderBottom:'1px solid #eee'}}>
                                        <td style={{textAlign:'left', padding:'8px 10px', fontWeight: isStarter ? 'bold' : 'normal', color:'#1f2937'}}>
                                            <span style={{color:'#666', marginRight:'5px'}}>#{s.numero}</span> 
                                            {s.nombre}
                                            {isCaptain && <span style={{marginLeft:'5px', color:'#f59e0b', fontSize:'0.75rem'}}>⭐</span>}
                                            {isStarter && !isCaptain && <span style={{marginLeft:'5px', color:'#10b981', fontSize:'0.75rem'}}>•</span>}
                                        </td>
                                        <td style={{textAlign:'center', fontWeight:'bold'}}>{s.puntos}</td>
                                        <td style={{textAlign:'center', color:'#666'}}>{s.asistencias || 0}</td>
                                        <td style={{textAlign:'center', color:'#666'}}>{s.rebotes || 0}</td>
                                        <td style={{textAlign:'center', color: s.faltasTotales >= 5 ? 'red' : '#666', fontWeight: s.faltasTotales >= 4 ? 'bold' : 'normal'}}>
                                            {s.faltasTotales}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        <tr style={{background:'#e5e7eb', fontWeight:'bold', borderTop:'2px solid #999'}}>
                            <td style={{padding:'8px 10px'}}>TOTALES</td>
                            <td style={{textAlign:'center'}}>{totalPts}</td>
                            <td style={{textAlign:'center'}}>{totalAst}</td>
                            <td style={{textAlign:'center'}}>{totalReb}</td>
                            <td style={{textAlign:'center', color: totalFouls >= 5 ? 'red' : '#666'}}>{totalFouls}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    // --- HELPERS ---
    const formatEventText = (text: string, type: string) => {
        let cleanText = text.replace(/🏀|🤜|⚠️|🛑|🖐️|🅰️|🔄|⏱️|🕒|⛔/g, '').trim();
        if (cleanText.includes('P:')) return cleanText.replace('P:', 'Falta Personal de');
        if (cleanText.includes('T:')) return cleanText.replace('T:', 'Falta TÉCNICA a');
        if (cleanText.includes('U:')) return cleanText.replace('U:', 'Falta ANTIDEPORTIVA a');
        if (cleanText.includes('D (Descalificante):')) return cleanText.replace('D (Descalificante):', 'Falta DESCALIFICANTE a');
        if (cleanText.includes('(+1)')) return `Tiro Libre anotado por ${cleanText.replace('(+1)', '')}`;
        if (cleanText.includes('(+2)')) return `Canasta de 2 pts: ${cleanText.replace('(+2)', '')}`;
        if (cleanText.includes('(+3)')) return `¡TRIPLE! 🔥 ${cleanText.replace('(+3)', '')}`;
        if (type === 'sub') return cleanText.replace('Cambio:', 'Sustitución:');
        if (type === 'timeout') return 'Tiempo Muerto solicitado';
        if (cleanText.includes('(EXPULSADO)')) return cleanText.replace('(EXPULSADO)', '— EXPULSADO');
        return cleanText;
    };

    const getEventIcon = (type: string, text: string) => {
        if (type === 'score') return text.includes('(+3)') ? '🔥' : '🏀';
        if (type === 'foul') return text.includes('D (') ? '⛔' : '🟥';
        if (type === 'timeout') return '⏱️';
        if (type === 'sub') return '🔄';
        if (type === 'period') return '🔔';
        return '📢';
    };

    if (!match) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#0f172a', color:'white'}}>Cargando transmisión...</div>;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#0f172a', zIndex: 2000, overflowY: 'auto',
            display: 'flex', flexDirection: 'column'
        }}>
            
            {/* HEADER: MARCADOR (CON LOGOS OFICIALES) */}
            <div style={{
                background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
                padding: '15px 10px', borderBottom: '2px solid #334155',
                position: 'sticky', top: 0, zIndex: 10
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '15px', left: '15px',
                    background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
                    borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer'
                }}>✕</button>

                <div style={{textAlign: 'center', color: match.estatus === 'vivo' ? '#ef4444' : '#94a3b8', fontSize: '0.75rem', marginBottom: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform:'uppercase', animation: match.estatus === 'vivo' ? 'pulse 2s infinite' : 'none'}}>
                    {match.estatus === 'vivo' ? '🔴 EN VIVO' : '🏁 FINALIZADO'}
                </div>

                <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px'}}>
                    
                    {/* LOCAL */}
                    <div style={{textAlign: 'center', flex: 1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                        {/* Logo Local */}
                        <div style={{
                            width:'60px', height:'60px', borderRadius:'50%', 
                            border:'3px solid #3b82f6', overflow:'hidden', background:'white',
                            boxShadow:'0 0 15px rgba(59, 130, 246, 0.4)', marginBottom:'5px',
                            display:'flex', alignItems:'center', justifyContent:'center'
                        }}>
                            <img 
                                src={logos.local} 
                                alt="Local" 
                                style={{width:'100%', height:'100%', objectFit:'cover'}} 
                                onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}
                            />
                        </div>
                        <div style={{color: 'white', fontWeight: 'bold', fontSize: '0.85rem', lineHeight:1.2}}>{match.equipoLocalNombre}</div>
                        <div style={{display:'flex', gap:'2px', marginTop:'4px'}}>
                            {[...Array(match.timeoutsLocal || 0)].map((_,i) => <div key={i} style={{width:'6px', height:'3px', background:'#facc15', borderRadius:'1px'}}></div>)}
                        </div>
                    </div>

                    {/* SCOREBOARD CENTRAL */}
                    <div style={{
                        background: 'black', padding: '10px 20px', borderRadius: '8px',
                        border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        boxShadow: '0 0 15px rgba(0,0,0,0.5)', minWidth:'120px'
                    }}>
                        <div style={{fontSize: '2.5rem', fontWeight: '900', color: 'white', lineHeight: 0.9, letterSpacing: '2px'}}>
                            {match.marcadorLocal} - {match.marcadorVisitante}
                        </div>
                        <div style={{fontSize: '0.75rem', color: '#ef4444', marginTop: '5px', fontWeight: 'bold'}}>
                            {match.cuarto <= 4 ? `CUARTO ${match.cuarto}` : `PRÓRROGA ${match.cuarto - 4}`}
                        </div>
                        
                        {/* RELOJ DE TIRO VISIBLE PARA EL PÚBLICO (Solo si está disponible) */}
                        {match.relojTiro !== undefined && (match.relojTiro > 0) && (
                            <div style={{
                                marginTop:'8px', background:'#222', border:'1px solid #ef4444', 
                                padding:'2px 8px', borderRadius:'4px', color:'#fbbf24', fontWeight:'bold', fontFamily:'monospace', fontSize:'0.8rem'
                            }}>
                                24s: {Math.ceil(match.relojTiro / 10)}
                            </div>
                        )}
                    </div>

                    {/* VISITANTE */}
                    <div style={{textAlign: 'center', flex: 1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                        {/* Logo Visitante */}
                        <div style={{
                            width:'60px', height:'60px', borderRadius:'50%', 
                            border:'3px solid #f59e0b', overflow:'hidden', background:'white',
                            boxShadow:'0 0 15px rgba(245, 158, 11, 0.4)', marginBottom:'5px',
                            display:'flex', alignItems:'center', justifyContent:'center'
                        }}>
                            <img 
                                src={logos.visitante} 
                                alt="Visitante" 
                                style={{width:'100%', height:'100%', objectFit:'cover'}} 
                                onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}
                            />
                        </div>
                        <div style={{color: 'white', fontWeight: 'bold', fontSize: '0.85rem', lineHeight:1.2}}>{match.equipoVisitanteNombre}</div>
                        <div style={{display:'flex', gap:'2px', marginTop:'4px'}}>
                            {[...Array(match.timeoutsVisitante || 0)].map((_,i) => <div key={i} style={{width:'6px', height:'3px', background:'#facc15', borderRadius:'1px'}}></div>)}
                        </div>
                    </div>
                </div>
                
                {/* BONUS INDICATORS */}
                <div style={{display:'flex', justifyContent:'space-between', marginTop:'15px', padding:'0 15px'}}>
                    <div style={{fontSize:'0.7rem', color: match.faltasLocal >= 5 ? '#ef4444' : '#64748b', fontWeight:'bold'}}>
                        FALTAS: {match.faltasLocal} {match.faltasLocal >= 5 && '• BONUS'}
                    </div>
                    <div style={{fontSize:'0.7rem', color: match.faltasVisitante >= 5 ? '#ef4444' : '#64748b', fontWeight:'bold'}}>
                        {match.faltasVisitante >= 5 && 'BONUS •'} FALTAS: {match.faltasVisitante}
                    </div>
                </div>
            </div>

            {/* PESTAÑAS */}
            <div style={{display:'flex', background:'#1e293b', borderBottom:'1px solid #334155'}}>
                <button 
                    onClick={() => setActiveTab('pbp')}
                    style={{flex:1, padding:'12px', background: activeTab==='pbp' ? '#334155' : 'transparent', color: activeTab==='pbp' ? 'white' : '#94a3b8', border:'none', fontWeight:'bold', borderBottom: activeTab==='pbp' ? '3px solid #3b82f6' : 'none'}}
                >
                    📢 Jugada a Jugada
                </button>
                <button 
                    onClick={() => setActiveTab('box')}
                    style={{flex:1, padding:'12px', background: activeTab==='box' ? '#334155' : 'transparent', color: activeTab==='box' ? 'white' : '#94a3b8', border:'none', fontWeight:'bold', borderBottom: activeTab==='box' ? '3px solid #3b82f6' : 'none'}}
                >
                    📊 Estadísticas (Box Score)
                </button>
            </div>

            {/* CONTENIDO PESTAÑAS */}
            <div style={{flex: 1, padding: '15px', background: activeTab==='box' ? 'white' : '#f1f5f9', overflowY: 'auto'}}>
                
                {activeTab === 'pbp' ? (
                    /* PLAY-BY-PLAY FEED */
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        {match.gameLog?.map((log) => {
                            const isLocal = log.team === 'local';
                            const isSystem = log.team === 'system';
                            return (
                                <div key={log.id} style={{
                                    alignSelf: isSystem ? 'center' : (isLocal ? 'flex-start' : 'flex-end'),
                                    maxWidth: '90%', display: 'flex', gap: '8px', alignItems: 'flex-start',
                                    flexDirection: isLocal ? 'row' : 'row-reverse'
                                }}>
                                    {!isSystem && <div style={{fontSize: '0.65rem', color: '#64748b', marginTop: '6px', minWidth:'35px', textAlign: isLocal?'right':'left'}}>{log.time}</div>}
                                    <div style={{
                                        background: isSystem ? '#e2e8f0' : 'white',
                                        borderLeft: isLocal && !isSystem ? '3px solid #3b82f6' : 'none',
                                        borderRight: !isLocal && !isSystem ? '3px solid #f59e0b' : 'none',
                                        padding: '8px 12px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        color: '#1e293b'
                                    }}>
                                        {isSystem ? (
                                            <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#64748b', textAlign:'center'}}>
                                                {getEventIcon(log.type, log.text)} {log.text}
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{fontSize: '0.65rem', fontWeight: 'bold', marginBottom: '2px', color: isLocal ? '#2563eb' : '#d97706', textTransform: 'uppercase'}}>
                                                    {isLocal ? match.equipoLocalNombre : match.equipoVisitanteNombre}
                                                </div>
                                                <div style={{fontSize: '0.85rem', lineHeight: '1.3'}}>
                                                    {getEventIcon(log.type, log.text)} {formatEventText(log.text, log.type)}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* BOX SCORE TABLE (NUEVO DISEÑO CON LOGOS) */
                    <div className="animate-fade-in">
                        {renderBoxScore(match.equipoLocalNombre, true)}
                        {renderBoxScore(match.equipoVisitanteNombre, false)}
                    </div>
                )}
            </div>
        </div>
    );
};
export default LiveGameViewer;