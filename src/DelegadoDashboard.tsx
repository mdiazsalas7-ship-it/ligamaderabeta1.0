import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

interface Forma21 extends DocumentData {
    id: string;
    delegadoId: string;
    nombreEquipo: string;
    rosterCompleto?: boolean;
    aprobado?: boolean;
    equipoId?: string;
}

interface DelegadoDashboardProps {
    formas21: Forma21[];
    userUid: string;
    userEquipoId: string | null; // Lo dejamos en la interfaz pero lo sacamos del destructuring abajo si no lo usamos
    refreshData: () => void;
    setViewRosterId: (id: string) => void;
    setSelectedFormId: (id: string) => void;
    setSelectForma5MatchId: (id: string) => void;
    onRegister: () => void;
}

// QUITAMOS userEquipoId DEL DESTRUCTURING PARA QUE NO DE ERROR
const DelegadoDashboard: React.FC<DelegadoDashboardProps> = ({ 
    formas21, userUid, setViewRosterId, setSelectedFormId, setSelectForma5MatchId, onRegister 
}) => {
    
    const myTeam = formas21.find(f => f.delegadoId === userUid);
    const [nextMatches, setNextMatches] = useState<any[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);

    useEffect(() => {
        if (!myTeam || !myTeam.id) return;
        const loadMatches = async () => {
            setLoadingMatches(true);
            try {
                const calendarRef = collection(db, 'calendario');
                const q1 = query(calendarRef, where('equipoLocalId', '==', myTeam.equipoId));
                const q2 = query(calendarRef, where('equipoVisitanteId', '==', myTeam.equipoId));
                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                const matchesMap = new Map();
                [...snap1.docs, ...snap2.docs].forEach(doc => { matchesMap.set(doc.id, { id: doc.id, ...doc.data() }); });
                const allMatches = Array.from(matchesMap.values());
                const pending = allMatches.filter(m => !m.partidoRegistradoId);
                pending.sort((a, b) => a.jornada - b.jornada);
                setNextMatches(pending);
            } catch (err) { console.error(err); } finally { setLoadingMatches(false); }
        };
        loadMatches();
    }, [myTeam]);

    if (!myTeam) {
        return (
            <div className="dashboard-grid">
                <div className="dashboard-card" onClick={onRegister} style={{border: '2px dashed var(--primary)', height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
                    <div className="card-icon" style={{color: 'var(--primary)', fontSize: '3rem'}}>📝</div>
                    <div className="card-title" style={{color: 'var(--primary)', fontSize: '1.2rem', marginBottom: '10px'}}>Registrar Nuevo Equipo</div>
                    <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0}}>Inscribe a tu equipo para participar.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="card" style={{ borderLeft: `5px solid ${myTeam.aprobado ? 'var(--success)' : 'var(--accent)'}`, padding: '20px' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px'}}>
                    <div><h2 style={{margin: 0, fontSize: '1.4rem', color: 'var(--primary)'}}>{myTeam.nombreEquipo}</h2><p style={{margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)'}}>Estado de Inscripción</p></div>
                    {myTeam.aprobado ? <span className="badge badge-success">APROBADO ✅</span> : <span className="badge badge-warning">EN REVISIÓN ⏳</span>}
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                        <span style={{fontWeight: '600', fontSize: '0.9rem'}}>Roster (Forma 21)</span>
                        <span style={{fontWeight: 'bold', color: myTeam.rosterCompleto ? 'var(--success)' : 'var(--danger)', fontSize: '0.9rem'}}>{myTeam.rosterCompleto ? 'Completo' : 'Incompleto'}</span>
                    </div>
                    {!myTeam.rosterCompleto && <p style={{fontSize: '0.8rem', color: 'var(--danger)', margin: 0}}>⚠️ Necesitas mínimo 10 jugadores.</p>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button onClick={() => setSelectedFormId(myTeam.id)} className="btn btn-primary" style={{fontSize: '0.9rem'}}>✏️ Editar Roster</button>
                    <button onClick={() => setViewRosterId(myTeam.id)} className="btn btn-secondary" style={{fontSize: '0.9rem'}}>👁️ Ver Planilla</button>
                </div>
            </div>

            {myTeam.aprobado && (
                <div style={{marginTop: '30px'}}>
                    <h3 style={{fontSize: '1rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '10px'}}>Próximos Encuentros (Llenar Forma 5)</h3>
                    {loadingMatches ? <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>Cargando...</p> : nextMatches.length === 0 ? <div className="card" style={{padding: '20px', textAlign: 'center', color: 'var(--text-muted)'}}>No hay partidos programados.</div> : (
                        <div className="dashboard-grid">
                            {nextMatches.map(match => {
                                const yaLlenoForma5 = match.forma5 && match.forma5[myTeam.equipoId || ''];
                                return (
                                    <div key={match.id} className="dashboard-card" style={{height: 'auto', alignItems: 'flex-start', textAlign: 'left', padding: '15px'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '10px'}}>
                                            <span className="badge" style={{background: '#f1f5f9'}}>JORNADA {match.jornada}</span>
                                            {match.fechaAsignada ? <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)'}}>{new Date(match.fechaAsignada).toLocaleDateString()}</span> : <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Sin fecha</span>}
                                        </div>
                                        <div style={{fontWeight: '600', fontSize: '1rem', marginBottom: '15px', width: '100%'}}>{match.equipoLocalNombre} <span style={{color: 'var(--text-muted)', fontWeight: 'normal'}}>vs</span> {match.equipoVisitanteNombre}</div>
                                        {yaLlenoForma5 ? <button disabled className="btn btn-success" style={{width: '100%', fontSize: '0.85rem', opacity: 0.8, cursor: 'default'}}>✅ Alineación Enviada</button> : <button onClick={() => setSelectForma5MatchId(match.id)} className="btn btn-primary" style={{width: '100%', fontSize: '0.85rem', background: 'var(--accent)', borderColor: 'transparent'}}>📋 Llenar Forma 5</button>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default DelegadoDashboard;