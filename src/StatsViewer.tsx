import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

interface JugadorStats { jugadorId: string; jugadorNombre: string; puntos: number; rebotes: number; asistencias: number; robos: number; valoracion: number; }
interface PartidoRegistrado extends DocumentData { calendarioId: string; estadisticasJugadores?: JugadorStats[]; }
interface PlayerLeader { id: string; nombre: string; partidosJugados: number; promedioPuntos: number; promedioRebotes: number; promedioAsistencias: number; promedioValoracion: number; }

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [matches, setMatches] = useState<PartidoRegistrado[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Cargar todos los partidos jugados
    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const snapshot = await getDocs(collection(db, 'partidos'));
                // Filtramos solo los que tienen stats válidas
                const list = snapshot.docs.map(doc => doc.data() as PartidoRegistrado).filter(m => m.estadisticasJugadores && m.estadisticasJugadores.length > 0);
                setMatches(list);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchStats();
    }, []);

    // 2. Calcular Promedios en tiempo real
    const leaders = useMemo(() => {
        const map = new Map<string, { id: string, nombre: string, gp: number, pts: number, reb: number, ast: number, val: number }>();
        
        matches.forEach(m => {
            m.estadisticasJugadores?.forEach(s => {
                const curr = map.get(s.jugadorId) || { id: s.jugadorId, nombre: s.jugadorNombre, gp: 0, pts: 0, reb: 0, ast: 0, val: 0 };
                curr.gp++; 
                curr.pts += s.puntos; 
                curr.reb += s.rebotes; 
                curr.ast += s.asistencias; 
                curr.val += s.valoracion;
                map.set(s.jugadorId, curr);
            });
        });

        const all = Array.from(map.values()).map(p => ({
            id: p.id, nombre: p.nombre, partidosJugados: p.gp,
            promedioPuntos: p.gp ? p.pts/p.gp : 0, 
            promedioRebotes: p.gp ? p.reb/p.gp : 0,
            promedioAsistencias: p.gp ? p.ast/p.gp : 0, 
            promedioValoracion: p.gp ? p.val/p.gp : 0,
        }));

        const getTop = (k: keyof PlayerLeader) => [...all].sort((a,b) => (b[k] as number)-(a[k] as number)).slice(0,5);
        
        return { 
            pts: getTop('promedioPuntos'), 
            reb: getTop('promedioRebotes'), 
            ast: getTop('promedioAsistencias'), 
            val: getTop('promedioValoracion') 
        };
    }, [matches]);

    const LeaderCard = ({ title, icon, data, k, lbl, col }: any) => (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${col}` }}>
            <div style={{ padding: '12px 15px', background: '#f9fafb', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>{title}</h3>
            </div>
            <div className="table-responsive">
                <table className="data-table" style={{marginTop:0}}>
                    <tbody>
                        {data.map((p:any, i:number)=>(
                            <tr key={p.id}>
                                <td style={{fontWeight:'bold', color:i===0?col:'grey', width:'25px', textAlign:'center'}}>{i+1}</td>
                                <td>
                                    <div style={{fontWeight:'600', fontSize:'0.85rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'140px'}}>{p.nombre}</div>
                                </td>
                                <td style={{textAlign:'right', fontWeight:'800', fontSize:'1rem'}}>
                                    {p[k].toFixed(1)} <small style={{fontSize:'0.6rem', color:'#999'}}>{lbl}</small>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--primary)' }}>Líderes de Temporada</h2>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>
            
            {loading ? <div className="card" style={{textAlign:'center', padding:'40px'}}>Cargando estadísticas...</div> : (
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap:'15px' }}>
                    <LeaderCard title="Puntos" icon="🔥" data={leaders.pts} k="promedioPuntos" lbl="PPJ" col="#f59e0b" />
                    <LeaderCard title="Rebotes" icon="🖐️" data={leaders.reb} k="promedioRebotes" lbl="RPJ" col="#3b82f6" />
                    <LeaderCard title="Asistencias" icon="🤝" data={leaders.ast} k="promedioAsistencias" lbl="APJ" col="#10b981" />
                    <LeaderCard title="MVP" icon="⭐" data={leaders.val} k="promedioValoracion" lbl="VAL" col="#8b5cf6" />
                </div>
            )}
        </div>
    );
};
export default StatsViewer;