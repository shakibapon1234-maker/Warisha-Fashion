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

  // Audit Product Brand Mismatches with Purchases
  DB.purchases.forEach(p => {
    p.items.forEach(it => {
      const prod = DB.products.find(x => x.id === it.product_id);
      if (prod && prod.brand_id !== p.brand_id) {
        const pBrand = DB.brands.find(b => b.id === p.brand_id)?.name || 'অজানা';
        const cBrand = DB.brands.find(b => b.id === prod.brand_id)?.name || 'অজানা';
        issues.push(`ক্রয় (মেমো: ${p.memo_no || 'N/A'}): প্রোডাক্ট '${prod.name}' ক্যাটালগে '${cBrand}' কিন্তু ক্রয়ে '${pBrand}' ধরা আছে`);
      }
    });
  });

  return {
    isHealthy: issues.length === 0,
    issuesCount: issues.length,
    issues
  };
}

export async function autoFixBrandProductMismatches() {
  let changed = false;
  if (!DB.purchases || !DB.products) return false;

  for (const p of DB.purchases) {
    if (!p.brand_id) continue;
    for (const it of p.items) {
      const prod = DB.products.find(x => x.id === it.product_id);
      if (prod && prod.brand_id !== p.brand_id) {
        changed = true;
        let brandProd = DB.products.find(x => x.brand_id === p.brand_id && x.name.trim().toLowerCase() === prod.name.trim().toLowerCase());
        if (!brandProd) {
          const { data: newP, error: nErr } = await sb.from('products').insert({
            brand_id: p.brand_id,
            name: prod.name,
            category: prod.category || '',
            size: prod.size || '',
            color: prod.color || '',
            buy_price: it.cost || prod.buy_price,
            qty: 0
          }).select().single();
          if (!nErr && newP) {
            brandProd = { ...newP, buy_price: Number(newP.buy_price), qty: Number(newP.qty) };
            DB.products.push(brandProd);
          }
        }
        if (brandProd) {
          await sb.from('purchase_items').update({ product_id: brandProd.id }).eq('purchase_id', p.id).eq('product_id', it.product_id);
          it.product_id = brandProd.id;
        }
      }
    }
  }

  // Recalculate product stock quantities
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
      changed = true;
      await sb.from('products').update({ qty: expectedQty }).eq('id', prod.id);
      prod.qty = expectedQty;
    }
  }
  return changed;
}

export async function fixSyncGuardDiscrepancies() {
  setLoading(true);
  try {
    const fixedBrand = await autoFixBrandProductMismatches();

    // 2. Fix Customers
    for (const c of DB.customers) {
      const custSalesDue = DB.sales.filter(s => s.customer_id === c.id).reduce((s, x) => s + x.due, 0);
      const custPayments = DB.payments_customer.filter(p => p.customer_id === c.id).reduce((s, x) => s + x.amount, 0);
      const expectedDue = Math.max(0, custSalesDue - custPayments);
      if (Math.abs(c.due - expectedDue) > 0.01) {
        await sb.from('customers').update({ due: expectedDue }).eq('id', c.id);
      }
    }

    // 3. Fix Suppliers
    for (const s of DB.suppliers) {
      const supPurchasesDue = DB.purchases.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.due, 0);
      const supPayments = DB.payments_supplier.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.amount, 0);
      const expectedDue = Math.max(0, supPurchasesDue - supPayments);
      if (Math.abs(s.due - expectedDue) > 0.01) {
        await sb.from('suppliers').update({ due: expectedDue }).eq('id', s.id);
      }
    }

    // 4. Fix Product Stock Quantities
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
    if (window.renderCatalog) window.renderCatalog();
    if (window.renderPurchases) window.renderPurchases();
    if (window.renderDashboard) window.renderDashboard();
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
window.autoFixBrandProductMismatches = autoFixBrandProductMismatches;
