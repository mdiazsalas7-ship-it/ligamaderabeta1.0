import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, onSnapshot, query, collectionGroup, where } from 'firebase/firestore';

interface PlayerStat {
    id: string; 
    jugadorId: string;
    nombre: string;
    equipo: string;
    totalPuntos: number;
    totalRebotes: number;
    totalTriples: number;
    totalFaltas: number;
    totalValoracion: number;
    partidosJugados: number;
    ppg: number; 
    rpg: number; 
    tpg: number; 
    valpg: number; 
    logoUrl?: string;
}

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [leaders, setLeaders] = useState<{
        mvp: PlayerStat[],
        puntos: PlayerStat[],
        rebotes: PlayerStat[],
        triples: PlayerStat[]
    }>({ mvp: [], puntos: [], rebotes: [], triples: [] } as any);
    
    const [loading, setLoading] = useState(true);
    const [selectedCard, setSelectedCard] = useState<{player: PlayerStat, type: 'mvp' | 'points' | 'rebounds' | 'triples'} | null>(null);
    const [cardPhoto, setCardPhoto] = useState('');
    const [leaderPhotos, setLeaderPhotos] = useState<Record<string, string>>({});

    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/451/451716.png";
    const DEFAULT_PLAYER = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    useEffect(() => {
        let unsubscribe: () => void;
        const initStats = async () => {
            try {
                const equiposSnap = await getDocs(collection(db, 'equipos'));
                const teamLogos: Record<string, string> = {};
                equiposSnap.forEach(d => {
                    const data = d.data();
                    if (data.nombre && data.logoUrl) teamLogos[data.nombre] = data.logoUrl;
                });

                const q = query(collection(db, 'stats_partido'));
                unsubscribe = onSnapshot(q, async (snapshot) => {
                    const aggregated: Record<string, any> = {};
                    snapshot.docs.forEach(doc => {
                        const stat = doc.data();
                        if (!aggregated[stat.jugadorId]) {
                            aggregated[stat.jugadorId] = {
                                id: stat.jugadorId, jugadorId: stat.jugadorId, nombre: stat.nombre, equipo: stat.equipo,
                                totalPuntos: 0, totalRebotes: 0, totalFaltas: 0, totalTriples: 0, partidosJugados: 0,
                                logoUrl: teamLogos[stat.equipo] || DEFAULT_LOGO
                            };
                        }
                        const acc = aggregated[stat.jugadorId];
                        acc.totalPuntos += (Number(stat.puntos) || 0);
                        acc.totalRebotes += (Number(stat.rebotes) || 0);
                        acc.totalFaltas += (Number(stat.faltasTotales) || 0);
                        acc.totalTriples += (Number(stat.triples) || 0);
                        acc.partidosJugados += 1;
                    });

                    const processedPlayers: PlayerStat[] = Object.values(aggregated).map((p: any) => {
                        const games = p.partidosJugados || 1; 
                        const valoracionTotal = (p.totalPuntos + p.totalRebotes) - p.totalFaltas;
                        return {
                            ...p, totalValoracion: valoracionTotal,
                            ppg: parseFloat((p.totalPuntos / games).toFixed(1)),
                            rpg: parseFloat((p.totalRebotes / games).toFixed(1)),
                            tpg: parseFloat((p.totalTriples / games).toFixed(1)),
                            valpg: parseFloat((valoracionTotal / games).toFixed(1))
                        };
                    });

                    const activePlayers = processedPlayers.filter(p => p.partidosJugados > 0);
                    const newLeaders = {
                        mvp: [...activePlayers].sort((a,b) => b.valpg - a.valpg).slice(0, 10),
                        puntos: [...activePlayers].sort((a,b) => b.ppg - a.ppg).slice(0, 10),
                        rebotes: [...activePlayers].sort((a,b) => b.rpg - a.rpg).slice(0, 10),
                        triples: [...activePlayers].sort((a,b) => b.tpg - a.tpg).slice(0, 10),
                    };
                    setLeaders(newLeaders);
                    setLoading(false);

                    // Cargar fotos de líderes
                    const topPlayerNames = [
                        newLeaders.mvp[0]?.nombre, newLeaders.puntos[0]?.nombre,
                        newLeaders.rebotes[0]?.nombre, newLeaders.triples[0]?.nombre
                    ].filter(Boolean);

                    if (topPlayerNames.length > 0) {
                        try {
                            const fotos: Record<string, string> = {};
                            const qFotos = query(collectionGroup(db, 'jugadores'), where('nombre', 'in', topPlayerNames));
                            const snapFotos = await getDocs(qFotos);
                            snapFotos.forEach(d => {
                                const data = d.data();
                                if (data.nombre && data.fotoUrl) fotos[data.nombre] = data.fotoUrl;
                            });
                            setLeaderPhotos(fotos);
                        } catch (e) { }
                    }
                });
            } catch (error) { setLoading(false); }
        };
        initStats();
        return () => { if (unsubscribe) unsubscribe(); };
    }, []);

    const handleOpenCard = async (player: PlayerStat, type: 'mvp' | 'points' | 'rebounds' | 'triples') => {
        setSelectedCard({ player, type });
        setCardPhoto(leaderPhotos[player.nombre] || ''); 
        if (!leaderPhotos[player.nombre]) {
            try {
                const q = query(collectionGroup(db, 'jugadores'), where('nombre', '==', player.nombre));
                const snap = await getDocs(q);
                if (!snap.empty) setCardPhoto(snap.docs[0].data().fotoUrl || '');
            } catch (e) {}
        }
    };

    // --- MODAL DE BARAJITA (AQUÍ ESTÁ LA MAGIA VISUAL) ---
    const AwardCardModal = () => {
        if (!selectedCard) return null;
        const { player, type } = selectedCard;
        const fotoFinal = cardPhoto || DEFAULT_PLAYER;

        // Estilos EXTREMOS para diferenciar
        const styles = {
            mvp: {
                // ORO PURO
                wrapperBg: 'linear-gradient(45deg, #FFD700, #FDB931, #FFD700)',
                cardBg: 'linear-gradient(to bottom, #FFD700 0%, #ffecb3 50%, #FFD700 100%)',
                textColor: '#000', // Texto negro sobre oro
                statColor: '#000',
                borderColor: '#fff',
                title: 'MVP DE LA TEMPORADA',
                mainStat: player.valpg,
                statLabel: 'VALORACIÓN',
                glow: '0 0 80px rgba(255, 215, 0, 1)'
            },
            points: {
                // ROJO INFIERNO
                wrapperBg: '#000',
                cardBg: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)',
                textColor: '#fff',
                statColor: '#fbbf24', // Amarillo sobre rojo
                borderColor: '#ef4444',
                title: 'SCORING KING',
                mainStat: player.ppg,
                statLabel: 'PPG',
                glow: '0 0 40px rgba(239, 68, 68, 0.8)'
            },
            rebounds: {
                // VERDE MURO
                wrapperBg: '#000',
                cardBg: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
                textColor: '#fff',
                statColor: '#fff',
                borderColor: '#10b981',
                title: 'REBOUND KING',
                mainStat: player.rpg,
                statLabel: 'RPG',
                glow: '0 0 40px rgba(16, 185, 129, 0.8)'
            },
            triples: {
                // VIOLETA NEON
                wrapperBg: '#000',
                cardBg: 'linear-gradient(135deg, #312e81 0%, #8b5cf6 100%)',
                textColor: '#fff',
                statColor: '#fff',
                borderColor: '#8b5cf6',
                title: '3-POINT KING',
                mainStat: player.tpg,
                statLabel: '3PG',
                glow: '0 0 40px rgba(139, 92, 246, 0.8)'
            }
        };
        const s = styles[type];

        return (
            <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.95)', zIndex:3000, display:'flex', justifyContent:'center', alignItems:'center', padding:'20px', backdropFilter: 'blur(10px)'}} onClick={() => setSelectedCard(null)}>
                <div onClick={e => e.stopPropagation()} className="animate-scale-in" style={{
                    width: '100%', maxWidth: '360px', borderRadius: '25px', position: 'relative', 
                    boxShadow: s.glow, padding: '5px', background: s.wrapperBg
                }}>
                    <div style={{background: s.cardBg, borderRadius: '20px', overflow: 'hidden', height: '500px', display:'flex', flexDirection:'column', position:'relative'}}>
                        
                        {/* DECORACIÓN FONDO */}
                        <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0.1, backgroundImage: `url(${DEFAULT_LOGO})`, backgroundSize:'150%'}}></div>

                        {/* CABECERA */}
                        <div style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'start', zIndex:2}}>
                            <img src={player.logoUrl || DEFAULT_LOGO} style={{width:'70px', height:'70px', filter: type==='mvp'?'none':'drop-shadow(0 4px 4px rgba(0,0,0,0.5))'}} />
                            <div style={{textAlign:'right'}}>
                                <div style={{color: s.statColor, fontWeight:'900', fontSize:'3.5rem', lineHeight:0.9, textShadow: type==='mvp'?'none':'0 2px 4px black'}}>{s.mainStat}</div>
                                <div style={{color: s.textColor, fontSize:'0.9rem', fontWeight:'bold', letterSpacing:'2px'}}>{s.statLabel}</div>
                            </div>
                        </div>

                        {/* FOTO JUGADOR - MAS GRANDE */}
                        <div style={{flex:1, display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:2, marginTop:'-20px'}}>
                            <img src={fotoFinal} style={{width:'90%', height:'auto', maxHeight:'350px', objectFit:'contain', filter:'drop-shadow(0 10px 20px rgba(0,0,0,0.6))'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER}} />
                        </div>

                        {/* DATOS INFERIORES */}
                        <div style={{background: type==='mvp'?'#000':'rgba(0,0,0,0.6)', padding:'20px', textAlign:'center', zIndex:3, backdropFilter:'blur(5px)'}}>
                            <h2 style={{margin:0, color:'white', textTransform:'uppercase', fontSize:'2rem', fontWeight:'900', letterSpacing:'1px', lineHeight:1}}>{player.nombre}</h2>
                            <div style={{color: type==='mvp'?'#FFD700':'#ccc', fontWeight:'bold', fontSize:'1rem', marginTop:'5px', textTransform:'uppercase'}}>{player.equipo}</div>
                            <div style={{marginTop:'10px', background:'white', color:'black', display:'inline-block', padding:'5px 15px', borderRadius:'20px', fontWeight:'bold', fontSize:'0.8rem', letterSpacing:'1px'}}>
                                {s.title}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- TARJETA DEL PREVIEW (DASHBOARD) ---
    const LeaderSection = ({ title, data, icon, color, label, type }: any) => {
        if (!data || data.length === 0) return null;
        const leader = data[0]; 
        const others = data.slice(1);
        const leaderImg = leaderPhotos[leader.nombre] || DEFAULT_PLAYER;

        return (
            <div style={{background:'white', borderRadius:'16px', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)', overflow:'hidden', display:'flex', flexDirection:'column', height:'100%'}}>
                <div style={{background: color, padding:'12px 15px', color:'white', display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'1.4rem'}}>{icon}</span>
                    <h3 style={{margin:0, fontSize:'0.95rem', textTransform:'uppercase', fontWeight:'800', letterSpacing:'0.5px'}}>{title}</h3>
                </div>

                {/* --- LÍDER PREVIEW (MINI BARAJITA) --- */}
                <div onClick={() => handleOpenCard(leader, type)} style={{
                    background: type==='mvp' ? 'linear-gradient(45deg, #FFD700, #ffecb3)' : `linear-gradient(to bottom, ${color}22, white)`, // Fondo suave
                    padding: '20px', textAlign: 'center', cursor: 'pointer', position:'relative', borderBottom:'1px solid #eee'
                }}>
                    <div style={{
                        width:'110px', height:'110px', margin:'0 auto', borderRadius:'50%', 
                        border: type==='mvp' ? '4px solid #fff' : `4px solid ${color}`, 
                        boxShadow: '0 5px 15px rgba(0,0,0,0.15)', overflow:'hidden', background:'white',
                        display:'flex', justifyContent:'center', alignItems:'center'
                    }}>
                        <img src={leaderImg} style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER}} />
                    </div>
                    {/* Badge de Posición 1 */}
                    <div style={{position:'absolute', top:'15px', right:'15px', background:color, color:'white', width:'30px', height:'30px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', boxShadow:'0 2px 4px rgba(0,0,0,0.2)'}}>1</div>

                    <div style={{marginTop:'12px'}}>
                        <div style={{fontSize:'1.2rem', fontWeight:'900', color:'#1f2937', lineHeight:1.1, textTransform:'uppercase'}}>{leader.nombre}</div>
                        <div style={{fontSize:'0.8rem', color:'#6b7280', marginTop:'2px'}}>{leader.equipo}</div>
                        <div style={{marginTop:'8px', fontSize:'2rem', fontWeight:'900', color: type==='mvp'?'#b45309':color, lineHeight:1}}>
                            {type === 'mvp' ? leader.valpg : type === 'points' ? leader.ppg : type === 'rebounds' ? leader.rpg : leader.tpg}
                            <span style={{fontSize:'0.7rem', color:'#9ca3af', marginLeft:'4px', verticalAlign:'middle'}}>{label}</span>
                        </div>
                    </div>
                    <div style={{fontSize:'0.7rem', color: type==='mvp'?'#b45309':'#9ca3af', marginTop:'10px', fontWeight:'bold'}}>
                        VER BARAJITA ➜
                    </div>
                </div>

                {/* --- LISTA DE LOS DEMÁS (#2-10) --- */}
                <div style={{background:'#f9fafb', flex:1, padding:'0', overflowY:'auto', maxHeight:'200px'}}>
                    {others.map((p: PlayerStat, i: number) => (
                        <div key={p.id} onClick={() => handleOpenCard(p, type)} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 15px',
                            borderBottom:'1px solid #f3f4f6', cursor:'pointer', fontSize:'0.85rem'
                        }}>
                            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                                <div style={{width:'20px', textAlign:'center', fontWeight:'900', color:'#d1d5db', fontSize:'0.9rem'}}>{i+2}</div>
                                <div style={{fontWeight:'600', color:'#4b5563'}}>{p.nombre}</div>
                            </div>
                            <div style={{fontWeight:'bold', color: '#374151'}}>
                                {type === 'mvp' ? p.valpg : type === 'points' ? p.ppg : type === 'rebounds' ? p.rpg : p.tpg}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in" style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'#f3f4f6', zIndex:2000, display:'flex', justifyContent:'center', padding:'20px', overflowY:'auto'}}>
            {selectedCard && <AwardCardModal />}

            <div style={{width:'100%', maxWidth:'1100px', margin:'0 auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <div style={{background:'#1f2937', color:'white', width:'40px', height:'40px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem'}}>📊</div>
                        <h2 style={{color:'#1f2937', margin:0, fontSize:'1.6rem', fontWeight:'900', textTransform:'uppercase', letterSpacing:'-0.5px'}}>Líderes de la Liga</h2>
                    </div>
                    <button onClick={onClose} style={{fontSize:'1.2rem', background:'white', border:'none', cursor:'pointer', width:'40px', height:'40px', borderRadius:'50%', boxShadow:'0 2px 5px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>✕</button>
                </div>

                {loading ? <div style={{textAlign:'center', marginTop:'50px', color:'#6b7280'}}>Procesando estadísticas...</div> : (
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'25px', paddingBottom:'40px'}}>
                        <div style={{gridColumn: '1 / -1'}}>
                            <LeaderSection title="Carrera por el MVP" data={leaders.mvp} icon="👑" color="#eab308" label="VAL" type="mvp" />
                        </div>
                        <LeaderSection title="Máximos Anotadores" data={leaders.puntos} icon="🔥" color="#ef4444" label="PPG" type="points" />
                        <LeaderSection title="Rebotes por Juego" data={leaders.rebotes} icon="🖐️" color="#10b981" label="RPG" type="rebounds" />
                        <LeaderSection title="Triples por Juego" data={leaders.triples} icon="🎯" color="#8b5cf6" label="3PG" type="triples" />
                    </div>
                )}
            </div>
        </div>
    );
};
export default StatsViewer;