import { DB } from './state.js';
import { taka, dateBn } from './utils.js';
import { customerName, brandName } from './state.js';

/* ============================================================
   SALE RECEIPT — Print-friendly money receipt
   ============================================================ */

function getLogoDataURL() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => resolve(null);
    // Try relative path first (works on GitHub Pages & local)
    img.src = './logo.jpeg?' + Date.now();
  });
}

export async function printSaleReceipt(id) {
  const s = DB.sales.find(x => x.id === id);
  if (!s) return;

  const cust = DB.customers.find(c => c.id === s.customer_id);
  const custName = cust ? cust.name : 'ক্যাশ কাস্টমার';
  const custPhone = cust && cust.phone ? cust.phone : '';
  const discount = Number(s.discount || 0);
  const afterDiscount = Math.max(0, s.total - discount);
  const saleTypeLabel = s.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা';

  // Get logo as base64 so it works in print window
  const logoDataURL = await getLogoDataURL();
  const logoHTML = logoDataURL
    ? `<img src="${logoDataURL}" class="logo" alt="লোগো">`
    : `<div class="logo-placeholder">W</div>`;

  const itemRows = s.items.map((it, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${it.name}</td>
      <td class="center">${it.qty}</td>
      <td class="right">${taka(it.price)}</td>
      <td class="right">${taka(it.qty * it.price)}</td>
    </tr>`).join('');

  const receiptHTML = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>বিক্রয় রিসিট — ${s.memo_no || s.id.slice(0, 8)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Baloo+Da+2:wght@700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Hind Siliguri', sans-serif;
      background: #f8f5ee;
      color: #1a1610;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 24px 16px;
    }

    .receipt-card {
      background: #fff;
      width: 100%;
      max-width: 380px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 40px rgba(0,0,0,0.12);
      height: fit-content;
    }

    /* ---- Header ---- */
    .receipt-header {
      background: linear-gradient(135deg, #0F332C, #1D5F53);
      color: #f5f1e4;
      padding: 18px 16px 14px;
      text-align: center;
      position: relative;
    }
    .receipt-header::after {
      content: '';
      display: block;
      height: 4px;
      background: repeating-linear-gradient(90deg, #B9812E 0 8px, #C9973E 8px 16px, #E7C989 16px 24px, #C9973E 24px 32px);
      position: absolute;
      bottom: 0; left: 0; right: 0;
    }
    .logo {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255,255,255,0.25);
      margin-bottom: 8px;
      display: block;
      margin: 0 auto 8px;
    }
    .logo-placeholder {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 800;
      color: #E7C989;
      margin: 0 auto 8px;
      border: 2px solid rgba(255,255,255,0.25);
      font-family: 'Baloo Da 2', sans-serif;
    }
    .shop-name {
      font-family: 'Baloo Da 2', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #FBF6E8;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .shop-sub {
      font-size: 9px;
      color: #CFE3DA;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    /* ---- Receipt Label ---- */
    .receipt-label-bar {
      background: #B9812E;
      color: #3A2708;
      text-align: center;
      font-size: 10.5px;
      font-weight: 700;
      padding: 5px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* ---- Meta Info ---- */
    .meta-section {
      padding: 12px 16px 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px 12px;
      border-bottom: 1px dashed #e2dac4;
    }
    .meta-item label {
      font-size: 8.5px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      display: block;
      margin-bottom: 1px;
    }
    .meta-item span {
      font-size: 11px;
      font-weight: 600;
      color: #1a1610;
    }
    .badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge.wholesale { background: #ecebf8; color: #4A4A8F; }
    .badge.retail { background: #e7f0f7; color: #2D5F82; }

    /* ---- Items Table ---- */
    .items-section { padding: 0 16px 0; }
    .items-section h4 {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 700;
      margin: 10px 0 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead tr {
      background: #f0ece0;
    }
    thead th {
      padding: 5px 5px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      color: #5a5040;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    thead th.center, td.center { text-align: center; }
    thead th.right, td.right { text-align: right; }
    tbody tr { border-bottom: 1px solid #f0ece0; }
    tbody tr:last-child { border-bottom: none; }
    tbody td {
      padding: 5px 5px;
      font-size: 10.5px;
      color: #1a1610;
    }
    tbody tr:nth-child(even) { background: #faf8f3; }

    /* ---- Totals ---- */
    .totals-section {
      margin: 10px 16px 0;
      border-top: 1px dashed #e2dac4;
      padding-top: 8px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      font-size: 10.5px;
      color: #5a5040;
    }
    .totals-row span { font-weight: 500; }
    .totals-row b { font-weight: 700; color: #1a1610; }
    .totals-row.discount b { color: #059669; }
    .totals-row.grand {
      background: #0F332C;
      color: #f5f1e4;
      margin: 8px -16px 0;
      padding: 9px 16px;
      font-size: 11.5px;
    }
    .totals-row.grand span, .totals-row.grand b { color: #f5f1e4; }
    .totals-row.grand b { font-size: 13px; color: #E7C989; }
    .totals-row.due-row b { color: #B9812E; }
    .totals-row.paid-row b { color: #059669; }

    /* ---- Footer ---- */
    .receipt-footer {
      padding: 12px 16px 14px;
      text-align: center;
    }
    .thank-you {
      font-family: 'Baloo Da 2', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #0F332C;
      margin-bottom: 4px;
    }
    .footer-note {
      font-size: 9px;
      color: #888;
      line-height: 1.5;
    }
    .dotted-line {
      border: none;
      border-top: 1px dashed #e2dac4;
      margin: 10px 0;
    }
    .print-btn-wrap {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    .print-btn {
      background: #0F332C;
      color: #f5f1e4;
      border: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-family: 'Hind Siliguri', sans-serif;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .print-btn:hover { background: #1D5F53; }
    .close-btn {
      background: #fff;
      color: #5a5040;
      border: 1.5px solid #e2dac4;
      border-radius: 12px;
      padding: 12px 18px;
      font-family: 'Hind Siliguri', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      padding: 0 8px;
      margin-top: 8px;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      width: 65px;
      border-top: 1.5px solid #d0c8b0;
      margin: 0 auto 4px;
    }
    .sig-label {
      font-size: 9px;
      color: #888;
      font-weight: 500;
    }

    /* ---- Print: small A6-size receipt, printed on regular A4 paper
           and meant to be cut out with scissors ---- */
    @media print {
      body {
        background: #fff;
        padding: 0;
        display: block;
      }
      .receipt-card {
        box-shadow: none;
        border-radius: 0;
        width: 100mm;
        max-width: 100mm;
        margin: 0 auto;
        border: 1px dashed #999;
      }
      .cut-hint {
        display: block !important;
        text-align: center;
        font-size: 8px;
        color: #999;
        letter-spacing: 1px;
        margin: 0 auto 3mm;
        width: 100mm;
      }
      .print-btn-wrap { display: none !important; }
      /* A4 sheet — receipt prints small in the corner so it can be
         cut out; size:A6 keeps the printable content compact. */
      @page { size: A6; margin: 4mm; }
    }
    .cut-hint { display: none; }
  </style>
</head>
<body>
  <div class="cut-hint">✂ - - - - - - - - - এখান থেকে কেটে নিন - - - - - - - - - ✂</div>
  <div class="receipt-card">

    <!-- Header -->
    <div class="receipt-header">
      ${logoHTML}
      <div class="shop-name">ওয়ারিশা থ্রিপিস</div>
      <div class="shop-sub">লোকানের হিসাব খাতা — ক্রয়, বিক্রয়, বকেয়া ও মূলধন</div>
    </div>

    <div class="receipt-label-bar">💰 বিক্রয় রিসিট / Money Receipt</div>

    <!-- Meta -->
    <div class="meta-section">
      <div class="meta-item">
        <label>রিসিট নম্বর</label>
        <span>${s.memo_no ? '#' + s.memo_no : '#' + s.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="meta-item">
        <label>তারিখ</label>
        <span>${dateBn(s.date)}</span>
      </div>
      <div class="meta-item">
        <label>কাস্টমার</label>
        <span>${custName}</span>
      </div>
      <div class="meta-item">
        <label>ফোন</label>
        <span>${custPhone || '—'}</span>
      </div>
      <div class="meta-item">
        <label>বিক্রয়ের ধরন</label>
        <span><span class="badge ${s.sale_type}">${saleTypeLabel}</span></span>
      </div>
      <div class="meta-item">
        <label>পেমেন্ট মাধ্যম</label>
        <span>${s.payment_method === 'cash' ? '💵 নগদ' : s.payment_method === 'bank' ? '🏦 ব্যাংক' : '📱 মোবাইল ব্যাংকিং'}</span>
      </div>
    </div>

    <!-- Items -->
    <div class="items-section">
      <h4>পণ্যের বিবরণ</h4>
      <table>
        <thead>
          <tr>
            <th class="center">#</th>
            <th>পণ্যের নাম</th>
            <th class="center">পরিমাণ</th>
            <th class="right">দাম/পিস</th>
            <th class="right">মোট</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-row">
        <span>সর্বমোট</span>
        <b>${taka(s.total)}</b>
      </div>
      ${discount > 0 ? `
      <div class="totals-row discount">
        <span>ছাড়</span>
        <b>— ${taka(discount)}</b>
      </div>
      <div class="totals-row">
        <span>ছাড়ের পরে মোট</span>
        <b>${taka(afterDiscount)}</b>
      </div>` : ''}
      <div class="totals-row paid-row">
        <span>পরিশোধিত</span>
        <b>${taka(s.paid)}</b>
      </div>
      ${s.due > 0 ? `
      <div class="totals-row due-row">
        <span>বকেয়া</span>
        <b>${taka(s.due)}</b>
      </div>` : ''}

      <div class="totals-row grand">
        <span>মোট প্রদেয়</span>
        <b>${taka(afterDiscount)}</b>
      </div>
    </div>

    <!-- Footer -->
    <div class="receipt-footer">
      <hr class="dotted-line">
      <div class="signature-row">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">গ্রাহকের স্বাক্ষর</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">বিক্রেতার স্বাক্ষর</div>
        </div>
      </div>
      <hr class="dotted-line">
      <div class="thank-you">🙏 ধন্যবাদ আমাদের কাছে কেনাকাটার জন্য!</div>
      <div class="footer-note">
        পণ্য বিক্রির পরে ফেরত নেওয়া হয় না<br>
        ক্রয়ের রিসিটটি সংরক্ষণ করুন
      </div>
    </div>

  </div>

  <!-- Print Button -->
  <div class="print-btn-wrap">
    <button class="close-btn" onclick="window.close()">✕ বন্ধ করুন</button>
    <button class="print-btn" onclick="window.print()">🖨️ প্রিন্ট করুন</button>
  </div>

  <script>
    // Auto-focus for quick print shortcut
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        // Browser handles natively
      }
      if (e.key === 'Escape') window.close();
    });
  </script>
</body>
</html>`;

  // Open in new window
  const win = window.open('', '_blank', 'width=460,height=760,scrollbars=yes,toolbar=no,menubar=no,location=no');
  if (!win) {
    alert('পপআপ ব্লক হয়েছে। ব্রাউজারে পপআপ অনুমতি দিন।');
    return;
  }
  win.document.write(receiptHTML);
  win.document.close();
}

window.printSaleReceipt = printSaleReceipt;
