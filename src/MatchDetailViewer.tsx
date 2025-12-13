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
    robos: number;
    bloqueos: number;
    faltas: number;
    triples: number;
}

// AHORA RECIBIMOS EL "ROL" COMO PROPIEDAD
const MatchDetailViewer: React.FC<{ matchId: string, onClose: () => void, rol: string }> = ({ matchId, onClose, rol }) => {
    const [match, setMatch] = useState<any>(null);
    const [statsA, setStatsA] = useState<PlayerStat[]>([]);
    const [statsB, setStatsB] = useState<PlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'A'|'B'>('A');

    useEffect(() => {
        const loadData = async () => {
            try {
                const matchRef = doc(db, 'calendario', matchId);
                const matchSnap = await getDoc(matchRef);
                
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatch({ id: matchSnap.id, ...data });

                    const idA = data.equipoLocalId || Object.keys(data.forma5 || {})[0];
                    const idB = data.equipoVisitanteId || Object.keys(data.forma5 || {})[1];
                    const rosterA = data.forma5?.[idA] || [];
                    const rosterB = data.forma5?.[idB] || [];

                    const statsQuery = query(collection(db, 'stats_partido'), where('partidoId', '==', matchId));
                    const statsSnap = await getDocs(statsQuery);
                    const statsMap: Record<string, any> = {};
                    statsSnap.forEach(s => { statsMap[s.data().jugadorId] = s.data(); });

                    const mapToStat = (player: any) => {
                        const saved = statsMap[player.id] || {};
                        const faltasTotales = (saved.faltasPersonales || 0) + (saved.faltasTecnicas || 0) + (saved.faltasAntideportivas || 0);
                        const faltasFinal = saved.faltas || faltasTotales || 0;
                        return {
                            playerId: player.id,
                            nombre: player.nombre,
                            numero: player.numero,
                            puntos: Number(saved.puntos || 0),
                            rebotes: Number(saved.rebotes || 0),
                            asistencias: Number(saved.asistencias || 0),
                            robos: Number(saved.robos || 0),
                            bloqueos: Number(saved.bloqueos || 0),
                            faltas: Number(faltasFinal),
                            triples: Number(saved.triples || 0),
                        };
                    };

                    setStatsA(rosterA.map(mapToStat));
                    setStatsB(rosterB.map(mapToStat));
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [matchId]);

    const handleChange = (team: 'A'|'B', index: number, field: keyof PlayerStat, value: string) => {
        if (rol !== 'admin') return; // SEGURIDAD: Solo admin puede editar

        const val = value === '' ? 0 : parseInt(value);
        if (team === 'A') {
            const newStats = [...statsA];
            newStats[index] = { ...newStats[index], [field]: isNaN(val) ? 0 : val };
            setStatsA(newStats);
        } else {
            const newStats = [...statsB];
            newStats[index] = { ...newStats[index], [field]: isNaN(val) ? 0 : val };
            setStatsB(newStats);
        }
    };

    const handleSave = async () => {
        if (rol !== 'admin') return; // SEGURIDAD

        setSaving(true);
        try {
            const allStats = [...statsA, ...statsB];
            const batchPromises = allStats.map(stat => {
                const statId = `${matchId}_${stat.playerId}`;
                const equipoNombre = statsA.includes(stat) ? match.equipoLocalNombre : match.equipoVisitanteNombre;
                return setDoc(doc(db, 'stats_partido', statId), {
                    partidoId: matchId, jugadorId: stat.playerId, nombre: stat.nombre, numero: stat.numero,
                    equipo: equipoNombre || 'Desconocido',
                    puntos: Number(stat.puntos), rebotes: Number(stat.rebotes), asistencias: Number(stat.asistencias),
                    robos: Number(stat.robos), bloqueos: Number(stat.bloqueos), faltas: Number(stat.faltas), triples: Number(stat.triples),
                    fecha: match.fechaAsignada || new Date().toISOString()
                }, { merge: true });
            });
            await Promise.all(batchPromises);
            alert("✅ Estadísticas actualizadas.");
            onClose();
        } catch (e) { console.error(e); alert("Error al guardar."); } finally { setSaving(false); }
    };

    // CÁLCULO DEL MVP DEL PARTIDO (Solo local)
    const getValuation = (s: PlayerStat) => s.puntos + s.rebotes + s.asistencias + s.robos + s.bloqueos;
    const gameMVP = [...statsA, ...statsB].sort((a,b) => getValuation(b) - getValuation(a))[0];

    if (loading) return <div style={{padding:'40px', color:'white', textAlign:'center'}}>Cargando Box Score...</div>;

    return (
        <div className="animate-fade-in" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', 
            zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white', width: '100%', maxWidth: '1000px', height: '90vh', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* CABECERA */}
                <div style={{padding: '20px', background:'var(--primary)', color:'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                        <h2 style={{margin: 0, fontSize: '1.2rem'}}>📝 Box Score Oficial</h2>
                        <span style={{fontSize: '0.9rem', opacity: 0.9}}>
                            {match?.equipoLocalNombre} {match?.marcadorLocal} - {match?.marcadorVisitante} {match?.equipoVisitanteNombre}
                        </span>
                    </div>
                    <button onClick={onClose} className="btn" style={{background:'rgba(255,255,255,0.2)', color:'white', border:'none'}}>Cerrar</button>
                </div>

                {/* TARJETA MVP DEL JUEGO */}
                {gameMVP && getValuation(gameMVP) > 0 && (
                    <div style={{
                        background: 'linear-gradient(to right, #0f172a, #334155)', color:'white', padding:'15px 20px',
                        display:'flex', alignItems:'center', gap:'20px', borderBottom:'4px solid #fbbf24'
                    }}>
                        <div style={{fontSize:'2.5rem'}}>🏆</div>
                        <div>
                            <div style={{fontSize:'0.8rem', color:'#fbbf24', fontWeight:'bold', letterSpacing:'1px'}}>MVP DEL PARTIDO</div>
                            <div style={{fontSize:'1.3rem', fontWeight:'bold'}}>{gameMVP.nombre}</div>
                            <div style={{fontSize:'0.9rem', color:'#cbd5e1'}}>
                                {statsA.includes(gameMVP) ? match?.equipoLocalNombre : match?.equipoVisitanteNombre}
                            </div>
                        </div>
                        <div style={{marginLeft:'auto', textAlign:'right'}}>
                            <div style={{fontSize:'1.8rem', fontWeight:'bold', color:'#fbbf24'}}>{getValuation(gameMVP)}</div>
                            <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>VALORACIÓN</div>
                        </div>
                        <div style={{borderLeft:'1px solid #475569', paddingLeft:'15px', display:'flex', gap:'15px', fontSize:'0.9rem'}}>
                            <div><b>{gameMVP.puntos}</b> PTS</div>
                            <div><b>{gameMVP.rebotes}</b> REB</div>
                            <div><b>{gameMVP.asistencias}</b> AST</div>
                        </div>
                    </div>
                )}

                {/* TABS EQUIPOS */}
                <div style={{display:'flex', borderBottom:'1px solid #ddd'}}>
                    <button onClick={()=>setActiveTab('A')} style={{flex:1, padding:'15px', border:'none', background: activeTab==='A' ? 'white' : '#f5f5f5', fontWeight:'bold', borderBottom: activeTab==='A' ? '3px solid var(--primary)' : 'none', cursor:'pointer', color:'#333'}}>
                        🏠 {match?.equipoLocalNombre}
                    </button>
                    <button onClick={()=>setActiveTab('B')} style={{flex:1, padding:'15px', border:'none', background: activeTab==='B' ? 'white' : '#f5f5f5', fontWeight:'bold', borderBottom: activeTab==='B' ? '3px solid var(--accent)' : 'none', cursor:'pointer', color:'#333'}}>
                        ✈️ {match?.equipoVisitanteNombre}
                    </button>
                </div>

                {/* TABLA DE ESTADÍSTICAS */}
                <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{background: '#f8f9fa', color: '#666', fontSize: '0.8rem', textTransform: 'uppercase'}}>
                                <th style={{padding: '10px', textAlign: 'left'}}>#</th>
                                <th style={{padding: '10px', textAlign: 'left'}}>Jugador</th>
                                <th style={{padding: '5px', textAlign: 'center', width: '50px', color:'var(--primary)'}}>PTS</th>
                                <th style={{padding: '5px', textAlign: 'center', width: '50px'}}>REB</th>
                                <th style={{padding: '5px', textAlign: 'center', width: '50px'}}>AST</th>
                                <th style={{padding: '5px', textAlign: 'center', width: '50px'}}>ROB</th>
                                <th style={{padding: '5px', textAlign: 'center', width: '50px'}}>BLK</th>
                                <th style={{padding: '5px', textAlign: 'center', width: '50px'}}>FAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeTab === 'A' ? statsA : statsB).map((stat, idx) => (
                                <tr key={stat.playerId} style={{borderBottom: '1px solid #eee'}}>
                                    <td style={{padding: '10px', fontWeight: 'bold', color: '#888'}}>{stat.numero}</td>
                                    <td style={{padding: '10px', fontWeight: '600', fontSize:'0.9rem'}}>{stat.nombre}</td>
                                    
                                    {['puntos', 'rebotes', 'asistencias', 'robos', 'bloqueos', 'faltas'].map((field) => (
                                        <td key={field} style={{padding: '5px'}}>
                                            <input 
                                                type="number" 
                                                value={(stat as any)[field]} 
                                                // 🔒 BLOQUEO: Si no es admin, readOnly es true
                                                readOnly={rol !== 'admin'}
                                                onChange={(e) => handleChange(activeTab, idx, field as any, e.target.value)}
                                                style={{
                                                    width: '100%', padding: '6px', textAlign: 'center', 
                                                    borderRadius: '4px', 
                                                    border: rol === 'admin' ? '1px solid #ddd' : 'none',
                                                    // Estilo visual de "Solo lectura" si no es admin
                                                    backgroundColor: rol !== 'admin' ? 'transparent' : ((stat as any)[field] > 0 ? (field==='puntos'?'#eff6ff':'#f9fafb') : 'white'),
                                                    fontWeight: field === 'puntos' ? 'bold' : 'normal',
                                                    color: field === 'puntos' ? 'var(--primary)' : '#444'
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

                {/* FOOTER (Solo visible para Admin) */}
                {rol === 'admin' ? (
                    <div style={{padding: '20px', borderTop: '1px solid #eee', textAlign: 'right', background:'#f9fafb', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                         <div style={{fontSize:'0.8rem', color:'#ef4444'}}>* Modo Edición Activo (Admin)</div>
                        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{padding: '12px 30px', fontSize: '1rem'}}>
                            {saving ? 'Guardando...' : '💾 Guardar Correcciones'}
                        </button>
                    </div>
                ) : (
                    <div style={{padding: '15px', borderTop: '1px solid #eee', textAlign: 'center', background:'#f9fafb', color:'#666', fontSize:'0.85rem'}}>
                        🔒 Datos oficiales verificados. Solo el administrador puede modificar esta acta.
                    </div>
                )}
            </div>
        </div>
    );
};
export default MatchDetailViewer;