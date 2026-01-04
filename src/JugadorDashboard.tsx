import React, { useState, useEffect } from 'react';
import { db, storage, auth } from './firebase'; 
import { collection, query, where, collectionGroup, updateDoc, getDocs, doc } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import type { DocumentData } from 'firebase/firestore'; 
import PlayoffBracket from './PlayoffBracket'; 

interface Forma21 extends DocumentData { 
    id: string; 
    nombreEquipo: string; 
    rosterCompleto?: boolean;
    logoUrl?: string; 
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
    userCedula: string | null; 
    userName: string | null; 
    formas21: Forma21[]; 
    setViewRosterId: (id: string | null) => void; 
}

const JugadorDashboard: React.FC<JugadorDashboardProps> = ({ userCedula, userName, formas21, setViewRosterId }) => {
    const [loading, setLoading] = useState(true);
    const [misPartidos, setMisPartidos] = useState<Partido[]>([]);
    const [showBracket, setShowBracket] = useState(false);
    
    // Estados del Perfil
    const [miFotoUrl, setMiFotoUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [playerDocRef, setPlayerDocRef] = useState<any>(null);
    
    // Estados del Equipo
    const [miEquipoId, setMiEquipoId] = useState<string | null>(null);
    const [miEquipoNombre, setMiEquipoNombre] = useState<string>('');
    const [miEquipoLogo, setMiEquipoLogo] = useState<string>(''); 

    // 1. BUSCAR JUGADOR
    useEffect(() => {
        const findMyPlayerProfile = async () => {
            if (!userCedula) { setLoading(false); return; }
            const cedulaLimpia = userCedula.trim();

            try {
                const q = query(collectionGroup(db, 'jugadores'), where('cedula', '==', cedulaLimpia));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    const data = docSnap.data();
                    setPlayerDocRef(docSnap.ref);
                    setMiFotoUrl(data.fotoUrl || '');
                    
                    const equipoRef = docSnap.ref.parent.parent;
                    if (equipoRef) {
                        setMiEquipoId(equipoRef.id);
                        const equipoEncontrado = formas21.find(f => f.id === equipoRef.id);
                        if (equipoEncontrado) {
                            setMiEquipoNombre(equipoEncontrado.nombreEquipo);
                            setMiEquipoLogo(equipoEncontrado.logoUrl || '');
                        }
                    }
                }
            } catch (error) {
                console.error("Error buscando jugador:", error);
            } finally {
                setLoading(false);
            }
        };
        findMyPlayerProfile();
    }, [userCedula, formas21]);

    // 2. CARGAR PARTIDOS
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
                setMisPartidos([...partidosLocal, ...partidosVisitante].sort((a, b) => (b.jornada || 0) - (a.jornada || 0)));
            } catch (err) { console.error(err); }
        };
        fetchPartidos();
    }, [miEquipoId]);

    // 3. SUBIR FOTO
    const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !userCedula || !playerDocRef) return;
        const file = e.target.files[0];
        setUploading(true);
        try {
            const storageRef = ref(storage, `jugadores_fotos/${userCedula}.jpg`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await updateDoc(playerDocRef, { fotoUrl: url });
            setMiFotoUrl(url);
            alert("✅ Foto actualizada.");
        } catch (error) { console.error(error); alert("Error al subir la foto."); } finally { setUploading(false); }
    };

    // 4. CAMBIAR NOMBRE
    const handleEditName = async () => {
        const u = auth.currentUser;
        if (!u) return;
        const nuevoNombre = prompt("Nombre completo:", userName || "");
        if (nuevoNombre && nuevoNombre.trim() !== "") {
            try {
                await updateDoc(doc(db, 'usuarios', u.uid), { nombre: nuevoNombre.trim().toUpperCase() });
                if (playerDocRef) { await updateDoc(playerDocRef, { nombre: nuevoNombre.trim().toUpperCase() }); }
            } catch (error) { alert("Error al actualizar nombre."); }
        }
    };

    if (loading) return <p style={{textAlign: 'center', marginTop:'50px'}}>Cargando ficha...</p>;
    
    if (!miEquipoId) return (
        <div style={{textAlign:'center', padding:'30px', background:'white', borderRadius:'10px', marginTop:'20px'}}>
            <h3 style={{color:'#ef4444'}}>Perfil no encontrado</h3>
            <p>Cédula: <strong>{userCedula}</strong> no aparece en los rosters.</p>
        </div>
    );

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            {showBracket && <PlayoffBracket adminMode={false} onClose={() => setShowBracket(false)} />}
            
            {/* --- LA FRANJA ÚNICA --- */}
            <div className="animate-fade-in" style={{
                background: 'linear-gradient(90deg, #1e3a8a 0%, #111827 100%)', 
                borderRadius: '12px', padding: '15px', color: 'white', marginBottom: '20px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px'
            }}>
                
                {/* 1. FOTO (IZQUIERDA) */}
                <div style={{position: 'relative', flexShrink: 0}}>
                    <div style={{
                        width: '75px', height: '75px', borderRadius: '50%', 
                        border: '2px solid #f59e0b', overflow: 'hidden', 
                        background: '#374151', display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        {miFotoUrl ? <img src={miFotoUrl} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '2rem'}}>👤</span>}
                    </div>
                    {/* Botón Cámara */}
                    <label htmlFor="foto-upload" style={{
                        position: 'absolute', bottom: -5, right: -5, background: '#3b82f6', 
                        width: '26px', height: '26px', borderRadius: '50%', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white'
                    }}>📷</label>
                    <input type="file" id="foto-upload" accept="image/*" style={{display: 'none'}} onChange={handleUploadFoto} disabled={uploading} />
                </div>

                {/* 2. INFO CENTRAL (NOMBRE + ROL) */}
                <div style={{flex: 1, overflow: 'hidden'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <h2 style={{margin: 0, fontSize: '1.3rem', fontWeight:'800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            {userName}
                        </h2>
                        {/* Botón Lápiz */}
                        <button onClick={handleEditName} style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:'22px', height:'22px', cursor:'pointer', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>✏️</button>
                    </div>
                    <div style={{color:'#9ca3af', fontSize:'0.85rem', marginTop:'2px', fontWeight:'500'}}>
                        {uploading ? 'Subiendo...' : miEquipoNombre}
                    </div>
                    <div style={{fontSize:'0.75rem', color:'#f59e0b', marginTop:'2px'}}>Ficha Activa</div>
                </div>

                {/* 3. LOGO (DERECHA) */}
                <div style={{flexShrink: 0}}>
                    {miEquipoLogo ? (
                        <img src={miEquipoLogo} style={{width:'60px', height:'60px', objectFit:'contain', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}} />
                    ) : (
                        <div style={{width:'60px', height:'60px', background:'rgba(255,255,255,0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem'}}>🛡️</div>
                    )}
                </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'25px'}}>
                <button onClick={() => setViewRosterId(miEquipoId)} className="btn" style={{background:'white', color:'#1f2937', border:'1px solid #ddd', padding:'12px', borderRadius:'8px', fontWeight:'bold'}}>📋 Ver Equipo</button>
                <button onClick={() => setShowBracket(true)} className="btn" style={{background:'#7c3aed', color:'white', border:'none', padding:'12px', borderRadius:'8px', fontWeight:'bold'}}>🏆 Playoffs</button>
            </div>

            {/* RESULTADOS */}
            <div className="data-block-container">
                <div className="data-block-header">Resultados</div>
                {misPartidos.length === 0 ? <p style={{padding:'20px', textAlign:'center', color:'#666'}}>Sin partidos jugados.</p> : (
                    <table className="data-table">
                        <thead><tr><th>Jornada</th><th>Oponente</th><th>Resultado</th><th></th></tr></thead>
                        <tbody>{misPartidos.map(p => {
                            const esLocal = p.equipoLocalId === miEquipoId;
                            const miMarcador = esLocal ? p.marcadorLocal : p.marcadorVisitante;
                            const opMarcador = esLocal ? p.marcadorVisitante : p.marcadorLocal;
                            const oponenteNombre = esLocal ? p.equipoVisitanteNombre : p.equipoLocalNombre;
                            const color = miMarcador > opMarcador ? '#10b981' : miMarcador < opMarcador ? '#ef4444' : 'gray';
                            return (<tr key={p.id}><td>{p.jornada || '-'}</td><td>{oponenteNombre}</td><td style={{fontWeight:'bold'}}>{miMarcador} - {opMarcador}</td><td><span style={{backgroundColor: color, color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem'}}>{miMarcador > opMarcador ? 'G' : miMarcador < opMarcador ? 'P' : 'E'}</span></td></tr>);
                        })}</tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
export default JugadorDashboard;