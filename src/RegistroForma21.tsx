import React, { useState } from 'react';
import { db, auth } from './firebase'; 
import { collection, addDoc, doc, updateDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import LogoUploader from './LogoUploader'; // <--- IMPORTANTE: Importamos el componente

const RegistroForma21: React.FC<{ onSuccess: () => void, onClose: () => void }> = ({ onSuccess, onClose }) => {
    const user = auth.currentUser;
    const [nombreEquipo, setNombreEquipo] = useState('');
    const [logoUrl, setLogoUrl] = useState(''); // Aquí se guardará la URL que nos devuelva el LogoUploader
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png"; 

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (loading) return; // Bloqueo anti doble click

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
            const nombreLimpio = nombreEquipo.trim();
            
            // 1. VALIDACIÓN ANTI-DUPLICADOS
            const qDuplicado = query(collection(db, 'equipos'), where('nombre', '==', nombreLimpio));
            const snapDuplicado = await getDocs(qDuplicado);

            if (!snapDuplicado.empty) {
                throw new Error("⚠️ Ya existe un equipo registrado con ese nombre. Por favor elige otro.");
            }

            // Usamos la URL que vino del Uploader o el default
            const finalLogoUrl = logoUrl || DEFAULT_LOGO;

            // 2. Crear Forma 21
            const forma21Ref = collection(db, 'forma21s');
            const newForma21 = await addDoc(forma21Ref, {
                delegadoId: userId,
                delegadoEmail: user.email,
                nombreEquipo: nombreLimpio,
                logoUrl: finalLogoUrl,
                fechaRegistro: new Date(),
                estatus: 'pendiente', 
                aprobado: false,
                rosterCerrado: false 
            });

            // 3. Crear Equipo Oficial con el MISMO ID
            const equipoRef = doc(db, 'equipos', newForma21.id);
            await setDoc(equipoRef, {
                nombre: nombreLimpio,
                forma21Id: newForma21.id,
                logoUrl: finalLogoUrl,
                estatus: 'pendiente',
                victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0,
            });

            // 4. Actualizar Usuario
            const userRef = doc(db, 'usuarios', userId);
            await updateDoc(userRef, {
                equipoId: newForma21.id,
                rol: 'delegado' 
            });

            alert(`✅ ¡Equipo ${nombreLimpio} registrado con éxito!`);
            onSuccess(); 

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al registrar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{maxWidth:'450px', margin:'0 auto', padding:'30px', background:'white', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
            <h2 style={{color:'var(--primary)', borderBottom:'2px solid #eee', paddingBottom:'10px', marginTop:0}}>📝 Inscripción de Nuevo Equipo</h2>
            <p style={{color:'#6b7280', fontSize:'0.9rem'}}>Completa los datos para registrarte como delegado.</p>

            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                
                {/* CAMBIO: Usamos LogoUploader en lugar del input de texto y la imagen estática */}
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <label style={{fontWeight:'bold', marginBottom:'10px'}}>Logo del Equipo:</label>
                    <LogoUploader 
                        onUploadSuccess={(url) => setLogoUrl(url)} 
                    />
                    <small style={{color:'#6b7280', fontSize:'0.75rem', marginTop:'5px'}}>
                        Toca la cámara para subir una imagen de tu galería
                    </small>
                </div>

                <div>
                    <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Tu Correo (Delegado):</label>
                    <input type="text" value={user?.email || ''} disabled style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px', background:'#f8f8f8'}} />
                </div>

                <div>
                    <label htmlFor="nombreEquipo" style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Nombre del Equipo:</label>
                    <input 
                        id="nombreEquipo"
                        type="text"
                        value={nombreEquipo}
                        onChange={(e) => setNombreEquipo(e.target.value)}
                        required
                        placeholder="Ej: Los Toros de Morichal"
                        style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px'}}
                    />
                </div>
                
                {error && <p style={{color:'red', fontSize:'0.85rem', margin:'0', padding:'10px', background:'#fee2e2', borderRadius:'4px', fontWeight:'bold'}}>{error}</p>}

                <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{flex:1}}>Cancelar</button>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{flex:1}}>
                        {loading ? 'Procesando...' : 'Registrar Equipo'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroForma21;