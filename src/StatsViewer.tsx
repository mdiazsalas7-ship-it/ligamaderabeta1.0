import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerStat {
    id: string; 
    jugadorId: string;
    nombre: string;
    equipo: string;
    puntos: number;
    rebotes: number;
    asistencias: number;
    robos: number;
    bloqueos: number;
    faltas: number;
    triples: number;
    partidosJugados: number;
    valoracion: number; // Nueva métrica para MVP
    logoUrl?: string;
}

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [leaders, setLeaders] = useState<{
        mvp: PlayerStat[],
        puntos: PlayerStat[], // RESTAURADO
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

                // 2. Obtener Stats
                const statsSnap = await getDocs(collection(db, 'stats_partido'));
                const rawStats: any[] = statsSnap.docs.map(d => d.data());

                // 3. Agrupar
                const aggregated: Record<string, PlayerStat> = {};

                rawStats.forEach(stat => {
                    if (!aggregated[stat.jugadorId]) {
                        aggregated[stat.jugadorId] = {
                            id: stat.jugadorId,
                            jugadorId: stat.jugadorId,
                            nombre: stat.nombre,
                            equipo: stat.equipo,
                            puntos: 0, rebotes: 0, asistencias: 0, robos: 0, bloqueos: 0, faltas: 0, triples: 0,
                            partidosJugados: 0,
                            valoracion: 0,
                            logoUrl: undefined
                        };
                    }
                    const acc = aggregated[stat.jugadorId];
                    acc.puntos += (stat.puntos || 0);
                    acc.rebotes += (stat.rebotes || 0);
                    acc.asistencias += (stat.asistencias || 0);
                    acc.robos += (stat.robos || 0);
                    acc.bloqueos += (stat.bloqueos || 0);
                    acc.faltas += (stat.faltas || 0);
                    acc.triples += (stat.triples || 0);
                    acc.partidosJugados += 1;
                    acc.logoUrl = teamLogos[stat.equipo] || undefined;
                });

                // Calcular Valoración (MVP Score) para cada jugador
                // Fórmula simple: (PTS + REB + AST + ROB + BLK) - FAL
                Object.values(aggregated).forEach(p => {
                    p.valoracion = (p.puntos + p.rebotes + p.asistencias + p.robos + p.bloqueos) - p.faltas;
                });

                const allPlayers = Object.values(aggregated);

                // 4. Ordenar Categorías
                setLeaders({
                    // MVP: Ordenado por VALORACIÓN (Eficiencia)
                    mvp: [...allPlayers].sort((a,b) => b.valoracion - a.valoracion).slice(0, 10),
                    // PUNTOS: Ordenado por PUNTOS Puros (Restaurado)
                    puntos: [...allPlayers].sort((a,b) => b.puntos - a.puntos).slice(0, 10),
                    rebotes: [...allPlayers].sort((a,b) => b.rebotes - a.rebotes).slice(0, 10),
                    asistencias: [...allPlayers].sort((a,b) => b.asistencias - a.asistencias).slice(0, 10),
                    triples: [...allPlayers].sort((a,b) => b.triples - a.triples).slice(0, 10),
                });

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const LeaderCard = ({ title, data, icon, color }: any) => (
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
                                <div style={{fontSize:'0.75rem', color:'#6b7280'}}>{p.equipo}</div>
                            </div>
                        </div>
                        <div style={{fontWeight:'900', fontSize:'1.1rem', color:color}}>
                            {/* Mostrar el dato relevante según la tabla */}
                            {title.includes('MVP') ? p.valoracion : 
                             title.includes('Puntos') ? p.puntos : 
                             title.includes('Rebotes') ? p.rebotes : 
                             title.includes('Asistencias') ? p.asistencias : p.triples}
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
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.2rem'}}>📊 Líderes de la Liga</h2>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                <div style={{maxWidth:'1000px', margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                    
                    {/* 1. MVP (Eficiencia) */}
                    <LeaderCard title="🏆 Carrera MVP (Valoración)" data={leaders.mvp} icon="👑" color="#eab308" />
                    
                    {/* 2. PUNTOS (Restaurado) */}
                    <LeaderCard title="🔥 Líderes en Puntos" data={leaders.puntos} icon="🏀" color="#ef4444" />
                    
                    {/* 3. OTRAS CATEGORÍAS */}
                    <LeaderCard title="🖐️ Rebotes" data={leaders.rebotes} icon="🛡️" color="#10b981" />
                    <LeaderCard title="🅰️ Asistencias" data={leaders.asistencias} icon="👟" color="#3b82f6" />
                    <LeaderCard title="🎯 Triples" data={leaders.triples} icon="👌" color="#8b5cf6" />
                </div>
            </div>
        </div>
    );
};
export default StatsViewer;