import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore'; 

interface Player { 
    id: string; 
    numero: number; 
    nombre: string; 
    posicion?: string; 
    fechaNacimiento?: string;
    estatura?: string;
    peso?: string;
    suspendido?: boolean; // Importante para la suspensión
}

interface Staff { entrenador: string; asistente: string; }

// Recibimos adminMode desde App.tsx
const RosterViewer: React.FC<{ forma21Id: string; nombreEquipo: string; onClose: () => void; adminMode?: boolean }> = ({ 
    forma21Id, 
    nombreEquipo, 
    onClose,
    adminMode = false 
}) => {
    const [jugadores, setJugadores] = useState<Player[]>([]);
    const [staff, setStaff] = useState<Staff>({ entrenador: 'No registrado', asistente: 'No registrado' });
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            // 1. Cargar Staff
            const docRef = doc(db, 'forma21s', forma21Id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStaff({
                    entrenador: data.entrenador || 'No registrado',
                    asistente: data.asistente || 'No registrado'
                });
            }

            // 2. Cargar Jugadores
            const colRef = collection(db, 'forma21s', forma21Id, 'jugadores');
            const snap = await getDocs(colRef);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            
            list.sort((a, b) => a.numero - b.numero);
            setJugadores(list);
        } catch (error) {
            console.error("Error cargando roster:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [forma21Id]);

    // --- ELIMINAR JUGADOR (DEFINITIVO) ---
    const handleDeletePlayer = async (playerId: string, nombreJugador: string) => {
        if (!window.confirm(`⚠️ ¿Eliminar a ${nombreJugador} del equipo DEFINITIVAMENTE?\nEsta acción es irreversible.`)) return;

        try {
            await deleteDoc(doc(db, 'forma21s', forma21Id, 'jugadores', playerId));
            setJugadores(prev => prev.filter(p => p.id !== playerId));
            alert("✅ Jugador eliminado.");
        } catch (error) {
            console.error(error);
            alert("Error al eliminar.");
        }
    };

    // --- SUSPENDER JUGADOR (TEMPORAL) ---
    const toggleSuspension = async (player: Player) => {
        const nuevoEstado = !player.suspendido;
        const accion = nuevoEstado ? "SUSPENDER" : "HABILITAR";
        
        if (!window.confirm(`¿Estás seguro de ${accion} a ${player.nombre}?`)) return;

        try {
            await updateDoc(doc(db, 'forma21s', forma21Id, 'jugadores', player.id), {
                suspendido: nuevoEstado
            });
            
            // Actualizar estado local
            setJugadores(prev => prev.map(p => p.id === player.id ? { ...p, suspendido: nuevoEstado } : p));
            alert(`Jugador ${nuevoEstado ? 'suspendido' : 'habilitado'}.`);
        } catch (error) {
            console.error(error);
            alert("Error al actualizar estatus.");
        }
    };

    return (
        <div style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', 
            display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000
        }}>
            <div className="animate-fade-in" style={{
                background:'white', width:'95%', maxWidth:'900px', maxHeight:'90vh', 
                borderRadius:'12px', display:'flex', flexDirection:'column', overflow:'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                
                {/* HEADER */}
                <div style={{padding:'15px 20px', background:'#1e3a8a', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                        <h3 style={{margin:0, fontSize:'1.1rem'}}>📋 Roster Oficial (Admin)</h3>
                        <div style={{fontSize:'0.85rem', opacity:0.9}}>{nombreEquipo}</div>
                    </div>
                    <button onClick={onClose} className="btn btn-secondary" style={{padding:'6px 12px', fontSize:'0.85rem'}}>Cerrar</button>
                </div>

                <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                    {loading ? <div style={{textAlign:'center'}}>Cargando...</div> : (
                        <>
                            {/* TABLA DE JUGADORES */}
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                                <thead style={{background:'#f9fafb', borderBottom:'2px solid #e5e7eb'}}>
                                    <tr>
                                        <th style={{padding:'10px', textAlign:'center'}}>#</th>
                                        <th style={{padding:'10px', textAlign:'left'}}>Nombre</th>
                                        <th style={{padding:'10px', textAlign:'center'}}>Estatus</th>
                                        {/* Columna visible solo si es Admin */}
                                        {adminMode && <th style={{padding:'10px', textAlign:'center', background:'#fef3c7', color:'#92400e'}}>ACCIONES ADMIN</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {jugadores.map((j) => (
                                        <tr key={j.id} style={{borderBottom:'1px solid #eee', background: j.suspendido ? '#fef2f2' : 'white'}}>
                                            
                                            {/* NÚMERO */}
                                            <td style={{padding:'10px', textAlign:'center', fontWeight:'bold'}}>{j.numero}</td>
                                            
                                            {/* NOMBRE */}
                                            <td style={{padding:'10px', fontWeight:'bold', color: j.suspendido ? '#991b1b' : 'inherit'}}>
                                                {j.nombre}
                                                {j.suspendido && <span style={{fontSize:'0.7rem', color:'red', display:'block', fontWeight:'bold'}}>⛔ SANCIONADO</span>}
                                            </td>

                                            {/* ESTATUS VISUAL */}
                                            <td style={{padding:'10px', textAlign:'center'}}>
                                                {j.suspendido ? 
                                                    <span style={{background:'#fee2e2', color:'#991b1b', padding:'4px 8px', borderRadius:'10px', fontSize:'0.75rem', fontWeight:'bold'}}>SUSPENDIDO</span> : 
                                                    <span style={{background:'#dcfce7', color:'#166534', padding:'4px 8px', borderRadius:'10px', fontSize:'0.75rem', fontWeight:'bold'}}>ACTIVO</span>
                                                }
                                            </td>
                                            
                                            {/* BOTONES DE ADMINISTRADOR */}
                                            {adminMode && (
                                                <td style={{padding:'10px', textAlign:'center', background:'#fffbeb'}}>
                                                    <div style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                                                        
                                                        {/* BOTON SUSPENDER / HABILITAR */}
                                                        <button 
                                                            onClick={() => toggleSuspension(j)}
                                                            style={{
                                                                background: j.suspendido ? '#10b981' : '#f59e0b',
                                                                color:'white', border:'none', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'0.8rem', fontWeight:'bold'
                                                            }}
                                                        >
                                                            {j.suspendido ? 'Habilitar' : 'Suspender'}
                                                        </button>

                                                        {/* BOTON ELIMINAR */}
                                                        <button 
                                                            onClick={() => handleDeletePlayer(j.id, j.nombre)}
                                                            style={{
                                                                background:'#ef4444', color:'white', border:'none', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'0.8rem'
                                                            }}
                                                            title="Eliminar Jugador"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {jugadores.length === 0 && <div style={{textAlign:'center', padding:'20px', color:'#999'}}>Sin jugadores registrados.</div>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
export default RosterViewer;