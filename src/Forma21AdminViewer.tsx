import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, addDoc } from 'firebase/firestore';

interface Forma21 { id: string; delegadoId: string; nombreEquipo: string; categoria?: string; rama?: string; estatus?: string; logoUrl?: string; }

const Forma21AdminViewer: React.FC<{ onClose: () => void, setViewRosterId: (id: string) => void }> = ({ onClose, setViewRosterId }) => {
    const [formas, setFormas] = useState<Forma21[]>([]);
    const [syncStatus, setSyncStatus] = useState('');

    const fetchFormas = async () => {
        try {
            const snap = await getDocs(collection(db, 'forma21s'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Forma21));
            setFormas(data);
            sincronizarLogos(data);
        } catch (e) { console.error(e); }
    };

    const sincronizarLogos = async (listaFormas: Forma21[]) => {
        setSyncStatus('⏳ Sincronizando...');
        let actualizados = 0;
        try {
            for (const f of listaFormas) {
                if (!f.logoUrl) continue;
                const q = query(collection(db, 'equipos'), where('nombre', '==', f.nombreEquipo));
                const equipoSnap = await getDocs(q);
                equipoSnap.forEach(async (docEq) => {
                    if (docEq.data().logoUrl !== f.logoUrl) {
                        await updateDoc(doc(db, 'equipos', docEq.id), { logoUrl: f.logoUrl });
                        actualizados++;
                    }
                });
            }
            setSyncStatus(actualizados > 0 ? `✅ ${actualizados} logos actualizados` : '✅ Logos al día');
        } catch (e) { setSyncStatus('⚠️ Error sync'); }
    };

    useEffect(() => { fetchFormas(); }, []);

    const handleAprobar = async (f: Forma21) => {
        if (!window.confirm(`¿Aprobar al equipo ${f.nombreEquipo}?`)) return;
        try {
            await updateDoc(doc(db, 'forma21s', f.id), { estatus: 'aprobado' });
            
            // Verificar si ya existe en la tabla de posiciones
            const q = query(collection(db, 'equipos'), where('nombre', '==', f.nombreEquipo));
            const exists = await getDocs(q);
            
            if (exists.empty) {
                await addDoc(collection(db, 'equipos'), {
                    nombre: f.nombreEquipo, 
                    victorias: 0, derrotas: 0, puntos_favor: 0, puntos_contra: 0, puntos: 0,
                    // Aunque lo quitamos de la vista, lo guardamos en la BD por si acaso
                    categoria: f.categoria || 'General', 
                    rama: f.rama || 'Mixto',
                    logoUrl: f.logoUrl || null
                });
            }
            alert("Equipo aprobado.");
            fetchFormas();
        } catch (e) { alert("Error al aprobar"); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Eliminar esta inscripción?")) return;
        await deleteDoc(doc(db, 'forma21s', id));
        setFormas(prev => prev.filter(f => f.id !== id));
    };

    return (
        <div className="animate-fade-in" style={{maxWidth:'1000px', margin:'0 auto', paddingBottom:'40px'}}>
            
            {/* HEADER */}
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'30px', alignItems:'center'}}>
                <div>
                    <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.8rem', fontWeight:'800'}}>📋 Gestión de Inscripciones</h2>
                    <div style={{color:'var(--accent)', fontSize:'0.9rem', fontWeight:'600', marginTop:'5px'}}>{syncStatus}</div>
                </div>
                <button onClick={onClose} className="btn btn-secondary" style={{padding:'10px 20px'}}>← Cerrar</button>
            </div>

            {/* TABLA ELEGANTE (SIN COLUMNA CATEGORÍA) */}
            <div className="card" style={{padding:0, overflowX:'auto', border:'none', boxShadow:'0 10px 25px -5px rgba(0,0,0,0.1)', borderRadius:'12px'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:'600px', background:'white'}}>
                    <thead>
                        <tr style={{
                            background:'#f8fafc', color:'#64748b', textAlign:'left', 
                            fontSize:'0.85rem', textTransform:'uppercase', letterSpacing:'0.05em', 
                            borderBottom:'1px solid #e2e8f0'
                        }}>
                            <th style={{padding:'20px'}}>Equipo</th>
                            <th style={{padding:'20px'}}>Estatus</th>
                            <th style={{padding:'20px', textAlign:'right'}}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formas.map((f, i) => (
                            <tr key={f.id} style={{borderBottom:'1px solid #f1f5f9', transition:'background 0.2s'}}>
                                {/* COLUMNA 1: EQUIPO (NOMBRE Y RAMA) */}
                                <td style={{padding:'20px'}}>
                                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                        {/* Logo */}
                                        {f.logoUrl ? 
                                            <img src={f.logoUrl} alt="Logo" style={{width:'45px', height:'45px', borderRadius:'50%', objectFit:'cover', border:'2px solid #e2e8f0'}} /> : 
                                            <div style={{width:'45px', height:'45px', borderRadius:'50%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem'}}>🛡️</div>
                                        }
                                        {/* Info */}
                                        <div>
                                            <div style={{fontWeight:'700', color:'#1e293b', fontSize:'1rem'}}>{f.nombreEquipo}</div>
                                            {/* Aquí mostramos la Rama pequeña, eliminando la columna de categoría */}
                                            <div style={{fontSize:'0.8rem', color:'#94a3b8'}}>
                                                {f.rama || 'General'}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* COLUMNA 2: ESTATUS */}
                                <td style={{padding:'20px'}}>
                                    <span style={{
                                        padding:'6px 12px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase',
                                        background: f.estatus === 'aprobado' ? '#dcfce7' : '#fef9c3',
                                        color: f.estatus === 'aprobado' ? '#166534' : '#854d0e',
                                        border: f.estatus === 'aprobado' ? '1px solid #bbf7d0' : '1px solid #fde047'
                                    }}>
                                        {f.estatus === 'aprobado' ? '✅ Aprobado' : '⏳ Pendiente'}
                                    </span>
                                </td>

                                {/* COLUMNA 3: ACCIONES */}
                                <td style={{padding:'20px', textAlign:'right'}}>
                                    <div style={{display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                                        <button onClick={()=>setViewRosterId(f.id)} className="btn btn-secondary" title="Ver Jugadores" style={{padding:'8px 12px'}}>👁️</button>
                                        {f.estatus !== 'aprobado' && (
                                            <button onClick={()=>handleAprobar(f)} className="btn btn-primary" title="Aprobar Equipo" style={{padding:'8px 12px'}}>✅</button>
                                        )}
                                        <button onClick={()=>handleDelete(f.id)} className="btn btn-danger" title="Eliminar" style={{padding:'8px 12px'}}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {formas.length === 0 && <div style={{padding:'40px', textAlign:'center', color:'#94a3b8'}}>No hay inscripciones registradas.</div>}
            </div>
        </div>
    );
};
export default Forma21AdminViewer;