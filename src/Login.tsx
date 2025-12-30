import React, { useState } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const Login: React.FC = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegistering) {
                // --- REGISTRO NUEVO ---
                // 1. Crear usuario en Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Crear perfil BASE en Firestore (SIN ROL NI EQUIPO AÚN)
                // Esto disparará la pantalla de selección en App.tsx
                await setDoc(doc(db, 'usuarios', user.uid), {
                    email: user.email,
                    rol: 'pendiente', // <--- CLAVE: Entra como pendiente
                    createdAt: new Date()
                });
            } else {
                // --- INICIAR SESIÓN ---
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Este correo ya está registrado.');
            } else if (err.code === 'auth/wrong-password') {
                setError('Contraseña incorrecta.');
            } else if (err.code === 'auth/user-not-found') {
                setError('Usuario no encontrado.');
            } else {
                setError('Error al conectar. Verifica tus datos.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            height: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #111827 100%)',
            padding: '20px'
        }}>
            <div className="animate-fade-in" style={{
                background: 'white', padding: '40px', borderRadius: '16px', 
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px'
            }}>
                <div style={{textAlign: 'center', marginBottom: '30px'}}>
                    <img 
                        src="https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg" 
                        alt="Logo" 
                        style={{width: '80px', borderRadius: '10px', marginBottom: '15px'}} 
                    />
                    <h2 style={{color: '#1f2937', margin: '0 0 5px 0'}}>Liga Madera 15</h2>
                    <p style={{color: '#6b7280', fontSize: '0.9rem'}}>
                        {isRegistering ? 'Crea tu cuenta para comenzar' : 'Inicia sesión en tu cuenta'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2', color: '#991b1b', padding: '10px', 
                        borderRadius: '6px', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <div>
                        <label style={{display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', marginBottom: '5px'}}>
                            Correo Electrónico
                        </label>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem'}}
                            placeholder="ejemplo@correo.com"
                        />
                    </div>

                    <div>
                        <label style={{display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', marginBottom: '5px'}}>
                            Contraseña
                        </label>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem'}}
                            placeholder="******"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn"
                        style={{
                            background: '#2563eb', color: 'white', padding: '12px', borderRadius: '8px', 
                            fontSize: '1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '10px'
                        }}
                    >
                        {loading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Entrar')}
                    </button>
                </form>

                <div style={{textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: '#666'}}>
                    {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                    <button 
                        onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                        style={{
                            background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', 
                            cursor: 'pointer', marginLeft: '5px', textDecoration: 'underline'
                        }}
                    >
                        {isRegistering ? 'Inicia Sesión' : 'Regístrate aquí'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;