-- Additive PostgreSQL JSONB indexes for public.docs to eliminate full-collection scans
-- Safe & idempotent: uses CREATE INDEX IF NOT EXISTS only; makes zero destructive or data-modifying changes.
-- Apply in Supabase SQL Editor (or via supabase db push) when ready.

create index if not exists docs_col_created_idx
  on public.docs (collection, created_at desc);

create index if not exists docs_col_user_id_idx
  on public.docs (collection, (data->>'user_id'))
  where data ? 'user_id';

create index if not exists docs_col_account_id_idx
  on public.docs (collection, (data->>'account_id'))
  where data ? 'account_id';

create index if not exists docs_col_user_email_idx
  on public.docs (collection, lower(data->>'user_email'))
  where data ? 'user_email';

create index if not exists docs_col_customer_email_idx
  on public.docs (collection, lower(data->>'customer_email'))
  where data ? 'customer_email';

create index if not exists docs_col_email_idx
  on public.docs (collection, lower(data->>'email'))
  where data ? 'email';

create index if not exists docs_col_slug_idx
  on public.docs (collection, (data->>'slug'))
  where data ? 'slug';

create index if not exists docs_col_status_idx
  on public.docs (collection, (data->>'status'))
  where data ? 'status';

create index if not exists docs_col_order_id_idx
  on public.docs (collection, (data->>'order_id'))
  where data ? 'order_id';

create index if not exists docs_col_rzp_order_id_idx
  on public.docs (collection, (data->>'razorpay_order_id'))
  where data ? 'razorpay_order_id';

create index if not exists docs_col_rzp_qr_id_idx
  on public.docs (collection, (data->>'razorpay_qr_id'))
  where data ? 'razorpay_qr_id';

create index if not exists docs_col_code_idx
  on public.docs (collection, (data->>'code'))
  where data ? 'code';
