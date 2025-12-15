import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

interface Equipo {
    id: string;
    nombre: string;
    logoUrl?: string;
}

const AdminEquipos: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [editValues, setEditValues] = useState<Record<string, string>>({});

    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    useEffect(() => {
        const fetchEquipos = async () => {
            const q = collection(db, 'equipos');
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Equipo));
            setEquipos(list);
            
            // Inicializar valores de edición
            const initialValues: Record<string, string> = {};
            list.forEach(eq => {
                initialValues[eq.id] = eq.logoUrl || '';
            });
            setEditValues(initialValues);
            
            setLoading(false);
        };
        fetchEquipos();
    }, []);

    const handleUpdateLogo = async (id: string) => {
        const newUrl = editValues[id];
        if (!newUrl) return;

        try {
            const teamRef = doc(db, 'equipos', id);
            await updateDoc(teamRef, { logoUrl: newUrl });
            alert("✅ Logo actualizado correctamente");
            
            // Actualizar estado local para ver el cambio inmediato
            setEquipos(prev => prev.map(eq => eq.id === id ? { ...eq, logoUrl: newUrl } : eq));
        } catch (error) {
            console.error(error);
            alert("Error al actualizar");
        }
    };

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', zIndex:2000,
            display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'
        }}>
            <div style={{
                background:'white', width:'100%', maxWidth:'600px', maxHeight:'90vh', borderRadius:'12px',
                display:'flex', flexDirection:'column', overflow:'hidden'
            }}>
                <div style={{padding:'20px', background:'#1e293b', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h3 style={{margin:0}}>🛠️ Gestión de Logos</h3>
                    <button onClick={onClose} className="btn btn-secondary" style={{padding:'5px 10px'}}>Cerrar</button>
                </div>

                <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                    {loading ? <div style={{textAlign:'center'}}>Cargando equipos...</div> : (
                        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            {equipos.map(eq => (
                                <div key={eq.id} style={{
                                    display:'flex', alignItems:'center', gap:'15px', 
                                    padding:'10px', border:'1px solid #eee', borderRadius:'8px', background:'#f8fafc'
                                }}>
                                    {/* PREVIEW */}
                                    <div style={{
                                        width:'50px', height:'50px', borderRadius:'50%', border:'2px solid #ddd', 
                                        overflow:'hidden', background:'white', flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center'
                                    }}>
                                        <img 
                                            src={editValues[eq.id] || eq.logoUrl || DEFAULT_LOGO} 
                                            style={{width:'100%', height:'100%', objectFit:'cover'}} 
                                            onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}
                                        />
                                    </div>

                                    {/* INPUTS */}
                                    <div style={{flex:1}}>
                                        <div style={{fontWeight:'bold', marginBottom:'5px'}}>{eq.nombre}</div>
                                        <input 
                                            type="text" 
                                            placeholder="Pega el Link del Logo aquí..."
                                            value={editValues[eq.id] || ''}
                                            onChange={(e) => setEditValues({...editValues, [eq.id]: e.target.value})}
                                            style={{width:'100%', padding:'5px', fontSize:'0.85rem', border:'1px solid #ccc', borderRadius:'4px'}}
                                        />
                                    </div>

                                    {/* BUTTON */}
                                    <button 
                                        onClick={() => handleUpdateLogo(eq.id)}
                                        className="btn btn-primary"
                                        style={{fontSize:'1.2rem', padding:'8px 12px'}}
                                        title="Guardar"
                                    >
                                        💾
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminEquipos;