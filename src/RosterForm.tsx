import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore'; 

const RosterForm: React.FC<{ forma21Id: string; nombreEquipo: string; onSuccess: () => void; onClose?: () => void }> = ({ forma21Id, nombreEquipo, onSuccess, onClose }) => {
    const [jugadores, setJugadores] = useState<any[]>([]);
    const [nuevo, setNuevo] = useState({ nombre: '', numero: '', posicion: '' });

    useEffect(() => {
        getDocs(collection(db, 'forma21s', forma21Id, 'jugadores')).then(s => setJugadores(s.docs.map(d => ({id: d.id, ...d.data()})).sort((a:any,b:any)=>a.numero-b.numero)));
    }, [forma21Id]);

    const add = async (e: React.FormEvent) => {
        e.preventDefault();
        if (jugadores.length >= 15) return alert("Máximo 15.");
        await addDoc(collection(db, 'forma21s', forma21Id, 'jugadores'), { ...nuevo, numero: parseInt(nuevo.numero) });
        setNuevo({ nombre: '', numero: '', posicion: '' });
        getDocs(collection(db, 'forma21s', forma21Id, 'jugadores')).then(s => setJugadores(s.docs.map(d => ({id: d.id, ...d.data()})).sort((a:any,b:any)=>a.numero-b.numero)));
    };

    const del = async (id: string) => {
        if(!window.confirm("¿Eliminar?")) return;
        await deleteDoc(doc(db, 'forma21s', forma21Id, 'jugadores', id));
        setJugadores(p => p.filter(j => j.id !== id));
    };

    return (
        <div className="card animate-fade-in" style={{maxWidth: '800px', margin: '0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)'}}>Roster: {nombreEquipo}</h2>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}
            </div>
            
            <form onSubmit={add} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:'10px', alignItems:'end', marginBottom:'20px', background:'#f9fafb', padding:'15px', borderRadius:'10px'}}>
                <div><label>Nombre</label><input value={nuevo.nombre} onChange={e=>setNuevo({...nuevo, nombre:e.target.value})} required style={{marginBottom:0}} /></div>
                <div><label>#</label><input type="number" value={nuevo.numero} onChange={e=>setNuevo({...nuevo, numero:e.target.value})} required style={{marginBottom:0}} /></div>
                <div><label>Pos</label><select value={nuevo.posicion} onChange={e=>setNuevo({...nuevo, posicion:e.target.value})} required style={{marginBottom:0}}><option value="">Sel</option><option>Base</option><option>Escolta</option><option>Alero</option><option>Ala-Pívot</option><option>Pívot</option></select></div>
                <button type="submit" className="btn btn-primary" style={{height:'46px'}}>Añadir</button>
            </form>

            <div className="table-responsive">
                <table className="data-table">
                    <thead><tr><th>#</th><th>Nombre</th><th>Posición</th><th>Acción</th></tr></thead>
                    <tbody>
                        {jugadores.map(j => (
                            <tr key={j.id}>
                                <td><b>{j.numero}</b></td><td>{j.nombre}</td><td>{j.posicion}</td>
                                <td><button onClick={() => del(j.id)} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8rem'}}>X</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{textAlign:'right', marginTop:'20px'}}>
                <button onClick={onSuccess} className="btn btn-success" disabled={jugadores.length < 10}>{jugadores.length>=10 ? 'Finalizar' : `Faltan ${10-jugadores.length}`}</button>
            </div>
        </div>
    );
};
export default RosterForm;