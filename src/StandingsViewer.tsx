// src/StandingsViewer.tsx (ALGORITMO FIBA APÉNDICE D COMPLETO)

import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';

interface Equipo extends DocumentData {
    id: string;
    nombre: string;
    victorias: number;
    derrotas: number;
    puntos_favor: number;
    puntos_contra?: number;
    puntos?: number; // Puntos de clasificación (2 o 1)
}

interface PartidoResumen {
    equipoLocalId: string;
    equipoVisitanteId: string;
    marcadorLocal: number;
    marcadorVisitante: number;
}

interface StandingsViewerProps {
    equipos: Equipo[]; // Recibimos la lista base, pero calcularemos el orden aquí
    onClose: () => void;
    recalculateStandings?: () => Promise<void>; 
    calculating?: boolean;
    isAdmin?: boolean;
}

const StandingsViewer: React.FC<StandingsViewerProps> = ({ equipos: initialEquipos, onClose }) => {
    const [sortedEquipos, setSortedEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);

    // Cargar partidos para poder calcular el desempate "Head-to-Head" (Apéndice D FIBA)
    useEffect(() => {
        const fetchMatchesAndSort = async () => {
            try {
                const partidosSnap = await getDocs(collection(db, 'partidos'));
                const partidos: PartidoResumen[] = partidosSnap.docs.map(doc => {
                    const d = doc.data();
                    return {
                        equipoLocalId: d.equipoLocalId,
                        equipoVisitanteId: d.equipoVisitanteId,
                        marcadorLocal: d.marcadorLocal,
                        marcadorVisitante: d.marcadorVisitante
                    };
                });

                // Ordenar usando el algoritmo complejo
                const ordenados = sortTeamsFIBA(initialEquipos, partidos);
                setSortedEquipos(ordenados);
            } catch (error) {
                console.error("Error al cargar partidos para desempate:", error);
                // Fallback: ordenar solo por lo básico si falla la carga de partidos
                setSortedEquipos([...initialEquipos].sort((a, b) => (b.puntos || 0) - (a.puntos || 0)));
            } finally {
                setLoading(false);
            }
        };

        fetchMatchesAndSort();
    }, [initialEquipos]);

    // --- ALGORITMO DE CLASIFICACIÓN FIBA (Apéndice D) ---
    const sortTeamsFIBA = (teams: Equipo[], matches: PartidoResumen[]): Equipo[] => {
        // 1. Asegurar que todos tengan sus puntos de tabla calculados (2 por G, 1 por P)
        const teamsWithPoints = teams.map(t => ({
            ...t,
            puntosTabla: t.puntos ?? ((t.victorias * 2) + t.derrotas),
            diffGlobal: t.puntos_favor - (t.puntos_contra || 0)
        }));

        // Función de comparación recursiva
        const compareFIBA = (group: typeof teamsWithPoints): typeof teamsWithPoints => {
            if (group.length <= 1) return group;

            // Agrupar por puntos de tabla
            const byPoints: { [key: number]: typeof teamsWithPoints } = {};
            group.forEach(t => {
                const p = t.puntosTabla;
                if (!byPoints[p]) byPoints[p] = [];
                byPoints[p].push(t);
            });

            // Ordenar los grupos de puntos de mayor a menor
            const sortedPoints = Object.keys(byPoints).map(Number).sort((a, b) => b - a);
            
            let finalRanking: typeof teamsWithPoints = [];

            for (const pts of sortedPoints) {
                const tiedTeams = byPoints[pts];

                if (tiedTeams.length === 1) {
                    finalRanking.push(tiedTeams[0]);
                } else {
                    // --- DESEMPATE (TIE-BREAKER) ---
                    // Si hay empate en puntos, se aplica Apéndice D.1.3 (Solo partidos entre ellos)
                    
                    // 1. Calcular estadísticas de la "Miniliga" entre los empatados
                    const tiedIds = new Set(tiedTeams.map(t => t.id));
                    const relevantMatches = matches.filter(m => 
                        tiedIds.has(m.equipoLocalId) && tiedIds.has(m.equipoVisitanteId)
                    );

                    const miniStats = new Map<string, { wins: number, pf: number, pc: number }>();
                    tiedTeams.forEach(t => miniStats.set(t.id, { wins: 0, pf: 0, pc: 0 }));

                    relevantMatches.forEach(m => {
                        const local = miniStats.get(m.equipoLocalId)!;
                        const visit = miniStats.get(m.equipoVisitanteId)!;

                        local.pf += m.marcadorLocal;
                        local.pc += m.marcadorVisitante;
                        visit.pf += m.marcadorVisitante;
                        visit.pc += m.marcadorLocal;

                        if (m.marcadorLocal > m.marcadorVisitante) {
                            local.wins += 1; // En miniliga se cuentan victorias directas o puntos (2/1)
                        } else {
                            visit.wins += 1;
                        }
                    });

                    // 2. Ordenar el subgrupo empatado
                    tiedTeams.sort((a, b) => {
                        const statA = miniStats.get(a.id)!;
                        const statB = miniStats.get(b.id)!;

                        // Criterio D.1.3.1: Puntos de clasificación en los partidos entre ellos (o victorias directas)
                        if (statA.wins !== statB.wins) return statB.wins - statA.wins;

                        // Criterio D.1.3.2: Diferencia de puntos en los partidos entre ellos
                        const diffA = statA.pf - statA.pc;
                        const diffB = statB.pf - statB.pc;
                        if (diffA !== diffB) return diffB - diffA;

                        // Criterio D.1.3.3: Puntos anotados en los partidos entre ellos
                        if (statA.pf !== statB.pf) return statB.pf - statA.pf;

                        // Criterio D.1.3.4: Diferencia de puntos GLOBAL
                        if (a.diffGlobal !== b.diffGlobal) return b.diffGlobal - a.diffGlobal;

                        // Criterio D.1.3.5: Puntos anotados GLOBAL
                        return b.puntos_favor - a.puntos_favor;
                    });

                    finalRanking.push(...tiedTeams);
                }
            }
            return finalRanking;
        };

        return compareFIBA(teamsWithPoints);
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)' }}>🏆 Clasificación Oficial</h2>
                    <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Reglamento FIBA (Apéndice D): Desempate por resultados directos.
                    </p>
                </div>
                <button onClick={onClose} className="btn btn-secondary">
                    ← Volver
                </button>
            </div>

            {loading ? (
                <div className="card" style={{textAlign:'center', padding:'40px'}}>Calculando desempates FIBA...</div>
            ) : sortedEquipos.length === 0 ? (
                <div className="card" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                    No hay equipos registrados.
                </div>
            ) : (
                <div className="card" style={{padding: '0', overflow: 'hidden', border: '1px solid var(--border)'}}>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{width: '60px', textAlign: 'center'}}>#</th>
                                    <th>Equipo</th>
                                    <th style={{textAlign: 'center'}} title="Partidos Jugados">PJ</th>
                                    <th style={{textAlign: 'center', color: 'var(--success)'}} title="Ganados">G</th>
                                    <th style={{textAlign: 'center', color: 'var(--danger)'}} title="Perdidos">P</th>
                                    <th style={{textAlign: 'center'}} title="Puntos a Favor">PF</th>
                                    <th style={{textAlign: 'center'}} title="Puntos en Contra">PC</th>
                                    <th style={{textAlign: 'center'}} title="Diferencia">Df</th>
                                    <th style={{textAlign: 'center', background: '#f1f5f9', color: 'var(--primary)', fontWeight: '800'}}>PTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEquipos.map((equipo, index) => {
                                    const jugados = equipo.victorias + equipo.derrotas;
                                    const diff = equipo.puntos_favor - (equipo.puntos_contra || 0);
                                    // Cálculo de puntos si no existen en la BD (legacy compatibility)
                                    const puntosTabla = equipo.puntos ?? ((equipo.victorias * 2) + equipo.derrotas);
                                    
                                    // Estilos de Podio
                                    let rankBadge = null;
                                    let rowStyle = {};
                                    
                                    if (index === 0) { 
                                        rankBadge = <span style={{background: '#fbbf24', color: '#fff', padding: '4px 8px', borderRadius: '50%', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(251, 191, 36, 0.4)'}}>1</span>;
                                        rowStyle = {background: '#fffbeb'};
                                    } else if (index === 1) { 
                                        rankBadge = <span style={{background: '#94a3b8', color: '#fff', padding: '4px 8px', borderRadius: '50%', fontWeight: 'bold', fontSize: '0.8rem'}}>2</span>;
                                    } else if (index === 2) { 
                                        rankBadge = <span style={{background: '#b45309', color: '#fff', padding: '4px 8px', borderRadius: '50%', fontWeight: 'bold', fontSize: '0.8rem'}}>3</span>;
                                    } else {
                                        rankBadge = <span style={{color: 'var(--text-muted)', fontWeight: '600'}}>{index + 1}</span>;
                                    }

                                    return (
                                        <tr key={equipo.id} style={rowStyle}>
                                            <td style={{textAlign: 'center'}}>{rankBadge}</td>
                                            <td style={{fontWeight: '600', color: 'var(--text-main)'}}>
                                                {equipo.nombre}
                                            </td>
                                            <td style={{textAlign: 'center', color: 'var(--text-muted)'}}>{jugados}</td>
                                            <td style={{textAlign: 'center', fontWeight: 'bold', color: 'var(--success)'}}>{equipo.victorias}</td>
                                            <td style={{textAlign: 'center', color: 'var(--text-muted)'}}>{equipo.derrotas}</td>
                                            <td style={{textAlign: 'center', fontSize: '0.85rem', color: '#64748b'}}>{equipo.puntos_favor}</td>
                                            <td style={{textAlign: 'center', fontSize: '0.85rem', color: '#64748b'}}>{equipo.puntos_contra || 0}</td>
                                            <td style={{textAlign: 'center', fontWeight: '500', color: diff > 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--text-muted)')}}>
                                                {diff > 0 ? `+${diff}` : diff}
                                            </td>
                                            <td style={{textAlign: 'center', background: '#f8fafc', fontWeight: '800', color: 'var(--primary)', fontSize: '1rem'}}>
                                                {puntosTabla}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StandingsViewer;