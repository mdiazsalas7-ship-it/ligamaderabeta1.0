import React, { useState } from 'react';
import { db, auth } from './firebase'; 
import { collection, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';

const RegistroForma21: React.FC<{ onSuccess: () => void, onClose: () => void }> = ({ onSuccess, onClose }) => {
    const user = auth.currentUser;
    const [nombreEquipo, setNombreEquipo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) {
            setError("No hay sesión activa. Recarga la página.");
            return;
        }

        if (!nombreEquipo.trim()) {
            setError('El nombre del equipo no puede estar vacío.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const userId = user.uid;
            
            // 1. Crear Forma 21
            const forma21Ref = collection(db, 'forma21s');
            const newForma21 = await addDoc(forma21Ref, {
                delegadoId: userId,
                delegadoEmail: user.email,
                nombreEquipo: nombreEquipo.trim(),
                fechaRegistro: new Date(),
                estatus: 'pendiente', 
                aprobado: false,
                rosterCerrado: false 
            });

            // 2. Crear Equipo Oficial (pendiente)
            const equipoRef = doc(db, 'equipos', newForma21.id);
            await setDoc(equipoRef, {
                nombre: nombreEquipo.trim(),
                forma21Id: newForma21.id,
                estatus: 'pendiente',
                victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0,
            });

            // 3. Actualizar Usuario al final
            // Esto dispara el cambio de pantalla en App.tsx automáticamente
            const userRef = doc(db, 'usuarios', userId);
            await updateDoc(userRef, {
                equipoId: newForma21.id,
                rol: 'delegado' 
            });

            alert(`✅ ¡Equipo ${nombreEquipo} registrado!`);
            
            // NO HACEMOS RELOAD. Dejamos que App.tsx detecte el cambio.
            onSuccess(); 

        } catch (err) {
            console.error(err);
            setError('Error al registrar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // ... (El resto del return sigue igual)
    return (
        <div className="animate-fade-in" style={{maxWidth:'450px', margin:'0 auto', padding:'30px', background:'white', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
            <h2 style={{color:'var(--primary)', borderBottom:'2px solid #eee', paddingBottom:'10px'}}>📝 Inscripción de Nuevo Equipo</h2>
            <p style={{color:'#6b7280', fontSize:'0.9rem'}}>Estás a punto de registrarte como delegado y crear un equipo para la liga.</p>

            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <div>
                    <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Tu Correo (Delegado):</label>
                    <input 
                        type="text" 
                        value={user?.email || ''} 
                        disabled 
                        style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px', background:'#f8f8f8'}}
                    />
                </div>
                <div>
                    <label htmlFor="nombreEquipo" style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Nombre del Equipo:</label>
                    <input 
                        id="nombreEquipo"
                        type="text"
                        value={nombreEquipo}
                        onChange={(e) => setNombreEquipo(e.target.value)}
                        required
                        placeholder="Ej: Los Invencibles de Morichal"
                        style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px'}}
                    />
                </div>
                
                {error && <p style={{color:'red', fontSize:'0.8rem', margin:'0'}}>{error}</p>}

                <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{flex:1}}>Cancelar</button>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{flex:1}}>
                        {loading ? 'Enviando...' : 'Enviar Solicitud'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroForma21;