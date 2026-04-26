// Exporters for utilization (dashboard) and billing reports.
// XLSX via SheetJS, PDF via jsPDF + autoTable.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Column = { header: string; key: string; width?: number };

function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportXLSX(
  filenameBase: string,
  sheets: { name: string; columns: Column[]; rows: Record<string, unknown>[] }[],
) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa: unknown[][] = [s.columns.map((c) => c.header)];
    for (const r of s.rows) aoa.push(s.columns.map((c) => r[c.key] ?? ""));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = s.columns.map((c) => ({ wch: c.width ?? 16 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || "Sheet");
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  downloadBlob(
    out,
    `${filenameBase}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export function exportPDF(
  filenameBase: string,
  title: string,
  subtitle: string,
  tables: { heading?: string; columns: Column[]; rows: Record<string, unknown>[] }[],
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitle, 14, 22);
  doc.setTextColor(0);

  let y = 28;
  for (const t of tables) {
    if (t.heading) {
      doc.setFontSize(12);
      doc.text(t.heading, 14, y);
      y += 4;
    }
    autoTable(doc, {
      startY: y,
      head: [t.columns.map((c) => c.header)],
      body: t.rows.map((r) => t.columns.map((c) => String(r[c.key] ?? ""))),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40] },
      margin: { left: 14, right: 14 },
    });
    // jspdf-autotable attaches lastAutoTable on the doc instance.
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = (last?.finalY ?? y) + 8;
  }

  doc.save(`${filenameBase}.pdf`);
}
