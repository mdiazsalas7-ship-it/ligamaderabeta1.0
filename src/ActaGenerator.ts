import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generarActaPDF = (partido: any) => {
  const doc = new jsPDF();
  
  // 1. ENCABEZADO Y LOGO
  doc.setFillColor(239, 68, 68); // Rojo
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("LIGA MADERA 15", 105, 15, { align: "center" });
  
  doc.setFontSize(12);
  doc.text("ACTA OFICIAL DE PARTIDO", 105, 25, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date().toLocaleDateString()} | Cancha: ${partido.cancha || 'Principal'}`, 105, 33, { align: "center" });

  // 2. MARCADOR FINAL
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("RESULTADO FINAL", 105, 55, { align: "center" });

  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  const marcador = `${partido.marcadorLocal} - ${partido.marcadorVisitante}`;
  doc.text(marcador, 105, 70, { align: "center" });

  doc.setFontSize(12);
  doc.text(partido.equipoLocalNombre, 60, 80, { align: "center" });
  doc.text(partido.equipoVisitanteNombre, 150, 80, { align: "center" });

  // 3. TABLA
  const q1L = partido.cuartos?.q1?.local || 0;
  const q2L = partido.cuartos?.q2?.local || 0;
  const q3L = partido.cuartos?.q3?.local || 0;
  const q4L = partido.cuartos?.q4?.local || 0;
  
  const q1V = partido.cuartos?.q1?.visitante || 0;
  const q2V = partido.cuartos?.q2?.visitante || 0;
  const q3V = partido.cuartos?.q3?.visitante || 0;
  const q4V = partido.cuartos?.q4?.visitante || 0;

  (doc as any).autoTable({
    startY: 90,
    head: [['EQUIPO', '1Q', '2Q', '3Q', '4Q', 'TOTAL']],
    body: [
      [partido.equipoLocalNombre, q1L, q2L, q3L, q4L, partido.marcadorLocal],
      [partido.equipoVisitanteNombre, q1V, q2V, q3V, q4V, partido.marcadorVisitante],
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40] },
    styles: { halign: 'center' },
  });

  // 4. FIRMAS
  const finalY = (doc as any).lastAutoTable.finalY + 40;
  doc.setLineWidth(0.5);
  doc.line(30, finalY, 90, finalY);
  doc.line(120, finalY, 180, finalY);
  
  doc.setFontSize(10);
  doc.text("Firma Árbitro Principal", 60, finalY + 5, { align: "center" });
  doc.text("Firma Mesa Técnica", 150, finalY + 5, { align: "center" });

  doc.save(`Acta_${partido.equipoLocalNombre}_vs_${partido.equipoVisitanteNombre}.pdf`);
};