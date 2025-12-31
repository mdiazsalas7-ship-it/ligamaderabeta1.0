import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// URL de tu imagen
const LOGO_ONLINE = "https://i.postimg.cc/sDgyKfr4/nuevo_logo.png";

const descargarLogoWeb = async (): Promise<string> => {
  try {
    const urlProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(LOGO_ONLINE)}`;
    const response = await fetch(urlProxy);
    if (!response.ok) throw new Error("Fallo descarga");
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("No se pudo cargar el logo:", error);
    return "";
  }
};

export const generarActaPDF = async (partido: any, statsLocal: any[], statsVisitante: any[]) => {
  const doc = new jsPDF();

  // --- 1. ENCABEZADO ROJO (FONDO) ---
  doc.setFillColor(185, 28, 28); 
  doc.rect(0, 0, 210, 40, 'F');

  // --- 2. CÍRCULO BLANCO (SE DIBUJA SIEMPRE PRIMERO) ---
  // Esto asegura que si falla la imagen, al menos veas el círculo
  doc.setFillColor(255, 255, 255);
  doc.circle(25, 20, 14, 'F'); // Círculo relleno blanco
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.circle(25, 20, 14, 'S'); // Borde blanco

  // --- 3. INTENTO DE CARGAR IMAGEN ---
  try {
    const imgData = await descargarLogoWeb();

    if (imgData) {
      doc.saveGraphicsState();
      
      // Creamos el recorte circular solo para la imagen
      doc.beginPath();
      doc.arc(25, 20, 13, 0, 2 * Math.PI, false);
      doc.clip();
      
      // Ponemos la imagen encima del círculo blanco
      doc.addImage(imgData, "PNG", 12, 7, 26, 26);
      
      doc.restoreGraphicsState();
    }
  } catch (e) {
    // Si falla, no pasa nada, ya el círculo blanco está dibujado
    console.log("Generando PDF sin logo (error de carga)");
  }

  // --- 4. TEXTOS (RESTO DEL CÓDIGO) ---
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("LIGA MADERA 15", 55, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("ACTA OFICIAL DE PARTIDO", 55, 25);
  doc.text(`Fecha: ${partido.fechaAsignada || 'S/F'} | Cancha: ${partido.cancha || 'Principal'}`, 55, 32);

  // --- 5. RESULTADOS ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("RESULTADO FINAL", 105, 55, { align: "center" });

  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(`${partido.marcadorLocal} - ${partido.marcadorVisitante}`, 105, 70, { align: "center" });
  
  doc.setFontSize(12);
  doc.text(partido.equipoLocalNombre, 60, 80, { align: "center" });
  doc.text(partido.equipoVisitanteNombre, 150, 80, { align: "center" });

  // --- 6. TABLAS ---
  const c = partido.cuartos || {};
  const bodyCuartos = [
    [partido.equipoLocalNombre, c.q1?.local || 0, c.q2?.local || 0, c.q3?.local || 0, c.q4?.local || 0, partido.marcadorLocal],
    [partido.equipoVisitanteNombre, c.q1?.visitante || 0, c.q2?.visitante || 0, c.q3?.visitante || 0, c.q4?.visitante || 0, partido.marcadorVisitante]
  ];

  (doc as any).autoTable({
    startY: 85,
    head: [['EQUIPO', '1Q', '2Q', '3Q', '4Q', 'TOTAL']],
    body: bodyCuartos,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], halign: 'center' },
    styles: { halign: 'center', fontSize: 10 },
    margin: { left: 30, right: 30 }
  });

  // Estadísticas
  const tableStartY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(11);
  doc.text("DESGLOSE POR JUGADORES", 105, tableStartY, { align: 'center' });

  const procesarFilas = (stats: any[]) => {
    let pts = 0, reb = 0, tri = 0, fal = 0;
    const filas = stats.map(s => {
      pts += Number(s.puntos || 0);
      reb += Number(s.rebotes || 0);
      tri += Number(s.triples || 0);
      fal += Number(s.faltas || 0);
      return [s.numero, s.nombre.substring(0, 15), s.triples || 0, s.rebotes || 0, s.puntos || 0, s.faltas || 0];
    });
    filas.push([{ content: 'TOTALES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, tri, reb, pts, fal]);
    return filas;
  };

  const colStyles = { 
    0: { cellWidth: 8, halign: 'center' }, 
    2: { cellWidth: 10, halign: 'center' }, 
    3: { cellWidth: 10, halign: 'center' }, 
    4: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 
    5: { cellWidth: 10, halign: 'center' } 
  };

  (doc as any).autoTable({
    startY: tableStartY + 5,
    head: [['#', 'LOCAL', '3P', 'REB', 'PTS', 'F']],
    body: procesarFilas(statsLocal),
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 138] },
    styles: { fontSize: 8 },
    columnStyles: colStyles,
    margin: { left: 10, right: 110 }
  });

  (doc as any).autoTable({
    startY: tableStartY + 5,
    head: [['#', 'VISITANTE', '3P', 'REB', 'PTS', 'F']],
    body: procesarFilas(statsVisitante),
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] },
    styles: { fontSize: 8 },
    columnStyles: colStyles,
    margin: { left: 115, right: 10 }
  });

  const firmaY = (doc as any).lastAutoTable.finalY + 35;
  doc.setLineWidth(0.5);
  doc.line(30, firmaY, 90, firmaY);
  doc.line(120, firmaY, 180, firmaY);
  
  doc.setFontSize(9);
  doc.text("Firma Árbitro Principal", 60, firmaY + 5, { align: "center" });
  doc.text("Firma Mesa Técnica", 150, firmaY + 5, { align: "center" });

  doc.save(`Acta_${partido.equipoLocalNombre}_vs_${partido.equipoVisitanteNombre}.pdf`);
};