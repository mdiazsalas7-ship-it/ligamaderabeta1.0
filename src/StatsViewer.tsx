import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerStat { id: string; nombre: string; equipo: string; puntos: number; rebotes: number; asistencias: number; partidos: number; promedio: number; logoUrl?: string; }

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [stats, setStats] = useState<PlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'puntos' | 'rebotes' | 'asistencias'>('puntos');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Cargar Logos
                const formasSnap = await getDocs(collection(db, 'forma21s'));
                const teamLogos: Record<string, string> = {};
                formasSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.nombreEquipo && data.logoUrl) teamLogos[String(data.nombreEquipo).trim()] = data.logoUrl;
                });

                // 2. Cargar Stats Reales
                const statsSnap = await getDocs(collection(db, 'stats_partido'));
                
                if (statsSnap.empty) {
                    setLoading(false);
                    return; // No hay datos, se queda vacío
                }

                // 3. Sumar Stats
                const acumulado: Record<string, PlayerStat> = {};
                statsSnap.forEach(doc => {
                    const s = doc.data();
                    const pid = s.jugadorId;
                    if (!pid) return;

                    if (!acumulado[pid]) {
                        acumulado[pid] = {
                            id: pid,
                            nombre: s.nombre || 'Desconocido',
                            equipo: s.equipo || 'Agente Libre',
                            puntos: 0, rebotes: 0, asistencias: 0, partidos: 0, promedio: 0,
                            logoUrl: teamLogos[String(s.equipo).trim()] || null
                        };
                    }
                    acumulado[pid].puntos += Number(s.puntos || 0);
                    acumulado[pid].rebotes += Number(s.rebotes || 0);
                    acumulado[pid].asistencias += Number(s.asistencias || 0);
                    acumulado[pid].partidos += 1; // Un registro = Un partido jugado
                });

                // 4. Calcular promedios finales
                const listaFinal = Object.values(acumulado).map(p => ({
                    ...p,
                    promedio: p.puntos / p.partidos
                }));

                setStats(listaFinal);

            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchStats();
    }, []);

    const getSorted = () => {
        const data = [...stats];
        if (tab === 'puntos') return data.sort((a,b) => b.puntos - a.puntos);
        if (tab === 'rebotes') return data.sort((a,b) => b.rebotes - a.rebotes);
        return data.sort((a,b) => b.asistencias - a.asistencias);
    };

    const statsToShow = getSorted().slice(0, 20);
    const getValue = (s: PlayerStat) => tab === 'puntos' ? s.puntos : tab === 'rebotes' ? s.rebotes : s.asistencias;

    return (
        <div className="animate-fade-in" style={{maxWidth:'900px', margin:'0 auto', paddingBottom:'40px'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0}}>📊 Líderes</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                {['puntos', 'rebotes', 'asistencias'].map(t => (
                    <button key={t} onClick={()=>setTab(t as any)} className="btn" style={{flex:1, background: tab===t?'var(--primary)':'#eee', color: tab===t?'white':'#666', textTransform:'capitalize'}}>
                        {t}
                    </button>
                ))}
            </div>

            {loading ? <div>Cargando...</div> : stats.length === 0 ? <div className="card">No hay estadísticas registradas aún.</div> : (
                <div className="card" style={{padding:0}}>
                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                        <thead>
                            <tr style={{background:'var(--primary)', color:'white', textAlign:'left'}}>
                                <th style={{padding:'15px'}}>#</th><th>Jugador</th><th>Equipo</th><th style={{textAlign:'center'}}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsToShow.map((s, i) => (
                                <tr key={s.id} style={{borderBottom:'1px solid #eee'}}>
                                    <td style={{padding:'15px'}}>{i+1}</td>
                                    <td style={{padding:'15px', fontWeight:'bold'}}>{s.nombre}</td>
                                    <td style={{padding:'15px', display:'flex', alignItems:'center', gap:'10px'}}>
                                        {s.logoUrl && <img src={s.logoUrl} style={{width:'25px', height:'25px', borderRadius:'50%'}} />}
                                        {s.equipo}
                                    </td>
                                    <td style={{padding:'15px', textAlign:'center', fontWeight:'bold', fontSize:'1.2rem', color:'var(--primary)'}}>{getValue(s)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
export default StatsViewer;