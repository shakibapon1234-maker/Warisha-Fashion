-- ============================================================
-- Migration: পেমেন্ট মাধ্যমের একাউন্ট (বিকাশ/নগদ/ব্যাংকের নাম)
-- এই স্ক্রিপ্টটা Supabase-এর SQL Editor-এ রান করুন। আগের migration
-- (migration-payment-method.sql) আগে রান করা থাকতে হবে। এটা আগের
-- ডেটাবেস স্কিমার উপর কাজ করে, কোনো ডেটা মুছে না।
-- ============================================================

-- ইউজার সেটিংস থেকে যেসব একাউন্ট (বিকাশ/নগদ/ডাচ ব্যাংক ইত্যাদি) যোগ
-- করবে সেগুলো এখানে থাকবে।
create table if not exists payment_accounts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bank','mobile_banking')),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_payment_accounts_type_name on payment_accounts(type, lower(name));

alter table payment_accounts enable row level security;

do $$ begin
  create policy "allow all for authenticated" on payment_accounts for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- ক্রয়/বিক্রয়ে নির্দিষ্ট কোন একাউন্টে লেনদেন হয়েছে সেটা রাখার কলাম
alter table purchases add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;
alter table sales add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;
