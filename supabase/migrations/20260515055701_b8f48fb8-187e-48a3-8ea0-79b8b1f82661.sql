-- Update master tier only
UPDATE public.pincode_master pm
SET tier = s.tier
FROM public.pincode_tier_staging s
WHERE pm.pincode = s.pincode
  AND pm.tier IS DISTINCT FROM s.tier;

-- Backfill student_leads.tier only when blank
UPDATE public.student_leads sl
SET tier = s.tier
FROM public.pincode_tier_staging s
WHERE sl.pincode = s.pincode
  AND s.tier IS NOT NULL
  AND (sl.tier IS NULL OR btrim(sl.tier) = '');

DROP TABLE public.pincode_tier_staging;