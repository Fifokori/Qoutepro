import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { QuoteData } from '../types';

// Extend jsPDF with autoTable type
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const exportToPDF = async (data: QuoteData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // 1. Logo (Top Left)
  if (data.logo) {
    try {
      // Assuming logo is base64
      doc.addImage(data.logo, 'PNG', margin, 15, 40, 40, undefined, 'FAST');
    } catch (e) {
      console.warn('Could not add logo to PDF', e);
    }
  }

  // 2. Header Info (Right Aligned or Column Block)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text('CENOVÁ PONUKA', pageWidth - margin, 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`#${data.quoteNumber}`, pageWidth - margin, 32, { align: 'right' });
  doc.text(`Dátum: ${data.date}`, pageWidth - margin, 37, { align: 'right' });

  // Supplier & Client Block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('DODÁVATEĽ', margin, 65);
  doc.text('ODBERATEĽ', pageWidth / 2, 65);

  doc.setFont('helvetica', 'normal');
  doc.text(data.companyName || 'Nezadaný dodávateľ', margin, 72);
  doc.text(data.clientName || 'Nezadaný odberateľ', pageWidth / 2, 72);

  // 3. Items Table
  const tableHeaders = [['#', 'Popis', 'MJ', 'Množstvo', 'J. Cena', 'Celkom']];
  const tableData = data.items.map((item, index) => [
    index + 1,
    item.description,
    item.unit,
    item.quantity.toString(),
    `${item.unitPrice.toFixed(2)} €`,
    `${(item.quantity * item.unitPrice).toFixed(2)} €`
  ]);

  doc.autoTable({
    startY: 85,
    head: tableHeaders,
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { cellWidth: 15 },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  // 4. Totals Block
  const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const includeVAT = data.exportSettings?.includeVAT ?? false;
  const vatRate = data.exportSettings?.vatRate ?? 20;
  const vatAmount = includeVAT ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Základ:', pageWidth - 75, finalY);
  doc.text(`${subtotal.toFixed(2)} €`, pageWidth - margin, finalY, { align: 'right' });

  if (includeVAT) {
    doc.text(`DPH (${vatRate}%):`, pageWidth - 75, finalY + 6);
    doc.text(`${vatAmount.toFixed(2)} €`, pageWidth - margin, finalY + 6, { align: 'right' });
  }

  // Total Box
  const totalBoxY = finalY + (includeVAT ? 12 : 6);
  doc.setFillColor(239, 68, 68); // Red
  doc.rect(pageWidth - 85, totalBoxY, 85 - margin + 20, 12, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('K ÚHRADE SPOLU:', pageWidth - 80, totalBoxY + 8);
  doc.text(`${total.toFixed(2)} €`, pageWidth - margin - 2, totalBoxY + 8, { align: 'right' });

  // 5. Notes / Terms
  if (data.paymentTerms) {
    const notesY = totalBoxY + 25;
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('POZNÁMKY A PODMIENKY', margin, notesY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(data.paymentTerms, pageWidth - (margin * 2));
    doc.text(splitNotes, margin, notesY + 7);
  }

  // 6. Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const dateStr = new Date().toLocaleDateString('sk-SK');
  doc.text(`QuotePro | Vygenerované: ${dateStr}`, margin, doc.internal.pageSize.getHeight() - 10);

  doc.save(`Cenova-Ponuka-${data.quoteNumber}-${data.clientName.replace(/\s+/g, '-')}.pdf`);
};
