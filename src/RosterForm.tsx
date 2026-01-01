import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';

// 1. AGREGAMOS CÉDULA Y TELÉFONO A LA INTERFAZ
interface Player { id: string; nombre: string; numero: number; cedula: string; telefono: string; }

const RosterForm: React.FC<{ forma21Id: string, nombreEquipo: string, onSuccess: () => void, onClose: () => void }> = ({ forma21Id, nombreEquipo, onSuccess, onClose }) => {
    const [players, setPlayers] = useState<Player[]>([]);
    
    // 2. ESTADOS PARA LOS NUEVOS CAMPOS
    const [nombre, setNombre] = useState('');
    const [numero, setNumero] = useState('');
    const [cedula, setCedula] = useState(''); // Nuevo
    const [telefono, setTelefono] = useState(''); // Nuevo
    
    // CAMPOS PARA STAFF
    const [entrenador, setEntrenador] = useState('');
    const [asistente, setAsistente] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            // Cargar Jugadores
            const colRef = collection(db, 'forma21s', forma21Id, 'jugadores');
            const snap = await getDocs(colRef);
            setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));

            // Cargar Staff existente
            const docRef = doc(db, 'forma21s', forma21Id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.entrenador) setEntrenador(data.entrenador);
                if (data.asistente) setAsistente(data.asistente);
            }
        };
        fetchData();
    }, [forma21Id]);

    // --- TU LÓGICA ORIGINAL (NO SE TOCA) ---
    const notifyChangeToAdmin = async (playerCount: number) => {
        const docRef = doc(db, 'forma21s', forma21Id);
        await updateDoc(docRef, {
            estatus: 'pendiente', 
            aprobado: false,      
            rosterCompleto: playerCount >= 5 
        });
        
        try {
            await updateDoc(doc(db, 'equipos', forma21Id), { estatus: 'pendiente' });
        } catch (e) {
            // Ignorar si no existe en equipos
        }
    };

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        // 3. VALIDAMOS QUE NO ESTÉN VACÍOS
        if (!nombre || !numero || !cedula || !telefono) {
            alert("Todos los campos (Nombre, #, Cédula, Teléfono) son obligatorios.");
            return;
        }

        // VALIDACIÓN DE LÍMITE (TU LÓGICA)
        if (players.length >= 15) {
            alert("⚠️ Has alcanzado el límite máximo de 15 jugadores.");
            return;
        }
        
        setLoading(true);
        try {
            // 4. GUARDAMOS LOS NUEVOS DATOS EN FIREBASE
            await addDoc(collection(db, 'forma21s', forma21Id, 'jugadores'), { 
                nombre: nombre.toUpperCase(), 
                numero: parseInt(numero),
                cedula: cedula,       // Guardar cédula
                telefono: telefono,   // Guardar teléfono
                equipoId: forma21Id 
            });

            // Recargar lista localmente
            const newPlayers = [...players, { 
                id: 'temp', 
                nombre: nombre.toUpperCase(), 
                numero: parseInt(numero),
                cedula,
                telefono
            }];
            
            // 🔔 Notificar cambio (TU LÓGICA)
            await notifyChangeToAdmin(players.length + 1);

            // Limpiar inputs
            setNombre(''); setNumero(''); setCedula(''); setTelefono('');
            
            // Recargar real de DB
            const colRef = collection(db, 'forma21s', forma21Id, 'jugadores');
            const snap = await getDocs(colRef);
            setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
            
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar jugador? El equipo volverá a estatus PENDIENTE para revisión.")) return;
        
        try {
            await deleteDoc(doc(db, 'forma21s', forma21Id, 'jugadores', id));
            
            // 🔔 Notificar cambio (TU LÓGICA)
            await notifyChangeToAdmin(players.length - 1);

            setPlayers(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveStaff = async () => {
        if(!entrenador.trim()) { alert("El nombre del entrenador es obligatorio"); return; }
        
        setLoading(true);
        try {
            await updateDoc(doc(db, 'forma21s', forma21Id), {
                entrenador: entrenador.toUpperCase(),
                asistente: asistente.toUpperCase()
            });

            // 🔔 Notificar cambio (TU LÓGICA)
            await notifyChangeToAdmin(players.length);

            alert("✅ Cuerpo Técnico actualizado. Tu equipo ha pasado a estatus PENDIENTE para revisión del Admin.");
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000}}>
            <div className="animate-fade-in" style={{background:'white', padding:'20px', borderRadius:'10px', width:'90%', maxWidth:'700px', maxHeight:'90vh', overflowY:'auto'}}>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h2 style={{color:'#1f2937', margin:0}}>Inscribir Roster: {nombreEquipo}</h2>
                    <button onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>✕</button>
                </div>

                {/* AVISO DE CAMBIOS */}
                <div style={{
                    background: '#fff7ed', borderLeft: '4px solid #f97316', 
                    padding: '10px', marginBottom: '20px', fontSize: '0.85rem', color: '#9a3412'
                }}>
                    ⚠️ <strong>Aviso:</strong> Cualquier cambio (agregar jugador, borrar o editar staff) cambiará el estatus de tu equipo a <strong>"PENDIENTE"</strong>. El administrador deberá aprobar los cambios nuevamente.
                </div>

                {/* SECCIÓN CUERPO TÉCNICO */}
                <div style={{background:'#f0f9ff', padding:'15px', borderRadius:'8px', marginBottom:'20px', border:'1px solid #bae6fd'}}>
                    <h4 style={{margin:'0 0 10px 0', color:'#0369a1'}}>👔 Cuerpo Técnico</h4>
                    <div style={{display:'grid', gap:'10px', gridTemplateColumns:'1fr 1fr'}}>
                        <div>
                            <label style={{fontSize:'0.8rem', fontWeight:'bold', display:'block'}}>Entrenador Principal:</label>
                            <input style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} value={entrenador} onChange={e=>setEntrenador(e.target.value)} placeholder="Nombre y Apellido" />
                        </div>
                        <div>
                            <label style={{fontSize:'0.8rem', fontWeight:'bold', display:'block'}}>Asistente:</label>
                            <input style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} value={asistente} onChange={e=>setAsistente(e.target.value)} placeholder="Nombre y Apellido" />
                        </div>
                    </div>
                    <button onClick={handleSaveStaff} disabled={loading} className="btn btn-secondary" style={{marginTop:'10px', width:'100%', fontSize:'0.8rem'}}>
                        {loading ? 'Guardando...' : '💾 Guardar Staff'}
                    </button>
                </div>

                {/* SECCIÓN JUGADORES */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                    <h4 style={{margin:0}}>🏃 Jugadores ({players.length}/15)</h4>
                    <span style={{fontSize:'0.8rem', color: players.length >= 5 ? 'green' : 'red'}}>
                        {players.length >= 5 ? 'Min. Cumplido' : 'Faltan jugadores (Min 5)'}
                    </span>
                </div>

                {/* 5. FORMULARIO ACTUALIZADO CON NUEVOS CAMPOS */}
                <form onSubmit={handleAddPlayer} style={{background:'#f8f9fa', padding:'10px', borderRadius:'8px', marginBottom:'20px', border:'1px solid #e9ecef'}}>
                    <div style={{display:'grid', gridTemplateColumns:'0.5fr 1.5fr 1fr 1fr', gap:'8px', marginBottom:'8px'}}>
                        <input style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} type="number" placeholder="#" value={numero} onChange={e=>setNumero(e.target.value)} required />
                        <input style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} type="text" placeholder="Nombre Completo" value={nombre} onChange={e=>setNombre(e.target.value)} required />
                        {/* Inputs Nuevos */}
                        <input style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} type="text" placeholder="Cédula" value={cedula} onChange={e=>setCedula(e.target.value)} required />
                        <input style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} type="text" placeholder="Teléfono" value={telefono} onChange={e=>setTelefono(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={players.length >= 15 || loading}>
                        {loading ? 'Guardando...' : '+ AGREGAR JUGADOR A LA LISTA'}
                    </button>
                </form>

                {/* LISTA ACTUALIZADA */}
                <div style={{display:'grid', gap:'8px', maxHeight:'300px', overflowY:'auto'}}>
                    {players.sort((a,b)=>a.numero - b.numero).map(p => (
                        <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'8px', background:'white', borderBottom:'1px solid #eee', alignItems:'center', borderRadius:'4px', border:'1px solid #eee'}}>
                            <div>
                                <strong>#{p.numero} - {p.nombre}</strong>
                                <div style={{fontSize:'0.8rem', color:'#666'}}>ID: {p.cedula} | Tel: {p.telefono}</div>
                            </div>
                            <button onClick={()=>handleDelete(p.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer', fontWeight:'bold'}}>Eliminar</button>
                        </div>
                    ))}
                    {players.length === 0 && <div style={{textAlign:'center', color:'#999', padding:'10px'}}>No hay jugadores registrados.</div>}
                </div>

                <div style={{marginTop:'20px', textAlign:'right'}}>
                    <button onClick={onSuccess} className="btn btn-primary">Terminar y Salir</button>
                </div>
            </div>
        </div>
    );
};
export default RosterForm;