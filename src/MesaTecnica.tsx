import React, { useState, useEffect, useRef } from 'react'; 
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc, deleteDoc, query, orderBy, where, getDoc, writeBatch, increment } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore';

const COURT_BG_URL = "https://i.postimg.cc/3R98dqnk/basketball-court-black-line-marking-260nw-2125177724.webp"; 
const BUZZER_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/buzzer_and_audience.ogg"; 

interface Match extends DocumentData { id: string; jornada: number; equipoLocalNombre: string; equipoVisitanteNombre: string; equipoLocalId: string; equipoVisitanteId: string; partidoRegistradoId: string | null; marcadorLocal: number; marcadorVisitante: number; forma5?: { [equipoId: string]: JugadorForma5[] }; }
interface JugadorForma5 { id: string; nombre: string; numero: number; equipoId: string; }
interface StatEvent extends DocumentData { id: string; calendarioId: string; equipoId: string; jugadorId: string; jugadorNombre: string; jugadorNumero: number; puntos: number; tipo: 'PUNTO' | 'REBOTE' | 'ASISTENCIA' | 'ROBO' | 'FALTA_P' | 'FALTA_T' | 'FALTA_U' | 'CAMBIO'; timestamp: Date | string; cuarto: number; tiempoJuego: string; detalles?: string; }
interface FoulBreakdown { total: number; tech: number; unsport: number; }
interface MesaTecnicaProps { onClose: () => void; onMatchFinalized?: () => void; }

const QUARTER_TIME_MS = 10 * 60 * 1000;
const OT_TIME_MS = 5 * 60 * 1000;
const INTERVAL_MS = 100; 

const formatTime = (totalMilliseconds: number): string => {
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const decimas = Math.floor((totalMilliseconds % 1000) / 100); 
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${decimas}`;
};

const checkDisqualification = (stats: FoulBreakdown | undefined): { isExpelled: boolean, reason: string } => {
    if (!stats) return { isExpelled: false, reason: '' };
    if (stats.total >= 5) return { isExpelled: true, reason: '5 FALTAS' };
    if (stats.tech >= 2) return { isExpelled: true, reason: '2 TÉCNICAS' };
    if (stats.unsport >= 2) return { isExpelled: true, reason: '2 ANTIDEP.' };
    if (stats.tech >= 1 && stats.unsport >= 1) return { isExpelled: true, reason: '1T + 1U' };
    return { isExpelled: false, reason: '' };
};

const calculateMVP = async (calendarioId: string) => {
    const statsQuery = query(collection(db, 'stats_partido'), where('calendarioId', '==', calendarioId));
    const statsSnapshot = await getDocs(statsQuery);
    const playerStatsMap = new Map();

    statsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tipo.startsWith('FALTA') || data.tipo === 'CAMBIO') return; 
        if (!playerStatsMap.has(data.jugadorId)) playerStatsMap.set(data.jugadorId, { jugadorId: data.jugadorId, jugadorNombre: data.jugadorNombre, jugadorNumero: data.jugadorNumero, equipoId: data.equipoId, puntos: 0, rebotes: 0, asistencias: 0, robos: 0, valoracion: 0 });
        const stats = playerStatsMap.get(data.jugadorId);
        if (data.tipo === 'PUNTO') stats.puntos += Number(data.puntos);
        if (data.tipo === 'REBOTE') stats.rebotes += 1;
        if (data.tipo === 'ASISTENCIA') stats.asistencias += 1;
        if (data.tipo === 'ROBO') stats.robos += 1;
    });

    let mvpId: string | null = null; 
    let maxValoracion = -Infinity;
    const finalStatsArray = Array.from(playerStatsMap.values()).map(stats => {
        stats.valoracion = stats.puntos + stats.rebotes + stats.asistencias + stats.robos;
        if (stats.valoracion > maxValoracion) { maxValoracion = stats.valoracion; mvpId = stats.jugadorId; }
        return stats;
    });
    return { stats: finalStatsArray, mvpId, mvpData: finalStatsArray.find(s => s.jugadorId === mvpId) };
};

const updateStandingsAutomatically = async (equipoId: string, puntosFavor: number, puntosContra: number, isWinner: boolean) => {
    const equipoRef = doc(db, 'equipos', equipoId);
    const puntosClasificacion = isWinner ? 2 : 1; 
    await updateDoc(equipoRef, { jugados: increment(1), victorias: increment(isWinner ? 1 : 0), derrotas: increment(isWinner ? 0 : 1), puntos_favor: increment(puntosFavor), puntos_contra: increment(puntosContra), puntos: increment(puntosClasificacion) });
};

const ScoreBoard = React.memo(({ selectedMatch, marcadorLocal, marcadorVisitante, localTeamFouls, visitanteTeamFouls, currentQuarter, time, isRunning, setIsRunning, adjustTime, handleQuarterChange }: any) => {
    const localBonus = localTeamFouls >= 5; const visitanteBonus = visitanteTeamFouls >= 5;
    return (
        <div style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url("${COURT_BG_URL}")`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff', padding: '15px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '2px solid #333', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                <div style={{ textAlign: 'center', flex: 1 }}><h2 style={{ margin: 0, color: '#fbbf24', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedMatch?.equipoLocalNombre}</h2><div style={{ fontFamily: "'Courier New', monospace", fontSize: '3.5rem', fontWeight: 'bold', color: '#ef4444', lineHeight: 1, textShadow: '0 0 20px rgba(239, 68, 68, 0.5)' }}>{marcadorLocal}</div><div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '5px' }}>FALTAS: <span style={{ color: localBonus ? '#ef4444' : '#4ade80', fontWeight: 'bold', fontSize: '1.1rem' }}>{localTeamFouls}</span></div>{localBonus && <div className="badge badge-danger" style={{marginTop: '5px'}}>BONUS</div>}</div>
                <div style={{ textAlign: 'center', flex: 1.2, padding: '0 10px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}><div style={{ fontSize: '1rem', color: '#4ade80', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '2px' }}>CUARTO {currentQuarter > 4 ? `OT ${currentQuarter - 4}` : currentQuarter}</div><div style={{ fontFamily: "'Courier New', monospace", fontSize: '4rem', color: time === 0 ? '#ef4444' : '#fff', fontWeight: 'bold', letterSpacing: '2px', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>{formatTime(time)}</div><div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '10px' }}><button onClick={() => adjustTime(1)} className="btn-time-compact">+1s</button><button onClick={() => adjustTime(-1)} className="btn-time-compact">-1s</button><button onClick={() => adjustTime(60)} className="btn-time-compact">+1m</button><button onClick={() => adjustTime(-60)} className="btn-time-compact">-1m</button></div><div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}><button onClick={() => setIsRunning(!isRunning)} className={`btn ${isRunning ? 'btn-danger' : 'btn-success'}`} style={{padding: '8px 20px', minWidth: '100px'}}>{isRunning ? 'PAUSAR' : 'INICIAR'}</button><button onClick={handleQuarterChange} className="btn btn-secondary" style={{padding: '8px 15px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)'}} disabled={isRunning}>SIG. CUARTO</button></div></div>
                <div style={{ textAlign: 'center', flex: 1 }}><h2 style={{ margin: 0, color: '#fbbf24', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedMatch?.equipoVisitanteNombre}</h2><div style={{ fontFamily: "'Courier New', monospace", fontSize: '3.5rem', fontWeight: 'bold', color: '#ef4444', lineHeight: 1, textShadow: '0 0 20px rgba(239, 68, 68, 0.5)' }}>{marcadorVisitante}</div><div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '5px' }}>FALTAS: <span style={{ color: visitanteBonus ? '#ef4444' : '#4ade80', fontWeight: 'bold', fontSize: '1.1rem' }}>{visitanteTeamFouls}</span></div>{visitanteBonus && <div className="badge badge-danger" style={{marginTop: '5px'}}>BONUS</div>}</div>
            </div>
        </div>
    );
});

const PlayerCard = React.memo(({ player, isLocal, foulStats, points, recordEvent }: any) => {
    const { isExpelled, reason } = checkDisqualification(foulStats);
    const fouls = foulStats ? foulStats.total : 0;
    return (
        <div style={{ background: isExpelled ? '#fef2f2' : 'white', opacity: isExpelled ? 0.6 : 1, borderLeft: `4px solid ${isExpelled ? '#6b7280' : (isLocal ? 'var(--primary)' : 'var(--danger)')}`, borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}><div style={{fontWeight: '600', fontSize: '0.9rem', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', textDecoration: isExpelled ? 'line-through' : 'none'}}>#{player.numero} {player.nombre}</div><div style={{fontSize: '0.8rem', color: '#6b7280', fontWeight: '600'}}>Pts: <span style={{color: 'var(--text-main)'}}>{points}</span> | F: <span style={{color: fouls>=4?'#ef4444':'inherit'}}>{fouls}</span></div></div>
            {isExpelled && <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', transform: 'rotate(-2deg)', textShadow: '0 0 5px white', pointerEvents: 'none'}}>EXPULSADO ({reason})</div>}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}><button onClick={() => recordEvent(player, 'PUNTO', 1)} disabled={isExpelled} className="btn-action-compact" style={{background: '#ecfccb', color: '#365314', border: '1px solid #bef264'}}>+1</button><button onClick={() => recordEvent(player, 'PUNTO', 2)} disabled={isExpelled} className="btn-action-compact" style={{background: '#dbeafe', color: '#1e3a8a', border: '1px solid #bfdbfe'}}>+2</button><button onClick={() => recordEvent(player, 'PUNTO', 3)} disabled={isExpelled} className="btn-action-compact" style={{background: '#ffedd5', color: '#7c2d12', border: '1px solid #fed7aa'}}>+3</button></div>
            <div style={{ display: 'flex', gap: '4px' }}><button onClick={() => recordEvent(player, 'FALTA_P')} disabled={isExpelled} className="btn-action-compact" style={{background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb'}}>P</button><button onClick={() => recordEvent(player, 'FALTA_T')} disabled={isExpelled} className="btn-action-compact" style={{background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe'}}>T</button><button onClick={() => recordEvent(player, 'FALTA_U')} disabled={isExpelled} className="btn-action-compact" style={{background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca'}}>U</button><div style={{width: '1px', background: '#e5e7eb', margin: '0 2px'}}></div><button onClick={() => recordEvent(player, 'REBOTE', 0)} disabled={isExpelled} className="btn-action-compact btn-stat">Rb</button><button onClick={() => recordEvent(player, 'ASISTENCIA', 0)} disabled={isExpelled} className="btn-action-compact btn-stat">As</button><button onClick={() => recordEvent(player, 'ROBO', 0)} disabled={isExpelled} className="btn-action-compact btn-stat">Ro</button></div>
        </div>
    );
});

const SubstitutionModal = ({ showSubsModal, localRoster, visitanteRoster, localOnCourt, visitanteOnCourt, selectedMatch, handleSubstitution, setShowSubsModal, localPlayerFouls, visitantePlayerFouls }: any) => {
    if (!showSubsModal) return null;
    const isLocal = showSubsModal === 'local';
    const teamRoster = isLocal ? localRoster : visitanteRoster;
    const onCourtIds = isLocal ? localOnCourt : visitanteOnCourt;
    const foulsMap = isLocal ? localPlayerFouls : visitantePlayerFouls;
    const benchPlayers = teamRoster.filter((p: any) => !onCourtIds.includes(p.id));
    const courtPlayers = teamRoster.filter((p: any) => onCourtIds.includes(p.id));
    return (
        <div className="modal-overlay">
            <div className="modal-content animate-fade-in"><h3 style={{marginTop: 0, fontSize: '1.2rem', borderBottom: '1px solid #eee', paddingBottom: '15px', color: 'var(--primary)'}}>🔄 Sustitución: {isLocal ? selectedMatch?.equipoLocalNombre : selectedMatch?.equipoVisitanteNombre}</h3><div style={{ maxHeight: '300px', overflowY: 'auto', margin: '15px 0' }}>{benchPlayers.map((p: any) => { const foulStats = foulsMap.get(p.id); const { isExpelled, reason } = checkDisqualification(foulStats); return (<div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isExpelled ? 0.5 : 1 }}><div><span style={{fontWeight: 'bold', fontSize: '1rem'}}>#{p.numero} {p.nombre}</span>{isExpelled && <span style={{marginLeft: '8px', fontSize: '0.75rem', color: 'red', fontWeight: 'bold'}}>{reason}</span>}</div>{isExpelled ? <span className="badge badge-danger">BLOQUEADO</span> : (<select onChange={(e) => { if (e.target.value) handleSubstitution(showSubsModal, p.id, e.target.value); }} defaultValue="" style={{ marginLeft: '10px', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', width: '160px', marginBottom: 0 }}><option value="" disabled>Entra por...</option>{courtPlayers.map((out: any) => <option key={out.id} value={out.id}>Sale: #{out.numero} {out.nombre}</option>)}</select>)}</div>);})}</div><button onClick={() => setShowSubsModal(null)} className="btn btn-secondary" style={{ width: '100%' }}>Cerrar Banca</button></div>
        </div>
    );
};

const MesaTecnica: React.FC<MesaTecnicaProps> = ({ onClose, onMatchFinalized }) => {
    const [availableMatches, setAvailableMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [localRoster, setLocalRoster] = useState<JugadorForma5[]>([]);
    const [visitanteRoster, setVisitanteRoster] = useState<JugadorForma5[]>([]);
    const [localOnCourt, setLocalOnCourt] = useState<string[]>([]);
    const [visitanteOnCourt, setVisitanteOnCourt] = useState<string[]>([]);
    const [showSubsModal, setShowSubsModal] = useState<'local' | 'visitante' | null>(null);
    const [marcadorLocal, setMarcadorLocal] = useState(0);
    const [marcadorVisitante, setMarcadorVisitante] = useState(0);
    const [currentQuarter, setCurrentQuarter] = useState(1);
    const [jugadasRecientes, setJugadasRecientes] = useState<StatEvent[]>([]); 
    const [time, setTime] = useState(QUARTER_TIME_MS);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<number | null>(null); 
    const buzzerAudio = useRef<HTMLAudioElement | null>(null);
    const [localPlayerFouls, setLocalPlayerFouls] = useState<Map<string, FoulBreakdown>>(new Map());
    const [visitantePlayerFouls, setVisitantePlayerFouls] = useState<Map<string, FoulBreakdown>>(new Map());
    const [localTeamFouls, setLocalTeamFouls] = useState(0);
    const [visitanteTeamFouls, setVisitanteTeamFouls] = useState(0);
    const [playerPoints, setPlayerPoints] = useState<Map<string, number>>(new Map());

    useEffect(() => { buzzerAudio.current = new Audio(BUZZER_SOUND_URL); }, []);

    useEffect(() => {
        const fetchAvailableMatches = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'calendario'));
                const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Match[];
                const ready = matchesData.filter(m => !m.partidoRegistradoId && m.forma5);
                setAvailableMatches(ready.sort((a,b) => a.jornada - b.jornada));
            } catch (err) { console.error(err); }
        };
        fetchAvailableMatches();
    }, []);

    useEffect(() => {
        if (!selectedMatch) return;
        const loadData = async () => {
            try {
                const matchDoc = await getDoc(doc(db, 'calendario', selectedMatch.id));
                if (matchDoc.exists()) {
                    const data = matchDoc.data();
                    setMarcadorLocal(data.marcadorLocal || 0);
                    setMarcadorVisitante(data.marcadorVisitante || 0);
                    const lRoster = data.forma5?.[selectedMatch.equipoLocalId] || [];
                    const vRoster = data.forma5?.[selectedMatch.equipoVisitanteId] || [];
                    lRoster.sort((a: any, b: any) => a.numero - b.numero);
                    vRoster.sort((a: any, b: any) => a.numero - b.numero);
                    setLocalRoster(lRoster);
                    setVisitanteRoster(vRoster);
                    if (localOnCourt.length === 0) setLocalOnCourt(lRoster.slice(0, 5).map((p:any) => p.id));
                    if (visitanteOnCourt.length === 0) setVisitanteOnCourt(vRoster.slice(0, 5).map((p:any) => p.id));
                }
                const q = query(collection(db, 'stats_partido'), where('calendarioId', '==', selectedMatch.id), orderBy('timestamp', 'asc'));
                const snap = await getDocs(q);
                const log = snap.docs.map(d => ({id: d.id, ...d.data()})) as StatEvent[];
                rebuildStats(log, selectedMatch.equipoLocalId, currentQuarter);
                setJugadasRecientes(log.reverse());
            } catch (e) { console.error(e); }
        };
        loadData();
    }, [selectedMatch, currentQuarter]);

    const rebuildStats = (log: StatEvent[], localId: string, quarter: number) => {
        const lFouls = new Map<string, FoulBreakdown>();
        const vFouls = new Map<string, FoulBreakdown>();
        const pts = new Map();
        let lTeamF = 0; let vTeamF = 0;
        log.forEach(s => {
            if (s.tipo === 'PUNTO') pts.set(s.jugadorId, (pts.get(s.jugadorId) || 0) + s.puntos);
            if (s.tipo.startsWith('FALTA') && s.jugadorNombre !== 'ENTRENADOR') {
                const isLocal = s.equipoId === localId;
                const map = isLocal ? lFouls : vFouls;
                const stats = map.get(s.jugadorId) || { total: 0, tech: 0, unsport: 0 };
                stats.total += 1; if (s.tipo === 'FALTA_T') stats.tech += 1; if (s.tipo === 'FALTA_U') stats.unsport += 1;
                map.set(s.jugadorId, stats);
                if (s.cuarto === quarter) { isLocal ? lTeamF++ : vTeamF++; }
            }
        });
        setLocalPlayerFouls(lFouls); setVisitantePlayerFouls(vFouls); setLocalTeamFouls(lTeamF); setVisitanteTeamFouls(vTeamF); setPlayerPoints(pts);
    };

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setTime(prevTime => {
                    if (prevTime <= 0) { setIsRunning(false); if (buzzerAudio.current) { buzzerAudio.current.currentTime = 0; buzzerAudio.current.play().catch(e => console.log(e)); } return 0; }
                    return prevTime - INTERVAL_MS;
                });
            }, INTERVAL_MS) as unknown as number;
        } else { if (intervalRef.current) clearInterval(intervalRef.current); }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isRunning]);

    const handleQuarterChange = () => { setIsRunning(false); if(!window.confirm("¿Cambiar cuarto?")) return; setCurrentQuarter(prev => { const next = prev + 1; setTime(next <= 4 ? QUARTER_TIME_MS : OT_TIME_MS); setLocalTeamFouls(0); setVisitanteTeamFouls(0); return next; }); };
    const adjustTime = (seconds: number) => { setTime(prev => Math.max(0, prev + (seconds * 1000))); };
    
    const handleResetMatch = async () => {
        if (!selectedMatch || !window.confirm("⚠️ REINICIAR? Se borrará todo.")) return;
        setIsRunning(false);
        const q = query(collection(db, 'stats_partido'), where('calendarioId', '==', selectedMatch.id));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        batch.update(doc(db, 'calendario', selectedMatch.id), { marcadorLocal: 0, marcadorVisitante: 0 });
        await batch.commit();
        setMarcadorLocal(0); setMarcadorVisitante(0); setCurrentQuarter(1); setTime(QUARTER_TIME_MS);
        setLocalPlayerFouls(new Map()); setVisitantePlayerFouls(new Map()); setLocalTeamFouls(0); setVisitanteTeamFouls(0); setPlayerPoints(new Map()); setJugadasRecientes([]);
    };

    const recordEvent = async (jugador: JugadorForma5, tipo: string, puntos = 0) => {
        if (!selectedMatch) return;
        const isLocal = jugador.equipoId === selectedMatch.equipoLocalId;
        
        if (tipo === 'PUNTO') {
            const newLocal = isLocal ? marcadorLocal + puntos : marcadorLocal;
            const newVisit = !isLocal ? marcadorVisitante + puntos : marcadorVisitante;
            setMarcadorLocal(newLocal); setMarcadorVisitante(newVisit);
            setPlayerPoints(prev => new Map(prev).set(jugador.id, (prev.get(jugador.id) || 0) + puntos));
            updateDoc(doc(db, 'calendario', selectedMatch.id), { marcadorLocal: newLocal, marcadorVisitante: newVisit });
        }
        
        if (tipo.startsWith('FALTA')) {
            const map = isLocal ? localPlayerFouls : visitantePlayerFouls;
            const currentStats = map.get(jugador.id) || { total: 0, tech: 0, unsport: 0 };
            const newStats = { ...currentStats }; newStats.total += 1;
            if (tipo === 'FALTA_T') newStats.tech += 1; if (tipo === 'FALTA_U') newStats.unsport += 1;
            if (isLocal) setLocalPlayerFouls(new Map(localPlayerFouls).set(jugador.id, newStats)); else setVisitantePlayerFouls(new Map(visitantePlayerFouls).set(jugador.id, newStats));
            if (isLocal && localTeamFouls < 5) setLocalTeamFouls(f => f + 1); if (!isLocal && visitanteTeamFouls < 5) setVisitanteTeamFouls(f => f + 1);
        }

        const eventData: StatEvent = { id: doc(collection(db, 'stats_partido')).id, calendarioId: selectedMatch.id, equipoId: jugador.equipoId, jugadorId: jugador.id, jugadorNombre: jugador.nombre, jugadorNumero: jugador.numero, puntos, tipo: tipo as any, timestamp: new Date().toISOString(), cuarto: currentQuarter, tiempoJuego: formatTime(time) };
        try { await setDoc(doc(db, 'stats_partido', eventData.id), eventData); setJugadasRecientes(prev => [eventData, ...prev]); } catch (err) {}
    };

    const deleteSpecificEvent = async (stat: StatEvent) => {
        if(!window.confirm(`¿Borrar ${stat.tipo}?`)) return;
        if (stat.tipo === 'PUNTO') {
             const isLocal = stat.equipoId === selectedMatch?.equipoLocalId;
             const newLocal = isLocal ? marcadorLocal - stat.puntos : marcadorLocal;
             const newVisit = !isLocal ? marcadorVisitante - stat.puntos : marcadorVisitante;
             setMarcadorLocal(newLocal); setMarcadorVisitante(newVisit);
             setPlayerPoints(prev => new Map(prev).set(stat.jugadorId, (prev.get(stat.jugadorId) || 0) - stat.puntos));
             updateDoc(doc(db, 'calendario', selectedMatch!.id), { marcadorLocal: newLocal, marcadorVisitante: newVisit });
        }
        if (stat.tipo.startsWith('FALTA')) {
             const isLocal = stat.equipoId === selectedMatch?.equipoLocalId;
             const map = isLocal ? localPlayerFouls : visitantePlayerFouls;
             const currentStats = map.get(stat.jugadorId);
             if (currentStats && currentStats.total > 0) {
                 const newStats = { ...currentStats }; newStats.total -= 1;
                 if (stat.tipo === 'FALTA_T') newStats.tech--; if (stat.tipo === 'FALTA_U') newStats.unsport--;
                 if (isLocal) setLocalPlayerFouls(new Map(localPlayerFouls).set(stat.jugadorId, newStats)); else setVisitantePlayerFouls(new Map(visitantePlayerFouls).set(stat.jugadorId, newStats));
             }
             if (stat.cuarto === currentQuarter) { if (isLocal && localTeamFouls > 0) setLocalTeamFouls(f => f - 1); if (!isLocal && visitanteTeamFouls > 0) setVisitanteTeamFouls(f => f - 1); }
        }
        await deleteDoc(doc(db, 'stats_partido', stat.id));
        setJugadasRecientes(prev => prev.filter(s => s.id !== stat.id));
    };

    const handleFinalizar = async () => {
        if (!selectedMatch || isRunning) { alert("Pausa reloj."); return; }
        const mvpResult = await calculateMVP(selectedMatch.id);
        const mvpPlayer = mvpResult.mvpData;
        const localId = selectedMatch.equipoLocalId; const visitanteId = selectedMatch.equipoVisitanteId;
        const isLocalWinner = marcadorLocal > marcadorVisitante;
        const ganadorId = isLocalWinner ? localId : visitanteId; const perdedorId = isLocalWinner ? visitanteId : localId;

        const registroFinal = { calendarioId: selectedMatch.id, jornada: selectedMatch.jornada, fechaRegistro: new Date().toISOString(), equipoLocalId: localId, equipoVisitanteId: visitanteId, marcadorLocal, marcadorVisitante, ganadorId, perdedorId, tiempoTotalMS: (currentQuarter * QUARTER_TIME_MS) - time, estadisticasJugadores: mvpResult.stats, mvpId: mvpResult.mvpId, mvpNombre: mvpPlayer ? mvpPlayer.jugadorNombre : 'N/A', mvpValoracion: mvpPlayer ? mvpPlayer.valoracion : 0 };
        const docRef = await addDoc(collection(db, 'partidos'), registroFinal);
        await updateDoc(doc(db, 'calendario', selectedMatch.id), { partidoRegistradoId: docRef.id, marcadorLocal, marcadorVisitante });

        try {
            await updateStandingsAutomatically(localId, marcadorLocal, marcadorVisitante, isLocalWinner);
            await updateStandingsAutomatically(visitanteId, marcadorVisitante, marcadorLocal, !isLocalWinner);
            alert("✅ Finalizado.");
        } catch (err) { alert("Error updating standings."); }
        if(onMatchFinalized) onMatchFinalized(); onClose();
    };

    const handleSubstitution = async (team: 'local' | 'visitante', playerInId: string, playerOutId: string) => {
        if (!selectedMatch) return;
        if (team === 'local') setLocalOnCourt(prev => [...prev.filter(id => id !== playerOutId), playerInId]); else setVisitanteOnCourt(prev => [...prev.filter(id => id !== playerOutId), playerInId]);
        setShowSubsModal(null);
        const roster = team === 'local' ? localRoster : visitanteRoster;
        const pIn = roster.find(p => p.id === playerInId); const pOut = roster.find(p => p.id === playerOutId);
        if (pIn && pOut) {
            const eventData: StatEvent = { id: doc(collection(db, 'stats_partido')).id, calendarioId: selectedMatch.id, equipoId: pIn.equipoId, jugadorId: pIn.id, jugadorNombre: pIn.nombre, jugadorNumero: pIn.numero, puntos: 0, tipo: 'CAMBIO', detalles: `Sale: #${pOut.numero} ${pOut.nombre}`, timestamp: new Date().toISOString(), cuarto: currentQuarter, tiempoJuego: formatTime(time) };
            try { await setDoc(doc(db, 'stats_partido', eventData.id), eventData); setJugadasRecientes(prev => [eventData, ...prev]); } catch (err) {}
        }
    };

    if (!selectedMatch) return (
        <div style={{ padding: '20px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{color: 'var(--primary)', marginBottom: '20px'}}>🏀 Mesa Técnica</h2>
            {availableMatches.length === 0 && <div className="card" style={{padding: '20px', color: 'var(--text-muted)'}}>No hay partidos listos.</div>}
            <div style={{display: 'grid', gap: '15px'}}>{availableMatches.map((m: any) => (<div key={m.id} onClick={() => { setSelectedMatch(m); setCurrentQuarter(1); }} className="dashboard-card" style={{height: 'auto', flexDirection: 'row', justifyContent: 'space-between', padding: '20px', textAlign: 'left'}}><div><span className="badge badge-warning">Jornada {m.jornada}</span><div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{m.equipoLocalNombre} vs {m.equipoVisitanteNombre}</div></div><button className="btn btn-success">INICIAR</button></div>))}</div>
            <button onClick={onClose} className="btn btn-secondary" style={{marginTop: '30px'}}>Volver</button>
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
            <style>{`.btn-time-compact { background: #374151; color: #fff; border: 1px solid #4b5563; border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; } .btn-action-compact { border: none; border-radius: 6px; flex: 1; padding: 10px 0; font-size: 0.85rem; cursor: pointer; } .btn-stat { background: #e5e7eb; color: #374151; }`}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                 <button onClick={() => setSelectedMatch(null)} className="btn btn-secondary" style={{padding: '8px 15px', fontSize: '0.9rem'}}>← Salir</button>
                 <div style={{display: 'flex', gap: '10px'}}><button onClick={handleResetMatch} className="btn btn-danger" style={{padding: '8px 15px', fontSize: '0.9rem'}}>REINICIAR</button><button onClick={handleFinalizar} className="btn btn-primary" style={{padding: '8px 15px', fontSize: '0.9rem'}}>Finalizar Partido</button></div>
            </div>
            <ScoreBoard selectedMatch={selectedMatch} marcadorLocal={marcadorLocal} marcadorVisitante={marcadorVisitante} localTeamFouls={localTeamFouls} visitanteTeamFouls={visitanteTeamFouls} currentQuarter={currentQuarter} time={time} isRunning={isRunning} setIsRunning={setIsRunning} adjustTime={adjustTime} handleQuarterChange={handleQuarterChange} />
            {showSubsModal && <SubstitutionModal showSubsModal={showSubsModal} localRoster={localRoster} visitanteRoster={visitanteRoster} localOnCourt={localOnCourt} visitanteOnCourt={visitanteOnCourt} selectedMatch={selectedMatch} handleSubstitution={handleSubstitution} setShowSubsModal={setShowSubsModal} localPlayerFouls={localPlayerFouls} visitantePlayerFouls={visitantePlayerFouls} />}
            <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', background: 'var(--primary)', color: 'white', padding: '10px 15px', borderRadius: '10px' }}><h4 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>LOCAL</h4><button onClick={() => setShowSubsModal('local')} className="btn" style={{fontSize: '0.75rem', padding: '4px 10px', background: 'white', color: 'var(--primary)'}}>CAMBIOS</button></div><div>{localRoster.filter(p => localOnCourt.includes(p.id)).map(player => <PlayerCard key={player.id} player={player} isLocal={true} foulStats={localPlayerFouls.get(player.id)} points={(playerPoints.get(player.id) || 0)} recordEvent={recordEvent} />)}</div></div>
                <div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', background: 'var(--danger)', color: 'white', padding: '10px 15px', borderRadius: '10px' }}><h4 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>VISITANTE</h4><button onClick={() => setShowSubsModal('visitante')} className="btn" style={{fontSize: '0.75rem', padding: '4px 10px', background: 'white', color: 'var(--danger)'}}>CAMBIOS</button></div><div>{visitanteRoster.filter(p => visitanteOnCourt.includes(p.id)).map(player => <PlayerCard key={player.id} player={player} isLocal={false} foulStats={visitantePlayerFouls.get(player.id)} points={(playerPoints.get(player.id) || 0)} recordEvent={recordEvent} />)}</div></div>
            </div>
            <div className="card" style={{ marginTop: '20px', padding: '15px' }}><h5 style={{margin: '0 0 15px 0', fontSize: '1rem', color: 'var(--text-muted)'}}>📋 Historial</h5><div style={{ maxHeight: '200px', overflowY: 'auto' }}><table className="data-table" style={{fontSize: '0.85rem'}}><thead><tr><th style={{padding: '8px'}}>Hora</th><th style={{padding: '8px'}}>Jugador</th><th style={{padding: '8px'}}>Acción</th><th style={{padding: '8px', textAlign: 'center'}}>Pts</th><th style={{padding: '8px', textAlign: 'center'}}>Borrar</th></tr></thead><tbody>{jugadasRecientes.map(j => (<tr key={j.id}><td style={{padding: '8px'}}>{j.tiempoJuego}</td><td style={{padding: '8px'}}>#{j.jugadorNumero} {j.jugadorNombre}</td><td style={{padding: '8px'}}>{j.tipo}</td><td style={{padding: '8px', textAlign: 'center'}}>{j.puntos}</td><td style={{padding: '8px', textAlign: 'center'}}><button onClick={() => deleteSpecificEvent(j)} style={{background: 'none', border: 'none'}}>🗑️</button></td></tr>))}</tbody></table></div></div>
        </div>
    );
};
export default MesaTecnica;