import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import LogoUploader from './LogoUploader'; 
import PlayoffBracket from './PlayoffBracket'; 

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
    const [editingLogo, setEditingLogo] = useState(false);
    const [showBracket, setShowBracket] = useState(false); 
    
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

    const handleLogoUploaded = async (newUrl: string, formaId: string) => {
        try {
            await updateDoc(doc(db, 'forma21s', formaId), { logoUrl: newUrl });
            try { await updateDoc(doc(db, 'equipos', formaId), { logoUrl: newUrl }); } catch (e) {}
            alert("✅ Logo actualizado correctamente.");
            setEditingLogo(false);
            refreshData(); 
        } catch (error) { console.error("Error:", error); alert("Error al guardar la URL del logo."); }
    };

    // --- CASO 1: NO TIENE EQUIPO ASIGNADO AÚN ---
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

    // --- CASO 2: EQUIPO CREADO PERO PENDIENTE DE APROBACIÓN (LÓGICA PEDIDA) ---
    if (!isApproved) {
        return (
            <div style={{
                textAlign:'center', padding:'50px', background:'white', borderRadius:'16px', 
                boxShadow:'0 10px 25px -5px rgba(0,0,0,0.1)', maxWidth:'600px', margin:'0 auto'
            }}>
                <div style={{fontSize:'4rem', marginBottom:'20px'}}>⏳</div>
                <h2 style={{color:'#f59e0b', marginBottom:'10px'}}>Esperando Aprobación</h2>
                <p style={{color:'#666', fontSize:'1.1rem', marginBottom:'30px'}}>
                    Tu equipo <strong>"{miEquipo.nombreEquipo}"</strong> ha sido registrado exitosamente.
                    <br/><br/>
                    El Administrador debe aprobar tu inscripción antes de que puedas gestionar tu Roster o ver el calendario.
                </p>
                <div style={{padding:'15px', background:'#fffbeb', color:'#92400e', borderRadius:'8px', fontSize:'0.9rem'}}>
                    Por favor, espera a que el comisionado active tu equipo.
                </div>
            </div>
        );
    }

    // --- CASO 3: EQUIPO APROBADO (DASHBOARD COMPLETO) ---
    return (
        <div className="animate-fade-in">
            {showBracket && <PlayoffBracket adminMode={false} onClose={() => setShowBracket(false)} />}

            <div className="dashboard-grid" style={{marginBottom:'30px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                
                {/* LOGO Y NOMBRE */}
                <div className="dashboard-card" style={{borderLeft:'4px solid #10b981', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'15px'}}>
                        {editingLogo ? (
                            <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                                <h4 style={{margin:'0 0 10px 0', fontSize:'0.9rem'}}>Cambiar Logo</h4>
                                <LogoUploader currentUrl={miEquipo.logoUrl} onUploadSuccess={(url) => handleLogoUploaded(url, miEquipo.id)} />
                                <button onClick={()=>setEditingLogo(false)} style={{marginTop:'15px', fontSize:'0.8rem', background:'none', border:'none', color:'#666', textDecoration:'underline', cursor:'pointer'}}>Cancelar</button>
                            </div>
                        ) : (
                            <>
                                <div style={{position:'relative', width:'80px', height:'80px'}}>
                                    <img src={miEquipo.logoUrl || DEFAULT_LOGO} alt="Logo" style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover', border:'2px solid #eee'}} onError={(e)=>{(e.target as HTMLImageElement).src=DEFAULT_LOGO}} />
                                    <button onClick={() => setEditingLogo(true)} style={{position:'absolute', bottom:0, right:0, background:'#3b82f6', color:'white', border:'none', borderRadius:'50%', width:'28px', height:'28px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.2)'}}>✏️</button>
                                </div>
                                <div>
                                    <div style={{fontWeight:'bold', fontSize:'1.2rem', color:'#1f2937'}}>{miEquipo.nombreEquipo}</div>
                                    <div style={{fontSize:'0.8rem', fontWeight:'bold', color:'#10b981', marginTop:'4px'}}>✅ APROBADO</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* BOTONES ACCIÓN */}
                <div className="dashboard-card" onClick={() => setViewRosterId(miEquipo.id)} style={{cursor:'pointer', borderLeft:'4px solid #3b82f6', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                    <div style={{fontSize:'2.5rem', marginBottom:'5px'}}>👥</div>
                    <div style={{fontWeight:'bold'}}>Ver Roster</div>
                    <div style={{fontSize:'0.8rem', color:'#666'}}>{miEquipo.rosterCompleto ? 'Completo' : 'Incompleto'}</div>
                </div>

                <div className="dashboard-card" onClick={() => setSelectedFormId(miEquipo.id)} style={{cursor:'pointer', borderLeft:'4px solid #8b5cf6', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                    <div style={{fontSize:'2.5rem', marginBottom:'5px'}}>📝</div>
                    <div style={{fontWeight:'bold'}}>Editar Roster</div>
                    <div style={{fontSize:'0.7rem', color:'#666'}}>Gestionar Jugadores</div>
                </div>

                <div className="dashboard-card" onClick={() => setShowBracket(true)} style={{cursor:'pointer', borderLeft:'4px solid #7c3aed', background:'white', padding:'20px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                    <div style={{fontSize:'2.5rem', marginBottom:'5px'}}>🏆</div>
                    <div style={{fontWeight:'bold'}}>Playoffs</div>
                </div>
            </div>

            {/* PARTIDOS */}
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
        </div>
    );
};
export default DelegadoDashboard;