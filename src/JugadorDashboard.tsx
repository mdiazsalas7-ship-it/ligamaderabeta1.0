import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase'; // Asegúrate de que storage esté exportado en firebase.ts
// CLAVE: Importamos lo necesario para subir la foto
import { collection, getDocs, query, where, updateDoc, collectionGroup } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { DocumentData } from 'firebase/firestore'; 
import PlayoffBracket from './PlayoffBracket';

interface Forma21 extends DocumentData {
    id: string;
    nombreEquipo: string;
    rosterCompleto?: boolean;
}

interface Partido extends DocumentData {
    id: string;
    jornada: number;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    equipoLocalId: string;
    equipoVisitanteId: string;
    marcadorLocal: number;
    marcadorVisitante: number;
    ganadorId: string;
}

interface JugadorDashboardProps {
    userCedula: string | null; // Cambiado para usar la cédula vinculada
    userName: string | null;
    formas21: Forma21[];
    setViewRosterId: (id: string | null) => void;
}

const JugadorDashboard: React.FC<JugadorDashboardProps> = ({ 
    userCedula, 
    userName, 
    formas21,
    setViewRosterId
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [misPartidos, setMisPartidos] = useState<Partido[]>([]);
    const [showBracket, setShowBracket] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Encontrar el equipo al que pertenece el jugador por las Formas 21 cargadas
    const miForma = formas21.find(f => f.id === formas21.find(form => form.nombreEquipo)?.id); 

    useEffect(() => {
        const fetchPartidos = async () => {
            // Buscamos si el jugador está en algún equipo para obtener su ID de equipo real
            if (!userCedula) {
                setLoading(false);
                return;
            }

            try {
                // Buscamos en todas las subcolecciones de jugadores quién tiene esta cédula
                const qJugador = query(collectionGroup(db, 'jugadores'), where('cedula', '==', userCedula));
                const snapJugador = await getDocs(qJugador);

                if (!snapJugador.empty) {
                    const equipoIdReal = snapJugador.docs[0].ref.parent.parent?.id;
                    
                    if (equipoIdReal) {
                        // Partidos donde mi equipo fue Local
                        const localQuery = query(collection(db, 'calendario'), where('equipoLocalId', '==', equipoIdReal), where('estatus', '==', 'finalizado'));
                        const localSnapshot = await getDocs(localQuery);

                        // Partidos donde mi equipo fue Visitante
                        const visitanteQuery = query(collection(db, 'calendario'), where('equipoVisitanteId', '==', equipoIdReal), where('estatus', '==', 'finalizado'));
                        const visitanteSnapshot = await getDocs(visitanteQuery);
                        
                        const partidosLocal = localSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partido));
                        const partidosVisitante = visitanteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partido));
                        
                        const todosMisPartidos = [...partidosLocal, ...partidosVisitante]
                            .sort((a, b) => (b.jornada || 0) - (a.jornada || 0));

                        setMisPartidos(todosMisPartidos);
                    }
                }
            } catch (err) {
                console.error(err);
                setError("Error al cargar datos.");
            } finally {
                setLoading(false);
            }
        };

        fetchPartidos();
    }, [userCedula]);

    // --- FUNCIÓN PARA QUE EL JUGADOR SUBA SU PROPIA FOTO ---
    const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !userCedula) return;
        
        const file = e.target.files[0];
        setUploading(true);

        try {
            // 1. Subir a Storage
            const storageRef = ref(storage, `jugadores_fotos/${userCedula}.jpg`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // 2. Actualizar su ficha en la Forma 21 (Buscando por cédula)
            const q = query(collectionGroup(db, 'jugadores'), where('cedula', '==', userCedula));
            const snap = await getDocs(q);
            
            const promises = snap.docs.map(d => updateDoc(d.ref, { fotoUrl: url }));
            await Promise.all(promises);

            alert("✅ ¡Tu foto ha sido actualizada! Ya aparece en tu barajita de equipo.");
        } catch (error) {
            console.error(error);
            alert("Error al subir la foto.");
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <p style={{textAlign: 'center', color: 'white'}}>Cargando panel de jugador...</p>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left', color: 'white' }}>
            
            {showBracket && <PlayoffBracket adminMode={false} onClose={() => setShowBracket(false)} />}

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: '2px solid #fbbf24', paddingBottom: '10px', marginBottom:'20px'}}>
                <h3 style={{margin:0}}>⭐ Panel de Jugador: {userName}</h3>
                <button 
                    onClick={() => setShowBracket(true)}
                    className="btn"
                    style={{
                        background: 'linear-gradient(45deg, #f59e0b, #d97706)',
                        color: 'white', border: 'none', borderRadius: '5px',
                        padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer', fontSize:'0.8rem'
                    }}
                >
                    🏆 Playoffs
                </button>
            </div>

            {/* SECCIÓN DE AUTOCARGA DE FOTO */}
            <div className="card" style={{ marginBottom: '30px', background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
                <h4 style={{margin: '0 0 10px 0', color: '#fbbf24'}}>📸 Gestionar mi Foto</h4>
                <p style={{fontSize: '0.85rem', opacity: 0.8}}>Sube tu foto para que aparezca en tu barajita oficial de la liga.</p>
                
                <input 
                    type="file" 
                    accept="image/*" 
                    id="foto-input" 
                    style={{display: 'none'}} 
                    onChange={handleUploadFoto} 
                />
                <label 
                    htmlFor="foto-input" 
                    className="btn" 
                    style={{ 
                        display: 'inline-block', background: '#3b82f6', color: 'white', 
                        padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px'
                    }}
                >
                    {uploading ? '⌛ Subiendo...' : '🤳 Tomar o Subir Foto'}
                </label>
            </div>

            {/* Roster del Equipo */}
            <div className="data-block-container" style={{ marginBottom: '30px', background: 'white', padding: '15px', borderRadius: '10px', color: '#333' }}>
                <div style={{fontWeight: 'bold', borderBottom: '1px solid #eee', marginBottom: '10px', paddingBottom: '5px'}}>Información de Plantilla</div>
                <p style={{fontSize: '0.9rem'}}>Cédula vinculada: <strong>{userCedula}</strong></p>
                
                {miForma && (
                    <button 
                        onClick={() => setViewRosterId(miForma.id)} 
                        className="btn btn-secondary" 
                        style={{ fontSize: '12px', padding: '8px 15px', width: '100%' }}
                    >
                        Ver Lista de Compañeros
                    </button>
                )}
            </div>

            {/* Historial de Partidos Jugados */}
            <div className="data-block-container" style={{ background: 'white', padding: '15px', borderRadius: '10px', color: '#333' }}>
                <div style={{fontWeight: 'bold', borderBottom: '1px solid #eee', marginBottom: '10px', paddingBottom: '5px'}}>Últimos Resultados de mi Equipo</div>
                {misPartidos.length === 0 ? (
                    <p style={{fontSize: '0.85rem', color: '#666'}}>Aún no hay partidos finalizados registrados.</p>
                ) : (
                    <table style={{width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{textAlign: 'left', color: '#888'}}>
                                <th style={{padding: '8px'}}>Rival</th>
                                <th>Score</th>
                                <th>Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {misPartidos.map(p => {
                                const esLocal = p.equipoLocalId === (formas21.find(f => f.nombreEquipo)?.id); // Simplificado
                                const miMarcador = esLocal ? p.marcadorLocal : p.marcadorVisitante;
                                const opMarcador = esLocal ? p.marcadorVisitante : p.marcadorLocal;
                                const oponenteNombre = esLocal ? p.equipoVisitanteNombre : p.equipoLocalNombre;
                                
                                const gano = miMarcador > opMarcador;

                                return (
                                    <tr key={p.id} style={{borderTop: '1px solid #f3f4f6'}}>
                                        <td style={{padding: '10px 8px'}}>{oponenteNombre}</td>
                                        <td style={{fontWeight:'bold'}}>{miMarcador} - {opMarcador}</td>
                                        <td>
                                            <span style={{ 
                                                color: gano ? '#10b981' : '#ef4444', fontWeight: 'bold'
                                            }}>
                                                {gano ? 'GANADO' : 'PERDIDO'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default JugadorDashboard;