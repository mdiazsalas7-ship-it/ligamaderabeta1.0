import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

const COURT_BG_URL = "https://i.postimg.cc/3R98dqnk/basketball-court-black-line-marking-260nw-2125177724.webp"; 

interface LiveMatchProps { matchId: string; onClose: () => void; }

const LiveGameViewer: React.FC<LiveMatchProps> = ({ matchId, onClose }) => {
    const [matchData, setMatchData] = useState<DocumentData | null>(null);
    const [plays, setPlays] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubMatch = onSnapshot(doc(db, 'calendario', matchId), (doc) => { if (doc.exists()) setMatchData(doc.data()); });
        const q = query(collection(db, 'stats_partido'), where('calendarioId', '==', matchId), orderBy('timestamp', 'desc'));
        const unsubPlays = onSnapshot(q, (snapshot) => { setPlays(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
        return () => { unsubMatch(); unsubPlays(); };
    }, [matchId]);

    if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>Conectando... 📡</div>;
    if (!matchData) return null;
    const isLive = !matchData.partidoRegistradoId;
    const lastPlay = plays[0];

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>{isLive && <span className="badge badge-danger animate-pulse">🔴 EN VIVO</span>}<h2 style={{fontSize: '1.2rem', margin: 0, color: 'var(--primary)'}}>GameCast</h2></div>
                <button onClick={onClose} className="btn btn-secondary">← Salir</button>
            </div>
            <div style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.9)), url("${COURT_BG_URL}")`, backgroundSize: 'cover', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', textAlign: 'center', marginBottom: '20px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{lastPlay ? `CUARTO ${lastPlay.cuarto} • ${lastPlay.tiempoJuego}` : 'ESPERANDO'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{flex: 1}}><h3 style={{color: 'white', fontSize: '1.1rem', marginBottom: '5px'}}>{matchData.equipoLocalNombre}</h3><div style={{fontSize: '3.5rem', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1, color: '#fbbf24'}}>{matchData.marcadorLocal || 0}</div></div>
                    <div style={{fontSize: '1.5rem', opacity: 0.5, fontWeight: '100'}}>VS</div>
                    <div style={{flex: 1}}><h3 style={{color: 'white', fontSize: '1.1rem', marginBottom: '5px'}}>{matchData.equipoVisitanteNombre}</h3><div style={{fontSize: '3.5rem', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1, color: '#fbbf24'}}>{matchData.marcadorVisitante || 0}</div></div>
                </div>
            </div>
            <div className="card" style={{padding: '0', overflow: 'hidden'}}>
                <div style={{padding: '15px', background: '#f8fafc', borderBottom: '1px solid #eee'}}><h3 style={{margin: 0, fontSize: '1rem', color: 'var(--text-muted)'}}>⏱️ Minuto a Minuto</h3></div>
                <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                    {plays.length === 0 ? <div style={{padding: '30px', textAlign: 'center', color: '#9ca3af'}}>El partido está por comenzar...</div> : (
                        <table className="data-table">
                            <tbody>
                                {plays.map((play) => {
                                    let color = 'var(--text-main)';
                                    if (play.tipo.includes('FALTA')) color = 'var(--danger)';
                                    if (play.tipo === 'PUNTO') color = 'var(--success)';
                                    if (play.tipo === 'CAMBIO') color = 'var(--primary)';
                                    const isLocal = play.equipoId === matchData.equipoLocalId;
                                    return (
                                        <tr key={play.id} style={{backgroundColor: isLocal ? '#fff' : '#f9fafb'}}>
                                            <td style={{width: '60px', fontSize: '0.75rem', color: '#64748b', textAlign: 'center', borderRight: '1px solid #eee'}}>{play.tiempoJuego}<br/>C{play.cuarto}</td>
                                            <td style={{padding: '12px 15px'}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                    <span style={{fontSize: '1.2rem'}}>{play.tipo === 'FALTA_P' ? '⚠️' : (play.tipo === 'PUNTO' ? '🏀' : (play.tipo === 'CAMBIO' ? '🔄' : 'KZ'))}</span>
                                                    <div><div style={{fontWeight: '600', color: color, fontSize: '0.95rem'}}>{play.tipo === 'PUNTO' ? `+${play.puntos} Puntos` : play.tipo.replace('_', ' ')}</div><div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{isLocal ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre} • #{play.jugadorNumero} {play.jugadorNombre}</div>{play.detalles && <div style={{fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic'}}>{play.detalles}</div>}</div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
export default LiveGameViewer;