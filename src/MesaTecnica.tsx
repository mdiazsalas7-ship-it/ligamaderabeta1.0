import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { db } from './firebase';
import { doc, updateDoc, onSnapshot, collection, query, getDocs, setDoc, increment } from 'firebase/firestore';

// --- INTERFACES ---
interface Player { id: string; nombre: string; numero: number; equipoId: string; }
interface GameEvent { id: string; text: string; time: string; team: 'local'|'visitante'|'system'; type: 'score'|'stat'|'foul'|'sub'|'period'|'timeout'; }
interface PlayerGameStats {
    puntos: number;
    faltasPersonales: number;
    faltasTecnicas: number;
    faltasAntideportivas: number;
    faltasTotales: number; 
    expulsado: boolean;
}

interface MatchData {
    id: string;
    equipoLocalId: string; equipoLocalNombre: string;
    equipoVisitanteId: string; equipoVisitanteNombre: string;
    marcadorLocal: number; marcadorVisitante: number;
    cuarto: number; estatus: string;
    forma5?: Record<string, Player[]>; 
    faltasLocal: number; faltasVisitante: number;
    timeoutsLocal: number; timeoutsVisitante: number;
    gameLog?: GameEvent[];
}

// --- 1. RELOJ AISLADO ---
const ClockDisplay = memo(({ 
    timeLeft, isRunning, periodo, onToggle, onNextQuarter, onAdjust 
}: { 
    timeLeft: number, isRunning: boolean, periodo: number,
    onToggle: () => void, onNextQuarter: () => void, onAdjust: (type: 'min'|'sec', v: number) => void 
}) => {
    
    const formatTime = (tenths: number) => {
        const totalSeconds = Math.floor(tenths / 10);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const dec = tenths % 10;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${dec}`;
    };

    const getPeriodoLabel = (p: number) => {
        if (p <= 4) return `CUARTO ${p}`;
        return `PRÓRROGA ${p - 4}`; 
    };

    return (
        <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
            <div style={{color:'#fbbf24', fontWeight:'bold', marginBottom:'5px', textShadow:'2px 2px 4px #000'}}>
                {getPeriodoLabel(periodo)}
            </div>
            
            <div style={{
                fontSize:'3rem', fontFamily:'monospace', fontWeight:'bold', 
                color: isRunning ? '#10b981' : '#ef4444', lineHeight:1,
                background:'rgba(17, 17, 17, 0.8)',
                padding:'5px 20px', borderRadius:'6px', border:'1px solid #333',
                marginBottom:'5px', backdropFilter: 'blur(2px)', minWidth:'220px', textAlign:'center'
            }}>
                {formatTime(timeLeft)}
            </div>

            <div style={{display:'flex', gap:'2px', marginBottom:'5px'}}>
                <button className="clock-btn" onClick={()=>onAdjust('min', 1)}>+1m</button>
                <button className="clock-btn" onClick={()=>onAdjust('min', -1)}>-1m</button>
                <button className="clock-btn" onClick={()=>onAdjust('sec', 1)}>+1s</button>
                <button className="clock-btn" onClick={()=>onAdjust('sec', -1)}>-1s</button>
            </div>

            <div style={{display:'flex', gap:'5px'}}>
                <button onClick={onToggle} className="btn" style={{
                    background: isRunning ? '#ef4444' : '#10b981', color:'white', width:'80px', fontWeight:'bold', padding:'4px', fontSize:'0.8rem'
                }}>
                    {isRunning ? 'PAUSAR' : 'INICIAR'}
                </button>
                <button onClick={onNextQuarter} className="btn" style={{background:'#f59e0b', color:'black', fontWeight:'bold', padding:'4px', fontSize:'0.8rem'}}>
                    SIG. PERIODO
                </button>
            </div>
        </div>
    );
});

// --- 2. FILA DE JUGADOR ---
const PlayerRow = memo(({ player, team, stats, isSubTarget, onStat, onSub }: any) => {
    const isExpulsado = stats?.expulsado;
    const faltas = stats?.faltasTotales || 0;
    const isClickable = !isExpulsado || isSubTarget;

    return (
        <div style={{
            marginBottom:'4px', padding:'4px 6px', borderRadius:'4px',
            background: isSubTarget ? '#ef4444' : '#202020',
            border: isSubTarget ? '2px dashed white' : '1px solid #333',
            display:'flex', flexDirection:'column', gap:'2px',
            opacity: isExpulsado && !isSubTarget ? 0.5 : 1,
            pointerEvents: isClickable ? 'auto' : 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }}
        onClick={() => isSubTarget && onSub(player)}
        >
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontWeight:'bold', color:'white', display:'flex', alignItems:'center', gap:'5px', fontSize:'0.85rem'}}>
                    <span style={{background:'#444', padding:'1px 5px', borderRadius:'3px', color:'#fff', fontSize:'0.75rem'}}>#{player.numero}</span>
                    <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'110px'}}>{player.nombre}</span>
                </div>
                <div style={{display:'flex', gap:'2px'}}>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} style={{
                            width:'6px', height:'6px', borderRadius:'50%', 
                            background: i < faltas ? (i>=4?'red':'yellow') : '#333',
                            border: '1px solid #555'
                        }}></div>
                    ))}
                    {isExpulsado && <span style={{fontSize:'0.6rem', color:'red', fontWeight:'bold', marginLeft:'2px'}}>EXP</span>}
                </div>
            </div>

            {!isSubTarget && !isExpulsado && (
                <div style={{display:'flex', gap:'2px', justifyContent:'space-between', marginTop:'2px'}}>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'puntos', 1)}} className="btn-stat">+1</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'puntos', 2)}} className="btn-stat">+2</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'puntos', 3)}} className="btn-stat">+3</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'rebotes', 1)}} className="btn-stat" style={{background:'#059669', fontSize:'0.7rem'}}>R</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'asistencias', 1)}} className="btn-stat" style={{background:'#7c3aed', fontSize:'0.7rem'}}>A</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_P', 0)}} className="btn-stat" style={{background:'#dc2626', color:'white'}}>P</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_T', 0)}} className="btn-stat" style={{background:'#be123c', color:'white'}}>T</button>
                    <button onClick={(e)=>{e.stopPropagation(); onStat(player, team, 'falta_U', 0)}} className="btn-stat" style={{background:'#7f1d1d', color:'white'}}>U</button>
                </div>
            )}
            {isExpulsado && !isSubTarget && <div style={{fontSize:'0.7rem', color:'#ef4444', textAlign:'center'}}>JUGADOR EXPULSADO</div>}
            {isSubTarget && <div style={{textAlign:'center', color:'white', fontWeight:'bold', fontSize:'0.8rem', padding:'2px'}}>CLICK PARA SACAR ⬆️</div>}
        </div>
    );
});


const MesaTecnica: React.FC<{ onClose: () => void, onMatchFinalized: () => void }> = ({ onClose, onMatchFinalized }) => {
    // ESTADOS
    const [matches, setMatches] = useState<any[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [matchData, setMatchData] = useState<MatchData | null>(null);
    
    const [localOnCourt, setLocalOnCourt] = useState<Player[]>([]);
    const [localBench, setLocalBench] = useState<Player[]>([]);
    const [visitanteOnCourt, setVisitanteOnCourt] = useState<Player[]>([]);
    const [visitanteBench, setVisitanteBench] = useState<Player[]>([]);
    
    const [statsCache, setStatsCache] = useState<Record<string, PlayerGameStats>>({});

    const [timeLeft, setTimeLeft] = useState(6000); 
    const [isRunning, setIsRunning] = useState(false);
    
    const timeLeftRef = useRef(6000);
    const timerRef = useRef<any>(null);

    const [subMode, setSubMode] = useState<{team: 'local'|'visitante', playerIn: Player} | null>(null);
    const [benchModalOpen, setBenchModalOpen] = useState<'local' | 'visitante' | null>(null);

    // Cargar Partidos
    useEffect(() => {
        const fetchMatches = async () => {
            const q = query(collection(db, 'calendario')); 
            const snap = await getDocs(q);
            const pendingMatches = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(m => m.estatus === 'programado' || m.estatus === 'vivo')
                .sort((a,b) => a.fechaAsignada.localeCompare(b.fechaAsignada));
            setMatches(pendingMatches);
        };
        if (!selectedMatchId) fetchMatches();
    }, [selectedMatchId]);

    // LÓGICA DEL RELOJ
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) { 
                        setIsRunning(false); 
                        timeLeftRef.current = 0;
                        return 0; 
                    }
                    const newVal = prev - 1;
                    timeLeftRef.current = newVal;
                    return newVal;
                });
            }, 100);
        } else { clearInterval(timerRef.current); }
        return () => clearInterval(timerRef.current);
    }, [isRunning]);

    const adjustTime = useCallback((type: 'min'|'sec', amount: number) => {
        setTimeLeft(prev => {
            let newVal = prev + (type === 'min' ? amount * 600 : amount * 10);
            newVal = Math.max(0, newVal);
            timeLeftRef.current = newVal;
            return newVal;
        });
    }, []);

    // ESCUCHAR FIREBASE
    useEffect(() => {
        if (!selectedMatchId) return;
        const unsub = onSnapshot(doc(db, 'calendario', selectedMatchId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as any;
                setMatchData({
                    id: docSnap.id,
                    equipoLocalId: data.equipoLocalId || Object.keys(data.forma5||{})[0],
                    equipoLocalNombre: data.equipoLocalNombre,
                    equipoVisitanteId: data.equipoVisitanteId || Object.keys(data.forma5||{})[1],
                    equipoVisitanteNombre: data.equipoVisitanteNombre,
                    marcadorLocal: data.marcadorLocal || 0,
                    marcadorVisitante: data.marcadorVisitante || 0,
                    cuarto: data.cuarto || 1,
                    estatus: data.estatus || 'programado',
                    forma5: data.forma5 || {},
                    faltasLocal: data.faltasLocal || 0,
                    faltasVisitante: data.faltasVisitante || 0,
                    timeoutsLocal: data.timeoutsLocal !== undefined ? data.timeoutsLocal : 2,
                    timeoutsVisitante: data.timeoutsVisitante !== undefined ? data.timeoutsVisitante : 2,
                    gameLog: data.gameLog || []
                });
            }
        });
        return () => unsub();
    }, [selectedMatchId]);

    // INICIALIZAR ROSTERS
    useEffect(() => {
        if (matchData && localOnCourt.length === 0 && localBench.length === 0) {
            const rosterL = matchData.forma5?.[matchData.equipoLocalId] || [];
            const rosterV = matchData.forma5?.[matchData.equipoVisitanteId] || [];
            setLocalOnCourt(rosterL.slice(0, 5));
            setLocalBench(rosterL.slice(5));
            setVisitanteOnCourt(rosterV.slice(0, 5));
            setVisitanteBench(rosterV.slice(5));
            
            const cache: Record<string, PlayerGameStats> = {};
            [...rosterL, ...rosterV].forEach(p => {
                cache[p.id] = { puntos: 0, faltasPersonales: 0, faltasTecnicas: 0, faltasAntideportivas: 0, faltasTotales: 0, expulsado: false };
            });
            setStatsCache(cache);
        }
    }, [matchData?.id]);

    const formatTimeForLog = (tenths: number) => {
        const totalSeconds = Math.floor(tenths / 10);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const addLog = async (text: string, type: GameEvent['type'], team: 'local'|'visitante'|'system') => {
        if (!matchData) return;
        const newEvent: GameEvent = {
            id: Date.now().toString(), text, time: formatTimeForLog(timeLeftRef.current), team, type
        };
        const newLog = [newEvent, ...(matchData.gameLog || [])].slice(0, 50);
        await updateDoc(doc(db, 'calendario', matchData.id), { gameLog: newLog });
    };

    // --- REGLA FIBA: PÉRDIDA DE TIEMPO MUERTO (ÚLTIMOS 2 MIN Q4) ---
    useEffect(() => {
        if (!matchData) return;
        
        // 1200 decimas = 2 minutos
        if (matchData.cuarto === 4 && timeLeft <= 1200) {
            const updates: any = {};
            let msg = '';

            // Si Local tiene 3, se le quita 1 -> Quedan 2
            if (matchData.timeoutsLocal === 3) {
                updates.timeoutsLocal = 2;
                msg += `Regla FIBA: ${matchData.equipoLocalNombre} pierde 1 TM (Max 2 ult. 2min). `;
            }

            // Si Visitante tiene 3, se le quita 1 -> Quedan 2
            if (matchData.timeoutsVisitante === 3) {
                updates.timeoutsVisitante = 2;
                msg += `Regla FIBA: ${matchData.equipoVisitanteNombre} pierde 1 TM (Max 2 ult. 2min).`;
            }

            if (Object.keys(updates).length > 0) {
                updateDoc(doc(db, 'calendario', matchData.id), updates);
                if (msg) addLog(msg, 'system', 'system');
            }
        }
    }, [timeLeft, matchData]);

    // REGLAS EXPULSION
    const checkExpulsion = (s: PlayerGameStats) => {
        if (s.faltasTotales >= 5) return true;
        if (s.faltasAntideportivas >= 2) return true;
        if (s.faltasTecnicas >= 2) return true;
        if (s.faltasTecnicas >= 1 && s.faltasAntideportivas >= 1) return true;
        return false;
    };

    // --- MANEJO DE ESTADÍSTICAS ---
    const handleStat = useCallback(async (player: Player, team: 'local'|'visitante', action: 'puntos'|'rebotes'|'asistencias'|'falta_P'|'falta_T'|'falta_U', val: number) => {
        if (!matchData) return;
        if (statsCache[player.id]?.expulsado) return; 

        const teamName = team === 'local' ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre;
        const currentStats = statsCache[player.id] || { puntos:0, faltasPersonales:0, faltasTecnicas:0, faltasAntideportivas:0, faltasTotales:0, expulsado:false };
        let newStats = { ...currentStats };
        let logText = '';
        let statField = ''; 

        // DETENER RELOJ (BOLA MUERTA)
        if (action.startsWith('falta')) {
            setIsRunning(false);
        }
        if (action === 'puntos') {
            // Detener reloj si quedan menos de 2 min en Q4 o Prórroga
            const isCrunchTime = matchData.cuarto >= 4 && timeLeftRef.current <= 1200; 
            if (isCrunchTime) {
                setIsRunning(false);
            }
        }

        if (action === 'puntos') {
            newStats.puntos += val;
            logText = `🏀 ${player.nombre} (+${val})`;
            statField = 'puntos';
            const field = team === 'local' ? 'marcadorLocal' : 'marcadorVisitante';
            await updateDoc(doc(db, 'calendario', matchData.id), { [field]: increment(val) });
        
        } else if (action.startsWith('falta')) {
            newStats.faltasTotales += 1;
            const field = team === 'local' ? 'faltasLocal' : 'faltasVisitante';
            await updateDoc(doc(db, 'calendario', matchData.id), { [field]: increment(1) });

            if (action === 'falta_P') {
                newStats.faltasPersonales += 1;
                logText = `🤜 P: ${player.nombre}`;
                statField = 'faltas';
            } else if (action === 'falta_T') {
                newStats.faltasTecnicas += 1;
                logText = `⚠️ T: ${player.nombre}`;
                statField = 'faltas'; 
            } else if (action === 'falta_U') {
                newStats.faltasAntideportivas += 1;
                logText = `🛑 U: ${player.nombre}`;
                statField = 'faltas';
            }

            if (checkExpulsion(newStats)) {
                newStats.expulsado = true;
                logText += " (EXPULSADO)";
                alert(`🟥 JUGADOR EXPULSADO: ${player.nombre}\n\nDebe ser sustituido.`);
            }

        } else {
            statField = action;
            if (action === 'rebotes') logText = `🖐️ Reb: ${player.nombre}`;
            if (action === 'asistencias') logText = `🅰️ Asist: ${player.nombre}`;
        }

        setStatsCache(prev => ({ ...prev, [player.id]: newStats }));
        await addLog(logText, action.startsWith('falta') ? 'foul' : action === 'puntos' ? 'score' : 'stat', team);

        const statRef = doc(db, 'stats_partido', `${matchData.id}_${player.id}`);
        const payload: any = { partidoId: matchData.id, jugadorId: player.id, nombre: player.nombre, equipo: teamName, fecha: new Date().toISOString() };
        
        if (action === 'puntos') {
            payload.puntos = increment(val);
            if (val === 3) payload.triples = increment(1);
        } else {
            payload[statField] = increment(1);
        }
        await setDoc(statRef, payload, { merge: true });
    }, [matchData, statsCache]);

    const handleTimeout = async (team: 'local'|'visitante') => {
        if (!matchData) return;
        const remaining = team === 'local' ? matchData.timeoutsLocal : matchData.timeoutsVisitante;
        
        if (remaining <= 0) {
            alert("⚠️ No le quedan tiempos muertos a este equipo.");
            return;
        }

        if (!window.confirm(`¿Cobrar Tiempo Muerto a ${team === 'local' ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre}?`)) return;
        
        setIsRunning(false);
        const field = team === 'local' ? 'timeoutsLocal' : 'timeoutsVisitante';
        await updateDoc(doc(db, 'calendario', matchData.id), { [field]: remaining - 1 });
        
        addLog(`⏱️ Tiempo Muerto: ${team === 'local' ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre}`, 'timeout', team);
    };

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
        const nextQ = matchData.cuarto + 1;
        const msg = nextQ > 4 ? `¿Iniciar Prórroga ${nextQ - 4}?` : `¿Iniciar Cuarto ${nextQ}?`;
        
        if (!window.confirm(msg)) return;
        
        setIsRunning(false);
        const newTime = 6000; 
        setTimeLeft(newTime);
        timeLeftRef.current = newTime;
        
        let updatePayload: any = { cuarto: increment(1) };
        
        // RESET DE TIEMPOS MUERTOS FIBA
        if (nextQ === 3) {
            updatePayload.timeoutsLocal = 3;
            updatePayload.timeoutsVisitante = 3;
        } else if (nextQ > 4) {
            updatePayload.timeoutsLocal = 1;
            updatePayload.timeoutsVisitante = 1;
        }

        await updateDoc(doc(db, 'calendario', matchData.id), updatePayload);
        addLog(`🕒 Inicio del Periodo ${nextQ}`, 'period', 'system');
    };

    useEffect(() => {
        if (matchData && matchData.cuarto === 1) {
            const updates: any = {};
            let needsUpdate = false;
            if (matchData.timeoutsLocal === undefined) { updates.timeoutsLocal = 2; needsUpdate = true; }
            if (matchData.timeoutsVisitante === undefined) { updates.timeoutsVisitante = 2; needsUpdate = true; }
            if (needsUpdate) updateDoc(doc(db, 'calendario', matchData.id), updates);
        }
    }, [matchData]);

    const handleFinalize = async () => {
        if (!matchData || !window.confirm("¿FINALIZAR PARTIDO?")) return;
        await updateDoc(doc(db, 'calendario', matchData.id), { 
            estatus: 'finalizado', marcadorLocal: matchData.marcadorLocal, marcadorVisitante: matchData.marcadorVisitante 
        });
        onMatchFinalized();
        onClose();
    };

    const handleResetGame = async () => {
        if (!matchData || !window.confirm("⚠️ ¿REINICIAR ESTE JUEGO A CERO? ⚠️\nSe borrará marcador, faltas y tiempo.")) return;
        setIsRunning(false);
        setTimeLeft(6000);
        timeLeftRef.current = 6000;
        await updateDoc(doc(db, 'calendario', matchData.id), {
            marcadorLocal: 0, marcadorVisitante: 0,
            faltasLocal: 0, faltasVisitante: 0,
            timeoutsLocal: 2, timeoutsVisitante: 2,
            cuarto: 1, gameLog: [],
            estatus: 'programado' 
        });
        alert("Juego reiniciado.");
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
            <style>{`
                .btn-stat { flex:1; padding:6px 0; font-size:0.75rem; font-weight:bold; border:none; border-radius:3px; cursor:pointer; background:#2563eb; color:white; transition: opacity 0.1s; }
                .btn-stat:active { transform:scale(0.95); opacity:0.8; }
                .clock-btn { background:#333; color:white; border:1px solid #555; padding:4px 8px; cursor:pointer; font-size:0.75rem; border-radius:3px; font-weight:bold; backdrop-filter: blur(4px); background: rgba(50,50,50,0.8); }
                .bonus-indicator { font-size: 0.8rem; background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-top: 5px; animation: pulse 2s infinite; display:inline-block; box-shadow: 0 0 10px #ef4444; }
                .timeout-btn { background: #d97706; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 5px; display: block; width: 100%; transition: background 0.2s; }
                .timeout-btn:disabled { background: #555; color: #999; cursor: not-allowed; }
            `}</style>

            {/* HEADER */}
            <div style={{
                backgroundImage: 'url(https://i.postimg.cc/3R98dqnk/basketball_court_black_line_marking_260nw_2125177724.webp)',
                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: '#000',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)', zIndex: 2,
                padding:'8px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'2px solid #333', flexShrink:0
            }}>
                {/* LOCAL */}
                <div style={{textAlign:'center', width:'25%', textShadow:'1px 1px 2px rgba(0,0,0,0.8)'}}>
                    <div style={{color:'#60a5fa', fontWeight:'bold', fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{matchData.equipoLocalNombre}</div>
                    <div style={{fontSize:'2.8rem', fontWeight:'bold', lineHeight:1}}>{matchData.marcadorLocal}</div>
                    <div style={{fontSize:'0.8rem', color:'#ccc'}}>FALTAS: {matchData.faltasLocal}</div>
                    {matchData.faltasLocal >= 5 && <div className="bonus-indicator">BONUS</div>}
                    <button className="timeout-btn" onClick={()=>handleTimeout('local')} disabled={(matchData.timeoutsLocal || 0) <= 0}>
                        🕒 T. MUERTO ({(matchData.timeoutsLocal || 0)})
                    </button>
                </div>

                {/* RELOJ */}
                <ClockDisplay 
                    timeLeft={timeLeft} 
                    isRunning={isRunning} 
                    periodo={matchData.cuarto}
                    onToggle={() => setIsRunning(!isRunning)} 
                    onNextQuarter={handleNextQuarter}
                    onAdjust={adjustTime}
                />

                {/* VISITANTE */}
                <div style={{textAlign:'center', width:'25%', textShadow:'1px 1px 2px rgba(0,0,0,0.8)'}}>
                    <div style={{color:'#fbbf24', fontWeight:'bold', fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{matchData.equipoVisitanteNombre}</div>
                    <div style={{fontSize:'2.8rem', fontWeight:'bold', lineHeight:1}}>{matchData.marcadorVisitante}</div>
                    <div style={{fontSize:'0.8rem', color:'#ccc'}}>FALTAS: {matchData.faltasVisitante}</div>
                    {matchData.faltasVisitante >= 5 && <div className="bonus-indicator">BONUS</div>}
                    <button className="timeout-btn" onClick={()=>handleTimeout('visitante')} disabled={(matchData.timeoutsVisitante || 0) <= 0}>
                        🕒 T. MUERTO ({(matchData.timeoutsVisitante || 0)})
                    </button>
                </div>
            </div>

            {/* ZONA DE JUGADORES */}
            <div style={{flex:1, display:'flex', overflow:'hidden'}}>
                {/* LOCAL */}
                <div style={{flex:1, borderRight:'1px solid #333', display:'flex', flexDirection:'column', background:'#1a1a1a'}}>
                    <div style={{padding:'8px', background:'#1e3a8a', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <span style={{color:'#93c5fd', fontWeight:'bold', fontSize:'0.8rem'}}>EN CANCHA</span>
                        <button onClick={() => setBenchModalOpen('local')} style={{background:'#2563eb', color:'white', border:'none', borderRadius:'3px', padding:'4px 8px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold'}}>🔄 CAMBIOS</button>
                    </div>
                    <div style={{flex:1, overflowY:'auto', padding:'5px'}}>
                        {localOnCourt.map(p => (
                            <PlayerRow key={p.id} player={p} team="local" stats={statsCache[p.id]} isSubTarget={subMode?.team==='local'} onStat={handleStat} onSub={confirmSubstitution} />
                        ))}
                    </div>
                </div>

                {/* VISITANTE */}
                <div style={{flex:1, display:'flex', flexDirection:'column', background:'#1a1a1a'}}>
                    <div style={{padding:'8px', background:'#78350f', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <span style={{color:'#fde047', fontWeight:'bold', fontSize:'0.8rem'}}>EN CANCHA</span>
                        <button onClick={() => setBenchModalOpen('visitante')} style={{background:'#d97706', color:'white', border:'none', borderRadius:'3px', padding:'4px 8px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold'}}>🔄 CAMBIOS</button>
                    </div>
                    <div style={{flex:1, overflowY:'auto', padding:'5px'}}>
                        {visitanteOnCourt.map(p => (
                            <PlayerRow key={p.id} player={p} team="visitante" stats={statsCache[p.id]} isSubTarget={subMode?.team==='visitante'} onStat={handleStat} onSub={confirmSubstitution} />
                        ))}
                    </div>
                </div>
            </div>

            {/* PLAY-BY-PLAY */}
            <div style={{height:'100px', background:'#000', borderTop:'2px solid #333', display:'flex', flexDirection:'column'}}>
                <div style={{padding:'2px 10px', background:'#222', color:'#888', fontSize:'0.7rem', fontWeight:'bold'}}>PLAY-BY-PLAY</div>
                <div style={{flex:1, overflowY:'auto', padding:'5px 10px', fontFamily:'monospace', fontSize:'0.8rem'}}>
                    {matchData.gameLog?.map((log) => (
                        <div key={log.id} style={{
                            color: log.team==='local'?'#60a5fa': log.team==='visitante'?'#fbbf24':'#ccc', 
                            borderBottom:'1px solid #1a1a1a', padding:'1px 0', display:'flex', gap:'10px'
                        }}>
                            <span style={{opacity:0.5, minWidth:'40px'}}>{log.time}</span>
                            <span>{log.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* FOOTER */}
            <div style={{padding:'6px', background:'#111', borderTop:'1px solid #333', textAlign:'center', flexShrink:0, display:'flex', justifyContent:'center', gap:'10px'}}>
                <button onClick={onClose} className="btn btn-secondary" style={{fontSize:'0.8rem', padding:'6px 12px'}}>SALIR</button>
                <button onClick={handleResetGame} className="btn" style={{background:'#7f1d1d', color:'white', fontSize:'0.8rem', padding:'6px 12px'}}>REINICIAR JUEGO</button>
                <button onClick={handleFinalize} className="btn" style={{background:'#10b981', color:'white', fontSize:'0.8rem', padding:'6px 12px'}}>FINALIZAR</button>
            </div>

            {/* MODAL DE CAMBIOS */}
            {benchModalOpen && (
                <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'center'}}>
                    <div style={{background:'#222', width:'90%', maxWidth:'500px', borderRadius:'10px', overflow:'hidden', border:'1px solid #444'}}>
                        <div style={{padding:'10px', background: benchModalOpen==='local'?'#1e3a8a':'#78350f', color:'white', fontWeight:'bold', textAlign:'center'}}>
                            SELECCIONA ENTRANTE ({benchModalOpen.toUpperCase()})
                        </div>
                        <div style={{padding:'10px', maxHeight:'60vh', overflowY:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                            {(benchModalOpen==='local' ? localBench : visitanteBench).map(p => {
                                const isExpulsado = statsCache[p.id]?.expulsado;
                                return (
                                    <button key={p.id} 
                                        onClick={() => {
                                            setSubMode({team: benchModalOpen, playerIn: p});
                                            setBenchModalOpen(null);
                                        }}
                                        disabled={isExpulsado}
                                        style={{
                                            padding:'10px', background:'#333', border:'1px solid #555', color:'white', borderRadius:'6px',
                                            cursor: isExpulsado ? 'not-allowed' : 'pointer', opacity: isExpulsado ? 0.5 : 1, textAlign:'left'
                                        }}
                                    >
                                        <div style={{fontWeight:'bold', fontSize:'0.9rem'}}>#{p.numero}</div>
                                        <div style={{fontSize:'0.8rem'}}>{p.nombre}</div>
                                        {isExpulsado && <div style={{color:'red', fontSize:'0.6rem'}}>EXPULSADO</div>}
                                    </button>
                                );
                            })}
                            {(benchModalOpen==='local' ? localBench : visitanteBench).length === 0 && <div style={{gridColumn:'span 2', textAlign:'center', color:'#888'}}>Banca vacía</div>}
                        </div>
                        <div style={{padding:'8px', textAlign:'center', background:'#111', borderTop:'1px solid #333'}}>
                            <button onClick={()=>setBenchModalOpen(null)} className="btn btn-secondary" style={{fontSize:'0.8rem', padding:'5px 10px'}}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BARRA DE SUSTITUCIÓN ACTIVA */}
            {subMode && (
                <div style={{
                    position:'fixed', bottom:'50px', left:'10px', right:'10px', 
                    background:'#dc2626', color:'white', padding:'10px', borderRadius:'8px', 
                    boxShadow:'0 5px 20px rgba(0,0,0,0.5)', zIndex:90, textAlign:'center',
                    animation:'pulse 1.5s infinite'
                }}>
                    <div style={{fontSize:'0.9rem'}}>🔄 <strong>{subMode.playerIn.nombre}</strong> ENTRA.</div>
                    <div style={{fontSize:'0.8rem'}}>Haz click en quien SALE.</div>
                    <button onClick={()=>setSubMode(null)} style={{marginTop:'5px', background:'white', color:'red', border:'none', padding:'3px 10px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem'}}>CANCELAR</button>
                </div>
            )}
        </div>
    );
};

export default MesaTecnica;