import React from 'react';

// Agregamos logoUrl a la interfaz
interface Equipo { id: string; nombre: string; victorias: number; derrotas: number; puntos_favor: number; puntos_contra?: number; puntos?: number; logoUrl?: string; }

const StandingsViewer: React.FC<{ equipos: Equipo[], onClose: () => void }> = ({ equipos, onClose }) => {
    
    // Ordenar equipos: Primero por Puntos, luego por Diferencia de Puntos
    const sortedEquipos = [...equipos].sort((a, b) => {
        const ptsA = (a.victorias * 2) + (a.derrotas * 1); // FIBA: 2 pts ganar, 1 perder
        const ptsB = (b.victorias * 2) + (b.derrotas * 1);
        if (ptsB !== ptsA) return ptsB - ptsA;
        
        const diffA = a.puntos_favor - (a.puntos_contra || 0);
        const diffB = b.puntos_favor - (b.puntos_contra || 0);
        return diffB - diffA;
    });

    return (
        <div className="animate-fade-in" style={{maxWidth: '1000px', margin: '0 auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2 style={{color:'var(--primary)', fontSize: '1.5rem'}}>🏆 Tabla General</h2>
                <button onClick={onClose} className="btn btn-secondary">← Volver</button>
            </div>

            <div className="table-container card" style={{padding:0, overflow:'hidden'}}>
                <table className="custom-table" style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead style={{background:'var(--primary)', color:'white'}}>
                        <tr>
                            <th style={{padding:'15px'}}>Pos</th>
                            <th style={{padding:'15px', textAlign:'left'}}>Equipo</th>
                            <th>JJ</th>
                            <th>JG</th>
                            <th>JP</th>
                            <th>PF</th>
                            <th>PC</th>
                            <th>DIF</th>
                            <th style={{background:'var(--accent)', color:'white'}}>PTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEquipos.map((eq, index) => {
                            const pts = (eq.victorias * 2) + (eq.derrotas * 1);
                            const jj = eq.victorias + eq.derrotas;
                            const dif = eq.puntos_favor - (eq.puntos_contra || 0);

                            return (
                                <tr key={eq.id} style={{borderBottom:'1px solid #eee'}}>
                                    <td style={{fontWeight:'bold', textAlign:'center', fontSize:'1.1rem'}}>{index + 1}</td>
                                    
                                    {/* COLUMNA DE EQUIPO CON LOGO */}
                                    <td style={{textAlign:'left', display:'flex', alignItems:'center', gap:'10px', padding:'12px'}}>
                                        {eq.logoUrl ? (
                                            <img src={eq.logoUrl} alt="logo" style={{width:'35px', height:'35px', borderRadius:'50%', objectFit:'cover', border:'1px solid #eee'}} />
                                        ) : (
                                            <div style={{width:'35px', height:'35px', borderRadius:'50%', background:'#eee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem'}}>🏀</div>
                                        )}
                                        <span style={{fontWeight:'bold', color:'var(--text-main)'}}>{eq.nombre}</span>
                                    </td>
                                    
                                    <td style={{textAlign:'center'}}>{jj}</td>
                                    <td style={{textAlign:'center', color:'var(--primary)', fontWeight:'bold'}}>{eq.victorias}</td>
                                    <td style={{textAlign:'center', color:'var(--danger)'}}>{eq.derrotas}</td>
                                    <td style={{textAlign:'center', fontSize:'0.9rem'}}>{eq.puntos_favor}</td>
                                    <td style={{textAlign:'center', fontSize:'0.9rem'}}>{eq.puntos_contra || 0}</td>
                                    <td style={{textAlign:'center', fontWeight:'bold', color: dif >= 0 ? 'green' : 'red'}}>{dif > 0 ? `+${dif}` : dif}</td>
                                    <td style={{textAlign:'center', background:'#fff7ed', fontWeight:'bold', fontSize:'1.1rem', color:'var(--accent)'}}>{pts}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default StandingsViewer;