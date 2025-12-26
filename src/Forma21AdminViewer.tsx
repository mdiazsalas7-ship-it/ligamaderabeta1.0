import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface Forma21 {
    id: string;
    nombreEquipo: string;
    estatus?: string; 
    delegadoEmail?: string;
    rosterCompleto?: boolean;
    aprobado?: boolean;
    delegadoId?: string; // Agregado para tipado correcto
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
                        rosterCompleto: playersSnap.size >= 5 // Ajustado a 5 como en tu lógica anterior
                    } as Forma21;
                }));
                
                setFormas(data);
            } catch (error) {
                console.error("Error al cargar inscripciones:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFormas();
    }, []);

    const toggleAprobado = async (formaId: string, currentStatus: string | undefined, delegadoId: string | undefined, nombreEquipo: string) => {
        const nuevoEstado = currentStatus === 'aprobado' ? 'pendiente' : 'aprobado';
        
        if (nuevoEstado === 'aprobado') {
             if (!window.confirm(`¿Aprobar definitivamente a ${nombreEquipo}? Esto cierra el Roster para el delegado.`)) return;
        } else {
             if (!window.confirm(`¿Rechazar a ${nombreEquipo}? El delegado podrá editar el Roster de nuevo.`)) return;
        }

        try {
            await updateDoc(doc(db, 'forma21s', formaId), { estatus: nuevoEstado, aprobado: nuevoEstado === 'aprobado' });
            
            try {
                await updateDoc(doc(db, 'equipos', formaId), { estatus: nuevoEstado });
            } catch(e) { console.log("El equipo no existe en la tabla de posiciones aún."); }

            setFormas(prev => prev.map(f => f.id === formaId ? { ...f, estatus: nuevoEstado, aprobado: nuevoEstado === 'aprobado' } : f));
            
            alert(`Estatus de ${nombreEquipo} cambiado a ${nuevoEstado}.`);

        } catch (e) {
            console.error("Error al cambiar estatus:", e);
            alert("Error al actualizar estatus. Revisa la consola.");
        }
    };

    // --- FUNCIÓN DE ELIMINAR ROBUSTA ---
    const handleDelete = async (id: string, nombre: string) => {
        if (!window.confirm(`⚠️ PELIGRO ⚠️\n\n¿Estás seguro de ELIMINAR la inscripción de "${nombre}"?\n\nSe borrarán:\n1. La inscripción (Forma 21)\n2. Todos los jugadores registrados\n3. El equipo de la tabla general`)) return;

        try {
            console.log("Iniciando eliminación del equipo:", id);

            // 1. Borrar Jugadores (Subcolección)
            // Firestore no borra subcolecciones automáticamente, hay que hacerlo manual
            const jugadoresRef = collection(db, 'forma21s', id, 'jugadores');
            const jugadoresSnap = await getDocs(jugadoresRef);
            
            const deletePromises = jugadoresSnap.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            console.log("Jugadores eliminados.");

            // 2. Borrar Forma 21 (Inscripción)
            await deleteDoc(doc(db, 'forma21s', id));
            console.log("Forma 21 eliminada.");
            
            // 3. Borrar de Equipos (Tabla General) - Si existe
            try {
                await deleteDoc(doc(db, 'equipos', id));
                console.log("Equipo de tabla general eliminado.");
            } catch (e) {
                console.warn("No se encontró en colección equipos o ya estaba borrado.");
            }

            // Actualizar tabla visualmente
            setFormas(prev => prev.filter(f => f.id !== id));
            alert("✅ Equipo eliminado correctamente y por completo.");

        } catch (error: any) {
            console.error("Error CRÍTICO al eliminar:", error);
            // Mostrar mensaje de error más útil
            alert(`❌ Error al eliminar: ${error.message || "Revisa permisos en Firebase"}`);
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
                                    <div style={{display:'flex', gap:'5px', justifyContent:'center'}}>
                                        <button onClick={() => setViewRosterId(f.id)} className="btn btn-primary" style={{fontSize:'0.8rem', padding:'5px 10px'}} title="Ver Roster">
                                            👁️
                                        </button>
                                        {/* BOTON ELIMINAR */}
                                        <button 
                                            onClick={() => handleDelete(f.id, f.nombreEquipo)} 
                                            className="btn" 
                                            style={{fontSize:'0.8rem', background:'#ef4444', color:'white', padding:'5px 10px'}} 
                                            title="Eliminar Equipo Definitivamente"
                                        >
                                            🗑️
                                        </button>
                                    </div>
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