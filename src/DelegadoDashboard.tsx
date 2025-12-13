import React, { useState } from 'react';
import { db, storage } from './firebase'; 
import { doc, updateDoc } from 'firebase/firestore'; // Quitamos collection, query, where, getDocs que causaban error
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 

interface Forma21 { id: string; nombreEquipo: string; categoria?: string; rama?: string; estatus?: string; logoUrl?: string; } 

interface DelegadoDashboardProps {
    formas21: Forma21[];
    userUid: string;
    userEquipoId: string | null;
    refreshData: () => void;
    setViewRosterId: (id: string) => void;
    setSelectedFormId: (id: string) => void;
    setSelectForma5MatchId: (id: string | null) => void;
    onRegister: () => void;
}

const DelegadoDashboard: React.FC<DelegadoDashboardProps> = ({ 
    formas21, refreshData, setViewRosterId, setSelectedFormId, onRegister 
}) => {
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const handleLogoUpload = async (file: File, forma21: Forma21) => {
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
            alert("El logo es muy pesado. Usa una imagen menor a 2MB.");
            return;
        }

        setUploadingId(forma21.id);

        try {
            // 1. Subir a Storage
            const storageRef = ref(storage, `escudos/${forma21.id}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // 2. Actualizar SOLAMENTE la Forma21 (Esto sí está permitido)
            await updateDoc(doc(db, 'forma21s', forma21.id), { logoUrl: url });

            // NOTA: Quitamos la actualización automática de la tabla 'equipos' 
            // porque causaba error de permisos. El Admin lo verá en la Forma 21.

            alert("¡Escudo actualizado correctamente!");
            refreshData(); 
        } catch (error) {
            console.error("Error al subir logo:", error);
            alert("Hubo un error al subir el escudo. Inténtalo de nuevo.");
        } finally {
            setUploadingId(null);
        }
    };

    return (
        <div className="animate-fade-in">
            {formas21.length === 0 ? (
                <div className="card" style={{textAlign:'center', padding:'40px'}}>
                    <p style={{color:'var(--text-muted)'}}>No tienes equipos registrados.</p>
                    <button onClick={onRegister} className="btn btn-primary">📝 Inscribir Nuevo Equipo</button>
                </div>
            ) : (
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                    {formas21.map(f => (
                        <div key={f.id} className="card" style={{position:'relative', overflow:'hidden'}}>
                            
                            {/* CABECERA CON EL LOGO */}
                            <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'15px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
                                <div style={{width:'80px', height:'80px', borderRadius:'50%', border:'3px solid var(--primary)', overflow:'hidden', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', position: 'relative'}}>
                                    {f.logoUrl ? (
                                        <img src={f.logoUrl} alt="Logo" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                    ) : (
                                        <span style={{fontSize:'2rem'}}>🛡️</span>
                                    )}
                                    <input type="file" accept="image/*" disabled={uploadingId === f.id}
                                        onChange={(e) => { if (e.target.files && e.target.files[0]) handleLogoUpload(e.target.files[0], f); }}
                                        style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0, cursor:'pointer'}}
                                        title="Haz clic para cambiar el escudo"
                                    />
                                </div>
                                <div style={{flex:1}}>
                                    <h3 style={{margin:0, color:'var(--primary)', fontSize:'1.2rem'}}>{f.nombreEquipo}</h3>
                                    <div style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{f.categoria || 'Sin cat.'} - {f.rama || 'Sin rama'}</div>
                                    <div style={{fontSize:'0.75rem', marginTop:'5px', color: uploadingId === f.id ? 'var(--accent)' : 'var(--text-muted)'}}>
                                        {uploadingId === f.id ? '⏳ Subiendo...' : '📸 Toca el círculo para subir logo'}
                                    </div>
                                </div>
                            </div>

                            {/* ESTADO Y BOTONES */}
                            <div style={{marginBottom:'15px'}}>
                                <span style={{background: f.estatus === 'aprobado' ? '#dcfce7' : '#fef9c3', color: f.estatus === 'aprobado' ? '#166534' : '#854d0e', padding:'4px 10px', borderRadius:'12px', fontSize:'0.8rem', fontWeight:'bold'}}>
                                    {f.estatus === 'aprobado' ? '✅ Aprobado' : '⏳ Pendiente'}
                                </span>
                            </div>
                            <div style={{display:'flex', gap:'10px', flexDirection:'column'}}>
                                <button onClick={() => setViewRosterId(f.id)} className="btn btn-secondary" style={{width:'100%'}}>👁️ Ver Roster</button>
                                {f.estatus !== 'aprobado' && (
                                    <button onClick={() => setSelectedFormId(f.id)} className="btn btn-primary" style={{width:'100%'}}>✏️ Editar / Completar</button>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    <div className="card" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'2px dashed var(--border)', background:'transparent', minHeight:'250px', cursor:'pointer'}} onClick={onRegister}>
                        <div style={{fontSize:'3rem', color:'var(--text-muted)', marginBottom:'10px'}}>+</div>
                        <span style={{color:'var(--text-muted)', fontWeight:'bold'}}>Inscribir otro equipo</span>
                    </div>
                </div>
            )}
        </div>
    );
};
export default DelegadoDashboard;