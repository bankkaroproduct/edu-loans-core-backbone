-- Add employability_outlook to universities_master, aligned to BRE active config values (high/medium/low)
ALTER TABLE public.universities_master
  ADD COLUMN IF NOT EXISTS employability_outlook TEXT
  CHECK (employability_outlook IN ('high','medium','low'));