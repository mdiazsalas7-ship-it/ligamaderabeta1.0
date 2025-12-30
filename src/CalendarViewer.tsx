import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, deleteDoc, addDoc } from 'firebase/firestore';

interface Match {
    id: string;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    fechaAsignada: string;
    hora: string;
    estatus: string; 
    cancha: string;
    marcadorLocal?: number;
    marcadorVisitante?: number;
    jornada?: number;
}

interface ApprovedTeam {
    id: string;
    nombreEquipo: string;
    logoUrl?: string;
}

const CalendarViewer: React.FC<{ rol: string, onClose: () => void, onViewLive: (id: string) => void, onViewDetail: (id: string) => void }> = ({ rol, onClose, onViewLive, onViewDetail }) => {
    
    const [matches, setMatches] = useState<Match[]>([]);
    const [approvedTeams, setApprovedTeams] = useState<ApprovedTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    // --- NUEVO ESTADO PARA PESTAÑAS ---
    const [viewMode, setViewMode] = useState<'upcoming' | 'finished'>('upcoming');

    // Estado para Edición
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');

    useEffect(() => {
        // 1. Cargar Partidos
        const q = query(collection(db, 'calendario'), orderBy('fechaAsignada', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            setMatches(list);
            setLoading(false);
        });

        // 2. Cargar Lobby
        const fetchLobby = async () => {
            try {
                const qTeams = query(collection(db, 'forma21s'), where('estatus', '==', 'aprobado'));
                const snap = await getDocs(qTeams);
                setApprovedTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovedTeam)));
            } catch (e) { console.error(e); }
        };
        fetchLobby();

        return () => unsubscribe();
    }, []);

    // --- FILTRADO DE JUEGOS ---
    const upcomingMatches = matches.filter(m => m.estatus !== 'finalizado');
    const finishedMatches = matches.filter(m => m.estatus === 'finalizado');
    
    // Ordenar finalizados (más recientes primero)
    finishedMatches.sort((a,b) => b.fechaAsignada.localeCompare(a.fechaAsignada));

    // LOGICA DE VISIBILIDAD DEL LOBBY: Solo si no hay partidos en total
    const showLobby = matches.length === 0;

    const handleGenerateCalendar = async () => {
        if (!window.confirm("⚠️ ¿REINICIAR TORNEO?\n\nSe borrarán TODOS los partidos.")) return;
        setGenerating(true);
        try {
            const oldMatches = await getDocs(collection(db, 'calendario'));
            await Promise.all(oldMatches.docs.map(d => deleteDoc(d.ref)));
            const oldStats = await getDocs(collection(db, 'stats_partido'));
            await Promise.all(oldStats.docs.map(d => deleteDoc(d.ref)));
            const equiposSnap = await getDocs(collection(db, 'equipos'));
            await Promise.all(equiposSnap.docs.map(d => updateDoc(d.ref, { victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0 })));

            let equipos = approvedTeams.map(t => ({ id: t.id, nombre: t.nombreEquipo }));
            if (equipos.length < 2) { alert("Mínimo 2 equipos aprobados."); setGenerating(false); return; }
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
                            jornada: round + 1, estatus: 'programado', marcadorLocal: 0, marcadorVisitante: 0,
                            faltasLocal: 0, faltasVisitante: 0, timeoutsLocal: 2, timeoutsVisitante: 2, cuarto: 1
                        });
                    }
                }
                equipos.splice(1, 0, equipos.pop()!); 
            }
            alert("✅ Torneo generado.");
        } catch (e) { console.error(e); } finally { setGenerating(false); }
    };

    const saveEditing = async (id: string) => {
        await updateDoc(doc(db, 'calendario', id), { fechaAsignada: editDate, hora: editTime });
        setEditingMatchId(null);
    };

    const handleDelete = async (id: string) => {
        if(window.confirm("¿Eliminar partido?")) await deleteDoc(doc(db, 'calendario', id));
    };

    return (
        <div className="animate-fade-in" style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(243, 244, 246, 0.95)', display:'flex', flexDirection:'column', zIndex:1000, overflowY:'auto'}}>
            <div style={{padding:'20px', background:'white', boxShadow:'0 2px 4px rgba(0,0,0,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:1001}}>
                <h2 style={{margin:0, color:'#1f2937'}}>📅 Calendario Oficial</h2>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>

            <div style={{maxWidth:'1000px', margin:'20px auto', width:'95%'}}>
                
                {rol === 'admin' && showLobby && (
                    <div style={{background:'#fff7ed', padding:'15px', borderRadius:'8px', border:'1px solid #f59e0b', marginBottom:'20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div><h4 style={{margin:'0 0 5px 0', color:'#d97706'}}>🛠️ Gestión del Torneo</h4><p style={{margin:0, fontSize:'0.8rem', color:'#666'}}>Generar cruces automáticos.</p></div>
                        <button onClick={handleGenerateCalendar} disabled={generating} className="btn" style={{background: generating ? '#ccc' : '#ea580c', color: 'white', fontWeight: 'bold', fontSize: '0.85rem'}}>{generating ? 'Generando...' : '🔄 Generar Calendario'}</button>
                    </div>
                )}

                {/* LOBBY CONDICIONAL (Solo si no hay partidos) */}
                {showLobby && (
                    <div style={{marginBottom:'30px', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', borderLeft:'5px solid #10b981'}}>
                        <h3 style={{marginTop:0, color:'#065f46', display:'flex', alignItems:'center', gap:'10px'}}>📋 Equipos Confirmados <span style={{fontSize:'0.8rem', background:'#d1fae5', padding:'2px 8px', borderRadius:'10px'}}>{approvedTeams.length}</span></h3>
                        <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                            {approvedTeams.map(team => <div key={team.id} style={{padding:'8px 15px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'20px', fontWeight:'bold', color:'#166534', fontSize:'0.9rem'}}>✅ {team.nombreEquipo}</div>)}
                        </div>
                    </div>
                )}

                {/* --- PESTAÑAS DE NAVEGACIÓN --- */}
                {!showLobby && (
                    <div style={{display:'flex', gap:'10px', marginBottom:'20px', borderBottom:'1px solid #ddd', paddingBottom:'10px'}}>
                        <button 
                            onClick={()=>setViewMode('upcoming')} 
                            style={{
                                padding:'10px 20px', background: viewMode==='upcoming'?'#3b82f6':'transparent', 
                                color: viewMode==='upcoming'?'white':'#666', border:'none', borderRadius:'6px', 
                                cursor:'pointer', fontWeight:'bold', transition:'all 0.2s'
                            }}
                        >
                            📅 Próximos Juegos ({upcomingMatches.length})
                        </button>
                        <button 
                            onClick={()=>setViewMode('finished')} 
                            style={{
                                padding:'10px 20px', background: viewMode==='finished'?'#374151':'transparent', 
                                color: viewMode==='finished'?'white':'#666', border:'none', borderRadius:'6px', 
                                cursor:'pointer', fontWeight:'bold', transition:'all 0.2s'
                            }}
                        >
                            🏁 Resultados Finales ({finishedMatches.length})
                        </button>
                    </div>
                )}

                <div style={{display:'grid', gap:'15px'}}>
                    {(viewMode === 'upcoming' ? upcomingMatches : finishedMatches).map(m => {
                        const isEditing = editingMatchId === m.id;
                        const isLive = m.estatus === 'vivo';
                        const isFinished = m.estatus === 'finalizado';

                        return (
                            <div key={m.id} className="card" style={{display:'flex', flexDirection:'column', gap:'10px', borderLeft: isLive ? '5px solid #ef4444' : (isFinished ? '5px solid #6b7280' : '5px solid #3b82f6')}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px'}}>
                                    {isEditing ? (
                                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', background:'#eff6ff', padding:'10px', borderRadius:'8px', width:'100%'}}>
                                            <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{padding:'5px'}} />
                                            <input type="time" value={editTime} onChange={e=>setEditTime(e.target.value)} style={{padding:'5px'}} />
                                            <button onClick={() => saveEditing(m.id)} className="btn btn-primary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>💾</button>
                                            <button onClick={() => setEditingMatchId(null)} className="btn btn-secondary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>❌</button>
                                        </div>
                                    ) : (
                                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                            <div style={{fontSize:'0.9rem', color:'#6b7280', fontWeight:'bold'}}>📅 {m.fechaAsignada} &nbsp; ⏰ {m.hora}</div>
                                            {rol === 'admin' && !isFinished && !isLive && <button onClick={() => {setEditingMatchId(m.id); setEditDate(m.fechaAsignada); setEditTime(m.hora);}} style={{background:'none', border:'none', cursor:'pointer', fontSize:'1rem'}}>✏️</button>}
                                            {rol === 'admin' && <button onClick={()=>handleDelete(m.id)} style={{background:'none', border:'none', cursor:'pointer', opacity:0.5}}>🗑️</button>}
                                        </div>
                                    )}
                                    <div>
                                        {isLive && <span style={{background:'#ef4444', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold', animation:'pulse 1.5s infinite'}}>🔴 EN VIVO</span>}
                                        {isFinished && <span style={{background:'#374151', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold'}}>FINALIZADO</span>}
                                    </div>
                                </div>

                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0'}}>
                                    <div style={{textAlign:'center', flex:1}}><div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{m.equipoLocalNombre}</div>{(isLive || isFinished) && <div style={{fontSize:'2rem', fontWeight:'bold', lineHeight:1}}>{m.marcadorLocal}</div>}</div>
                                    <div style={{fontWeight:'bold', color:'#9ca3af', fontSize:'1.5rem'}}>VS</div>
                                    <div style={{textAlign:'center', flex:1}}><div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{m.equipoVisitanteNombre}</div>{(isLive || isFinished) && <div style={{fontSize:'2rem', fontWeight:'bold', lineHeight:1}}>{m.marcadorVisitante}</div>}</div>
                                </div>

                                {isLive && <button onClick={() => onViewLive(m.id)} className="btn" style={{width:'100%', background:'#ef4444', color:'white', border:'none'}}>📺 Ver Partido en Vivo</button>}
                                {isFinished && <button onClick={() => onViewDetail(m.id)} className="btn btn-secondary" style={{width:'100%'}}>📊 Ver Estadísticas Finales (Box Score)</button>}
                            </div>
                        );
                    })}
                    {(viewMode === 'upcoming' ? upcomingMatches : finishedMatches).length === 0 && <div style={{textAlign:'center', color:'#999', padding:'20px'}}>No hay partidos en esta lista.</div>}
                </div>
            </div>
        </div>
    );
};

export default CalendarViewer;