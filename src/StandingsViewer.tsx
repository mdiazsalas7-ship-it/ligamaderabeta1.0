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
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', zIndex:1500,
            display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'
        }}>
            <div style={{
                background:'white', width:'100%', maxWidth:'800px', maxHeight:'90vh', borderRadius:'12px',
                display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 10px 30px rgba(0,0,0,0.5)'
            }}>
                <div style={{padding:'20px', background:'var(--primary)', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h2 style={{margin:0, fontSize:'1.5rem'}}>🏆 Tabla de Posiciones</h2>
                    <button onClick={onClose} className="btn" style={{background:'rgba(255,255,255,0.2)', color:'white', border:'none'}}>Cerrar</button>
                </div>

                <div style={{flex:1, overflowY:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', textAlign:'center'}}>
                        <thead style={{background:'#f3f4f6', color:'#555', position:'sticky', top:0}}>
                            <tr>
                                <th style={{padding:'15px', textAlign:'left'}}>Pos</th>
                                <th style={{padding:'15px', textAlign:'left'}}>Equipo</th>
                                <th>JJ</th>
                                <th>JG</th>
                                <th>JP</th>
                                <th>PF</th>
                                <th>PC</th>
                                <th>DIF</th>
                                <th style={{background:'#e5e7eb', fontWeight:'bold'}}>PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEquipos.map((eq, index) => {
                                const jugados = eq.victorias + eq.derrotas;
                                const dif = eq.puntos_favor - (eq.puntos_contra || 0);
                                return (
                                    <tr key={eq.id} style={{borderBottom:'1px solid #eee', background: index < 4 ? '#f0fdf4' : 'white'}}>
                                        <td style={{padding:'12px', fontWeight:'bold', color: index===0?'#d97706':'#444'}}>
                                            {index + 1}
                                        </td>
                                        <td style={{padding:'12px', textAlign:'left', fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
                                            {eq.logoUrl ? 
                                                <img src={eq.logoUrl} style={{width:'30px', height:'30px', borderRadius:'50%', objectFit:'cover'}} alt=""/> : 
                                                <span style={{fontSize:'1.2rem'}}>🏀</span>
                                            }
                                            {eq.nombre}
                                        </td>
                                        <td>{jugados}</td>
                                        <td style={{color:'#10b981', fontWeight:'bold'}}>{eq.victorias}</td>
                                        <td style={{color:'#ef4444'}}>{eq.derrotas}</td>
                                        <td style={{fontSize:'0.9rem', color:'#666'}}>{eq.puntos_favor}</td>
                                        <td style={{fontSize:'0.9rem', color:'#666'}}>{eq.puntos_contra || 0}</td>
                                        <td style={{fontWeight:'bold', color: dif > 0 ? 'green' : dif < 0 ? 'red' : '#666'}}>
                                            {dif > 0 ? `+${dif}` : dif}
                                        </td>
                                        <td style={{background:'#f3f4f6', fontWeight:'900', fontSize:'1.1rem', color:'var(--primary)'}}>
                                            {eq.puntos}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default StandingsViewer;