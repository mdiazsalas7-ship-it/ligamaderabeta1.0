import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore'; 

// Interfaces
interface Player { 
    id: string; // Necesario para eliminar
    numero: number; 
    nombre: string; 
    posicion?: string; 
    fechaNacimiento?: string;
    estatura?: string;
    peso?: string;
}

interface Staff { entrenador: string; asistente: string; }

// Props: Agregamos adminMode
const RosterViewer: React.FC<{ forma21Id: string; nombreEquipo: string; onClose: () => void; adminMode?: boolean }> = ({ 
    forma21Id, 
    nombreEquipo, 
    onClose,
    adminMode = false 
}) => {
    const [jugadores, setJugadores] = useState<Player[]>([]);
    const [staff, setStaff] = useState<Staff>({ entrenador: 'No registrado', asistente: 'No registrado' });
    const [loading, setLoading] = useState(true);

    // CARGAR DATOS
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
            // IMPORTANTE: Guardar el ID del documento
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

    // FUNCIÓN ELIMINAR (SOLO ADMIN)
    const handleDeletePlayer = async (playerId: string, nombreJugador: string) => {
        if (!window.confirm(`⚠️ ¿Eliminar a ${nombreJugador} del equipo?\nEsta acción es inmediata.`)) return;

        try {
            await deleteDoc(doc(db, 'forma21s', forma21Id, 'jugadores', playerId));
            alert("✅ Jugador eliminado.");
            // Actualizar estado local para no recargar todo
            setJugadores(prev => prev.filter(p => p.id !== playerId));
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("Error al eliminar jugador.");
        }
    };

    return (
        <div style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', 
            display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000
        }}>
            <div className="animate-fade-in" style={{
                background:'white', width:'90%', maxWidth:'700px', maxHeight:'90vh', 
                borderRadius:'12px', display:'flex', flexDirection:'column', overflow:'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                
                {/* HEADER */}
                <div style={{padding:'20px', background:'#1e3a8a', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                        <h3 style={{margin:0, fontSize:'1.2rem'}}>📋 Roster Oficial</h3>
                        <div style={{fontSize:'0.9rem', opacity:0.9, fontWeight:'bold'}}>{nombreEquipo}</div>
                    </div>
                    <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)', border:'none', color:'white', padding:'8px 15px', borderRadius:'6px', cursor:'pointer'}}>
                        Cerrar ✕
                    </button>
                </div>

                <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                    
                    {loading ? <div style={{textAlign:'center', padding:'30px'}}>Cargando...</div> : (
                        <>
                            {/* SECCIÓN STAFF */}
                            <div style={{
                                background: '#eff6ff', border: '1px solid #bfdbfe', 
                                borderRadius: '8px', padding: '15px', marginBottom: '20px'
                            }}>
                                <h4 style={{margin:'0 0 10px 0', color:'#1e40af', fontSize:'0.9rem', textTransform:'uppercase'}}>👔 Cuerpo Técnico</h4>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                    <div>
                                        <div style={{fontSize:'0.7rem', color:'#6b7280', fontWeight:'bold'}}>DT / ENTRENADOR</div>
                                        <div style={{fontWeight:'bold', color:'#1f2937'}}>{staff.entrenador}</div>
                                    </div>
                                    <div>
                                        <div style={{fontSize:'0.7rem', color:'#6b7280', fontWeight:'bold'}}>ASISTENTE</div>
                                        <div style={{fontWeight:'bold', color:'#1f2937'}}>{staff.asistente}</div>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN JUGADORES */}
                            <h4 style={{margin:'0 0 10px 0', color:'#374151', borderBottom:'2px solid #eee', paddingBottom:'5px'}}>
                                🏃 Jugadores ({jugadores.length})
                            </h4>
                            
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.95rem'}}>
                                <thead style={{background:'#f9fafb', color:'#6b7280', fontSize:'0.8rem', textTransform:'uppercase'}}>
                                    <tr>
                                        <th style={{padding:'10px', textAlign:'center'}}>#</th>
                                        <th style={{padding:'10px', textAlign:'left'}}>Nombre</th>
                                        <th style={{padding:'10px', textAlign:'center'}}>Edad</th>
                                        <th style={{padding:'10px', textAlign:'center'}}>Datos</th>
                                        {adminMode && <th style={{padding:'10px', textAlign:'center'}}>Admin</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {jugadores.length === 0 ? (
                                        <tr><td colSpan={adminMode ? 5 : 4} style={{textAlign:'center', padding:'20px', color:'#999'}}>No hay jugadores registrados.</td></tr>
                                    ) : (
                                        jugadores.map((j) => (
                                            <tr key={j.id} style={{borderBottom:'1px solid #eee'}}>
                                                <td style={{padding:'10px', textAlign:'center', fontWeight:'bold', color:'#2563eb'}}>{j.numero}</td>
                                                <td style={{padding:'10px', fontWeight:'bold'}}>{j.nombre}</td>
                                                <td style={{padding:'10px', textAlign:'center', fontSize:'0.85rem'}}>{j.fechaNacimiento || '-'}</td>
                                                <td style={{padding:'10px', textAlign:'center', fontSize:'0.85rem', color:'#666'}}>
                                                    {j.estatura ? `${j.estatura}m` : ''} {j.peso ? `/ ${j.peso}kg` : ''}
                                                </td>
                                                {/* BOTÓN ELIMINAR SOLO ADMIN */}
                                                {adminMode && (
                                                    <td style={{padding:'10px', textAlign:'center'}}>
                                                        <button 
                                                            onClick={() => handleDeletePlayer(j.id, j.nombre)}
                                                            style={{
                                                                background:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5', 
                                                                borderRadius:'4px', cursor:'pointer', padding:'4px 8px', fontSize:'0.8rem'
                                                            }}
                                                            title="Eliminar Jugador"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
export default RosterViewer;