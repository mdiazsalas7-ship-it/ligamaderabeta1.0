import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, setDoc, getDocs, query, where } from 'firebase/firestore';

interface PlayerStat {
    playerId: string;
    nombre: string;
    numero: number;
    puntos: number;
    rebotes: number;
    asistencias: number;
    triples: number;
    faltas: number;
}

const MatchDetailViewer: React.FC<{ matchId: string, onClose: () => void }> = ({ matchId, onClose }) => {
    const [match, setMatch] = useState<any>(null);
    const [statsA, setStatsA] = useState<PlayerStat[]>([]);
    const [statsB, setStatsB] = useState<PlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'A'|'B'>('A'); // Pestaña para cambiar de equipo

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Cargar datos del Partido (Roster y Equipos)
                const matchRef = doc(db, 'calendario', matchId);
                const matchSnap = await getDoc(matchRef);
                
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatch({ id: matchSnap.id, ...data });

                    // Identificar IDs de los equipos
                    const idA = data.equipoLocalId || Object.keys(data.forma5 || {})[0];
                    const idB = data.equipoVisitanteId || Object.keys(data.forma5 || {})[1];

                    // 2. Preparar Rosters vacíos desde la Forma 5 guardada
                    const rosterA = data.forma5?.[idA] || [];
                    const rosterB = data.forma5?.[idB] || [];

                    // 3. Buscar si YA existen estadísticas guardadas para este partido
                    const statsQuery = query(collection(db, 'stats_partido'), where('partidoId', '==', matchId));
                    const statsSnap = await getDocs(statsQuery);
                    const statsMap: Record<string, any> = {};
                    statsSnap.forEach(s => { statsMap[s.data().jugadorId] = s.data(); });

                    // 4. Fusionar Roster con Stats existentes (o ceros)
                    const mapToStat = (player: any) => ({
                        playerId: player.id,
                        nombre: player.nombre,
                        numero: player.numero,
                        puntos: statsMap[player.id]?.puntos || 0,
                        rebotes: statsMap[player.id]?.rebotes || 0,
                        asistencias: statsMap[player.id]?.asistencias || 0,
                        triples: statsMap[player.id]?.triples || 0,
                        faltas: statsMap[player.id]?.faltas || 0,
                    });

                    setStatsA(rosterA.map(mapToStat));
                    setStatsB(rosterB.map(mapToStat));
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [matchId]);

    // Función para manejar cambios en los inputs
    const handleChange = (team: 'A'|'B', index: number, field: keyof PlayerStat, value: string) => {
        const val = parseInt(value) || 0;
        if (team === 'A') {
            const newStats = [...statsA];
            newStats[index] = { ...newStats[index], [field]: val };
            setStatsA(newStats);
        } else {
            const newStats = [...statsB];
            newStats[index] = { ...newStats[index], [field]: val };
            setStatsB(newStats);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const allStats = [...statsA, ...statsB];
            const batchPromises = allStats.map(stat => {
                // Solo guardamos si el jugador jugó o tiene stats (opcional, aquí guardamos todos para asegurar)
                const statId = `${matchId}_${stat.playerId}`;
                const equipoNombre = statsA.includes(stat) ? match.equipoLocalNombre : match.equipoVisitanteNombre;
                
                return setDoc(doc(db, 'stats_partido', statId), {
                    partidoId: matchId,
                    jugadorId: stat.playerId,
                    nombre: stat.nombre,
                    numero: stat.numero,
                    equipo: equipoNombre,
                    puntos: stat.puntos,
                    rebotes: stat.rebotes,
                    asistencias: stat.asistencias,
                    triples: stat.triples,
                    faltas: stat.faltas,
                    fecha: match.fecha || new Date().toISOString()
                });
            });

            await Promise.all(batchPromises);
            alert("✅ Estadísticas guardadas correctamente. ¡La tabla de líderes se actualizará!");
            onClose();
        } catch (e) {
            console.error(e);
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{padding:'40px', color:'white', textAlign:'center'}}>Cargando planilla...</div>;

    return (
        <div className="animate-fade-in" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', 
            zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white', width: '100%', maxWidth: '900px', height: '90vh', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* CABECERA */}
                <div style={{padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'var(--primary)', color:'white'}}>
                    <div>
                        <h2 style={{margin: 0, fontSize: '1.2rem'}}>📝 Hoja de Anotación</h2>
                        <span style={{fontSize: '0.9rem', opacity: 0.9}}>{match?.equipoLocalNombre} vs {match?.equipoVisitanteNombre}</span>
                    </div>
                    <button onClick={onClose} className="btn btn-secondary" style={{background:'rgba(255,255,255,0.2)', color:'white', border:'none'}}>Cerrar</button>
                </div>

                {/* TABS EQUIPOS */}
                <div style={{display:'flex', borderBottom:'1px solid #ddd'}}>
                    <button 
                        onClick={()=>setActiveTab('A')} 
                        style={{flex:1, padding:'15px', border:'none', background: activeTab==='A' ? 'white' : '#f5f5f5', fontWeight:'bold', borderBottom: activeTab==='A' ? '3px solid var(--primary)' : 'none', cursor:'pointer'}}
                    >
                        🏠 {match?.equipoLocalNombre || 'Local'}
                    </button>
                    <button 
                        onClick={()=>setActiveTab('B')} 
                        style={{flex:1, padding:'15px', border:'none', background: activeTab==='B' ? 'white' : '#f5f5f5', fontWeight:'bold', borderBottom: activeTab==='B' ? '3px solid var(--accent)' : 'none', cursor:'pointer'}}
                    >
                        ✈️ {match?.equipoVisitanteNombre || 'Visitante'}
                    </button>
                </div>

                {/* TABLA EDITABLE */}
                <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{background: '#f8f9fa', color: '#666', fontSize: '0.8rem', textTransform: 'uppercase'}}>
                                <th style={{padding: '10px', textAlign: 'left'}}>#</th>
                                <th style={{padding: '10px', textAlign: 'left'}}>Jugador</th>
                                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>PTS</th>
                                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>REB</th>
                                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>AST</th>
                                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>3PT</th>
                                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>FAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeTab === 'A' ? statsA : statsB).map((stat, idx) => (
                                <tr key={stat.playerId} style={{borderBottom: '1px solid #eee'}}>
                                    <td style={{padding: '10px', fontWeight: 'bold', color: '#888'}}>{stat.numero}</td>
                                    <td style={{padding: '10px', fontWeight: '600'}}>{stat.nombre}</td>
                                    {['puntos', 'rebotes', 'asistencias', 'triples', 'faltas'].map((field) => (
                                        <td key={field} style={{padding: '5px'}}>
                                            <input 
                                                type="number" 
                                                value={(stat as any)[field]} 
                                                onChange={(e) => handleChange(activeTab, idx, field as any, e.target.value)}
                                                style={{
                                                    width: '100%', padding: '8px', textAlign: 'center', 
                                                    borderRadius: '6px', border: '1px solid #ddd',
                                                    fontWeight: field === 'puntos' ? 'bold' : 'normal',
                                                    color: field === 'puntos' ? 'var(--primary)' : 'inherit',
                                                    backgroundColor: (stat as any)[field] > 0 ? '#f0f9ff' : 'white'
                                                }}
                                                min="0"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER GUARDAR */}
                <div style={{padding: '20px', borderTop: '1px solid #eee', textAlign: 'right', background:'#f9fafb'}}>
                    <div style={{marginBottom:'10px', fontSize:'0.9rem', color:'#666'}}>
                        Total Puntos Equipo: <b>{(activeTab === 'A' ? statsA : statsB).reduce((acc, s) => acc + s.puntos, 0)}</b>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="btn btn-primary" 
                        style={{padding: '12px 30px', fontSize: '1rem', width: '100%'}}
                    >
                        {saving ? 'Guardando...' : '💾 Guardar Estadísticas'}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default MatchDetailViewer;