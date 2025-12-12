import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

interface JugadorStats { jugadorId: string; jugadorNombre: string; jugadorNumero: number; equipoId: string; puntos: number; rebotes: number; asistencias: number; valoracion: number; }
interface PartidoRegistrado extends DocumentData { calendarioId: string; jornada: number; equipoLocalId: string; equipoVisitanteId: string; marcadorLocal: number; marcadorVisitante: number; equipoLocalNombre?: string; equipoVisitanteNombre?: string; estadisticasJugadores?: JugadorStats[]; mvpNombre?: string; mvpValoracion?: number; mvpId?: string; }

const MatchDetailViewer: React.FC<{ matchId: string; onClose: () => void }> = ({ matchId, onClose }) => {
    const [match, setMatch] = useState<PartidoRegistrado | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                // Buscamos el partido finalizado por su ID registrado
                const docSnap = await getDoc(doc(db, 'partidos', matchId));
                if (docSnap.exists()) {
                    const data = docSnap.data() as PartidoRegistrado;
                    // Aseguramos nombres de equipos
                    if (!data.equipoLocalNombre) {
                        const calSnap = await getDoc(doc(db, 'calendario', data.calendarioId));
                        if (calSnap.exists()) {
                            data.equipoLocalNombre = calSnap.data().equipoLocalNombre;
                            data.equipoVisitanteNombre = calSnap.data().equipoVisitanteNombre;
                        }
                    }
                    setMatch(data);
                }
            } catch (err) {} finally { setLoading(false); }
        };
        fetch();
    }, [matchId]);

    const renderTable = (teamId: string) => {
        const stats = match?.estadisticasJugadores?.filter(s => s.equipoId === teamId) || [];
        return (
            <div className="table-responsive">
                <table className="data-table">
                    <thead><tr><th>#</th><th>Jugador</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th></tr></thead>
                    <tbody>
                        {stats.sort((a,b)=>b.valoracion-a.valoracion).map(s=>(
                            <tr key={s.jugadorId} style={s.jugadorId===match?.mvpId?{background:'#fffbeb'}:{}}>
                                <td>{s.jugadorNumero}</td>
                                <td>{s.jugadorNombre} {s.jugadorId===match?.mvpId && '⭐'}</td>
                                <td style={{fontWeight:'bold'}}>{s.puntos}</td>
                                <td>{s.rebotes}</td>
                                <td>{s.asistencias}</td>
                                <td style={{color:'var(--primary)', fontWeight:'bold'}}>{s.valoracion}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>Cargando Boxscore...</div>;
    if (!match) return <div className="card" style={{textAlign:'center', padding:'40px'}}>No se encontró el partido.</div>;

    return (
        <div className="animate-fade-in" style={{maxWidth: '1000px', margin: '0 auto'}}>
            <button onClick={onClose} className="btn btn-secondary" style={{ marginBottom: '20px' }}>← Volver</button>
            
            <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                <span className="badge badge-warning" style={{marginBottom: '10px'}}>Jornada {match.jornada} - FINALIZADO</span>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop:'10px' }}>
                    <div style={{flex:1, textAlign:'right'}}><h2 style={{color: 'var(--text-main)', fontSize:'1.2rem'}}>{match.equipoLocalNombre}</h2></div>
                    <div style={{ background: 'var(--primary)', color: 'white', padding: '10px 20px', borderRadius: '12px', fontSize: '2rem', fontWeight: 'bold' }}>{match.marcadorLocal} - {match.marcadorVisitante}</div>
                    <div style={{flex:1, textAlign:'left'}}><h2 style={{color: 'var(--text-main)', fontSize:'1.2rem'}}>{match.equipoVisitanteNombre}</h2></div>
                </div>
                {match.mvpNombre && <div style={{marginTop:'15px', padding:'5px 15px', background:'#fff7ed', display:'inline-block', borderRadius:'20px', border:'1px solid #fed7aa', color:'var(--accent)', fontWeight:'bold', fontSize:'0.9rem'}}>🏆 MVP: {match.mvpNombre} (Val: {match.mvpValoracion})</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="card" style={{padding:0, borderTop:'4px solid var(--primary)'}}>
                    <div style={{padding:'10px 15px', background:'#f8fafc', borderBottom:'1px solid #eee'}}><b>{match.equipoLocalNombre}</b></div>
                    {renderTable(match.equipoLocalId)}
                </div>
                <div className="card" style={{padding:0, borderTop:'4px solid var(--danger)'}}>
                    <div style={{padding:'10px 15px', background:'#fef2f2', borderBottom:'1px solid #eee'}}><b>{match.equipoVisitanteNombre}</b></div>
                    {renderTable(match.equipoVisitanteId)}
                </div>
            </div>
        </div>
    );
};
export default MatchDetailViewer;