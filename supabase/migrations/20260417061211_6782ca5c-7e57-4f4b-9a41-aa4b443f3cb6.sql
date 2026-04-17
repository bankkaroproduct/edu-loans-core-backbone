-- 1) Phone normalization function: returns +91XXXXXXXXXX or NULL if invalid
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF _phone IS NULL OR _phone = '' THEN RETURN NULL; END IF;
  digits := regexp_replace(_phone, '[^0-9]', '', 'g');
  -- Strip leading 91 if 12 digits, else require 10 digits
  IF length(digits) = 12 AND substring(digits, 1, 2) = '91' THEN
    digits := substring(digits, 3);
  END IF;
  IF length(digits) <> 10 THEN
    -- Return original (caller can reject); we don't want to break inserts of legacy or non-Indian phones
    RETURN _phone;
  END IF;
  RETURN '+91' || digits;
END;
$$;

-- 2) Trigger function to auto-normalize phone columns on student_leads
CREATE OR REPLACE FUNCTION public.normalize_student_lead_phones()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.student_phone IS NOT NULL THEN
    NEW.student_phone := public.normalize_phone(NEW.student_phone);
  END IF;
  IF NEW.student_whatsapp IS NOT NULL AND NEW.student_whatsapp <> '' THEN
    NEW.student_whatsapp := public.normalize_phone(NEW.student_whatsapp);
  END IF;
  IF NEW.coapplicant_mobile IS NOT NULL AND NEW.coapplicant_mobile <> '' THEN
    NEW.coapplicant_mobile := public.normalize_phone(NEW.coapplicant_mobile);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_student_lead_phones ON public.student_leads;
CREATE TRIGGER trg_normalize_student_lead_phones
BEFORE INSERT OR UPDATE OF student_phone, student_whatsapp, coapplicant_mobile
ON public.student_leads
FOR EACH ROW
EXECUTE FUNCTION public.normalize_student_lead_phones();

-- 3) Backfill existing rows so normalization is consistent
UPDATE public.student_leads
SET student_phone = public.normalize_phone(student_phone)
WHERE student_phone IS NOT NULL
  AND student_phone IS DISTINCT FROM public.normalize_phone(student_phone);

UPDATE public.student_leads
SET student_whatsapp = public.normalize_phone(student_whatsapp)
WHERE student_whatsapp IS NOT NULL AND student_whatsapp <> ''
  AND student_whatsapp IS DISTINCT FROM public.normalize_phone(student_whatsapp);

UPDATE public.student_leads
SET coapplicant_mobile = public.normalize_phone(coapplicant_mobile)
WHERE coapplicant_mobile IS NOT NULL AND coapplicant_mobile <> ''
  AND coapplicant_mobile IS DISTINCT FROM public.normalize_phone(coapplicant_mobile);

-- 4) Indexes:
--    - Non-unique index for fast lookup by phone (used by resolveLead)
CREATE INDEX IF NOT EXISTS idx_student_leads_phone ON public.student_leads (student_phone);

--    - Partial unique index for student-portal-originated leads on (student_phone),
--      preventing the lookup-collision class of bug. Partner leads are intentionally
--      excluded — partners may legitimately re-enter the same student across orgs/intakes,
--      and the partner UI already runs useDuplicateCheck.
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_leads_phone_direct
ON public.student_leads (student_phone)
WHERE source_type = 'student_direct' AND is_archived = false;