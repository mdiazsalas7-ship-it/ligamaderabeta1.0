import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, updateDoc, onSnapshot, collection, query, getDocs, setDoc, increment, getDoc } from 'firebase/firestore';

// --- INTERFACES ---
interface Player { id: string; nombre: string; numero: number; equipoId: string; }
interface GameEvent { id: string; text: string; time: string; team: 'local'|'visitante'|'system'; type: 'score'|'stat'|'foul'|'sub'; }
interface PlayerGameStats {
    puntos: number;
    faltasPersonales: number;
    faltasTecnicas: number;
    faltasAntideportivas: number;
    faltasTotales: number; // Suma de P + T + U
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
    gameLog?: GameEvent[];
}

const MesaTecnica: React.FC<{ onClose: () => void, onMatchFinalized: () => void }> = ({ onClose, onMatchFinalized }) => {
    // ESTADOS DE DATOS
    const [matches, setMatches] = useState<any[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [matchData, setMatchData] = useState<MatchData | null>(null);
    
    // ROSTERS Y JUEGO
    const [localOnCourt, setLocalOnCourt] = useState<Player[]>([]);
    const [localBench, setLocalBench] = useState<Player[]>([]);
    const [visitanteOnCourt, setVisitanteOnCourt] = useState<Player[]>([]);
    const [visitanteBench, setVisitanteBench] = useState<Player[]>([]);
    
    // ESTADÍSTICAS EN TIEMPO REAL (Para controlar expulsiones localmente)
    const [statsCache, setStatsCache] = useState<Record<string, PlayerGameStats>>({});

    // RELOJ
    const [timeLeft, setTimeLeft] = useState(6000); 
    const [isRunning, setIsRunning] = useState(false);
    const timerRef = useRef<any>(null);

    // INTERACCIÓN
    const [selectedPlayer, setSelectedPlayer] = useState<{player: Player, team: 'local'|'visitante'} | null>(null);
    const [subMode, setSubMode] = useState<{team: 'local'|'visitante', playerIn: Player} | null>(null);

    // 1. CARGAR LISTA DE JUEGOS
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

    // 2. RELOJ (DÉCIMAS)
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) { setIsRunning(false); return 0; }
                    return prev - 1;
                });
            }, 100);
        } else { clearInterval(timerRef.current); }
        return () => clearInterval(timerRef.current);
    }, [isRunning]);

    const formatTime = (tenths: number) => {
        if (tenths === 0) return "00:00";
        const totalSeconds = Math.floor(tenths / 10);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const dec = tenths % 10;
        if (mins === 0) return `${secs}.${dec}`;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 3. ESCUCHAR PARTIDO Y STATS INICIALES
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
                    gameLog: data.gameLog || []
                });
            }
        });
        return () => unsub();
    }, [selectedMatchId]);

    // 4. INICIALIZAR ROSTERS
    useEffect(() => {
        if (matchData && localOnCourt.length === 0 && localBench.length === 0) {
            const rosterL = matchData.forma5?.[matchData.equipoLocalId] || [];
            const rosterV = matchData.forma5?.[matchData.equipoVisitanteId] || [];
            setLocalOnCourt(rosterL.slice(0, 5));
            setLocalBench(rosterL.slice(5));
            setVisitanteOnCourt(rosterV.slice(0, 5));
            setVisitanteBench(rosterV.slice(5));
            
            // Inicializar caché de stats en 0
            const cache: Record<string, PlayerGameStats> = {};
            [...rosterL, ...rosterV].forEach(p => {
                cache[p.id] = { puntos: 0, faltasPersonales: 0, faltasTecnicas: 0, faltasAntideportivas: 0, faltasTotales: 0, expulsado: false };
            });
            setStatsCache(cache);
        }
    }, [matchData?.id]);

    // --- LÓGICA DE JUEGO ---

    const addLog = async (text: string, type: GameEvent['type'], team: 'local'|'visitante'|'system') => {
        if (!matchData) return;
        const newEvent: GameEvent = {
            id: Date.now().toString(), text, time: formatTime(timeLeft), team, type
        };
        const newLog = [newEvent, ...(matchData.gameLog || [])].slice(0, 60);
        await updateDoc(doc(db, 'calendario', matchData.id), { gameLog: newLog });
    };

    const checkExpulsion = (stats: PlayerGameStats) => {
        // REGLAS DE EXPULSIÓN FIBA:
        // 1. 5 Faltas Totales (Personales + Técnicas + Antideportivas)
        // 2. 2 Faltas Técnicas
        // 3. 2 Faltas Antideportivas
        // 4. 1 Técnica + 1 Antideportiva
        if (
            stats.faltasTotales >= 5 || 
            stats.faltasTecnicas >= 2 || 
            stats.faltasAntideportivas >= 2 || 
            (stats.faltasTecnicas >= 1 && stats.faltasAntideportivas >= 1)
        ) {
            return true;
        }
        return false;
    };

    const handleStat = async (action: 'puntos'|'rebotes'|'asistencias'|'robos'|'bloqueos'|'falta_P'|'falta_T'|'falta_U', val: number) => {
        if (!matchData || !selectedPlayer) return;
        const { player, team } = selectedPlayer;
        
        // Verificar si ya estaba expulsado (por seguridad)
        if (statsCache[player.id]?.expulsado) {
            alert("⛔ Este jugador está expulsado.");
            return;
        }

        const teamName = team === 'local' ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre;
        
        // 1. Actualizar Caché Local y Verificar Expulsión
        const currentStats = statsCache[player.id] || { puntos:0, faltasPersonales:0, faltasTecnicas:0, faltasAntideportivas:0, faltasTotales:0, expulsado:false };
        let newStats = { ...currentStats };
        let logText = '';
        let updateGlobalScore = false;
        let updateGlobalFoul = false;
        let statField = ''; // Campo para stats_partido

        // CLASIFICAR ACCIÓN
        if (action === 'puntos') {
            newStats.puntos += val;
            updateGlobalScore = true;
            logText = `🏀 ${player.nombre} (+${val})`;
            statField = 'puntos';
        } 
        else if (action.startsWith('falta')) {
            updateGlobalFoul = true;
            newStats.faltasTotales += 1;
            
            if (action === 'falta_P') {
                newStats.faltasPersonales += 1;
                logText = `🤜 Falta Personal: ${player.nombre}`;
                statField = 'faltas';
            } else if (action === 'falta_T') {
                newStats.faltasTecnicas += 1;
                logText = `⚠️ Falta TÉCNICA: ${player.nombre}`;
                statField = 'faltas'; // Se puede separar si la BD lo soporta, por ahora cuenta como falta general
            } else if (action === 'falta_U') {
                newStats.faltasAntideportivas += 1;
                logText = `🛑 Falta ANTIDEPORTIVA: ${player.nombre}`;
                statField = 'faltas';
            }

            // Chequear Expulsión
            if (checkExpulsion(newStats)) {
                newStats.expulsado = true;
                logText += " (EXPULSADO 🟥)";
                alert(`🟥 JUGADOR EXPULSADO: ${player.nombre}\n\nMotivo: Acumulación de faltas.`);
            }
        } 
        else {
            // Otras stats
            statField = action;
            if (action === 'rebotes') logText = `🖐️ Rebote: ${player.nombre}`;
            if (action === 'asistencias') logText = `🅰️ Asistencia: ${player.nombre}`;
            if (action === 'robos') logText = `⚡ Robo: ${player.nombre}`;
            if (action === 'bloqueos') logText = `🚫 Bloqueo: ${player.nombre}`;
        }

        // Actualizar estado local
        setStatsCache(prev => ({ ...prev, [player.id]: newStats }));

        // 2. Actualizar Firebase (Calendario / Marcador Global)
        if (updateGlobalScore) {
            const field = team === 'local' ? 'marcadorLocal' : 'marcadorVisitante';
            await updateDoc(doc(db, 'calendario', matchData.id), { [field]: increment(val) });
        }
        if (updateGlobalFoul) {
            const field = team === 'local' ? 'faltasLocal' : 'faltasVisitante';
            await updateDoc(doc(db, 'calendario', matchData.id), { [field]: increment(1) });
        }
        await addLog(logText, action.startsWith('falta') ? 'foul' : 'stat', team);

        // 3. Actualizar Firebase (Estadística Individual)
        const statRef = doc(db, 'stats_partido', `${matchData.id}_${player.id}`);
        const payload: any = {
            partidoId: matchData.id,
            jugadorId: player.id,
            nombre: player.nombre,
            equipo: teamName,
            fecha: new Date().toISOString()
        };

        if (action === 'puntos') {
            payload.puntos = increment(val);
            if (val === 3) payload.triples = increment(1);
        } else {
            payload[statField] = increment(1);
        }
        await setDoc(statRef, payload, { merge: true });

        // Si fue expulsado, deseleccionar
        if (newStats.expulsado) setSelectedPlayer(null);
    };

    const handleFinalize = async () => {
        if (!matchData || !window.confirm("¿FINALIZAR PARTIDO?\n\nEl resultado y estadísticas serán definitivos.")) return;
        
        try {
            // 1. Cerrar Partido (ESTO ACTUALIZA EL CALENDARIO VISUALMENTE)
            await updateDoc(doc(db, 'calendario', matchData.id), { estatus: 'finalizado' });

            // 2. Calcular Ganador
            const localWon = matchData.marcadorLocal > matchData.marcadorVisitante;
            const winnerId = localWon ? matchData.equipoLocalId : matchData.equipoVisitanteId;
            const loserId = localWon ? matchData.equipoVisitanteId : matchData.equipoLocalId;

            // 3. Actualizar Tabla de Posiciones
            const winRef = doc(db, 'equipos', winnerId);
            const winSnap = await getDoc(winRef);
            if (winSnap.exists()) {
                const d = winSnap.data();
                await updateDoc(winRef, { 
                    victorias: (d.victorias || 0) + 1, 
                    puntos: (d.puntos || 0) + 2, 
                    puntos_favor: (d.puntos_favor || 0) + (localWon ? matchData.marcadorLocal : matchData.marcadorVisitante),
                    puntos_contra: (d.puntos_contra || 0) + (localWon ? matchData.marcadorVisitante : matchData.marcadorLocal)
                });
            }

            const loseRef = doc(db, 'equipos', loserId);
            const loseSnap = await getDoc(loseRef);
            if (loseSnap.exists()) {
                const d = loseSnap.data();
                await updateDoc(loseRef, { 
                    derrotas: (d.derrotas || 0) + 1, 
                    puntos: (d.puntos || 0) + 1, 
                    puntos_favor: (d.puntos_favor || 0) + (!localWon ? matchData.marcadorLocal : matchData.marcadorVisitante),
                    puntos_contra: (d.puntos_contra || 0) + (!localWon ? matchData.marcadorVisitante : matchData.marcadorLocal)
                });
            }

            alert("✅ Partido finalizado correctamente.");
            onMatchFinalized();
            onClose();

        } catch (e) { console.error(e); alert("Error finalizando."); }
    };

    // SUSTITUCIÓN
    const confirmSubstitution = (playerOut: Player) => {
        if (!subMode) return;
        // Impedir que entre alguien expulsado (aunque debería estar en la banca)
        if (statsCache[subMode.playerIn.id]?.expulsado) {
            alert("⛔ No puedes meter a un jugador expulsado.");
            setSubMode(null);
            return;
        }

        if (subMode.team === 'local') {
            setLocalOnCourt(prev => [...prev.filter(p => p.id !== playerOut.id), subMode.playerIn]);
            setLocalBench(prev => [...prev.filter(p => p.id !== subMode.playerIn.id), playerOut]);
        } else {
            setVisitanteOnCourt(prev => [...prev.filter(p => p.id !== playerOut.id), subMode.playerIn]);
            setVisitanteBench(prev => [...prev.filter(p => p.id !== subMode.playerIn.id), playerOut]);
        }
        addLog(`🔄 Cambio: Sale ${playerOut.nombre}, Entra ${subMode.playerIn.nombre}`, 'sub', subMode.team);
        setSubMode(null);
        setSelectedPlayer(null);
    };

    // --- VISTAS ---
    if (!selectedMatchId) return (
        <div className="animate-fade-in" style={{padding:'40px', maxWidth:'800px', margin:'0 auto'}}>
            <h2 style={{color:'var(--primary)'}}>📡 Mesa Técnica FIBA Pro</h2>
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

    const currentPlayerStats = selectedPlayer ? statsCache[selectedPlayer.player.id] : null;

    return (
        <div style={{background:'#121212', minHeight:'100vh', color:'white', display:'flex', flexDirection:'column'}}>
            
            {/* HEADER (SCOREBOARD) */}
            <header style={{background:'#1e1e1e', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #333'}}>
                <div style={{textAlign:'center', minWidth:'150px'}}>
                    <div style={{color:'#60a5fa', fontWeight:'bold'}}>{matchData.equipoLocalNombre}</div>
                    <div style={{fontSize:'3rem', fontWeight:'bold', lineHeight:1}}>{matchData.marcadorLocal}</div>
                    <div style={{color:'gray', fontSize:'0.8rem'}}>Faltas: {matchData.faltasLocal}</div>
                </div>
                <div style={{textAlign:'center', background:'#000', padding:'5px 20px', borderRadius:'8px', border:'2px solid #333'}}>
                    <div style={{fontSize:'3.5rem', fontFamily:'monospace', fontWeight:'bold', color: isRunning ? '#10b981' : '#ef4444', lineHeight:1}}>
                        {formatTime(timeLeft)}
                    </div>
                    <div style={{display:'flex', gap:'5px', justifyContent:'center', marginTop:'5px'}}>
                        <button onClick={() => setIsRunning(!isRunning)} className={`btn ${isRunning?'btn-danger':'btn-primary'}`} style={{fontSize:'0.7rem', padding:'4px 10px'}}>
                            {isRunning ? 'PAUSA' : 'INICIO'}
                        </button>
                    </div>
                    <div style={{marginTop:'5px', color:'yellow', fontWeight:'bold', fontSize:'0.9rem'}}>Q{matchData.cuarto}</div>
                </div>
                <div style={{textAlign:'center', minWidth:'150px'}}>
                    <div style={{color:'#fbbf24', fontWeight:'bold'}}>{matchData.equipoVisitanteNombre}</div>
                    <div style={{fontSize:'3rem', fontWeight:'bold', lineHeight:1}}>{matchData.marcadorVisitante}</div>
                    <div style={{color:'gray', fontSize:'0.8rem'}}>Faltas: {matchData.faltasVisitante}</div>
                </div>
            </header>

            {/* ÁREA DE JUEGO */}
            <div style={{flex:1, display:'flex', overflow:'hidden'}}>
                
                {/* --- IZQUIERDA: LOCAL --- */}
                <div style={{flex:1, borderRight:'1px solid #333', display:'flex', flexDirection:'column', background:'#1a1a1a'}}>
                    <div style={{padding:'10px', background:'#262626', color:'#60a5fa', fontWeight:'bold', textAlign:'center'}}>EN CANCHA</div>
                    <div style={{padding:'10px', overflowY:'auto', flex:1}}>
                        {localOnCourt.map(p => {
                            const isExpulsado = statsCache[p.id]?.expulsado;
                            const faltas = statsCache[p.id]?.faltasTotales || 0;
                            return (
                                <div key={p.id} onClick={() => { if(isExpulsado) return; subMode?.team==='local' ? confirmSubstitution(p) : setSelectedPlayer({player: p, team: 'local'}) }}
                                    style={{
                                        padding:'12px', marginBottom:'8px', borderRadius:'6px', cursor: isExpulsado ? 'not-allowed' : 'pointer',
                                        background: isExpulsado ? '#450a0a' : selectedPlayer?.player.id === p.id ? '#3b82f6' : subMode?.team==='local' ? '#dc2626' : '#333',
                                        color: isExpulsado ? '#999' : 'white', display:'flex', justifyContent:'space-between', alignItems:'center',
                                        border: selectedPlayer?.player.id === p.id ? '2px solid white' : 'none', opacity: isExpulsado ? 0.6 : 1
                                    }}>
                                    <span style={{fontWeight:'bold'}}>#{p.numero} {p.nombre}</span>
                                    <div style={{display:'flex', gap:'5px'}}>
                                        {[...Array(faltas)].map((_,i) => <div key={i} style={{width:'8px', height:'8px', borderRadius:'50%', background: i>=4?'red':'yellow'}}></div>)}
                                        {isExpulsado && <span style={{fontSize:'0.8rem', color:'red', fontWeight:'bold'}}>EXP</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* BANCA */}
                    <div style={{padding:'10px', background:'#121212', borderTop:'1px solid #333', display:'flex', flexWrap:'wrap', gap:'5px'}}>
                        {localBench.map(p => {
                             const isExpulsado = statsCache[p.id]?.expulsado;
                             return (
                                <button key={p.id} onClick={()=>setSubMode({team:'local', playerIn:p})} disabled={!!subMode || isExpulsado} 
                                    style={{background: isExpulsado?'#333':'#333', color: isExpulsado?'#555':'#ccc', border:'none', padding:'5px 10px', borderRadius:'4px', cursor: isExpulsado?'not-allowed':'pointer', fontSize:'0.8rem', textDecoration: isExpulsado?'line-through':'none'}}>
                                    #{p.numero} {p.nombre}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* --- CENTRO: PANEL DE CONTROL --- */}
                <div style={{width:'320px', background:'#222', display:'flex', flexDirection:'column', borderRight:'1px solid #333'}}>
                    <div style={{padding:'15px', background:'#000', textAlign:'center', borderBottom:'1px solid #444'}}>
                        <div style={{fontSize:'0.8rem', color:'#888'}}>ACCIONES PARA:</div>
                        <div style={{fontSize:'1.2rem', fontWeight:'bold', color:'white', minHeight:'1.5rem'}}>
                            {selectedPlayer ? selectedPlayer.player.nombre : 'Selecciona un Jugador'}
                        </div>
                        {selectedPlayer && currentPlayerStats && (
                             <div style={{fontSize:'0.8rem', color: currentPlayerStats.faltasTotales>=4 ? 'red' : '#aaa', marginTop:'5px'}}>
                                Faltas: {currentPlayerStats.faltasPersonales}P / {currentPlayerStats.faltasTecnicas}T / {currentPlayerStats.faltasAntideportivas}U
                             </div>
                        )}
                    </div>

                    <div style={{padding:'15px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', flex:1, alignContent:'start'}}>
                        {/* PUNTOS */}
                        <button onClick={()=>handleStat('puntos', 1)} disabled={!selectedPlayer} className="btn" style={{background:'#fff', color:'#000', fontWeight:'bold'}}>+1</button>
                        <button onClick={()=>handleStat('puntos', 2)} disabled={!selectedPlayer} className="btn" style={{background:'#3b82f6', color:'white', fontWeight:'bold'}}>+2</button>
                        <button onClick={()=>handleStat('puntos', 3)} disabled={!selectedPlayer} className="btn" style={{background:'#eab308', color:'black', fontWeight:'bold'}}>+3</button>
                        
                        <hr style={{gridColumn:'span 3', borderColor:'#444', width:'100%', margin:'5px 0'}}/>
                        
                        {/* ESTADÍSTICAS */}
                        <button onClick={()=>handleStat('rebotes', 1)} disabled={!selectedPlayer} className="btn" style={{background:'#10b981', color:'white', fontSize:'0.8rem'}}>REB</button>
                        <button onClick={()=>handleStat('asistencias', 1)} disabled={!selectedPlayer} className="btn" style={{background:'#8b5cf6', color:'white', fontSize:'0.8rem'}}>ASIST</button>
                        <button onClick={()=>handleStat('robos', 1)} disabled={!selectedPlayer} className="btn" style={{background:'#f97316', color:'white', fontSize:'0.8rem'}}>ROBO</button>
                        <button onClick={()=>handleStat('bloqueos', 1)} disabled={!selectedPlayer} className="btn" style={{background:'#64748b', color:'white', fontSize:'0.8rem', gridColumn:'span 3'}}>BLOQUEO / TAPÓN</button>
                        
                        <hr style={{gridColumn:'span 3', borderColor:'#444', width:'100%', margin:'5px 0'}}/>
                        
                        {/* FALTAS */}
                        <button onClick={()=>handleStat('falta_P', 0)} disabled={!selectedPlayer} className="btn" style={{background:'#dc2626', color:'white', fontWeight:'bold'}}>P</button>
                        <button onClick={()=>handleStat('falta_T', 0)} disabled={!selectedPlayer} className="btn" style={{background:'#be123c', color:'white', fontWeight:'bold'}}>T</button>
                        <button onClick={()=>handleStat('falta_U', 0)} disabled={!selectedPlayer} className="btn" style={{background:'#7f1d1d', color:'white', fontWeight:'bold'}}>U</button>
                        <div style={{gridColumn:'span 3', textAlign:'center', fontSize:'0.7rem', color:'#666'}}>P: Personal | T: Técnica | U: Antideportiva</div>
                    </div>

                    {/* LOG */}
                    <div style={{height:'180px', background:'#000', overflowY:'auto', padding:'10px', fontSize:'0.75rem'}}>
                        {matchData.gameLog?.map((log) => (
                            <div key={log.id} style={{color: log.team==='local'?'#60a5fa': log.team==='visitante'?'#fbbf24':'#ccc', marginBottom:'2px', borderBottom:'1px solid #222', paddingBottom:'2px'}}>
                                <span style={{opacity:0.6}}>[{log.time}]</span> {log.text}
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- DERECHA: VISITANTE --- */}
                <div style={{flex:1, display:'flex', flexDirection:'column', background:'#1a1a1a'}}>
                    <div style={{padding:'10px', background:'#262626', color:'#fbbf24', fontWeight:'bold', textAlign:'center'}}>EN CANCHA</div>
                    <div style={{padding:'10px', overflowY:'auto', flex:1}}>
                        {visitanteOnCourt.map(p => {
                            const isExpulsado = statsCache[p.id]?.expulsado;
                            const faltas = statsCache[p.id]?.faltasTotales || 0;
                            return (
                                <div key={p.id} onClick={() => { if(isExpulsado) return; subMode?.team==='visitante' ? confirmSubstitution(p) : setSelectedPlayer({player: p, team: 'visitante'}) }}
                                    style={{
                                        padding:'12px', marginBottom:'8px', borderRadius:'6px', cursor: isExpulsado ? 'not-allowed' : 'pointer',
                                        background: isExpulsado ? '#450a0a' : selectedPlayer?.player.id === p.id ? '#eab308' : subMode?.team==='visitante' ? '#dc2626' : '#333',
                                        color: isExpulsado ? '#999' : selectedPlayer?.player.id === p.id ? 'black' : 'white', display:'flex', justifyContent:'space-between', alignItems:'center',
                                        border: selectedPlayer?.player.id === p.id ? '2px solid white' : 'none', opacity: isExpulsado ? 0.6 : 1
                                    }}>
                                    <span style={{fontWeight:'bold'}}>#{p.numero} {p.nombre}</span>
                                    <div style={{display:'flex', gap:'5px'}}>
                                        {[...Array(faltas)].map((_,i) => <div key={i} style={{width:'8px', height:'8px', borderRadius:'50%', background: i>=4?'red':'yellow'}}></div>)}
                                        {isExpulsado && <span style={{fontSize:'0.8rem', color:'red', fontWeight:'bold'}}>EXP</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* BANCA */}
                    <div style={{padding:'10px', background:'#121212', borderTop:'1px solid #333', display:'flex', flexWrap:'wrap', gap:'5px'}}>
                        {visitanteBench.map(p => {
                             const isExpulsado = statsCache[p.id]?.expulsado;
                             return (
                                <button key={p.id} onClick={()=>setSubMode({team:'visitante', playerIn:p})} disabled={!!subMode || isExpulsado} 
                                    style={{background: isExpulsado?'#333':'#333', color: isExpulsado?'#555':'#ccc', border:'none', padding:'5px 10px', borderRadius:'4px', cursor: isExpulsado?'not-allowed':'pointer', fontSize:'0.8rem', textDecoration: isExpulsado?'line-through':'none'}}>
                                    #{p.numero} {p.nombre}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MENSAJE DE SUSTITUCIÓN */}
            {subMode && (
                <div style={{background:'#dc2626', color:'white', textAlign:'center', padding:'10px', fontWeight:'bold'}}>
                    🔄 CAMBIO: Haz click en el jugador en cancha que SALE por {subMode.playerIn.nombre}
                    <button onClick={()=>setSubMode(null)} style={{marginLeft:'20px', color:'black', cursor:'pointer'}}>Cancelar</button>
                </div>
            )}

            {/* FOOTER */}
            <div style={{padding:'10px', background:'#111', borderTop:'1px solid #333', textAlign:'center'}}>
                <button onClick={onClose} className="btn btn-secondary" style={{marginRight:'20px'}}>SALIR</button>
                <button onClick={handleFinalize} className="btn" style={{background:'#10b981', color:'white'}}>FINALIZAR PARTIDO Y ACTUALIZAR TABLA</button>
            </div>
        </div>
    );
};
export default MesaTecnica;