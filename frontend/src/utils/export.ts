import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Download an array of objects as a CSV file. */
export function exportCSV(rows: Record<string, any>[], filename: string) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/** Download an array of objects as an Excel workbook. */
export function exportExcel(rows: Record<string, any>[], filename: string, sheetName = "Report") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Download an array of objects as a simple tabular PDF. */
export function exportPDF(rows: Record<string, any>[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), 14, 22);
  const head = [Object.keys(rows[0] ?? { info: "No data" })];
  const body = rows.map((r) => Object.values(r).map((v) => String(v ?? "")));
  autoTable(doc, { head, body, startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });
  doc.save(`${filename}.pdf`);
}

export function downloadJSON(data: unknown, filename: string) {
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
