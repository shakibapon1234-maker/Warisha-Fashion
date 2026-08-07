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

  // Audit Purchase Invoice Math (total - discount = paid + due) — ছাড় বাদ দিয়ে হিসাব ঠিক আছে কিনা
  DB.purchases.forEach(p => {
    const afterDiscount = Math.max(0, Number(p.total || 0) - Number(p.discount || 0));
    const expectedDue = Math.max(0, afterDiscount - Number(p.paid || 0));
    if (Math.abs(Number(p.due || 0) - expectedDue) > 0.01) {
      issues.push(`ক্রয় (মেমো: ${p.memo_no || 'N/A'}): বর্তমান বকেয়া ৳${p.due}, তবে টোটাল-ছাড়-পেইড অনুযায়ী হওয়া উচিত ৳${expectedDue}`);
    }
    if (Number(p.paid || 0) > afterDiscount + 0.01) {
      issues.push(`ক্রয় (মেমো: ${p.memo_no || 'N/A'}): পেইড (৳${p.paid}) ছাড়-পরবর্তী টোটালের (৳${afterDiscount}) চেয়ে বেশি`);
    }
  });

  // Audit Sale Invoice Math (total - discount = paid + due) — ছাড় বাদ দিয়ে হিসাব ঠিক আছে কিনা
  DB.sales.forEach(s => {
    const afterDiscount = Math.max(0, Number(s.total || 0) - Number(s.discount || 0));
    const expectedDue = Math.max(0, afterDiscount - Number(s.paid || 0));
    if (Math.abs(Number(s.due || 0) - expectedDue) > 0.01) {
      issues.push(`বিক্রয় (মেমো: ${s.memo_no || 'N/A'}): বর্তমান বকেয়া ৳${s.due}, তবে টোটাল-ছাড়-পেইড অনুযায়ী হওয়া উচিত ৳${expectedDue}`);
    }
    if (Number(s.paid || 0) > afterDiscount + 0.01) {
      issues.push(`বিক্রয় (মেমো: ${s.memo_no || 'N/A'}): পেইড (৳${s.paid}) ছাড়-পরবর্তী টোটালের (৳${afterDiscount}) চেয়ে বেশি`);
    }
  });

  return {
    isHealthy: issues.length === 0,
    issuesCount: issues.length,
    issues
  };
}

export async function autoFixBrandProductMismatches(failures = null) {
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
          if (nErr) {
            if (failures) failures.push(`প্রোডাক্ট তৈরি (${prod.name}): ${nErr.message}`);
          } else if (newP) {
            brandProd = { ...newP, buy_price: Number(newP.buy_price), qty: Number(newP.qty) };
            DB.products.push(brandProd);
          }
        }
        if (brandProd) {
          const { error: uErr } = await sb.from('purchase_items').update({ product_id: brandProd.id }).eq('purchase_id', p.id).eq('product_id', it.product_id);
          if (uErr) {
            if (failures) failures.push(`ক্রয় আইটেম ব্র্যান্ড আপডেট (মেমো: ${p.memo_no || 'N/A'}): ${uErr.message}`);
          } else {
            it.product_id = brandProd.id;
          }
        }
      }
    }
  }

  // Recalculate product stock quantities
  for (const prod of DB.products) {
    let purchasedQty = 0;
    DB.purchases.forEach(p => {
      (p.items || []).forEach(it => { if (it.product_id === prod.id) purchasedQty += Number(it.qty || 0); });
    });
    let soldQty = 0;
    DB.sales.forEach(s => {
      (s.items || []).forEach(it => { if (it.product_id === prod.id) soldQty += Number(it.qty || 0); });
    });
    const expectedQty = Math.max(0, purchasedQty - soldQty);
    if (Number(prod.qty || 0) !== expectedQty) {
      changed = true;
      const { error: pErr } = await sb.from('products').update({ qty: expectedQty }).eq('id', prod.id);
      if (pErr) {
        if (failures) failures.push(`প্রোডাক্ট স্টক ফিক্স (${prod.name}): ${pErr.message}`);
      } else {
        prod.qty = expectedQty;
      }
    }
  }
  return changed;
}

export async function fixSyncGuardDiscrepancies() {
  setLoading(true);
  const failures = []; // প্রতিটি ফেইল হওয়া আপডেটের কারণ এখানে জমা হবে, যাতে চুপচাপ ব্যর্থ না হয়

  async function safeUpdate(table, patch, id, label) {
    const { error } = await sb.from(table).update(patch).eq('id', id);
    if (error) failures.push(`${label}: ${error.message}`);
    return !error;
  }

  try {
    await autoFixBrandProductMismatches(failures);

    // 1. Fix Purchase Total, Paid & Due Math
    for (const p of DB.purchases) {
      let expectedTotal = Number(p.total || 0);
      if (p.items && p.items.length > 0) {
        expectedTotal = p.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost || 0), 0);
      }
      const afterDiscount = Math.max(0, expectedTotal - Number(p.discount || 0));
      const expectedPaid = Math.min(Number(p.paid || 0), afterDiscount);
      const expectedDue = Math.max(0, afterDiscount - expectedPaid);

      if (Math.abs(Number(p.total || 0) - expectedTotal) > 0.01 ||
          Math.abs(Number(p.paid || 0) - expectedPaid) > 0.01 ||
          Math.abs(Number(p.due || 0) - expectedDue) > 0.01) {
        const patch = { total: expectedTotal, paid: expectedPaid, due: expectedDue };
        const ok = await safeUpdate('purchases', patch, p.id, `ক্রয় (মেমো: ${p.memo_no || 'N/A'})`);
        if (ok) { p.total = expectedTotal; p.paid = expectedPaid; p.due = expectedDue; }
      }
    }

    // 2. Fix Sale Total, Paid & Due Math
    for (const s of DB.sales) {
      let expectedTotal = Number(s.total || 0);
      if (s.items && s.items.length > 0) {
        expectedTotal = s.items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.price || 0), 0);
      }
      const afterDiscount = Math.max(0, expectedTotal - Number(s.discount || 0));
      const expectedPaid = Math.min(Number(s.paid || 0), afterDiscount);
      const expectedDue = Math.max(0, afterDiscount - expectedPaid);

      if (Math.abs(Number(s.total || 0) - expectedTotal) > 0.01 ||
          Math.abs(Number(s.paid || 0) - expectedPaid) > 0.01 ||
          Math.abs(Number(s.due || 0) - expectedDue) > 0.01) {
        const patch = { total: expectedTotal, paid: expectedPaid, due: expectedDue };
        const ok = await safeUpdate('sales', patch, s.id, `বিক্রয় (মেমো: ${s.memo_no || 'N/A'})`);
        if (ok) { s.total = expectedTotal; s.paid = expectedPaid; s.due = expectedDue; }
      }
    }

    // 3. Fix Customers
    for (const c of DB.customers) {
      const custSalesDue = DB.sales.filter(s => s.customer_id === c.id).reduce((s, x) => s + x.due, 0);
      const custPayments = DB.payments_customer.filter(p => p.customer_id === c.id).reduce((s, x) => s + x.amount, 0);
      const expectedDue = Math.max(0, custSalesDue - custPayments);
      if (Math.abs(Number(c.due || 0) - expectedDue) > 0.01) {
        const ok = await safeUpdate('customers', { due: expectedDue }, c.id, `কাস্টমার '${c.name}'`);
        if (ok) c.due = expectedDue;
      }
    }

    // 4. Fix Suppliers
    for (const s of DB.suppliers) {
      const supPurchasesDue = DB.purchases.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.due, 0);
      const supPayments = DB.payments_supplier.filter(p => p.supplier_id === s.id).reduce((acc, x) => acc + x.amount, 0);
      const expectedDue = Math.max(0, supPurchasesDue - supPayments);
      if (Math.abs(Number(s.due || 0) - expectedDue) > 0.01) {
        const ok = await safeUpdate('suppliers', { due: expectedDue }, s.id, `সাপ্লায়ার '${s.name}'`);
        if (ok) s.due = expectedDue;
      }
    }

    // 5. Fix Product Stock Quantities
    for (const prod of DB.products) {
      let purchasedQty = 0;
      DB.purchases.forEach(p => {
        (p.items || []).forEach(it => { if (it.product_id === prod.id) purchasedQty += Number(it.qty || 0); });
      });
      let soldQty = 0;
      DB.sales.forEach(s => {
        (s.items || []).forEach(it => { if (it.product_id === prod.id) soldQty += Number(it.qty || 0); });
      });
      const expectedQty = Math.max(0, purchasedQty - soldQty);
      if (Number(prod.qty || 0) !== expectedQty) {
        const ok = await safeUpdate('products', { qty: expectedQty }, prod.id, `প্রোডাক্ট '${prod.name}'`);
        if (ok) prod.qty = expectedQty;
      }
    }

    await loadAll({ skipAutoHeal: true }); // fixSyncGuardDiscrepancies is already a full audit+fix pass —
                                            // skip loadAll's own delayed auto-heal so it can't race with this run
    if (window.renderCatalog) window.renderCatalog();
    if (window.renderPurchases) window.renderPurchases();
    if (window.renderSales) window.renderSales();
    if (window.renderLedger) window.renderLedger();
    if (window.renderDashboard) window.renderDashboard();
    if (window.renderBackupAndSyncSettings) window.renderBackupAndSyncSettings();

    // চূড়ান্ত যাচাই: ফিক্সের পর সত্যিই সব ঠিক হয়েছে কিনা আবার অডিট করে নিশ্চিত হও,
    // যাতে মিথ্যা "সফল" বার্তা না দেখায়
    const recheck = runSyncGuardAudit();

    if (failures.length) {
      alert('⚠️ কিছু আইটেম ফিক্স করা যায়নি (সার্ভার প্রত্যাখ্যান করেছে):\n\n' + failures.join('\n') +
            '\n\nসম্ভবত Supabase-এ এই টেবিলগুলোর উপর UPDATE পারমিশন (RLS policy) সীমাবদ্ধ আছে — সেটা চেক করুন।');
    } else if (!recheck.isHealthy) {
      alert('⚠️ ফিক্স চালানো হয়েছে, কিন্তু এখনও ' + recheck.issuesCount + ' টি অমিল থেকে গেছে:\n\n' +
            recheck.issues.join('\n') +
            '\n\nএটি সাধারণত একটি জেনুইন ডেটা এন্ট্রি ভুলের কারণে হয় (যেমন ডুপ্লিকেট প্রোডাক্ট) — উপরের তালিকা দেখে ম্যানুয়ালি চেক করুন।');
    } else {
      alert('🎉 সিঙ্ক গার্ড সফলভাবে সমস্ত ব্যালেন্স ও স্টক রিক্যালকুলেট ও ফিক্স করেছে!');
    }
  } catch (err) {
    alert('ফিক্স করার সময় সমস্যা হয়েছে: ' + err.message);
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
