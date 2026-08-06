-- Migration: discount column-এর জন্য
-- Supabase SQL Editor-এ এই স্ক্রিপ্টটা একবার Run করুন

alter table purchases add column if not exists discount numeric(12,2) not null default 0;
alter table sales add column if not exists discount numeric(12,2) not null default 0;
