import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'; // updateDoc eliminado
import type { DocumentData } from 'firebase/firestore';

interface Forma21 extends DocumentData { id: string; nombreEquipo: string; delegadoEmail: string; delegadoId: string; rosterCompleto?: boolean; aprobado?: boolean; equipoId?: string; cantidadJugadores?: number; }

const Forma21AdminViewer: React.FC<{ onClose: () => void; setViewRosterId: (id: string | null) => void }> = ({ onClose, setViewRosterId }) => {
    const [formas21, setFormas21] = useState<Forma21[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const snap = await getDocs(collection(db, 'forma21s'));
            const data = await Promise.all(snap.docs.map(async d => {
                const jSnap = await getDocs(collection(db, 'forma21s', d.id, 'jugadores'));
                return { id: d.id, ...d.data(), rosterCompleto: jSnap.docs.length >= 10, cantidadJugadores: jSnap.docs.length } as Forma21;
            }));
            setFormas21(data.sort((a, b) => (a.aprobado === b.aprobado ? 0 : a.aprobado ? 1 : -1)));
            setLoading(false);
        };
        fetch();
    }, []);
    
    const handleApprove = async (forma: Forma21) => {
        if (!forma.rosterCompleto || !window.confirm("¿Aprobar?")) return;
        const batch = writeBatch(db);
        batch.update(doc(db, 'forma21s', forma.id), { aprobado: true });
        batch.update(doc(db, 'usuarios', forma.delegadoId), { rol: 'delegado', equipoId: forma.equipoId });
        await batch.commit(); alert("Aprobado.");
    };

    if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>Cargando...</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', margin: 0 }}>📋 Gestión de Formas 21</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {formas21.map((forma) => (
                    <div key={forma.id} className="card" style={{ padding: '20px', borderLeft: `5px solid ${forma.aprobado ? 'var(--success)' : 'var(--accent)'}` }}>
                        <div style={{marginBottom:'15px'}}>
                            <h3>{forma.nombreEquipo}</h3>
                            <p style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{forma.delegadoEmail}</p>
                            <span className={`badge ${forma.aprobado ? 'badge-success' : 'badge-warning'}`}>{forma.aprobado ? 'APROBADO' : 'PENDIENTE'}</span>
                        </div>
                        <div style={{background: '#f9fafb', padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
                            <span style={{fontWeight:'bold', color: forma.rosterCompleto ? 'var(--success)' : 'var(--danger)'}}>{forma.cantidadJugadores} / 15 Jugadores</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button onClick={() => setViewRosterId(forma.id)} className="btn btn-secondary" style={{fontSize:'0.85rem'}}>Ver Roster</button>
                            {!forma.aprobado && <button onClick={() => handleApprove(forma)} className="btn btn-primary" disabled={!forma.rosterCompleto} style={{fontSize:'0.85rem'}}>Aprobar</button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default Forma21AdminViewer;