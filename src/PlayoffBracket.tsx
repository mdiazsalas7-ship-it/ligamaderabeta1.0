import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc, onSnapshot, collection, getDocs, query, orderBy } from 'firebase/firestore';

// --- INTERFACES ---
interface Team { id: string; nombre: string; victorias: number; puntos: number; logoUrl?: string; }
interface Match {
    id: string;
    name: string; // ej: "Cuartos A"
    nextMatchId?: string; // A dónde va el ganador
    nextSlot?: 'home' | 'away'; // En qué posición va (local/visita)
    loserMatchId?: string; // Para el 3er lugar
    homeTeam?: Team | null;
    awayTeam?: Team | null;
    winnerId?: string | null;
}

const PlayoffBracket: React.FC<{ adminMode: boolean, onClose: () => void }> = ({ adminMode, onClose }) => {
    const [matches, setMatches] = useState<Record<string, Match>>({});
    const [loading, setLoading] = useState(true);

    // ESTRUCTURA BASE DEL TORNEO
    const BRACKET_TEMPLATE: Record<string, Match> = {
        // --- CUARTOS DE FINAL ---
        q1: { id: 'q1', name: 'CF 1 (1 vs 8)', nextMatchId: 's1', nextSlot: 'home', homeTeam: null, awayTeam: null },
        q2: { id: 'q2', name: 'CF 2 (4 vs 5)', nextMatchId: 's1', nextSlot: 'away', homeTeam: null, awayTeam: null },
        q3: { id: 'q3', name: 'CF 3 (2 vs 7)', nextMatchId: 's2', nextSlot: 'home', homeTeam: null, awayTeam: null },
        q4: { id: 'q4', name: 'CF 4 (3 vs 6)', nextMatchId: 's2', nextSlot: 'away', homeTeam: null, awayTeam: null },
        
        // --- SEMIFINALES ---
        s1: { id: 's1', name: 'SEMIFINAL 1', nextMatchId: 'f1', nextSlot: 'home', loserMatchId: 'f2', homeTeam: null, awayTeam: null },
        s2: { id: 's2', name: 'SEMIFINAL 2', nextMatchId: 'f1', nextSlot: 'away', loserMatchId: 'f2', homeTeam: null, awayTeam: null },

        // --- FINALES ---
        f1: { id: 'f1', name: '🏆 GRAN FINAL', homeTeam: null, awayTeam: null },
        f2: { id: 'f2', name: '🥉 3ER LUGAR', homeTeam: null, awayTeam: null }
    };

    // 1. ESCUCHAR CAMBIOS EN VIVO
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'playoffs', 'torneo_actual'), (docSnap) => {
            if (docSnap.exists()) {
                setMatches(docSnap.data() as Record<string, Match>);
            } else {
                setMatches({});
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2. FUNCIÓN PARA GENERAR LLAVES (SOLO ADMIN)
    const generarLlaves = async () => {
        if (!window.confirm("¿Estás seguro? Esto borrará el progreso actual y generará nuevas llaves basadas en la tabla.")) return;
        
        setLoading(true);
        try {
            // Obtener equipos ordenados
            const q = query(collection(db, 'equipos'), orderBy('victorias', 'desc'), orderBy('puntos', 'desc'));
            const snap = await getDocs(q);
            const teams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));

            if (teams.length < 8) {
                alert("Necesitas al menos 8 equipos para generar los Playoffs.");
                setLoading(false);
                return;
            }

            const top8 = teams.slice(0, 8);
            const newBracket = { ...BRACKET_TEMPLATE };

            // ASIGNAR 1 vs 8, 4 vs 5, etc.
            newBracket.q1.homeTeam = top8[0]; newBracket.q1.awayTeam = top8[7]; // 1 vs 8
            newBracket.q2.homeTeam = top8[3]; newBracket.q2.awayTeam = top8[4]; // 4 vs 5
            newBracket.q3.homeTeam = top8[1]; newBracket.q3.awayTeam = top8[6]; // 2 vs 7
            newBracket.q4.homeTeam = top8[2]; newBracket.q4.awayTeam = top8[5]; // 3 vs 6

            await setDoc(doc(db, 'playoffs', 'torneo_actual'), newBracket);
            alert("✅ Llaves generadas con éxito");

        } catch (error) {
            console.error(error);
            alert("Error generando llaves");
        }
        setLoading(false);
    };

    // 3. AVANZAR GANADOR (SOLO ADMIN)
    const declararGanador = async (matchId: string, winnerTeam: Team) => {
        if (!adminMode || !matches[matchId]) return;
        
        if (!window.confirm(`¿Confirmar que ${winnerTeam.nombre} ganó este cruce?`)) return;

        const currentMatch = matches[matchId];
        const newBracket = { ...matches };

        // 1. Marcar ganador en el partido actual
        newBracket[matchId].winnerId = winnerTeam.id;

        // 2. Mover Ganador a la siguiente ronda
        if (currentMatch.nextMatchId && currentMatch.nextSlot) {
            const nextM = newBracket[currentMatch.nextMatchId];
            if (currentMatch.nextSlot === 'home') nextM.homeTeam = winnerTeam;
            else nextM.awayTeam = winnerTeam;
            // Resetear ganador futuro si cambia el equipo
            nextM.winnerId = null; 
        }

        // 3. Mover Perdedor al 3er Lugar (Solo si es Semifinal)
        if (currentMatch.loserMatchId) {
            const loserTeam = currentMatch.homeTeam?.id === winnerTeam.id ? currentMatch.awayTeam : currentMatch.homeTeam;
            if (loserTeam) {
                const thirdPlaceMatch = newBracket[currentMatch.loserMatchId];
                // Lógica simple: S1 perdedor va a home, S2 perdedor va a away
                if (matchId === 's1') thirdPlaceMatch.homeTeam = loserTeam;
                else thirdPlaceMatch.awayTeam = loserTeam;
                thirdPlaceMatch.winnerId = null;
            }
        }

        await setDoc(doc(db, 'playoffs', 'torneo_actual'), newBracket);
    };

    // --- COMPONENTE VISUAL DE PARTIDO ---
    const MatchCard = ({ m }: { m: Match }) => {
        if (!m) return null;
        return (
            <div style={{
                background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', 
                marginBottom: '10px', padding: '10px', minWidth: '200px', position: 'relative'
            }}>
                <div style={{fontSize:'0.7rem', color:'#888', marginBottom:'5px', textTransform:'uppercase', fontWeight:'bold'}}>{m.name}</div>
                
                {/* EQUIPO LOCAL */}
                <div style={{
                    display:'flex', justifyContent:'space-between', padding:'5px', borderRadius:'4px',
                    background: m.winnerId === m.homeTeam?.id ? '#065f46' : 'transparent',
                    fontWeight: m.winnerId === m.homeTeam?.id ? 'bold' : 'normal',
                    color: m.winnerId && m.winnerId !== m.homeTeam?.id ? '#666' : 'white'
                }}>
                    <span>{m.homeTeam?.nombre || 'Esperando...'}</span>
                    {adminMode && m.homeTeam && !m.winnerId && (
                        <button onClick={() => declararGanador(m.id, m.homeTeam!)} style={{fontSize:'0.7rem', background:'#2563eb', border:'none', color:'white', borderRadius:'3px', cursor:'pointer'}}>GANA</button>
                    )}
                </div>

                {/* EQUIPO VISITA */}
                <div style={{
                    display:'flex', justifyContent:'space-between', padding:'5px', borderRadius:'4px',
                    background: m.winnerId === m.awayTeam?.id ? '#065f46' : 'transparent',
                    fontWeight: m.winnerId === m.awayTeam?.id ? 'bold' : 'normal',
                    color: m.winnerId && m.winnerId !== m.awayTeam?.id ? '#666' : 'white',
                    borderTop: '1px solid #333'
                }}>
                    <span>{m.awayTeam?.nombre || 'Esperando...'}</span>
                    {adminMode && m.awayTeam && !m.winnerId && (
                        <button onClick={() => declararGanador(m.id, m.awayTeam!)} style={{fontSize:'0.7rem', background:'#2563eb', border:'none', color:'white', borderRadius:'3px', cursor:'pointer'}}>GANA</button>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <div style={{color:'white', padding:'20px'}}>Cargando Bracket...</div>;

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'#121212', zIndex:2000, 
            display:'flex', flexDirection:'column', color:'white', overflow:'hidden'
        }}>
            {/* HEADER */}
            <div style={{padding:'15px', background:'#000', borderBottom:'1px solid #333', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2 style={{margin:0, color:'#fbbf24'}}>🏆 PLAYOFFS</h2>
                <div style={{display:'flex', gap:'10px'}}>
                    {adminMode && Object.keys(matches).length === 0 && (
                        <button onClick={generarLlaves} className="btn" style={{background:'#2563eb'}}>⚡ GENERAR LLAVES</button>
                    )}
                    <button onClick={onClose} className="btn btn-secondary">CERRAR</button>
                </div>
            </div>

            {/* BRACKET VISUAL */}
            <div style={{flex:1, overflow:'auto', padding:'20px', display:'flex', gap:'40px', justifyContent:'center'}}>
                
                {/* COLUMNA 1: CUARTOS */}
                <div style={{display:'flex', flexDirection:'column', justifyContent:'space-around'}}>
                    <MatchCard m={matches.q1} />
                    <MatchCard m={matches.q2} />
                    <MatchCard m={matches.q3} />
                    <MatchCard m={matches.q4} />
                </div>

                {/* CONECTORES VISUALES (LINEAS SIMPLES) */}
                <div style={{display:'flex', flexDirection:'column', justifyContent:'space-around', alignItems:'center'}}>
                    <div style={{width:'20px', height:'100%', borderRight:'2px solid #444', margin:'20px 0'}}></div>
                </div>

                {/* COLUMNA 2: SEMIS */}
                <div style={{display:'flex', flexDirection:'column', justifyContent:'space-around'}}>
                    <MatchCard m={matches.s1} />
                    <MatchCard m={matches.s2} />
                </div>

                {/* COLUMNA 3: FINALES */}
                <div style={{display:'flex', flexDirection:'column', justifyContent:'center', gap:'50px'}}>
                    <div>
                        <div style={{textAlign:'center', color:'#eab308', fontWeight:'bold', marginBottom:'5px'}}>FINAL</div>
                        <MatchCard m={matches.f1} />
                    </div>
                    <div>
                        <div style={{textAlign:'center', color:'#9ca3af', fontWeight:'bold', marginBottom:'5px', fontSize:'0.8rem'}}>3ER LUGAR</div>
                        <MatchCard m={matches.f2} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PlayoffBracket;