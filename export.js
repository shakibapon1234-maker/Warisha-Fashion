/* ============================================================
   EXPORT & PRINT UTILITIES
   PDF / Printable Layout Window & Excel (CSV with UTF-8 BOM)
   ============================================================ */

export function downloadCSV(filename, headers, dataRows) {
  const escapeCsv = val => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...dataRows.map(row => row.map(escapeCsv).join(','))
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printSection(title, subTitle, summaryCardsHtml, tableHeaderHtml, tableBodyHtml) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('পপ-আপ ব্লক করা আছে, অনুগ্রহ করে ব্রাউজারে পপ-আপ এলাউ করুন।'); return; }

  const html = `
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<title>${title} — Warisha থ্রিপিস</title>
<style>
  body { font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, sans-serif; margin: 20px; color: #111; line-height: 1.5; }
  .header { border-bottom: 2px solid #0F332C; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand h1 { margin: 0; font-size: 22px; color: #0F332C; }
  .brand p { margin: 2px 0 0; font-size: 13px; color: #555; }
  .meta { text-align: right; font-size: 12px; color: #666; }
  .meta b { color: #000; }
  .cards { display: flex; gap: 12px; margin-bottom: 20px; }
  .card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; background: #fdfdfd; }
  .card .lbl { font-size: 12px; color: #666; font-weight: 600; }
  .card .val { font-size: 18px; font-weight: 700; color: #0F332C; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f0f4f2; color: #0F332C; font-weight: 700; }
  .num { text-align: right; font-family: 'Baloo Da 2', sans-serif; font-weight: 600; }
  .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #eee; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
  @media print {
    body { margin: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>Warisha থ্রিপিস</h1>
      <p>দোকানের হিসাব খাতা — ${title}</p>
    </div>
    <div class="meta">
      <div><b>তারিখ রেঞ্জ:</b> ${subTitle || 'সকল তথ্য'}</div>
      <div><b>প্রিন্টের সময়:</b> ${new Date().toLocaleString('bn-BD')}</div>
    </div>
  </div>

  ${summaryCardsHtml ? `<div class="cards">${summaryCardsHtml}</div>` : ''}

  <table>
    <thead>${tableHeaderHtml}</thead>
    <tbody>${tableBodyHtml}</tbody>
  </table>

  <div class="footer">
    Warisha থ্রিপিস হিসাব খাতা সফটওয়্যার দ্বারা প্রস্তুতকৃত।
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

window.downloadCSV = downloadCSV;
window.printSection = printSection;
