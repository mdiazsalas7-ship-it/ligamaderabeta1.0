import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

interface CalendarioMatch extends DocumentData {
    id: string; jornada: number; equipoLocalNombre: string; equipoVisitanteNombre: string;
    equipoLocalId: string; equipoVisitanteId: string; fechaAsignada: string | null;
    marcadorLocal: number; marcadorVisitante: number; partidoRegistradoId: string | null;
}

interface CalendarViewerProps {
    rol: string; 
    userEquipoId: string | null; 
    onClose?: () => void;
    onViewLive?: (matchId: string) => void; 
}

const CalendarViewer: React.FC<CalendarViewerProps> = ({ rol, userEquipoId, onClose, onViewLive }) => {
    const [calendar, setCalendar] = useState<CalendarioMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');

    useEffect(() => {
        const fetchCalendar = async () => {
            setLoading(true);
            try {
                const snapshot = await getDocs(collection(db, 'calendario'));
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarioMatch));
                matches.sort((a, b) => {
                    const aLive = !a.partidoRegistradoId && (a.marcadorLocal > 0 || a.marcadorVisitante > 0);
                    const bLive = !b.partidoRegistradoId && (b.marcadorLocal > 0 || b.marcadorVisitante > 0);
                    if (aLive && !bLive) return -1;
                    if (!aLive && bLive) return 1;
                    return a.jornada - b.jornada;
                });
                setCalendar(matches);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchCalendar();
    }, []);

    // LOGICA RESTAURADA: Ahora sí hace algo
    const handleSaveDate = async (matchId: string) => {
        if (rol !== 'admin') return;
        let newFechaAsignada = null;
        if (newDate && newTime) {
            newFechaAsignada = `${newDate}T${newTime}:00`; 
        } else if (newDate) {
             newFechaAsignada = `${newDate}T00:00:00`; 
        }
        try {
            await updateDoc(doc(db, 'calendario', matchId), { fechaAsignada: newFechaAsignada });
            setCalendar(prev => prev.map(m => m.id === matchId ? {...m, fechaAsignada: newFechaAsignada} : m));
            setEditingMatchId(null);
        } catch (err) {
            alert("Error al guardar la fecha.");
        }
    };

    if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>Cargando...</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', margin: 0 }}>📅 Calendario Oficial</h2>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {calendar.map(match => {
                    const highlight = userEquipoId && (match.equipoLocalId === userEquipoId || match.equipoVisitanteId === userEquipoId);
                    const isPlayed = !!match.partidoRegistradoId;
                    const isLive = !isPlayed && (match.marcadorLocal > 0 || match.marcadorVisitante > 0 || (match.fechaAsignada && new Date(match.fechaAsignada) < new Date())); 

                    return (
                        <div key={match.id} className="card" style={{ padding: '20px', borderLeft: `5px solid ${isPlayed ? 'var(--success)' : (isLive ? 'var(--danger)' : '#e5e7eb')}`, backgroundColor: highlight ? '#f8fafc' : 'white' }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center'}}>
                                <span className="badge" style={{background: '#f1f5f9'}}>JORNADA {match.jornada}</span>
                                {isPlayed ? <span className="badge badge-success">FINALIZADO</span> : 
                                 isLive ? <span className="badge badge-danger animate-pulse">🔴 EN JUEGO</span> :
                                 (match.fechaAsignada ? <span className="badge" style={{background: '#dbeafe', color: '#1e40af'}}>PROGRAMADO</span> : <span className="badge">POR DEFINIR</span>)}
                            </div>

                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight: highlight?'700':'500'}}>
                                <span>{match.equipoLocalNombre}</span>
                                <div style={{textAlign:'center'}}>
                                    <span style={{
                                        background: isPlayed || isLive ? 'var(--text-main)' : '#f3f4f6', 
                                        color: isPlayed || isLive ? 'white' : 'var(--text-muted)',
                                        padding: '5px 15px', borderRadius: '8px', fontWeight: 'bold'
                                    }}>
                                        {isPlayed || isLive ? `${match.marcadorLocal} - ${match.marcadorVisitante}` : 'VS'}
                                    </span>
                                </div>
                                <span>{match.equipoVisitanteNombre}</span>
                            </div>

                            <div style={{marginTop:'15px', paddingTop:'15px', borderTop:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div style={{fontSize:'0.9rem', color: 'var(--text-muted)'}}>
                                    📅 {match.fechaAsignada ? new Date(match.fechaAsignada).toLocaleString() : 'Sin fecha'}
                                </div>
                                
                                {(isLive || isPlayed) && onViewLive && (
                                    <button onClick={() => onViewLive(match.id)} className="btn" style={{background: 'var(--primary)', color: 'white', fontSize:'0.8rem', padding:'6px 12px', border:'none'}}>
                                        {isLive ? '📺 Seguir en Vivo' : '📊 Ver Stats'}
                                    </button>
                                )}

                                {rol === 'admin' && !isPlayed && !isLive && (
                                    <div>
                                        {editingMatchId === match.id ? (
                                            <div style={{display: 'flex', gap: '5px', alignItems: 'center'}}>
                                                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{marginBottom: 0, padding: '5px'}} />
                                                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{marginBottom: 0, padding: '5px'}} />
                                                <button onClick={() => handleSaveDate(match.id)} className="btn btn-success" style={{padding: '5px 10px', fontSize: '0.8rem'}}>✓</button>
                                                <button onClick={() => setEditingMatchId(null)} className="btn btn-danger" style={{padding: '5px 10px', fontSize: '0.8rem'}}>✕</button>
                                            </div>
                                        ) : (
                                            <button onClick={()=>{setEditingMatchId(match.id); if(match.fechaAsignada){setNewDate(match.fechaAsignada.substring(0,10)); setNewTime(match.fechaAsignada.substring(11,16));}else{setNewDate('');setNewTime('')}}} className="btn btn-secondary" style={{fontSize:'0.8rem'}}>✏️</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
export default CalendarViewer;