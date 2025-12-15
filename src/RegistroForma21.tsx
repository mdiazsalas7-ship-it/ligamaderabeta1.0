import React, { useState } from 'react';
import { db, auth } from './firebase'; 
import { collection, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';

const RegistroForma21: React.FC<{ onSuccess: () => void, onClose: () => void }> = ({ onSuccess, onClose }) => {
    const user = auth.currentUser;
    const [nombreEquipo, setNombreEquipo] = useState('');
    const [logoUrl, setLogoUrl] = useState(''); // Estado para el Logo
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // URL de un escudo genérico por si no ponen nada
    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png"; 

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
            
            // Usamos la URL ingresada o el defecto si está vacía
            const finalLogoUrl = logoUrl.trim() || DEFAULT_LOGO;

            // 1. Crear Forma 21
            const forma21Ref = collection(db, 'forma21s');
            const newForma21 = await addDoc(forma21Ref, {
                delegadoId: userId,
                delegadoEmail: user.email,
                nombreEquipo: nombreEquipo.trim(),
                logoUrl: finalLogoUrl, // Guardamos el logo
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
                logoUrl: finalLogoUrl, // Guardamos el logo aquí también
                estatus: 'pendiente',
                victorias: 0, derrotas: 0, puntos: 0, puntos_favor: 0, puntos_contra: 0,
            });

            // 3. Actualizar Usuario al final
            const userRef = doc(db, 'usuarios', userId);
            await updateDoc(userRef, {
                equipoId: newForma21.id,
                rol: 'delegado' 
            });

            alert(`✅ ¡Equipo ${nombreEquipo} registrado con éxito!`);
            onSuccess(); 

        } catch (err) {
            console.error(err);
            setError('Error al registrar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{maxWidth:'450px', margin:'0 auto', padding:'30px', background:'white', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
            <h2 style={{color:'var(--primary)', borderBottom:'2px solid #eee', paddingBottom:'10px', marginTop:0}}>📝 Inscripción de Nuevo Equipo</h2>
            <p style={{color:'#6b7280', fontSize:'0.9rem'}}>Completa los datos para registrarte como delegado.</p>

            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                
                {/* VISTA PREVIA DEL LOGO */}
                <div style={{display:'flex', justifyContent:'center', marginBottom:'10px'}}>
                    <div style={{
                        width:'100px', height:'100px', borderRadius:'50%', 
                        border:'4px solid #e5e7eb', overflow:'hidden', 
                        background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center'
                    }}>
                        <img 
                            src={logoUrl || DEFAULT_LOGO} 
                            alt="Logo Preview" 
                            style={{width:'100%', height:'100%', objectFit:'cover'}}
                            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_LOGO; }} // Si falla el link, pone el default
                        />
                    </div>
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

                <div>
                    <label htmlFor="logoUrl" style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>
                        Logo del Equipo (Link de Imagen):
                    </label>
                    <input 
                        id="logoUrl"
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="Pega aquí el link (https://...)"
                        style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px'}}
                    />
                    <small style={{color:'#6b7280', fontSize:'0.75rem'}}>
                        * Puedes copiar el link de una imagen de Google, Instagram o Facebook. Si lo dejas vacío, se usará uno genérico.
                    </small>
                </div>
                
                {error && <p style={{color:'red', fontSize:'0.8rem', margin:'0'}}>{error}</p>}

                <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{flex:1}}>Cancelar</button>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{flex:1}}>
                        {loading ? 'Registrar Equipo' : 'Registrar Equipo'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroForma21;