-- ============================================================
-- Migration: পেমেন্ট মাধ্যম (ক্যাশ / ব্যাংক / মোবাইল ব্যাংকিং)
-- এই স্ক্রিপ্টটা Supabase-এর SQL Editor-এ রান করুন। এটা আগের
-- ডেটাবেস স্কিমার উপর কাজ করে, কোনো ডেটা মুছে না।
-- ============================================================

alter table purchases
  add column if not exists payment_method text not null default 'cash'
  check (payment_method in ('cash','bank','mobile_banking'));

alter table sales
  add column if not exists payment_method text not null default 'cash'
  check (payment_method in ('cash','bank','mobile_banking'));

-- পুরনো সব রো ডিফল্ট হিসেবে 'cash' পাবে (উপরের default দিয়েই হয়ে যায়,
-- তাও নিশ্চিত করার জন্য explicit আপডেট):
update purchases set payment_method = 'cash' where payment_method is null;
update sales set payment_method = 'cash' where payment_method is null;
