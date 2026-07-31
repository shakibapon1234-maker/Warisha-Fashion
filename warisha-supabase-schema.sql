-- ============================================================
-- Warisha থ্রিপিস — Supabase SQL Schema
-- এই স্ক্রিপ্টটা Supabase প্রজেক্টের SQL Editor-এ পুরোটা কপি-পেস্ট করে
-- Run করলেই সব টেবিল, ইনডেক্স ও নিরাপত্তা (RLS) পলিসি তৈরি হয়ে যাবে।
--
-- নোট: qty / due / advance এই ফিল্ডগুলো অ্যাপ (ফ্রন্টএন্ড) থেকেই
-- হিসাব করে আপডেট করা হয় (এখন যেমন in-memory JS করছে)। এখানে
-- ট্রিগার দেওয়া হয়নি ইচ্ছাকৃতভাবে — অ্যাপের লজিকের সাথে মিলিয়ে
-- সহজ রাখা হয়েছে। ব্যবসা বড় হলে পরে ট্রিগার/ফাংশন দিয়ে এগুলো
-- অটোমেটিক ও আরও নিরাপদ করা যাবে।
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ব্র্যান্ড
-- ------------------------------------------------------------
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- প্রোডাক্ট (প্রতিটা প্রোডাক্ট একটা ব্র্যান্ডের অধীনে)
-- বিক্রয়মূল্য এখানে রাখা হয়নি — সেটা বিক্রয়ের সময় বসে
-- ------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  category text,
  size text,
  color text,
  buy_price numeric(12,2) not null default 0,
  qty integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_products_brand on products(brand_id);

-- ------------------------------------------------------------
-- সাপ্লায়ার / সোর্স (যাদের কাছ থেকে মাল কেনা হয়)
-- due = তাদের কত টাকা বাকি দিতে হবে (payable)
-- advance = তাদের কত টাকা অগ্রিম দেওয়া আছে (asset)
-- ------------------------------------------------------------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  due numeric(12,2) not null default 0,
  advance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- কাস্টমার
-- due = কাস্টমারের কাছে কত টাকা পাওনা (receivable)
-- advance = কাস্টমারের অগ্রিম জমা আছে (liability)
-- ------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  due numeric(12,2) not null default 0,
  advance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_customers_name on customers(name);

-- ------------------------------------------------------------
-- ক্রয় (একটা এন্ট্রি = এক ব্র্যান্ড + এক সোর্স, একাধিক প্রোডাক্ট লাইন)
-- ------------------------------------------------------------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  brand_id uuid not null references brands(id) on delete restrict,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  total numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  due numeric(12,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking')),
  created_at timestamptz not null default now()
);
create index if not exists idx_purchases_brand on purchases(brand_id);
create index if not exists idx_purchases_supplier on purchases(supplier_id);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  name text not null,
  qty integer not null,
  cost numeric(12,2) not null
);
create index if not exists idx_purchase_items_purchase on purchase_items(purchase_id);

-- ------------------------------------------------------------
-- বিক্রয় (পাইকারি/খুচরা)
-- ------------------------------------------------------------
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  sale_type text not null check (sale_type in ('wholesale','retail')),
  customer_id uuid not null references customers(id) on delete restrict,
  total numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  due numeric(12,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking')),
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_customer on sales(customer_id);
create index if not exists idx_sales_type on sales(sale_type);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  name text not null,
  qty integer not null,
  price numeric(12,2) not null
);
create index if not exists idx_sale_items_sale on sale_items(sale_id);

-- ------------------------------------------------------------
-- বকেয়া আদায়/পরিশোধ
-- ------------------------------------------------------------
create table if not exists payments_customer (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_customer_cust on payments_customer(customer_id);

create table if not exists payments_supplier (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_supplier_sup on payments_supplier(supplier_id);

-- ------------------------------------------------------------
-- ইনভেস্টমেন্ট (মালিক/পার্টনারের মূলধন)
-- ------------------------------------------------------------
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  person text not null,
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- অ্যাডভান্স — কাস্টমার ও সাপ্লায়ার আলাদা টেবিল
-- ------------------------------------------------------------
create table if not exists advances_customer (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_advances_customer_cust on advances_customer(customer_id);

create table if not exists advances_supplier (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_advances_supplier_sup on advances_supplier(supplier_id);

-- ------------------------------------------------------------
-- খরচ
-- ------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null,
  note text,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- এই অ্যাপ একজন দোকান-মালিকের জন্য, তাই লগইন করা (authenticated)
-- যেকোনো ইউজারকে সব টেবিলে সম্পূর্ণ অ্যাক্সেস দেওয়া হয়েছে।
-- ভবিষ্যতে স্টাফ/একাধিক ইউজার আলাদা পারমিশন লাগলে policy পরিবর্তন
-- করে নেওয়া যাবে।
-- ============================================================
alter table brands enable row level security;
alter table products enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments_customer enable row level security;
alter table payments_supplier enable row level security;
alter table investments enable row level security;
alter table advances_customer enable row level security;
alter table advances_supplier enable row level security;
alter table expenses enable row level security;

create policy "allow all for authenticated" on brands for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on products for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on suppliers for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on customers for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on purchases for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on purchase_items for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on sales for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on sale_items for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on payments_customer for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on payments_supplier for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on investments for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on advances_customer for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on advances_supplier for all to authenticated using (true) with check (true);
create policy "allow all for authenticated" on expenses for all to authenticated using (true) with check (true);

-- ============================================================
-- (ঐচ্ছিক) সুবিধাজনক ভিউ — ব্র্যান্ড অনুযায়ী মোট স্টক ও ভ্যালু
-- Dashboard/Catalog ট্যাবে সরাসরি এই ভিউ থেকে query করা যাবে
-- ============================================================
create or replace view brand_stock_summary as
select
  b.id as brand_id,
  b.name as brand_name,
  coalesce(sum(p.qty), 0) as total_qty,
  coalesce(sum(p.qty * p.buy_price), 0) as stock_value
from brands b
left join products p on p.brand_id = b.id
group by b.id, b.name;
