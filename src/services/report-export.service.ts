import { reportService } from './report.service.js';
import type { TenantAuth } from './audit.service.js';
export const reportExportService = {
  async build(auth: TenantAuth, input: { report: 'revenue'|'appointments'|'laboratory'|'pharmacy'; format: 'pdf'|'excel'; from?: string; to?: string }) {
    const rows: any[] = input.report === 'revenue' ? await reportService.getRevenueReport(auth, input) : input.report === 'appointments' ? [await reportService.getAppointmentAnalytics(auth, input)] : input.report === 'laboratory' ? await reportService.getLabReport(auth, input) : [await reportService.getPharmacyReport(auth)];
    const cols = rows.length ? Object.keys(rows[0]) : ['report'];
    const esc = (v: unknown) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    if (input.format === 'excel') {
      const xml = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Table><Row>' + cols.map(c => '<Cell><Data ss:Type="String">'+esc(c)+'</Data></Cell>').join('') + '</Row>' + rows.map(r => '<Row>'+cols.map(c => '<Cell><Data ss:Type="String">'+esc(r[c])+'</Data></Cell>').join('')+'</Row>').join('') + '</Table></Worksheet></Workbook>';
      return { type: 'application/vnd.ms-excel', name: input.report + '.xls', body: Buffer.from(xml) };
    }
    const text = [input.report.toUpperCase()].concat(rows.map(r => cols.map(c => c+': '+String(r[c] ?? '')).join(' | '))).join('\\n');
    const stream = 'BT /F1 10 Tf 40 760 Td (' + text.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)').replaceAll('\\n',') Tj 0 -16 Td (') + ') Tj ET';
    const objs = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\\nstream\\n'+stream+'\\nendstream'];
    let pdf='%PDF-1.4\\n'; const offs=[0]; objs.forEach((o,i)=>{ offs.push(Buffer.byteLength(pdf)); pdf+=(i+1)+' 0 obj\\n'+o+'\\nendobj\\n'; }); const start=Buffer.byteLength(pdf); pdf+='xref\\n0 '+(objs.length+1)+'\\n0000000000 65535 f \\n'+offs.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \\n').join('')+'trailer\\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\\nstartxref\\n'+start+'\\n%%EOF';
    return { type: 'application/pdf', name: input.report + '.pdf', body: Buffer.from(pdf) };
  }
};