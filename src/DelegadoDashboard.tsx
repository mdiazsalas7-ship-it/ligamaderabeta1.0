import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import LogoUploader from './LogoUploader'; // <--- IMPORTANTE: Importamos el componente

interface Forma21 { 
    id: string; 
    delegadoId: string; 
    nombreEquipo: string; 
    estatus?: string; 
    aprobado?: boolean; 
    logoUrl?: string; 
    rosterCompleto?: boolean;
}

interface Match {
    id: string;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    fechaAsignada: string;
    hora: string;
    estatus: string;
    cancha: string;
    esLocal: boolean;
}

interface DelegadoDashboardProps {
    formas21: Forma21[];
    userUid: string;
    userEquipoId: string | null;
    refreshData: () => void;
    setViewRosterId: (id: string) => void;
    setSelectedFormId: (id: string) => void;
    setSelectForma5MatchId: (id: string) => void;
    onRegister: () => void;
}

const DelegadoDashboard: React.FC<DelegadoDashboardProps> = ({ 
    formas21, userEquipoId, refreshData,
    setViewRosterId, setSelectedFormId, setSelectForma5MatchId, onRegister 
}) => {
    
    const [matches, setMatches] = useState<Match[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [editingLogo, setEditingLogo] = useState(false); // Estado para mostrar el uploader
    
    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    useEffect(() => {
        const fetchMyMatches = async () => {
            if (!userEquipoId) return;
            setLoadingMatches(true);
            try {
                const matchesFound: Match[] = [];
                const calRef = collection(db, 'calendario');
                
                const q1 = query(calRef, where('equipoLocalId', '==', userEquipoId));
                const snap1 = await getDocs(q1);
                snap1.forEach(d => { if(d.data().estatus==='programado') matchesFound.push({id:d.id, ...d.data(), esLocal:true} as any); });

                const q2 = query(calRef, where('equipoVisitanteId', '==', userEquipoId));
                const snap2 = await getDocs(q2);
                snap2.forEach(d => { if(d.data().estatus==='programado' && !matchesFound.find(m=>m.id===d.id)) matchesFound.push({id:d.id, ...d.data(), esLocal:false} as any); });
                
                matchesFound.sort((a,b) => a.fechaAsignada.localeCompare(b.fechaAsignada));
                setMatches(matchesFound);
            } catch (error) { console.error(error); } finally { setLoadingMatches(false); }
        };
        fetchMyMatches();
    }, [userEquipoId]);

    // ESTA FUNCIÓN SE LLAMA AUTOMÁTICAMENTE CUANDO TERMINA LA CARGA DEL LOGO
    const handleLogoUploaded = async (newUrl: string, formaId: string) => {
        try {
            // Actualizamos en ambas colecciones para consistencia
            await updateDoc(doc(db, 'forma21s', formaId), { logoUrl: newUrl });
            
            // Intentamos actualizar en equipos también (si existe con el mismo ID)
            try {
                 await updateDoc(doc(db, 'equipos', formaId), { logoUrl: newUrl });
            } catch (e) {
                // Si falla equipos (raro, pero posible si IDs difieren), no bloqueamos
                console.warn("No se pudo actualizar logo en colección equipos", e);
            }
            
            alert("✅ Logo actualizado correctamente.");
            setEditingLogo(false);
            refreshData(); 
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar la URL del logo.");
        }
    };

    if (formas21.length === 0) {
        return (
            <div className="card" style={{textAlign:'center', padding:'40px'}}>
                <h3>¡Bienvenido Delegado!</h3>
                <p>Aún no has inscrito a tu equipo.</p>
                <button onClick={onRegister} className="btn btn-primary" style={{marginTop:'10px'}}>📝 Inscribir Equipo</button>
            </div>
        );
    }

    const miEquipo = formas21[0];
    const isApproved = miEquipo.estatus === 'aprobado' || miEquipo.aprobado === true;
    const canEditRoster = !isApproved; 

    return (
        <div className="animate-fade-in">
            <div className="dashboard-grid" style={{marginBottom:'30px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                
                {/* TARJETA IDENTIDAD Y LOGO */}
                <div className="dashboard-card" style={{
                    borderLeft: isApproved?'4px solid #10b981':'4px solid #f59e0b', 
                    background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'
                }}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'15px'}}>
                        {/* AQUI MOSTRAMOS EL LOGO O EL UPLOADER */}
                        {editingLogo ? (
                            <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                                <h4 style={{margin:'0 0 10px 0', fontSize:'0.9rem'}}>Cambiar Logo</h4>
                                <LogoUploader 
                                    currentUrl={miEquipo.logoUrl}
                                    onUploadSuccess={(url) => handleLogoUploaded(url, miEquipo.id)}
                                />
                                <button 
                                    onClick={()=>setEditingLogo(false)} 
                                    style={{marginTop:'15px', fontSize:'0.8rem', background:'none', border:'none', color:'#666', textDecoration:'underline', cursor:'pointer'}}
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{position:'relative', width:'80px', height:'80px'}}>
                                    <img 
                                        src={miEquipo.logoUrl || DEFAULT_LOGO} 
                                        alt="Logo" 
                                        style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover', border:'2px solid #eee'}} 
                                        onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}}
                                    />
                                    <button 
                                        onClick={() => setEditingLogo(true)}
                                        style={{
                                            position:'absolute', bottom:0, right:0, background:'#3b82f6', color:'white', 
                                            border:'none', borderRadius:'50%', width:'28px', height:'28px', cursor:'pointer',
                                            display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.2)'
                                        }}
                                        title="Cambiar Logo"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                <div>
                                    <div style={{fontWeight:'bold', fontSize:'1.2rem', color:'#1f2937'}}>{miEquipo.nombreEquipo}</div>
                                    <div style={{fontSize:'0.8rem', fontWeight:'bold', color: isApproved ? '#10b981' : '#f59e0b', marginTop:'4px'}}>
                                        {isApproved ? '✅ APROBADO' : '⏳ EN REVISIÓN'}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* TARJETA VER ROSTER */}
                <div className="dashboard-card" onClick={() => setViewRosterId(miEquipo.id)} style={{cursor:'pointer', borderLeft:'4px solid #3b82f6', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                    <div style={{fontSize:'2.5rem', marginBottom:'5px'}}>👥</div>
                    <div style={{fontWeight:'bold'}}>Ver Roster</div>
                    <div style={{fontSize:'0.8rem', color:'#666'}}>{miEquipo.rosterCompleto ? 'Completo' : 'Incompleto'}</div>
                </div>

                {/* TARJETA EDITAR ROSTER */}
                <div className="dashboard-card" onClick={canEditRoster ? () => setSelectedFormId(miEquipo.id) : undefined} style={{cursor: canEditRoster ? 'pointer' : 'not-allowed', opacity: canEditRoster ? 1 : 0.7, borderLeft:'4px solid #8b5cf6', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                    <div style={{fontSize:'2.5rem', marginBottom:'5px'}}>{canEditRoster ? '📝' : '🔒'}</div>
                    <div style={{fontWeight:'bold'}}>{canEditRoster ? 'Editar Roster' : 'Cerrado'}</div>
                    <div style={{fontSize:'0.7rem', color:'#666', marginTop:'5px'}}>
                        {canEditRoster ? 'Modificar jugadores' : 'Solo Admin puede editar'}
                    </div>
                </div>
            </div>

            {/* PARTIDOS */}
            {isApproved && (
                <div style={{marginTop:'30px'}}>
                    <h3 style={{color:'#374151', marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}>🏀 Próximos Partidos</h3>
                    {loadingMatches ? <div style={{textAlign:'center', color:'#666'}}>Cargando...</div> : 
                     matches.length === 0 ? <div className="card" style={{textAlign:'center', color:'#888', padding:'30px'}}>Sin partidos programados.</div> : (
                        <div style={{display:'grid', gap:'15px'}}>
                            {matches.map(m => (
                                <div key={m.id} className="card" style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:'5px solid #f59e0b', flexWrap:'wrap', gap:'15px', padding:'15px'}}>
                                    <div style={{flex:1, minWidth:'200px'}}>
                                        <div style={{fontSize:'0.85rem', color:'#6b7280', marginBottom:'4px'}}>📅 {m.fechaAsignada} - ⏰ {m.hora} | 📍 {m.cancha}</div>
                                        <div style={{fontWeight:'bold', fontSize:'1.2rem', color:'#1f2937'}}>{m.esLocal ? '🏠 Tú' : m.equipoLocalNombre} vs {!m.esLocal ? '✈️ Tú' : m.equipoVisitanteNombre}</div>
                                    </div>
                                    <button onClick={() => setSelectForma5MatchId(m.id)} className="btn btn-primary" style={{display:'flex', alignItems:'center', gap:'8px', padding:'10px 20px'}}>📋 Cargar Alineación</button>
                                </div>
                            ))}
                        </div>
                     )}
                </div>
            )}
        </div>
    );
};
export default DelegadoDashboard;