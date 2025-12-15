import React from 'react';

interface Equipo {
    id: string;
    nombre: string;
    victorias: number;
    derrotas: number;
    puntos: number; // Puntos de tabla (2 por ganar, 1 por perder)
    puntos_favor: number;
    puntos_contra?: number; // Puede venir undefined al principio
    logoUrl?: string;
}

const StandingsViewer: React.FC<{ equipos: Equipo[], onClose: () => void }> = ({ equipos, onClose }) => {
    
    // Escudo por defecto si el link falla o no existe
    const DEFAULT_LOGO = "https://cdn-icons-png.flaticon.com/512/166/166344.png";

    // ORDENAMIENTO FIBA AUTOMÁTICO
    const sortedEquipos = [...equipos].sort((a, b) => {
        // 1. Puntos de Tabla (Mayor a menor)
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        
        // 2. Goal Average (Diferencia de Puntos)
        const diffA = a.puntos_favor - (a.puntos_contra || 0);
        const diffB = b.puntos_favor - (b.puntos_contra || 0);
        if (diffB !== diffA) return diffB - diffA;

        // 3. Puntos a Favor (Más anotador arriba)
        return b.puntos_favor - a.puntos_favor;
    });

    return (
        <div className="animate-fade-in" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:1500,
            display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'
        }}>
            <div style={{
                background:'white', width:'100%', maxWidth:'900px', maxHeight:'90vh', borderRadius:'12px',
                display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 10px 30px rgba(0,0,0,0.5)'
            }}>
                
                {/* HEADER CON DEGRADADO */}
                <div style={{
                    padding:'20px', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
                    color:'white', display:'flex', justifyContent:'space-between', alignItems:'center'
                }}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                        <span style={{fontSize:'2rem'}}>🏆</span>
                        <div>
                            <h2 style={{margin:0, fontSize:'1.5rem'}}>Tabla General</h2>
                            <span style={{fontSize:'0.85rem', opacity:0.9}}>Clasificación Oficial • Liga Madera 15</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{
                        background:'rgba(255,255,255,0.2)', color:'white', border:'none', 
                        width:'35px', height:'35px', borderRadius:'50%', cursor:'pointer', fontSize:'1.2rem', display:'flex', alignItems:'center', justifyContent:'center'
                    }}>✕</button>
                </div>

                <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', textAlign:'center', fontSize:'0.9rem'}}>
                        <thead style={{background:'#f8f9fa', color:'#6b7280', textTransform:'uppercase', fontSize:'0.8rem', position:'sticky', top:0}}>
                            <tr>
                                <th style={{padding:'12px'}}>Pos</th>
                                <th style={{padding:'12px', textAlign:'left'}}>Equipo</th>
                                <th>JJ</th>
                                <th style={{color:'#10b981'}}>G</th>
                                <th style={{color:'#ef4444'}}>P</th>
                                <th style={{color:'#6b7280'}}>PF</th>
                                <th style={{color:'#6b7280'}}>PC</th>
                                <th>DIF</th>
                                <th style={{background:'#eff6ff', color:'#1e40af'}}>PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEquipos.length === 0 ? (
                                <tr><td colSpan={9} style={{padding:'30px', color:'#999'}}>No hay equipos registrados.</td></tr>
                            ) : (
                                sortedEquipos.map((eq, index) => {
                                    const jugados = eq.victorias + eq.derrotas;
                                    const dif = eq.puntos_favor - (eq.puntos_contra || 0);
                                    
                                    // Colores para los primeros 3 lugares
                                    const rankColor = index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#374151';
                                    const isTop3 = index < 3;

                                    return (
                                        <tr key={eq.id} style={{borderBottom:'1px solid #f3f4f6', background: isTop3 ? '#fffbeb' : 'white'}}>
                                            <td style={{padding:'12px', fontWeight:'bold', color: rankColor, fontSize: isTop3 ? '1.1rem':'0.9rem'}}>
                                                {index + 1}
                                            </td>
                                            <td style={{padding:'12px', textAlign:'left'}}>
                                                <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                                                    {/* LOGO CIRCULAR CON CONTROL DE ERRORES */}
                                                    <div style={{
                                                        width:'40px', height:'40px', borderRadius:'50%', 
                                                        background:'white', border:'1px solid #e5e7eb',
                                                        display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                    }}>
                                                        <img 
                                                            src={eq.logoUrl || DEFAULT_LOGO} 
                                                            alt={eq.nombre}
                                                            style={{width:'100%', height:'100%', objectFit:'cover'}}
                                                            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_LOGO; }}
                                                        />
                                                    </div>
                                                    <span style={{fontWeight:'bold', color:'#1f2937', fontSize:'1rem'}}>
                                                        {eq.nombre}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{color:'#6b7280'}}>{jugados}</td>
                                            <td style={{color:'#10b981', fontWeight:'bold'}}>{eq.victorias}</td>
                                            <td style={{color:'#ef4444', fontWeight:'bold'}}>{eq.derrotas}</td>
                                            <td style={{color:'#6b7280', fontSize:'0.85rem'}}>{eq.puntos_favor}</td>
                                            <td style={{color:'#6b7280', fontSize:'0.85rem'}}>{eq.puntos_contra || 0}</td>
                                            <td style={{fontWeight:'bold', color: dif > 0 ? '#10b981' : dif < 0 ? '#ef4444' : '#666'}}>
                                                {dif > 0 ? `+${dif}` : dif}
                                            </td>
                                            <td style={{background:'#eff6ff', fontWeight:'900', fontSize:'1.1rem', color:'#1e40af'}}>
                                                {eq.puntos}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER LEYENDA */}
                <div style={{padding:'15px', borderTop:'1px solid #eee', background:'#f9fafb', fontSize:'0.8rem', color:'#6b7280', display:'flex', gap:'20px'}}>
                    <span>✅ Victoria = 2 Pts</span>
                    <span>❌ Derrota = 1 Pt</span>
                    <span>🚫 Forfeit = 0 Pts</span>
                </div>
            </div>
        </div>
    );
};
export default StandingsViewer;