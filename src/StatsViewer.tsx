// src/StatsViewer.tsx (AJUSTADO PARA NO SCROLEAR)

import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

interface JugadorStats { jugadorId: string; jugadorNombre: string; jugadorNumero: number; equipoId: string; puntos: number; rebotes: number; asistencias: number; robos: number; valoracion: number; }
interface PartidoRegistrado extends DocumentData { id: string; calendarioId: string; jornada: number; equipoLocalId: string; equipoVisitanteId: string; marcadorLocal: number; marcadorVisitante: number; ganadorId: string; perdedorId: string; equipoLocalNombre?: string; equipoVisitanteNombre?: string; estadisticasJugadores?: JugadorStats[]; mvpNombre?: string; mvpValoracion?: number; mvpId?: string; }
interface PlayerLeader { id: string; nombre: string; partidosJugados: number; promedioPuntos: number; promedioRebotes: number; promedioAsistencias: number; promedioValoracion: number; }

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [finishedMatches, setFinishedMatches] = useState<PartidoRegistrado[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<PartidoRegistrado | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resultados' | 'lideres'>('resultados');

    useEffect(() => {
        const fetchFinishedMatches = async () => {
            setLoading(true);
            try {
                const snapshot = await getDocs(collection(db, 'partidos'));
                let matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PartidoRegistrado[];
                matches = matches.filter(m => m.calendarioId && m.calendarioId.length > 5);
                const matchesWithNames = await Promise.all(matches.map(async (m) => {
                    if (m.calendarioId) {
                        try {
                            const calDoc = await getDoc(doc(db, 'calendario', m.calendarioId));
                            if (calDoc.exists()) {
                                const calData = calDoc.data();
                                return { ...m, equipoLocalNombre: calData.equipoLocalNombre || 'Local', equipoVisitanteNombre: calData.equipoVisitanteNombre || 'Visitante' };
                            }
                        } catch (e) {}
                    }
                    return { ...m, equipoLocalNombre: 'N/A', equipoVisitanteNombre: 'N/A' };
                }));
                setFinishedMatches((matchesWithNames as PartidoRegistrado[]).sort((a, b) => b.jornada - a.jornada));
            } catch (err) {} finally { setLoading(false); }
        };
        fetchFinishedMatches();
    }, []);

    const leaders = useMemo(() => {
        const playersMap = new Map<string, { id: string, nombre: string, gp: number, pts: number, reb: number, ast: number, val: number }>();
        finishedMatches.forEach(match => {
            if (match.estadisticasJugadores) {
                match.estadisticasJugadores.forEach(stat => {
                    const current = playersMap.get(stat.jugadorId) || { id: stat.jugadorId, nombre: stat.jugadorNombre, gp: 0, pts: 0, reb: 0, ast: 0, val: 0 };
                    current.gp += 1; current.pts += stat.puntos; current.reb += stat.rebotes; current.ast += stat.asistencias; current.val += stat.valoracion;
                    playersMap.set(stat.jugadorId, current);
                });
            }
        });
        const allPlayers: PlayerLeader[] = Array.from(playersMap.values()).map(p => ({
            id: p.id, nombre: p.nombre, partidosJugados: p.gp,
            promedioPuntos: p.gp > 0 ? p.pts / p.gp : 0, promedioRebotes: p.gp > 0 ? p.reb / p.gp : 0,
            promedioAsistencias: p.gp > 0 ? p.ast / p.gp : 0, promedioValoracion: p.gp > 0 ? p.val / p.gp : 0,
        }));
        const getTop5 = (key: keyof PlayerLeader) => [...allPlayers].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 5);
        return { points: getTop5('promedioPuntos'), rebounds: getTop5('promedioRebotes'), assists: getTop5('promedioAsistencias'), mvp: getTop5('promedioValoracion') };
    }, [finishedMatches]);

    const renderStatsTable = (stats: JugadorStats[], isMvpId: string | undefined) => (
        <div className="table-responsive">
            <table className="data-table">
                <thead><tr><th style={{width:'30px'}}>#</th><th>Jugador</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th></tr></thead>
                <tbody>{stats.length === 0 ? <tr><td colSpan={6} style={{textAlign:'center', padding:'15px'}}>Sin datos</td></tr> : stats.sort((a,b)=>b.valoracion-a.valoracion).map(s=><tr key={s.jugadorId} style={s.jugadorId===isMvpId?{backgroundColor:'#fffbeb'}:{}}><td>{s.jugadorNumero}</td><td><div style={{fontWeight: s.jugadorId===isMvpId?'bold':'normal', color:s.jugadorId===isMvpId?'var(--accent)':'inherit'}}>{s.jugadorNombre}</div></td><td>{s.puntos}</td><td>{s.rebotes}</td><td>{s.asistencias}</td><td>{s.valoracion}</td></tr>)}</tbody>
            </table>
        </div>
    );

    if (selectedMatch) return (
        <div className="animate-fade-in" style={{maxWidth: '1000px', margin: '0 auto'}}>
            <button onClick={() => setSelectedMatch(null)} className="btn btn-secondary" style={{ marginBottom: '15px' }}>← Volver</button>
            <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                <span className="badge badge-warning" style={{marginBottom: '10px'}}>Jornada {selectedMatch.jornada}</span>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <h2 style={{color: 'var(--text-main)', fontSize:'1.2rem'}}>{selectedMatch.equipoLocalNombre}</h2>
                    <div style={{ background: 'var(--primary)', color: 'white', padding: '8px 20px', borderRadius: '10px', fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedMatch.marcadorLocal} - {selectedMatch.marcadorVisitante}</div>
                    <h2 style={{color: 'var(--text-main)', fontSize:'1.2rem'}}>{selectedMatch.equipoVisitanteNombre}</h2>
                </div>
            </div>
            {/* Grid ajustado para móviles: 280px mínimo para evitar desborde */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                <div className="card" style={{padding:0, borderTop:'4px solid var(--primary)'}}>{renderStatsTable(selectedMatch.estadisticasJugadores?.filter(s=>s.equipoId===selectedMatch.equipoLocalId)||[], selectedMatch.mvpId)}</div>
                <div className="card" style={{padding:0, borderTop:'4px solid var(--danger)'}}>{renderStatsTable(selectedMatch.estadisticasJugadores?.filter(s=>s.equipoId===selectedMatch.equipoVisitanteId)||[], selectedMatch.mvpId)}</div>
            </div>
        </div>
    );

    const LeaderCard = ({ title, icon, data, valueKey, color, label }: any) => (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${color}` }}>
            <div style={{ padding: '12px 15px', background: '#f9fafb', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '1.2rem' }}>{icon}</span><h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>{title}</h3></div>
            <div className="table-responsive"><table className="data-table" style={{marginTop:0}}><tbody>{data.map((p:any, idx:number)=><tr key={p.id}><td style={{fontWeight:'bold', color:idx===0?color:'grey', width:'25px', textAlign:'center'}}>{idx+1}</td><td><div style={{fontWeight:'600', fontSize:'0.85rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'120px'}}>{p.nombre}</div></td><td style={{textAlign:'right', fontWeight:'800', fontSize:'1rem'}}>{p[valueKey].toFixed(1)} <small style={{fontSize:'0.6rem', color:'#999'}}>{label}</small></td></tr>)}</tbody></table></div>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--primary)' }}>Estadísticas</h2>
                <button onClick={onClose} className="btn btn-secondary" style={{padding:'5px 10px'}}>Cerrar</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <button onClick={()=>setActiveTab('resultados')} className="btn" style={{background:activeTab==='resultados'?'var(--primary)':'transparent', color:activeTab==='resultados'?'white':'var(--text-muted)', fontSize:'0.85rem'}}>🏀 Resultados</button>
                <button onClick={()=>setActiveTab('lideres')} className="btn" style={{background:activeTab==='lideres'?'var(--accent)':'transparent', color:activeTab==='lideres'?'white':'var(--text-muted)', fontSize:'0.85rem'}}>👑 Líderes</button>
            </div>
            
            {loading ? <div className="card" style={{textAlign:'center', padding:'40px'}}>Cargando...</div> : activeTab==='resultados' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {finishedMatches.length === 0 ? <div className="card" style={{textAlign:'center', padding:'30px', color:'var(--text-muted)'}}>Sin datos.</div> : finishedMatches.map(m => (
                        <div key={m.id} onClick={()=>setSelectedMatch(m)} className="dashboard-card" style={{flexDirection:'row', justifyContent:'space-between', padding:'15px', height:'auto', textAlign:'left', borderLeft:`4px solid ${m.marcadorLocal>m.marcadorVisitante?'var(--primary)':'var(--danger)'}`}}>
                            <div><span className="badge" style={{marginBottom:'4px', background:'#f3f4f6'}}>J{m.jornada}</span><div style={{fontWeight:'600', fontSize:'0.95rem'}}>{m.equipoLocalNombre} <span style={{color:'var(--primary)'}}>{m.marcadorLocal}</span> - <span style={{color:'var(--danger)'}}>{m.marcadorVisitante}</span> {m.equipoVisitanteNombre}</div></div><div style={{color:'#ccc'}}>➔</div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap:'15px' }}>
                    <LeaderCard title="Puntos" icon="🔥" data={leaders.points} valueKey="promedioPuntos" color="#f59e0b" label="PPJ" />
                    <LeaderCard title="Rebotes" icon="🖐️" data={leaders.rebounds} valueKey="promedioRebotes" color="#3b82f6" label="RPJ" />
                    <LeaderCard title="Asistencias" icon="🤝" data={leaders.assists} valueKey="promedioAsistencias" color="#10b981" label="APJ" />
                    <LeaderCard title="MVP" icon="⭐" data={leaders.mvp} valueKey="promedioValoracion" color="#8b5cf6" label="VAL" />
                </div>
            )}
        </div>
    );
};
export default StatsViewer;