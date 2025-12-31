import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Ahora recibimos también las listas de estadísticas (statsLocal y statsVisitante)
export const generarActaPDF = (partido: any, statsLocal: any[], statsVisitante: any[]) => {
  const doc = new jsPDF();
  
  // --- 1. ENCABEZADO Y LOGO ---
  doc.setFillColor(220, 38, 38); // Rojo Intenso
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text("LIGA MADERA 15", 105, 15, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("ACTA OFICIAL DE PARTIDO", 105, 22, { align: "center" });
  doc.text(`Fecha: ${new Date().toLocaleDateString()} | Cancha: ${partido.cancha || 'Principal'}`, 105, 28, { align: "center" });

  // --- 2. MARCADOR FINAL ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("RESULTADO FINAL", 105, 45, { align: "center" });

  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(`${partido.marcadorLocal} - ${partido.marcadorVisitante}`, 105, 58, { align: "center" });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(partido.equipoLocalNombre, 60, 65, { align: "center" });
  doc.text(partido.equipoVisitanteNombre, 150, 65, { align: "center" });

  // --- 3. TABLA DE CUARTOS (Resumen Equipos) ---
  const q1L = partido.cuartos?.q1?.local || 0; const q1V = partido.cuartos?.q1?.visitante || 0;
  const q2L = partido.cuartos?.q2?.local || 0; const q2V = partido.cuartos?.q2?.visitante || 0;
  const q3L = partido.cuartos?.q3?.local || 0; const q3V = partido.cuartos?.q3?.visitante || 0;
  const q4L = partido.cuartos?.q4?.local || 0; const q4V = partido.cuartos?.q4?.visitante || 0;

  (doc as any).autoTable({
    startY: 70,
    head: [['EQUIPO', '1Q', '2Q', '3Q', '4Q', 'TOTAL']],
    body: [
      [partido.equipoLocalNombre, q1L, q2L, q3L, q4L, partido.marcadorLocal],
      [partido.equipoVisitanteNombre, q1V, q2V, q3V, q4V, partido.marcadorVisitante],
    ],
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 8, halign: 'center' },
    styles: { cellPadding: 1 },
    margin: { left: 40, right: 40 }
  });

  // --- 4. DETALLE DE JUGADORES (Dos columnas) ---
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Título de Sección
  doc.setFontSize(10);
  doc.setTextColor(0,0,0);
  doc.text("ESTADÍSTICAS INDIVIDUALES", 105, finalY);

  // Preparamos los datos para las tablas
  const filasLocal = statsLocal.map(s => [s.numero, s.nombre, s.puntos, s.faltas]);
  const filasVisitante = statsVisitante.map(s => [s.numero, s.nombre, s.puntos, s.faltas]);

  // TABLA LOCAL (Izquierda)
  (doc as any).autoTable({
    startY: finalY + 5,
    head: [[`#`, `${partido.equipoLocalNombre.substring(0,15)}`, 'PTS', 'F']],
    body: filasLocal,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 138], halign: 'center' }, // Azul oscuro
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: { 0: {halign:'center', cellWidth: 10}, 2: {halign:'center', cellWidth: 10}, 3: {halign:'center', cellWidth: 10} },
    margin: { left: 10, right: 110 } // Ocupa la mitad izquierda
  });

  // TABLA VISITANTE (Derecha)
  // Usamos finalY de la tabla anterior para saber si bajamos, pero aquí queremos que estén paralelas.
  // Así que forzamos el startY igual al de la local.
  (doc as any).autoTable({
    startY: finalY + 5,
    head: [[`#`, `${partido.equipoVisitanteNombre.substring(0,15)}`, 'PTS', 'F']],
    body: filasVisitante,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11], halign: 'center' }, // Naranja/Ambar
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: { 0: {halign:'center', cellWidth: 10}, 2: {halign:'center', cellWidth: 10}, 3: {halign:'center', cellWidth: 10} },
    margin: { left: 115, right: 10 } // Ocupa la mitad derecha
  });

  // --- 5. FIRMAS ---
  // Calculamos dónde terminaron las tablas para poner las firmas abajo
  const tableEnd = (doc as any).lastAutoTable.finalY;
  const firmaY = tableEnd + 30;

  doc.setLineWidth(0.5);
  doc.line(40, firmaY, 90, firmaY);
  doc.line(120, firmaY, 170, firmaY);
  
  doc.setFontSize(8);
  doc.text("ÁRBITRO PRINCIPAL", 65, firmaY + 5, { align: "center" });
  doc.text("MESA TÉCNICA", 145, firmaY + 5, { align: "center" });

  doc.save(`Acta_${partido.equipoLocalNombre}_vs_${partido.equipoVisitanteNombre}.pdf`);
};