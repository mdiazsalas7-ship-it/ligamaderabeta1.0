import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerStat {
    id: string; 
    jugadorId: string;
    nombre: string;
    equipo: string;
    // Totales (para cálculo)
    totalPuntos: number;
    totalRebotes: number;
    totalAsistencias: number;
    totalTriples: number;
    totalValoracion: number;
    partidosJugados: number;
    // Promedios (para mostrar)
    ppg: number; // Puntos por juego
    rpg: number; // Rebotes por juego
    apg: number; // Asistencias por juego
    tpg: number; // Triples por juego
    valpg: number; // Valoración por juego
    logoUrl?: string;
}

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [leaders, setLeaders] = useState<{
        mvp: PlayerStat[],
        puntos: PlayerStat[],
        rebotes: PlayerStat[],
        asistencias: PlayerStat[],
        triples: PlayerStat[]
    }>({ mvp: [], puntos: [], rebotes: [], asistencias: [], triples: [] } as any);
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Obtener Logos
                const equiposSnap = await getDocs(collection(db, 'equipos'));
                const teamLogos: Record<string, string> = {};
                equiposSnap.forEach(d => {
                    const data = d.data();
                    if (data.nombre && data.logoUrl) {
                        teamLogos[data.nombre] = data.logoUrl;
                    }
                });

                // 2. Obtener Stats Raw
                const statsSnap = await getDocs(collection(db, 'stats_partido'));
                const rawStats: any[] = statsSnap.docs.map(d => d.data());

                // 3. Agrupar y Sumar
                const aggregated: Record<string, any> = {};

                rawStats.forEach(stat => {
                    if (!aggregated[stat.jugadorId]) {
                        aggregated[stat.jugadorId] = {
                            id: stat.jugadorId,
                            jugadorId: stat.jugadorId,
                            nombre: stat.nombre,
                            equipo: stat.equipo,
                            totalPuntos: 0, totalRebotes: 0, totalAsistencias: 0, totalRobos: 0, 
                            totalBloqueos: 0, totalFaltas: 0, totalTriples: 0,
                            partidosJugados: 0,
                            logoUrl: teamLogos[stat.equipo] || undefined
                        };
                    }
                    const acc = aggregated[stat.jugadorId];
                    acc.totalPuntos += (stat.puntos || 0);
                    acc.totalRebotes += (stat.rebotes || 0);
                    acc.totalAsistencias += (stat.asistencias || 0);
                    acc.totalRobos += (stat.robos || 0);
                    acc.totalBloqueos += (stat.bloqueos || 0);
                    acc.totalFaltas += (stat.faltas || 0);
                    acc.totalTriples += (stat.triples || 0);
                    acc.partidosJugados += 1;
                });

                // 4. Calcular Promedios
                const processedPlayers: PlayerStat[] = Object.values(aggregated).map((p: any) => {
                    const games = p.partidosJugados || 1; // Evitar división por cero
                    
                    // Valoración Total Simple
                    const valoracionTotal = (p.totalPuntos + p.totalRebotes + p.totalAsistencias + p.totalRobos + p.totalBloqueos) - p.totalFaltas;

                    return {
                        ...p,
                        totalValoracion: valoracionTotal,
                        ppg: parseFloat((p.totalPuntos / games).toFixed(1)),
                        rpg: parseFloat((p.totalRebotes / games).toFixed(1)),
                        apg: parseFloat((p.totalAsistencias / games).toFixed(1)),
                        tpg: parseFloat((p.totalTriples / games).toFixed(1)),
                        valpg: parseFloat((valoracionTotal / games).toFixed(1))
                    };
                });

                // 5. Ordenar por PROMEDIOS
                setLeaders({
                    mvp: [...processedPlayers].sort((a,b) => b.valpg - a.valpg).slice(0, 10),
                    puntos: [...processedPlayers].sort((a,b) => b.ppg - a.ppg).slice(0, 10),
                    rebotes: [...processedPlayers].sort((a,b) => b.rpg - a.rpg).slice(0, 10),
                    asistencias: [...processedPlayers].sort((a,b) => b.apg - a.apg).slice(0, 10),
                    triples: [...processedPlayers].sort((a,b) => b.tpg - a.tpg).slice(0, 10),
                });

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const LeaderCard = ({ title, data, icon, color, label }: any) => (
        <div style={{background:'white', borderRadius:'12px', padding:'20px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)', borderTop:`4px solid ${color}`}}>
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
                <span style={{fontSize:'1.5rem'}}>{icon}</span>
                <h3 style={{margin:0, color:'#374151', fontSize:'1.1rem', textTransform:'uppercase'}}>{title}</h3>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {data.map((p: PlayerStat, i: number) => (
                    <div key={p.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: i<9?'1px solid #f3f4f6':'none', paddingBottom: i<9?'8px':'0'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <span style={{fontWeight:'bold', color: i===0?color:'#9ca3af', width:'20px', fontSize: i===0?'1.2rem':'1rem'}}>{i+1}</span>
                            {p.logoUrl ? 
                                <img src={p.logoUrl} style={{width:'28px', height:'28px', borderRadius:'50%', border:'1px solid #eee'}} alt=""/> :
                                <span style={{fontSize:'1.2rem'}}>👤</span>
                            }
                            <div>
                                <div style={{fontWeight:'bold', fontSize:'0.9rem', color:'#1f2937'}}>{p.nombre}</div>
                                <div style={{fontSize:'0.75rem', color:'#6b7280'}}>
                                    {p.equipo} • <span style={{fontSize:'0.7rem'}}>({p.partidosJugados} JJ)</span>
                                </div>
                            </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                            <div style={{fontWeight:'900', fontSize:'1.2rem', color:color}}>
                                {title.includes('MVP') ? p.valpg : 
                                 title.includes('Puntos') ? p.ppg : 
                                 title.includes('Rebotes') ? p.rpg : 
                                 title.includes('Asistencias') ? p.apg : p.tpg}
                            </div>
                            <div style={{fontSize:'0.6rem', color:'#999', fontWeight:'bold'}}>{label}</div>
                        </div>
                    </div>
                ))}
                {data.length === 0 && <div style={{color:'#999', textAlign:'center', fontSize:'0.9rem'}}>Sin datos</div>}
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f3f4f6', zIndex:1500,
            display:'flex', flexDirection:'column', overflow:'hidden'
        }}>
            <div style={{padding:'15px 20px', background:'white', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.2rem'}}>📊 Estadísticas (Promedios)</h2>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                <div style={{maxWidth:'1000px', margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                    <LeaderCard title="🏆 Carrera MVP" data={leaders.mvp} icon="👑" color="#eab308" label="VAL/J" />
                    <LeaderCard title="🔥 Puntos" data={leaders.puntos} icon="🏀" color="#ef4444" label="PPP" />
                    <LeaderCard title="🖐️ Rebotes" data={leaders.rebotes} icon="🛡️" color="#10b981" label="RPP" />
                    <LeaderCard title="🅰️ Asistencias" data={leaders.asistencias} icon="👟" color="#3b82f6" label="APP" />
                    <LeaderCard title="🎯 Triples" data={leaders.triples} icon="👌" color="#8b5cf6" label="TPP" />
                </div>
            </div>
        </div>
    );
};
export default StatsViewer;