-- 1. Pincode master table (source-of-truth, populated via admin CSV import)
create table if not exists public.pincode_master (
  pincode text primary key,
  district text,
  state text,
  tier text,
  source_row_count integer not null default 1,
  has_conflict boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.pincode_master enable row level security;

create policy "Anyone can read pincode master"
  on public.pincode_master for select
  to authenticated
  using (true);

create policy "Admins can manage pincode master"
  on public.pincode_master for all
  using (public.is_admin_or_super(auth.uid()))
  with check (public.is_admin_or_super(auth.uid()));

create index if not exists idx_pincode_master_state on public.pincode_master(state);

-- 2. New columns on student_leads (additive, all nullable / defaulted)
alter table public.student_leads
  add column if not exists district text,
  add column if not exists tier text,
  add column if not exists coapplicant_income_source text,
  add column if not exists whatsapp_same_as_phone boolean not null default false,
  add column if not exists lead_authenticity text not null default 'unverified';

-- Validate authenticity enum via check constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_leads_lead_authenticity_check'
  ) then
    alter table public.student_leads
      add constraint student_leads_lead_authenticity_check
      check (lead_authenticity in ('unverified','genuine','suspicious','flagged'));
  end if;
end$$;