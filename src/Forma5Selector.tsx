import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

interface Player { id: string; nombre: string; numero: number; cedula?: string; }
interface Staff { entrenador: string; asistente: string; }

const Forma5Selector: React.FC<{ 
    calendarioId: string, 
    equipoId: string, 
    onSuccess: () => void, 
    onClose: () => void 
}> = ({ calendarioId, equipoId, onSuccess, onClose }) => {

    const [allPlayers, setAllPlayers] = useState<Player[]>([]); // Roster completo disponible
    const [selectedIds, setSelectedIds] = useState<string[]>([]); // Selección actual (Máx 12)
    const [startersIds, setStartersIds] = useState<string[]>([]); // IDs de los 5 abridores
    const [captainId, setCaptainId] = useState<string | null>(null); // ID del capitán
    
    const [matchInfo, setMatchInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [staff, setStaff] = useState<Staff>({ entrenador: '', asistente: '' });
    
    const [isLocked, setIsLocked] = useState(false);
    const [submittedRoster, setSubmittedRoster] = useState<any[]>([]); // Lista de jugadores guardados
    const [submittedStarters, setSubmittedStarters] = useState<string[]>([]); // IDs de abridores guardados

    useEffect(() => {
        const loadData = async () => {
            try {
                const matchRef = doc(db, 'calendario', calendarioId);
                const matchSnap = await getDoc(matchRef);
                
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatchInfo(data);
                    
                    // 🔒 VERIFICACIÓN DE SEGURIDAD (Si ya existe lista guardada)
                    const forma5Data = data.forma5?.[equipoId];

                    if (forma5Data && forma5Data.jugadores && forma5Data.jugadores.length > 0) {
                        setIsLocked(true);
                        
                        // Cargar datos guardados
                        setSubmittedRoster(forma5Data.jugadores);
                        setSubmittedStarters(forma5Data.startersIds || []);
                        setCaptainId(forma5Data.captainId || null);

                        // Cargar Staff guardado para vista bloqueada
                        const isLocal = data.equipoLocalId === equipoId;
                        const savedStaff = isLocal ? data.staffLocal : data.staffVisitante;
                        if (savedStaff) setStaff(savedStaff); else setStaff({ entrenador: 'No registrado', asistente: 'No registrado' });

                        setLoading(false);
                        return;
                    }
                }

                // 2. Si NO está bloqueado, cargamos datos actuales para editar
                
                // A) Cargar Jugadores
                const playersRef = collection(db, 'forma21s', equipoId, 'jugadores');
                const pSnap = await getDocs(playersRef);
                const roster = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)).sort((a,b) => a.numero - b.numero);
                setAllPlayers(roster);

                // B) Cargar Staff actual
                const f21Ref = doc(db, 'forma21s', equipoId);
                const f21Snap = await getDoc(f21Ref);
                if (f21Snap.exists()) {
                    const d = f21Snap.data();
                    setStaff({
                        entrenador: d.entrenador || 'No registrado',
                        asistente: d.asistente || 'No registrado'
                    });
                }

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
        if (isLocked) return;

        if (selectedIds.includes(id)) {
            // Si lo deselecciona, debe dejar de ser capitán o abridor si lo era
            setSelectedIds(prev => prev.filter(pid => pid !== id));
            setStartersIds(prev => prev.filter(pid => pid !== id));
            if (captainId === id) setCaptainId(null);
        } else {
            if (selectedIds.length >= 12) {
                alert("⚠️ Máximo 12 jugadores permitidos.");
                return;
            }
            setSelectedIds(prev => [...prev, id]);
        }
    };
    
    // --- NUEVAS FUNCIONES PARA ROLES ---

    const toggleStarter = (id: string) => {
        if (!selectedIds.includes(id)) return;
        
        setStartersIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(pid => pid !== id);
            } else {
                if (prev.length >= 5) {
                    alert("⚠️ Solo 5 jugadores pueden ser titulares.");
                    return prev;
                }
                return [...prev, id];
            }
        });
    };
    
    const toggleCaptain = (id: string) => {
        if (!selectedIds.includes(id)) return;
        setCaptainId(prev => (prev === id ? null : id));
    };


    const handleSave = async () => {
        if (isLocked) return; 
        const finalRoster = allPlayers.filter(p => selectedIds.includes(p.id));

        if (finalRoster.length < 5) {
            alert("⚠️ Debes seleccionar al menos 5 jugadores.");
            return;
        }
        if (startersIds.length !== 5) {
            alert("⚠️ Debes seleccionar exactamente 5 jugadores abridores (titulares).");
            return;
        }
        if (!captainId) {
             alert("⚠️ Debes seleccionar un Capitán.");
            return;
        }


        const confirmacion = window.confirm(
            "⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\n" +
            "Una vez enviada la Forma 5 (Jugadores, Titulares y Capitán), NO PODRÁS MODIFICARLA.\n" +
            "¿Estás seguro de que esta es la alineación definitiva?"
        );

        if (!confirmacion) return;

        setSaving(true);
        try {
            const matchRef = doc(db, 'calendario', calendarioId);
            
            const isLocal = matchInfo.equipoLocalId === equipoId;
            const staffField = isLocal ? 'staffLocal' : 'staffVisitante';

            await updateDoc(matchRef, {
                [`forma5.${equipoId}`]: {
                    jugadores: finalRoster, 
                    startersIds: startersIds, 
                    captainId: captainId 
                },
                [staffField]: staff 
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

    const count = selectedIds.length;
    
    // --- VISTA DE SOLO LECTURA (BLOQUEADO) ---
    if (isLocked) {
         // En vista de solo lectura, submittedRoster ya contiene la lista de jugadores
        const captain = submittedRoster.find(p => p.id === captainId);

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
                            Alineación y Cuerpo Técnico validados.
                        </p>
                    </div>

                    {/* CAPITÁN Y STAFF GUARDADO */}
                    <div style={{padding:'15px', background:'#fef2f2', borderBottom:'1px solid #fecaca', color:'#991b1b', fontSize:'0.9rem'}}>
                        <div style={{fontWeight:'bold', color:'#374151', marginBottom:'5px'}}>⭐ Capitán: {captain?.nombre || 'N/A'}</div>
                         <div style={{fontWeight:'bold', color:'#374151', marginBottom:'5px'}}>👔 DT: {staff.entrenador} | AT: {staff.asistente}</div>
                    </div>

                    <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
                        <h4 style={{marginTop:0, color:'#374151', borderBottom:'1px solid #eee', paddingBottom:'5px'}}>Jugadores Inscritos ({submittedRoster.length}):</h4>
                        <div style={{display: 'flex', flexDirection:'column', gap: '8px'}}>
                            {submittedRoster.map(p => (
                                <div key={p.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px', borderRadius: '6px', background: '#f3f4f6', border: '1px solid #e5e7eb'
                                }}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                        <div style={{
                                            width: '30px', height: '30px', borderRadius: '50%', 
                                            background: '#374151', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                        }}>
                                            {p.numero}
                                        </div>
                                        <span style={{fontWeight: 'bold', color: '#1f2937'}}>{p.nombre}</span>
                                    </div>
                                    <div style={{fontSize:'0.8rem', fontWeight:'bold', color: submittedStarters.includes(p.id) ? '#10b981' : '#666'}}>
                                        {submittedStarters.includes(p.id) ? 'TITULAR' : 'SUPLENTE'}
                                    </div>
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

    // --- VISTA DE SELECCIÓN (EDICIÓN) ---
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

                {/* INFO STAFF A REGISTRAR */}
                <div style={{padding: '15px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', fontSize:'0.9rem'}}>
                    <div style={{fontWeight:'bold', color:'#1e40af', marginBottom:'5px'}}>👔 Cuerpo Técnico: DT: {staff.entrenador} | AT: {staff.asistente}</div>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', marginTop: '10px',
                        padding: '10px', background: '#e0f2fe', borderRadius: '4px', border: startersIds.length === 5 ? '2px solid #10b981' : '2px dashed #f59e0b'
                    }}>
                        <div>Titulares seleccionados: <strong>{startersIds.length} / 5</strong></div>
                        <div>Capitán: <strong>{captainId ? allPlayers.find(p => p.id === captainId)?.nombre : 'N/A'}</strong></div>
                    </div>
                </div>

                {/* CONTADOR */}
                <div style={{padding: '10px 15px', background: '#f3f4f6', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{fontWeight: 'bold', color: '#374151'}}>Selecciona los 5 Titulares y el Capitán:</span>
                    <span style={{
                        background: selectedIds.length === 12 ? '#ef4444' : selectedIds.length >= 5 ? '#10b981' : '#f59e0b',
                        color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold'
                    }}>
                        Total: {selectedIds.length} / 12
                    </span>
                </div>

                {/* LISTA DE JUGADORES */}
                <div style={{flex: 1, overflowY: 'auto', padding: '15px'}}>
                    {allPlayers.map(p => {
                        const isSelected = selectedIds.includes(p.id);
                        const isStarter = startersIds.includes(p.id);
                        const isCaptain = captainId === p.id;

                        return (
                            <div key={p.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom:'8px',
                                border: isSelected ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                                background: isSelected ? '#eff6ff' : 'white',
                                opacity: isSelected ? 1 : 0.6
                            }}>
                                {/* INFO */}
                                <div onClick={() => togglePlayer(p.id)} style={{display: 'flex', alignItems: 'center', gap: '15px', flex:1}}>
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
                                
                                {/* CONTROLES DE ROL */}
                                {isSelected && (
                                    <div style={{display:'flex', gap:'5px'}}>
                                        <button 
                                            onClick={() => toggleCaptain(p.id)}
                                            style={{
                                                padding:'5px 10px', fontSize:'0.75rem', fontWeight:'bold', borderRadius:'4px',
                                                background: isCaptain ? '#f59e0b' : '#fef3c7',
                                                color: isCaptain ? 'white' : '#92400e', border:'none', cursor:'pointer'
                                            }}
                                            title="Seleccionar Capitán"
                                        >
                                            {isCaptain ? '⭐ CAPITÁN' : 'HACER CAPITÁN'}
                                        </button>
                                        
                                        <button 
                                            onClick={() => toggleStarter(p.id)}
                                            style={{
                                                padding:'5px 10px', fontSize:'0.75rem', fontWeight:'bold', borderRadius:'4px',
                                                background: isStarter ? '#10b981' : '#d1fae5',
                                                color: isStarter ? 'white' : '#065f46', border:'none', cursor:'pointer'
                                            }}
                                            title="Marcar como Abridor (Titular)"
                                        >
                                            {isStarter ? '✅ TITULAR' : 'HACER TITULAR'} ({startersIds.length}/5)
                                        </button>
                                    </div>
                                )}
                                
                                {/* INDICADOR DE SELECCIÓN GENERAL */}
                                <div onClick={() => togglePlayer(p.id)} style={{fontSize: '1.2rem', color: isSelected ? 'var(--primary)' : '#d1d5db', marginLeft:'10px'}}>
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
                        <button 
                            onClick={handleSave} 
                            disabled={saving || startersIds.length !== 5 || !captainId} 
                            className="btn btn-primary" 
                            style={{flex: 2}}
                        >
                            {saving ? 'Enviando...' : '🔒 Enviar y Bloquear'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Forma5Selector;