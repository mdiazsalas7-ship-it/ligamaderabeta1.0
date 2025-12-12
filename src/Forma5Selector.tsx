import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore'; 

interface Player { id: string; nombre: string; numero: number; selected: boolean; equipoId: string; }

interface Forma5SelectorProps {
    calendarioId: string;
    equipoId: string;
    onSuccess: () => void;
    onClose?: () => void;
}

const Forma5Selector: React.FC<Forma5SelectorProps> = ({ calendarioId, equipoId, onSuccess, onClose }) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchRoster = async () => {
            setLoading(true);
            try {
                // 1. Buscar la Forma 21 de este equipo
                const q = query(collection(db, 'forma21s'), where('equipoId', '==', equipoId));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    alert("No se encontró el roster del equipo.");
                    return;
                }

                const forma21Id = querySnapshot.docs[0].id;

                // 2. Cargar jugadores
                const jugadoresRef = collection(db, 'forma21s', forma21Id, 'jugadores');
                const jSnap = await getDocs(jugadoresRef);
                
                const lista = jSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    selected: false, // Por defecto no seleccionados
                    equipoId: equipoId
                })) as Player[];

                // Ordenar por número
                lista.sort((a, b) => a.numero - b.numero);
                setPlayers(lista);

            } catch (error) {
                console.error("Error cargando roster:", error);
                alert("Error al cargar jugadores.");
            } finally {
                setLoading(false);
            }
        };
        fetchRoster();
    }, [equipoId]);

    const toggleSelection = (id: string) => {
        setPlayers(prev => prev.map(p => {
            if (p.id === id) {
                // Si vamos a seleccionar y ya hay 12, no dejamos
                const selectedCount = prev.filter(x => x.selected).length;
                if (!p.selected && selectedCount >= 12) {
                    alert("Máximo 12 jugadores permitidos en Forma 5.");
                    return p;
                }
                return { ...p, selected: !p.selected };
            }
            return p;
        }));
    };

    const handleSubmit = async () => {
        const selectedPlayers = players.filter(p => p.selected);
        if (selectedPlayers.length < 5) {
            alert("Debes seleccionar al menos 5 jugadores.");
            return;
        }

        setSaving(true);
        try {
            const partidoRef = doc(db, 'calendario', calendarioId);
            
            // Guardamos usando una clave dinámica para no borrar al otro equipo
            // Nota: En Firestore, para actualizar un campo anidado de un mapa se usa "campo.clave"
            await updateDoc(partidoRef, {
                [`forma5.${equipoId}`]: selectedPlayers.map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    numero: p.numero,
                    equipoId: p.equipoId
                }))
            });

            alert("✅ Alineación enviada correctamente.");
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al guardar la alineación.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>Cargando Roster...</div>;

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <div>
                    <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.3rem'}}>📋 Forma 5 (Alineación)</h2>
                    <p style={{margin:0, color:'var(--text-muted)', fontSize:'0.9rem'}}>Selecciona los jugadores para este partido (Máx 12).</p>
                </div>
                {onClose && <button onClick={onClose} className="btn btn-secondary">← Cancelar</button>}
            </div>

            <div className="dashboard-grid" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', maxHeight: '400px', overflowY: 'auto', padding: '5px'}}>
                {players.map(p => (
                    <div 
                        key={p.id} 
                        onClick={() => toggleSelection(p.id)}
                        className="dashboard-card"
                        style={{
                            border: p.selected ? '2px solid var(--success)' : '1px solid var(--border)',
                            backgroundColor: p.selected ? '#f0fdf4' : 'white',
                            height: 'auto', padding: '15px', cursor: 'pointer',
                            opacity: (!p.selected && players.filter(x=>x.selected).length >= 12) ? 0.5 : 1
                        }}
                    >
                        <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)'}}>#{p.numero}</div>
                        <div style={{fontSize: '0.9rem', fontWeight: '500'}}>{p.nombre}</div>
                        {p.selected && <span style={{fontSize: '0.8rem', color: 'var(--success)', fontWeight: 'bold'}}>TITULAR</span>}
                    </div>
                ))}
            </div>

            <div style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontWeight: 'bold'}}>Seleccionados: {players.filter(p=>p.selected).length} / 12</span>
                <button 
                    onClick={handleSubmit} 
                    disabled={saving}
                    className="btn btn-primary"
                    style={{padding: '10px 30px'}}
                >
                    {saving ? 'Enviando...' : 'Confirmar Alineación'}
                </button>
            </div>
        </div>
    );
};

export default Forma5Selector;