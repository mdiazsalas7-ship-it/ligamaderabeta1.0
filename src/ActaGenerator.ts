import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ✅ LOGO OFICIAL
const LEAGUE_LOGO_URL = "https://i.postimg.cc/sDgyKfr4/nuevo_logo.png";

const getBase64Image = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error loading image:", error);
        return null;
    }
};

export const generarActaPDF = async (matchData: any, statsA: any[], statsB: any[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // 1. CARGAR LOGO
    let leagueLogoImg = await getBase64Image(LEAGUE_LOGO_URL);

    // 2. CALCULAR TOTALES
    const calcTotals = (stats: any[]) => stats.reduce((acc, s) => ({
        pts: acc.pts + s.puntos,
        reb: acc.reb + s.rebotes,
        tri: acc.tri + s.triples,
        fal: acc.fal + s.faltas
    }), { pts:0, reb:0, tri:0, fal:0 });

    const totalsA = calcTotals(statsA);
    const totalsB = calcTotals(statsB);

    // --- ENCABEZADO ---
    autoTable(doc, {
        body: [
            [
                { content: matchData.equipoLocalNombre, styles: { halign: 'center', fontSize: 14, fontStyle: 'bold', textColor: [96, 165, 250] } },
                { content: `${matchData.marcadorLocal} - ${matchData.marcadorVisitante}`, styles: { halign: 'center', fontSize: 20, fontStyle: 'bold', textColor: [255, 255, 255] } },
                { content: matchData.equipoVisitanteNombre, styles: { halign: 'center', fontSize: 14, fontStyle: 'bold', textColor: [251, 191, 36] } }
            ],
            [
                { content: `Faltas: ${matchData.faltasLocal} | TM: ${matchData.tiemposLocal}`, styles: { halign: 'center', textColor: [150, 150, 150], fontSize: 9 } },
                { content: matchData.estatus === 'finalizado' ? 'FINALIZADO' : 'EN PROGRESO', styles: { halign: 'center', fontSize: 8, textColor: [200, 200, 200] } },
                { content: `Faltas: ${matchData.faltasVisitante} | TM: ${matchData.tiemposVisitante}`, styles: { halign: 'center', textColor: [150, 150, 150], fontSize: 9 } }
            ]
        ],
        theme: 'plain',
        styles: { cellPadding: 1 },
        startY: 35,
        margin: { top: 35 },
        didDrawPage: (data) => {
            // Fondo Negro
            doc.setFillColor(0, 0, 0);
            doc.rect(0, 0, pageWidth, 35, 'F');

            // --- LOGO (Aumentado de tamaño) ---
            if (leagueLogoImg) {
                // Antes: 28x30 -> Ahora: 34x34 (Un poco más grande)
                // Posición X: 8 (un poco más a la izquierda), Y: 1 (casi al borde superior)
                doc.addImage(leagueLogoImg, 'PNG', 8, 1, 34, 34);
            }

            // Títulos
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            // Movido un poco a la derecha (X=48) para que no choque con el logo más grande
            doc.text("LIGA MADERA 15", 48, 15); 
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(180, 180, 180);
            doc.text("ACTA OFICIAL DE JUEGO", 48, 22);

            // Datos Derecha
            doc.setFontSize(8);
            const fecha = matchData.fechaAsignada ? new Date(matchData.fechaAsignada).toLocaleDateString() : new Date().toLocaleDateString();
            doc.text(`FECHA: ${fecha}`, pageWidth - 10, 12, { align: 'right' });
            
            // --- CANCHA FIJA: MADERA 15 ---
            doc.text(`CANCHA: Madera 15`, pageWidth - 10, 17, { align: 'right' });
            
            doc.text(`ID: ${matchData.id.substring(0, 6)}`, pageWidth - 10, 22, { align: 'right' });
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 5;

    // --- RESUMEN CUARTOS ---
    if (matchData.cuartos) {
        const qData = matchData.cuartos;
        autoTable(doc, {
            head: [['EQUIPO', '1C', '2C', '3C', '4C', 'T']],
            body: [
                [matchData.equipoLocalNombre, qData.q1?.local||0, qData.q2?.local||0, qData.q3?.local||0, qData.q4?.local||0, matchData.marcadorLocal],
                [matchData.equipoVisitanteNombre, qData.q1?.visitante||0, qData.q2?.visitante||0, qData.q3?.visitante||0, qData.q4?.visitante||0, matchData.marcadorVisitante],
            ],
            startY: finalY,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8, halign: 'center', minCellHeight: 6 },
            bodyStyles: { fontSize: 8, halign: 'center', minCellHeight: 6 },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 }, 5: { fontStyle: 'bold' } },
            margin: { left: 15, right: 15 }
        });
        finalY = (doc as any).lastAutoTable.finalY + 8;
    }

    // --- TABLAS JUGADORES ---
    const generarTablaStats = (titulo: string, stats: any[], totales: any, colorHeader: [number, number, number], startY: number) => {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        
        doc.setFillColor(colorHeader[0], colorHeader[1], colorHeader[2]);
        doc.rect(14, startY - 4, 3, 3, 'F');
        doc.text(titulo.toUpperCase(), 20, startY - 1);

        autoTable(doc, {
            head: [['#', 'JUGADOR', 'PTS', '3PT', 'REB', 'FAL']],
            body: [
                ...stats.map(s => [s.numero, s.nombre, s.puntos, s.triples, s.rebotes, s.faltas]),
                ['', {content:'TOTALES', styles:{fontStyle:'bold'}}, 
                 {content:totales.pts, styles:{fontStyle:'bold'}},
                 {content:totales.tri, styles:{fontStyle:'bold'}},
                 {content:totales.reb, styles:{fontStyle:'bold'}},
                 {content:totales.fal, styles:{fontStyle:'bold', textColor:[200, 0, 0]}}
                ]
            ],
            startY: startY,
            theme: 'striped',
            headStyles: { fillColor: colorHeader, textColor: 255, fontSize: 8, halign: 'center', minCellHeight: 6 },
            bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 1 },
            columnStyles: { 
                0: { cellWidth: 8 }, 
                1: { halign: 'left', cellWidth: 'auto' }, 
                2: { cellWidth: 12, fontStyle: 'bold' }, 
                3: { cellWidth: 12 }, 
                4: { cellWidth: 12 }, 
                5: { cellWidth: 12, textColor: [200, 0, 0] } 
            },
            footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0 }
        });
        return (doc as any).lastAutoTable.finalY;
    };

    finalY = generarTablaStats(matchData.equipoLocalNombre, statsA, totalsA, [30, 58, 138], finalY + 2);
    finalY = generarTablaStats(matchData.equipoVisitanteNombre, statsB, totalsB, [180, 83, 9], finalY + 8);

    // --- FIRMAS ---
    if (finalY > pageHeight - 30) {
        doc.addPage();
        finalY = 20;
    } else {
        finalY = Math.max(finalY + 20, pageHeight - 40);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    
    doc.line(40, finalY, 90, finalY);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("ÁRBITRO PRINCIPAL", 65, finalY + 5, { align: 'center' });

    doc.line(120, finalY, 170, finalY);
    doc.text("MESA TÉCNICA / OPERADOR", 145, finalY + 5, { align: 'center' });

    doc.save(`ACTA_${matchData.equipoLocalNombre}_vs_${matchData.equipoVisitanteNombre}.pdf`);
};