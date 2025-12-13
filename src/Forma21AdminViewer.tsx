import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, addDoc } from 'firebase/firestore';

interface Forma21 { id: string; delegadoId: string; nombreEquipo: string; categoria?: string; rama?: string; estatus?: string; logoUrl?: string; }

const Forma21AdminViewer: React.FC<{ onClose: () => void, setViewRosterId: (id: string) => void }> = ({ onClose, setViewRosterId }) => {
    const [formas, setFormas] = useState<Forma21[]>([]);
    const [syncStatus, setSyncStatus] = useState(''); // Para mostrar mensaje de sincronización

    const fetchFormas = async () => {
        try {
            const snap = await getDocs(collection(db, 'forma21s'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Forma21));
            setFormas(data);
            
            // --- AUTO-SINCRONIZACIÓN DE LOGOS AL ABRIR ---
            sincronizarLogos(data);
        } catch (e) { console.error(e); }
    };

    // Función que corre sola para arreglar los logos faltantes
    const sincronizarLogos = async (listaFormas: Forma21[]) => {
        setSyncStatus('⏳ Revisando logos...');
        let actualizados = 0;
        try {
            for (const f of listaFormas) {
                if (!f.logoUrl) continue; // Si el delegado no subió foto, saltamos

                // Buscamos el equipo en la tabla pública por nombre exacto
                const q = query(collection(db, 'equipos'), where('nombre', '==', f.nombreEquipo));
                const equipoSnap = await getDocs(q);

                // Si encontramos al equipo, le ponemos el logo
                equipoSnap.forEach(async (docEq) => {
                    const dataEq = docEq.data();
                    // Solo actualizamos si no tiene logo o es diferente
                    if (dataEq.logoUrl !== f.logoUrl) {
                        await updateDoc(doc(db, 'equipos', docEq.id), { logoUrl: f.logoUrl });
                        actualizados++;
                    }
                });
            }
            if (actualizados > 0) setSyncStatus(`✅ Se actualizaron ${actualizados} logos nuevos.`);
            else setSyncStatus('✅ Todos los logos están al día.');
        } catch (e) { console.error(e); setSyncStatus(''); }
    };

    useEffect(() => { fetchFormas(); }, []);

    const handleAprobar = async (f: Forma21) => {
        if (!window.confirm(`¿Aprobar al equipo ${f.nombreEquipo}?`)) return;
        try {
            await updateDoc(doc(db, 'forma21s', f.id), { estatus: 'aprobado' });
            
            // Crear entrada en la tabla de posiciones si no existe
            const q = query(collection(db, 'equipos'), where('nombre', '==', f.nombreEquipo));
            const exists = await getDocs(q);
            if (exists.empty) {
                await addDoc(collection(db, 'equipos'), {
                    nombre: f.nombreEquipo, victorias: 0, derrotas: 0, puntos_favor: 0, puntos_contra: 0, puntos: 0,
                    categoria: f.categoria || '', rama: f.rama || '',
                    logoUrl: f.logoUrl || null // IMPORTANTE: Guardar logo al crear
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
        <div className="animate-fade-in" style={{maxWidth:'1000px', margin:'0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <div>
                    <h2 style={{color:'var(--primary)', margin:0}}>📋 Gestión de Inscripciones</h2>
                    {/* Mensaje de estado de la sincronización */}
                    <small style={{color:'var(--accent)', fontWeight:'bold'}}>{syncStatus}</small>
                </div>
                <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
            </div>

            <div className="table-container">
                <table className="custom-table">
                    <thead>
                        <tr><th>Logo</th><th>Equipo</th><th>Categoría</th><th>Estatus</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                        {formas.map(f => (
                            <tr key={f.id}>
                                <td>{f.logoUrl ? <img src={f.logoUrl} alt="Logo" style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}} /> : '🛡️'}</td>
                                <td style={{fontWeight:'bold'}}>{f.nombreEquipo}</td>
                                <td>{f.categoria} ({f.rama})</td>
                                <td>
                                    <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'0.8rem', background: f.estatus==='aprobado'?'#dcfce7':'#fef9c3', color: f.estatus==='aprobado'?'#166534':'#854d0e'}}>
                                        {f.estatus || 'Pendiente'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{display:'flex', gap:'5px'}}>
                                        <button onClick={()=>setViewRosterId(f.id)} className="btn btn-secondary" style={{padding:'5px'}}>👁️</button>
                                        {f.estatus !== 'aprobado' && <button onClick={()=>handleAprobar(f)} className="btn btn-primary" style={{padding:'5px'}}>✅</button>}
                                        <button onClick={()=>handleDelete(f.id)} className="btn btn-danger" style={{padding:'5px'}}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default Forma21AdminViewer;