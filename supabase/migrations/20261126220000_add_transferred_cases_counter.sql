ALTER TABLE public.daily_metrics
  ADD COLUMN IF NOT EXISTS cases_transferred integer NOT NULL DEFAULT 0;

ALTER TABLE public.daily_metrics
  DROP CONSTRAINT IF EXISTS daily_metrics_cases_transferred_nonnegative;

ALTER TABLE public.daily_metrics
  ADD CONSTRAINT daily_metrics_cases_transferred_nonnegative
  CHECK (cases_transferred >= 0);