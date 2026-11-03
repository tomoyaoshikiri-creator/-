ALTER TABLE public.accounting_dues_grade_bands ADD COLUMN IF NOT EXISTS yearly_amount numeric;
ALTER TABLE public.accounting_dues_player_settings ADD COLUMN IF NOT EXISTS yearly_amount numeric;
ALTER TABLE public.accounting_dues_grade_bands ADD CONSTRAINT dues_grade_yearly_nonnegative CHECK (yearly_amount IS NULL OR yearly_amount >= 0);
ALTER TABLE public.accounting_dues_player_settings ADD CONSTRAINT dues_player_yearly_nonnegative CHECK (yearly_amount IS NULL OR yearly_amount >= 0);