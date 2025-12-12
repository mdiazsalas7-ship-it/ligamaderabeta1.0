import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';

const MatchForm: React.FC<{ onSuccess: () => void; onClose?: () => void }> = ({ onSuccess, onClose }) => {
    const [equipos, setEquipos] = useState<{id: string, nombre: string}[]>([]);
    const [form, setForm] = useState({ localId: '', visitId: '', marcLocal: '', marcVisit: '', arbitro: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getDocs(collection(db, 'equipos')).then(s => setEquipos(s.docs.map(d => ({ id: d.id, nombre: d.data().nombre }))));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        try {
            const local = equipos.find(e => e.id === form.localId);
            const visit = equipos.find(e => e.id === form.visitId);
            if (!local || !visit || local.id === visit.id) throw new Error("Error en equipos");
            await addDoc(collection(db, 'partidos'), {
                equipoLocalId: local.id, equipoVisitanteId: visit.id,
                equipoLocalNombre: local.nombre, equipoVisitanteNombre: visit.nombre,
                marcadorLocal: parseInt(form.marcLocal), marcadorVisitante: parseInt(form.marcVisit),
                fechaPartido: Timestamp.now(), arbitro: form.arbitro, registradoPorId: auth.currentUser?.uid
            });
            alert('✅ Registrado.'); onSuccess();
        } catch (err: any) { alert(err.message); } finally { setLoading(false); }
    };

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)'}}>🖊️ Marcador Manual</h2>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}
            </div>
            <form onSubmit={handleSubmit}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                    <div><label>Local</label><select value={form.localId} onChange={e=>setForm({...form, localId:e.target.value})} required><option value="">Sel...</option>{equipos.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select><input type="number" placeholder="Pts" value={form.marcLocal} onChange={e=>setForm({...form, marcLocal:e.target.value})} required /></div>
                    <div><label>Visitante</label><select value={form.visitId} onChange={e=>setForm({...form, visitId:e.target.value})} required><option value="">Sel...</option>{equipos.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select><input type="number" placeholder="Pts" value={form.marcVisit} onChange={e=>setForm({...form, marcVisit:e.target.value})} required /></div>
                </div>
                <div style={{margin:'15px 0'}}><label>Árbitro</label><input type="text" value={form.arbitro} onChange={e=>setForm({...form, arbitro:e.target.value})} required /></div>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{width:'100%'}}>{loading ? '...' : 'Registrar'}</button>
            </form>
        </div>
    );
};
export default MatchForm;