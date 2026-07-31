-- ============================================================
-- Migration: ক্রয় ও বিক্রয়ে মেমো নম্বর (memo_no) যোগ করা
-- এই স্ক্রিপ্টটা Supabase-এর SQL Editor-এ রান করুন।
-- ============================================================

alter table purchases add column if not exists memo_no text;
alter table sales add column if not exists memo_no text;
