import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, setDoc, getDocs, query, where } from 'firebase/firestore';
import { generarActaPDF } from './ActaGenerator'; // <--- 1. IMPORTANTE: AGREGAR ESTO

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

const MatchDetailViewer: React.FC<{ matchId: string, onClose: () => void, rol: string }> = ({ matchId, onClose, rol }) => {
    const [match, setMatch] = useState<any>(null);
    const [logos, setLogos] = useState<{local: string, visitante: string}>({ local: '', visitante: '' });
    const [statsA, setStatsA] = useState<PlayerStat[]>([]);
    const [statsB, setStatsB] = useState<PlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'A'|'B'>('A');

    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    useEffect(() => {
        const loadData = async () => {
            try {
                const matchRef = doc(db, 'calendario', matchId);
                const matchSnap = await getDoc(matchRef);
                
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatch({ id: matchSnap.id, ...data });

                    // Cargar Logos
                    const qEquipos = query(collection(db, 'equipos'));
                    const equiposSnap = await getDocs(qEquipos);
                    let logoL = DEFAULT_LOGO;
                    let logoV = DEFAULT_LOGO;

                    equiposSnap.forEach(d => {
                        const eq = d.data();
                        if (eq.nombre === data.equipoLocalNombre && eq.logoUrl) logoL = eq.logoUrl;
                        if (eq.nombre === data.equipoVisitanteNombre && eq.logoUrl) logoV = eq.logoUrl;
                    });
                    setLogos({ local: logoL, visitante: logoV });

                    const idA = data.equipoLocalId;
                    const idB = data.equipoVisitanteId;

                    // Extracción segura de rosters
                    const getRoster = (teamId: string) => {
                        if (!data.forma5 || !teamId) return [];
                        const raw = data.forma5[teamId];
                        if (Array.isArray(raw)) return raw;
                        if (raw?.jugadores) return raw.jugadores;
                        return [];
                    };

                    const rosterA = getRoster(idA);
                    const rosterB = getRoster(idB);

                    const statsQuery = query(collection(db, 'stats_partido'), where('partidoId', '==', matchId));
                    const statsSnap = await getDocs(statsQuery);
                    const statsMap: Record<string, any> = {};
                    statsSnap.forEach(s => { statsMap[s.data().jugadorId] = s.data(); });

                    const mapToStat = (player: any) => {
                        const saved = statsMap[player.id] || {};
                        const faltasTotales = (saved.faltasPersonales || 0) + (saved.faltasTecnicas || 0) + (saved.faltasAntideportivas || 0) + (saved.faltasDescalificantes || 0);
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

                    setStatsA(rosterA.map(mapToStat).sort((a:any, b:any) => b.puntos - a.puntos));
                    setStatsB(rosterB.map(mapToStat).sort((a:any, b:any) => b.puntos - a.puntos));
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [matchId]);

    const handleChange = (team: 'A'|'B', index: number, field: keyof PlayerStat, value: string) => {
        if (rol !== 'admin') return; 

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
        if (rol !== 'admin') return; 
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
                {/* CABECERA CON LOGOS */}
                <div style={{
                    padding: '20px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                    color: 'white', display: 'flex', flexDirection:'column', alignItems: 'center', position:'relative'
                }}>
                    <button onClick={onClose} style={{position:'absolute', top:'15px', right:'15px', background:'rgba(255,255,255,0.2)', color:'white', border:'none', width:'30px', height:'30px', borderRadius:'50%', cursor:'pointer'}}>✕</button>
                    
                    <div style={{fontSize:'0.8rem', color:'#94a3b8', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'10px'}}>RESULTADO FINAL</div>
                    
                    <div style={{display:'flex', alignItems:'center', gap:'30px', width:'100%', justifyContent:'center'}}>
                        {/* LOCAL */}
                        <div style={{textAlign:'center', width:'150px'}}>
                            <div style={{width:'70px', height:'70px', margin:'0 auto 10px', borderRadius:'50%', background:'white', padding:'2px', border:'2px solid #3b82f6', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                <img src={logos.local} style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}} onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}/>
                            </div>
                            <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{match?.equipoLocalNombre}</div>
                        </div>

                        {/* SCORE */}
                        <div style={{background:'white', color:'black', padding:'10px 25px', borderRadius:'12px', fontSize:'3rem', fontWeight:'900', boxShadow:'0 0 20px rgba(255,255,255,0.2)'}}>
                            {match?.marcadorLocal} - {match?.marcadorVisitante}
                        </div>

                        {/* VISITANTE */}
                        <div style={{textAlign:'center', width:'150px'}}>
                            <div style={{width:'70px', height:'70px', margin:'0 auto 10px', borderRadius:'50%', background:'white', padding:'2px', border:'2px solid #f59e0b', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                <img src={logos.visitante} style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}} onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}/>
                            </div>
                            <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{match?.equipoVisitanteNombre}</div>
                        </div>
                    </div>

                    {/* --- 2. BOTÓN DE DESCARGA PDF --- */}
                    <button 
                        onClick={() => generarActaPDF(match)}
                        style={{
                            marginTop: '20px', background: '#ef4444', color: 'white', border: 'none', 
                            padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', 
                            fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                    >
                        📄 Descargar Acta Oficial
                    </button>
                    {/* -------------------------------- */}

                </div>

                {/* MVP CARD */}
                {gameMVP && getValuation(gameMVP) > 0 && (
                    <div style={{
                        background: '#f8fafc', color:'#334155', padding:'15px 20px',
                        display:'flex', alignItems:'center', gap:'20px', borderBottom:'1px solid #e2e8f0'
                    }}>
                        <div style={{fontSize:'2.5rem'}}>🏆</div>
                        <div>
                            <div style={{fontSize:'0.7rem', color:'#f59e0b', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase'}}>MVP del Partido</div>
                            <div style={{fontSize:'1.2rem', fontWeight:'bold'}}>{gameMVP.nombre}</div>
                            <div style={{fontSize:'0.8rem', color:'#64748b'}}>
                                {statsA.includes(gameMVP) ? match?.equipoLocalNombre : match?.equipoVisitanteNombre}
                            </div>
                        </div>
                        <div style={{marginLeft:'auto', textAlign:'right'}}>
                            <div style={{fontSize:'1.5rem', fontWeight:'bold', color:'#3b82f6'}}>{getValuation(gameMVP)}</div>
                            <div style={{fontSize:'0.6rem', color:'#94a3b8'}}>VAL</div>
                        </div>
                        <div style={{borderLeft:'1px solid #cbd5e1', paddingLeft:'15px', display:'flex', gap:'15px', fontSize:'0.9rem'}}>
                            <div><b>{gameMVP.puntos}</b> PTS</div>
                            <div><b>{gameMVP.rebotes}</b> REB</div>
                            <div><b>{gameMVP.asistencias}</b> AST</div>
                        </div>
                    </div>
                )}

                {/* TABS */}
                <div style={{display:'flex', borderBottom:'1px solid #ddd'}}>
                    <button onClick={()=>setActiveTab('A')} style={{flex:1, padding:'15px', border:'none', background: activeTab==='A' ? 'white' : '#f5f5f5', fontWeight:'bold', borderBottom: activeTab==='A' ? '3px solid #3b82f6' : 'none', cursor:'pointer', color:'#333', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>
                        <img src={logos.local} style={{width:'20px', height:'20px', borderRadius:'50%'}} onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}/>
                        {match?.equipoLocalNombre}
                    </button>
                    <button onClick={()=>setActiveTab('B')} style={{flex:1, padding:'15px', border:'none', background: activeTab==='B' ? 'white' : '#f5f5f5', fontWeight:'bold', borderBottom: activeTab==='B' ? '3px solid #f59e0b' : 'none', cursor:'pointer', color:'#333', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>
                        <img src={logos.visitante} style={{width:'20px', height:'20px', borderRadius:'50%'}} onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}/>
                        {match?.equipoVisitanteNombre}
                    </button>
                </div>

                {/* TABLA */}
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
                                <th style={{padding: '5px', textAlign: 'center', width: '50px', color:'#ef4444'}}>FAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeTab === 'A' ? statsA : statsB).length === 0 ? (
                                <tr><td colSpan={8} style={{textAlign:'center', padding:'20px', color:'#999'}}>No hay datos disponibles.</td></tr>
                            ) : (
                                (activeTab === 'A' ? statsA : statsB).map((stat, idx) => (
                                    <tr key={stat.playerId} style={{borderBottom: '1px solid #eee'}}>
                                        <td style={{padding: '10px', fontWeight: 'bold', color: '#888'}}>{stat.numero}</td>
                                        <td style={{padding: '10px', fontWeight: '600', fontSize:'0.9rem'}}>{stat.nombre}</td>
                                        
                                        {['puntos', 'rebotes', 'asistencias', 'robos', 'bloqueos', 'faltas'].map((field) => (
                                            <td key={field} style={{padding: '5px'}}>
                                                <input 
                                                    type="number" 
                                                    value={(stat as any)[field]} 
                                                    readOnly={rol !== 'admin'}
                                                    onChange={(e) => handleChange(activeTab, idx, field as any, e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '6px', textAlign: 'center', 
                                                        borderRadius: '4px', 
                                                        border: rol === 'admin' ? '1px solid #ddd' : 'none',
                                                        backgroundColor: rol !== 'admin' ? 'transparent' : ((stat as any)[field] > 0 ? (field==='puntos'?'#eff6ff':'#f9fafb') : 'white'),
                                                        fontWeight: field === 'puntos' ? 'bold' : 'normal',
                                                        color: field === 'puntos' ? 'var(--primary)' : '#444'
                                                    }}
                                                    min="0"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER */}
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