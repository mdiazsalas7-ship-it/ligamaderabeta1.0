import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface NewsItem { id: string; titulo: string; cuerpo: string; tipo: 'general' | 'sancion' | 'destacado'; fecha: any; imageUrl?: string; }

const NewsFeed: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const q = query(collection(db, 'noticias'), orderBy('fecha', 'desc'), limit(20));
                const snap = await getDocs(q);
                setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetch();
    }, []);

    const renderModal = () => (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)'}} onClick={() => setSelectedNews(null)}>
            <div className="animate-fade-in" style={{backgroundColor: 'white', padding: '0', borderRadius: '16px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', overflow: 'hidden'}} onClick={(e) => e.stopPropagation()}>
                
                {selectedNews?.imageUrl && (
                    <div style={{width: '100%', height: '300px', overflow: 'hidden', backgroundColor: '#f3f4f6'}}>
                        <img src={selectedNews.imageUrl} alt="Noticia" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                    </div>
                )}

                <div style={{padding: '30px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
                        <div>
                            <h2 style={{margin:0, color:'var(--primary)', fontSize:'1.5rem', lineHeight: 1.2}}>{selectedNews?.titulo}</h2>
                            <span style={{fontSize:'0.85rem', color:'var(--text-muted)', display:'block', marginTop:'5px'}}>
                                {selectedNews?.fecha?.seconds ? new Date(selectedNews.fecha.seconds * 1000).toLocaleDateString(undefined, {weekday:'long', year:'numeric', month:'long', day:'numeric'}) : ''}
                            </span>
                        </div>
                        <button onClick={() => setSelectedNews(null)} className="btn btn-secondary" style={{fontSize:'1.2rem', padding:'5px 12px'}}>×</button>
                    </div>
                    
                    <div style={{whiteSpace: 'pre-wrap', lineHeight: '1.8', color: 'var(--text-main)', fontSize: '1rem'}}>
                        {selectedNews?.cuerpo}
                    </div>

                    <div style={{marginTop: '30px', textAlign: 'right'}}>
                        <button onClick={() => setSelectedNews(null)} className="btn btn-primary">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{maxWidth: '800px', margin: '0 auto'}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', margin: 0 }}>📢 Tablón de Anuncios</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            {loading ? <div style={{textAlign:'center', padding:'40px', color:'var(--text-muted)'}}>Cargando noticias...</div> : news.length === 0 ? <div className="card" style={{textAlign:'center', padding:'40px'}}>No hay noticias publicadas.</div> : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    {news.map(item => {
                        let borderLeft = '4px solid var(--primary)';
                        let bg = 'white';
                        let icon = '📰';
                        if (item.tipo === 'sancion') { borderLeft = '4px solid var(--danger)'; bg = '#fef2f2'; icon = '⚖️'; } 
                        else if (item.tipo === 'destacado') { borderLeft = '4px solid var(--accent)'; bg = '#fff7ed'; icon = '⭐'; }

                        return (
                            <div key={item.id} className="card dashboard-card" onClick={() => setSelectedNews(item)} style={{padding:'0', marginBottom:0, borderLeft, background: bg, height: 'auto', cursor: 'pointer', textAlign: 'left', overflow: 'hidden', display: 'flex'}}>
                                {item.imageUrl && (
                                    <div style={{width: '100px', minWidth: '100px', height: 'auto', background: `url(${item.imageUrl}) center/cover no-repeat`}}></div>
                                )}
                                <div style={{padding: '15px', flex: 1}}>
                                    <div style={{display:'flex', justifyContent:'space-between', width: '100%', marginBottom:'5px'}}>
                                        <span style={{fontWeight:'bold', color:'var(--text-main)', fontSize:'1rem', display:'flex', alignItems:'center', gap:'8px'}}>
                                            <span>{icon}</span> {item.titulo}
                                        </span>
                                        <span style={{fontSize:'0.7rem', color:'var(--text-muted)', whiteSpace: 'nowrap'}}>
                                            {item.fecha?.seconds ? new Date(item.fecha.seconds * 1000).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <p style={{fontSize:'0.85rem', color:'var(--text-muted)', margin:0}}>
                                        {item.cuerpo.length > 100 ? item.cuerpo.substring(0, 100) + '...' : item.cuerpo}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {selectedNews && renderModal()}
        </div>
    );
};
export default NewsFeed;