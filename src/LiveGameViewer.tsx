import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

interface MatchData {
    id: string;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    marcadorLocal: number;
    marcadorVisitante: number;
    cuarto?: number;
    tiempo?: string;
    estatus: string;
}

const LiveGameViewer: React.FC<{ matchId: string, onClose: () => void }> = ({ matchId, onClose }) => {
    const [match, setMatch] = useState<MatchData | null>(null);
    const [localLogo, setLocalLogo] = useState<string>('');
    const [visitanteLogo, setVisitanteLogo] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // 1. Escuchar el partido en tiempo real
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'calendario', matchId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as any;
                setMatch({
                    id: docSnap.id,
                    equipoLocalNombre: data.equipoLocalNombre || 'Local',
                    equipoVisitanteNombre: data.equipoVisitanteNombre || 'Visitante',
                    marcadorLocal: data.marcadorLocal || 0,
                    marcadorVisitante: data.marcadorVisitante || 0,
                    cuarto: data.cuarto || 1,
                    tiempo: data.tiempo || '00:00',
                    estatus: data.estatus || 'vivo'
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [matchId]);

    // 2. Buscar los logos cuando ya sepamos los nombres de los equipos
    useEffect(() => {
        const fetchLogos = async () => {
            if (!match) return;

            // Buscar Logo Local
            try {
                const qL = query(collection(db, 'equipos'), where('nombre', '==', match.equipoLocalNombre));
                const snapL = await getDocs(qL);
                if (!snapL.empty) setLocalLogo(snapL.docs[0].data().logoUrl || '');
            } catch (e) { console.error(e); }

            // Buscar Logo Visitante
            try {
                const qV = query(collection(db, 'equipos'), where('nombre', '==', match.equipoVisitanteNombre));
                const snapV = await getDocs(qV);
                if (!snapV.empty) setVisitanteLogo(snapV.docs[0].data().logoUrl || '');
            } catch (e) { console.error(e); }
        };

        if (match) fetchLogos();
    }, [match?.equipoLocalNombre, match?.equipoVisitanteNombre]);

    if (loading) return <div style={{textAlign:'center', padding:'50px', color:'white'}}>Cargando transmisión...</div>;
    if (!match) return <div style={{textAlign:'center', padding:'50px', color:'white'}}>Partido no encontrado.</div>;

    return (
        <div className="animate-fade-in" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: '#111', color: 'white', zIndex: 2000, 
            display: 'flex', flexDirection: 'column', overflowY: 'auto'
        }}>
            {/* HEADER */}
            <div style={{padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{color:'red', fontWeight:'bold', fontSize:'0.9rem'}}>● EN VIVO</span>
                    <span style={{background:'#333', padding:'2px 8px', borderRadius:'4px', fontSize:'0.8rem'}}>
                        {match.estatus === 'finalizado' ? 'FINAL' : `Q${match.cuarto} - ${match.tiempo}`}
                    </span>
                </div>
                <button onClick={onClose} className="btn btn-secondary" style={{padding:'5px 15px', background:'#333', border:'none', color:'white'}}>X Cerrar</button>
            </div>

            {/* SCOREBOARD GRANDE */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                padding: '20px', background: 'linear-gradient(to bottom, #111, #222)'
            }}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%', maxWidth: '600px'}}>
                    
                    {/* LOCAL */}
                    <div style={{textAlign: 'center', flex: 1}}>
                        <div style={{
                            width: '100px', height: '100px', margin: '0 auto 15px', 
                            borderRadius: '50%', background: '#fff', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow:'hidden',
                            border: '4px solid var(--primary)'
                        }}>
                            {localLogo ? 
                                <img src={localLogo} alt="Local" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : 
                                <span style={{color:'black', fontSize:'2rem'}}>🏠</span>
                            }
                        </div>
                        <h2 style={{fontSize: '1.2rem', margin: 0}}>{match.equipoLocalNombre}</h2>
                    </div>

                    {/* MARCADOR */}
                    <div style={{textAlign: 'center', padding: '0 20px'}}>
                        <div style={{fontSize: '4rem', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1}}>
                            {match.marcadorLocal}
                        </div>
                        <div style={{fontSize: '1rem', color: '#888', margin: '10px 0'}}>- VS -</div>
                        <div style={{fontSize: '4rem', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1}}>
                            {match.marcadorVisitante}
                        </div>
                    </div>

                    {/* VISITANTE */}
                    <div style={{textAlign: 'center', flex: 1}}>
                        <div style={{
                            width: '100px', height: '100px', margin: '0 auto 15px', 
                            borderRadius: '50%', background: '#fff', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow:'hidden',
                            border: '4px solid var(--accent)'
                        }}>
                            {visitanteLogo ? 
                                <img src={visitanteLogo} alt="Visitante" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : 
                                <span style={{color:'black', fontSize:'2rem'}}>✈️</span>
                            }
                        </div>
                        <h2 style={{fontSize: '1.2rem', margin: 0}}>{match.equipoVisitanteNombre}</h2>
                    </div>
                </div>

                <div style={{marginTop: '40px', color: '#666', fontSize: '0.9rem'}}>
                    Transmisión en tiempo real | Liga Madera 15
                </div>
            </div>
        </div>
    );
};
export default LiveGameViewer;