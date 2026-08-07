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
      background: linear-gradient(160deg, #fdf3e4, #f3e9d8 60%, #efe3cd);
      color: #1a1610;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 24px 16px;
    }

    .receipt-card {
      background: #fffdf8;
      width: 100%;
      max-width: 380px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 46px rgba(90,50,10,0.18), 0 0 0 1px rgba(201,151,62,0.15);
      height: fit-content;
      position: relative;
    }

    /* ---- Header ---- */
    .receipt-header {
      background:
        radial-gradient(120% 100% at 15% -10%, rgba(201,151,62,0.35), transparent 55%),
        linear-gradient(135deg, #14100d, #262019 55%, #14100d);
      color: #f5f1e4;
      padding: 26px 16px 16px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .receipt-header::before {
      content: '';
      position: absolute;
      top: -40%; left: -10%;
      width: 60%; height: 180%;
      background: linear-gradient(120deg, transparent 40%, rgba(231,201,137,0.12) 50%, transparent 60%);
    }
    .receipt-header::after {
      content: '';
      display: block;
      height: 5px;
      background: repeating-linear-gradient(90deg, #8a5a1f 0 8px, #C9973E 8px 16px, #F0D9A0 16px 24px, #C9973E 24px 32px);
      position: absolute;
      bottom: 0; left: 0; right: 0;
    }
    .logo-ring {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      margin: 0 auto 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #E7C989, #B9812E 45%, #E7C989);
      box-shadow: 0 0 0 3px rgba(255,255,255,0.08), 0 6px 22px rgba(0,0,0,0.35), 0 0 24px rgba(231,201,137,0.35);
      position: relative;
    }
    .logo {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid #14100d;
      display: block;
    }
    .logo-placeholder {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: #14100d;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: #E7C989;
      border: 3px solid #14100d;
      font-family: 'Baloo Da 2', sans-serif;
    }
    .shop-name {
      font-family: 'Baloo Da 2', sans-serif;
      font-size: 20px;
      font-weight: 800;
      background: linear-gradient(90deg, #F0D9A0, #E7C989 40%, #C9973E);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
    }
    .shop-sub {
      font-size: 9px;
      color: #CFC3AE;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    /* ---- Receipt Label ---- */
    .receipt-label-bar {
      background: linear-gradient(90deg, #9c6a24, #C9973E 50%, #9c6a24);
      color: #2a1c05;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
      padding: 7px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      text-shadow: 0 1px 0 rgba(255,255,255,0.25);
    }

    /* ---- Meta Info ---- */
    .meta-section {
      padding: 14px 16px 11px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
      border-bottom: 1px dashed #e2c98c;
      background: linear-gradient(180deg, #fbf3e0, #fffdf8 70%);
    }
    .meta-item label {
      font-size: 8.5px;
      color: #9a8355;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      display: block;
      margin-bottom: 1px;
    }
    .meta-item span {
      font-size: 11px;
      font-weight: 700;
      color: #1a1610;
    }
    .badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge.wholesale { background: linear-gradient(90deg,#6E59D6,#8A73F0); color: #fff; }
    .badge.retail { background: linear-gradient(90deg,#1D7DAA,#2FA0D6); color: #fff; }

    /* ---- Items Table ---- */
    .items-section { padding: 0 16px 0; }
    .items-section h4 {
      font-size: 9px;
      color: #9a8355;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 700;
      margin: 12px 0 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead tr {
      background: linear-gradient(90deg, #14100d, #2c2419);
    }
    thead th {
      padding: 6px 5px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      color: #E7C989;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    thead th:first-child { border-radius: 6px 0 0 6px; }
    thead th:last-child { border-radius: 0 6px 6px 0; }
    thead th.center, td.center { text-align: center; }
    thead th.right, td.right { text-align: right; }
    tbody tr { border-bottom: 1px solid #f0e6cc; }
    tbody tr:last-child { border-bottom: none; }
    tbody td {
      padding: 6px 5px;
      font-size: 10.5px;
      color: #1a1610;
    }
    tbody tr:nth-child(even) { background: #fbf3e0; }

    /* ---- Totals ---- */
    .totals-section {
      margin: 10px 16px 0;
      border-top: 1px dashed #e2c98c;
      padding-top: 8px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      font-size: 10.5px;
      color: #7a6a4a;
    }
    .totals-row span { font-weight: 500; }
    .totals-row b { font-weight: 700; color: #1a1610; }
    .totals-row.discount b { color: #059669; }
    .totals-row.grand {
      background: linear-gradient(120deg, #14100d, #2c2419 60%, #14100d);
      color: #f5f1e4;
      margin: 10px -16px 0;
      padding: 12px 16px;
      font-size: 11.5px;
      position: relative;
      overflow: hidden;
    }
    .totals-row.grand::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: repeating-linear-gradient(90deg, #8a5a1f 0 8px, #C9973E 8px 16px, #F0D9A0 16px 24px, #C9973E 24px 32px);
    }
    .totals-row.grand span, .totals-row.grand b { color: #f5f1e4; }
    .totals-row.grand b { font-size: 15px; color: #E7C989; }
    .totals-row.due-row b { color: #C9973E; }
    .totals-row.paid-row b { color: #059669; }

    /* ---- Footer ---- */
    .receipt-footer {
      padding: 14px 16px 16px;
      text-align: center;
      background: linear-gradient(180deg, #fffdf8, #fbf3e0);
    }
    .thank-you {
      font-family: 'Baloo Da 2', sans-serif;
      font-size: 13px;
      font-weight: 800;
      color: #14100d;
      margin-bottom: 4px;
    }
    .footer-note {
      font-size: 9px;
      color: #9a8355;
      line-height: 1.5;
    }
    .dotted-line {
      border: none;
      border-top: 1px dashed #e2c98c;
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
      background: linear-gradient(120deg, #14100d, #2c2419);
      color: #E7C989;
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
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .print-btn:hover { background: linear-gradient(120deg, #2c2419, #14100d); }
    .close-btn {
      background: #fff;
      color: #7a6a4a;
      border: 1.5px solid #e2c98c;
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
      border-top: 1.5px solid #cbb178;
      margin: 0 auto 4px;
    }
    .sig-label {
      font-size: 9px;
      color: #9a8355;
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
      <div class="logo-ring">${logoHTML}</div>
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
