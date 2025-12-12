// src/Login.tsx
import React, { useState } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; 

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registerSuccess, setRegisterSuccess] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError("Credenciales incorrectas. Verifica tu email y contraseña.");
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setRegisterSuccess(false);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
                email: email,
                rol: 'pendiente'
            });
            setRegisterSuccess(true);
            setIsRegistering(false);
            setEmail(''); setPassword('');
        } catch (err: any) {
            setError("Error al registrar. El email ya existe o la contraseña es débil.");
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-box animate-fade-in">
                <img 
                    src="https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg" 
                    alt="Logo" 
                    style={{ width: '90px', height: '90px', borderRadius: '20px', marginBottom: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                />
                
                <h2 style={{fontSize: '1.5rem', marginBottom: '5px'}}>
                    {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
                </h2>
                <p style={{color: 'var(--text-muted)', marginBottom: '30px', fontSize: '0.9rem'}}>
                    Liga de Baloncesto Madera 15
                </p>
                
                {error && <div style={{background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem'}}>{error}</div>}
                {registerSuccess && <div style={{background: '#dcfce7', color: '#166534', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem'}}>Registro exitoso. Espera aprobación.</div>}

                <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{textAlign: 'left'}}>
                    <div style={{marginBottom: '15px'}}>
                        <label>Email</label>
                        <input type="email" placeholder="usuario@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div style={{marginBottom: '25px'}}>
                        <label>Contraseña</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{width: '100%', padding: '12px'}}>
                        {isRegistering ? 'Registrarse' : 'Ingresar'}
                    </button>
                </form>
                
                <div style={{marginTop: '20px', fontSize: '0.9rem'}}>
                    <span style={{color: 'var(--text-muted)'}}>
                        {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                    </span>
                    <button 
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); }} 
                        style={{background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px'}}
                    >
                        {isRegistering ? 'Inicia Sesión' : 'Regístrate'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;