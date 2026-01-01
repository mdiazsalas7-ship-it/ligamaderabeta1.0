import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore'; 

// 1. AGREGAMOS LOS CAMPOS NUEVOS A LA INTERFAZ
interface Player { 
    id: string; 
    numero: number; 
    nombre: string; 
    cedula?: string;   // Nuevo
    telefono?: string; // Nuevo
    suspendido?: boolean;
}

interface Staff { entrenador: string; asistente: string; }

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
            // Cargar Staff
            const docRef = doc(db, 'forma21s', forma21Id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStaff({
                    entrenador: data.entrenador || 'No registrado',
                    asistente: data.asistente || 'No registrado'
                });
            }

            // Cargar Jugadores
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

    // --- ACCIÓN ADMIN: ELIMINAR ---
    const handleDeletePlayer = async (playerId: string, nombreJugador: string) => {
        if (!window.confirm(`⚠️ ¿Eliminar a ${nombreJugador} del equipo DEFINITIVAMENTE?`)) return;

        try {
            await deleteDoc(doc(db, 'forma21s', forma21Id, 'jugadores', playerId));
            setJugadores(prev => prev.filter(p => p.id !== playerId));
            alert("✅ Jugador eliminado.");
        } catch (error) {
            console.error(error);
            alert("Error al eliminar.");
        }
    };

    // --- ACCIÓN ADMIN: SUSPENDER ---
    const toggleSuspension = async (player: Player) => {
        const nuevoEstado = !player.suspendido;
        const accion = nuevoEstado ? "SUSPENDER" : "HABILITAR";
        
        if (!window.confirm(`¿Estás seguro de ${accion} a ${player.nombre}?`)) return;

        try {
            await updateDoc(doc(db, 'forma21s', forma21Id, 'jugadores', player.id), {
                suspendido: nuevoEstado
            });
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
                        <h3 style={{margin:0, fontSize:'1.1rem'}}>📋 Roster Oficial</h3>
                        <div style={{fontSize:'0.85rem', opacity:0.9}}>Equipo: {nombreEquipo}</div>
                    </div>
                    <button onClick={onClose} className="btn btn-secondary" style={{padding:'6px 12px', fontSize:'0.85rem'}}>Cerrar</button>
                </div>

                {/* INFO STAFF */}
                <div style={{padding:'15px', background:'#f1f5f9', borderBottom:'1px solid #e2e8f0', display:'flex', gap:'20px', fontSize:'0.9rem'}}>
                    <div><strong>DT:</strong> {staff.entrenador}</div>
                    <div><strong>AT:</strong> {staff.asistente}</div>
                </div>

                {/* LISTA DE JUGADORES */}
                <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                    {loading ? <div style={{textAlign:'center'}}>Cargando...</div> : (
                        <>
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                                <thead style={{background:'#f8fafc', borderBottom:'2px solid #e2e8f0'}}>
                                    <tr>
                                        <th style={{padding:'10px', textAlign:'center', width:'50px'}}>#</th>
                                        <th style={{padding:'10px', textAlign:'left'}}>Datos del Jugador</th>
                                        <th style={{padding:'10px', textAlign:'center'}}>Estatus</th>
                                        {adminMode && <th style={{padding:'10px', textAlign:'center', background:'#fff7ed', color:'#c2410c'}}>ACCIONES</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {jugadores.map((j) => (
                                        <tr key={j.id} style={{borderBottom:'1px solid #eee', background: j.suspendido ? '#fef2f2' : 'white'}}>
                                            
                                            {/* NÚMERO */}
                                            <td style={{padding:'10px', textAlign:'center', fontWeight:'bold', color: '#1e3a8a', fontSize:'1.1rem'}}>{j.numero}</td>
                                            
                                            {/* NOMBRE + CÉDULA + TELÉFONO */}
                                            <td style={{padding:'10px'}}>
                                                <div style={{fontWeight:'bold', color: j.suspendido ? '#991b1b' : '#1f2937'}}>
                                                    {j.nombre}
                                                </div>
                                                {/* Aquí mostramos los datos extra */}
                                                <div style={{fontSize:'0.75rem', color:'#6b7280', marginTop:'2px'}}>
                                                    🪪 {j.cedula || 'S/I'} &nbsp;|&nbsp; 📞 {j.telefono || 'S/I'}
                                                </div>
                                                {j.suspendido && <div style={{fontSize:'0.7rem', color:'#dc2626', fontWeight:'bold', marginTop:'2px'}}>⛔ SANCIONADO</div>}
                                            </td>

                                            {/* ESTATUS VISUAL */}
                                            <td style={{padding:'10px', textAlign:'center'}}>
                                                {j.suspendido ? 
                                                    <span style={{background:'#fee2e2', color:'#991b1b', padding:'4px 8px', borderRadius:'10px', fontSize:'0.7rem', fontWeight:'bold', border:'1px solid #fca5a5'}}>SUSPENDIDO</span> : 
                                                    <span style={{background:'#dcfce7', color:'#166534', padding:'4px 8px', borderRadius:'10px', fontSize:'0.7rem', fontWeight:'bold'}}>HABILITADO</span>
                                                }
                                            </td>
                                            
                                            {/* BOTONES ADMIN */}
                                            {adminMode && (
                                                <td style={{padding:'10px', textAlign:'center', background:'#fffbeb'}}>
                                                    <div style={{display:'flex', gap:'5px', justifyContent:'center'}}>
                                                        <button 
                                                            onClick={() => toggleSuspension(j)}
                                                            style={{
                                                                background: j.suspendido ? '#22c55e' : '#f59e0b', 
                                                                color:'white', border:'none', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold'
                                                            }}
                                                            title={j.suspendido ? "Levantar sanción" : "Sancionar jugador"}
                                                        >
                                                            {j.suspendido ? '✔️' : '⛔'}
                                                        </button>

                                                        <button 
                                                            onClick={() => handleDeletePlayer(j.id, j.nombre)}
                                                            style={{
                                                                background:'#ef4444', color:'white', border:'none', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold'
                                                            }}
                                                            title="Eliminar definitivamente"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {jugadores.length === 0 && <div style={{textAlign:'center', padding:'30px', color:'#999', fontStyle:'italic'}}>No hay jugadores registrados en este equipo.</div>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
export default RosterViewer;