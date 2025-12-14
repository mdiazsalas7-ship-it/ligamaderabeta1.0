import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

const LiveGameViewer: React.FC<{ matchId: string, onClose: () => void }> = ({ matchId, onClose }) => {
    const [match, setMatch] = useState<any>(null);
    const [stats, setStats] = useState<any[]>([]); // Stats acumuladas del juego
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pbp' | 'boxscore'>('pbp');

    // 1. ESCUCHAR EL PARTIDO (MARCADOR, TIEMPO, LOG)
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'calendario', matchId), (docSnap) => {
            if (docSnap.exists()) {
                setMatch({ id: docSnap.id, ...docSnap.data() });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [matchId]);

    // 2. ESCUCHAR LAS ESTADÍSTICAS (BOX SCORE)
    useEffect(() => {
        // Escuchamos la colección de stats filtrada por este partido
        const q = query(collection(db, 'stats_partido'), where('partidoId', '==', matchId));
        const unsubStats = onSnapshot(q, (snapshot) => {
            const statsData = snapshot.docs.map(d => d.data());
            // Ordenar por puntos descendente
            statsData.sort((a, b) => b.puntos - a.puntos);
            setStats(statsData);
        });
        return () => unsubStats();
    }, [matchId]);

    if (loading) return <div style={{background:'#111', height:'100vh', color:'white', display:'flex', justifyContent:'center', alignItems:'center'}}>Cargando transmisión...</div>;
    if (!match) return null;

    const statsLocal = stats.filter(s => s.equipo === match.equipoLocalNombre);
    const statsVisitante = stats.filter(s => s.equipo === match.equipoVisitanteNombre);

    // Renderizador de Tablas de Stats
    const StatsTable = ({ teamName, players }: { teamName: string, players: any[] }) => (
        <div style={{marginBottom:'20px'}}>
            <h4 style={{color:'#fbbf24', borderBottom:'1px solid #333', paddingBottom:'5px', margin:'0 0 10px 0'}}>{teamName}</h4>
            <table style={{width:'100%', fontSize:'0.8rem', borderCollapse:'collapse', color:'#ccc'}}>
                <thead>
                    <tr style={{textAlign:'center', background:'#222', color:'#888'}}>
                        <th style={{textAlign:'left', padding:'5px'}}>JUGADOR</th>
                        <th>PTS</th>
                        <th>REB</th>
                        <th>AST</th>
                        <th>FAL</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map((p, i) => (
                        <tr key={i} style={{borderBottom:'1px solid #333', textAlign:'center'}}>
                            <td style={{textAlign:'left', padding:'5px', fontWeight:'bold', color:'white'}}>#{p.numero || '?'} {p.nombre}</td>
                            <td style={{fontWeight:'bold', color:'white'}}>{p.puntos}</td>
                            <td>{p.rebotes}</td>
                            <td>{p.asistencias}</td>
                            <td style={{color: p.faltas >= 5 ? 'red' : 'inherit'}}>{p.faltas}</td>
                        </tr>
                    ))}
                    {players.length === 0 && <tr><td colSpan={5} style={{textAlign:'center', padding:'10px'}}>Sin datos aún</td></tr>}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'#121212', zIndex:2000,
            display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
            {/* HEADER TRANSMISIÓN */}
            <div style={{
                backgroundImage: 'url(https://i.postimg.cc/3R98dqnk/basketball_court_black_line_marking_260nw_2125177724.webp)',
                backgroundSize: 'cover', backgroundPosition: 'center', 
                padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center',
                boxShadow:'0 4px 15px rgba(0,0,0,0.5)', textShadow:'2px 2px 4px black'
            }}>
                <div style={{textAlign:'center', flex:1}}>
                    <div style={{color:'#60a5fa', fontWeight:'bold', fontSize:'1.1rem'}}>{match.equipoLocalNombre}</div>
                    <div style={{fontSize:'3.5rem', fontWeight:'bold', lineHeight:1, color:'white'}}>{match.marcadorLocal}</div>
                    <div style={{fontSize:'0.8rem', color:'#ddd', fontWeight:'bold'}}>Faltas: {match.faltasLocal}</div>
                    {match.faltasLocal >= 5 && <span style={{background:'red', color:'white', padding:'2px 6px', fontSize:'0.7rem', borderRadius:'4px'}}>BONUS</span>}
                </div>

                <div style={{textAlign:'center', padding:'0 20px'}}>
                    <div style={{background:'rgba(0,0,0,0.8)', padding:'10px 20px', borderRadius:'8px', border:'1px solid #444', backdropFilter:'blur(5px)'}}>
                        <div style={{color:'#fbbf24', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>
                            {match.cuarto > 4 ? `PRÓRROGA ${match.cuarto - 4}` : `CUARTO ${match.cuarto}`}
                        </div>
                        {match.estatus === 'vivo' ? (
                            <div style={{color:'red', fontWeight:'bold', fontSize:'0.8rem', animation:'pulse 1s infinite'}}>🔴 EN VIVO</div>
                        ) : (
                            <div style={{color:'#10b981', fontWeight:'bold', fontSize:'0.8rem'}}>FINALIZADO</div>
                        )}
                    </div>
                </div>

                <div style={{textAlign:'center', flex:1}}>
                    <div style={{color:'#fbbf24', fontWeight:'bold', fontSize:'1.1rem'}}>{match.equipoVisitanteNombre}</div>
                    <div style={{fontSize:'3.5rem', fontWeight:'bold', lineHeight:1, color:'white'}}>{match.marcadorVisitante}</div>
                    <div style={{fontSize:'0.8rem', color:'#ddd', fontWeight:'bold'}}>Faltas: {match.faltasVisitante}</div>
                    {match.faltasVisitante >= 5 && <span style={{background:'red', color:'white', padding:'2px 6px', fontSize:'0.7rem', borderRadius:'4px'}}>BONUS</span>}
                </div>
            </div>

            {/* TABS DE CONTROL */}
            <div style={{display:'flex', background:'#1a1a1a', borderBottom:'1px solid #333'}}>
                <button onClick={()=>setActiveTab('pbp')} style={{flex:1, padding:'12px', background: activeTab==='pbp'?'#2563eb':'transparent', color:'white', border:'none', fontWeight:'bold'}}>
                    📜 JUGADA A JUGADA
                </button>
                <button onClick={()=>setActiveTab('boxscore')} style={{flex:1, padding:'12px', background: activeTab==='boxscore'?'#2563eb':'transparent', color:'white', border:'none', fontWeight:'bold'}}>
                    📊 BOX SCORE
                </button>
            </div>

            {/* CONTENIDO SCROLLABLE */}
            <div style={{flex:1, overflowY:'auto', padding:'15px', background:'#000'}}>
                
                {/* VISTA PLAY BY PLAY */}
                {activeTab === 'pbp' && (
                    <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                        {match.gameLog?.map((log: any) => (
                            <div key={log.id} style={{
                                background: '#111', padding:'10px', borderRadius:'6px', borderLeft: `4px solid ${log.team==='local'?'#2563eb': log.team==='visitante'?'#fbbf24':'#555'}`,
                                color:'white', display:'flex', alignItems:'center', gap:'15px', fontSize:'0.9rem'
                            }}>
                                <span style={{color:'#666', fontFamily:'monospace', fontWeight:'bold'}}>{log.time}</span>
                                <span>
                                    {log.type === 'score' && '🏀 '}
                                    {log.type === 'foul' && '🟥 '}
                                    {log.type === 'sub' && '🔄 '}
                                    {log.type === 'timeout' && '⏱️ '}
                                    {log.text}
                                </span>
                            </div>
                        ))}
                        {(!match.gameLog || match.gameLog.length === 0) && <div style={{textAlign:'center', color:'#555', marginTop:'20px'}}>El partido está por comenzar...</div>}
                    </div>
                )}

                {/* VISTA BOX SCORE */}
                {activeTab === 'boxscore' && (
                    <div>
                        <StatsTable teamName={match.equipoLocalNombre} players={statsLocal} />
                        <StatsTable teamName={match.equipoVisitanteNombre} players={statsVisitante} />
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div style={{padding:'10px', background:'#111', borderTop:'1px solid #333', textAlign:'center'}}>
                <button onClick={onClose} className="btn btn-secondary" style={{width:'100%', maxWidth:'300px'}}>Cerrar Transmisión</button>
            </div>
        </div>
    );
};
export default LiveGameViewer;