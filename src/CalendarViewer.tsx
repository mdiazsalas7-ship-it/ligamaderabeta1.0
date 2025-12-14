import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, doc, deleteDoc, updateDoc, addDoc, onSnapshot, getDocs } from 'firebase/firestore';

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

    // --- CARGA DE DATOS EN TIEMPO REAL ---
    useEffect(() => {
        const unsubEquipos = onSnapshot(collection(db, 'equipos'), (eqSnap) => {
            const equipoLogos: Record<string, string> = {};
            eqSnap.forEach(d => {
                const data = d.data();
                if (data.nombre && data.logoUrl) equipoLogos[String(data.nombre).trim()] = data.logoUrl;
            });

            const q = query(collection(db, 'calendario'));
            const unsubCalendar = onSnapshot(q, (calSnap) => {
                
                const matches = calSnap.docs.map(d => {
                    const data = d.data();
                    let estatus = data.estatus || 'programado';
                    return { 
                        id: d.id, 
                        equipoA: data.equipoLocalNombre || 'Local',
                        equipoB: data.equipoVisitanteNombre || 'Visitante',
                        fecha: data.fechaAsignada || '2025-01-01',
                        hora: data.hora || '00:00',
                        cancha: data.cancha || 'Por definir',
                        categoria: data.categoria || 'General',
                        rama: data.rama || 'Mixto',
                        estatus: estatus,
                        resultadoA: data.marcadorLocal || 0,
                        resultadoB: data.marcadorVisitante || 0,
                        jornada: data.jornada || 1,
                        logoUrlA: equipoLogos[String(data.equipoLocalNombre).trim()] || undefined,
                        logoUrlB: equipoLogos[String(data.equipoVisitanteNombre).trim()] || undefined
                    } as Match;
                });

                matches.sort((a, b) => {
                    if (a.estatus === 'vivo' && b.estatus !== 'vivo') return -1;
                    if (a.estatus !== 'vivo' && b.estatus === 'vivo') return 1;
                    if ((a.jornada || 0) !== (b.jornada || 0)) return (a.jornada || 0) - (b.jornada || 0);
                    return a.fecha.localeCompare(b.fecha);
                });

                setPartidos(matches);
                setLoading(false);
            });

            return () => unsubCalendar();
        });

        return () => unsubEquipos();
    }, []);


    const handleGenerateCalendar = async () => {
        const confirmacion = window.confirm(
            "⚠️ ¿REINICIAR TORNEO?\n\nSe borrará todo el calendario, estadísticas y tabla de posiciones."
        );

        if (!confirmacion) return;
        
        setGenerating(true);
        try {
            const oldMatches = await getDocs(collection(db, 'calendario'));
            await Promise.all(oldMatches.docs.map((d: any) => deleteDoc(d.ref)));

            const oldStats = await getDocs(collection(db, 'stats_partido'));
            await Promise.all(oldStats.docs.map((d: any) => deleteDoc(d.ref)));

            const equiposSnap = await getDocs(query(collection(db, 'equipos')));
            await Promise.all(equiposSnap.docs.map((d: any) => updateDoc(d.ref, { victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0 })));

            let equipos = equiposSnap.docs.map((d: any) => ({ id: d.id, nombre: d.data().nombre }));
            if (equipos.length < 2) { alert("Faltan equipos."); setGenerating(false); return; }
            if (equipos.length % 2 !== 0) equipos.push({ id: 'bye', nombre: 'DESCANSO' });

            const totalRounds = equipos.length - 1;
            const matchesPerRound = equipos.length / 2;
            let fechaBase = new Date();
            fechaBase.setDate(fechaBase.getDate() + (6 - fechaBase.getDay() + 7) % 7); 

            for (let round = 0; round < totalRounds; round++) {
                const fechaJornada = new Date(fechaBase);
                fechaJornada.setDate(fechaBase.getDate() + (round * 7));
                const fechaStr = fechaJornada.toISOString().split('T')[0];

                for (let match = 0; match < matchesPerRound; match++) {
                    const home = equipos[match];
                    const away = equipos[equipos.length - 1 - match];
                    if (home.id !== 'bye' && away.id !== 'bye') {
                        await addDoc(collection(db, 'calendario'), {
                            equipoLocalNombre: home.nombre, equipoLocalId: home.id,
                            equipoVisitanteNombre: away.nombre, equipoVisitanteId: away.id,
                            fechaAsignada: fechaStr, hora: '12:00', cancha: 'Gimnasio Principal',
                            jornada: round + 1, categoria: 'General', rama: 'Mixto', estatus: 'programado',
                            marcadorLocal: 0, marcadorVisitante: 0 
                        });
                    }
                }
                equipos.splice(1, 0, equipos.pop()!); 
            }
            alert("✅ Torneo reiniciado correctamente.");
        } catch (error) { console.error(error); alert("Error."); } finally { setGenerating(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar partido?")) return;
        await deleteDoc(doc(db, 'calendario', id));
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

    const sortedKeys = Object.keys(grouped).sort((a,b) => parseInt(a.replace('Jornada ', '')) - parseInt(b.replace('Jornada ', '')));

    const renderLogo = (url?: string) => (
        url ? <img src={url} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'1px solid #ddd', backgroundColor:'white'}} /> 
            : <span style={{fontSize:'1.5rem'}}>🏀</span>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'800px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.5rem'}}>📅 Calendario</h2>
                {rol === 'admin' && (
                    <button onClick={handleGenerateCalendar} disabled={generating} className="btn" style={{background: generating ? '#ccc' : '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '0.9rem'}}>
                        {generating ? '⚙️...' : '🔄 Reiniciar Torneo'}
                    </button>
                )}
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button className={`btn ${filter==='todos'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('todos')}>Todos</button>
                <button className={`btn ${filter==='programados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('programados')}>Pendientes</button>
                <button className={`btn ${filter==='finalizados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('finalizados')}>Finalizados</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px'}}>Cargando...</div> : 
             Object.keys(grouped).length === 0 ? <div className="card" style={{textAlign:'center', padding:'30px'}}>No hay partidos.</div> : (
                sortedKeys.map(jornada => (
                    <div key={jornada} style={{marginBottom:'30px'}}>
                        <h3 style={{background: 'var(--primary)', color:'white', padding:'10px 15px', borderRadius:'8px', fontSize:'1rem', marginBottom:'10px'}}>
                            {jornada} <span style={{fontSize:'0.8rem', opacity:0.8, marginLeft:'10px'}}>{new Date(grouped[jornada][0].fecha + 'T12:00:00').toLocaleDateString()}</span>
                        </h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {grouped[jornada].map(match => (
                                <div key={match.id} className="card match-card" style={{
                                    padding:'15px', display:'flex', flexDirection:'column', gap:'10px',
                                    borderLeft: match.estatus === 'vivo' ? '5px solid #ef4444' : match.estatus === 'finalizado' ? '5px solid #10b981' : '1px solid #eee'
                                }}>
                                    
                                    {/* INFO SUPERIOR */}
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                        <span>📍 {match.cancha} - {match.hora}</span>
                                        {match.estatus === 'vivo' && <span style={{color:'red', fontWeight:'bold', animation:'pulse 1s infinite'}}>🔴 EN VIVO</span>}
                                        {match.estatus === 'finalizado' && <span style={{color:'#10b981', fontWeight:'bold'}}>🏁 FINALIZADO</span>}
                                        {match.estatus === 'programado' && <span>📅 PROGRAMADO</span>}
                                    </div>
                                    
                                    {/* EQUIPOS Y RESULTADO */}
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>
                                            {renderLogo(match.logoUrlA)}
                                            <span style={{fontWeight:'bold', fontSize:'1rem', lineHeight: 1.2}}>{match.equipoA}</span>
                                        </div>

                                        <div style={{padding:'0 15px', fontWeight:'900', fontSize:'1.4rem', color:'var(--primary)', textAlign:'center', minWidth:'80px'}}>
                                            {match.estatus === 'programado' ? (
                                                <span style={{color:'#ccc', fontSize:'1rem'}}>VS</span>
                                            ) : (
                                                // MUESTRA EL MARCADOR SI ESTÁ EN VIVO O FINALIZADO
                                                <span>{match.resultadoA} - {match.resultadoB}</span>
                                            )}
                                        </div>

                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1, justifyContent:'flex-end'}}>
                                            <span style={{fontWeight:'bold', fontSize:'1rem', textAlign:'right', lineHeight: 1.2}}>{match.equipoB}</span>
                                            {renderLogo(match.logoUrlB)}
                                        </div>
                                    </div>

                                    {/* BOTONES DE ACCIÓN (LÓGICA ESTRICTA) */}
                                    <div style={{display:'flex', gap:'10px', marginTop:'5px', paddingTop:'10px', borderTop:'1px solid #eee', justifyContent:'flex-end'}}>
                                        
                                        {/* 1. SI ESTÁ FINALIZADO: Ver Stats */}
                                        {match.estatus === 'finalizado' && (
                                            <button onClick={()=>onViewDetail(match.id)} className="btn btn-secondary" style={{padding:'5px 12px', fontSize:'0.8rem'}}>
                                                📊 Ver Stats
                                            </button>
                                        )}
                                        
                                        {/* 2. SOLO SI ESTÁ EN VIVO: Ver Transmisión */}
                                        {match.estatus === 'vivo' && (
                                            <button onClick={()=>onViewLive(match.id)} className="btn btn-danger" style={{padding:'5px 12px', fontSize:'0.8rem', animation:'pulse 1.5s infinite'}}>
                                                📺 VER EN VIVO
                                            </button>
                                        )}
                                        
                                        {/* ADMIN: BORRAR */}
                                        {rol === 'admin' && (
                                            <button onClick={()=>handleDelete(match.id)} className="btn" style={{padding:'5px 10px', fontSize:'0.8rem', background:'#fee2e2', color:'#ef4444'}}>🗑️</button>
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