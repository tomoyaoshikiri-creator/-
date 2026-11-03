-- Add the configured dues schedule columns required by the item create/edit UI.
-- Existing items remain in legacy mode; no charges or payments are changed.
ALTER TABLE public.accounting_dues_items
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS rate_basis text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS flat_yearly_amount integer,
  ADD COLUMN IF NOT EXISTS collection_months integer[],
  ADD COLUMN IF NOT EXISTS join_leave_rule text NOT NULL DEFAULT 'prorated';

-- Avoid duplicate constraints when replaying in a partially upgraded environment.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_dues_configured_mode_check'
      AND conrelid = 'public.accounting_dues_items'::regclass
  ) THEN
    ALTER TABLE public.accounting_dues_items
      ADD CONSTRAINT accounting_dues_configured_mode_check
      CHECK (schedule_mode IN ('legacy', 'configured'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_dues_rate_basis_check'
      AND conrelid = 'public.accounting_dues_items'::regclass
  ) THEN
    ALTER TABLE public.accounting_dues_items
      ADD CONSTRAINT accounting_dues_rate_basis_check
      CHECK (rate_basis IN ('monthly', 'yearly'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_dues_join_leave_rule_check'
      AND conrelid = 'public.accounting_dues_items'::regclass
  ) THEN
    ALTER TABLE public.accounting_dues_items
      ADD CONSTRAINT accounting_dues_join_leave_rule_check
      CHECK (join_leave_rule IN ('prorated', 'full'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_dues_collection_months_check'
      AND conrelid = 'public.accounting_dues_items'::regclass
  ) THEN
    ALTER TABLE public.accounting_dues_items
      ADD CONSTRAINT accounting_dues_collection_months_check
      CHECK (
        collection_months IS NULL OR (
          cardinality(collection_months) BETWEEN 1 AND 12
          AND collection_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::integer[]
        )
      );
  END IF;
END $$;
