import { sb } from './supabaseClient.js';
import { setLoading } from './utils.js';

export const DB = {
  brands: [], products: [], suppliers: [], customers: [],
  purchases: [], sales: [], payments_customer: [], payments_supplier: [],
  investments: [], advances_customer: [], advances_supplier: [], expenses: [],
  payment_accounts: [],
};

export function brandName(id) { const b = DB.brands.find(x => x.id === id); return b ? b.name : '-'; }
export function customerName(id) { const c = DB.customers.find(c => c.id === id); return c ? c.name : 'ক্যাশ কাস্টমার'; }
export function supplierName(id) { const s = DB.suppliers.find(s => s.id === id); return s ? s.name : '-'; }
export function paymentAccountName(id) { const a = DB.payment_accounts.find(a => a.id === id); return a ? a.name : ''; }

export async function ensureCustomer(name, phone) {
  if (!name) return null;
  let c = DB.customers.find(c => c.name.trim() === name.trim());
  if (c) return c;
  const { data, error } = await sb.from('customers').insert({ name: name.trim(), phone: phone || '', due: 0, advance: 0 }).select().single();
  if (error) { alert('কাস্টমার তৈরি ব্যর্থ: ' + error.message); throw error; }
  data.due = Number(data.due); data.advance = Number(data.advance);
  DB.customers.push(data);
  return data;
}
export async function ensureSupplier(name) {
  if (!name) return null;
  let s = DB.suppliers.find(s => s.name.trim() === name.trim());
  if (s) return s;
  const { data, error } = await sb.from('suppliers').insert({ name: name.trim(), due: 0, advance: 0 }).select().single();
  if (error) { alert('সাপ্লায়ার তৈরি ব্যর্থ: ' + error.message); throw error; }
  data.due = Number(data.due); data.advance = Number(data.advance);
  DB.suppliers.push(data);
  return data;
}

export async function loadAll() {
  setLoading(true);
  try {
    const [brandsR, productsR, suppliersR, customersR, purchasesR, salesR, pcR, psR, invR, acR, asR, expR, paR] = await Promise.all([
      sb.from('brands').select('*').order('name'),
      sb.from('products').select('*').order('name'),
      sb.from('suppliers').select('*').order('name'),
      sb.from('customers').select('*').order('name'),
      sb.from('purchases').select('*, purchase_items(*)').order('date', { ascending: false }),
      sb.from('sales').select('*, sale_items(*)').order('date', { ascending: false }),
      sb.from('payments_customer').select('*'),
      sb.from('payments_supplier').select('*'),
      sb.from('investments').select('*'),
      sb.from('advances_customer').select('*'),
      sb.from('advances_supplier').select('*'),
      sb.from('expenses').select('*'),
      sb.from('payment_accounts').select('*').order('type').order('name'),
    ]);
    DB.brands = brandsR.data || [];
    DB.products = (productsR.data || []).map(p => ({ ...p, buy_price: Number(p.buy_price), qty: Number(p.qty) }));
    DB.suppliers = (suppliersR.data || []).map(s => ({ ...s, due: Number(s.due), advance: Number(s.advance) }));
    DB.customers = (customersR.data || []).map(c => ({ ...c, due: Number(c.due), advance: Number(c.advance) }));
    DB.purchases = (purchasesR.data || []).map(p => ({
      ...p, memo_no: p.memo_no || '', total: Number(p.total), discount: Number(p.discount || 0), paid: Number(p.paid), due: Number(p.due), payment_method: p.payment_method || 'cash',
      items: (p.purchase_items || []).map(i => ({ product_id: i.product_id, name: i.name, qty: Number(i.qty), cost: Number(i.cost) }))
    }));
    DB.sales = (salesR.data || []).map(s => ({
      ...s, memo_no: s.memo_no || '', total: Number(s.total), discount: Number(s.discount || 0), paid: Number(s.paid), due: Number(s.due), payment_method: s.payment_method || 'cash',
      items: (s.sale_items || []).map(i => ({ product_id: i.product_id, name: i.name, qty: Number(i.qty), price: Number(i.price) }))
    }));
    DB.payments_customer = (pcR.data || []).map(x => ({ ...x, amount: Number(x.amount), payment_method: x.payment_method || 'cash', payment_account_id: x.payment_account_id || null }));
    DB.payments_supplier = (psR.data || []).map(x => ({ ...x, amount: Number(x.amount), payment_method: x.payment_method || 'cash', payment_account_id: x.payment_account_id || null }));
    DB.investments = (invR.data || []).map(x => ({ ...x, amount: Number(x.amount), payment_method: x.payment_method || 'cash', payment_account_id: x.payment_account_id || null }));
    DB.advances_customer = (acR.data || []).map(x => ({ ...x, amount: Number(x.amount), payment_method: x.payment_method || 'cash', payment_account_id: x.payment_account_id || null }));
    DB.advances_supplier = (asR.data || []).map(x => ({ ...x, amount: Number(x.amount), payment_method: x.payment_method || 'cash', payment_account_id: x.payment_account_id || null }));
    DB.expenses = (expR.data || []).map(x => ({ ...x, amount: Number(x.amount), payment_method: x.payment_method || 'cash', payment_account_id: x.payment_account_id || null }));
    DB.payment_accounts = paR.data || [];
    setTimeout(async () => {
      if (window.autoFixBrandProductMismatches) {
        const fixed = await window.autoFixBrandProductMismatches();
        if (fixed) {
          if (window.renderCatalog) window.renderCatalog();
          if (window.renderPurchases) window.renderPurchases();
          if (window.renderDashboard) window.renderDashboard();
        }
      }
      if (window.checkDailyAutoBackup) window.checkDailyAutoBackup();
    }, 500);
  } catch (e) {
    console.error(e); alert('ডেটা লোড করতে সমস্যা হয়েছে: ' + (e.message || e));
  } finally {
    setLoading(false);
  }
}
