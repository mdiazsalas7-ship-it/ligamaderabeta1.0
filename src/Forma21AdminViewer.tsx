import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';

interface Forma21 {
    id: string;
    nombreEquipo: string;
    estatus?: string; 
    delegadoEmail?: string;
    rosterCompleto?: boolean;
    aprobado?: boolean;
}

const Forma21AdminViewer: React.FC<{ onClose: () => void, setViewRosterId: (id: string) => void }> = ({ onClose, setViewRosterId }) => {
    
    const [formas, setFormas] = useState<Forma21[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFormas = async () => {
            try {
                const q = query(collection(db, 'forma21s'));
                const snap = await getDocs(q);
                
                const data = await Promise.all(snap.docs.map(async d => {
                    const playersSnap = await getDocs(collection(db, 'forma21s', d.id, 'jugadores'));
                    return {
                        id: d.id,
                        ...d.data(),
                        rosterCompleto: playersSnap.size >= 10 
                    } as Forma21;
                }));
                
                setFormas(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchFormas();
    }, []);

    const toggleAprobado = async (formaId: string, currentStatus: string | undefined, delegadoId: string, nombreEquipo: string) => {
        const nuevoEstado = currentStatus === 'aprobado' ? 'pendiente' : 'aprobado';
        
        if (nuevoEstado === 'aprobado') {
             if (!window.confirm(`¿Aprobar definitivamente a ${nombreEquipo}? Esto cierra el Roster para el delegado.`)) return;
        } else {
             if (!window.confirm(`¿Rechazar a ${nombreEquipo}? El delegado podrá editar el Roster de nuevo.`)) return;
        }

        try {
            // 1. Actualizar estatus en Forma 21
            await updateDoc(doc(db, 'forma21s', formaId), { estatus: nuevoEstado, aprobado: nuevoEstado === 'aprobado' });
            
            // 2. Actualizar estatus en la colección de Equipos (Tabla de Posiciones)
            await updateDoc(doc(db, 'equipos', formaId), { estatus: nuevoEstado });

            setFormas(prev => prev.map(f => f.id === formaId ? { ...f, estatus: nuevoEstado, aprobado: nuevoEstado === 'aprobado' } : f));
            
            alert(`Estatus de ${nombreEquipo} cambiado a ${nuevoEstado}.`);

        } catch (e) {
            console.error(e);
            alert("Error al actualizar estatus");
        }
    };

    if (loading) return <div style={{textAlign:'center', padding:'40px'}}>Cargando inscripciones...</div>;

    return (
        <div className="animate-fade-in" style={{maxWidth:'900px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0}}>📋 Gestión de Inscripciones (Forma 21)</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div style={{overflowX:'auto', background:'white', borderRadius:'8px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead style={{background:'#f8f9fa', borderBottom:'2px solid #eee'}}>
                        <tr>
                            <th style={{padding:'15px', textAlign:'left'}}>Equipo</th>
                            <th style={{padding:'15px', textAlign:'left'}}>Delegado</th>
                            <th style={{padding:'15px', textAlign:'center'}}>Jugadores</th>
                            <th style={{padding:'15px', textAlign:'center'}}>Estatus</th>
                            <th style={{padding:'15px', textAlign:'center'}}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formas.map((f) => (
                            <tr key={f.id} style={{borderBottom:'1px solid #eee'}}>
                                <td style={{padding:'15px', fontWeight:'bold'}}>{f.nombreEquipo}</td>
                                <td style={{padding:'15px', color:'#666', fontSize:'0.9rem'}}>{f.delegadoEmail}</td>
                                <td style={{padding:'15px', textAlign:'center'}}>
                                    <span style={{
                                        padding:'4px 8px', borderRadius:'12px', fontSize:'0.8rem',
                                        background: f.rosterCompleto ? '#dcfce7' : '#fee2e2',
                                        color: f.rosterCompleto ? '#166534' : '#991b1b', fontWeight:'bold'
                                    }}>
                                        {f.rosterCompleto ? 'Completo' : 'Incompleto'}
                                    </span>
                                </td>
                                <td style={{padding:'15px', textAlign:'center'}}>
                                    <button 
                                        onClick={() => toggleAprobado(f.id, f.estatus, f.delegadoId, f.nombreEquipo)}
                                        className={`btn ${f.estatus==='aprobado' ? 'btn-success' : 'btn-secondary'}`}
                                        style={{fontSize:'0.8rem', padding:'5px 10px'}}
                                    >
                                        {f.estatus === 'aprobado' ? '✅ Aprobado' : '⏳ Pendiente'}
                                    </button>
                                </td>
                                <td style={{padding:'15px', textAlign:'center'}}>
                                    <button onClick={() => setViewRosterId(f.id)} className="btn btn-primary" style={{fontSize:'0.8rem'}}>
                                        👁️ Ver Roster
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {formas.length === 0 && (
                            <tr><td colSpan={5} style={{padding:'30px', textAlign:'center', color:'#999'}}>No hay equipos inscritos aún.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default Forma21AdminViewer;