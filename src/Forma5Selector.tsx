import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

interface Player { id: string; nombre: string; numero: number; cedula?: string; }

const Forma5Selector: React.FC<{ 
    calendarioId: string, 
    equipoId: string, 
    onSuccess: () => void, 
    onClose: () => void 
}> = ({ calendarioId, equipoId, onSuccess, onClose }) => {

    const [allPlayers, setAllPlayers] = useState<Player[]>([]); // Roster completo disponible
    const [selectedIds, setSelectedIds] = useState<string[]>([]); // Selección actual
    const [matchInfo, setMatchInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // ESTADO DE BLOQUEO
    const [isLocked, setIsLocked] = useState(false);
    const [submittedRoster, setSubmittedRoster] = useState<Player[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const matchRef = doc(db, 'calendario', calendarioId);
                const matchSnap = await getDoc(matchRef);
                
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatchInfo(data);
                    
                    // 🔒 VERIFICACIÓN DE SEGURIDAD
                    // Si ya existe una lista guardada para este equipo, BLOQUEAMOS la edición.
                    if (data.forma5 && data.forma5[equipoId] && data.forma5[equipoId].length > 0) {
                        setIsLocked(true);
                        setSubmittedRoster(data.forma5[equipoId]); // Guardamos la lista para mostrarla
                        setLoading(false);
                        return; // ⛔ DETENEMOS AQUÍ. No cargamos el selector editable.
                    }
                }

                // Si no está bloqueado, cargamos el roster para permitir selección
                const playersRef = collection(db, 'forma21s', equipoId, 'jugadores');
                const pSnap = await getDocs(playersRef);
                
                const roster = pSnap.docs.map(d => ({
                    id: d.id, 
                    ...d.data() 
                } as Player)).sort((a,b) => a.numero - b.numero);

                setAllPlayers(roster);

            } catch (error) {
                console.error("Error cargando datos:", error);
                alert("Error de conexión.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [calendarioId, equipoId]);

    const togglePlayer = (id: string) => {
        if (isLocked) return; // Doble seguridad

        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(pid => pid !== id));
        } else {
            if (selectedIds.length >= 12) {
                alert("⚠️ Máximo 12 jugadores permitidos.");
                return;
            }
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleSave = async () => {
        if (isLocked) return; 

        if (selectedIds.length < 5) {
            alert("⚠️ Debes seleccionar al menos 5 jugadores.");
            return;
        }

        const confirmacion = window.confirm(
            "⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\n" +
            "Una vez enviada la Forma 5, NO PODRÁS MODIFICARLA.\n" +
            "¿Estás seguro de que esta es la alineación definitiva?"
        );

        if (!confirmacion) return;

        setSaving(true);
        try {
            const finalRoster = allPlayers.filter(p => selectedIds.includes(p.id));
            const matchRef = doc(db, 'calendario', calendarioId);
            
            await updateDoc(matchRef, {
                [`forma5.${equipoId}`]: finalRoster
            });

            alert("✅ Forma 5 enviada y bloqueada correctamente.");
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', color:'white', display:'flex', justifyContent:'center', alignItems:'center', zIndex:3000}}>Verificando estado...</div>;

    // --- VISTA DE SOLO LECTURA (BLOQUEADO) ---
    if (isLocked) {
        return (
            <div className="animate-fade-in" style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, 
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
            }}>
                <div style={{
                    backgroundColor: 'white', width: '100%', maxWidth: '500px', maxHeight: '90vh', 
                    borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                    <div style={{padding: '20px', background: '#dc2626', color: 'white', textAlign:'center'}}>
                        <div style={{fontSize:'3rem'}}>🔒</div>
                        <h3 style={{margin: 0, fontSize: '1.2rem', textTransform:'uppercase'}}>Forma 5 Cerrada</h3>
                        <p style={{margin: '5px 0 0 0', opacity: 0.9, fontSize:'0.9rem'}}>
                            Ya has enviado la alineación para este partido.
                        </p>
                    </div>

                    <div style={{padding:'15px', background:'#fef2f2', borderBottom:'1px solid #fecaca', color:'#991b1b', fontSize:'0.9rem', textAlign:'center'}}>
                        ⚠️ No se permiten modificaciones bajo ningún concepto.
                    </div>

                    <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                        <h4 style={{marginTop:0, color:'#374151', borderBottom:'1px solid #eee', paddingBottom:'5px'}}>Jugadores Inscritos ({submittedRoster.length}):</h4>
                        <div style={{display: 'flex', flexDirection:'column', gap: '8px'}}>
                            {submittedRoster.map(p => (
                                <div key={p.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '15px',
                                    padding: '10px', borderRadius: '6px', background: '#f3f4f6', border: '1px solid #e5e7eb'
                                }}>
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '50%', 
                                        background: '#374151', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                    }}>
                                        {p.numero}
                                    </div>
                                    <span style={{fontWeight: 'bold', color: '#1f2937'}}>{p.nombre}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{padding: '20px', borderTop: '1px solid #eee', background: '#f9fafb'}}>
                        <button onClick={onClose} className="btn btn-secondary" style={{width:'100%'}}>Cerrar</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA DE SELECCIÓN (SOLO SI NO ESTÁ BLOQUEADO) ---
    return (
        <div className="animate-fade-in" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, 
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white', width: '100%', maxWidth: '600px', maxHeight: '90vh', 
                borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                {/* HEADER */}
                <div style={{padding: '20px', background: 'var(--primary)', color: 'white'}}>
                    <h3 style={{margin: 0, fontSize: '1.2rem'}}>📋 Definir Alineación (Forma 5)</h3>
                    <div style={{fontSize: '0.9rem', opacity: 0.9, marginTop: '5px'}}>
                        {matchInfo?.equipoLocalNombre} vs {matchInfo?.equipoVisitanteNombre}
                    </div>
                </div>

                {/* CONTADOR */}
                <div style={{padding: '15px', background: '#f3f4f6', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{fontWeight: 'bold', color: '#374151'}}>Selecciona los jugadores:</span>
                    <span style={{
                        background: selectedIds.length === 12 ? '#ef4444' : selectedIds.length >= 5 ? '#10b981' : '#f59e0b',
                        color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold'
                    }}>
                        {selectedIds.length} / 12
                    </span>
                </div>

                {/* LISTA */}
                <div style={{flex: 1, overflowY: 'auto', padding: '15px'}}>
                    {allPlayers.map(p => {
                        const isSelected = selectedIds.includes(p.id);
                        return (
                            <div key={p.id} onClick={() => togglePlayer(p.id)} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px', borderRadius: '8px', cursor: 'pointer',
                                border: isSelected ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                                background: isSelected ? '#eff6ff' : 'white',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '50%', 
                                        background: isSelected ? 'var(--primary)' : '#e5e7eb',
                                        color: isSelected ? 'white' : '#6b7280',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                    }}>
                                        {p.numero}
                                    </div>
                                    <span style={{fontWeight: isSelected ? 'bold' : 'normal', color: '#1f2937'}}>{p.nombre}</span>
                                </div>
                                <div style={{fontSize: '1.2rem', color: isSelected ? 'var(--primary)' : '#d1d5db'}}>
                                    {isSelected ? '☑️' : '⬜'}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* FOOTER */}
                <div style={{padding: '20px', borderTop: '1px solid #eee', display: 'flex', gap: '10px', background: '#f9fafb', flexDirection:'column'}}>
                    <div style={{fontSize:'0.8rem', color:'#ef4444', textAlign:'center', marginBottom:'5px', fontWeight:'bold'}}>
                        ⚠️ ATENCIÓN: Al guardar, la lista se bloqueará permanentemente.
                    </div>
                    <div style={{display:'flex', gap:'10px'}}>
                        <button onClick={onClose} className="btn btn-secondary" style={{flex: 1}}>Cancelar</button>
                        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{flex: 2}}>
                            {saving ? 'Enviando...' : '🔒 Enviar y Bloquear'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Forma5Selector;