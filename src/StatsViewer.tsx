import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerStat {
    id: string; // ID único compuesto (partidoId_jugadorId)
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
    logoUrl?: string;
}

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [leaders, setLeaders] = useState<{
        puntos: PlayerStat[],
        rebotes: PlayerStat[],
        asistencias: PlayerStat[],
        triples: PlayerStat[]
    }>({ points: [], rebotes: [], asistencias: [], triples: [] } as any);
    
    const [loading, setLoading] = useState(true);

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

                // 2. Obtener Todas las Stats
                const statsSnap = await getDocs(collection(db, 'stats_partido'));
                const rawStats: any[] = statsSnap.docs.map(d => d.data());

                // 3. Agrupar por Jugador
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
                    // Asignar logo
                    acc.logoUrl = teamLogos[stat.equipo] || undefined;
                });

                const allPlayers = Object.values(aggregated);

                // 4. Ordenar Categorías (Top 10)
                setLeaders({
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
                <h3 style={{margin:0, color:'#374151', fontSize:'1.1rem'}}>{title}</h3>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {data.map((p: PlayerStat, i: number) => (
                    <div key={p.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: i<9?'1px solid #f3f4f6':'none', paddingBottom: i<9?'8px':'0'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <span style={{fontWeight:'bold', color: i===0?color:'#9ca3af', width:'20px'}}>{i+1}</span>
                            {p.logoUrl && <img src={p.logoUrl} style={{width:'24px', height:'24px', borderRadius:'50%'}} alt=""/>}
                            <div>
                                <div style={{fontWeight:'bold', fontSize:'0.9rem', color:'#1f2937'}}>{p.nombre}</div>
                                <div style={{fontSize:'0.75rem', color:'#6b7280'}}>{p.equipo}</div>
                            </div>
                        </div>
                        <div style={{fontWeight:'bold', fontSize:'1.1rem', color:color}}>
                            {title === 'Líderes en Puntos' ? p.puntos : 
                             title === 'Rebotes' ? p.rebotes : 
                             title === 'Asistencias' ? p.asistencias : p.triples}
                        </div>
                    </div>
                ))}
                {data.length === 0 && <div style={{color:'#999', textAlign:'center', fontSize:'0.9rem'}}>Sin datos</div>}
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'1000px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'30px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.8rem'}}>📊 Estadísticas de la Liga</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'50px'}}>Cargando estadísticas...</div> : (
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                    <LeaderCard title="Líderes en Puntos" data={leaders.puntos} icon="🔥" color="#ef4444" />
                    <LeaderCard title="Rebotes" data={leaders.rebotes} icon="🖐️" color="#10b981" />
                    <LeaderCard title="Asistencias" data={leaders.asistencias} icon="🅰️" color="#3b82f6" />
                    <LeaderCard title="Triples" data={leaders.triples} icon="🎯" color="#8b5cf6" />
                </div>
            )}
        </div>
    );
};
export default StatsViewer;