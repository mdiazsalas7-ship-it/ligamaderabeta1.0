import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

// Interfaz completa con todos los datos reales
interface PlayerStat { 
    id: string; // ID del jugador
    nombre: string; 
    equipo: string; 
    puntos: number; 
    rebotes: number;     // Nuevo
    asistencias: number; // Nuevo
    bloqueos: number;    // Nuevo
    robos: number;       // Nuevo
    partidos: number; 
    promedio: number;    // Promedio de la categoría actual
    logoUrl?: string; 
}

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [stats, setStats] = useState<PlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'puntos' | 'rebotes' | 'asistencias' | 'triples'>('puntos'); // Pestaña activa

    useEffect(() => {
        const fetchRealStats = async () => {
            try {
                // 1. Obtener Logos de Equipos
                const formasSnap = await getDocs(collection(db, 'forma21s'));
                const teamLogos: Record<string, string> = {};
                formasSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.nombreEquipo && data.logoUrl) {
                        teamLogos[String(data.nombreEquipo).trim()] = data.logoUrl;
                    }
                });

                // 2. Obtener TODAS las estadísticas reales jugadas (stats_partido)
                const statsSnap = await getDocs(collection(db, 'stats_partido'));
                
                if (statsSnap.empty) {
                    console.warn("No hay estadísticas registradas en 'stats_partido' todavía.");
                    setLoading(false);
                    return;
                }

                // 3. AGREGACIÓN (Sumar stats partido a partido)
                const acumulado: Record<string, PlayerStat> = {};

                statsSnap.forEach(doc => {
                    const s = doc.data();
                    const jugadorId = s.jugadorId;

                    // Si el jugador no está en la lista, lo inicializamos
                    if (!acumulado[jugadorId]) {
                        acumulado[jugadorId] = {
                            id: jugadorId,
                            nombre: s.nombre || 'Jugador',
                            equipo: s.equipo || 'Agente Libre',
                            puntos: 0, rebotes: 0, asistencias: 0, bloqueos: 0, robos: 0, partidos: 0, promedio: 0,
                            logoUrl: teamLogos[String(s.equipo).trim()] || null
                        };
                    }

                    // Sumamos sus números
                    acumulado[jugadorId].puntos += Number(s.puntos || 0);
                    acumulado[jugadorId].rebotes += Number(s.rebotes || 0);
                    acumulado[jugadorId].asistencias += Number(s.asistencias || 0);
                    acumulado[jugadorId].bloqueos += Number(s.bloqueos || 0);
                    acumulado[jugadorId].robos += Number(s.robos || 0);
                    acumulado[jugadorId].partidos += 1;
                });

                // Convertir objeto a array
                const listaFinal = Object.values(acumulado);
                setStats(listaFinal);

            } catch (e) { 
                console.error("Error calculando stats reales:", e); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchRealStats();
    }, []);

    // 4. Lógica de Ordenamiento y Visualización según la Pestaña
    const getSortedStats = () => {
        const sorted = [...stats];
        if (tab === 'puntos') return sorted.sort((a,b) => b.puntos - a.puntos);
        if (tab === 'rebotes') return sorted.sort((a,b) => b.rebotes - a.rebotes);
        if (tab === 'asistencias') return sorted.sort((a,b) => b.asistencias - a.asistencias);
        return sorted;
    };

    const statsToShow = getSortedStats().slice(0, 20); // Mostrar solo Top 20

    // Función auxiliar para saber qué valor mostrar en la columna principal
    const getMainValue = (s: PlayerStat) => {
        if (tab === 'puntos') return s.puntos;
        if (tab === 'rebotes') return s.rebotes;
        if (tab === 'asistencias') return s.asistencias;
        return 0;
    };

    const getPromedio = (s: PlayerStat) => {
        return (getMainValue(s) / s.partidos).toFixed(1);
    };

    return (
        <div className="animate-fade-in" style={{maxWidth:'900px', margin:'0 auto', paddingBottom:'40px'}}>
            
            {/* CABECERA */}
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <div>
                    <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.8rem', fontWeight:'800'}}>📊 Líderes de la Liga</h2>
                    <span style={{color:'var(--text-muted)', fontSize:'0.95rem'}}>Estadísticas Reales Acumuladas</span>
                </div>
                <button onClick={onClose} className="btn btn-secondary" style={{padding:'8px 16px'}}>← Volver</button>
            </div>

            {/* PESTAÑAS (TABS) */}
            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button 
                    onClick={() => setTab('puntos')}
                    className="btn"
                    style={{
                        background: tab === 'puntos' ? 'var(--primary)' : '#e2e8f0',
                        color: tab === 'puntos' ? 'white' : '#64748b',
                        flex: 1, minWidth: '100px'
                    }}
                >
                    🔥 Puntos
                </button>
                <button 
                    onClick={() => setTab('rebotes')}
                    className="btn"
                    style={{
                        background: tab === 'rebotes' ? 'var(--primary)' : '#e2e8f0',
                        color: tab === 'rebotes' ? 'white' : '#64748b',
                        flex: 1, minWidth: '100px'
                    }}
                >
                    🏀 Rebotes
                </button>
                <button 
                    onClick={() => setTab('asistencias')}
                    className="btn"
                    style={{
                        background: tab === 'asistencias' ? 'var(--primary)' : '#e2e8f0',
                        color: tab === 'asistencias' ? 'white' : '#64748b',
                        flex: 1, minWidth: '100px'
                    }}
                >
                    🅰️ Asistencias
                </button>
            </div>

            {loading ? (
                <div style={{textAlign:'center', padding:'40px', color:'var(--text-muted)'}}>Calculando números...</div>
            ) : stats.length === 0 ? (
                <div className="card" style={{textAlign:'center', padding:'40px'}}>
                    <p>No hay estadísticas registradas aún.</p>
                    <small>Usa la "Mesa Técnica" para registrar partidos y que aparezcan aquí.</small>
                </div>
            ) : (
                <div className="card" style={{padding:0, overflowX:'auto', border:'none', boxShadow:'0 10px 25px -5px rgba(0,0,0,0.1)', borderRadius:'12px'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', minWidth:'600px', background:'white'}}>
                        <thead>
                            <tr style={{background:'var(--primary)', color:'white', textAlign:'left', fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'0.05em'}}>
                                <th style={{padding:'18px 20px', width:'60px', textAlign:'center'}}>#</th>
                                <th style={{padding:'18px 20px'}}>Jugador</th>
                                <th style={{padding:'18px 20px'}}>Equipo</th>
                                <th style={{padding:'18px 20px', textAlign:'center'}}>PJ</th>
                                <th style={{padding:'18px 20px', textAlign:'center'}}>Prom</th>
                                <th style={{padding:'18px 20px', textAlign:'center', background:'var(--accent)', width:'80px'}}>
                                    {tab === 'puntos' ? 'PTS' : tab === 'rebotes' ? 'REB' : 'AST'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsToShow.map((s, index) => (
                                <tr key={s.id} style={{
                                    borderBottom:'1px solid #f1f5f9', 
                                    backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc',
                                    transition: 'background 0.2s'
                                }}>
                                    <td style={{padding:'15px 20px', textAlign:'center', fontWeight:'800', fontSize:'1.1rem', color: index < 3 ? 'var(--accent)' : '#cbd5e1'}}>
                                        {index + 1}
                                    </td>
                                    <td style={{padding:'15px 20px', fontWeight:'600', color:'var(--text-main)', fontSize:'1.05rem'}}>
                                        {s.nombre}
                                    </td>
                                    <td style={{padding:'15px 20px'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                                            {s.logoUrl ? 
                                                <img src={s.logoUrl} alt="Logo" style={{width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover', border:'1px solid #e2e8f0', background:'white'}} /> :
                                                <span style={{fontSize:'1.5rem'}}>🛡️</span>
                                            }
                                            <span style={{color:'#64748b', fontSize:'0.95rem', fontWeight:'500'}}>{s.equipo}</span>
                                        </div>
                                    </td>
                                    <td style={{padding:'15px 20px', textAlign:'center', color:'#64748b', fontWeight:'500'}}>{s.partidos}</td>
                                    <td style={{padding:'15px 20px', textAlign:'center', fontWeight:'700', color:'#475569'}}>{getPromedio(s)}</td>
                                    <td style={{padding:'15px 20px', textAlign:'center', fontWeight:'900', fontSize:'1.25rem', color:'var(--primary)', background:'#fff7ed'}}>
                                        {getMainValue(s)}
                                    </td>
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