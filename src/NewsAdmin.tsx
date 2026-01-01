import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, getDocs, deleteDoc, doc, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface NewsItem { id: string; titulo: string; cuerpo: string; tipo: 'general' | 'sancion' | 'destacado'; fecha: any; imageUrl?: string; }

// Interfaz para los partidos que vamos a importar
interface PartidoFinalizado {
    id: string;
    local: string;
    visitante: string;
    scoreL: number;
    scoreV: number;
    mvp: string;
    puntosMvp: number;
    fecha: string;
}

const NewsAdmin: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    
    // Estados del formulario
    const [titulo, setTitulo] = useState('');
    const [cuerpo, setCuerpo] = useState('');
    const [tipo, setTipo] = useState<'general' | 'sancion' | 'destacado'>('general');
    const [imageFile, setImageFile] = useState<File | null>(null);
    
    const [loading, setLoading] = useState(false);

    // Estados para el Selector de Partidos
    const [showMatchSelector, setShowMatchSelector] = useState(false);
    const [recentMatches, setRecentMatches] = useState<PartidoFinalizado[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);

    const fetchNews = async () => {
        try {
            const q = query(collection(db, 'noticias'), orderBy('fecha', 'desc'));
            const snap = await getDocs(q);
            setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchNews(); }, []);

    // --- 1. BUSCAR PARTIDOS FINALIZADOS RECIENTES (CORREGIDO) ---
    const fetchRecentMatches = async () => {
        setLoadingMatches(true);
        try {
            // CAMBIO: Traemos todos los finalizados sin ordenar en la query para evitar error de índice
            const q = query(collection(db, 'calendario'), where('estatus', '==', 'finalizado'));
            const snap = await getDocs(q);
            
            let matchesData = await Promise.all(snap.docs.map(async (docSnap) => {
                const d = docSnap.data();
                
                // Buscar MVP en stats_partido
                let mvpNombre = "Jugador Destacado";
                let mvpPuntos = 0;
                
                const statsQ = query(collection(db, 'stats_partido'), where('partidoId', '==', docSnap.id));
                const statsSnap = await getDocs(statsQ);
                
                statsSnap.forEach(s => {
                    const stat = s.data();
                    const pts = Number(stat.puntos || 0);
                    if (pts > mvpPuntos) {
                        mvpPuntos = pts;
                        mvpNombre = stat.nombre;
                    }
                });

                return {
                    id: docSnap.id,
                    local: d.equipoLocalNombre,
                    visitante: d.equipoVisitanteNombre,
                    scoreL: d.marcadorLocal,
                    scoreV: d.marcadorVisitante,
                    mvp: mvpNombre,
                    puntosMvp: mvpPuntos,
                    fecha: d.fechaAsignada || ''
                } as PartidoFinalizado;
            }));

            // ORDENAMIENTO MANUAL (Del más reciente al más antiguo)
            matchesData.sort((a, b) => {
                return b.fecha.localeCompare(a.fecha); 
            });

            // TOMAR SOLO LOS 5 ÚLTIMOS
            setRecentMatches(matchesData.slice(0, 5));
            
            if (matchesData.length === 0) {
                alert("No se encontraron partidos finalizados en la base de datos.");
            } else {
                setShowMatchSelector(true); // Abrir modal
            }

        } catch (e: any) {
            console.error(e);
            alert("Error buscando partidos: " + e.message);
        } finally {
            setLoadingMatches(false);
        }
    };

    // --- 2. GENERAR TEXTO AUTOMÁTICO (IA LOCAL) ---
    const selectMatchAndGenerate = (match: PartidoFinalizado) => {
        const localWins = match.scoreL > match.scoreV;
        const ganador = localWins ? match.local : match.visitante;
        const perdedor = localWins ? match.visitante : match.local;
        const ptsG = localWins ? match.scoreL : match.scoreV;
        const ptsP = localWins ? match.scoreV : match.scoreL;
        const dif = ptsG - ptsP;

        // Título Inteligente
        let newTitle = `Victoria de ${ganador}`;
        if (dif > 20) newTitle = `¡${ganador} aplasta a ${perdedor} con autoridad!`;
        else if (dif < 5) newTitle = `¡Final de infarto! ${ganador} gana en el cierre`;
        else if (dif >= 10) newTitle = `¡Gran triunfo de ${ganador} ante ${perdedor}!`;

        // Cuerpo Inteligente
        let intro = "";
        if (dif > 20) intro = `En una demostración de poder absoluto, ${ganador} dominó la cancha venciendo a ${perdedor} con un marcador de ${ptsG} a ${ptsP}.`;
        else if (dif < 5) intro = `¡No apto para cardíacos! 😱 En un duelo definido en los segundos finales, ${ganador} logró imponerse ante ${perdedor}. Marcador final: ${ptsG} - ${ptsP}.`;
        else intro = `${ganador} suma una importante victoria tras vencer a ${perdedor} en un interesante encuentro que finalizó ${ptsG} por ${ptsP}.`;

        const mvpText = `🔥 La figura fue ${match.mvp}, quien lideró con ${match.puntosMvp} puntos.`;
        const cierre = `¡Sigue la acción en la Liga Madera 15! 🏀`;

        // LLENAR EL FORMULARIO
        setTitulo(newTitle);
        setCuerpo(`${intro}\n\n${mvpText}\n\n${cierre}`);
        setTipo('destacado');
        setShowMatchSelector(false); // Cerrar selector
    };

    const handlePublicar = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        try {
            let imageUrl = '';

            // 1. Subir imagen a Storage si existe
            if (imageFile) {
                const storageRef = ref(storage, `noticias/${Date.now()}_${imageFile.name}`);
                await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(storageRef);
            }

            // 2. Guardar en Firestore
            await addDoc(collection(db, 'noticias'), {
                titulo, 
                cuerpo, 
                tipo, 
                fecha: Timestamp.now(),
                imageUrl: imageUrl || null
            });

            setTitulo(''); setCuerpo(''); setImageFile(null); 
            alert("✅ Noticia publicada con éxito."); 
            fetchNews();
        } catch (e) { 
            console.error(e);
            alert("Error al publicar."); 
        } finally { setLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if(!window.confirm("¿Borrar noticia?")) return;
        await deleteDoc(doc(db, 'noticias', id));
        setNews(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="card animate-fade-in" style={{maxWidth: '800px', margin: '0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)', fontSize: '1.5rem'}}>📢 Gestión de Noticias</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            {/* --- BOTÓN NUEVO: GENERAR DESDE PARTIDO --- */}
            <button 
                onClick={fetchRecentMatches} 
                disabled={loadingMatches}
                className="btn" 
                style={{
                    width: '100%', marginBottom: '20px', 
                    background: '#f59e0b', color: 'black', fontWeight: 'bold', 
                    padding: '12px', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
                }}
            >
                {loadingMatches ? 'Buscando partidos...' : '🪄 GENERAR NOTICIA DE PARTIDO RECIENTE'}
            </button>

            {/* FORMULARIO DE PUBLICACIÓN */}
            <form onSubmit={handlePublicar} style={{background:'#f9fafb', padding:'20px', borderRadius:'12px', marginBottom:'30px', border:'1px solid var(--border)'}}>
                <div style={{marginBottom:'15px'}}>
                    <label style={{fontWeight:'bold'}}>Título</label>
                    <input type="text" value={titulo} onChange={e=>setTitulo(e.target.value)} required placeholder="Ej: Victoria de Lobos" />
                </div>
                
                <div style={{marginBottom:'15px'}}>
                    <label style={{fontWeight:'bold'}}>Foto del MVP / Partido</label>
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => { if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]); }} 
                        style={{background:'white', padding: '10px', width: '100%'}}
                    />
                </div>

                <div style={{marginBottom:'15px'}}>
                    <label style={{fontWeight:'bold'}}>Contenido de la Noticia</label>
                    <textarea 
                        value={cuerpo} onChange={e=>setCuerpo(e.target.value)} required 
                        placeholder="El resumen se generará automáticamente si usas el botón amarillo, o escribe aquí..."
                        style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid var(--border)', minHeight:'120px', fontFamily:'inherit', lineHeight: '1.5'}}
                    />
                </div>
                <div style={{marginBottom:'15px'}}>
                    <label style={{fontWeight:'bold'}}>Tipo</label>
                    <select value={tipo} onChange={e=>setTipo(e.target.value as any)}>
                        <option value="general">📰 Noticia General</option>
                        <option value="sancion">⚖️ Sanción / Disciplinario</option>
                        <option value="destacado">⭐ Destacado (Resultados)</option>
                    </select>
                </div>
                <button disabled={loading} className="btn btn-primary" style={{width:'100%', padding:'12px', fontSize:'1rem'}}>
                    {loading ? 'Subiendo y Publicando...' : 'PUBLICAR NOTICIA'}
                </button>
            </form>

            {/* SELECTOR DE PARTIDOS (MODAL) */}
            {showMatchSelector && (
                <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', zIndex:3000, display:'flex', justifyContent:'center', alignItems:'center'}}>
                    <div className="animate-fade-in" style={{background:'white', width:'90%', maxWidth:'500px', borderRadius:'10px', padding:'20px', maxHeight:'80vh', overflowY:'auto'}}>
                        <h3 style={{marginTop:0, color:'#1f2937'}}>Selecciona el partido</h3>
                        <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'15px'}}>Se generará el texto automáticamente. Luego subes la foto.</p>
                        
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {recentMatches.map(m => (
                                <div 
                                    key={m.id} 
                                    onClick={() => selectMatchAndGenerate(m)}
                                    style={{
                                        border:'1px solid #ddd', padding:'10px', borderRadius:'8px', cursor:'pointer', background:'#f3f4f6',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{fontWeight:'bold', color:'#2563eb'}}>{m.local} vs {m.visitante}</div>
                                    <div style={{fontSize:'1.1rem', fontWeight:'900'}}>{m.scoreL} - {m.scoreV}</div>
                                    <div style={{fontSize:'0.8rem', color:'#4b5563'}}>MVP: {m.mvp} ({m.puntosMvp} pts)</div>
                                    <div style={{fontSize:'0.7rem', color:'#999', marginTop:'5px'}}>📅 {m.fecha}</div>
                                </div>
                            ))}
                            {recentMatches.length === 0 && <p style={{textAlign:'center', color:'#999'}}>No hay partidos finalizados recientes.</p>}
                        </div>
                        <button onClick={() => setShowMatchSelector(false)} className="btn btn-secondary" style={{width:'100%', marginTop:'20px'}}>Cancelar</button>
                    </div>
                </div>
            )}

            <h3 style={{fontSize:'1rem', marginBottom:'15px', color: 'var(--primary)'}}>Historial de Noticias</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {news.map(n => (
                    <div key={n.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', border:'1px solid var(--border)', borderRadius:'10px', background:'white'}}>
                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                            {n.imageUrl && <img src={n.imageUrl} alt="img" style={{width:'50px', height:'50px', objectFit:'cover', borderRadius:'8px'}} />}
                            <div>
                                <div style={{fontWeight:'bold', color: n.tipo==='sancion'?'var(--danger)':'var(--primary)'}}>
                                    {n.tipo==='sancion' && '⚖️'} {n.titulo}
                                </div>
                                <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                    {n.fecha?.seconds ? new Date(n.fecha.seconds * 1000).toLocaleDateString() : ''}
                                </div>
                            </div>
                        </div>
                        <button onClick={()=>handleDelete(n.id)} className="btn btn-danger" style={{fontSize:'0.8rem', padding:'5px 10px'}}>🗑️</button>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default NewsAdmin;