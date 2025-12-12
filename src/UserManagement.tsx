import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore'; 

interface AppUser extends DocumentData { id: string; uid?: string; email: string; rol: 'admin' | 'delegado' | 'pendiente' | 'jugador'; }
const ROLES_VALIDOS: ('admin' | 'delegado' | 'pendiente' | 'jugador')[] = ['admin', 'delegado', 'jugador', 'pendiente'];

const UserManagement: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true); setError(null);
        try {
            const usersRef = collection(db, 'usuarios');
            const snapshot = await getDocs(usersRef);
            const userList = snapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, email: data.email || 'Sin Email', rol: data.rol || 'pendiente' } as AppUser;
            });
            userList.sort((a, b) => {
                if (a.rol === 'pendiente' && b.rol !== 'pendiente') return -1;
                if (a.rol !== 'pendiente' && b.rol === 'pendiente') return 1;
                const emailA = a.email ? a.email.toLowerCase() : '';
                const emailB = b.email ? b.email.toLowerCase() : '';
                return emailA.localeCompare(emailB);
            });
            setUsers(userList);
        } catch (err: any) { setError(`Error: ${err.message}`); } finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const updateRole = async (userId: string, newRole: AppUser['rol']) => {
        if (!window.confirm(`¿Cambiar rol a "${newRole.toUpperCase()}"?`)) return;
        try {
            await updateDoc(doc(db, 'usuarios', userId), { rol: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
        } catch (err) { setError(`Error al actualizar.`); fetchUsers(); }
    };

    if (loading) return <div className="card" style={{textAlign: 'center', padding: '40px'}}>Cargando...</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div><h2 style={{fontSize: '1.5rem', color: 'var(--primary)'}}>👥 Gestión de Usuarios</h2><p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Administra accesos y roles.</p></div>
                <div style={{display: 'flex', gap: '10px'}}><button onClick={fetchUsers} className="btn btn-secondary" style={{fontSize: '0.9rem', padding: '8px 15px'}}>🔄 Actualizar</button>{onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}</div>
            </div>
            
            {error && <div className="badge badge-danger" style={{marginBottom:'10px', display:'block'}}>{error}</div>}

            <div className="dashboard-grid" style={{marginBottom: '30px', marginTop: '0'}}>
                <div className="dashboard-card" style={{height: 'auto', padding: '15px', alignItems: 'flex-start', textAlign: 'left', borderLeft: '4px solid var(--primary)'}}><span style={{fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold'}}>Total</span><span style={{fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)'}}>{users.length}</span></div>
                <div className="dashboard-card" style={{height: 'auto', padding: '15px', alignItems: 'flex-start', textAlign: 'left', borderLeft: '4px solid var(--danger)'}}><span style={{fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold'}}>Pendientes</span><span style={{fontSize: '1.8rem', fontWeight: 'bold', color: users.filter(u=>u.rol==='pendiente').length > 0 ? 'var(--danger)' : 'var(--success)'}}>{users.filter(u=>u.rol==='pendiente').length}</span></div>
                <div className="dashboard-card" style={{height: 'auto', padding: '15px', alignItems: 'flex-start', textAlign: 'left', borderLeft: '4px solid var(--accent)'}}><span style={{fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold'}}>Admins</span><span style={{fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)'}}>{users.filter(u=>u.rol==='admin').length}</span></div>
            </div>

            <div className="card" style={{padding: '0', overflow: 'hidden'}}><div className="table-responsive"><table className="data-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Cambiar Rol</th></tr></thead><tbody>{users.map((user) => (<tr key={user.id}><td><div style={{fontWeight: '600'}}>{user.email}</div><div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>ID: {user.id.substring(0,6)}...</div></td><td><span className={`badge ${user.rol === 'admin' ? 'badge-success' : user.rol === 'pendiente' ? 'badge-danger' : 'badge-warning'}`}>{user.rol.toUpperCase()}</span></td><td><select value={user.rol} onChange={(e) => updateRole(user.id, e.target.value as any)} style={{marginBottom: 0, padding: '6px', fontSize: '0.85rem'}}>{ROLES_VALIDOS.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select></td></tr>))}</tbody></table></div></div>
        </div>
    );
};
export default UserManagement;