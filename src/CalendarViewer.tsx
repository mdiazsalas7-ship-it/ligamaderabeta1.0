import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, deleteDoc, addDoc } from 'firebase/firestore';

interface Match {
    id: string;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    fechaAsignada: string;
    hora: string;
    estatus: string; // 'programado', 'vivo', 'finalizado'
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
    
    // Estado para EDICIÓN RÁPIDA (Solo Admin)
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');

    useEffect(() => {
        // 1. Cargar Partidos (Tiempo Real)
        const q = query(collection(db, 'calendario'), orderBy('fechaAsignada', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            setMatches(list);
            setLoading(false);
        });

        // 2. Cargar Lobby de Equipos (VISIBLE PARA TODOS)
        const fetchLobby = async () => {
            try {
                const qTeams = query(collection(db, 'forma21s'), where('estatus', '==', 'aprobado'));
                const snap = await getDocs(qTeams);
                setApprovedTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovedTeam)));
            } catch (e) {
                console.error("Error cargando equipos", e);
            }
        };
        fetchLobby();

        return () => unsubscribe();
    }, []);

    // --- FUNCIONES DE GESTIÓN (SOLO ADMIN) ---
    
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

            // Usar equipos aprobados cargados en el estado
            let equipos = approvedTeams.map(t => ({ id: t.id, nombre: t.nombreEquipo }));

            if (equipos.length < 2) { 
                alert("❌ No hay suficientes equipos APROBADOS. Aprueba al menos 2."); 
                setGenerating(false); return; 
            }

            if (equipos.length % 2 !== 0) equipos.push({ id: 'bye', nombre: 'DESCANSO' });

            const totalRounds = equipos.length - 1;
            const matchesPerRound = equipos.length / 2;
            let fechaBase = new Date();
            // Próximo sábado
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

    const startEditing = (m: Match) => {
        setEditingMatchId(m.id);
        setEditDate(m.fechaAsignada);
        setEditTime(m.hora);
    };

    const cancelEditing = () => {
        setEditingMatchId(null);
        setEditDate('');
        setEditTime('');
    };

    const saveEditing = async (id: string) => {
        try {
            await updateDoc(doc(db, 'calendario', id), {
                fechaAsignada: editDate,
                hora: editTime
            });
            alert("✅ Fecha y Hora actualizadas.");
            setEditingMatchId(null);
        } catch (error) {
            console.error(error);
            alert("Error al actualizar partido.");
        }
    };

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(243, 244, 246, 0.95)', 
            display:'flex', flexDirection:'column', zIndex:1000, overflowY:'auto'
        }}>
            {/* HEADER */}
            <div style={{
                padding:'20px', background:'white', boxShadow:'0 2px 4px rgba(0,0,0,0.05)', 
                display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:1001
            }}>
                <h2 style={{margin:0, color:'#1f2937'}}>📅 Calendario Oficial</h2>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>

            <div style={{maxWidth:'1000px', margin:'20px auto', width:'95%'}}>
                
                {/* --- BOTÓN GENERAR (SOLO ADMIN) --- */}
                {rol === 'admin' && (
                    <div style={{background:'#fff7ed', padding:'15px', borderRadius:'8px', border:'1px solid #f59e0b', marginBottom:'20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div><h4 style={{margin:'0 0 5px 0', color:'#d97706'}}>🛠️ Gestión del Torneo</h4><p style={{margin:0, fontSize:'0.8rem', color:'#666'}}>Generar cruces automáticos.</p></div>
                        <button onClick={handleGenerateCalendar} disabled={generating} className="btn" style={{background: generating ? '#ccc' : '#ea580c', color: 'white', fontWeight: 'bold', fontSize: '0.85rem'}}>{generating ? 'Generando...' : '🔄 Generar Calendario'}</button>
                    </div>
                )}

                {/* --- LOBBY DE EQUIPOS (VISIBLE PARA TODOS) --- */}
                <div style={{marginBottom:'30px', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', borderLeft:'5px solid #10b981'}}>
                    <h3 style={{marginTop:0, color:'#065f46', display:'flex', alignItems:'center', gap:'10px'}}>
                        📋 Equipos Confirmados <span style={{fontSize:'0.8rem', background:'#d1fae5', padding:'2px 8px', borderRadius:'10px'}}>{approvedTeams.length}</span>
                    </h3>
                    <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'15px'}}>Equipos aprobados y listos para la competición.</p>
                    
                    {approvedTeams.length === 0 ? (
                        <div style={{color:'#999', fontStyle:'italic'}}>No hay equipos aprobados aún.</div>
                    ) : (
                        <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                            {approvedTeams.map(team => (
                                <div key={team.id} style={{
                                    padding:'8px 15px', background:'#f0fdf4', border:'1px solid #bbf7d0', 
                                    borderRadius:'20px', fontWeight:'bold', color:'#166534', fontSize:'0.9rem',
                                    display:'flex', alignItems:'center', gap:'8px'
                                }}>
                                    ✅ {team.nombreEquipo}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- LISTA DE PARTIDOS --- */}
                <h3 style={{color:'#374151', borderBottom:'2px solid #e5e7eb', paddingBottom:'10px'}}>Próximos Juegos</h3>
                
                {loading ? <div style={{textAlign:'center'}}>Cargando calendario...</div> : (
                    <div style={{display:'grid', gap:'15px'}}>
                        {matches.length === 0 && <div style={{textAlign:'center', padding:'40px', color:'#999'}}>No hay partidos programados.</div>}
                        
                        {matches.map(m => {
                            const isEditing = editingMatchId === m.id;
                            const isLive = m.estatus === 'vivo';
                            const isFinished = m.estatus === 'finalizado';

                            return (
                                <div key={m.id} className="card" style={{
                                    display:'flex', flexDirection:'column', gap:'10px', 
                                    borderLeft: isLive ? '5px solid #ef4444' : (isFinished ? '5px solid #6b7280' : '5px solid #3b82f6')
                                }}>
                                    {/* CABECERA: FECHA, HORA Y STATUS */}
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px'}}>
                                        
                                        {/* SI ESTAMOS EDITANDO (SOLO ADMIN) */}
                                        {isEditing ? (
                                            <div style={{display:'flex', gap:'10px', flexWrap:'wrap', background:'#eff6ff', padding:'10px', borderRadius:'8px', width:'100%'}}>
                                                <div style={{display:'flex', flexDirection:'column'}}>
                                                    <label style={{fontSize:'0.7rem', fontWeight:'bold'}}>Fecha:</label>
                                                    <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{padding:'5px'}} />
                                                </div>
                                                <div style={{display:'flex', flexDirection:'column'}}>
                                                    <label style={{fontSize:'0.7rem', fontWeight:'bold'}}>Hora:</label>
                                                    <input type="time" value={editTime} onChange={e=>setEditTime(e.target.value)} style={{padding:'5px'}} />
                                                </div>
                                                <div style={{display:'flex', gap:'5px', alignItems:'flex-end'}}>
                                                    <button onClick={() => saveEditing(m.id)} className="btn btn-primary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>💾 Guardar</button>
                                                    <button onClick={cancelEditing} className="btn btn-secondary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* VISTA NORMAL */
                                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                                <div style={{fontSize:'0.9rem', color:'#6b7280', fontWeight:'bold'}}>
                                                    📅 {m.fechaAsignada} &nbsp; ⏰ {m.hora}
                                                </div>
                                                {rol === 'admin' && !isFinished && !isLive && (
                                                    <button 
                                                        onClick={() => startEditing(m)}
                                                        style={{background:'none', border:'none', cursor:'pointer', fontSize:'1rem'}}
                                                        title="Editar Fecha/Hora"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                                {rol === 'admin' && (
                                                    <button onClick={()=>handleDelete(m.id)} style={{background:'none', border:'none', cursor:'pointer', opacity:0.5}} title="Eliminar Partido">🗑️</button>
                                                )}
                                            </div>
                                        )}

                                        {/* ETIQUETA DE ESTADO */}
                                        <div>
                                            {isLive && <span style={{background:'#ef4444', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold', animation:'pulse 1.5s infinite'}}>🔴 EN VIVO</span>}
                                            {isFinished && <span style={{background:'#374151', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold'}}>FINALIZADO</span>}
                                            {m.estatus === 'programado' && <span style={{background:'#dbeafe', color:'#1e40af', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold'}}>PROGRAMADO</span>}
                                        </div>
                                    </div>

                                    {/* EQUIPOS Y MARCADOR */}
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0'}}>
                                        <div style={{textAlign:'center', flex:1}}>
                                            <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{m.equipoLocalNombre}</div>
                                            {(isLive || isFinished) && <div style={{fontSize:'2rem', fontWeight:'bold', lineHeight:1}}>{m.marcadorLocal}</div>}
                                        </div>
                                        
                                        <div style={{fontWeight:'bold', color:'#9ca3af', fontSize:'1.5rem'}}>VS</div>
                                        
                                        <div style={{textAlign:'center', flex:1}}>
                                            <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{m.equipoVisitanteNombre}</div>
                                            {(isLive || isFinished) && <div style={{fontSize:'2rem', fontWeight:'bold', lineHeight:1}}>{m.marcadorVisitante}</div>}
                                        </div>
                                    </div>

                                    {/* BOTONES DE ACCIÓN (VER DETALLES O VER EN VIVO) */}
                                    {isLive && (
                                        <button onClick={() => onViewLive(m.id)} className="btn" style={{width:'100%', background:'#ef4444', color:'white', border:'none'}}>
                                            📺 Ver Partido en Vivo
                                        </button>
                                    )}
                                    
                                    {isFinished && (
                                        <button onClick={() => onViewDetail(m.id)} className="btn btn-secondary" style={{width:'100%'}}>
                                            📊 Ver Estadísticas Finales
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarViewer;