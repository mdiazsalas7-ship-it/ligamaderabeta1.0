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
    const LEAGUE_LOGO = "https://i.postimg.cc/sDgyKfr4/nuevo_logo.png";

    useEffect(() => {
        let unsubscribe: () => void;
        const initStats = async () => {
            try {
                // 1. Logos Equipos
                const equiposSnap = await getDocs(collection(db, 'equipos'));
                const teamLogos: Record<string, string> = {};
                equiposSnap.forEach(d => {
                    const data = d.data();
                    if (data.nombre && data.logoUrl) teamLogos[data.nombre] = data.logoUrl;
                });

                // 2. Stats en vivo
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

                    // 3. Buscar FOTOS de los líderes
                    const topPlayerNames = [
                        newLeaders.mvp[0]?.nombre, newLeaders.puntos[0]?.nombre,
                        newLeaders.rebotes[0]?.nombre, newLeaders.triples[0]?.nombre
                    ].filter(Boolean);

                    if (topPlayerNames.length > 0) {
                        try {
                            const qFotos = query(collectionGroup(db, 'jugadores'), where('nombre', 'in', topPlayerNames));
                            const snapFotos = await getDocs(qFotos);
                            const fotos: Record<string, string> = {};
                            snapFotos.forEach(d => {
                                const data = d.data();
                                if (data.nombre && data.fotoUrl) fotos[data.nombre] = data.fotoUrl;
                            });
                            setLeaderPhotos(fotos);
                        } catch (e: any) { }
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

    // --- MODAL DE BARAJITA ULTRA ---
    const AwardCardModal = () => {
        if (!selectedCard) return null;
        const { player, type } = selectedCard;
        const fotoFinal = cardPhoto || DEFAULT_PLAYER;

        const styles = {
            mvp: { bg: 'linear-gradient(45deg, #FFD700, #FDB931, #FFD700)', accent: '#000', title: 'MVP SEASON', glow: '0 0 50px rgba(255, 215, 0, 0.8)', stat: player.valpg, lbl: 'VAL' },
            points: { bg: 'linear-gradient(135deg, #000 0%, #b91c1c 100%)', accent: '#fff', title: 'SCORING KING', glow: '0 0 40px rgba(220, 20, 60, 0.8)', stat: player.ppg, lbl: 'PPG' },
            rebounds: { bg: 'linear-gradient(135deg, #000 0%, #047857 100%)', accent: '#fff', title: 'REBOUND KING', glow: '0 0 40px rgba(16, 185, 129, 0.8)', stat: player.rpg, lbl: 'RPG' },
            triples: { bg: 'linear-gradient(135deg, #000 0%, #4c1d95 100%)', accent: '#fff', title: 'SNIPER 3PT', glow: '0 0 40px rgba(139, 92, 246, 0.8)', stat: player.tpg, lbl: '3PG' }
        }[type];

        return (
            <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', zIndex:3000, display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'}} onClick={() => setSelectedCard(null)}>
                <div onClick={e => e.stopPropagation()} className="animate-scale-in" style={{
                    width: '100%', maxWidth: '340px', height: '500px', borderRadius: '20px', 
                    background: styles.bg, boxShadow: styles.glow, position: 'relative', overflow: 'hidden',
                    border: '4px solid white'
                }}>
                    <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0.1, backgroundImage:`url(${LEAGUE_LOGO})`, backgroundSize:'120%', backgroundPosition:'center'}}></div>
                    
                    <div style={{position:'absolute', top:20, left:0, width:'100%', textAlign:'center', zIndex:5}}>
                        <div style={{background:'black', color:'white', display:'inline-block', padding:'5px 20px', borderRadius:'20px', fontWeight:'900', fontSize:'0.9rem', letterSpacing:'2px', border:'1px solid white'}}>{styles.title}</div>
                        
                        <div style={{marginTop:'5px', color: styles.accent, fontWeight:'bold', fontSize:'0.8rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px'}}>
                            {/* LOGO EN CABECERA CARTA (CORREGIDO: COVER + 100%) */}
                            <div style={{
                                background:'white', borderRadius:'50%', width:'24px', height:'24px', 
                                display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
                                border: '1px solid rgba(0,0,0,0.1)' // Agregué un borde sutil para definición
                            }}>
                                <img src={player.logoUrl || DEFAULT_LOGO} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                            </div>
                            {player.equipo}
                        </div>
                    </div>

                    <div style={{position:'absolute', bottom:0, left:0, width:'100%', height:'80%', zIndex:3, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
                        <img src={fotoFinal} style={{maxWidth:'110%', maxHeight:'100%', objectFit:'contain', filter:'drop-shadow(0 0 20px rgba(0,0,0,0.7))'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER}} />
                    </div>

                    <div style={{position:'absolute', bottom:20, left:20, right:20, background: 'rgba(0,0,0,0.85)', backdropFilter:'blur(5px)', borderRadius:'15px', padding:'15px', zIndex:4, border: '1px solid rgba(255,255,255,0.3)'}}>
                        <h2 style={{margin:0, color:'white', textTransform:'uppercase', fontSize:'1.6rem', fontWeight:'900', lineHeight:1, textAlign:'center'}}>{player.nombre}</h2>
                        <div style={{textAlign:'center', marginTop:'10px'}}>
                            <div style={{color: styles.accent === '#000' ? '#ffd700' : '#fff', fontSize:'2.5rem', fontWeight:'900', lineHeight:0.8}}>{styles.stat}</div>
                            <div style={{color:'#aaa', fontSize:'0.7rem', fontWeight:'bold'}}>{styles.lbl} PROMEDIO</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- SECCIÓN DE LÍDER EN EL DASHBOARD ---
    const LeaderSection = ({ title, data, icon, color, label, type }: any) => {
        if (!data || data.length === 0) return null;
        const leader = data[0]; 
        const others = data.slice(1);
        const leaderImg = leaderPhotos[leader.nombre] || DEFAULT_PLAYER;

        const cardBg = type === 'mvp' ? 'linear-gradient(135deg, #FFD700 0%, #f59e0b 100%)' :
                       type === 'points' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' :
                       type === 'rebounds' ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' :
                       'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'; 

        return (
            <div style={{background:'white', borderRadius:'16px', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)', overflow:'hidden', display:'flex', flexDirection:'column', height:'100%'}}>
                <div style={{background: color, padding:'12px 15px', color:'white', display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'1.4rem'}}>{icon}</span>
                    <h3 style={{margin:0, fontSize:'0.95rem', textTransform:'uppercase', fontWeight:'800', letterSpacing:'0.5px'}}>{title}</h3>
                </div>

                {/* --- LÍDER PREVIEW (RANK 1) --- */}
                <div onClick={() => handleOpenCard(leader, type)} style={{
                    background: cardBg, padding: '20px', textAlign: 'center', cursor: 'pointer', position:'relative', color: 'white'
                }}>
                    <div style={{
                        width:'110px', height:'110px', margin:'0 auto', borderRadius:'50%', 
                        border: '4px solid white', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', overflow:'hidden', 
                        background:'#333', display:'flex', justifyContent:'center', alignItems:'center'
                    }}>
                        <img src={leaderImg} style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e:any)=>{e.target.src=DEFAULT_PLAYER}} />
                    </div>
                    <div style={{position:'absolute', top:'15px', right:'15px', background:'white', color:color, width:'30px', height:'30px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'900', boxShadow:'0 2px 4px rgba(0,0,0,0.2)'}}>1</div>

                    <div style={{marginTop:'12px'}}>
                        <div style={{fontSize:'1.2rem', fontWeight:'900', lineHeight:1.1, textTransform:'uppercase', textShadow:'0 2px 4px rgba(0,0,0,0.3)'}}>{leader.nombre}</div>
                        
                        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'6px'}}>
                            <div style={{
                                background:'white', borderRadius:'50%', width:'24px', height:'24px', 
                                display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'
                            }}>
                                <img src={leader.logoUrl || DEFAULT_LOGO} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                            </div>
                            <div style={{fontSize:'0.8rem', opacity:0.9, fontWeight:'bold'}}>{leader.equipo}</div>
                        </div>

                        <div style={{marginTop:'8px', fontSize:'2.2rem', fontWeight:'900', lineHeight:1, textShadow:'0 2px 4px rgba(0,0,0,0.3)'}}>
                            {type === 'mvp' ? leader.valpg : type === 'points' ? leader.ppg : type === 'rebounds' ? leader.rpg : leader.tpg}
                            <span style={{fontSize:'0.8rem', opacity:0.8, marginLeft:'4px', verticalAlign:'middle'}}>{label}</span>
                        </div>
                    </div>
                </div>

                {/* --- LISTA DE LOS DEMÁS --- */}
                <div style={{background:'#f9fafb', flex:1, padding:'0', overflowY:'auto', maxHeight:'200px'}}>
                    {others.map((p: PlayerStat, i: number) => (
                        <div key={p.id} onClick={() => handleOpenCard(p, type)} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 15px',
                            borderBottom:'1px solid #f3f4f6', cursor:'pointer', fontSize:'0.85rem'
                        }}>
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <div style={{width:'20px', textAlign:'center', fontWeight:'900', color:'#d1d5db', fontSize:'0.9rem'}}>{i+2}</div>
                                
                                <div style={{
                                    width:'32px', height:'32px', borderRadius:'50%', background:'white', 
                                    border:'1px solid #ddd', overflow:'hidden', 
                                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0
                                }}>
                                    <img src={p.logoUrl || DEFAULT_LOGO} style={{width:'100%', height:'100%', objectFit:'cover'}} alt={p.equipo} />
                                </div>

                                <div style={{fontWeight:'600', color:'#4b5563', lineHeight:1.1}}>
                                    {p.nombre}
                                    <div style={{fontSize:'0.7rem', color:'#9ca3af', fontWeight:'normal'}}>{p.equipo}</div>
                                </div>
                            </div>
                            <div style={{fontWeight:'bold', color: '#374151', fontSize:'0.9rem'}}>
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
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            
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