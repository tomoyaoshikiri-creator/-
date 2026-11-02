-- Opt-in fee basis and collection months. Existing items and payments are unchanged.
ALTER TABLE public.accounting_dues_items
  ADD COLUMN IF NOT EXISTS rate_basis text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS collection_months integer[],
  ADD COLUMN IF NOT EXISTS join_leave_rule text NOT NULL DEFAULT 'prorated',
  ADD COLUMN IF NOT EXISTS flat_yearly_amount integer;

ALTER TABLE public.accounting_dues_grade_bands
  ADD COLUMN IF NOT EXISTS yearly_amount integer;

ALTER TABLE public.accounting_dues_player_settings
  ADD COLUMN IF NOT EXISTS yearly_amount integer;

-- Configured schedule is enabled only after the billing generator supports it.
ALTER TABLE public.accounting_dues_items
  ADD CONSTRAINT dues_rate_basis_valid CHECK (rate_basis IN ('monthly', 'yearly')),
  ADD CONSTRAINT dues_schedule_mode_valid CHECK (schedule_mode IN ('legacy', 'configured')),
  ADD CONSTRAINT dues_join_leave_valid CHECK (join_leave_rule IN ('prorated', 'full')),
  ADD CONSTRAINT dues_collection_months_valid CHECK (
    schedule_mode = 'legacy' OR (
      collection_months IS NOT NULL
      AND cardinality(collection_months) BETWEEN 1 AND 12
      AND collection_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::integer[]
    )
  ),
  ADD CONSTRAINT dues_flat_yearly_valid CHECK (flat_yearly_amount IS NULL OR flat_yearly_amount > 0);

-- Existing invoices and receipts are not touched.
