import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; 

// Definimos las interfaces para mantener el orden
interface Player { numero: number; nombre: string; posicion?: string; }
interface Staff { entrenador: string; asistente: string; }

const RosterViewer: React.FC<{ forma21Id: string; nombreEquipo: string; onClose?: () => void }> = ({ forma21Id, nombreEquipo, onClose }) => {
    const [jugadores, setJugadores] = useState<Player[]>([]);
    const [staff, setStaff] = useState<Staff>({ entrenador: 'No registrado', asistente: 'No registrado' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Cargar Staff (Del documento principal de la Forma 21)
                const docRef = doc(db, 'forma21s', forma21Id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setStaff({
                        entrenador: data.entrenador || 'No registrado',
                        asistente: data.asistente || 'No registrado'
                    });
                }

                // 2. Cargar Jugadores (De la subcolección)
                const colRef = collection(db, 'forma21s', forma21Id, 'jugadores');
                const snap = await getDocs(colRef);
                const list = snap.docs.map(d => d.data() as Player);
                
                // Ordenar por número
                list.sort((a, b) => a.numero - b.numero);
                setJugadores(list);
            } catch (error) {
                console.error("Error cargando roster:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [forma21Id]);

    if (loading) return <div style={{textAlign:'center', padding:'20px'}}>Cargando Roster y Staff...</div>;

    return (
        <div className="card animate-fade-in" style={{maxWidth: '800px', margin: '0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                <h2 style={{color:'var(--primary)', margin:0}}>Roster: {nombreEquipo}</h2>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Volver</button>}
            </div>

            {/* --- SECCIÓN NUEVA: CUERPO TÉCNICO --- */}
            <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', 
                borderRadius: '8px', padding: '15px', marginBottom: '20px'
            }}>
                <h4 style={{margin:'0 0 10px 0', color:'#1e40af', fontSize:'1rem'}}>👔 Cuerpo Técnico</h4>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                    <div>
                        <span style={{display:'block', fontSize:'0.75rem', color:'#6b7280', fontWeight:'bold', textTransform:'uppercase'}}>Entrenador Principal</span>
                        <span style={{fontWeight:'bold', color:'#1f2937', fontSize:'1.1rem'}}>{staff.entrenador}</span>
                    </div>
                    <div>
                        <span style={{display:'block', fontSize:'0.75rem', color:'#6b7280', fontWeight:'bold', textTransform:'uppercase'}}>Asistente</span>
                        <span style={{fontWeight:'bold', color:'#1f2937', fontSize:'1.1rem'}}>{staff.asistente}</span>
                    </div>
                </div>
            </div>

            {/* --- SECCIÓN JUGADORES --- */}
            <h4 style={{margin:'0 0 10px 0', color:'#374151'}}>🏃 Lista de Jugadores ({jugadores.length})</h4>
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{width:'60px', textAlign:'center'}}>#</th>
                            <th>Nombre</th>
                            <th>Posición</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jugadores.length === 0 ? (
                            <tr><td colSpan={3} style={{textAlign:'center', padding:'20px', color:'#999'}}>No hay jugadores registrados.</td></tr>
                        ) : (
                            jugadores.map((j, i) => (
                                <tr key={i}>
                                    <td style={{textAlign:'center', fontWeight:'bold', color:'var(--primary)'}}>{j.numero}</td>
                                    <td style={{fontWeight:'bold'}}>{j.nombre}</td>
                                    <td>{j.posicion || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default RosterViewer;