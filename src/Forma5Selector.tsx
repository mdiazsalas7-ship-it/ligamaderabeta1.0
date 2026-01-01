import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

// Interfaz completa (lo que viene de la BD)
interface Player { 
    id: string; 
    nombre: string; 
    numero: number; 
    cedula?: string; 
    telefono?: string; 
    suspendido?: boolean; 
}

interface Staff { entrenador: string; asistente: string; }

const Forma5Selector: React.FC<{ 
    calendarioId: string, 
    equipoId: string, 
    onSuccess: () => void, 
    onClose: () => void 
}> = ({ calendarioId, equipoId, onSuccess, onClose }) => {

    const [allPlayers, setAllPlayers] = useState<Player[]>([]); 
    const [selectedIds, setSelectedIds] = useState<string[]>([]); // Máx 12
    const [startersIds, setStartersIds] = useState<string[]>([]); // Exactamente 5
    const [captainId, setCaptainId] = useState<string | null>(null); // Exactamente 1
    
    const [matchInfo, setMatchInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [staff, setStaff] = useState<Staff>({ entrenador: '', asistente: '' });
    const [isLocked, setIsLocked] = useState(false);
    const [submittedRoster, setSubmittedRoster] = useState<any[]>([]); 
    const [submittedStarters, setSubmittedStarters] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Revisar si ya se envió la Forma 5 para este partido
                const matchRef = doc(db, 'calendario', calendarioId);
                const matchSnap = await getDoc(matchRef);
                
                if (matchSnap.exists()) {
                    const data = matchSnap.data();
                    setMatchInfo(data);
                    
                    const forma5Data = data.forma5?.[equipoId];

                    if (forma5Data && forma5Data.jugadores && forma5Data.jugadores.length > 0) {
                        // YA FUE ENVIADA -> MODO SOLO LECTURA
                        setIsLocked(true);
                        setSubmittedRoster(forma5Data.jugadores);
                        setSubmittedStarters(forma5Data.startersIds || []);
                        setCaptainId(forma5Data.captainId || null);

                        const isLocal = data.equipoLocalId === equipoId;
                        const savedStaff = isLocal ? data.staffLocal : data.staffVisitante;
                        if (savedStaff) setStaff(savedStaff);
                        
                        setLoading(false);
                        return;
                    }
                }

                // 2. Si NO ha sido enviada, cargamos la Forma 21 (Pool de jugadores)
                const playersRef = collection(db, 'forma21s', equipoId, 'jugadores');
                const pSnap = await getDocs(playersRef);
                const roster = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
                
                // Ordenar por número de camiseta
                roster.sort((a,b) => a.numero - b.numero);
                setAllPlayers(roster);

                // Cargar Staff desde la Forma 21
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

    // --- LÓGICA DE SELECCIÓN ---
    const togglePlayer = (player: Player) => {
        if (isLocked) return;

        // 1. Bloqueo si está suspendido por el Admin
        if (player.suspendido) {
            alert(`⛔ El jugador ${player.nombre} está SUSPENDIDO y no puede jugar.`);
            return;
        }

        if (selectedIds.includes(player.id)) {
            // Deseleccionar: Limpiar roles si los tenía
            setSelectedIds(prev => prev.filter(pid => pid !== player.id));
            setStartersIds(prev => prev.filter(pid => pid !== player.id));
            if (captainId === player.id) setCaptainId(null);
        } else {
            // Seleccionar: Validar Máximo 12 (Regla FIBA)
            if (selectedIds.length >= 12) {
                alert("⚠️ Máximo 12 jugadores permitidos en la hoja de anotación.");
                return;
            }
            setSelectedIds(prev => [...prev, player.id]);
        }
    };
    
    const toggleStarter = (id: string) => {
        if (!selectedIds.includes(id)) return;
        setStartersIds(prev => {
            if (prev.includes(id)) return prev.filter(pid => pid !== id);
            if (prev.length >= 5) { alert("⚠️ Ya hay 5 titulares seleccionados."); return prev; }
            return [...prev, id];
        });
    };
    
    const toggleCaptain = (id: string) => {
        if (!selectedIds.includes(id)) return;
        setCaptainId(prev => (prev === id ? null : id));
    };

    const handleSave = async () => {
        if (isLocked) return; 
        
        // --- VALIDACIONES FIBA ---
        if (selectedIds.length < 5) return alert("⚠️ Mínimo 5 jugadores para iniciar el partido.");
        if (startersIds.length !== 5) return alert("⚠️ Debes marcar exactamente 5 titulares.");
        if (!captainId) return alert("⚠️ Debes designar un Capitán.");

        if (!window.confirm("⚠️ ¿Enviar Forma 5 Definitiva?\n\nNo podrás hacer cambios después.")) return;

        setSaving(true);
        try {
            // 1. Filtrar jugadores seleccionados
            const rawRoster = allPlayers.filter(p => selectedIds.includes(p.id));

            // 2. LIMPIEZA DE DATOS (IMPORTANTE)
            // Solo guardamos ID, Nombre y Número en el partido. Borramos Cédula y Teléfono.
            const cleanRoster = rawRoster.map(p => ({
                id: p.id,
                nombre: p.nombre,
                numero: p.numero
                // NO incluimos cedula ni telefono aquí
            }));

            const matchRef = doc(db, 'calendario', calendarioId);
            const isLocal = matchInfo.equipoLocalId === equipoId;
            const staffField = isLocal ? 'staffLocal' : 'staffVisitante';

            // Guardar en el documento del partido (Calendario)
            await updateDoc(matchRef, {
                [`forma5.${equipoId}`]: {
                    jugadores: cleanRoster, // Lista limpia
                    startersIds: startersIds, 
                    captainId: captainId 
                },
                [staffField]: staff 
            });

            alert("✅ Alineación enviada correctamente.");
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{position:'fixed', top:0, left:0, bottom:0, right:0, background:'rgba(0,0,0,0.8)', color:'white', display:'flex', justifyContent:'center', alignItems:'center', zIndex:3000}}>Cargando...</div>;

    // --- VISTA BLOQUEADA (YA ENVIADA) ---
    if (isLocked) {
        const captain = submittedRoster.find(p => p.id === captainId);
        return (
            <div className="animate-fade-in" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{backgroundColor: 'white', width: '90%', maxWidth: '500px', borderRadius: '12px', overflow: 'hidden'}}>
                    <div style={{padding: '20px', background: '#166534', color: 'white', textAlign:'center'}}>
                        <h3>✅ Forma 5 Enviada</h3>
                        <p style={{margin:0, fontSize:'0.9rem'}}>Lista oficial entregada a la mesa técnica.</p>
                    </div>
                    <div style={{padding:'15px', background:'#f0fdf4', borderBottom:'1px solid #bbf7d0', fontSize:'0.9rem'}}>
                        <div><strong>DT:</strong> {staff.entrenador}</div>
                        <div><strong>Capitán:</strong> {captain?.nombre || 'N/A'}</div>
                    </div>
                    <div style={{maxHeight:'300px', overflowY:'auto', padding:'15px'}}>
                        {submittedRoster.map(p => (
                            <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'8px', borderBottom:'1px solid #eee', fontSize:'0.9rem'}}>
                                <span>#{p.numero} {p.nombre}</span>
                                {submittedStarters.includes(p.id) && <span style={{color:'green', fontWeight:'bold'}}>TITULAR</span>}
                            </div>
                        ))}
                    </div>
                    <div style={{padding:'15px', textAlign:'center'}}>
                        <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA DE SELECCIÓN ---
    return (
        <div className="animate-fade-in" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding:'10px'}}>
            <div style={{backgroundColor: 'white', width: '100%', maxWidth: '600px', maxHeight: '95vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                
                {/* HEADER */}
                <div style={{padding: '15px', background: 'var(--primary)', color: 'white'}}>
                    <h3 style={{margin: 0, fontSize: '1.1rem'}}>📋 Seleccionar Jugadores (Juego)</h3>
                    <div style={{fontSize:'0.8rem', opacity:0.8}}>{matchInfo?.equipoLocalNombre} vs {matchInfo?.equipoVisitanteNombre}</div>
                </div>

                {/* STAFF INFO */}
                <div style={{padding: '10px 15px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', fontSize:'0.85rem'}}>
                    <strong>Cuerpo Técnico:</strong> DT: {staff.entrenador} | AT: {staff.asistente}
                </div>

                {/* CONTADORES */}
                <div style={{padding: '10px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between', fontSize:'0.85rem'}}>
                    <span style={{color: selectedIds.length >= 5 && selectedIds.length <= 12 ? 'green' : 'red', fontWeight:'bold'}}>
                        Jugadores: {selectedIds.length} / 12
                    </span>
                    <span style={{color: startersIds.length === 5 ? 'green' : 'orange', fontWeight:'bold'}}>
                        Titulares: {startersIds.length} / 5
                    </span>
                    <span style={{color: captainId ? 'green' : 'red', fontWeight:'bold'}}>
                        Capitán: {captainId ? 'OK' : 'Falta'}
                    </span>
                </div>

                {/* LISTA JUGADORES */}
                <div style={{flex: 1, overflowY: 'auto', padding: '10px'}}>
                    {allPlayers.map(p => {
                        const isSelected = selectedIds.includes(p.id);
                        const isStarter = startersIds.includes(p.id);
                        const isCaptain = captainId === p.id;
                        const isSuspended = p.suspendido === true;

                        return (
                            <div key={p.id} style={{
                                marginBottom:'8px', padding:'10px', borderRadius:'6px',
                                border: isSuspended ? '1px solid #fca5a5' : (isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0'),
                                background: isSuspended ? '#fef2f2' : (isSelected ? '#eff6ff' : 'white'),
                                opacity: isSuspended ? 0.6 : 1
                            }}>
                                {/* FILA PRINCIPAL: CHECKBOX + NOMBRE + NUMERO */}
                                <div onClick={() => togglePlayer(p)} style={{display:'flex', alignItems:'center', cursor: isSuspended ? 'not-allowed' : 'pointer'}}>
                                    <div style={{fontSize:'1.2rem', marginRight:'10px'}}>
                                        {isSuspended ? '⛔' : (isSelected ? '✅' : '⬜')}
                                    </div>
                                    <div style={{
                                        width:'30px', height:'30px', borderRadius:'50%', 
                                        background: isSuspended ? '#ef4444' : '#1e40af', color:'white', 
                                        display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', marginRight:'10px'
                                    }}>
                                        {p.numero}
                                    </div>
                                    <div style={{fontWeight:'bold', color: isSuspended ? '#991b1b' : '#334155', flex:1}}>
                                        {p.nombre} {isSuspended && <span style={{fontSize:'0.7rem', color:'red'}}>(SUSPENDIDO)</span>}
                                    </div>
                                </div>

                                {/* BOTONES EXTRA (SOLO SI ESTÁ SELECCIONADO) */}
                                {isSelected && !isSuspended && (
                                    <div style={{marginTop:'8px', display:'flex', gap:'8px', paddingLeft:'35px'}}>
                                        <button 
                                            onClick={() => toggleStarter(p.id)}
                                            style={{
                                                flex:1, padding:'6px', borderRadius:'4px', border:'none', fontSize:'0.75rem', fontWeight:'bold', cursor:'pointer',
                                                background: isStarter ? '#16a34a' : '#dcfce7', color: isStarter ? 'white' : '#166534'
                                            }}
                                        >
                                            {isStarter ? 'TITULAR' : 'Hacer Titular'}
                                        </button>
                                        <button 
                                            onClick={() => toggleCaptain(p.id)}
                                            style={{
                                                flex:1, padding:'6px', borderRadius:'4px', border:'none', fontSize:'0.75rem', fontWeight:'bold', cursor:'pointer',
                                                background: isCaptain ? '#ca8a04' : '#fef9c3', color: isCaptain ? 'white' : '#854d0e'
                                            }}
                                        >
                                            {isCaptain ? 'CAPITÁN' : 'Hacer Capitán'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* FOOTER */}
                <div style={{padding: '15px', borderTop: '1px solid #eee', background: '#f8fafc', display:'flex', gap:'10px'}}>
                    <button onClick={onClose} className="btn btn-secondary" style={{flex:1}}>Cancelar</button>
                    <button 
                        onClick={handleSave} 
                        className="btn btn-primary" 
                        style={{flex:2}}
                        disabled={saving || selectedIds.length < 5 || startersIds.length !== 5 || !captainId}
                    >
                        {saving ? 'Enviando...' : '🔒 Enviar Forma 5'}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default Forma5Selector;