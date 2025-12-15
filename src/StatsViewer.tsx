import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerStat {
    id: string; 
    jugadorId: string;
    nombre: string;
    equipo: string;
    // Totales
    totalPuntos: number;
    totalRebotes: number;
    totalAsistencias: number;
    totalTriples: number;
    totalValoracion: number;
    partidosJugados: number;
    // Promedios
    ppg: number; 
    rpg: number; 
    apg: number; 
    tpg: number; 
    valpg: number; 
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
    
    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Obtener Logos de Equipos
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
                            // Asignamos el logo aquí
                            logoUrl: teamLogos[stat.equipo] || DEFAULT_LOGO
                        };
                    }
                    const acc = aggregated[stat.jugadorId];
                    acc.totalPuntos += (Number(stat.puntos) || 0);
                    acc.totalRebotes += (Number(stat.rebotes) || 0);
                    acc.totalAsistencias += (Number(stat.asistencias) || 0);
                    acc.totalRobos += (Number(stat.robos) || 0);
                    acc.totalBloqueos += (Number(stat.bloqueos) || 0);
                    acc.totalFaltas += (Number(stat.faltas) || 0);
                    acc.totalTriples += (Number(stat.triples) || 0);
                    // Contamos partidos únicos (asumiendo que viene una stat por jugador por partido)
                    acc.partidosJugados += 1;
                });

                // 4. Calcular Promedios
                const processedPlayers: PlayerStat[] = Object.values(aggregated).map((p: any) => {
                    const games = p.partidosJugados || 1; 
                    
                    // Valoración (Eficiencia simple)
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

                // 5. Ordenar y Cortar (Top 10)
                // Filtramos jugadores con 0 partidos o stats vacías para limpiar la lista
                const activePlayers = processedPlayers.filter(p => p.partidosJugados > 0);

                setLeaders({
                    mvp: [...activePlayers].sort((a,b) => b.valpg - a.valpg).slice(0, 10),
                    puntos: [...activePlayers].sort((a,b) => b.ppg - a.ppg).slice(0, 10),
                    rebotes: [...activePlayers].sort((a,b) => b.rpg - a.rpg).slice(0, 10),
                    asistencias: [...activePlayers].sort((a,b) => b.apg - a.apg).slice(0, 10),
                    triples: [...activePlayers].sort((a,b) => b.tpg - a.tpg).slice(0, 10),
                });

            } catch (error) {
                console.error("Error calculando líderes:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const LeaderCard = ({ title, data, icon, color, label }: any) => (
        <div style={{
            background:'white', borderRadius:'12px', padding:'20px', 
            boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)', borderTop:`4px solid ${color}`,
            display: 'flex', flexDirection: 'column', height: '100%'
        }}>
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px', paddingBottom:'10px', borderBottom:'1px solid #f3f4f6'}}>
                <span style={{fontSize:'1.8rem'}}>{icon}</span>
                <h3 style={{margin:0, color:'#1f2937', fontSize:'1.1rem', textTransform:'uppercase', letterSpacing:'0.5px'}}>{title}</h3>
            </div>
            
            <div style={{display:'flex', flexDirection:'column', gap:'12px', flex:1}}>
                {data.map((p: PlayerStat, i: number) => {
                    // Colores de medalla para el Top 3
                    const rankColor = i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#6b7280';
                    const isTop1 = i === 0;

                    return (
                        <div key={p.id} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between', 
                            background: isTop1 ? '#fdf8e8' : 'transparent', // Resaltar al #1
                            padding: isTop1 ? '8px' : '0', borderRadius: isTop1 ? '8px' : '0'
                        }}>
                            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                                {/* RANGO */}
                                <div style={{
                                    fontWeight:'900', color: rankColor, width:'20px', textAlign:'center',
                                    fontSize: isTop1 ? '1.2rem' : '0.9rem'
                                }}>
                                    {i+1}
                                </div>
                                
                                {/* LOGO EQUIPO */}
                                <div style={{
                                    width: isTop1 ? '35px' : '28px', height: isTop1 ? '35px' : '28px', 
                                    borderRadius:'50%', border:'1px solid #e5e7eb', background:'white',
                                    display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'
                                }}>
                                    <img 
                                        src={p.logoUrl || DEFAULT_LOGO} 
                                        style={{width:'100%', height:'100%', objectFit:'cover'}} 
                                        alt={p.equipo}
                                        onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}
                                    />
                                </div>

                                {/* INFO JUGADOR */}
                                <div>
                                    <div style={{fontWeight:'bold', fontSize: isTop1 ? '0.95rem' : '0.85rem', color:'#111827'}}>
                                        {p.nombre}
                                    </div>
                                    <div style={{fontSize:'0.7rem', color:'#6b7280'}}>
                                        {p.equipo}
                                    </div>
                                </div>
                            </div>

                            {/* VALOR ESTADÍSTICO */}
                            <div style={{textAlign:'right'}}>
                                <div style={{fontWeight:'900', fontSize: isTop1 ? '1.3rem' : '1rem', color: color}}>
                                    {title.includes('MVP') ? p.valpg : 
                                     title.includes('Puntos') ? p.ppg : 
                                     title.includes('Rebotes') ? p.rpg : 
                                     title.includes('Asistencias') ? p.apg : p.tpg}
                                </div>
                                {isTop1 && <div style={{fontSize:'0.6rem', color:'#9ca3af', fontWeight:'bold', textTransform:'uppercase'}}>{label}</div>}
                            </div>
                        </div>
                    );
                })}
                {data.length === 0 && <div style={{color:'#9ca3af', textAlign:'center', padding:'20px', fontStyle:'italic'}}>No hay datos registrados aún.</div>}
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', zIndex:2000,
            display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'
        }}>
            <div style={{
                background:'#f3f4f6', width:'100%', maxWidth:'1200px', height:'90vh', borderRadius:'12px',
                display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                {/* HEADER PROFESIONAL */}
                <div style={{
                    padding:'20px 30px', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', 
                    color:'white', display:'flex', justifyContent:'space-between', alignItems:'center',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10
                }}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                        <span style={{fontSize:'2rem'}}>📊</span>
                        <div>
                            <h2 style={{margin:0, fontSize:'1.5rem', fontWeight:'800', letterSpacing:'-0.025em'}}>Líderes de la Liga</h2>
                            <span style={{opacity:0.8, fontSize:'0.85rem'}}>Promedios por Partido • Temporada Regular</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{
                        background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.2)', 
                        borderRadius:'50%', width:'36px', height:'36px', cursor:'pointer', fontSize:'1.2rem',
                        display:'flex', alignItems:'center', justifyContent:'center'
                    }}>✕</button>
                </div>

                <div style={{flex:1, overflowY:'auto', padding:'25px'}}>
                    {loading ? (
                        <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100%', color:'#6b7280'}}>
                            Calculando estadísticas...
                        </div>
                    ) : (
                        <div style={{
                            display:'grid', 
                            gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', 
                            gap:'25px', paddingBottom:'20px'
                        }}>
                            {/* COLUMNA MVP (Destacada) */}
                            <div style={{gridColumn: '1 / -1', maxWidth:'600px', margin:'0 auto', width:'100%'}}>
                                <LeaderCard title="🏆 Carrera por el MVP" data={leaders.mvp} icon="👑" color="#eab308" label="VAL" />
                            </div>

                            <LeaderCard title="🔥 Máximos Anotadores" data={leaders.puntos} icon="🏀" color="#ef4444" label="PTS" />
                            <LeaderCard title="🖐️ Líderes en Rebotes" data={leaders.rebotes} icon="🛡️" color="#10b981" label="REB" />
                            <LeaderCard title="👟 Líderes en Asistencias" data={leaders.asistencias} icon="🅰️" color="#3b82f6" label="AST" />
                            <LeaderCard title="🎯 Francotiradores (3PT)" data={leaders.triples} icon="👌" color="#8b5cf6" label="3PM" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default StatsViewer;