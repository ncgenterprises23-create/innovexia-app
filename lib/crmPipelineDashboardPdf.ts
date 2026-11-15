import { jsPDF } from 'jspdf';
import {
  DASHBOARD_METRIC_ORDER,
  formatDashboardCell,
  type DashboardSectionResult,
  type TimeColumn,
} from '@/lib/crmPipelineDashboard';

const HEADER_FILL: [number, number, number] = [234, 179, 8];
const TITLE_FILL: [number, number, number] = [254, 243, 199];
const ROW_FILL_A: [number, number, number] = [255, 255, 255];
const ROW_FILL_B: [number, number, number] = [255, 251, 235];
const TOTAL_FILL: [number, number, number] = [253, 230, 138];
const BORDER: [number, number, number] = [180, 140, 50];
const TEXT_DARK: [number, number, number] = [30, 41, 59];

export function exportCrmPipelineDashboardPdf(opts: {
  title: string;
  pipelineName?: string;
  rangeLabel: string;
  granularity: string;
  columns: TimeColumn[];
  section: DashboardSectionResult;
}) {
  const { title, pipelineName, rangeLabel, granularity, columns, section } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const rowH = 5.2;
  let y = margin;

  doc.setFillColor(...TITLE_FILL);
  doc.rect(margin, y - 2, pageW - margin * 2, 22, 'F');
  doc.setDrawColor(...BORDER);
  doc.rect(margin, y - 2, pageW - margin * 2, 22, 'S');

  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW / 2, y + 4, { align: 'center' });
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const sub = [
    pipelineName ? `Pipeline: ${pipelineName}` : '',
    `Range: ${rangeLabel}`,
    `View: ${granularity}`,
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.text(sub, pageW / 2, y + 1, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageW / 2, y + 1, { align: 'center' });
  y += 10;
  doc.setTextColor(...TEXT_DARK);

  const headers = ['Metrics', 'Category / Tags', ...columns.map((c) => c.label)];
  const tableW = pageW - margin * 2;
  const metricW = 44;
  const tagW = 38;
  const restW = (tableW - metricW - tagW) / Math.max(1, columns.length);
  const colWidths = [metricW, tagW, ...columns.map(() => restW)];

  const rowsByMetric = new Map<string, typeof section.rows>();
  for (const row of section.rows) {
    const list = rowsByMetric.get(row.metric) || [];
    list.push(row);
    rowsByMetric.set(row.metric, list);
  }

  const flatRows: Array<{
    cells: string[];
    isHeader?: boolean;
    isTotal?: boolean;
    alignRightFrom: number;
  }> = [];

  let rowIndex = 0;
  for (const metricKey of DASHBOARD_METRIC_ORDER) {
    const group = rowsByMetric.get(metricKey) || [];
    group.forEach((row, idx) => {
      const cells = [
        idx === 0 ? row.metricLabel : '',
        row.tag,
        ...columns.map((c) => formatDashboardCell(row.metric, row.values[c.key])),
      ];
      flatRows.push({
        cells,
        isTotal: row.isSectionTotal,
        alignRightFrom: 2,
      });
      rowIndex++;
    });
  }

  const drawTableHeader = () => {
    let x = margin;
    doc.setFillColor(...HEADER_FILL);
    doc.rect(x, y, tableW, rowH, 'F');
    doc.setDrawColor(...BORDER);
    doc.rect(x, y, tableW, rowH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    headers.forEach((h, i) => {
      doc.line(x, y, x, y + rowH);
      const pad = 1.5;
      const tw = colWidths[i];
      if (i >= 2) {
        doc.text(h, x + tw - pad, y + 3.5, { align: 'right' });
      } else {
        doc.text(h, x + pad, y + 3.5);
      }
      x += tw;
    });
    doc.line(x, y, x, y + rowH);
    y += rowH;
    doc.setFont('helvetica', 'normal');
  };

  drawTableHeader();

  let stripe = 0;
  for (const row of flatRows) {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      drawTableHeader();
      stripe = 0;
    }

    let x = margin;
    const fill = row.isTotal ? TOTAL_FILL : stripe % 2 === 0 ? ROW_FILL_A : ROW_FILL_B;
    doc.setFillColor(...fill);
    doc.rect(x, y, tableW, rowH, 'F');
    doc.setDrawColor(...BORDER);
    doc.rect(x, y, tableW, rowH, 'S');

    row.cells.forEach((cell, i) => {
      doc.line(x, y, x, y + rowH);
      const pad = 1.5;
      const tw = colWidths[i];
      const text = String(cell ?? '—');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', row.isTotal ? 'bold' : 'normal');
      if (i >= row.alignRightFrom) {
        doc.text(text, x + tw - pad, y + 3.5, { align: 'right' });
      } else {
        doc.text(text.slice(0, 42), x + pad, y + 3.5);
      }
      x += tw;
    });
    doc.line(x, y, x, y + rowH);
    y += rowH;
    stripe += 1;
  }

  const safeName = (pipelineName || 'crm-pipeline').replace(/[^\w\-]+/g, '-').slice(0, 40);
  doc.save(`5-for-5-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}