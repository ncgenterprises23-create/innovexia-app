import { jsPDF } from 'jspdf';
import {
  FIVE_FOR_THREE_METRIC_LABELS,
  FIVE_FOR_THREE_METRIC_ORDER,
  formatFiveForThreeActual,
  formatFiveForThreePlanned,
  type FiveForThreeMonth,
} from '@/lib/crmPipelineFiveForThree';

const HEADER_FILL: [number, number, number] = [234, 179, 8];
const TITLE_FILL: [number, number, number] = [254, 243, 199];
const TOTAL_FILL: [number, number, number] = [253, 230, 138];
const BORDER: [number, number, number] = [180, 140, 50];
const TEXT_DARK: [number, number, number] = [30, 41, 59];

export function exportCrmPipelineFiveForThreePdf(opts: {
  title: string;
  pipelineName?: string;
  rangeLabel: string;
  months: FiveForThreeMonth[];
}) {
  const { title, pipelineName, rangeLabel, months } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 6;
  const rowH = 4.5;
  let y = margin;

  const addTitleBlock = () => {
    doc.setFillColor(...TITLE_FILL);
    doc.rect(margin, y - 2, pageW - margin * 2, 18, 'F');
    doc.setDrawColor(...BORDER);
    doc.rect(margin, y - 2, pageW - margin * 2, 18, 'S');
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageW / 2, y + 4, { align: 'center' });
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const sub = [pipelineName ? `Pipeline: ${pipelineName}` : '', `Range: ${rangeLabel}`]
      .filter(Boolean)
      .join('   ·   ');
    doc.text(sub, pageW / 2, y + 2, { align: 'center' });
    y += 6;
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageW / 2, y + 1, { align: 'center' });
    y += 8;
    doc.setTextColor(...TEXT_DARK);
  };

  addTitleBlock();

  const weekW = 14;
  const spW = 22;
  const metricPairW = (pageW - margin * 2 - weekW - spW) / FIVE_FOR_THREE_METRIC_ORDER.length;

  for (const month of months) {
    if (y > pageH - margin - rowH * 4) {
      doc.addPage();
      y = margin;
      addTitleBlock();
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(month.label, margin, y + 3);
    y += 5;

    const drawHeader = () => {
      let x = margin;
      doc.setFillColor(...HEADER_FILL);
      doc.rect(x, y, pageW - margin * 2, rowH * 2, 'F');
      doc.setDrawColor(...BORDER);
      doc.rect(x, y, pageW - margin * 2, rowH * 2, 'S');
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Week', x + 1, y + 3.2);
      doc.text('Salesperson', x + weekW + 1, y + 3.2);
      x += weekW + spW;
      for (const key of FIVE_FOR_THREE_METRIC_ORDER) {
        const label = FIVE_FOR_THREE_METRIC_LABELS[key].slice(0, 28);
        doc.text(label, x + metricPairW / 2, y + 2.5, { align: 'center', maxWidth: metricPairW - 2 });
        x += metricPairW;
      }
      y += rowH;
      x = margin + weekW + spW;
      for (let i = 0; i < FIVE_FOR_THREE_METRIC_ORDER.length; i++) {
        doc.text('Pl', x + 1, y + 3);
        doc.text('Ac', x + metricPairW / 2 + 1, y + 3);
        x += metricPairW;
      }
      y += rowH;
    };

    drawHeader();

    for (const week of month.weeks) {
      for (let rowIdx = 0; rowIdx < week.rows.length; rowIdx++) {
        const row = week.rows[rowIdx];
        if (y + rowH > pageH - margin) {
          doc.addPage();
          y = margin;
          drawHeader();
        }
        let x = margin;
        const fill = row.isTotal ? TOTAL_FILL : [255, 255, 255] as [number, number, number];
        doc.setFillColor(...fill);
        doc.rect(x, y, pageW - margin * 2, rowH, 'F');
        doc.setDrawColor(...BORDER);
        doc.rect(x, y, pageW - margin * 2, rowH, 'S');
        doc.setFontSize(5.5);
        doc.setFont('helvetica', row.isTotal ? 'bold' : 'normal');
        if (rowIdx === 0) doc.text(week.label, x + 1, y + 3.2);
        doc.text(row.salesperson.slice(0, 18), x + weekW + 1, y + 3.2);
        x += weekW + spW;
        for (const metricKey of FIVE_FOR_THREE_METRIC_ORDER) {
          const cell = row.metrics[metricKey];
          doc.text(formatFiveForThreePlanned(metricKey, cell.planned).slice(0, 8), x + 1, y + 3.2);
          doc.text(
            formatFiveForThreeActual(metricKey, cell.actual).slice(0, 10),
            x + metricPairW / 2 + 1,
            y + 3.2
          );
          x += metricPairW;
        }
        y += rowH;
      }
    }
    y += 4;
  }

  const safeName = (pipelineName || 'crm-pipeline').replace(/[^\w\-]+/g, '-').slice(0, 40);
  doc.save(`5-for-3-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}