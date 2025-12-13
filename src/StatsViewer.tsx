import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerStat { 
    id: string; 
    nombre: string; 
    equipo: string; 
    puntos: number; 
    rebotes: number; 
    asistencias: number; 
    robos: number; 
    bloqueos: number; 
    partidos: number; 
    valoracionTotal: number; 
    valoracionPromedio: number; 
    logoUrl?: string; 
}

const StatsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [stats, setStats] = useState<PlayerStat[]>([]);
    const [mvp, setMvp] = useState<PlayerStat | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'puntos' | 'rebotes' | 'asistencias' | 'mvp'>('mvp'); 

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Directorio
                const formasSnap = await getDocs(collection(db, 'forma21s'));
                const teamLogos: Record<string, string> = {};
                const playerDirectory: Record<string, {nombre: string, equipo: string}> = {};

                for (const docForma of formasSnap.docs) {
                    const data = docForma.data();
                    const nombreEquipo = String(data.nombreEquipo || '').trim();
                    if (nombreEquipo && data.logoUrl) teamLogos[nombreEquipo] = data.logoUrl;

                    const jugSnap = await getDocs(collection(db, 'forma21s', docForma.id, 'jugadores'));
                    jugSnap.forEach(j => {
                        playerDirectory[j.id] = { nombre: j.data().nombre, equipo: nombreEquipo };
                    });
                }

                // 2. Stats
                const statsSnap = await getDocs(collection(db, 'stats_partido'));
                if (statsSnap.empty) { setLoading(false); return; }

                // 3. Sumar
                const acumulado: Record<string, PlayerStat> = {};
                
                statsSnap.forEach(doc => {
                    const s = doc.data();
                    const pid = s.jugadorId;
                    if (!pid) return;

                    const info = playerDirectory[pid] || { nombre: s.nombre || 'Desconocido', equipo: s.equipo || 'Agente Libre' };

                    if (!acumulado[pid]) {
                        acumulado[pid] = {
                            id: pid, nombre: info.nombre, equipo: info.equipo,
                            puntos: 0, rebotes: 0, asistencias: 0, robos: 0, bloqueos: 0, 
                            partidos: 0, valoracionTotal: 0, valoracionPromedio: 0,
                            logoUrl: teamLogos[info.equipo] || null
                        };
                    }
                    
                    const pts = Number(s.puntos || 0);
                    const reb = Number(s.rebotes || 0);
                    const ast = Number(s.asistencias || 0);
                    const rob = Number(s.robos || 0);
                    const blk = Number(s.bloqueos || 0);

                    acumulado[pid].puntos += pts;
                    acumulado[pid].rebotes += reb;
                    acumulado[pid].asistencias += ast;
                    acumulado[pid].robos += rob;
                    acumulado[pid].bloqueos += blk;
                    acumulado[pid].partidos += 1;
                    
                    // Valoración Simple (Eficiencia): Suma de todo lo positivo
                    acumulado[pid].valoracionTotal += (pts + reb + ast + rob + blk);
                });

                const listaFinal = Object.values(acumulado).map(p => ({
                    ...p,
                    valoracionPromedio: p.partidos > 0 ? (p.valoracionTotal / p.partidos) : 0
                }));

                setStats(listaFinal);

                if (listaFinal.length > 0) {
                    const topPlayer = [...listaFinal].sort((a,b) => b.valoracionPromedio - a.valoracionPromedio)[0];
                    setMvp(topPlayer);
                }

            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchStats();
    }, []);

    const getAvg = (total: number, games: number) => games > 0 ? (total / games).toFixed(1) : '0.0';

    const getSorted = () => {
        const data = [...stats];
        if (tab === 'mvp') return data.sort((a,b) => b.valoracionPromedio - a.valoracionPromedio);
        if (tab === 'puntos') return data.sort((a,b) => (b.puntos/b.partidos) - (a.puntos/a.partidos));
        if (tab === 'rebotes') return data.sort((a,b) => (b.rebotes/b.partidos) - (a.rebotes/a.partidos));
        return data.sort((a,b) => (b.asistencias/b.partidos) - (a.asistencias/a.partidos));
    };

    const statsToShow = getSorted().slice(0, 20);

    return (
        <div className="animate-fade-in" style={{maxWidth:'900px', margin:'0 auto', paddingBottom:'40px'}}>
            
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
                <h2 style={{color:'var(--primary)', margin:0, fontSize:'1.8rem'}}>📊 Estadísticas</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px'}}>Cargando...</div> : stats.length === 0 ? <div className="card">Sin datos.</div> : (
                <>
                    {/* --- TARJETA DEL LÍDER ACTUAL (SOLO VISIBLE EN PESTAÑA MVP) --- */}
                    {tab === 'mvp' && mvp && (
                        <div className="card" style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                            color: 'white', marginBottom: '30px', padding: '25px', 
                            display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden',
                            border: '2px solid #fbbf24', boxShadow: '0 10px 30px rgba(251, 191, 36, 0.2)'
                        }}>
                            <div style={{position:'absolute', right:'-20px', top:'-30px', fontSize:'12rem', opacity:0.05, transform:'rotate(-10deg)'}}>🏆</div>
                            
                            <div style={{width: '100px', height: '100px', borderRadius: '50%', border: '4px solid #fbbf24', overflow: 'hidden', background: 'white', flexShrink: 0, boxShadow: '0 0 15px rgba(251, 191, 36, 0.5)'}}>
                                {mvp.logoUrl ? <img src={mvp.logoUrl} alt="MVP" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'3.5rem'}}>👑</div>}
                            </div>

                            <div style={{flex: 1, zIndex: 2}}>
                                <div style={{color: '#fbbf24', fontWeight: 'bold', letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase', background:'rgba(251, 191, 36, 0.1)', display:'inline-block', padding:'2px 8px', borderRadius:'4px'}}>Líder Carrera MVP</div>
                                {/* CORRECCIÓN AQUÍ: Color blanco explícito */}
                                <h2 style={{margin: '5px 0', fontSize: '1.8rem', lineHeight: 1.1, color: 'white'}}>{mvp.nombre}</h2>
                                <div style={{color: '#94a3b8', fontSize: '1rem', display:'flex', alignItems:'center', gap:'5px'}}>
                                    <span>{mvp.equipo}</span> • <span>VAL: {mvp.valoracionPromedio.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- PESTAÑAS --- */}
                    <div style={{display:'flex', gap:'10px', marginBottom:'20px', overflowX:'auto', paddingBottom:'5px'}}>
                        <button onClick={()=>setTab('mvp')} className="btn" style={{
                            flex:1, minWidth:'120px', fontWeight:'bold',
                            background: tab==='mvp' ? '#fbbf24' : '#fff', 
                            color: tab==='mvp' ? '#000' : '#666', 
                            border: tab==='mvp' ? 'none' : '1px solid #ddd',
                            boxShadow: tab==='mvp' ? '0 4px 10px rgba(251, 191, 36, 0.4)' : 'none'
                        }}>
                            🏆 Carrera MVP
                        </button>
                        
                        {['puntos', 'rebotes', 'asistencias'].map(t => (
                            <button key={t} onClick={()=>setTab(t as any)} className="btn" style={{
                                flex:1, minWidth:'100px', textTransform:'capitalize',
                                background: tab===t?'var(--primary)':'#eee', 
                                color: tab===t?'white':'#666'
                            }}>
                                {t === 'puntos' ? '🔥 Puntos' : t === 'rebotes' ? '🏀 Rebotes' : '🅰️ Asistencias'}
                            </button>
                        ))}
                    </div>

                    {/* --- TABLA DE LÍDERES --- */}
                    <div className="card" style={{padding:0, overflowX:'auto'}}>
                        <table style={{width:'100%', borderCollapse:'collapse'}}>
                            <thead>
                                <tr style={{background:'var(--primary)', color:'white', textAlign:'left'}}>
                                    <th style={{padding:'15px', textAlign:'center'}}>#</th>
                                    <th style={{padding:'15px'}}>Jugador</th>
                                    <th style={{padding:'15px'}}>Equipo</th>
                                    <th style={{padding:'15px', textAlign:'center'}}>PJ</th>
                                    <th style={{padding:'15px', textAlign:'center', background: tab==='mvp'?'#fbbf24':'var(--accent)', color: tab==='mvp'?'black':'white', width:'110px'}}>
                                        {tab === 'mvp' ? 'VAL (Avg)' : 'Promedio'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {statsToShow.map((s, i) => (
                                    <tr key={s.id} style={{borderBottom:'1px solid #eee', background: i%2===0?'white':'#f9fafb'}}>
                                        <td style={{padding:'15px', textAlign:'center', fontWeight:'bold', color: i<3?(tab==='mvp'?'#fbbf24':'var(--accent)'):'#ccc'}}>{i+1}</td>
                                        <td style={{padding:'15px', fontWeight:'600'}}>{s.nombre}</td>
                                        <td style={{padding:'15px', display:'flex', alignItems:'center', gap:'8px'}}>
                                            {s.logoUrl && <img src={s.logoUrl} style={{width:'24px', height:'24px', borderRadius:'50%'}} />}
                                            <span style={{fontSize:'0.9rem'}}>{s.equipo}</span>
                                        </td>
                                        <td style={{padding:'15px', textAlign:'center', color:'#666'}}>{s.partidos}</td>
                                        <td style={{
                                            padding:'15px', textAlign:'center', fontWeight:'900', fontSize:'1.2rem', 
                                            color: tab==='mvp'?'#000':'var(--primary)', 
                                            background: tab==='mvp'?'#fffbeb':'#fff7ed'
                                        }}>
                                            {tab === 'mvp' ? s.valoracionPromedio.toFixed(1) : 
                                             tab === 'puntos' ? getAvg(s.puntos, s.partidos) : 
                                             tab === 'rebotes' ? getAvg(s.rebotes, s.partidos) : 
                                             getAvg(s.asistencias, s.partidos)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {tab === 'mvp' && (
                        <p style={{textAlign:'center', fontSize:'0.8rem', color:'#888', marginTop:'15px'}}>
                            * La valoración (VAL) se calcula sumando Puntos + Rebotes + Asistencias + Robos + Bloqueos, dividido por partidos jugados.
                        </p>
                    )}
                </>
            )}
        </div>
    );
};
export default StatsViewer;