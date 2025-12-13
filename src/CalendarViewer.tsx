import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';

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
    jornada?: number;
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
    const [generating, setGenerating] = useState(false);

    const fetchMatches = async () => {
        setLoading(true);
        try {
            // 1. Cargar Partidos
            const q = query(collection(db, 'calendario'));
            const snap = await getDocs(q);
            
            let matches = snap.docs.map(d => {
                const data = d.data();
                let estatusCalculado = 'programado';
                if (data.marcadorLocal !== undefined && data.marcadorLocal !== null && (data.marcadorLocal > 0 || data.marcadorVisitante > 0)) {
                    estatusCalculado = 'finalizado';
                }
                return { 
                    id: d.id, 
                    equipoA: data.equipoLocalNombre || 'Local',
                    equipoB: data.equipoVisitanteNombre || 'Visitante',
                    fecha: data.fechaAsignada || '2025-01-01',
                    hora: data.hora || '00:00',
                    cancha: data.cancha || 'Por definir',
                    categoria: data.categoria || 'General',
                    rama: data.rama || 'Mixto',
                    estatus: estatusCalculado,
                    resultadoA: data.marcadorLocal,
                    resultadoB: data.marcadorVisitante,
                    jornada: data.jornada || 1
                } as Match;
            });

            matches.sort((a, b) => {
                if ((a.jornada || 0) !== (b.jornada || 0)) return (a.jornada || 0) - (b.jornada || 0);
                if (a.estatus === 'finalizado' && b.estatus !== 'finalizado') return 1;
                if (a.estatus !== 'finalizado' && b.estatus === 'finalizado') return -1;
                return a.fecha.localeCompare(b.fecha);
            });

            // Cargar Logos
            const eqSnap = await getDocs(collection(db, 'equipos'));
            const equipoLogos: Record<string, string> = {};
            eqSnap.forEach(d => {
                const data = d.data();
                if (data.nombre && data.logoUrl) equipoLogos[String(data.nombre).trim()] = data.logoUrl;
            });

            matches = matches.map(m => ({
                ...m,
                logoUrlA: equipoLogos[String(m.equipoA).trim()] || undefined,
                logoUrlB: equipoLogos[String(m.equipoB).trim()] || undefined
            }));

            setPartidos(matches);

        } catch (e) { console.error("Error:", e); } finally { setLoading(false); }
    };

    useEffect(() => { fetchMatches(); }, []);

    // --- ALGORITMO ROUND ROBIN + REINICIO TOTAL ---
    const handleGenerateCalendar = async () => {
        const confirmacion = window.confirm(
            "⚠️ ¡ATENCIÓN: REINICIO DE TEMPORADA!\n\n" +
            "Esta acción hará lo siguiente:\n" +
            "1. Borrará TODOS los partidos del calendario actual.\n" +
            "2. Borrará TODAS las estadísticas de los jugadores (Líderes).\n" +
            "3. Reiniciará a CERO la Tabla de Posiciones (Victorias/Derrotas).\n\n" +
            "¿Estás seguro de que quieres comenzar un torneo nuevo?"
        );

        if (!confirmacion) return;
        
        setGenerating(true);
        try {
            // PASO 1: BORRAR CALENDARIO
            const oldMatches = await getDocs(collection(db, 'calendario'));
            const deleteCalendarPromises = oldMatches.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteCalendarPromises);

            // PASO 2: BORRAR ESTADÍSTICAS (stats_partido)
            const oldStats = await getDocs(collection(db, 'stats_partido'));
            const deleteStatsPromises = oldStats.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteStatsPromises);

            // PASO 3: REINICIAR TABLA DE POSICIONES (equipos)
            const equiposSnap = await getDocs(query(collection(db, 'equipos')));
            const resetTeamsPromises = equiposSnap.docs.map(d => updateDoc(d.ref, {
                victorias: 0,
                derrotas: 0,
                puntos: 0,
                puntos_favor: 0,
                puntos_contra: 0
            }));
            await Promise.all(resetTeamsPromises);

            // PASO 4: GENERAR NUEVOS ENFRENTAMIENTOS
            let equipos = equiposSnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre }));

            if (equipos.length < 2) {
                alert("Necesitas al menos 2 equipos aprobados para generar un calendario.");
                setGenerating(false);
                return;
            }

            if (equipos.length % 2 !== 0) {
                equipos.push({ id: 'bye', nombre: 'DESCANSO' });
            }

            const totalRounds = equipos.length - 1;
            const matchesPerRound = equipos.length / 2;
            const calendarBatch = [];
            
            let fechaBase = new Date();
            // Ajustar al próximo sábado o fecha deseada
            fechaBase.setDate(fechaBase.getDate() + (6 - fechaBase.getDay() + 7) % 7); 

            for (let round = 0; round < totalRounds; round++) {
                const fechaJornada = new Date(fechaBase);
                fechaJornada.setDate(fechaBase.getDate() + (round * 7));
                const fechaStr = fechaJornada.toISOString().split('T')[0];

                for (let match = 0; match < matchesPerRound; match++) {
                    const home = equipos[match];
                    const away = equipos[equipos.length - 1 - match];

                    if (home.id !== 'bye' && away.id !== 'bye') {
                        calendarBatch.push({
                            equipoLocalNombre: home.nombre,
                            equipoLocalId: home.id,
                            equipoVisitanteNombre: away.nombre,
                            equipoVisitanteId: away.id,
                            fechaAsignada: fechaStr,
                            hora: '12:00',
                            cancha: 'Gimnasio Principal',
                            jornada: round + 1,
                            categoria: 'General',
                            rama: 'Mixto',
                            estatus: 'programado'
                        });
                    }
                }
                equipos.splice(1, 0, equipos.pop()!); 
            }

            const savePromises = calendarBatch.map(m => addDoc(collection(db, 'calendario'), m));
            await Promise.all(savePromises);

            alert(`✅ ¡TEMPORADA REINICIADA!\n\n- Estadísticas borradas.\n- Tabla en Cero.\n- Calendario generado (${totalRounds} Jornadas).`);
            fetchMatches(); 

        } catch (error) {
            console.error(error);
            alert("Error al reiniciar el torneo.");
        } finally {
            setGenerating(false);
        }
    };

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

    let filteredMatches = partidos;
    if (filter === 'programados') filteredMatches = partidos.filter(p => p.estatus !== 'finalizado');
    else if (filter === 'finalizados') filteredMatches = partidos.filter(p => p.estatus === 'finalizado');

    const grouped: Record<string, Match[]> = {};
    filteredMatches.forEach(m => {
        const key = `Jornada ${m.jornada || 1}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    });

    const sortedKeys = Object.keys(grouped).sort((a,b) => {
        const numA = parseInt(a.replace('Jornada ', ''));
        const numB = parseInt(b.replace('Jornada ', ''));
        return numA - numB;
    });

    const renderLogo = (url?: string) => (
        url ? <img src={url} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'1px solid #ddd', backgroundColor:'white'}} /> 
            : <span style={{fontSize:'1.5rem'}}>🏀</span>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'800px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.5rem'}}>📅 Calendario</h2>
                {rol === 'admin' && (
                    <button 
                        onClick={handleGenerateCalendar} 
                        disabled={generating}
                        className="btn" 
                        style={{
                            background: generating ? '#ccc' : '#ef4444', // Rojo para indicar peligro/reinicio
                            color: 'white', fontWeight: 'bold', fontSize: '0.9rem',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                    >
                        {generating ? '⚙️ Reiniciando...' : '🔄 Reiniciar Torneo & Calendario'}
                    </button>
                )}
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button className={`btn ${filter==='todos'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('todos')}>Todos</button>
                <button className={`btn ${filter==='programados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('programados')}>Pendientes</button>
                <button className={`btn ${filter==='finalizados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('finalizados')}>Finalizados</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px'}}>Cargando juegos...</div> : 
             Object.keys(grouped).length === 0 ? <div className="card" style={{textAlign:'center', padding:'30px'}}>No hay partidos.</div> : (
                sortedKeys.map(jornada => (
                    <div key={jornada} style={{marginBottom:'30px'}}>
                        <h3 style={{
                            background: 'var(--primary)', color:'white', padding:'10px 15px', 
                            borderRadius:'8px', fontSize:'1rem', marginBottom:'10px',
                            display:'flex', justifyContent:'space-between', alignItems:'center'
                        }}>
                            {jornada}
                            <span style={{fontSize:'0.8rem', opacity:0.8}}>
                                {new Date(grouped[jornada][0].fecha + 'T12:00:00').toLocaleDateString()}
                            </span>
                        </h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {grouped[jornada].map(match => (
                                <div key={match.id} className="card match-card" style={{padding:'15px', display:'flex', flexDirection:'column', gap:'10px'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                        <span>📍 {match.cancha} - {match.hora}</span>
                                        <span>{match.categoria}</span>
                                    </div>
                                    
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>
                                            {renderLogo(match.logoUrlA)}
                                            <span style={{fontWeight:'bold', fontSize:'1rem', lineHeight: 1.2}}>{match.equipoA}</span>
                                        </div>

                                        <div style={{padding:'0 10px', fontWeight:'bold', fontSize:'1.1rem', color:'var(--accent)', minWidth:'60px', textAlign:'center'}}>
                                            {match.estatus === 'finalizado' ? 
                                                <span style={{background:'#eee', padding:'4px 10px', borderRadius:'6px', border:'1px solid #ddd'}}>
                                                    {match.resultadoA} - {match.resultadoB}
                                                </span> : 
                                                <span style={{color:'#ccc'}}>VS</span>
                                            }
                                        </div>

                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1, justifyContent:'flex-end'}}>
                                            <span style={{fontWeight:'bold', fontSize:'1rem', textAlign:'right', lineHeight: 1.2}}>{match.equipoB}</span>
                                            {renderLogo(match.logoUrlB)}
                                        </div>
                                    </div>

                                    <div style={{display:'flex', gap:'10px', marginTop:'5px', paddingTop:'10px', borderTop:'1px solid #eee', justifyContent:'flex-end'}}>
                                        {match.estatus === 'finalizado' && <button onClick={()=>onViewDetail(match.id)} className="btn btn-secondary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>📊 Stats</button>}
                                        {match.estatus !== 'finalizado' && <button onClick={()=>onViewLive(match.id)} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8rem'}}>📡 Vivo</button>}
                                        
                                        {rol === 'admin' && (
                                            <>
                                                {match.estatus !== 'finalizado' && <button onClick={()=>handleFinalize(match.id)} className="btn btn-primary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>🏁 Fin</button>}
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