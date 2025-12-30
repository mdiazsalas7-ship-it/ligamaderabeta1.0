import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, setDoc, doc } from 'firebase/firestore';

const RegistroForma21: React.FC<{ onSuccess: () => void, onClose: () => void }> = ({ onSuccess, onClose }) => {
    
    // Solo pedimos datos del EQUIPO y DELEGADO, no de la cuenta
    const [nombreEquipo, setNombreEquipo] = useState('');
    const [nombreDelegado, setNombreDelegado] = useState('');
    const [telefono, setTelefono] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [equiposExistentes, setEquiposExistentes] = useState<string[]>([]);

    // 1. Cargar nombres de equipos existentes para evitar duplicados
    useEffect(() => {
        const fetchEquipos = async () => {
            const q = query(collection(db, 'forma21s'));
            const snap = await getDocs(q);
            const nombres = snap.docs.map(d => d.data().nombreEquipo.toLowerCase().trim());
            setEquiposExistentes(nombres);
        };
        fetchEquipos();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!nombreEquipo.trim() || !nombreDelegado.trim() || !telefono.trim()) {
            setError('Todos los campos son obligatorios.');
            setLoading(false);
            return;
        }

        // VALIDACIÓN: El equipo ya existe
        if (equiposExistentes.includes(nombreEquipo.toLowerCase().trim())) {
            setError(`El equipo "${nombreEquipo}" ya está registrado. Por favor elige otro nombre.`);
            setLoading(false);
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No hay usuario autenticado.");

            // GUARDAR DATOS DEL EQUIPO (FORMA 21)
            // Usamos el UID del usuario como ID del documento para facilitar la relación 1 a 1
            const equipoId = user.uid; 

            // 1. Crear documento en 'forma21s'
            await setDoc(doc(db, 'forma21s', equipoId), {
                delegadoId: user.uid,
                delegadoEmail: user.email,
                nombreDelegado: nombreDelegado,
                telefono: telefono,
                nombreEquipo: nombreEquipo.trim(), // Importante el trim
                logoUrl: "", // Se gestiona después en el Dashboard
                fechaRegistro: serverTimestamp(),
                estatus: 'pendiente', // Esperando aprobación del admin
                aprobado: false,
                rosterCompleto: false
            });

            // 2. Crear documento placeholder en 'equipos' (Tabla de Posiciones)
            // Se crea inactivo hasta que el admin apruebe, pero reservamos el nombre
            await setDoc(doc(db, 'equipos', equipoId), {
                nombre: nombreEquipo.trim(),
                victorias: 0,
                derrotas: 0,
                puntos: 0,
                puntos_favor: 0,
                puntos_contra: 0,
                logoUrl: "",
                estatus: 'pendiente'
            });

            onSuccess(); // Esto recargará la App y cambiará el rol a 'delegado'

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al registrar el equipo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', 
            display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000
        }}>
            <div className="animate-fade-in" style={{
                background:'white', padding:'30px', borderRadius:'12px', width:'90%', maxWidth:'400px',
                boxShadow:'0 10px 25px rgba(0,0,0,0.2)'
            }}>
                <h2 style={{color:'#1f2937', textAlign:'center', marginBottom:'10px'}}>📋 Registro de Equipo</h2>
                <p style={{textAlign:'center', color:'#666', fontSize:'0.9rem', marginBottom:'20px'}}>
                    Completa los datos de tu equipo para la Liga Madera 15.
                </p>

                {error && <div style={{background:'#fee2e2', color:'#991b1b', padding:'10px', borderRadius:'6px', marginBottom:'15px', fontSize:'0.9rem'}}>{error}</div>}

                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    
                    <div>
                        <label style={{display:'block', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>Nombre del Equipo:</label>
                        <input 
                            type="text" 
                            value={nombreEquipo}
                            onChange={(e) => setNombreEquipo(e.target.value)}
                            placeholder="Ej. Los Toros"
                            style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px'}}
                        />
                    </div>

                    <div>
                        <label style={{display:'block', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>Nombre del Delegado:</label>
                        <input 
                            type="text" 
                            value={nombreDelegado}
                            onChange={(e) => setNombreDelegado(e.target.value)}
                            placeholder="Tu nombre completo"
                            style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px'}}
                        />
                    </div>

                    <div>
                        <label style={{display:'block', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'5px'}}>Teléfono / WhatsApp:</label>
                        <input 
                            type="tel" 
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            placeholder="0414-1234567"
                            style={{width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px'}}
                        />
                    </div>

                    <div style={{marginTop:'10px', display:'flex', gap:'10px'}}>
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{flex:1}}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={loading}
                            style={{flex:1}}
                        >
                            {loading ? 'Guardando...' : 'Crear Equipo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegistroForma21;