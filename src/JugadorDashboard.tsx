import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase'; // Agregamos storage
// Agregamos collectionGroup y updateDoc para la búsqueda y actualización de la foto
import { collection, getDocs, query, where, collectionGroup, updateDoc } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Importaciones de Storage
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
    userCedula: string | null; // Cambiamos esto para usar la cédula como llave
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
    
    // ESTADOS NUEVOS PARA LA FOTO
    const [miFotoUrl, setMiFotoUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [playerDocRef, setPlayerDocRef] = useState<any>(null); // Referencia al documento del jugador
    const [miEquipoId, setMiEquipoId] = useState<string | null>(null);
    const [miEquipoNombre, setMiEquipoNombre] = useState<string>('');

    // 1. BUSCAR JUGADOR POR CÉDULA (CRUCIAL PARA LA FOTO)
    useEffect(() => {
        const findMyPlayerProfile = async () => {
            if (!userCedula) { 
                setLoading(false); 
                return; 
            }

            try {
                // Buscamos en todas las subcolecciones 'jugadores' de la base de datos
                const q = query(collectionGroup(db, 'jugadores'), where('cedula', '==', userCedula));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    const data = docSnap.data();
                    
                    setPlayerDocRef(docSnap.ref); // Guardamos la referencia para poder actualizar la foto después
                    setMiFotoUrl(data.fotoUrl || '');
                    
                    // Encontrar el ID del equipo (el documento padre de la subcolección)
                    const equipoRef = docSnap.ref.parent.parent;
                    if (equipoRef) {
                        setMiEquipoId(equipoRef.id);
                        // Buscar el nombre del equipo en las props
                        const equipoEncontrado = formas21.find(f => f.id === equipoRef.id);
                        if (equipoEncontrado) setMiEquipoNombre(equipoEncontrado.nombreEquipo);
                    }
                }
            } catch (error) {
                console.error("Error buscando perfil por cédula:", error);
                // Si falla el índice de collectionGroup, no rompemos la app, solo no carga la foto
            } finally {
                setLoading(false);
            }
        };

        findMyPlayerProfile();
    }, [userCedula, formas21]);

    // 2. CARGAR PARTIDOS (Usando el ID de equipo encontrado)
    useEffect(() => {
        if (!miEquipoId) return;

        const fetchPartidos = async () => {
            try {
                const localQuery = query(collection(db, 'calendario'), where('equipoLocalId', '==', miEquipoId), where('estatus', '==', 'finalizado'));
                const localSnapshot = await getDocs(localQuery);

                const visitanteQuery = query(collection(db, 'calendario'), where('equipoVisitanteId', '==', miEquipoId), where('estatus', '==', 'finalizado'));
                const visitanteSnapshot = await getDocs(visitanteQuery);
                
                const partidosLocal = localSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partido));
                const partidosVisitante = visitanteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partido));
                
                const todosMisPartidos = [...partidosLocal, ...partidosVisitante]
                    .sort((a, b) => (b.jornada || 0) - (a.jornada || 0));

                setMisPartidos(todosMisPartidos);

            } catch (err) {
                console.error(err);
            }
        };

        fetchPartidos();
    }, [miEquipoId]);

    // 3. FUNCIÓN PARA SUBIR FOTO
    const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !userCedula || !playerDocRef) return;
        
        const file = e.target.files[0];
        setUploading(true);

        try {
            // A. Subir a Storage
            const storageRef = ref(storage, `jugadores_fotos/${userCedula}.jpg`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // B. Guardar URL en Firestore
            await updateDoc(playerDocRef, { fotoUrl: url });
            
            setMiFotoUrl(url);
            alert("✅ Foto actualizada con éxito.");
        } catch (error) {
            console.error(error);
            alert("Error al subir la foto.");
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <p style={{textAlign: 'center'}}>Cargando perfil...</p>;
    if (!miEquipoId) return (
        <div style={{textAlign:'center', padding:'20px', background:'white', borderRadius:'10px'}}>
            <h3>⚠️ Perfil no vinculado</h3>
            <p>No encontramos un jugador con la cédula <strong>{userCedula}</strong> en ningún equipo.</p>
            <p>Por favor, pide a tu delegado que verifique tu número de cédula en el Roster.</p>
        </div>
    );

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            
            {showBracket && <PlayoffBracket adminMode={false} onClose={() => setShowBracket(false)} />}

            {/* HEADER CON FOTO TIPO BARAJITA */}
            <div style={{
                display:'flex', alignItems:'center', gap:'20px', 
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', 
                padding: '20px', borderRadius: '12px', color: 'white', marginBottom: '20px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
                <div style={{position: 'relative'}}>
                    <div style={{
                        width: '90px', height: '90px', borderRadius: '50%', 
                        border: '3px solid #f59e0b', overflow: 'hidden', 
                        background: '#374151', display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        {miFotoUrl ? (
                            <img src={miFotoUrl} style={{width: '100%', height: '100%', objectFit: 'cover'}} alt="Jugador" />
                        ) : (
                            <span style={{fontSize: '2.5rem'}}>👤</span>
                        )}
                    </div>
                    <label htmlFor="foto-upload" style={{
                        position: 'absolute', bottom: 0, right: 0, 
                        background: '#3b82f6', width: '32px', height: '32px', borderRadius: '50%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white'
                    }}>
                        📷
                    </label>
                    <input 
                        type="file" 
                        id="foto-upload" 
                        accept="image/*" 
                        style={{display: 'none'}} 
                        onChange={handleUploadFoto} 
                        disabled={uploading} 
                    />
                </div>
                <div>
                    <h2 style={{margin: 0, fontSize: '1.5rem'}}>{userName}</h2>
                    <div style={{color: '#9ca3af', fontSize: '0.9rem'}}>{miEquipoNombre}</div>
                    {uploading && <div style={{fontSize: '0.8rem', color: '#fbbf24'}}>Subiendo foto...</div>}
                </div>
            </div>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom:'20px'}}>
                <h3 style={{margin:0}}>⭐ Mi Equipo</h3>
                <button 
                    onClick={() => setShowBracket(true)}
                    className="btn"
                    style={{
                        background: 'linear-gradient(45deg, #7c3aed, #6d28d9)',
                        color: 'white', border: 'none', borderRadius: '5px',
                        padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer', fontSize:'0.9rem',
                        display:'flex', alignItems:'center', gap:'5px'
                    }}
                >
                    🏆 Ver Playoffs
                </button>
            </div>

            {/* Roster del Equipo */}
            <div className="data-block-container" style={{ marginBottom: '30px' }}>
                <div className="data-block-header">Gestión de Roster</div>
                <p>Estás verificado como jugador activo.</p>
                
                <button 
                    onClick={() => setViewRosterId(miEquipoId)} 
                    className="btn btn-secondary" 
                    style={{ fontSize: '12px', padding: '10px 20px', width: '100%' }}
                >
                    Ver Lista de Compañeros
                </button>
            </div>

            {/* Historial de Partidos Jugados */}
            <div className="data-block-container">
                <div className="data-block-header">Últimos Resultados</div>
                {misPartidos.length === 0 ? (
                    <p>Tu equipo aún no ha jugado partidos oficiales.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Jornada</th>
                                <th>Oponente</th>
                                <th>Resultado</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {misPartidos.map(p => {
                                const esLocal = p.equipoLocalId === miEquipoId;
                                const miMarcador = esLocal ? p.marcadorLocal : p.marcadorVisitante;
                                const opMarcador = esLocal ? p.marcadorVisitante : p.marcadorLocal;
                                const oponenteNombre = esLocal ? p.equipoVisitanteNombre : p.equipoLocalNombre;
                                
                                let resultadoTexto = 'EMPATE';
                                let color = 'gray';
                                
                                if (miMarcador > opMarcador) {
                                    resultadoTexto = 'VICTORIA';
                                    color = '#10b981'; // Verde
                                } else if (miMarcador < opMarcador) {
                                    resultadoTexto = 'DERROTA';
                                    color = '#ef4444'; // Rojo
                                }

                                return (
                                    <tr key={p.id}>
                                        <td>{p.jornada || '-'}</td>
                                        <td>vs {oponenteNombre}</td>
                                        <td style={{fontWeight:'bold'}}>{miMarcador} - {opMarcador}</td>
                                        <td>
                                            <span style={{ 
                                                backgroundColor: color, color: 'white', 
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                                            }}>
                                                {resultadoTexto}
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