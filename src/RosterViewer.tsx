import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore'; // Quitado query

const RosterViewer: React.FC<{ forma21Id: string; nombreEquipo: string; onClose?: () => void }> = ({ forma21Id, nombreEquipo, onClose }) => {
    const [jugadores, setJugadores] = useState<any[]>([]);
    
    useEffect(() => {
        getDocs(collection(db, 'forma21s', forma21Id, 'jugadores')).then(s => setJugadores(s.docs.map(d => d.data()).sort((a:any,b:any)=>a.numero-b.numero)));
    }, [forma21Id]);

    return (
        <div className="card animate-fade-in" style={{maxWidth: '800px', margin: '0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)'}}>Roster: {nombreEquipo}</h2>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}
            </div>
            <div className="table-responsive">
                <table className="data-table">
                    <thead><tr><th>#</th><th>Nombre</th><th>Posición</th></tr></thead>
                    <tbody>
                        {jugadores.map((j, i) => <tr key={i}><td><b>{j.numero}</b></td><td>{j.nombre}</td><td>{j.posicion}</td></tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default RosterViewer;