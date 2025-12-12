import React, { useState } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';

const RegistroForma21: React.FC<{ onSuccess: () => void; onClose?: () => void }> = ({ onSuccess, onClose }) => {
    const [nombre, setNombre] = useState('');
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        try {
            const equipoRef = await addDoc(collection(db, 'equipos'), { nombre, victorias: 0, derrotas: 0, puntos_favor: 0, puntos_contra: 0 });
            await setDoc(doc(collection(db, 'forma21s'), equipoRef.id), { nombreEquipo: nombre, delegadoId: auth.currentUser.uid, delegadoEmail: auth.currentUser.email, equipoId: equipoRef.id, fechaRegistro: new Date(), aprobado: false });
            await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { equipoId: equipoRef.id });
            alert('✅ Equipo registrado.'); onSuccess();
        } catch (e) { alert("Error."); }
    };

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '30px' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)'}}>📝 Nuevo Equipo</h2>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}
            </div>
            <form onSubmit={handleSubmit}>
                <label>Nombre del Equipo</label>
                <input type="text" value={nombre} onChange={e=>setNombre(e.target.value)} required placeholder="Ej: Los Toros" />
                <button type="submit" className="btn btn-success" style={{width:'100%', marginTop:'10px'}}>Registrar y Continuar</button>
            </form>
        </div>
    );
};
export default RegistroForma21;