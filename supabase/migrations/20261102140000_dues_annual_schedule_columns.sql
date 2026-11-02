-- New annual collection schedule (opt-in). Existing dues items remain on legacy billing.
-- No existing charges, billing periods, or payments are modified.
ALTER TABLE public.accounting_dues_items
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS amount_per_collection integer,
  ADD COLUMN IF NOT EXISTS annual_count integer,
  ADD COLUMN IF NOT EXISTS collection_months integer[],
  ADD COLUMN IF NOT EXISTS join_leave_rule text;

COMMENT ON COLUMN public.accounting_dues_items.schedule_mode IS
  'legacy = existing monthly amount x cycle logic; annual = amount x annual_count with selected collection months';
COMMENT ON COLUMN public.accounting_dues_items.collection_months IS
  'Calendar months (1-12) selected for annual collections; April-March fiscal order is determined in application code';

ALTER TABLE public.accounting_dues_items
  ADD CONSTRAINT accounting_dues_schedule_mode_check
    CHECK (schedule_mode IN ('legacy', 'annual')),
  ADD CONSTRAINT accounting_dues_annual_config_check
    CHECK (
      schedule_mode = 'legacy'
      OR (
        amount_per_collection IS NOT NULL AND amount_per_collection > 0
        AND annual_count IS NOT NULL AND annual_count BETWEEN 1 AND 12
        AND collection_months IS NOT NULL
        AND cardinality(collection_months) = annual_count
        AND collection_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::integer[]
        AND join_leave_rule IS NOT NULL
        AND join_leave_rule IN ('prorated', 'full')
      )
    );

-- IMPORTANT:
-- - Existing rows default to legacy; no automatic migration to annual.
-- - Duplicate collection months are rejected by application validation.
--   A DB-level uniqueness constraint for integer[] is a future hardening task.
-- - Existing billing generator must branch on schedule_mode before any annual item is activated.
--   Until then, the annual settings UI must not persist schedule_mode='annual'.
