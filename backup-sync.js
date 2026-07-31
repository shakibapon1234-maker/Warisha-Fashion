import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { todayISO, setLoading } from './utils.js';

/* ============================================================
   BACKUP, IMPORT & SYNC GUARD ENGINE
   ============================================================ */

/* 1. System Backup Export */
export function exportSystemBackupJSON(isAuto = false) {
  const backupObj = {
    version: '1.0',
    app: 'Warisha Fashion',
    exported_at: new Date().toISOString(),
    db: {
      brands: DB.brands,
      products: DB.products,
      suppliers: DB.suppliers,
      customers: DB.customers,
      purchases: DB.purchases,
      sales: DB.sales,
      payments_customer: DB.payments_customer,
      payments_supplier: DB.payments_supplier,
      investments: DB.investments,
      advances_customer: DB.advances_customer,
      advances_supplier: DB.advances_supplier,
      expenses: DB.expenses,
      payment_accounts: DB.payment_accounts,
    }
  };

  const jsonStr = JSON.stringify(backupObj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = todayISO();
  a.href = url;
  a.download = isAuto ? `warisha_autobackup_${dateStr}.json` : `warisha_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* 2. Daily Automatic Backup Check */
export function checkDailyAutoBackup() {
  const today = todayISO();
  const lastBackup = localStorage.getItem('warisha_last_autobackup_date');
  if (lastBackup !== today) {
    if (DB.purchases.length > 0 || DB.sales.length > 0 || DB.products.length > 0) {
      exportSystemBackupJSON(true);
      localStorage.setItem('warisha_last_autobackup_date', today);
    }
  }
}

/* 3. System Data Restore / Import */
export async function importSystemBackupJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const backupData = JSON.parse(e.target.result);
      const dbData = backupData.db || backupData;
      if (!dbData.brands || !dbData.products) {
        alert('ভুল ফাইল ফরম্যাট! এটি সঠিক Warisha থ্রিপিস ব্যাকআপ ফাইল নয়।');
        return;
      }

      const summary = `ব্যাকআপ ফাইল তথ্য:\n` +
        `- প্রোডাক্ট: ${dbData.products?.length || 0} টি\n` +
        `- বিক্রয়: ${dbData.sales?.length || 0} টি\n` +
        `- ক্রয়: ${dbData.purchases?.length || 0} টি\n` +
        `- কাস্টমার: ${dbData.customers?.length || 0} জন\n\n` +
        `আপনি কি নিশ্চিতভাবে এই ফাইলটি ডেটাবেসে রিস্টোর করবেন? বর্তমান অসামঞ্জস্য ডেটা প্রতিস্থাপিত হবে।`;

      if (!confirm(summary)) return;

      setLoading(true);
      try {
        // Restore step by step
        if (dbData.brands?.length) {
          for (const b of dbData.brands) {
            await sb.from('brands').upsert({ id: b.id, name: b.name, created_at: b.created_at });
          }
        }
        if (dbData.suppliers?.length) {
          for (const s of dbData.suppliers) {
            await sb.from('suppliers').upsert({ id: s.id, name: s.name, due: s.due, advance: s.advance });
          }
        }
        if (dbData.customers?.length) {
          for (const c of dbData.customers) {
            await sb.from('customers').upsert({ id: c.id, name: c.name, phone: c.phone || '', due: c.due, advance: c.advance });
          }
        }
        if (dbData.products?.length) {
          for (const p of dbData.products) {
            await sb.from('products').upsert({
              id: p.id, brand_id: p.brand_id, name: p.name, category: p.category || '',
              size: p.size || '', color: p.color || '', buy_price: p.buy_price, qty: p.qty
            });
          }
        }
        if (dbData.payment_accounts?.length) {
          for (const pa of dbData.payment_accounts) {
            await sb.from('payment_accounts').upsert({ id: pa.id, type: pa.type, name: pa.name });
          }
        }

        alert('ব্যাকআপ রিস্টোর সফল হয়েছে!');
        await loadAll();
      } catch (err) {
        alert('রিস্টোর করার সময় ত্রুটি ঘটেছে: ' + err.message);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      alert('ফাইল পড়তে সমস্যা হয়েছে: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* 4. Sync Guard - Balance Audit & Auto-Fix */
export function runSyncGuardAudit() {
  const issues = [];

  // Audit Customers
  DB.customers.forEach(c => {
    const custSales = DB.sales.filter(s => s.customer_id === c.id);
    const custSalesDue = custSales.reduce((s, x) => s + x.due, 0);
    const custPayments = DB.payments_customer.filter(p => p.customer_id === c.id).reduce((s, x) => s + x.amount, 0);
    const expectedDue = Math.max(0, custSalesDue - custPayments);

    if (Math.abs(c.due - expectedDue) > 0.01) {
      issues.push(`কাস্টমার '${c.name}': বর্তমান পাওনা ৳${c.due}, তবে বিক্রয় ও পরিশোধ অনুযায়ী হওয়া উচিত ৳${expectedDue}`);
    }
  });

  // Audit Suppliers
  DB.suppliers.forEach(s => {
    const supPurchases = DB.purchases.filter(p => p.supplier_id === s.id);
    const supPurchasesDue = supPurchases.reduce((acc, x) => acc + x.due, 0);
    const supPayments = DB.payments_supplier.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.amount, 0);
    const expectedDue = Math.max(0, supPurchasesDue - supPayments);

    if (Math.abs(s.due - expectedDue) > 0.01) {
      issues.push(`সাপ্লায়ার '${s.name}': বর্তমান দেনা ৳${s.due}, তবে ক্রয় ও পরিশোধ অনুযায়ী হওয়া উচিত ৳${expectedDue}`);
    }
  });

  // Audit Product Stock Quantities
  DB.products.forEach(prod => {
    let purchasedQty = 0;
    DB.purchases.forEach(p => {
      p.items.forEach(it => {
        if (it.product_id === prod.id) purchasedQty += Number(it.qty || 0);
      });
    });

    let soldQty = 0;
    DB.sales.forEach(s => {
      s.items.forEach(it => {
        if (it.product_id === prod.id) soldQty += Number(it.qty || 0);
      });
    });

    const expectedQty = Math.max(0, purchasedQty - soldQty);
    if (prod.qty !== expectedQty) {
      issues.push(`প্রোডাক্ট '${prod.name}': বর্তমান মজুদ স্টক ${prod.qty} পিস, তবে ক্রয়-বিক্রয় হিসেব অনুযায়ী হওয়ার কথা ${expectedQty} পিস`);
    }
  });

  return {
    isHealthy: issues.length === 0,
    issuesCount: issues.length,
    issues
  };
}

export async function fixSyncGuardDiscrepancies() {
  const audit = runSyncGuardAudit();
  if (audit.isHealthy) {
    alert('✅ আপনার সব ব্যালেন্স ও স্টক ১০০% সিঙ্ক করা আছে! কোনো অমিল পাওয়া যায়নি।');
    return;
  }

  if (!confirm(`সিঙ্ক গার্ড ${audit.issuesCount} টি অমিল শনাক্ত করেছে। আপনি কি ক্রয়-বিক্রয়ের সূত্র ধরে সমস্ত ব্যালেন্স ও স্টক অটোমেটিক ফিক্স করবেন?`)) return;

  setLoading(true);
  try {
    // Fix Customers
    for (const c of DB.customers) {
      const custSalesDue = DB.sales.filter(s => s.customer_id === c.id).reduce((s, x) => s + x.due, 0);
      const custPayments = DB.payments_customer.filter(p => p.customer_id === c.id).reduce((s, x) => s + x.amount, 0);
      const expectedDue = Math.max(0, custSalesDue - custPayments);
      if (Math.abs(c.due - expectedDue) > 0.01) {
        await sb.from('customers').update({ due: expectedDue }).eq('id', c.id);
      }
    }

    // Fix Suppliers
    for (const s of DB.suppliers) {
      const supPurchasesDue = DB.purchases.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.due, 0);
      const supPayments = DB.payments_supplier.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.amount, 0);
      const expectedDue = Math.max(0, supPurchasesDue - supPayments);
      if (Math.abs(s.due - expectedDue) > 0.01) {
        await sb.from('suppliers').update({ due: expectedDue }).eq('id', s.id);
      }
    }

    // Fix Product Stock
    for (const prod of DB.products) {
      let purchasedQty = 0;
      DB.purchases.forEach(p => {
        p.items.forEach(it => { if (it.product_id === prod.id) purchasedQty += Number(it.qty || 0); });
      });
      let soldQty = 0;
      DB.sales.forEach(s => {
        s.items.forEach(it => { if (it.product_id === prod.id) soldQty += Number(it.qty || 0); });
      });
      const expectedQty = Math.max(0, purchasedQty - soldQty);
      if (prod.qty !== expectedQty) {
        await sb.from('products').update({ qty: expectedQty }).eq('id', prod.id);
      }
    }

    alert('🎉 সিঙ্ক গার্ড সফলভাবে সমস্ত ব্যালেন্স ও স্টক রিক্যালকুলেট ও ফিক্স করেছে!');
    await loadAll();
  } catch (err) {
    alert('ফিক্স করার সময় সমস্যা হয়েছে: ' + err.message);
  } finally {
    setLoading(false);
  }
}

window.exportSystemBackupJSON = exportSystemBackupJSON;
window.importSystemBackupJSON = importSystemBackupJSON;
window.checkDailyAutoBackup = checkDailyAutoBackup;
window.runSyncGuardAudit = runSyncGuardAudit;
window.fixSyncGuardDiscrepancies = fixSyncGuardDiscrepancies;
