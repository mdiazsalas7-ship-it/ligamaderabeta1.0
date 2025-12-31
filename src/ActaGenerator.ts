import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Función para cargar la imagen asegurando que no falle por seguridad (CORS)
const obtenerImagenLogo = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Permite que el navegador descargue la imagen externa
    img.src = url;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
            // Intentamos convertirla. Si falla por seguridad, devolverá cadena vacía.
            resolve(canvas.toDataURL('image/jpeg')); 
        } catch (err) {
            console.warn("Error de seguridad CORS al procesar logo");
            resolve("");
        }
      } else {
        resolve("");
      }
    };

    img.onerror = () => {
      // Si la URL está mal (como pasaba antes con los guiones), entra aquí.
      console.warn("No se encontró la imagen en la URL dada.");
      resolve("");
    };
  });
};

export const generarActaPDF = async (partido: any, statsLocal: any[], statsVisitante: any[]) => {
  const doc = new jsPDF();
  
  // ---------------------------------------------------------
  // 1. ENCABEZADO Y LOGO (CORREGIDO)
  // ---------------------------------------------------------
  
  // Fondo Rojo Cabecera
  doc.setFillColor(185, 28, 28);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Fondo circular blanco
  doc.setFillColor(255, 255, 255);
  doc.circle(25, 20, 13, 'F');

  try {
    // --- AQUÍ ESTABA EL ERROR: URL CORREGIDA (Con guiones bajos) ---
    const logoUrl = "https://i.postimg.cc/Hx1t81vH/FORMA_21_MORICHAL.jpg";
    
    // Esperamos a que cargue
    const imgData = await obtenerImagenLogo(logoUrl);

    if (imgData) {
      doc.saveGraphicsState();
      doc.beginPath();
      doc.arc(25, 20, 13, 0, 2 * Math.PI, false); // Recorte circular
      doc.clip(); 
      doc.addImage(imgData, "JPEG", 12, 7, 26, 26); 
      doc.restoreGraphicsState();
    }
    
    // Borde blanco decorativo
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.circle(25, 20, 13, 'S');

  } catch (e) {
    console.log("Error al poner el logo:", e);
  }

  // Textos
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("LIGA MADERA 15", 55, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("ACTA OFICIAL DE PARTIDO", 55, 25);
  doc.text(`Fecha: ${new Date().toLocaleDateString()} | Cancha: ${partido.cancha || 'Principal'}`, 55, 32);

  // ---------------------------------------------------------
  // 2. MARCADOR Y DATOS
  // ---------------------------------------------------------

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("RESULTADO FINAL", 105, 55, { align: "center" });

  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(`${partido.marcadorLocal} - ${partido.marcadorVisitante}`, 105, 68, { align: "center" });

  doc.setFontSize(11);
  doc.text(partido.equipoLocalNombre, 60, 75, { align: "center" });
  doc.text(partido.equipoVisitanteNombre, 150, 75, { align: "center" });

  // ---------------------------------------------------------
  // 3. TABLA DE CUARTOS
  // ---------------------------------------------------------
  const valQ = (val: any) => val ? parseInt(val) : 0;
  const c = partido.cuartos || {};
  
  const q1L = valQ(c.q1?.local); const q1V = valQ(c.q1?.visitante);
  const q2L = valQ(c.q2?.local); const q2V = valQ(c.q2?.visitante);
  const q3L = valQ(c.q3?.local); const q3V = valQ(c.q3?.visitante);
  const q4L = valQ(c.q4?.local); const q4V = valQ(c.q4?.visitante);

  (doc as any).autoTable({
    startY: 80,
    head: [['EQUIPO', '1Q', '2Q', '3Q', '4Q', 'TOTAL']],
    body: [
      [partido.equipoLocalNombre, q1L, q2L, q3L, q4L, partido.marcadorLocal],
      [partido.equipoVisitanteNombre, q1V, q2V, q3V, q4V, partido.marcadorVisitante],
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 9 },
    margin: { left: 35, right: 35 }
  });

  // ---------------------------------------------------------
  // 4. ESTADÍSTICAS
  // ---------------------------------------------------------
  
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text("ESTADÍSTICAS INDIVIDUALES", 105, finalY, { align: 'center' });

  const calcularTotales = (stats: any[]) => {
      return stats.reduce((acc, curr) => ({
          triples: acc.triples + (Number(curr.triples) || 0),
          rebotes: acc.rebotes + (Number(curr.rebotes) || 0),
          puntos: acc.puntos + (Number(curr.puntos) || 0),
          faltas: acc.faltas + (Number(curr.faltas) || 0)
      }), { triples: 0, rebotes: 0, puntos: 0, faltas: 0 });
  };

  const totalLocal = calcularTotales(statsLocal);
  const totalVisitante = calcularTotales(statsVisitante);

  const filasLocal = statsLocal.map(s => [s.numero, s.nombre.substring(0, 10), s.triples || 0, s.rebotes || 0, s.puntos, s.faltas]);
  filasLocal.push(['', 'TOTAL', totalLocal.triples, totalLocal.rebotes, totalLocal.puntos, totalLocal.faltas]);

  const filasVisitante = statsVisitante.map(s => [s.numero, s.nombre.substring(0, 10), s.triples || 0, s.rebotes || 0, s.puntos, s.faltas]);
  filasVisitante.push(['', 'TOTAL', totalVisitante.triples, totalVisitante.rebotes, totalVisitante.puntos, totalVisitante.faltas]);

  const colStyles = {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 8, halign: 'center' },
      3: { cellWidth: 8, halign: 'center' },
      4: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 8, halign: 'center', textColor: [200, 0, 0] }
  };

  (doc as any).autoTable({
    startY: finalY + 5,
    head: [[`#`, `LOCAL`, '3P', 'REB', 'PTS', 'F']],
    body: filasLocal,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 138], halign: 'center', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: colStyles,
    margin: { left: 10, right: 110 },
    didParseCell: (data: any) => { if(data.section==='body' && data.row.index===filasLocal.length-1) { data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=[220,220,220]; } }
  });

  (doc as any).autoTable({
    startY: finalY + 5,
    head: [[`#`, `VISITANTE`, '3P', 'REB', 'PTS', 'F']],
    body: filasVisitante,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11], halign: 'center', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: colStyles,
    margin: { left: 115, right: 10 },
    didParseCell: (data: any) => { if(data.section==='body' && data.row.index===filasVisitante.length-1) { data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=[220,220,220]; } }
  });

  const tableEnd = (doc as any).lastAutoTable.finalY;
  const firmaY = tableEnd + 25;
  doc.setLineWidth(0.5);
  doc.line(40, firmaY, 90, firmaY); doc.line(120, firmaY, 170, firmaY);
  doc.setFontSize(8);
  doc.text("ÁRBITRO PRINCIPAL", 65, firmaY + 5, { align: "center" });
  doc.text("MESA TÉCNICA", 145, firmaY + 5, { align: "center" });

  doc.save(`Acta_${partido.equipoLocalNombre}_vs_${partido.equipoVisitanteNombre}.pdf`);
};