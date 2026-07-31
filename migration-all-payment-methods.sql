-- ============================================================
-- Migration: সকল লেনদেন ফর্মে পেমেন্ট মাধ্যম যুক্ত করা
-- এই স্ক্রিপ্টটা Supabase-এর SQL Editor-এ রান করুন।
-- ============================================================

alter table expenses add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking'));
alter table expenses add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;

alter table investments add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking'));
alter table investments add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;

alter table advances_customer add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking'));
alter table advances_customer add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;

alter table advances_supplier add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking'));
alter table advances_supplier add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;

alter table payments_customer add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking'));
alter table payments_customer add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;

alter table payments_supplier add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash','bank','mobile_banking'));
alter table payments_supplier add column if not exists payment_account_id uuid references payment_accounts(id) on delete set null;
