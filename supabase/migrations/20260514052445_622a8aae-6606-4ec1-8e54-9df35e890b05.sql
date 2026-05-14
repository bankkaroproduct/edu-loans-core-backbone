CREATE OR REPLACE FUNCTION public.validate_student_lead_score_ranges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ts jsonb := COALESCE(NEW.test_scores, '{}'::jsonb);
  ots jsonb := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.test_scores, '{}'::jsonb) ELSE '{}'::jsonb END;
  v numeric;
  score numeric;
  total numeric;
  pair_changed boolean;
  rec record;
BEGIN
  IF jsonb_typeof(ts) <> 'object' THEN
    RAISE EXCEPTION 'test_scores must be an object';
  END IF;

  -- Optional legacy Marks/GPA column: blank/null allowed, otherwise realistic numeric only.
  IF NEW.marks_gpa IS NOT NULL AND btrim(NEW.marks_gpa) <> '' THEN
    IF btrim(NEW.marks_gpa) !~ '^\d+(\.\d{1,3})?$' THEN
      RAISE EXCEPTION 'Marks / GPA must be a realistic numeric value';
    END IF;
    v := btrim(NEW.marks_gpa)::numeric;
    IF v < 0 OR v > 1000 THEN
      RAISE EXCEPTION 'Marks / GPA must be between 0 and 1000';
    END IF;
  END IF;

  -- Strict format check for every numeric test_scores key we accept (absolute, always runs).
  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(ts) AS e(key, value)
    WHERE key IN (
      'tenth','tenth_total','twelfth','twelfth_total','graduation','graduation_total',
      'highest_qualification_score','highest_qualification_total',
      'ielts','toefl','pte','duolingo','gre','gmat','sat',
      'work_experience_years','coapplicant_age',
      'coapplicant_work_experience_total_years','coapplicant_work_experience_years','coapplicant_work_experience_months'
    )
    AND value IS NOT NULL
    AND btrim(value) <> ''
    AND btrim(value) !~ '^\d+(\.\d{1,3})?$'
  ) THEN
    RAISE EXCEPTION 'Score fields must contain realistic numeric values only';
  END IF;

  -- Academic pairs: absolute range checks always run; cross-field score>total runs only
  -- on INSERT, or on UPDATE when at least one half of THIS pair changed.
  FOR rec IN
    SELECT * FROM (VALUES
      ('tenth','tenth_total'),
      ('twelfth','twelfth_total'),
      ('graduation','graduation_total'),
      ('highest_qualification_score','highest_qualification_total')
    ) AS t(score_key, total_key)
  LOOP
    score := NULLIF(ts->>rec.score_key,'')::numeric;
    total := NULLIF(ts->>rec.total_key,'')::numeric;

    IF score IS NOT NULL AND (score < 0 OR score > 1000) THEN
      RAISE EXCEPTION 'Academic score must be between 0 and 1000';
    END IF;
    IF total IS NOT NULL AND (total <= 0 OR total > 1000) THEN
      RAISE EXCEPTION 'Academic total marks / scale must be greater than 0 and at most 1000';
    END IF;

    IF TG_OP = 'INSERT' THEN
      pair_changed := true;
    ELSE
      pair_changed :=
        COALESCE(ots->>rec.score_key,'') IS DISTINCT FROM COALESCE(ts->>rec.score_key,'')
        OR COALESCE(ots->>rec.total_key,'') IS DISTINCT FROM COALESCE(ts->>rec.total_key,'');
    END IF;

    IF pair_changed THEN
      IF score IS NOT NULL AND total IS NOT NULL AND score > total THEN
        RAISE EXCEPTION 'Score obtained cannot exceed total marks / scale';
      END IF;
      IF score IS NOT NULL AND total IS NULL AND score > 100 THEN
        RAISE EXCEPTION 'Academic score cannot exceed 100 when total marks / scale is not provided';
      END IF;
    END IF;
  END LOOP;

  IF ts ? 'ielts' AND NULLIF(ts->>'ielts','')::numeric NOT BETWEEN 0 AND 9 THEN RAISE EXCEPTION 'IELTS must be between 0 and 9'; END IF;
  IF ts ? 'toefl' AND NULLIF(ts->>'toefl','')::numeric NOT BETWEEN 0 AND 120 THEN RAISE EXCEPTION 'TOEFL must be between 0 and 120'; END IF;
  IF ts ? 'pte' AND NULLIF(ts->>'pte','')::numeric NOT BETWEEN 10 AND 90 THEN RAISE EXCEPTION 'PTE must be between 10 and 90'; END IF;
  IF ts ? 'duolingo' AND NULLIF(ts->>'duolingo','')::numeric NOT BETWEEN 0 AND 160 THEN RAISE EXCEPTION 'Duolingo must be between 0 and 160'; END IF;
  IF ts ? 'gre' AND NULLIF(ts->>'gre','')::numeric NOT BETWEEN 260 AND 340 THEN RAISE EXCEPTION 'GRE must be between 260 and 340'; END IF;
  IF ts ? 'gmat' AND NULLIF(ts->>'gmat','')::numeric NOT BETWEEN 200 AND 800 THEN RAISE EXCEPTION 'GMAT must be between 200 and 800'; END IF;
  IF ts ? 'sat' AND NULLIF(ts->>'sat','')::numeric NOT BETWEEN 400 AND 1600 THEN RAISE EXCEPTION 'SAT must be between 400 and 1600'; END IF;
  IF ts ? 'work_experience_years' AND NULLIF(ts->>'work_experience_years','')::numeric NOT BETWEEN 0 AND 60 THEN RAISE EXCEPTION 'Work experience must be between 0 and 60 years'; END IF;
  IF ts ? 'coapplicant_age' AND NULLIF(ts->>'coapplicant_age','')::numeric NOT BETWEEN 18 AND 100 THEN RAISE EXCEPTION 'Co-applicant age must be between 18 and 100'; END IF;
  IF ts ? 'coapplicant_work_experience_total_years' AND NULLIF(ts->>'coapplicant_work_experience_total_years','')::numeric NOT BETWEEN 0 AND 60 THEN RAISE EXCEPTION 'Co-applicant work experience must be between 0 and 60 years'; END IF;
  IF ts ? 'coapplicant_work_experience_years' AND NULLIF(ts->>'coapplicant_work_experience_years','')::numeric NOT BETWEEN 0 AND 60 THEN RAISE EXCEPTION 'Co-applicant work experience years must be between 0 and 60'; END IF;
  IF ts ? 'coapplicant_work_experience_months' AND NULLIF(ts->>'coapplicant_work_experience_months','')::numeric NOT BETWEEN 0 AND 11 THEN RAISE EXCEPTION 'Co-applicant work experience months must be between 0 and 11'; END IF;

  RETURN NEW;
END;
$function$;