import React, { useState, useEffect } from 'react';
import { db } from './firebase';
// CLAVE: SOLO se importan los valores/métodos necesarios
import { collection, getDocs, query, where } from 'firebase/firestore'; 
// CLAVE: El tipo DocumentData se importa por separado
import type { DocumentData } from 'firebase/firestore'; 
import PlayoffBracket from './PlayoffBracket'; // 1. IMPORTAR COMPONENTE

interface Forma21 extends DocumentData {
    id: string;
    nombreEquipo: string;
    rosterCompleto?: boolean;
}

interface Partido extends DocumentData {
    id: string;
    jornada: number;
    equipoLocalNombre: string;
    equipoVisitanteNombre: string;
    equipoLocalId: string;
    equipoVisitanteId: string;
    marcadorLocal: number;
    marcadorVisitante: number;
    ganadorId: string;
}

interface JugadorDashboardProps {
    userEquipoId: string | null;
    userName: string | null;
    formas21: Forma21[];
    setViewRosterId: (id: string | null) => void;
}

const JugadorDashboard: React.FC<JugadorDashboardProps> = ({ 
    userEquipoId, 
    userName, 
    formas21,
    setViewRosterId
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [misPartidos, setMisPartidos] = useState<Partido[]>([]);
    const [showBracket, setShowBracket] = useState(false); // 2. ESTADO PARA PLAYOFFS
    
    // 9B: Encontrar la Forma 21 del jugador
    const miForma = formas21.find(f => f.id === userEquipoId);

    useEffect(() => {
        if (!userEquipoId) {
            setLoading(false);
            return;
        }

        // 9C: Cargar solo los partidos jugados donde participa mi equipo
        const fetchPartidos = async () => {
            setLoading(true);
            try {
                // No hay query OR en Firestore, así que debemos hacer dos consultas
                
                // Partidos donde mi equipo fue Local
                const localQuery = query(collection(db, 'partidos'), where('equipoLocalId', '==', userEquipoId));
                const localSnapshot = await getDocs(localQuery);

                // Partidos donde mi equipo fue Visitante
                const visitanteQuery = query(collection(db, 'partidos'), where('equipoVisitanteId', '==', userEquipoId));
                const visitanteSnapshot = await getDocs(visitanteQuery);
                
                const partidosLocal: Partido[] = localSnapshot.docs.map(doc => doc.data() as Partido);
                const partidosVisitante: Partido[] = visitanteSnapshot.docs.map(doc => doc.data() as Partido);
                
                // Combinar y ordenar (del más reciente al más antiguo)
                const todosMisPartidos = [...partidosLocal, ...partidosVisitante]
                    .sort((a, b) => b.jornada - a.jornada);

                setMisPartidos(todosMisPartidos);

            } catch (err) {
                setError("Error al cargar los partidos de tu equipo. Revisa las reglas de seguridad.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPartidos();
    }, [userEquipoId]);

    if (!userEquipoId) return <p style={{textAlign: 'center', padding: '20px'}}>No estás asignado a ningún equipo. Contacta al Administrador.</p>;
    if (loading) return <p style={{textAlign: 'center'}}>Cargando información de tu equipo...</p>;
    if (error) return <p style={{color: 'red', textAlign: 'center'}}>{error}</p>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            
            {/* 3. MODAL DE PLAYOFFS */}
            {showBracket && <PlayoffBracket adminMode={false} onClose={() => setShowBracket(false)} />}

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom:'20px'}}>
                <h3 style={{margin:0}}>
                    ⭐ Mi Equipo: {miForma?.nombreEquipo || 'Cargando...'}
                </h3>
                {/* 4. BOTÓN PARA ABRIR PLAYOFFS */}
                <button 
                    onClick={() => setShowBracket(true)}
                    className="btn"
                    style={{
                        background: 'linear-gradient(45deg, #7c3aed, #6d28d9)',
                        color: 'white', border: 'none', borderRadius: '5px',
                        padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer', fontSize:'0.9rem',
                        display:'flex', alignItems:'center', gap:'5px'
                    }}
                >
                    🏆 Ver Playoffs
                </button>
            </div>

            {/* Roster del Equipo */}
            <div className="data-block-container" style={{ marginBottom: '30px' }}>
                <div className="data-block-header">Roster y Jugadores</div>
                <p>Eres el jugador: <strong>{userName}</strong></p>
                
                {miForma && (
                    <button 
                        onClick={() => setViewRosterId(miForma.id)} 
                        className="btn btn-secondary" 
                        style={{ fontSize: '12px', padding: '8px 15px' }}
                    >
                        Ver Roster Completo ({miForma.rosterCompleto ? 'Completo' : 'Pendiente'})
                    </button>
                )}
            </div>

            {/* Historial de Partidos Jugados */}
            <div className="data-block-container">
                <div className="data-block-header">Últimos Resultados</div>
                {misPartidos.length === 0 ? (
                    <p>Tu equipo aún no ha jugado partidos oficiales.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Jornada</th>
                                <th>Oponente</th>
                                <th>Resultado</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {misPartidos.map(p => {
                                const esLocal = p.equipoLocalId === userEquipoId;
                                const miMarcador = esLocal ? p.marcadorLocal : p.marcadorVisitante;
                                const opMarcador = esLocal ? p.marcadorVisitante : p.marcadorLocal;
                                const oponenteNombre = esLocal ? p.equipoVisitanteNombre : p.equipoLocalNombre;
                                
                                let resultadoTexto = 'EMPATE';
                                let color = 'gray';
                                
                                if (miMarcador > opMarcador) {
                                    resultadoTexto = 'VICTORIA';
                                    color = '#10b981'; // Verde
                                } else if (miMarcador < opMarcador) {
                                    resultadoTexto = 'DERROTA';
                                    color = '#ef4444'; // Rojo
                                }

                                return (
                                    <tr key={p.id}>
                                        <td>{p.jornada}</td>
                                        <td>vs {oponenteNombre}</td>
                                        <td style={{fontWeight:'bold'}}>{miMarcador} - {opMarcador}</td>
                                        <td>
                                            <span style={{ 
                                                backgroundColor: color, color: 'white', 
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                                            }}>
                                                {resultadoTexto}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default JugadorDashboard;