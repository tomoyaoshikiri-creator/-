-- 共有されたExcelでは立ち幅跳びが小数第1位まで記録されていたため、整数のみだった列を小数対応にする。
alter table public.sports_test_records alter column long_jump_1 type numeric(5,1);
alter table public.sports_test_records alter column long_jump_2 type numeric(5,1);
