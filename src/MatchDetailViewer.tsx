import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, setDoc, getDocs, query, where } from 'firebase/firestore';

interface PlayerStat { playerId: string; nombre: string; numero: number; puntos: number; rebotes: number; asistencias: number; triples: number; faltas: number; }

const MatchDetailViewer: React.FC<{ matchId: string, onClose: () => void }> = ({ matchId, onClose }) => {
    const [match, setMatch] = useState<any>(null);
    const [statsA, setStatsA] = useState<PlayerStat[]>([]);
    const [statsB, setStatsB] = useState<PlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'A'|'B'>('A');

    useEffect(() => {
        const loadData = async () => {
            try {
                const matchRef = doc(db, 'calendario', matchId);
                const matchSnap = await getDoc(matchRef);
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatch({ id: matchSnap.id, ...data });

                    // Obtener IDs y Rosters
                    const idA = data.equipoLocalId || Object.keys(data.forma5 || {})[0];
                    const idB = data.equipoVisitanteId || Object.keys(data.forma5 || {})[1];
                    const rosterA = data.forma5?.[idA] || [];
                    const rosterB = data.forma5?.[idB] || [];

                    // Buscar stats guardadas
                    const statsQuery = query(collection(db, 'stats_partido'), where('partidoId', '==', matchId));
                    const statsSnap = await getDocs(statsQuery);
                    const statsMap: Record<string, any> = {};
                    statsSnap.forEach(s => statsMap[s.data().jugadorId] = s.data());

                    const mapStat = (p: any) => ({
                        playerId: p.id, nombre: p.nombre, numero: p.numero,
                        puntos: Number(statsMap[p.id]?.puntos || 0),
                        rebotes: Number(statsMap[p.id]?.rebotes || 0),
                        asistencias: Number(statsMap[p.id]?.asistencias || 0),
                        triples: Number(statsMap[p.id]?.triples || 0),
                        faltas: Number(statsMap[p.id]?.faltas || 0)
                    });

                    setStatsA(rosterA.map(mapStat));
                    setStatsB(rosterB.map(mapStat));
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [matchId]);

    const handleSave = async () => {
        try {
            const allStats = [...statsA, ...statsB];
            const promises = allStats.map(s => {
                const teamName = statsA.includes(s) ? match.equipoLocalNombre : match.equipoVisitanteNombre;
                return setDoc(doc(db, 'stats_partido', `${matchId}_${s.playerId}`), {
                    partidoId: matchId, jugadorId: s.playerId, nombre: s.nombre, numero: s.numero, equipo: teamName,
                    puntos: Number(s.puntos), rebotes: Number(s.rebotes), asistencias: Number(s.asistencias), 
                    triples: Number(s.triples), faltas: Number(s.faltas), fecha: new Date().toISOString()
                });
            });
            await Promise.all(promises);
            alert("✅ Datos guardados.");
            onClose();
        } catch (e) { alert("Error al guardar."); }
    };

    const handleChange = (team: 'A'|'B', idx: number, field: keyof PlayerStat, val: string) => {
        const num = val === '' ? 0 : parseInt(val);
        if (team === 'A') {
            const newS = [...statsA]; newS[idx] = { ...newS[idx], [field]: isNaN(num) ? 0 : num }; setStatsA(newS);
        } else {
            const newS = [...statsB]; newS[idx] = { ...newS[idx], [field]: isNaN(num) ? 0 : num }; setStatsB(newS);
        }
    };

    if (loading) return <div>Cargando...</div>;

    return (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', zIndex:2000, display:'flex', justifyContent:'center', alignItems:'center'}}>
            <div style={{background:'white', width:'90%', height:'90vh', borderRadius:'10px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
                <div style={{padding:'15px', background:'var(--primary)', color:'white', display:'flex', justifyContent:'space-between'}}>
                    <h3>Planilla: {match?.equipoLocalNombre} vs {match?.equipoVisitanteNombre}</h3>
                    <button onClick={onClose}>Cerrar</button>
                </div>
                <div style={{display:'flex', borderBottom:'1px solid #ccc'}}>
                    <button onClick={()=>setActiveTab('A')} style={{flex:1, padding:'10px', background: activeTab==='A'?'white':'#eee'}}>🏠 {match?.equipoLocalNombre}</button>
                    <button onClick={()=>setActiveTab('B')} style={{flex:1, padding:'10px', background: activeTab==='B'?'white':'#eee'}}>✈️ {match?.equipoVisitanteNombre}</button>
                </div>
                <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                    <table style={{width:'100%'}}>
                        <thead><tr><th>#</th><th>Jugador</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
                        <tbody>
                            {(activeTab==='A'?statsA:statsB).map((s, i) => (
                                <tr key={s.playerId}>
                                    <td>{s.numero}</td><td>{s.nombre}</td>
                                    <td><input type="number" value={s.puntos} onChange={e=>handleChange(activeTab, i, 'puntos', e.target.value)} style={{width:'50px'}} /></td>
                                    <td><input type="number" value={s.rebotes} onChange={e=>handleChange(activeTab, i, 'rebotes', e.target.value)} style={{width:'50px'}} /></td>
                                    <td><input type="number" value={s.asistencias} onChange={e=>handleChange(activeTab, i, 'asistencias', e.target.value)} style={{width:'50px'}} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{padding:'20px', borderTop:'1px solid #ccc', textAlign:'right'}}>
                    <button onClick={handleSave} className="btn btn-primary">GUARDAR</button>
                </div>
            </div>
        </div>
    );
};
export default MatchDetailViewer;