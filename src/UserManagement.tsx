import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

interface UserData {
    id: string;
    email: string;
    rol: string;
    equipoId?: string; // Para identificar si es un delegado con equipo
}

const UserManagement: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    // Cargar usuarios
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // Obtenemos todos los usuarios
                const q = query(collection(db, 'usuarios')); 
                const snap = await getDocs(q);
                
                const list = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                } as UserData));

                // Ordenar: Admin primero, luego delegados, etc.
                list.sort((a,b) => {
                    if(a.rol === 'admin') return -1;
                    if(b.rol === 'admin') return 1;
                    return a.email?.localeCompare(b.email || '') || 0;
                });

                setUsers(list);
            } catch (error) {
                console.error("Error cargando usuarios:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    // Función para borrar usuario
    const handleDeleteUser = async (userId: string, userEmail: string, userRol: string) => {
        if (userRol === 'admin') {
            alert("❌ No puedes eliminar a un Administrador desde aquí.");
            return;
        }

        if (!window.confirm(`⚠️ ¿ELIMINAR USUARIO?\n\nEmail: ${userEmail}\nRol: ${userRol}\n\nEsta acción eliminará su acceso y sus datos de perfil.`)) return;

        try {
            // 1. Eliminar documento de la colección 'usuarios'
            await deleteDoc(doc(db, 'usuarios', userId));

            // 2. Si es delegado, opcionalmente podríamos borrar su equipo, 
            // pero mejor dejemos el equipo y solo borremos el acceso para no romper torneos pasados.
            // Si quieres borrar el equipo también, descomenta lo siguiente:
            /*
            if (userRol === 'delegado') {
                 if(window.confirm("¿Deseas eliminar también su EQUIPO y ROSTER?")) {
                     await deleteDoc(doc(db, 'forma21s', userId));
                     await deleteDoc(doc(db, 'equipos', userId));
                     // Nota: Faltaría borrar subcolección jugadores, pero Firestore no lo hace automático en cliente.
                 }
            }
            */

            setUsers(prev => prev.filter(u => u.id !== userId));
            alert("✅ Usuario eliminado correctamente.");

        } catch (error) {
            console.error("Error eliminando usuario:", error);
            alert("Error al eliminar usuario.");
        }
    };

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(243, 244, 246, 0.95)', 
            display:'flex', flexDirection:'column', zIndex:2000, overflowY:'auto'
        }}>
            <div style={{
                padding:'20px', background:'white', boxShadow:'0 2px 4px rgba(0,0,0,0.05)', 
                display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:1001
            }}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'1.5rem'}}>👥</span>
                    <h2 style={{margin:0, color:'#1f2937'}}>Gestión de Usuarios</h2>
                </div>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>

            <div style={{maxWidth:'800px', margin:'20px auto', width:'95%', background:'white', borderRadius:'12px', padding:'20px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)'}}>
                
                <h3 style={{marginTop:0, marginBottom:'15px', color:'#374151'}}>Lista de Usuarios Registrados ({users.length})</h3>

                {loading ? <div style={{textAlign:'center', padding:'20px'}}>Cargando...</div> : (
                    <div style={{overflowX:'auto'}}>
                        <table style={{width:'100%', borderCollapse:'collapse', minWidth:'500px'}}>
                            <thead style={{background:'#f3f4f6', borderBottom:'2px solid #e5e7eb'}}>
                                <tr>
                                    <th style={{padding:'12px', textAlign:'left', color:'#6b7280'}}>Email / Usuario</th>
                                    <th style={{padding:'12px', textAlign:'center', color:'#6b7280'}}>Rol</th>
                                    <th style={{padding:'12px', textAlign:'center', color:'#6b7280'}}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} style={{borderBottom:'1px solid #eee'}}>
                                        <td style={{padding:'12px'}}>
                                            <div style={{fontWeight:'bold', color:'#1f2937'}}>{u.email || 'Sin Email'}</div>
                                            <div style={{fontSize:'0.75rem', color:'#9ca3af', fontFamily:'monospace'}}>ID: {u.id}</div>
                                        </td>
                                        <td style={{padding:'12px', textAlign:'center'}}>
                                            <span style={{
                                                padding:'4px 10px', borderRadius:'15px', fontSize:'0.8rem', fontWeight:'bold', textTransform:'uppercase',
                                                background: u.rol === 'admin' ? '#fef3c7' : (u.rol === 'delegado' ? '#dbeafe' : '#f3f4f6'),
                                                color: u.rol === 'admin' ? '#d97706' : (u.rol === 'delegado' ? '#1e40af' : '#4b5563')
                                            }}>
                                                {u.rol}
                                            </span>
                                        </td>
                                        <td style={{padding:'12px', textAlign:'center'}}>
                                            {u.rol !== 'admin' && (
                                                <button 
                                                    onClick={() => handleDeleteUser(u.id, u.email, u.rol)}
                                                    className="btn"
                                                    style={{
                                                        background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', 
                                                        padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'0.85rem'
                                                    }}
                                                >
                                                    🗑️ Eliminar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;