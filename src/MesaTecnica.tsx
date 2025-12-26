import React, { useState, useEffect, memo, useCallback } from 'react';
import { db } from './firebase';
import { doc, updateDoc, onSnapshot, collection, query, getDocs, setDoc, increment, deleteDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';

// --- INTERFACES ---
interface Player { id: string; nombre: string; numero: number; equipoId: string; }
interface Staff { entrenador: string; asistente: string; expulsado?: boolean; faltasTecnicas?: number; }

// Modificamos GameEvent para guardar DATOS para poder borrarlos luego
interface GameEvent { 
    id: string; 
    text: string; 
    time: string; 
    team: 'local'|'visitante'|'system'; 
    type: 'score'|'stat'|'foul'|'sub'|'period'|'timeout'|'system'; 
    // Campos para reversión (Importantes para el botón X)
    playerId?: string;
    action?: string;
    val?: number;
}

interface PlayerGameStats {
    puntos: number; faltasPersonales: number; faltasTecnicas: number;
    faltasAntideportivas: number; faltasDescalificantes: number; 
    faltasTotales: number; expulsado: boolean;
}

interface MatchData {
    id: string;
    equipoLocalId: string; equipoLocalNombre: string;
    equipoVisitanteId: string; equipoVisitanteNombre: string;
    marcadorLocal: number; marcadorVisitante: number;
    cuarto: number; estatus: string;
    forma5?: any;
    staffLocal?: Staff; staffVisitante?: Staff;
    faltasLocal: number; faltasVisitante: number;
    tiemposLocal: number; tiemposVisitante: number;
    gameLog?: GameEvent[];
}

// --- 1. VISUALIZADOR DE PERIODO (SIN RELOJ) ---
const PeriodDisplay = memo(({ periodo, estatus, onNextQuarter }: { periodo: number, estatus: string, onNextQuarter: () => void }) => {
    const getPeriodoLabel = (p: number) => p <= 4 ? `CUARTO ${p}` : `PRÓRROGA ${p - 4}`;

    return (
        <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
            <div style={{color:'#fbbf24', fontWeight:'bold', fontSize:'1.5rem', marginBottom:'10px', textShadow:'2px 2px 4px #000'}}>
                {getPeriodoLabel(periodo)}
            </div>
            
            <div style={{display:'flex', gap:'5px'}}>
                <button onClick={onNextQuarter} className="btn" style={{background: estatus === 'programado' ? '#10b981' : '#f59e0b', color:'black', fontWeight:'bold', padding:'10px 20px', fontSize:'1rem', border:'none', borderRadius:'6px', cursor:'pointer'}}>
                    {estatus === 'programado' ? 'INICIAR JUEGO' : (periodo >= 4 ? 'FINALIZAR PARTIDO' : 'SIGUIENTE PERIODO >>')}
                </button>
            </div>
        </div>
    );
});

// --- 2. FILA DE JUGADOR ---
const PlayerRow = memo(({ player, team, stats, isSubTarget, onStat, onSub, isCaptain }: any) => {
    // Protección contra undefined para evitar pantalla blanca
    const safeStats = stats || { faltasTotales: 0, expulsado: false };
    const isExpulsado = safeStats.expulsado;
    const faltas = safeStats.faltasTotales;
    
    // Si está expulsado, bloqueamos clics salvo para sustitución
    const isBlocked = isExpulsado && !isSubTarget;

    return (
        <div style={{
            marginBottom:'4px', padding:'4px 6px', borderRadius:'4px',
            background: isSubTarget ? '#ef4444' : '#202020',
            border: isSubTarget ? '2px dashed white' : '1px solid #333',
            display:'flex', flexDirection:'column', gap:'2px',
            opacity: isBlocked ? 0.5 : 1,
            pointerEvents: isBlocked ? 'none' : 'auto',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }} onClick={() => isSubTarget && onSub(player)}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontWeight:'bold', color:'white', display:'flex', alignItems:'center', gap:'5px', fontSize:'0.85rem'}}>
                    <span style={{background:'#444', padding:'1px 5px', borderRadius:'3px', color:'#fff', fontSize:'0.75rem'}}>#{player.numero}</span>
                    <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'110px'}}>
                        {player.nombre} {isCaptain && <span title="Capitán" style={{color:'#f59e0b', marginLeft:'5px'}}>⭐</span>}
                    </span>
                </div>
                <div style={{display:'flex', gap:'2px'}}>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} style={{width:'6px', height:'6px', borderRadius:'50%', background: i < faltas ? (i>=4?'red':'yellow') : '#333', border: '1px solid #555'}}></div>
                    ))}
                    {isExpulsado && <span style={{fontSize:'0.6rem', color:'red', fontWeight:'bold', marginLeft:'2px'}}>EXP</span>}
                </div>
            </div>
            {!isSubTarget && !isExpulsado && (
                <div style={{display:'flex', gap:'2px', justifyContent:'space-between', marginTop:'2px'}}>
                    {/* PUNTOS */}
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'puntos', 1)}} className="btn-stat" style={{background:'#1d4ed8'}}>+1</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'puntos', 2)}} className="btn-stat" style={{background:'#1d4ed8'}}>+2</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'puntos', 3)}} className="btn-stat" style={{background:'#1d4ed8'}}>+3</button>
                    
                    {/* REBOTE UNIFICADO */}
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'rebote', 1)}} className="btn-stat" style={{background:'#059669', fontSize:'0.65rem', flex: 2}} title="Rebote">REB</button>
                    
                    {/* FALTAS */}
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_P', 0)}} className="btn-stat" style={{background:'#dc2626', color:'white'}}>P</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_T', 0)}} className="btn-stat" style={{background:'#be123c', color:'white'}}>T</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_U', 0)}} className="btn-stat" style={{background:'#991b1b', color:'white'}}>U</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_D', 0)}} className="btn-stat" style={{background:'black', color:'red', border:'1px solid red'}}>D</button>
                </div>
            )}
            {isSubTarget && <div style={{textAlign:'center', color:'white', fontWeight:'bold', fontSize:'0.8rem', padding:'2px'}}>CLICK PARA CONFIRMAR SALIDA ⬆️</div>}
        </div>
    );
});

// --- 3. FILA DE STAFF (DT) ---
const StaffRow = memo(({ staff, team, onAction }: any) => {
    // Si no hay staff o nombre, mostrar placeholder seguro
    const s = staff || {};
    const entrenadorNombre = s.entrenador || 'Sin DT Asignado';
    const asistenteNombre = s.asistente || '';
    const isExpulsado = s.expulsado;

    return (
        <div style={{marginTop:'15px', marginBottom:'10px', padding:'8px', borderRadius:'4px', background: '#2d3748', border: '1px solid #4a5568', opacity: isExpulsado ? 0.6 : 1}}>
            <div style={{color:'#a0aec0', fontSize:'0.75rem', fontWeight:'bold', marginBottom:'4px', textTransform:'uppercase', borderBottom:'1px solid #4a5568', paddingBottom:'2px'}}>CUERPO TÉCNICO</div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <div style={{fontWeight:'bold', fontSize:'0.9rem', color:'white'}}>DT: {entrenadorNombre}</div>
                    {asistenteNombre && <div style={{fontSize:'0.75rem', color:'#cbd5e0'}}>AT: {asistenteNombre}</div>}
                </div>
                {!isExpulsado ? (
                    <div style={{display:'flex', gap:'5px'}}>
                        <button onClick={()=>onAction('falta_T')} className="btn-stat" style={{background:'#be123c', color:'white', padding:'4px 10px', fontSize:'0.75rem'}}>T</button>
                        <button onClick={()=>onAction('falta_D')} className="btn-stat" style={{background:'black', color:'red', border:'1px solid red', padding:'4px 10px', fontSize:'0.75rem'}}>D</button>
                    </div>
                ) : <span style={{color:'red', fontWeight:'bold', fontSize:'0.8rem'}}>EXPULSADO</span>}
            </div>
        </div>
    );
});

const MesaTecnica: React.FC<{ onClose: () => void, onMatchFinalized: () => void }> = ({ onClose, onMatchFinalized }) => {
    const [matches, setMatches] = useState<any[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [matchData, setMatchData] = useState<MatchData | null>(null);
    
    const [localOnCourt, setLocalOnCourt] = useState<Player[]>([]);
    const [localBench, setLocalBench] = useState<Player[]>([]);
    const [visitanteOnCourt, setVisitanteOnCourt] = useState<Player[]>([]);
    const [visitanteBench, setVisitanteBench] = useState<Player[]>([]);
    const [captains, setCaptains] = useState<{local: string|null, visitante: string|null}>({ local: null, visitante: null });
    const [statsCache, setStatsCache] = useState<Record<string, PlayerGameStats>>({});
    
    // Estado local para Staff (Cache)
    const [staffCache, setStaffCache] = useState<{local: Staff, visitante: Staff}>({ local: {entrenador:'', asistente:''}, visitante: {entrenador:'', asistente:''} });

    const [subMode, setSubMode] = useState<{team: 'local'|'visitante', playerIn: Player} | null>(null);
    const [benchModalOpen, setBenchModalOpen] = useState<'local' | 'visitante' | null>(null);

    // 1. CARGAR PARTIDOS
    useEffect(() => {
        const fetchMatches = async () => {
            const q = query(collection(db, 'calendario'), where('estatus', 'in', ['programado', 'vivo']));
            const snap = await getDocs(q);
            setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        if (!selectedMatchId) fetchMatches();
    }, [selectedMatchId]);

    // 2. ESCUCHAR DATOS DEL PARTIDO
    useEffect(() => {
        if (!selectedMatchId) return;
        const unsub = onSnapshot(doc(db, 'calendario', selectedMatchId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as any;
                setMatchData({
                    id: docSnap.id, ...data,
                    tiemposLocal: data.tiemposLocal ?? 2,
                    tiemposVisitante: data.tiemposVisitante ?? 2,
                    staffLocal: data.staffLocal || {entrenador:'', asistente:''},
                    staffVisitante: data.staffVisitante || {entrenador:'', asistente:''},
                    forma5: data.forma5 || {},
                    gameLog: data.gameLog || []
                });
            }
        });
        return () => unsub();
    }, [selectedMatchId]);

    // Sincronizar Staff cuando cambie matchData (AQUÍ ESTÁ LA CLAVE PARA QUE SE VEA EL NOMBRE)
    useEffect(() => {
        if (matchData) {
            setStaffCache({
                local: matchData.staffLocal || {entrenador:'', asistente:''},
                visitante: matchData.staffVisitante || {entrenador:'', asistente:''}
            });
        }
    }, [matchData?.staffLocal, matchData?.staffVisitante]);

    // 3. INICIALIZAR ROSTERS
    useEffect(() => {
        if (matchData) {
            if (localOnCourt.length === 0 && localBench.length === 0) {
                const processTeam = (forma5Data: any) => {
                    if (!forma5Data) return { court: [], bench: [], captainId: null };
                    let players: Player[] = [];
                    if (Array.isArray(forma5Data)) players = forma5Data;
                    else if (forma5Data.jugadores) players = forma5Data.jugadores;
                    
                    let starters = forma5Data.startersIds || players.slice(0, 5).map(p => p.id);
                    let captain = forma5Data.captainId || null;
                    
                    return {
                        court: players.filter(p => starters.includes(p.id)),
                        bench: players.filter(p => !starters.includes(p.id)),
                        captainId: captain
                    };
                };
                const l = processTeam(matchData.forma5?.[matchData.equipoLocalId]);
                const v = processTeam(matchData.forma5?.[matchData.equipoVisitanteId]);
                
                setLocalOnCourt(l.court); setLocalBench(l.bench);
                setVisitanteOnCourt(v.court); setVisitanteBench(v.bench);
                setCaptains({ local: l.captainId, visitante: v.captainId });

                const cache: Record<string, PlayerGameStats> = {};
                [...l.court, ...l.bench, ...v.court, ...v.bench].forEach(p => {
                    cache[p.id] = { puntos: 0, faltasPersonales: 0, faltasTecnicas: 0, faltasAntideportivas: 0, faltasDescalificantes: 0, faltasTotales: 0, expulsado: false };
                });
                setStatsCache(cache);
                
                const loadRealStats = async () => {
                    const qStats = query(collection(db, 'stats_partido'), where('partidoId', '==', matchData.id));
                    const snapStats = await getDocs(qStats);
                    snapStats.forEach(d => {
                        const s = d.data();
                        setStatsCache(prev => ({
                            ...prev,
                            [s.jugadorId]: {
                                ...prev[s.jugadorId],
                                puntos: s.puntos || 0,
                                faltasPersonales: s.faltasPersonales || 0,
                                faltasTecnicas: s.faltasTecnicas || 0,
                                faltasAntideportivas: s.faltasAntideportivas || 0,
                                faltasDescalificantes: s.faltasDescalificantes || 0,
                                faltasTotales: s.faltasTotales || 0,
                                expulsado: (s.faltasTotales >= 5 || s.faltasTecnicas >= 2 || s.faltasAntideportivas >= 2 || s.faltasDescalificantes >= 1)
                            }
                        }));
                    });
                };
                loadRealStats();
            }
        }
    }, [matchData?.id]);

    const formatTimeForLog = () => matchData ? `Q${matchData.cuarto}` : 'Q1';

    const addLog = async (text: string, type: GameEvent['type'], team: 'local'|'visitante'|'system', playerId?: string, action?: string, val?: number) => {
        if (!matchData) return;
        const newEvent: GameEvent = { 
            id: Date.now().toString(), text, time: formatTimeForLog(), team, type, 
            playerId, action, val
        };
        const newLog = [newEvent, ...(matchData.gameLog || [])].slice(0, 50);
        await updateDoc(doc(db, 'calendario', matchData.id), { gameLog: newLog });
    };

    const handleDeleteLog = async (logId: string) => {
        if (!matchData) return;
        const logEntry = matchData.gameLog?.find(l => l.id === logId);
        if (!logEntry) return;
        if (!window.confirm("¿Eliminar registro?")) return;

        try {
            const updates: any = { gameLog: matchData.gameLog?.filter(l => l.id !== logId) };
            if (logEntry.action === 'puntos' && logEntry.val) updates[logEntry.team === 'local' ? 'marcadorLocal' : 'marcadorVisitante'] = increment(-logEntry.val);
            if (logEntry.action?.startsWith('falta')) updates[logEntry.team === 'local' ? 'faltasLocal' : 'faltasVisitante'] = increment(-1);
            if (logEntry.type === 'timeout') updates[logEntry.team === 'local' ? 'tiemposLocal' : 'tiemposVisitante'] = increment(1);

            await updateDoc(doc(db, 'calendario', matchData.id), updates);

            if (logEntry.playerId && logEntry.action) {
                const statRef = doc(db, 'stats_partido', `${matchData.id}_${logEntry.playerId}`);
                const statUpdates: any = {};
                
                if (logEntry.action === 'puntos') {
                    statUpdates.puntos = increment(-logEntry.val!);
                    if (logEntry.val === 3) statUpdates.triples = increment(-1);
                } else if (logEntry.action === 'rebote') {
                    statUpdates.rebotes = increment(-1);
                } else if (logEntry.action.startsWith('falta')) {
                    statUpdates.faltasTotales = increment(-1);
                    if (logEntry.action === 'falta_P') statUpdates.faltasPersonales = increment(-1);
                    if (logEntry.action === 'falta_T') statUpdates.faltasTecnicas = increment(-1);
                    if (logEntry.action === 'falta_U') statUpdates.faltasAntideportivas = increment(-1);
                    if (logEntry.action === 'falta_D') statUpdates.faltasDescalificantes = increment(-1);
                }

                if (Object.keys(statUpdates).length > 0) {
                    await setDoc(statRef, statUpdates, { merge: true });
                    setStatsCache(prev => {
                        const pStats = { ...prev[logEntry.playerId!] };
                        if (logEntry.action === 'puntos') pStats.puntos -= logEntry.val!;
                        if (logEntry.action?.startsWith('falta')) {
                            pStats.faltasTotales -= 1;
                            if (pStats.faltasTotales < 5) pStats.expulsado = false; 
                        }
                        return { ...prev, [logEntry.playerId!]: pStats };
                    });
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleStat = useCallback(async (player: Player, team: 'local'|'visitante', action: 'puntos'|'rebote'|'falta_P'|'falta_T'|'falta_U'|'falta_D', val: number) => {
        if (!matchData || statsCache[player.id]?.expulsado) return; 
        
        if (matchData.estatus === 'programado') updateDoc(doc(db, 'calendario', matchData.id), { estatus: 'vivo' });

        const teamName = team === 'local' ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre;
        const currentStats = statsCache[player.id] || { puntos:0, faltasPersonales:0, faltasTecnicas:0, faltasAntideportivas:0, faltasDescalificantes:0, faltasTotales:0, expulsado:false };
        let newStats = { ...currentStats };
        let logText = '';

        if (action === 'puntos') {
            newStats.puntos += val;
            logText = `🏀 ${player.nombre} (+${val})`;
            const field = team === 'local' ? 'marcadorLocal' : 'marcadorVisitante';
            await updateDoc(doc(db, 'calendario', matchData.id), { [field]: increment(val) });
        } else if (action.startsWith('falta')) {
            newStats.faltasTotales += 1;
            const field = team === 'local' ? 'faltasLocal' : 'faltasVisitante';
            await updateDoc(doc(db, 'calendario', matchData.id), { [field]: increment(1) });
            if (action === 'falta_P') { newStats.faltasPersonales++; logText = `🤜 P: ${player.nombre}`; }
            if (action === 'falta_T') { newStats.faltasTecnicas++; logText = `⚠️ T: ${player.nombre}`; }
            if (action === 'falta_U') { newStats.faltasAntideportivas++; logText = `🛑 U: ${player.nombre}`; }
            if (action === 'falta_D') { newStats.faltasDescalificantes++; logText = `⛔ D: ${player.nombre}`; }

            if (newStats.faltasTotales >= 5 || newStats.faltasTecnicas >= 2 || newStats.faltasAntideportivas >= 2 || newStats.faltasDescalificantes >= 1) {
                logText += " (EXPULSADO)";
                newStats.expulsado = true;
                alert(`🟥 EXPULSIÓN: ${player.nombre}`);
            }
        } else {
            logText = `🖐️ Rebote: ${player.nombre}`;
        }

        setStatsCache(prev => ({ ...prev, [player.id]: newStats }));
        await addLog(logText, action.startsWith('falta') ? 'foul' : action === 'puntos' ? 'score' : 'stat', team, player.id, action, val);
        
        const statRef = doc(db, 'stats_partido', `${matchData.id}_${player.id}`);
        const payload: any = { partidoId: matchData.id, jugadorId: player.id, nombre: player.nombre, equipo: teamName, fecha: new Date().toISOString() };
        if (action === 'puntos') { payload.puntos = increment(val); if(val===3) payload.triples = increment(1); }
        if (action === 'rebote') payload.rebotes = increment(1);
        if (action.startsWith('falta')) {
            payload.faltasTotales = increment(1);
            if(action === 'falta_P') payload.faltasPersonales = increment(1);
            if(action === 'falta_T') payload.faltasTecnicas = increment(1);
            if(action === 'falta_U') payload.faltasAntideportivas = increment(1);
            if(action === 'falta_D') payload.faltasDescalificantes = increment(1);
        }
        await setDoc(statRef, payload, { merge: true });
    }, [matchData, statsCache]);

    // --- STAFF ACTIONS (DT) ---
    const handleStaffAction = async (team: 'local'|'visitante', action: 'falta_T'|'falta_D') => {
        if (!matchData) return;
        const currentStaff = (team === 'local' ? staffCache.local : staffCache.visitante) || { entrenador: '' };
        if (!currentStaff.entrenador) return alert("No hay DT registrado");
        
        if (matchData.estatus === 'programado') updateDoc(doc(db, 'calendario', matchData.id), { estatus: 'vivo' });

        let logText = `⚠️ T (Banca): ${currentStaff.entrenador}`;
        if (action === 'falta_D') logText = `⛔ D (Banca): ${currentStaff.entrenador}`;

        const newStaffState = { ...currentStaff };
        if (action === 'falta_T') newStaffState.faltasTecnicas = (newStaffState.faltasTecnicas || 0) + 1;
        if (action === 'falta_D') newStaffState.expulsado = true;
        if ((newStaffState.faltasTecnicas || 0) >= 2) newStaffState.expulsado = true;

        setStaffCache(prev => ({ ...prev, [team]: newStaffState }));
        const staffField = team === 'local' ? 'staffLocal' : 'staffVisitante';
        const fieldFouls = team === 'local' ? 'faltasLocal' : 'faltasVisitante';
        
        await updateDoc(doc(db, 'calendario', matchData.id), { [staffField]: newStaffState, [fieldFouls]: increment(1) });
        await addLog(logText, 'foul', team, undefined, action);
    };

    // --- CAMBIOS ---
    const confirmSubstitution = (playerOut: Player) => {
        if (!subMode) return;
        if (subMode.team === 'local') {
            setLocalOnCourt(prev => [...prev.filter(p => p.id !== playerOut.id), subMode.playerIn]);
            setLocalBench(prev => [...prev.filter(p => p.id !== subMode.playerIn.id), playerOut]);
        } else {
            setVisitanteOnCourt(prev => [...prev.filter(p => p.id !== playerOut.id), subMode.playerIn]);
            setVisitanteBench(prev => [...prev.filter(p => p.id !== subMode.playerIn.id), playerOut]);
        }
        addLog(`🔄 Cambio: Sale ${playerOut.nombre}, Entra ${subMode.playerIn.nombre}`, 'sub', subMode.team);
        setSubMode(null);
    };

    const handleNextQuarter = async () => {
        if (!matchData) return;
        if (matchData.estatus === 'programado') {
            await updateDoc(doc(db, 'calendario', matchData.id), { estatus: 'vivo', cuarto: 1 });
            addLog("📢 INICIO DEL PARTIDO", 'system', 'system');
            return;
        }
        if (!window.confirm(`¿Iniciar Siguiente Periodo?`)) return;
        
        let updatePayload: any = { cuarto: increment(1), faltasLocal: 0, faltasVisitante: 0 };
        const nextQ = matchData.cuarto + 1;
        if (nextQ === 3) { updatePayload.tiemposLocal = 3; updatePayload.tiemposVisitante = 3; } 
        else if (nextQ > 4) { updatePayload.tiemposLocal = 1; updatePayload.tiemposVisitante = 1; }
        
        await updateDoc(doc(db, 'calendario', matchData.id), updatePayload);
        addLog(`🕒 Inicio del Periodo ${nextQ}`, 'period', 'system');
    };

    const handleFinalize = async () => {
        if (!matchData || !window.confirm("¿FINALIZAR PARTIDO?")) return;
        const localWins = matchData.marcadorLocal > matchData.marcadorVisitante;
        const winnerId = localWins ? matchData.equipoLocalId : matchData.equipoVisitanteId;
        const loserId = localWins ? matchData.equipoVisitanteId : matchData.equipoLocalId;
        await updateDoc(doc(db, 'equipos', winnerId), { victorias: increment(1), puntos: increment(2), puntos_favor: increment(matchData.marcadorLocal), puntos_contra: increment(matchData.marcadorVisitante) });
        await updateDoc(doc(db, 'equipos', loserId), { derrotas: increment(1), puntos: increment(1), puntos_favor: increment(matchData.marcadorVisitante), puntos_contra: increment(matchData.marcadorLocal) });
        await updateDoc(doc(db, 'calendario', matchData.id), { estatus: 'finalizado' });
        onMatchFinalized(); onClose();
    };

    const handleResetGame = async () => {
        if (!matchData || !window.confirm("⚠️ ¿REINICIAR TODO?")) return;
        const statsQ = query(collection(db, 'stats_partido'), where('partidoId', '==', matchData.id));
        const statsSnap = await getDocs(statsQ);
        await Promise.all(statsSnap.docs.map(d => deleteDoc(d.ref)));
        const cleanCache = { ...statsCache }; Object.keys(cleanCache).forEach(key => cleanCache[key] = { puntos:0, faltasPersonales:0, faltasTecnicas:0, faltasAntideportivas:0, faltasDescalificantes:0, faltasTotales:0, expulsado:false });
        setStatsCache(cleanCache);
        setLocalOnCourt([]); setLocalBench([]); setVisitanteOnCourt([]); setVisitanteBench([]);
        await updateDoc(doc(db, 'calendario', matchData.id), { marcadorLocal: 0, marcadorVisitante: 0, faltasLocal: 0, faltasVisitante: 0, tiemposLocal: 2, tiemposVisitante: 2, cuarto: 1, gameLog: [], estatus: 'programado', staffLocal: null, staffVisitante: null });
        alert("Reiniciado.");
    };

    // --- TIMEOUTS ---
    const handleTimeoutAdjustment = async (team: 'local'|'visitante', change: number) => {
        if (!matchData) return;
        const current = team === 'local' ? matchData.tiemposLocal : matchData.tiemposVisitante;
        if (change < 0 && current <= 0) return;

        const field = team === 'local' ? 'tiemposLocal' : 'tiemposVisitante';
        const teamName = team === 'local' ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre;

        const updates: any = { [field]: increment(change) };
        if (change < 0) {
            const newEvent: GameEvent = {
                id: Date.now().toString(), text: `🛑 TIEMPO MUERTO: ${teamName}`, 
                time: formatTimeForLog(), team, type: 'timeout', action: 'timeout'
            };
            updates.gameLog = [newEvent, ...(matchData.gameLog || [])];
        } 
        await updateDoc(doc(db, 'calendario', matchData.id), updates);
    };

    if (!selectedMatchId) return (
        <div className="animate-fade-in" style={{padding:'40px', maxWidth:'800px', margin:'0 auto'}}>
            <h2 style={{color:'var(--primary)'}}>📡 Mesa Técnica Pro FIBA</h2>
            <div style={{display:'grid', gap:'15px'}}>
                {matches.map(m => (
                    <div key={m.id} onClick={() => setSelectedMatchId(m.id)} className="card" style={{cursor:'pointer', borderLeft: m.estatus==='vivo'?'5px solid red':'5px solid blue', display:'flex', justifyContent:'space-between'}}>
                        <strong>{m.equipoLocalNombre} vs {m.equipoVisitanteNombre}</strong>
                        <span>{m.estatus === 'vivo' ? '🔴 EN VIVO' : '📅 PROGRAMADO'}</span>
                    </div>
                ))}
            </div>
            <button onClick={onClose} className="btn btn-secondary" style={{marginTop:'20px'}}>Salir</button>
        </div>
    );

    if (!matchData) return <div style={{padding:'50px', color:'white'}}>Cargando...</div>;

    return (
        <div style={{background:'#121212', height:'100vh', color:'white', display:'flex', flexDirection:'column', overflow:'hidden'}}>
            <style>{`.btn-stat { flex:1; padding:6px 0; font-size:0.75rem; font-weight:bold; border:none; border-radius:3px; cursor:pointer; background:#2563eb; color:white; transition: opacity 0.1s; }.btn-stat:active { transform:scale(0.95); opacity:0.8; }.clock-btn { background:#333; color:white; border:1px solid #555; padding:4px 8px; cursor:pointer; font-size:0.75rem; border-radius:3px; font-weight:bold; backdrop-filter: blur(4px); background: rgba(50,50,50,0.8); }.bonus-indicator { font-size: 0.8rem; background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-top: 5px; animation: pulse 2s infinite; display:inline-block; box-shadow: 0 0 10px #ef4444; }.timeout-btn { background: #d97706; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 5px; display: block; width: 100%; transition: background 0.2s; }.timeout-btn:disabled { background: #555; color: #999; cursor: not-allowed; }`}</style>
            
            <div style={{backgroundImage: 'url(https://i.postimg.cc/Kj11f2z8/cartoon-basketball-court-vector.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#000', padding:'8px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'2px solid #333', flexShrink:0}}>
                <div style={{textAlign:'center', width:'25%'}}>
                    <div style={{color:'#60a5fa', fontWeight:'bold', fontSize:'0.9rem'}}>{matchData.equipoLocalNombre}</div>
                    <div style={{fontSize:'2.8rem', fontWeight:'bold', lineHeight:1}}>{matchData.marcadorLocal}</div>
                    <div style={{fontSize:'0.8rem', color:'#ccc'}}>FALTAS: {matchData.faltasLocal}</div>
                    {matchData.faltasLocal >= 5 && <div className="bonus-indicator">BONUS</div>}
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', marginTop:'5px'}}>
                        <button onClick={()=>handleTimeoutAdjustment('local', -1)} style={{background:'#d97706', color:'white', border:'none', borderRadius:'3px', width:'30px', fontWeight:'bold', cursor:'pointer'}}>-</button>
                        <span style={{color:'white', fontWeight:'bold', fontSize:'0.9rem'}}>TM: {matchData.tiemposLocal}</span>
                        <button onClick={()=>handleTimeoutAdjustment('local', 1)} style={{background:'#10b981', color:'white', border:'none', borderRadius:'3px', width:'30px', fontWeight:'bold', cursor:'pointer'}}>+</button>
                    </div>
                </div>
                
                <PeriodDisplay periodo={matchData.cuarto} estatus={matchData.estatus} onNextQuarter={handleNextQuarter} />
                
                <div style={{textAlign:'center', width:'25%'}}>
                    <div style={{color:'#fbbf24', fontWeight:'bold', fontSize:'0.9rem'}}>{matchData.equipoVisitanteNombre}</div>
                    <div style={{fontSize:'2.8rem', fontWeight:'bold', lineHeight:1}}>{matchData.marcadorVisitante}</div>
                    <div style={{fontSize:'0.8rem', color:'#ccc'}}>FALTAS: {matchData.faltasVisitante}</div>
                    {matchData.faltasVisitante >= 5 && <div className="bonus-indicator">BONUS</div>}
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', marginTop:'5px'}}>
                        <button onClick={()=>handleTimeoutAdjustment('visitante', -1)} style={{background:'#d97706', color:'white', border:'none', borderRadius:'3px', width:'30px', fontWeight:'bold', cursor:'pointer'}}>-</button>
                        <span style={{color:'white', fontWeight:'bold', fontSize:'0.9rem'}}>TM: {matchData.tiemposVisitante}</span>
                        <button onClick={()=>handleTimeoutAdjustment('visitante', 1)} style={{background:'#10b981', color:'white', border:'none', borderRadius:'3px', width:'30px', fontWeight:'bold', cursor:'pointer'}}>+</button>
                    </div>
                </div>
            </div>

            <div style={{flex:1, display:'flex', overflow:'hidden'}}>
                {/* LOCAL */}
                <div style={{flex:1, borderRight:'1px solid #333', display:'flex', flexDirection:'column', background:'#1a1a1a'}}>
                    <div style={{padding:'8px', background:'#1e3a8a', display:'flex', justifyContent:'space-between', alignItems:'center'}}><span style={{color:'#93c5fd', fontWeight:'bold', fontSize:'0.8rem'}}>LOCAL</span><button onClick={() => setBenchModalOpen('local')} style={{background:'#2563eb', color:'white', border:'none', borderRadius:'3px', padding:'2px 8px', fontSize:'0.75rem'}}>CAMBIOS</button></div>
                    <div style={{flex:1, overflowY:'auto', padding:'5px'}}>
                        {localOnCourt.map(p => <PlayerRow key={p.id} player={p} team="local" stats={statsCache[p.id]} isSubTarget={subMode?.team==='local'} onStat={handleStat} onSub={confirmSubstitution} isCaptain={captains.local === p.id} />)}
                        <StaffRow staff={staffCache.local} team="local" onAction={(a:any) => handleStaffAction('local', a)} />
                    </div>
                </div>
                {/* VISITANTE */}
                <div style={{flex:1, display:'flex', flexDirection:'column', background:'#1a1a1a'}}>
                    <div style={{padding:'8px', background:'#78350f', display:'flex', justifyContent:'space-between', alignItems:'center'}}><span style={{color:'#fde047', fontWeight:'bold', fontSize:'0.8rem'}}>VISITANTE</span><button onClick={() => setBenchModalOpen('visitante')} style={{background:'#d97706', color:'white', border:'none', borderRadius:'3px', padding:'2px 8px', fontSize:'0.75rem'}}>CAMBIOS</button></div>
                    <div style={{flex:1, overflowY:'auto', padding:'5px'}}>
                        {visitanteOnCourt.map(p => <PlayerRow key={p.id} player={p} team="visitante" stats={statsCache[p.id]} isSubTarget={subMode?.team==='visitante'} onStat={handleStat} onSub={confirmSubstitution} isCaptain={captains.visitante === p.id} />)}
                        <StaffRow staff={staffCache.visitante} team="visitante" onAction={(a:any) => handleStaffAction('visitante', a)} />
                    </div>
                </div>
            </div>

            <div style={{height:'100px', background:'#000', borderTop:'2px solid #333', display:'flex', flexDirection:'column'}}>
                <div style={{padding:'2px 10px', background:'#222', color:'#888', fontSize:'0.7rem', fontWeight:'bold'}}>PLAY-BY-PLAY (CLICK "X" PARA CORREGIR)</div>
                <div style={{flex:1, overflowY:'auto', padding:'5px 10px', fontFamily:'monospace', fontSize:'0.8rem'}}>
                    {matchData.gameLog?.map((log) => (
                        <div key={log.id} style={{color: log.team==='local'?'#60a5fa': log.team==='visitante'?'#fbbf24':'#ccc', borderBottom:'1px solid #1a1a1a', padding:'1px 0', display:'flex', gap:'10px', alignItems:'center'}}>
                            <span style={{opacity:0.5, minWidth:'40px'}}>{log.time}</span>
                            <span style={{flex:1}}>{log.text}</span>
                            <button onClick={() => handleDeleteLog(log.id)} style={{background:'transparent', border:'1px solid #666', color:'#ef4444', cursor:'pointer', padding:'0 5px', fontSize:'0.7rem', borderRadius:'3px', marginLeft:'10px', fontWeight:'bold'}}>✖</button>
                        </div>
                    ))}
                </div>
            </div>
            
            <div style={{padding:'6px', background:'#111', borderTop:'1px solid #333', textAlign:'center', flexShrink:0, display:'flex', justifyContent:'center', gap:'10px'}}>
                <button onClick={onClose} className="btn btn-secondary" style={{fontSize:'0.8rem'}}>SALIR</button>
                <button onClick={handleResetGame} className="btn" style={{background:'#7f1d1d', color:'white', fontSize:'0.8rem'}}>REINICIAR</button>
                <button onClick={handleFinalize} className="btn" style={{background:'#10b981', color:'white', fontSize:'0.8rem'}}>FINALIZAR</button>
            </div>

            {benchModalOpen && (
                <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'center'}}>
                    <div style={{background:'#222', width:'90%', maxWidth:'500px', borderRadius:'10px', overflow:'hidden', border:'1px solid #444'}}>
                        <div style={{padding:'10px', background: benchModalOpen==='local'?'#1e3a8a':'#78350f', color:'white', fontWeight:'bold', textAlign:'center'}}>SELECCIONA ENTRANTE ({benchModalOpen.toUpperCase()})</div>
                        <div style={{padding:'10px', maxHeight:'60vh', overflowY:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                            {(benchModalOpen==='local' ? localBench : visitanteBench).map(p => <button key={p.id} onClick={() => { setSubMode({team: benchModalOpen!, playerIn: p}); setBenchModalOpen(null); }} style={{padding:'10px', background:'#333', border:'1px solid #555', color:'white', borderRadius:'6px', textAlign:'left'}}><div style={{fontWeight:'bold', fontSize:'0.9rem'}}>#{p.numero}</div><div style={{fontSize:'0.8rem'}}>{p.nombre}</div></button>)}
                        </div>
                        <div style={{padding:'8px', textAlign:'center', background:'#111', borderTop:'1px solid #333'}}><button onClick={()=>setBenchModalOpen(null)} className="btn btn-secondary">CANCELAR</button></div>
                    </div>
                </div>
            )}
            {subMode && <div style={{position:'fixed', bottom:'50px', left:'10px', right:'10px', background:'#dc2626', color:'white', padding:'10px', borderRadius:'8px', boxShadow:'0 5px 20px rgba(0,0,0,0.5)', zIndex:90, textAlign:'center', animation:'pulse 1.5s infinite'}}><div style={{fontSize:'0.9rem'}}>🔄 <strong>{subMode.playerIn.nombre}</strong> ENTRA.</div><div style={{fontSize:'0.8rem'}}>Haz click en quien SALE.</div><button onClick={()=>setSubMode(null)} style={{marginTop:'5px', background:'white', color:'red', border:'none', padding:'3px 10px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem'}}>CANCELAR</button></div>}
        </div>
    );
};
export default MesaTecnica;