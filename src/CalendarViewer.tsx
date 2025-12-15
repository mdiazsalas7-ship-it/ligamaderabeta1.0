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

    // 1. CARGAR LOGOS DE EQUIPOS
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

    // 2. CARGAR CALENDARIO
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
                    // Se resolverá en render usando el cache
                    logoUrlA: undefined, 
                    logoUrlB: undefined  
                } as Match;
            });

            // Ordenar: Jornada -> Fecha
            matches.sort((a, b) => {
                if ((a.jornada || 0) !== (b.jornada || 0)) return (a.jornada || 0) - (b.jornada || 0);
                return a.fecha.localeCompare(b.fecha);
            });

            setPartidos(matches);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // GENERAR CALENDARIO (ROUND ROBIN)
    const handleGenerateCalendar = async () => {
        if (!window.confirm("⚠️ ¿REINICIAR TORNEO?\n\nSe borrarán TODOS los partidos y stats.\n\nEsta acción no se puede deshacer.")) return;
        
        setGenerating(true);
        try {
            // Borrar datos antiguos
            const oldMatches = await getDocs(collection(db, 'calendario'));
            await Promise.all(oldMatches.docs.map(d => deleteDoc(d.ref)));

            const oldStats = await getDocs(collection(db, 'stats_partido'));
            await Promise.all(oldStats.docs.map(d => deleteDoc(d.ref)));

            // Resetear Equipos
            const equiposSnap = await getDocs(collection(db, 'equipos'));
            await Promise.all(equiposSnap.docs.map(d => updateDoc(d.ref, { victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0 })));

            // Obtener equipos aprobados
            const qAprobados = query(collection(db, 'equipos'), where('estatus', '==', 'aprobado'));
            const approvedSnap = await getDocs(qAprobados);
            let equipos = approvedSnap.docs.map((d: any) => ({ id: d.id, nombre: d.data().nombre }));

            if (equipos.length < 2) { 
                alert("❌ No hay suficientes equipos APROBADOS. Aprueba al menos 2."); 
                setGenerating(false); return; 
            }

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
                            fechaAsignada: fechaStr, hora: '10:00', cancha: 'Cancha Principal',
                            jornada: round + 1, categoria: 'General', rama: 'Mixto', 
                            estatus: 'programado', marcadorLocal: 0, marcadorVisitante: 0,
                            faltasLocal: 0, faltasVisitante: 0, timeoutsLocal: 2, timeoutsVisitante: 2, cuarto: 1
                        });
                    }
                }
                equipos.splice(1, 0, equipos.pop()!); 
            }
            alert("✅ Torneo generado con éxito.");
        } catch (error) { console.error(error); alert("Error al generar."); } 
        finally { setGenerating(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar este partido?")) return;
        await deleteDoc(doc(db, 'calendario', id));
    };

    // FILTRADO
    const liveMatches = partidos.filter(p => p.estatus === 'vivo').map(m => ({
        ...m, logoUrlA: logosCache[m.equipoA], logoUrlB: logosCache[m.equipoB]
    }));
    
    let listMatches = partidos.filter(p => p.estatus !== 'vivo').map(m => ({
        ...m, logoUrlA: logosCache[m.equipoA], logoUrlB: logosCache[m.equipoB]
    }));

    if (filter === 'programados') listMatches = listMatches.filter(p => p.estatus !== 'finalizado');
    else if (filter === 'finalizados') listMatches = listMatches.filter(p => p.estatus === 'finalizado');

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
        url ? <img src={url} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover', border:'1px solid #ddd', backgroundColor:'white'}} onError={(e)=>{(e.target as HTMLImageElement).src="https://cdn-icons-png.flaticon.com/512/166/166344.png"}} /> 
            : <span style={{fontSize:'1.5rem'}}>🏀</span>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth:'800px', margin:'0 auto'}}>
            
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.5rem'}}>📅 Calendario Oficial</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            {rol === 'admin' && (
                <div style={{background:'#fff7ed', padding:'15px', borderRadius:'8px', border:'1px solid #f59e0b', marginBottom:'20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div><h4 style={{margin:'0 0 5px 0', color:'#d97706'}}>🛠️ Gestión del Torneo</h4><p style={{margin:0, fontSize:'0.8rem', color:'#666'}}>Generar cruces automáticos.</p></div>
                    <button onClick={handleGenerateCalendar} disabled={generating} className="btn" style={{background: generating ? '#ccc' : '#ea580c', color: 'white', fontWeight: 'bold', fontSize: '0.85rem'}}>{generating ? 'Generando...' : '🔄 Generar Calendario'}</button>
                </div>
            )}

            {liveMatches.length > 0 && (
                <div style={{marginBottom:'30px'}}>
                    <h3 style={{color:'#ef4444', marginBottom:'10px', display:'flex', alignItems:'center', gap:'10px', animation:'pulse 2s infinite'}}>🔴 EN JUEGO AHORA</h3>
                    <div style={{display:'grid', gap:'15px'}}>
                        {liveMatches.map(match => (
                            <div key={match.id} className="card" style={{padding:'20px', background: 'linear-gradient(135deg, #111 0%, #222 100%)', color: 'white', border:'2px solid #ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'}}>
                                <div style={{textAlign:'center', marginBottom:'15px', fontSize:'0.9rem', color:'#fbbf24', fontWeight:'bold'}}>🔥 GAMECAST EN VIVO</div>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1}}>{renderLogo(match.logoUrlA)}<span style={{marginTop:'5px', fontWeight:'bold', textAlign:'center', fontSize:'1.1rem'}}>{match.equipoA}</span><span style={{fontSize:'2.5rem', fontWeight:'bold', lineHeight:1}}>{match.resultadoA}</span></div>
                                    <div style={{padding:'0 10px', fontSize:'1.2rem', color:'#666'}}>VS</div>
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1}}>{renderLogo(match.logoUrlB)}<span style={{marginTop:'5px', fontWeight:'bold', textAlign:'center', fontSize:'1.1rem'}}>{match.equipoB}</span><span style={{fontSize:'2.5rem', fontWeight:'bold', lineHeight:1}}>{match.resultadoB}</span></div>
                                </div>
                                <button onClick={() => onViewLive(match.id)} className="btn" style={{width:'100%', background:'#ef4444', color:'white', fontWeight:'bold', padding:'12px', fontSize:'1rem', textTransform:'uppercase', display:'flex', justifyContent:'center', alignItems:'center', gap:'10px'}}>📺 Entrar a Transmisión</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                <button className={`btn ${filter==='todos'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('todos')}>Todos</button>
                <button className={`btn ${filter==='programados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('programados')}>Pendientes</button>
                <button className={`btn ${filter==='finalizados'?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('finalizados')}>Finalizados</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px'}}>Cargando...</div> : 
             (Object.keys(grouped).length === 0 && liveMatches.length === 0) ? (
                 <div className="card" style={{textAlign:'center', padding:'30px', color:'#666'}}>No hay partidos programados.</div>
             ) : (
                sortedKeys.map(jornada => (
                    <div key={jornada} style={{marginBottom:'30px'}}>
                        <h3 style={{background: 'var(--primary)', color:'white', padding:'8px 15px', borderRadius:'8px', fontSize:'1rem', marginBottom:'10px'}}>{jornada}</h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {grouped[jornada].map(match => (
                                <div key={match.id} className="card match-card" style={{padding:'15px', display:'flex', flexDirection:'column', gap:'10px', borderLeft: match.estatus === 'finalizado' ? '5px solid #10b981' : '1px solid #eee'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                        <span>📍 {match.cancha} - {match.hora}</span>
                                        {match.estatus === 'finalizado' && <span style={{color:'#10b981', fontWeight:'bold'}}>🏁 FINALIZADO</span>}
                                        {match.estatus === 'programado' && <span>📅 PROGRAMADO</span>}
                                    </div>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}>{renderLogo(match.logoUrlA)}<span style={{fontWeight:'bold', fontSize:'1rem', lineHeight: 1.2}}>{match.equipoA}</span></div>
                                        <div style={{padding:'0 15px', fontWeight:'900', fontSize:'1.4rem', color:'var(--primary)', textAlign:'center', minWidth:'80px'}}>
                                            {match.estatus === 'programado' ? <span style={{color:'#ccc', fontSize:'1rem'}}>VS</span> : <span>{match.resultadoA} - {match.resultadoB}</span>}
                                        </div>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1, justifyContent:'flex-end'}}><span style={{fontWeight:'bold', fontSize:'1rem', textAlign:'right', lineHeight: 1.2}}>{match.equipoB}</span>{renderLogo(match.logoUrlB)}</div>
                                    </div>
                                    {match.estatus === 'finalizado' && <div style={{display:'flex', marginTop:'5px', paddingTop:'10px', borderTop:'1px solid #eee', justifyContent:'flex-end'}}><button onClick={()=>onViewDetail(match.id)} className="btn btn-secondary" style={{padding:'5px 12px', fontSize:'0.8rem'}}>📊 Ver Stats</button></div>}
                                    {rol === 'admin' && <div style={{textAlign:'right', marginTop:'5px'}}><button onClick={()=>handleDelete(match.id)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', opacity:0.5}}>🗑️</button></div>}
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