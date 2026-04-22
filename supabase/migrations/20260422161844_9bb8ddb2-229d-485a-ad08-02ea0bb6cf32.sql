ALTER TABLE public.bre_simulation_runs
  ADD COLUMN IF NOT EXISTS scoring_config_id uuid,
  ADD COLUMN IF NOT EXISTS scoring_config_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS lender_rule_versions_used jsonb;