import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, doc, deleteDoc, updateDoc, addDoc, onSnapshot, getDocs, where } from 'firebase/firestore';

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
    onClose: () => void, 
    onViewLive: (id: string) => void, 
    onViewDetail: (id: string) => void 
}> = ({ rol, onClose, onViewLive, onViewDetail }) => {
    
    const [partidos, setPartidos] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('todos');
    const [generating, setGenerating] = useState(false);
    const [logosCache, setLogosCache] = useState<Record<string, string>>({});

    // 1. CARGAR LOGOS DE EQUIPOS (Escuchador independiente)
    useEffect(() => {
        const q = query(collection(db, 'equipos'));
        const unsub = onSnapshot(q, (snap) => {
            const cache: Record<string, string> = {};
            snap.forEach(d => {
                const data = d.data();
                if (data.nombre && data.logoUrl) {
                    cache[String(data.nombre).trim()] = data.logoUrl;
                }
            });
            setLogosCache(cache);
        });
        return () => unsub();
    }, []);

    // 2. CARGAR CALENDARIO (Escuchador independiente)
    useEffect(() => {
        const q = query(collection(db, 'calendario'));
        const unsub = onSnapshot(q, (calSnap) => {
            const matches = calSnap.docs.map(d => {
                const data = d.data();
                return { 
                    id: d.id, 
                    equipoA: data.equipoLocalNombre || 'Local',
                    equipoB: data.equipoVisitanteNombre || 'Visitante',
                    fecha: data.fechaAsignada || '2025-01-01',
                    hora: data.hora || '00:00',
                    cancha: data.cancha || 'Por definir',
                    categoria: data.categoria || 'General',
                    rama: data.rama || 'Mixto',
                    estatus: data.estatus || 'programado',
                    resultadoA: data.marcadorLocal || 0,
                    resultadoB: data.marcadorVisitante || 0,
                    jornada: data.jornada || 1,
                    // Usamos el nombre para buscar en el cache de logos que cargamos arriba
                    logoUrlA: undefined, // Se resolverá en render
                    logoUrlB: undefined  // Se resolverá en render
                } as Match;
            });

            // Ordenar: Primero por Jornada, luego por Fecha
            matches.sort((a, b) => {
                if ((a.jornada || 0) !== (b.jornada || 0)) return (a.jornada || 0) - (b.jornada || 0);
                return a.fecha.localeCompare(b.fecha);
            });

            setPartidos(matches);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // --- LÓGICA DE GENERACIÓN DE CALENDARIO (ROUND ROBIN) ---
    const handleGenerateCalendar = async () => {
        if (!window.confirm("⚠️ ¿REINICIAR TORNEO?\n\nSe borrarán TODOS los partidos, estadísticas y se reiniciará la tabla de posiciones.\n\nEsta acción no se puede deshacer.")) return;
        
        setGenerating(true);
        try {
            // 1. Borrar datos antiguos
            const oldMatches = await getDocs(collection(db, 'calendario'));
            const deletePromises = oldMatches.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            const oldStats = await getDocs(collection(db, 'stats_partido'));
            const deleteStatsPromises = oldStats.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteStatsPromises);

            // 2. Reiniciar Stats de Equipos
            const equiposSnap = await getDocs(collection(db, 'equipos'));
            const resetPromises = equiposSnap.docs.map(d => updateDoc(d.ref, { 
                victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0 
            }));
            await Promise.all(resetPromises);

            // 3. Obtener equipos APROBADOS (Corrección Importante)
            const qAprobados = query(collection(db, 'equipos'), where('estatus', '==', 'aprobado'));
            const approvedSnap = await getDocs(qAprobados);
            
            let equipos = approvedSnap.docs.map((d: any) => ({ id: d.id, nombre: d.data().nombre }));

            if (equipos.length < 2) { 
                alert("❌ No hay suficientes equipos APROBADOS para generar un torneo. Aprueba al menos 2 equipos en la sección de Inscripciones."); 
                setGenerating(false); 
                return; 
            }

            // Si es impar, agregar 'DESCANSO'
            if (equipos.length % 2 !== 0) equipos.push({ id: 'bye', nombre: 'DESCANSO' });

            const totalRounds = equipos.length - 1;
            const matchesPerRound = equipos.length / 2;
            
            // Configurar fecha de inicio (Próximo Sábado por defecto)
            let fechaBase = new Date();
            fechaBase.setDate(fechaBase.getDate() + (6 - fechaBase.getDay() + 7) % 7); 

            // Algoritmo Round Robin
            for (let round = 0; round < totalRounds; round++) {
                const fechaJornada = new Date(fechaBase);
                fechaJornada.setDate(fechaBase.getDate() + (round * 7)); // Una jornada por semana
                const fechaStr = fechaJornada.toISOString().split('T')[0];

                for (let match = 0; match < matchesPerRound; match++) {
                    const home = equipos[match];
                    const away = equipos[equipos.length - 1 - match];

                    // Solo crear si ninguno es el 'bye' (descanso)
                    if (home.id !== 'bye' && away.id !== 'bye') {
                        await addDoc(collection(db, 'calendario'), {
                            equipoLocalNombre: home.nombre, equipoLocalId: home.id,
                            equipoVisitanteNombre: away.nombre, equipoVisitanteId: away.id,
                            fechaAsignada: fechaStr, 
                            hora: '10:00', // Hora por defecto
                            cancha: 'Cancha Principal',
                            jornada: round + 1, 
                            categoria: 'General', rama: 'Mixto', 
                            estatus: 'programado',
                            marcadorLocal: 0, marcadorVisitante: 0,
                            faltasLocal: 0, faltasVisitante: 0,
                            timeoutsLocal: 2, timeoutsVisitante: 2,
                            cuarto: 1
                        });
                    }
                }
                // Rotar equipos (Round Robin standard rotation)
                equipos.splice(1, 0, equipos.pop()!); 
            }

            alert(`✅ Torneo generado con éxito: ${totalRounds} jornadas creadas.`);

        } catch (error) { 
            console.error(error); 
            alert("Error al generar el calendario. Revisa la consola."); 
        } finally { 
            setGenerating(false); 
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar este partido permanentemente?")) return;
        await deleteDoc(doc(db, 'calendario', id));
    };

    // --- FILTRADO DE JUEGOS ---
    const liveMatches = partidos.filter(p => p.estatus === 'vivo').map(m => ({
        ...m,
        logoUrlA: logosCache[m.equipoA],
        logoUrlB: logosCache[m.equipoB]
    }));
    
    let listMatches = partidos.filter(p => p.estatus !== 'vivo').map(m => ({
        ...m,
        logoUrlA: logosCache[m.equipoA],
        logoUrlB: logosCache[m.equipoB]
    }));

    if (filter === 'programados') listMatches = listMatches.filter(p => p.estatus !== 'finalizado');
    else if (filter === 'finalizados') listMatches = listMatches.filter(p => p.estatus === 'finalizado');

    // Agrupar por jornadas
    const grouped: Record<string, Match[]> = {};
    listMatches.forEach(m => {
        const key = `Jornada ${m.jornada || 1}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    });

    const sortedKeys = Object.keys(grouped).sort((a,b) => {
        const numA = parseInt(a.replace('Jornada ', '')) || 0;
        const numB = parseInt(b.replace('Jornada ', '')) || 0;
        return numA - numB;
    });

    const renderLogo = (url?: string) => (
        url ? <img src={url} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'1px solid #ddd', backgroundColor:'white'}} /> 
            : <span style={{fontSize:'1.5rem'}}>🏀</span>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'800px', margin:'0 auto'}}>
            
            {/* HEADER */}
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.5rem'}}>📅 Calendario Oficial</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            {/* PANEL DE ADMIN (SOLO VISIBLE SI ROL === 'admin') */}
            {rol === 'admin' && (
                <div style={{
                    background:'#fff7ed', padding:'15px', borderRadius:'8px', border:'1px solid #f59e0b', marginBottom:'20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h4 style={{margin:'0 0 5px 0', color:'#d97706'}}>🛠️ Gestión del Torneo</h4>
                        <p style={{margin:0, fontSize:'0.8rem', color:'#666'}}>Generar cruces automáticos para equipos aprobados.</p>
                    </div>
                    <button 
                        onClick={handleGenerateCalendar} 
                        disabled={generating} 
                        className="btn" 
                        style={{
                            background: generating ? '#ccc' : '#ea580c', 
                            color: 'white', fontWeight: 'bold', fontSize: '0.85rem'
                        }}
                    >
                        {generating ? 'Generando...' : '🔄 Generar Calendario'}
                    </button>
                </div>
            )}

            {/* --- SECCIÓN HERO: PARTIDOS EN VIVO (GAMECAST) --- */}
            {liveMatches.length > 0 && (
                <div style={{marginBottom:'30px'}}>
                    <h3 style={{color:'#ef4444', marginBottom:'10px', display:'flex', alignItems:'center', gap:'10px', animation:'pulse 2s infinite'}}>
                        🔴 EN JUEGO AHORA 

[Image of basketball scoreboard]

                    </h3>
                    <div style={{display:'grid', gap:'15px'}}>
                        {liveMatches.map(match => (
                            <div key={match.id} className="card" style={{
                                padding:'20px', 
                                background: 'linear-gradient(135deg, #111 0%, #222 100%)', 
                                color: 'white',
                                border:'2px solid #ef4444',
                                boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
                            }}>
                                <div style={{textAlign:'center', marginBottom:'15px', fontSize:'0.9rem', color:'#fbbf24', fontWeight:'bold'}}>
                                    🔥 GAMECAST EN VIVO
                                </div>
                                
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                                    {/* Local */}
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1}}>
                                        {renderLogo(match.logoUrlA)}
                                        <span style={{marginTop:'5px', fontWeight:'bold', textAlign:'center', fontSize:'1.1rem'}}>{match.equipoA}</span>
                                        <span style={{fontSize:'2.5rem', fontWeight:'bold', lineHeight:1}}>{match.resultadoA}</span>
                                    </div>

                                    <div style={{padding:'0 10px', fontSize:'1.2rem', color:'#666'}}>VS</div>

                                    {/* Visitante */}
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1}}>
                                        {renderLogo(match.logoUrlB)}
                                        <span style={{marginTop:'5px', fontWeight:'bold', textAlign:'center', fontSize:'1.1rem'}}>{match.equipoB}</span>
                                        <span style={{fontSize:'2.5rem', fontWeight:'bold', lineHeight:1}}>{match.resultadoB}</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => onViewLive(match.id)} 
                                    className="btn" 
                                    style={{
                                        width:'100%', background:'#ef4444', color:'white', fontWeight:'bold', 
                                        padding:'12px', fontSize:'1rem', textTransform:'uppercase', letterSpacing:'1px',
                                        display:'flex', justifyContent:'center', alignItems:'center', gap:'10px'
                                    }}
                                >
                                    📺 Entrar a Transmisión
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- FILTROS --- */}
            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button className={`btn ${filter==='todos'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('todos')}>Todos</button>
                <button className={`btn ${filter==='programados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('programados')}>Pendientes</button>
                <button className={`btn ${filter==='finalizados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('finalizados')}>Finalizados</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px'}}>Cargando...</div> : 
             (Object.keys(grouped).length === 0 && liveMatches.length === 0) ? (
                 <div className="card" style={{textAlign:'center', padding:'30px', color:'#666'}}>
                     No hay partidos programados.
                     {rol === 'admin' && <div style={{marginTop:'10px', fontSize:'0.8rem'}}>Usa el botón de arriba para generar el torneo.</div>}
                 </div>
             ) : (
                sortedKeys.map(jornada => (
                    <div key={jornada} style={{marginBottom:'30px'}}>
                        <h3 style={{background: 'var(--primary)', color:'white', padding:'8px 15px', borderRadius:'8px', fontSize:'1rem', marginBottom:'10px'}}>
                            {jornada}
                        </h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {grouped[jornada].map(match => (
                                <div key={match.id} className="card match-card" style={{
                                    padding:'15px', display:'flex', flexDirection:'column', gap:'10px',
                                    borderLeft: match.estatus === 'finalizado' ? '5px solid #10b981' : '1px solid #eee'
                                }}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                        <span>📍 {match.cancha} - {match.hora}</span>
                                        {match.estatus === 'finalizado' && <span style={{color:'#10b981', fontWeight:'bold'}}>🏁 FINALIZADO</span>}
                                        {match.estatus === 'programado' && <span>📅 PROGRAMADO</span>}
                                    </div>
                                    
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>
                                            {renderLogo(match.logoUrlA)}
                                            <span style={{fontWeight:'bold', fontSize:'1rem', lineHeight: 1.2}}>{match.equipoA}</span>
                                        </div>

                                        <div style={{padding:'0 15px', fontWeight:'900', fontSize:'1.4rem', color:'var(--primary)', textAlign:'center', minWidth:'80px'}}>
                                            {match.estatus === 'programado' ? (
                                                <span style={{color:'#ccc', fontSize:'1rem'}}>VS</span>
                                            ) : (
                                                <span>{match.resultadoA} - {match.resultadoB}</span>
                                            )}
                                        </div>

                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1, justifyContent:'flex-end'}}>
                                            <span style={{fontWeight:'bold', fontSize:'1rem', textAlign:'right', lineHeight: 1.2}}>{match.equipoB}</span>
                                            {renderLogo(match.logoUrlB)}
                                        </div>
                                    </div>

                                    {match.estatus === 'finalizado' && (
                                        <div style={{display:'flex', marginTop:'5px', paddingTop:'10px', borderTop:'1px solid #eee', justifyContent:'flex-end'}}>
                                            <button onClick={()=>onViewDetail(match.id)} className="btn btn-secondary" style={{padding:'5px 12px', fontSize:'0.8rem'}}>
                                                📊 Ver Stats
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Botón de Borrar (Solo Admin) */}
                                    {rol === 'admin' && (
                                        <div style={{textAlign:'right', marginTop:'5px'}}>
                                            <button onClick={()=>handleDelete(match.id)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', opacity:0.5}}>🗑️</button>
                                        </div>
                                    )}
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