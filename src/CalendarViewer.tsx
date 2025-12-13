import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';

interface Match { 
    id: string; 
    fecha: string; 
    hora: string; 
    equipoA: string; 
    equipoB: string; 
    categoria: string; 
    rama: string; 
    cancha: string; 
    estatus: string; 
    logoUrlA?: string; 
    logoUrlB?: string; 
    resultadoA?: number; 
    resultadoB?: number; 
}

const CalendarViewer: React.FC<{ 
    rol: string, 
    userEquipoId: string | null, 
    onClose: () => void, 
    onViewLive: (id: string) => void, 
    onViewDetail: (id: string) => void 
}> = ({ rol, userEquipoId, onClose, onViewLive, onViewDetail }) => {
    
    const [partidos, setPartidos] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('todos');

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                // 1. Cargar datos crudos
                const q = query(collection(db, 'calendario'));
                const snap = await getDocs(q);
                
                // 2. TRADUCCIÓN DE DATOS (Aquí arreglamos los nombres)
                let matches = snap.docs.map(d => {
                    const data = d.data();
                    
                    // Lógica para determinar el estatus
                    let estatusCalculado = 'programado';
                    // Si ya tiene marcador y es distinto de 0 (o si tú decides que 0 cuenta), es finalizado
                    if (data.marcadorLocal !== undefined && data.marcadorLocal !== null && (data.marcadorLocal > 0 || data.marcadorVisitante > 0)) {
                        estatusCalculado = 'finalizado';
                    }

                    return { 
                        id: d.id, 
                        // Mapeamos los campos de tu base de datos a lo que usa la App
                        equipoA: data.equipoLocalNombre || 'Local',
                        equipoB: data.equipoVisitanteNombre || 'Visitante',
                        fecha: data.fechaAsignada || '2025-01-01', // Fecha por defecto si es null
                        hora: data.hora || '00:00',
                        cancha: data.cancha || 'Por definir',
                        categoria: data.categoria || 'General',
                        rama: data.rama || 'Mixto',
                        estatus: estatusCalculado, // Usamos el estatus calculado
                        resultadoA: data.marcadorLocal,
                        resultadoB: data.marcadorVisitante
                    } as Match;
                });

                // 3. Ordenar (Los finalizados abajo, los pendientes arriba, luego por fecha)
                matches.sort((a, b) => {
                    if (a.estatus === 'finalizado' && b.estatus !== 'finalizado') return 1;
                    if (a.estatus !== 'finalizado' && b.estatus === 'finalizado') return -1;
                    return a.fecha.localeCompare(b.fecha);
                });

                // 4. Cargar Logos
                const eqSnap = await getDocs(collection(db, 'equipos'));
                const equipoLogos: Record<string, string> = {};
                eqSnap.forEach(d => {
                    const data = d.data();
                    if (data.nombre && data.logoUrl) {
                        equipoLogos[String(data.nombre).trim()] = data.logoUrl;
                    }
                });

                // 5. Pegar Logos a los partidos traducidos
                matches = matches.map(m => ({
                    ...m,
                    logoUrlA: equipoLogos[String(m.equipoA).trim()] || undefined,
                    logoUrlB: equipoLogos[String(m.equipoB).trim()] || undefined
                }));

                setPartidos(matches);

            } catch (e) { 
                console.error("Error:", e); 
            } finally { 
                setLoading(false); 
            }
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
        // Al finalizar manualmente, podrías pedir el marcador, pero por ahora solo cambiamos estatus
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
        // Si la fecha es la por defecto, mostramos "Por Programar"
        const key = m.fecha === '2025-01-01' ? 'Fecha Pendiente' : m.fecha;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    });

    const renderLogo = (url?: string) => (
        url ? <img src={url} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'1px solid #ddd', backgroundColor:'white'}} /> 
            : <span style={{fontSize:'1.5rem'}}>🏀</span>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'800px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.5rem'}}>📅 Calendario</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button className={`btn ${filter==='todos'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('todos')}>Todos</button>
                <button className={`btn ${filter==='programados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('programados')}>Programados</button>
                <button className={`btn ${filter==='finalizados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('finalizados')}>Finalizados</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px'}}>Cargando juegos...</div> : 
             Object.keys(grouped).length === 0 ? <div className="card" style={{textAlign:'center', padding:'30px'}}>No hay partidos.</div> : (
                Object.keys(grouped).sort().map(fecha => (
                    <div key={fecha} style={{marginBottom:'30px'}}>
                        <h3 style={{
                            background: fecha === 'Fecha Pendiente' ? '#9ca3af' : 'var(--primary)', 
                            color:'white', padding:'10px 15px', 
                            borderRadius:'8px', fontSize:'1rem', marginBottom:'10px',
                            display:'flex', justifyContent:'space-between', alignItems:'center'
                        }}>
                            {fecha === 'Fecha Pendiente' ? '📅 Por Programar / Finalizados sin fecha' : new Date(fecha + 'T12:00:00').toLocaleDateString(undefined, {weekday:'long', day:'numeric', month:'long'})}
                            <span style={{fontSize:'0.8rem', opacity:0.8}}>{grouped[fecha].length} juegos</span>
                        </h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {grouped[fecha].map(match => (
                                <div key={match.id} className="card match-card" style={{padding:'15px', display:'flex', flexDirection:'column', gap:'10px'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                        <span>📍 {match.cancha} - {match.hora}</span>
                                        <span>{match.categoria}</span>
                                    </div>
                                    
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        {/* EQUIPO A */}
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>
                                            {renderLogo(match.logoUrlA)}
                                            <span style={{fontWeight:'bold', fontSize:'1rem', lineHeight: 1.2}}>{match.equipoA}</span>
                                        </div>

                                        {/* RESULTADO */}
                                        <div style={{padding:'0 10px', fontWeight:'bold', fontSize:'1.1rem', color:'var(--accent)', minWidth:'60px', textAlign:'center'}}>
                                            {match.estatus === 'finalizado' ? 
                                                <span style={{background:'#eee', padding:'4px 10px', borderRadius:'6px', border:'1px solid #ddd'}}>
                                                    {match.resultadoA} - {match.resultadoB}
                                                </span> : 
                                                <span style={{color:'#ccc'}}>VS</span>
                                            }
                                        </div>

                                        {/* EQUIPO B */}
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1, justifyContent:'flex-end'}}>
                                            <span style={{fontWeight:'bold', fontSize:'1rem', textAlign:'right', lineHeight: 1.2}}>{match.equipoB}</span>
                                            {renderLogo(match.logoUrlB)}
                                        </div>
                                    </div>

                                    {/* BOTONES */}
                                    <div style={{display:'flex', gap:'10px', marginTop:'5px', paddingTop:'10px', borderTop:'1px solid #eee', justifyContent:'flex-end'}}>
                                        {match.estatus === 'finalizado' && <button onClick={()=>onViewDetail(match.id)} className="btn btn-secondary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>📊 Stats</button>}
                                        
                                        {rol === 'admin' && (
                                            <>
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