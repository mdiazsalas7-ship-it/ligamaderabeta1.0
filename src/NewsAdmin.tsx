import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase'; 
import { collection, addDoc, getDocs, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface NewsItem { id: string; titulo: string; cuerpo: string; tipo: 'general' | 'sancion' | 'destacado'; fecha: any; imageUrl?: string; }

const NewsAdmin: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [titulo, setTitulo] = useState('');
    const [cuerpo, setCuerpo] = useState('');
    const [tipo, setTipo] = useState<'general' | 'sancion' | 'destacado'>('general');
    const [imageFile, setImageFile] = useState<File | null>(null);
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
            alert("Noticia publicada con éxito."); 
            fetchNews();
        } catch (e) { 
            console.error(e);
            alert("Error al publicar. Verifica tu conexión."); 
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

            <form onSubmit={handlePublicar} style={{background:'#f9fafb', padding:'20px', borderRadius:'12px', marginBottom:'30px', border:'1px solid var(--border)'}}>
                <div style={{marginBottom:'15px'}}>
                    <label>Título</label>
                    <input type="text" value={titulo} onChange={e=>setTitulo(e.target.value)} required placeholder="Ej: MVP de la Jornada" />
                </div>
                
                <div style={{marginBottom:'15px'}}>
                    <label>Imagen (Opcional)</label>
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => { if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]); }} 
                        style={{background:'white', padding: '10px', width: '100%'}}
                    />
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
                <button disabled={loading} className="btn btn-primary" style={{width:'100%'}}>{loading?'Subiendo...':'Publicar'}</button>
            </form>

            <h3 style={{fontSize:'1rem', marginBottom:'15px', color: 'var(--primary)'}}>Historial</h3>
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