import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';

interface NewsItem { id: string; titulo: string; cuerpo: string; tipo: 'general' | 'sancion' | 'destacado'; fecha: any; }

const NewsAdmin: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [titulo, setTitulo] = useState('');
    const [cuerpo, setCuerpo] = useState('');
    const [tipo, setTipo] = useState<'general' | 'sancion' | 'destacado'>('general');
    const [loading, setLoading] = useState(false);

    const fetchNews = async () => {
        try {
            const q = query(collection(db, 'noticias'), orderBy('fecha', 'desc'));
            const snap = await getDocs(q);
            setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchNews(); }, []);

    const handlePublicar = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        try {
            await addDoc(collection(db, 'noticias'), {
                titulo, cuerpo, tipo, fecha: Timestamp.now()
            });
            setTitulo(''); setCuerpo(''); alert("Noticia publicada."); fetchNews();
        } catch (e) { alert("Error al publicar."); } finally { setLoading(false); }
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

            <form onSubmit={handlePublicar} style={{background:'#f9fafb', padding:'20px', borderRadius:'12px', marginBottom:'30px', border:'1px solid var(--border)'}}>
                <div style={{marginBottom:'15px'}}>
                    <label>Título</label>
                    <input type="text" value={titulo} onChange={e=>setTitulo(e.target.value)} required placeholder="Ej: Suspensión de Jornada" />
                </div>
                <div style={{marginBottom:'15px'}}>
                    <label>Contenido</label>
                    <textarea 
                        value={cuerpo} onChange={e=>setCuerpo(e.target.value)} required 
                        placeholder="Escribe los detalles..."
                        style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid var(--border)', minHeight:'100px', fontFamily:'inherit'}}
                    />
                </div>
                <div style={{marginBottom:'15px'}}>
                    <label>Tipo</label>
                    <select value={tipo} onChange={e=>setTipo(e.target.value as any)}>
                        <option value="general">📰 Noticia General</option>
                        <option value="sancion">⚖️ Sanción / Disciplinario</option>
                        <option value="destacado">⭐ Destacado</option>
                    </select>
                </div>
                <button disabled={loading} className="btn btn-primary" style={{width:'100%'}}>{loading?'Publicando...':'Publicar'}</button>
            </form>

            <h3 style={{fontSize:'1rem', marginBottom:'15px', color: 'var(--primary)'}}>Historial</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {news.map(n => (
                    <div key={n.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', border:'1px solid var(--border)', borderRadius:'10px', background:'white'}}>
                        <div>
                            <div style={{fontWeight:'bold', color: n.tipo==='sancion'?'var(--danger)':'var(--primary)'}}>
                                {n.tipo==='sancion' && '⚖️'} {n.titulo}
                            </div>
                            <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                {n.fecha?.seconds ? new Date(n.fecha.seconds * 1000).toLocaleDateString() : ''}
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