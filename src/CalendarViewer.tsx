import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, doc, deleteDoc, updateDoc } from 'firebase/firestore'; // Quitamos orderBy para hacerlo manual

// Interfaces
interface Match { id: string; fecha: string; hora: string; equipoA: string; equipoB: string; categoria: string; rama: string; cancha: string; estatus: string; logoUrlA?: string; logoUrlB?: string; resultadoA?: number; resultadoB?: number; }
interface Equipo { nombre: string; logoUrl?: string; } 

const CalendarViewer: React.FC<{ rol: string, userEquipoId: string | null, onClose: () => void, onViewLive: (id: string) => void, onViewDetail: (id: string) => void }> = ({ rol, userEquipoId, onClose, onViewLive, onViewDetail }) => {
    const [partidos, setPartidos] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('todos');

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                // 1. Cargar Partidos (SIN ORDENAR en la consulta para evitar errores de índice)
                const q = query(collection(db, 'calendario'));
                const snap = await getDocs(q);
                let matches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

                // 2. ORDENAR MANUALMENTE (JavaScipt) - Más seguro
                matches.sort((a, b) => {
                    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
                    return a.hora.localeCompare(b.hora);
                });

                // 3. Cargar Equipos (para obtener los logos)
                const eqSnap = await getDocs(collection(db, 'equipos'));
                const equipoLogos: Record<string, string> = {};
                eqSnap.forEach(d => {
                    const data = d.data();
                    // Normalizamos nombres (quitamos espacios extra) para asegurar coincidencia
                    if (data.nombre && data.logoUrl) {
                        equipoLogos[data.nombre.trim()] = data.logoUrl;
                    }
                });

                // 4. Pegar los logos a los partidos
                matches = matches.map(m => ({
                    ...m,
                    logoUrlA: equipoLogos[m.equipoA?.trim()] || null,
                    logoUrlB: equipoLogos[m.equipoB?.trim()] || null
                }));

                setPartidos(matches);
            } catch (e) { 
                console.error("Error cargando calendario:", e); 
            } finally { setLoading(false); }
        };
        fetchMatches();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar partido?")) return;
        await deleteDoc(doc(db, 'calendario', id));
        setPartidos(p => p.filter(m => m.id !== id));
    };

    const handleFinalize = async (id: string) => {
        if (!window.confirm("¿Marcar como finalizado?")) return;
        await updateDoc(doc(db, 'calendario', id), { estatus: 'finalizado' });
        setPartidos(prev => prev.map(m => m.id === id ? { ...m, estatus: 'finalizado' } : m));
    };

    // Filtros
    let filteredMatches = partidos;
    if (filter === 'programados') {
        filteredMatches = partidos.filter(p => p.estatus === 'programado' || p.estatus === 'vivo');
    } else if (filter === 'finalizados') {
        filteredMatches = partidos.filter(p => p.estatus === 'finalizado');
    }

    // Agrupar por fecha
    const grouped: Record<string, Match[]> = {};
    filteredMatches.forEach(m => {
        if (!grouped[m.fecha]) grouped[m.fecha] = [];
        grouped[m.fecha].push(m);
    });

    // Helper para renderizar logo
    const renderLogo = (url?: string) => (
        url ? <img src={url} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'1px solid #ddd', backgroundColor: 'white'}} /> 
            : <span style={{fontSize:'1.5rem'}}>🏀</span>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'800px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.5rem'}}>📅 Calendario de Juegos</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button className={`btn ${filter==='todos'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('todos')}>Todos</button>
                <button className={`btn ${filter==='programados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('programados')}>Programados</button>
                <button className={`btn ${filter==='finalizados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('finalizados')}>Finalizados</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'20px'}}>Cargando juegos...</div> : 
             Object.keys(grouped).length === 0 ? <div className="card" style={{textAlign:'center', padding:'30px'}}>No hay partidos en esta categoría.</div> : (
                Object.keys(grouped).sort().map(fecha => (
                    <div key={fecha} style={{marginBottom:'30px'}}>
                        <h3 style={{
                            background:'var(--primary)', color:'white', padding:'10px 15px', 
                            borderRadius:'8px', fontSize:'1rem', marginBottom:'10px',
                            display:'flex', justifyContent:'space-between', alignItems:'center'
                        }}>
                            {new Date(fecha + 'T12:00:00').toLocaleDateString(undefined, {weekday:'long', day:'numeric', month:'long'})}
                            <span style={{fontSize:'0.8rem', opacity:0.8}}>{grouped[fecha].length} juegos</span>
                        </h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {grouped[fecha].map(match => (
                                <div key={match.id} className="card match-card" style={{padding:'15px', display:'flex', flexDirection:'column', gap:'10px'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                        <span>📍 {match.cancha} - {match.hora}</span>
                                        <span>{match.categoria} {match.rama}</span>
                                    </div>
                                    
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        {/* EQUIPO A */}
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>
                                            {renderLogo(match.logoUrlA)}
                                            <span style={{fontWeight:'bold', fontSize:'1rem', lineHeight: 1.2}}>{match.equipoA}</span>
                                        </div>

                                        {/* VS o RESULTADO */}
                                        <div style={{padding:'0 10px', fontWeight:'bold', fontSize:'1.1rem', color:'var(--accent)', minWidth:'60px', textAlign:'center'}}>
                                            {match.estatus === 'finalizado' && match.resultadoA !== undefined ? 
                                                <span style={{background:'#eee', padding:'2px 8px', borderRadius:'4px'}}>{match.resultadoA} - {match.resultadoB}</span> : 
                                                <span style={{color:'#ccc'}}>VS</span>
                                            }
                                        </div>

                                        {/* EQUIPO B */}
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1, justifyContent:'flex-end'}}>
                                            <span style={{fontWeight:'bold', fontSize:'1rem', textAlign:'right', lineHeight: 1.2}}>{match.equipoB}</span>
                                            {renderLogo(match.logoUrlB)}
                                        </div>
                                    </div>

                                    {/* BOTONES DE ACCIÓN */}
                                    <div style={{display:'flex', gap:'10px', marginTop:'5px', paddingTop:'10px', borderTop:'1px solid #eee', justifyContent:'flex-end'}}>
                                        {match.estatus === 'vivo' && (
                                            <button onClick={()=>onViewLive(match.id)} className="btn btn-danger pulsate" style={{padding:'5px 10px', fontSize:'0.8rem'}}>🔴 EN VIVO</button>
                                        )}
                                        {match.estatus === 'finalizado' && (
                                            <button onClick={()=>onViewDetail(match.id)} className="btn btn-secondary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>📊 Ver Stats</button>
                                        )}
                                        
                                        {rol === 'admin' && (
                                            <>
                                                {match.estatus !== 'finalizado' && <button onClick={()=>handleFinalize(match.id)} className="btn btn-primary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>🏁 Finalizar</button>}
                                                <button onClick={()=>handleDelete(match.id)} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8rem'}}>🗑️</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
export default CalendarViewer;