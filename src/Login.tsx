// src/Login.tsx (SISTEMA DE REGISTRO CON ROLES: FAN, JUGADOR, DELEGADO)

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, addDoc } from 'firebase/firestore'; 

const Login: React.FC = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    // Estados para el registro detallado
    const [role, setRole] = useState<'fan' | 'jugador' | 'delegado'>('fan');
    const [teams, setTeams] = useState<{id: string, nombre: string}[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [loading, setLoading] = useState(false);

    // Cargar equipos al iniciar para el selector
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const snap = await getDocs(collection(db, 'equipos'));
                setTeams(snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre })));
            } catch (e) { console.error("Error cargando equipos", e); }
        };
        if (isRegistering) fetchTeams();
    }, [isRegistering]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setError(null); setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError("Credenciales incorrectas o usuario no encontrado.");
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault(); setError(null); setLoading(true);

        try {
            // 1. Crear usuario en Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            // 2. Preparar datos base
            let userData: any = { email, rol: role }; // Fan y Jugador entran directo con su rol

            // 3. Lógica según Rol
            if (role === 'fan') {
                // Fan: Solo guardamos su equipo favorito si eligió uno
                if (selectedTeamId) userData.equipoFavoritoId = selectedTeamId;
            
            } else if (role === 'jugador') {
                // Jugador: DEBE seleccionar equipo (o quedar libre)
                if (selectedTeamId) userData.equipoId = selectedTeamId;
                else { throw new Error("Debes seleccionar a qué equipo perteneces."); }
            
            } else if (role === 'delegado') {
                // Delegado: Queda PENDIENTE de aprobación
                userData.rol = 'pendiente'; 
                userData.rolSolicitado = 'delegado'; // Para que el admin sepa qué quería ser

                if (selectedTeamId) {
                    // Quiere ser delegado de equipo existente
                    userData.solicitudEquipoId = selectedTeamId;
                } else if (newTeamName.trim().length > 0) {
                    // Quiere registrar equipo nuevo
                    // Creamos el equipo de una vez para reservar el nombre, pero la forma 21 queda pendiente
                    const equipoRef = await addDoc(collection(db, 'equipos'), { 
                        nombre: newTeamName, victorias: 0, derrotas: 0, puntos_favor: 0, puntos_contra: 0 
                    });
                    
                    // Creamos la Forma 21 inicial
                    await setDoc(doc(collection(db, 'forma21s'), equipoRef.id), {
                        nombreEquipo: newTeamName,
                        delegadoId: uid,
                        delegadoEmail: email,
                        equipoId: equipoRef.id,
                        fechaRegistro: new Date(),
                        aprobado: false, // Importante: Requiere aprobación Admin
                        rosterCompleto: false
                    });

                    userData.equipoId = equipoRef.id; // Lo asociamos preliminarmente
                } else {
                    throw new Error("Selecciona un equipo o escribe el nombre del nuevo.");
                }
            }

            // 4. Guardar en Firestore
            await setDoc(doc(db, 'usuarios', uid), userData);
            
            // Si no es delegado, entra directo. Si es delegado, el App.tsx mostrará pantalla de pendiente.
            setLoading(false);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al registrar.");
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-box animate-fade-in">
                <img src="https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg" alt="Logo" style={{ width: '90px', height: '90px', borderRadius: '20px', marginBottom: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                
                <h2 style={{fontSize: '1.5rem', marginBottom: '5px'}}>
                    {isRegistering ? 'Únete a la Liga' : 'Bienvenido'}
                </h2>
                <p style={{color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem'}}>Liga de Baloncesto Madera 15</p>
                
                {error && <div className="badge badge-danger" style={{display:'block', marginBottom:'15px', padding:'10px'}}>{error}</div>}

                <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{textAlign: 'left'}}>
                    <div style={{marginBottom: '15px'}}>
                        <label>Email</label>
                        <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div style={{marginBottom: '15px'}}>
                        <label>Contraseña</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>

                    {/* CAMPOS EXTRA SOLO PARA REGISTRO */}
                    {isRegistering && (
                        <div className="animate-fade-in" style={{padding: '15px', background: '#f9fafb', borderRadius: '10px', marginBottom: '15px', border: '1px solid var(--border)'}}>
                            <label>Quiero registrarme como:</label>
                            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                                <button type="button" onClick={() => setRole('fan')} className={`btn ${role==='fan'?'btn-primary':'btn-secondary'}`} style={{flex:1, fontSize:'0.8rem'}}>Fan 🏀</button>
                                <button type="button" onClick={() => setRole('jugador')} className={`btn ${role==='jugador'?'btn-primary':'btn-secondary'}`} style={{flex:1, fontSize:'0.8rem'}}>Jugador ⛹️</button>
                                <button type="button" onClick={() => setRole('delegado')} className={`btn ${role==='delegado'?'btn-primary':'btn-secondary'}`} style={{flex:1, fontSize:'0.8rem'}}>Delegado 📋</button>
                            </div>

                            {role === 'fan' && (
                                <div>
                                    <label>Equipo Favorito (Opcional)</label>
                                    <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                                        <option value="">-- Sin favorito --</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                </div>
                            )}

                            {role === 'jugador' && (
                                <div>
                                    <label>¿A qué equipo perteneces?</label>
                                    <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} required>
                                        <option value="">-- Selecciona tu equipo --</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                    </select>
                                </div>
                            )}

                            {role === 'delegado' && (
                                <div>
                                    <label>Gestionar Equipo</label>
                                    <select 
                                        value={selectedTeamId} 
                                        onChange={(e) => { setSelectedTeamId(e.target.value); setNewTeamName(''); }} 
                                        style={{marginBottom: '10px'}}
                                    >
                                        <option value="">-- Crear Equipo Nuevo --</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>Ya existe: {t.nombre}</option>)}
                                    </select>
                                    
                                    {!selectedTeamId && (
                                        <input 
                                            type="text" 
                                            placeholder="Nombre del Nuevo Equipo" 
                                            value={newTeamName} 
                                            onChange={(e) => setNewTeamName(e.target.value)} 
                                            style={{borderColor: 'var(--accent)'}}
                                        />
                                    )}
                                    <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px'}}>
                                        * Los delegados requieren aprobación del Admin.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{width: '100%', padding: '12px'}} disabled={loading}>
                        {loading ? 'Procesando...' : (isRegistering ? 'Crear Cuenta' : 'Ingresar')}
                    </button>
                </form>
                
                <div style={{marginTop: '20px', fontSize: '0.9rem'}}>
                    <span style={{color: 'var(--text-muted)'}}>
                        {isRegistering ? '¿Ya tienes cuenta?' : '¿Eres nuevo?'}
                    </span>
                    <button 
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); }} 
                        style={{background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px'}}
                    >
                        {isRegistering ? 'Inicia Sesión' : 'Regístrate aquí'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;