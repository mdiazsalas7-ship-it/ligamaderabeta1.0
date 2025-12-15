import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';

interface Player { id: string; nombre: string; numero: number; }

const RosterForm: React.FC<{ forma21Id: string, nombreEquipo: string, onSuccess: () => void, onClose: () => void }> = ({ forma21Id, nombreEquipo, onSuccess, onClose }) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [nombre, setNombre] = useState('');
    const [numero, setNumero] = useState('');
    
    // CAMPOS PARA STAFF
    const [entrenador, setEntrenador] = useState('');
    const [asistente, setAsistente] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            // 1. Cargar Jugadores
            const colRef = collection(db, 'forma21s', forma21Id, 'jugadores');
            const snap = await getDocs(colRef);
            setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));

            // 2. Cargar Staff existente
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

    // --- FUNCIÓN CLAVE: INVALIDAR APROBACIÓN ---
    // Si editan algo, el equipo vuelve a ser "pendiente" para que el Admin lo revise
    const notifyChangeToAdmin = async () => {
        const docRef = doc(db, 'forma21s', forma21Id);
        await updateDoc(docRef, {
            estatus: 'pendiente',
            aprobado: false,
            rosterCerrado: false 
        });
    };

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre || !numero) return;
        
        await addDoc(collection(db, 'forma21s', forma21Id, 'jugadores'), { 
            nombre: nombre.toUpperCase(), 
            numero: parseInt(numero),
            equipoId: forma21Id 
        });

        // 🔔 Notificar cambio al admin
        await notifyChangeToAdmin();

        setNombre(''); setNumero('');
        // Recargar lista
        const colRef = collection(db, 'forma21s', forma21Id, 'jugadores');
        const snap = await getDocs(colRef);
        setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar jugador? El equipo volverá a estatus PENDIENTE para revisión.")) return;
        
        await deleteDoc(doc(db, 'forma21s', forma21Id, 'jugadores', id));
        
        // 🔔 Notificar cambio al admin
        await notifyChangeToAdmin();

        setPlayers(prev => prev.filter(p => p.id !== id));
    };

    const handleSaveStaff = async () => {
        await updateDoc(doc(db, 'forma21s', forma21Id), {
            entrenador: entrenador.toUpperCase(),
            asistente: asistente.toUpperCase()
        });

        // 🔔 Notificar cambio al admin
        await notifyChangeToAdmin();

        alert("✅ Cuerpo Técnico actualizado. Tu equipo ha pasado a estatus PENDIENTE para revisión del Admin.");
    };

    return (
        <div className="animate-fade-in" style={{background:'white', padding:'20px', borderRadius:'10px', maxWidth:'600px', margin:'20px auto', maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)', margin:0}}>Inscribir Roster: {nombreEquipo}</h2>
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
                        <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Entrenador Principal:</label>
                        <input className="input" value={entrenador} onChange={e=>setEntrenador(e.target.value)} placeholder="Nombre y Apellido" />
                    </div>
                    <div>
                        <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Asistente:</label>
                        <input className="input" value={asistente} onChange={e=>setAsistente(e.target.value)} placeholder="Nombre y Apellido" />
                    </div>
                </div>
                <button onClick={handleSaveStaff} className="btn btn-secondary" style={{marginTop:'10px', width:'100%', fontSize:'0.8rem'}}>💾 Guardar Staff</button>
            </div>

            {/* SECCIÓN JUGADORES */}
            <h4 style={{margin:'0 0 10px 0'}}>🏃 Jugadores ({players.length}/15)</h4>
            <form onSubmit={handleAddPlayer} style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input className="input" style={{width:'60px'}} type="number" placeholder="#" value={numero} onChange={e=>setNumero(e.target.value)} required />
                <input className="input" style={{flex:1}} type="text" placeholder="Nombre del Jugador" value={nombre} onChange={e=>setNombre(e.target.value)} required />
                <button type="submit" className="btn btn-primary" disabled={players.length >= 15}>+</button>
            </form>

            <div style={{display:'grid', gap:'8px'}}>
                {players.sort((a,b)=>a.numero - b.numero).map(p => (
                    <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'8px', background:'#f8f9fa', borderBottom:'1px solid #eee'}}>
                        <strong>#{p.numero} - {p.nombre}</strong>
                        <button onClick={()=>handleDelete(p.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>Eliminar</button>
                    </div>
                ))}
            </div>

            <div style={{marginTop:'20px', textAlign:'right'}}>
                <button onClick={onSuccess} className="btn btn-primary">Terminar y Salir</button>
            </div>
        </div>
    );
};
export default RosterForm;