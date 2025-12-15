import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
// import LogoUploader from './LogoUploader'; // DESACTIVADO PARA QUE NO FALLE

interface Forma21 { 
    id: string; 
    nombreEquipo: string; 
    estatus?: string; 
    logoUrl?: string; 
    rosterCompleto?: boolean;
}

interface Match {
    id: string;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    fechaAsignada: string;
    hora: string;
    estatus: string;
    cancha: string;
    esLocal: boolean;
}

interface DelegadoDashboardProps {
    formas21: Forma21[];
    userUid: string;
    userEquipoId: string | null;
    refreshData: () => void;
    setViewRosterId: (id: string) => void;
    setSelectedFormId: (id: string) => void;
    setSelectForma5MatchId: (id: string) => void;
    onRegister: () => void;
}

const DelegadoDashboard: React.FC<DelegadoDashboardProps> = ({ 
    formas21, userEquipoId,
    setViewRosterId, setSelectedFormId, setSelectForma5MatchId, onRegister 
}) => {
    
    const [matches, setMatches] = useState<Match[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);

    useEffect(() => {
        const fetchMyMatches = async () => {
            if (!userEquipoId) return;
            setLoadingMatches(true);
            try {
                const matchesFound: Match[] = [];
                const calRef = collection(db, 'calendario');

                const q1 = query(calRef, where('equipoLocalId', '==', userEquipoId));
                const snap1 = await getDocs(q1);
                snap1.forEach(d => {
                    const data = d.data();
                    if (data.estatus === 'programado') {
                        matchesFound.push({
                            id: d.id,
                            equipoLocalNombre: data.equipoLocalNombre,
                            equipoVisitanteNombre: data.equipoVisitanteNombre,
                            fechaAsignada: data.fechaAsignada || 'Por definir',
                            hora: data.hora || '00:00',
                            estatus: data.estatus,
                            cancha: data.cancha,
                            esLocal: true
                        });
                    }
                });

                const q2 = query(calRef, where('equipoVisitanteId', '==', userEquipoId));
                const snap2 = await getDocs(q2);
                snap2.forEach(d => {
                    const data = d.data();
                    if (data.estatus === 'programado') {
                        if (!matchesFound.find(m => m.id === d.id)) {
                            matchesFound.push({
                                id: d.id,
                                equipoLocalNombre: data.equipoLocalNombre,
                                equipoVisitanteNombre: data.equipoVisitanteNombre,
                                fechaAsignada: data.fechaAsignada || 'Por definir',
                                hora: data.hora || '00:00',
                                estatus: data.estatus,
                                cancha: data.cancha,
                                esLocal: false
                            });
                        }
                    }
                });

                matchesFound.sort((a,b) => a.fechaAsignada.localeCompare(b.fechaAsignada));
                setMatches(matchesFound);

            } catch (error) {
                console.error("Error cargando partidos:", error);
            } finally {
                setLoadingMatches(false);
            }
        };

        fetchMyMatches();
    }, [userEquipoId]);

    if (formas21.length === 0) {
        return (
            <div className="card" style={{textAlign:'center', padding:'40px'}}>
                <h3>¡Bienvenido Delegado!</h3>
                <p>Aún no has inscrito a tu equipo.</p>
                <button onClick={onRegister} className="btn btn-primary" style={{marginTop:'10px'}}>
                    📝 Inscribir Equipo (Forma 21)
                </button>
            </div>
        );
    }

    const miEquipo = formas21[0];
    const isApproved = miEquipo.estatus === 'aprobado';
    const canEditRoster = !isApproved; 

    return (
        <div className="animate-fade-in">
            {/* SECCIÓN 1: ESTADO DEL EQUIPO */}
            <div className="dashboard-grid" style={{marginBottom:'30px'}}>
                <div className="dashboard-card" style={{cursor:'default', borderLeft: isApproved?'4px solid #10b981':'4px solid #f59e0b', height:'auto'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'10px'}}>
                        {miEquipo.logoUrl ? 
                            <img src={miEquipo.logoUrl} alt="Logo" style={{width:'50px', height:'50px', borderRadius:'50%', objectFit:'cover'}} /> :
                            <div style={{fontSize:'2.5rem'}}>🛡️</div>
                        }
                        <div>
                            <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{miEquipo.nombreEquipo}</div>
                            <div style={{
                                fontSize:'0.8rem', fontWeight:'bold', 
                                color: isApproved ? '#10b981' : '#f59e0b'
                            }}>
                                {isApproved ? '✅ APROBADO' : '⏳ PENDIENTE DE APROBACIÓN'}
                            </div>
                        </div>
                    </div>
                    
                    {/* ZONA DE LOGO DESACTIVADA TEMPORALMENTE */}
                    <div style={{marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #eee'}}>
                        <p style={{fontSize:'0.75rem', color:'#999'}}>
                           (Opción de subir logo deshabilitada temporalmente para pruebas)
                        </p>
                    </div>
                </div>

                <div className="dashboard-card" onClick={() => setViewRosterId(miEquipo.id)} style={{cursor:'pointer', borderLeft:'4px solid #3b82f6'}}>
                    <div style={{fontSize:'2rem', marginBottom:'5px'}}>👥</div>
                    <div style={{fontWeight:'bold'}}>Ver Roster</div>
                    <div style={{fontSize:'0.8rem', color:'#666'}}>{miEquipo.rosterCompleto ? 'Roster Completo' : 'Roster Incompleto'}</div>
                </div>

                <div className="dashboard-card" onClick={canEditRoster ? () => setSelectedFormId(miEquipo.id) : undefined} 
                     style={{cursor: canEditRoster ? 'pointer' : 'not-allowed', opacity: canEditRoster ? 1 : 0.6, borderLeft:'4px solid #8b5cf6'}}>
                    <div style={{fontSize:'2rem', marginBottom:'5px'}}>{canEditRoster ? '✏️' : '🔒'}</div>
                    <div style={{fontWeight:'bold'}}>{canEditRoster ? 'Editar Roster' : 'Roster Cerrado'}</div>
                    <div style={{fontSize:'0.8rem', color:'#666'}}>
                        {canEditRoster ? 'Añadir/modificar jugadores' : 'Solo Admin puede modificar'}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2: PRÓXIMOS PARTIDOS */}
            {isApproved && (
                <div style={{marginTop:'30px'}}>
                    <h3 style={{color:'var(--primary)', marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}>
                        🏀 Próximos Partidos
                        <span style={{fontSize:'0.8rem', fontWeight:'normal', color:'#666'}}>(Define tu alineación)</span>
                    </h3>

                    {loadingMatches ? <div style={{textAlign:'center'}}>Cargando calendario...</div> : 
                     matches.length === 0 ? (
                        <div className="card" style={{textAlign:'center', color:'#888'}}>
                            No tienes partidos programados próximamente.
                        </div>
                     ) : (
                        <div style={{display:'grid', gap:'15px'}}>
                            {matches.map(m => (
                                <div key={m.id} className="card" style={{
                                    display:'flex', justifyContent:'space-between', alignItems:'center', 
                                    borderLeft:'5px solid var(--accent)', flexWrap:'wrap', gap:'15px'
                                }}>
                                    <div style={{flex:1, minWidth:'200px'}}>
                                        <div style={{fontSize:'0.85rem', color:'#666', marginBottom:'4px'}}>
                                            📅 {m.fechaAsignada} - ⏰ {m.hora} | 📍 {m.cancha}
                                        </div>
                                        <div style={{fontWeight:'bold', fontSize:'1.1rem', color:'#1f2937'}}>
                                            {m.esLocal ? '🏠 Tú' : m.equipoLocalNombre} vs {!m.esLocal ? '✈️ Tú' : m.equipoVisitanteNombre}
                                        </div>
                                    </div>
                                    <div>
                                        <button 
                                            onClick={() => setSelectForma5MatchId(m.id)}
                                            className="btn btn-primary"
                                            style={{display:'flex', alignItems:'center', gap:'8px'}}
                                        >
                                            📋 Cargar Alineación (Forma 5)
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )
                    }
                </div>
            )}
        </div>
    );
};
export default DelegadoDashboard;