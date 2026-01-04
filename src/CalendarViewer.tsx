import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs, deleteDoc, addDoc } from 'firebase/firestore';

// --- CONSTANTE PARA LOGO POR DEFECTO ---
const DEFAULT_TEAM_LOGO = "https://cdn-icons-png.flaticon.com/512/451/451716.png";

interface Match {
    id: string;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    // Agregamos los IDs para poder buscar el logo
    equipoLocalId?: string;
    equipoVisitanteId?: string;
    fechaAsignada: string;
    hora: string;
    estatus: string; 
    cancha: string;
    marcadorLocal?: number;
    marcadorVisitante?: number;
    jornada?: number;
    datosSuspension?: {
        motivo: string;
        tiempoRestante: string;
        cuarto: number;
    };
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
    
    // --- ESTADO PARA PESTAÑAS ---
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

        // 2. Cargar Lobby (Para obtener los logos)
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
    
    finishedMatches.sort((a,b) => b.fechaAsignada.localeCompare(a.fechaAsignada));

    const showLobby = matches.length === 0;

    // --- HELPER PARA BUSCAR LOGO ---
    const getTeamLogo = (teamId?: string) => {
        if (!teamId) return DEFAULT_TEAM_LOGO;
        const team = approvedTeams.find(t => t.id === teamId);
        return team?.logoUrl || DEFAULT_TEAM_LOGO;
    };

    // --- REINICIAR TEMPORADA ---
    const handleResetSeason = async () => {
        const confirm1 = window.confirm("⚠️ ¿ESTÁS SEGURO DE REINICIAR LA TEMPORADA?");
        if (!confirm1) return;
        const confirm2 = window.confirm("☢️ ESTO BORRARÁ TODOS LOS JUEGOS Y ESTADÍSTICAS.\n\nLos equipos permanecerán registrados, pero la tabla volverá a cero.\n\n¿Proceder?");
        if (!confirm2) return;

        setGenerating(true);
        try {
            const oldMatches = await getDocs(collection(db, 'calendario'));
            const deletePromises = oldMatches.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            const oldStats = await getDocs(collection(db, 'stats_partido'));
            const statsPromises = oldStats.docs.map(d => deleteDoc(d.ref));
            await Promise.all(statsPromises);

            const equiposSnap = await getDocs(collection(db, 'equipos'));
            const resetPromises = equiposSnap.docs.map(d => updateDoc(d.ref, { 
                victorias: 0, derrotas: 0, puntos: 0, 
                puntos_favor: 0, puntos_contra: 0 
            }));
            await Promise.all(resetPromises);

            alert("✅ Temporada reiniciada. El sistema está limpio para un nuevo torneo.");
        } catch (e) {
            console.error(e);
            alert("Error al reiniciar temporada.");
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateCalendar = async () => {
        if (!window.confirm("¿Generar calendario automático Round Robin?")) return;
        setGenerating(true);
        try {
            await handleResetSeason(); 

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
                
                {/* --- ZONA DE GESTIÓN (SOLO ADMIN) --- */}
                {rol === 'admin' && (
                    <div style={{background:'#fff7ed', padding:'20px', borderRadius:'12px', border:'1px solid #f59e0b', marginBottom:'20px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)'}}>
                        <h4 style={{margin:'0 0 15px 0', color:'#d97706', fontSize:'1.1rem'}}>🛠️ Gestión del Torneo</h4>
                        
                        <div style={{display:'flex', gap:'15px', flexWrap:'wrap'}}>
                            {showLobby && (
                                <button 
                                    onClick={handleGenerateCalendar} 
                                    disabled={generating} 
                                    className="btn" 
                                    style={{background: '#ea580c', color: 'white', fontWeight: 'bold', flex:1, padding:'12px'}}
                                >
                                    {generating ? 'Procesando...' : '🔄 Generar Calendario Automático'}
                                </button>
                            )}

                            <button 
                                onClick={handleResetSeason} 
                                disabled={generating} 
                                className="btn" 
                                style={{background: '#dc2626', color: 'white', fontWeight: 'bold', flex:1, padding:'12px', border:'2px solid #991b1b'}}
                            >
                                ⚠️ REINICIAR TEMPORADA (Borrar Todo)
                            </button>
                        </div>
                    </div>
                )}

                {/* LOBBY */}
                {showLobby && (
                    <div style={{marginBottom:'30px', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', borderLeft:'5px solid #10b981'}}>
                        <h3 style={{marginTop:0, color:'#065f46', display:'flex', alignItems:'center', gap:'10px'}}>📋 Equipos Confirmados <span style={{fontSize:'0.8rem', background:'#d1fae5', padding:'2px 8px', borderRadius:'10px'}}>{approvedTeams.length}</span></h3>
                        <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                            {approvedTeams.map(team => <div key={team.id} style={{padding:'8px 15px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'20px', fontWeight:'bold', color:'#166534', fontSize:'0.9rem'}}>✅ {team.nombreEquipo}</div>)}
                        </div>
                    </div>
                )}

                {/* PESTAÑAS */}
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
                            📅 Activos / Programados ({upcomingMatches.length})
                        </button>
                        <button 
                            onClick={()=>setViewMode('finished')} 
                            style={{
                                padding:'10px 20px', background: viewMode==='finished'?'#374151':'transparent', 
                                color: viewMode==='finished'?'white':'#666', border:'none', borderRadius:'6px', 
                                cursor:'pointer', fontWeight:'bold', transition:'all 0.2s'
                            }}
                        >
                            🏁 Finalizados ({finishedMatches.length})
                        </button>
                    </div>
                )}

                <div style={{display:'grid', gap:'15px'}}>
                    {(viewMode === 'upcoming' ? upcomingMatches : finishedMatches).map(m => {
                        const isEditing = editingMatchId === m.id;
                        const isLive = m.estatus === 'vivo';
                        const isFinished = m.estatus === 'finalizado';
                        const isSuspended = m.estatus === 'suspendido';

                        let borderColor = '#3b82f6';
                        if (isLive) borderColor = '#ef4444'; 
                        if (isFinished) borderColor = '#6b7280'; 
                        if (isSuspended) borderColor = '#f59e0b'; 

                        // Buscamos los logos
                        const localLogo = getTeamLogo(m.equipoLocalId);
                        const visitorLogo = getTeamLogo(m.equipoVisitanteId);

                        return (
                            <div key={m.id} className="card" style={{display:'flex', flexDirection:'column', gap:'10px', borderLeft: `5px solid ${borderColor}`, position: 'relative'}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px'}}>
                                    
                                    {/* MODO EDICIÓN */}
                                    {isEditing ? (
                                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', background:'#eff6ff', padding:'10px', borderRadius:'8px', width:'100%'}}>
                                            <span style={{width:'100%', fontSize:'0.8rem', color:'#666'}}>Reprogramar Partido:</span>
                                            <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{padding:'5px'}} />
                                            <input type="time" value={editTime} onChange={e=>setEditTime(e.target.value)} style={{padding:'5px'}} />
                                            <button onClick={() => saveEditing(m.id)} className="btn btn-primary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>💾 Guardar</button>
                                            <button onClick={() => setEditingMatchId(null)} className="btn btn-secondary" style={{padding:'5px 10px', fontSize:'0.8rem'}}>❌</button>
                                        </div>
                                    ) : (
                                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                            <div style={{fontSize:'0.9rem', color:'#6b7280', fontWeight:'bold'}}>
                                                📅 {m.fechaAsignada} &nbsp; ⏰ {m.hora}
                                            </div>
                                            {rol === 'admin' && !isFinished && !isLive && (
                                                <button 
                                                    onClick={() => {setEditingMatchId(m.id); setEditDate(m.fechaAsignada); setEditTime(m.hora);}} 
                                                    style={{background:'none', border:'none', cursor:'pointer', fontSize:'1rem'}}
                                                    title="Reprogramar fecha/hora"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                            {rol === 'admin' && <button onClick={()=>handleDelete(m.id)} style={{background:'none', border:'none', cursor:'pointer', opacity:0.5}}>🗑️</button>}
                                        </div>
                                    )}

                                    {/* ETIQUETAS DE ESTADO */}
                                    <div>
                                        {isLive && <span style={{background:'#ef4444', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold', animation:'pulse 1.5s infinite'}}>🔴 EN VIVO</span>}
                                        {isFinished && <span style={{background:'#374151', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold'}}>FINALIZADO</span>}
                                        {isSuspended && <span style={{background:'#f59e0b', color:'black', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold', border:'1px solid #d97706'}}>⛔ SUSPENDIDO</span>}
                                    </div>
                                </div>

                                {/* INFO SUSPENSIÓN */}
                                {isSuspended && m.datosSuspension && (
                                    <div style={{background:'#fff7ed', border:'1px solid #fdba74', padding:'8px', borderRadius:'6px', fontSize:'0.85rem', color:'#9a3412'}}>
                                        <strong>Motivo:</strong> {m.datosSuspension.motivo} <br/>
                                        <strong>Detenido en:</strong> Q{m.datosSuspension.cuarto} - {m.datosSuspension.tiempoRestante}
                                    </div>
                                )}

                                {/* MARCADOR CON LOGOS */}
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 0'}}>
                                    {/* LOCAL */}
                                    <div style={{textAlign:'center', flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                                        <div style={{width:'50px', height:'50px', borderRadius:'50%', border:'2px solid #eee', overflow:'hidden', marginBottom:'5px', display:'flex', justifyContent:'center', alignItems:'center', background:'white'}}>
                                            <img src={localLogo} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="Local" onError={(e:any)=>{e.target.src=DEFAULT_TEAM_LOGO}} />
                                        </div>
                                        <div style={{fontWeight:'bold', fontSize:'1.1rem', lineHeight:1.1}}>{m.equipoLocalNombre}</div>
                                        {(isLive || isFinished || isSuspended) && <div style={{fontSize:'2rem', fontWeight:'bold', lineHeight:1, marginTop:'5px'}}>{m.marcadorLocal}</div>}
                                    </div>

                                    {/* VS */}
                                    <div style={{fontWeight:'bold', color:'#9ca3af', fontSize:'1.2rem', padding:'0 10px'}}>VS</div>

                                    {/* VISITANTE */}
                                    <div style={{textAlign:'center', flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                                        <div style={{width:'50px', height:'50px', borderRadius:'50%', border:'2px solid #eee', overflow:'hidden', marginBottom:'5px', display:'flex', justifyContent:'center', alignItems:'center', background:'white'}}>
                                            <img src={visitorLogo} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="Visita" onError={(e:any)=>{e.target.src=DEFAULT_TEAM_LOGO}} />
                                        </div>
                                        <div style={{fontWeight:'bold', fontSize:'1.1rem', lineHeight:1.1}}>{m.equipoVisitanteNombre}</div>
                                        {(isLive || isFinished || isSuspended) && <div style={{fontSize:'2rem', fontWeight:'bold', lineHeight:1, marginTop:'5px'}}>{m.marcadorVisitante}</div>}
                                    </div>
                                </div>

                                {/* BOTONES DE ACCIÓN */}
                                {isLive && <button onClick={() => onViewLive(m.id)} className="btn" style={{width:'100%', background:'#ef4444', color:'white', border:'none'}}>📺 Ver Partido en Vivo</button>}
                                
                                {isSuspended && (
                                    <button 
                                        onClick={() => onViewLive(m.id)} 
                                        className="btn" 
                                        style={{width:'100%', background:'#d97706', color:'white', border:'none', fontWeight:'bold'}}
                                    >
                                        ↪️ REANUDAR PARTIDO (Mesa Técnica)
                                    </button>
                                )}
                                
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