import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { QuoteData, ExportSettings, ColumnConfig } from '../types';

const DEFAULT_SETTINGS: ExportSettings = {
  columns: [
    { key: 'description', label: 'Popis položky (Materiál / Robota)', width: 50, visible: true, order: 0 },
    { key: 'unit', label: 'MJ', width: 10, visible: true, order: 1 },
    { key: 'quantity', label: 'Množstvo', width: 12, visible: true, order: 2 },
    { key: 'unitPrice', label: 'J. cena (€)', width: 15, visible: true, order: 3 },
    { key: 'total', label: 'Spolu (€)', width: 15, visible: true, order: 4 },
  ],
  primaryColor: '1E293B',
  accentColor: '2563EB',
  headerFontSize: 20,
  includeVAT: true,
  vatRate: 20
};

const convertHtmlToRichText = (html: string) => {
  if (!html || !html.includes('<')) return html;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const richText: any[] = [];

  const traverse = (node: Node, font: any = {}) => {
    node.childNodes.forEach(child => {
      const childFont = { ...font };
      if (child.nodeName === 'B' || child.nodeName === 'STRONG') childFont.bold = true;
      if (child.nodeName === 'I' || child.nodeName === 'EM') childFont.italic = true;
      
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) {
          richText.push({ text: child.textContent, font: childFont });
        }
      } else if (child.nodeName === 'LI') {
        richText.push({ text: '\n• ', font: { ...childFont, bold: false } });
        traverse(child, childFont);
      } else if (child.nodeName === 'P' || child.nodeName === 'DIV' || child.nodeName === 'BR') {
        if (richText.length > 0 && !richText[richText.length - 1].text.endsWith('\n')) {
          richText.push({ text: '\n', font: childFont });
        }
        traverse(child, childFont);
      } else {
        traverse(child, childFont);
      }
    });
  };

  traverse(doc.body);
  if (richText.length > 0 && richText[0].text.startsWith('\n')) {
    richText[0].text = richText[0].text.substring(1);
  }
  
  return richText.length > 0 ? { richText } : html;
};

export const exportToExcel = async (data: QuoteData) => {
  const settings = data.exportSettings || DEFAULT_SETTINGS;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cenová Ponuka');

  // Filter and sort visible columns
  const visibleColumns = [...settings.columns]
    .filter(c => c.visible)
    .sort((a, b) => a.order - b.order);

  // Set column widths
  visibleColumns.forEach((col, index) => {
    worksheet.getColumn(index + 1).width = col.width;
  });

  let currentRow = 1;

  if (data.logo) {
    const base64Data = data.logo.split(';base64,').pop() || '';
    const imageId = workbook.addImage({
      base64: base64Data,
      extension: 'png',
    });
    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 60 }
    });
    currentRow = 5;
  }

  // Header - Title
  const startCol = 1;
  const endCol = visibleColumns.length;
  worksheet.mergeCells(currentRow, startCol, currentRow, endCol);
  const titleCell = worksheet.getCell(currentRow, startCol);
  titleCell.value = 'CENOVÁ PONUKA';
  titleCell.font = { bold: true, size: settings.headerFontSize, color: { argb: 'FF' + settings.primaryColor } };
  titleCell.alignment = { horizontal: 'center' };
  currentRow += 2;

  // Supplier and Client
  worksheet.getCell(currentRow, startCol).value = 'DODÁVATEĽ';
  worksheet.getCell(currentRow, startCol).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
  
  if (endCol >= 4) {
    worksheet.getCell(currentRow, 4).value = 'ODBERATEĽ';
    worksheet.getCell(currentRow, 4).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
  }
  
  currentRow++;
  worksheet.getCell(currentRow, startCol).value = data.companyName || '[Vaša Firma]';
  worksheet.getCell(currentRow, startCol).font = { bold: true, size: 12 };
  
  if (endCol >= 4) {
    worksheet.getCell(currentRow, 4).value = data.clientName || '[Meno Klienta]';
    worksheet.getCell(currentRow, 4).font = { bold: true, size: 12 };
  }

  currentRow += 2;

  // Quote info
  worksheet.getCell(currentRow, 1).value = 'Číslo ponuky:';
  worksheet.getCell(currentRow, 1).font = { bold: true };
  worksheet.getCell(currentRow, 2).value = data.quoteNumber;
  worksheet.getCell(currentRow, 2).alignment = { horizontal: 'left' };

  if (endCol >= 4) {
    worksheet.getCell(currentRow, endCol - 1).value = 'Dátum vystavenia:';
    worksheet.getCell(currentRow, endCol - 1).font = { bold: true };
    worksheet.getCell(currentRow, endCol).value = data.date;
    worksheet.getCell(currentRow, endCol).alignment = { horizontal: 'right' };
  }

  currentRow += 2;

  // Table header
  const headerRow = worksheet.getRow(currentRow);
  headerRow.values = visibleColumns.map(c => c.label);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.height = 25;
  
  visibleColumns.forEach((_, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + settings.primaryColor },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  currentRow++;

  // Items
  let totalSum = 0;
  data.items.forEach((item) => {
    const row = worksheet.getRow(currentRow);
    const lines = (item.description.match(/<br>|<li>|<p>|<div>/g) || []).length || 1;
    row.height = Math.max(25, lines * 15);
    
    const itemTotal = item.quantity * item.unitPrice;
    totalSum += itemTotal;
    
    const rowValues = visibleColumns.map(col => {
      switch (col.key) {
        case 'description': return convertHtmlToRichText(item.description);
        case 'unit': return item.unit;
        case 'quantity': return item.quantity;
        case 'unitPrice': return item.unitPrice;
        case 'total': return itemTotal;
        default: return '';
      }
    });
    row.values = rowValues;

    visibleColumns.forEach((col, index) => {
      const cell = row.getCell(index + 1);
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
      
      if (col.key === 'description') {
        cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
      } else if (col.key === 'unit') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (col.key === 'unitPrice' || col.key === 'total') {
          cell.numFmt = '#,##0.00';
        }
      }
    });
    currentRow++;
  });

  // Summary
  currentRow++;
  const labelCol = Math.max(1, endCol - 1);
  const valueCol = endCol;

  const addSummaryRow = (label: string, value: number, isVat = false, isFinal = false) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(labelCol).value = label;
    row.getCell(labelCol).font = { bold: true };
    row.getCell(valueCol).value = value;
    row.getCell(valueCol).numFmt = '#,##0.00" €"';
    
    if (isFinal) {
      row.height = 30;
      row.getCell(labelCol).font = { bold: true, size: 14, color: { argb: 'FF' + settings.accentColor } };
      row.getCell(valueCol).font = { bold: true, size: 14, color: { argb: 'FF' + settings.accentColor } };
      row.getCell(valueCol).alignment = { vertical: 'middle', horizontal: 'right' };
    }
    currentRow++;
  };

  addSummaryRow('Suma bez DPH:', totalSum);
  
  if (settings.includeVAT) {
    const vatAmount = totalSum * (settings.vatRate / 100);
    addSummaryRow(`DPH (${settings.vatRate}%):`, vatAmount, true);
    addSummaryRow('CELKOVÁ SUMA:', totalSum + vatAmount, false, true);
  } else {
    addSummaryRow('CELKOVÁ SUMA:', totalSum, false, true);
  }

  // Footer
  currentRow += 2;
  worksheet.getCell(currentRow, 1).value = 'PLATOBNÉ PODMIENKY A POZNÁMKY';
  worksheet.getCell(currentRow, 1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
  
  currentRow++;
  worksheet.mergeCells(currentRow, 1, currentRow + 4, endCol);
  const footerCell = worksheet.getCell(currentRow, 1);
  footerCell.value = data.paymentTerms || '';
  footerCell.alignment = { wrapText: true, vertical: 'top' };
  footerCell.font = { size: 9, italic: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Cenova_Ponuka_${data.quoteNumber || 'export'}.xlsx`);
};
