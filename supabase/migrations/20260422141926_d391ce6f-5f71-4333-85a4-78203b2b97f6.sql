-- Phase 3: BRE activation RPCs
-- Two SECURITY DEFINER functions to atomically activate a version (config or lender rule),
-- flip the prior active version off, update lenders.bre_rule_id where applicable,
-- and write an audit_logs row in the same transaction.
-- The partial unique indexes from Phase 1 already prevent two-active-rows at the DB level;
-- these RPCs make the swap a single transactional step from the client.

create or replace function public.bre_activate_scoring_config(_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_role app_role;
  v_old_id uuid;
  v_old_version integer;
  v_new_version integer;
  v_target_active boolean;
begin
  if not public.is_admin_or_super(auth.uid()) then
    raise exception 'forbidden: admin role required';
  end if;

  select id, role into v_actor, v_role
  from public.users where auth_user_id = auth.uid() limit 1;

  select version_number, is_active into v_new_version, v_target_active
  from public.bre_scoring_configs where id = _id;

  if v_new_version is null then
    raise exception 'scoring config version not found';
  end if;

  -- Capture currently-active row (if any) BEFORE the flip
  select id, version_number into v_old_id, v_old_version
  from public.bre_scoring_configs where is_active = true limit 1;

  if v_old_id is not null and v_old_id <> _id then
    update public.bre_scoring_configs set is_active = false where id = v_old_id;
  end if;

  if not v_target_active then
    update public.bre_scoring_configs set is_active = true where id = _id;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action_type, actor_user_id, actor_role, meta)
  values (
    'bre_scoring_config', _id, 'bre_config_activated', v_actor, v_role,
    jsonb_build_object(
      'new_version', v_new_version,
      'deactivated_id', v_old_id,
      'deactivated_version', v_old_version
    )
  );

  return jsonb_build_object(
    'ok', true,
    'activated_id', _id,
    'activated_version', v_new_version,
    'deactivated_id', v_old_id,
    'deactivated_version', v_old_version
  );
end $$;

create or replace function public.bre_activate_lender_rule(_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_role app_role;
  v_lender uuid;
  v_new_version integer;
  v_old_id uuid;
  v_old_version integer;
  v_target_active boolean;
begin
  if not public.is_admin_or_super(auth.uid()) then
    raise exception 'forbidden: admin role required';
  end if;

  select id, role into v_actor, v_role
  from public.users where auth_user_id = auth.uid() limit 1;

  select lender_id, version_number, is_active
    into v_lender, v_new_version, v_target_active
  from public.bre_lender_rules where id = _id;

  if v_lender is null then
    raise exception 'lender rule version not found';
  end if;

  -- Capture currently-active row for this lender (if any)
  select id, version_number into v_old_id, v_old_version
  from public.bre_lender_rules
  where lender_id = v_lender and is_active = true
  limit 1;

  if v_old_id is not null and v_old_id <> _id then
    update public.bre_lender_rules set is_active = false where id = v_old_id;
  end if;

  if not v_target_active then
    update public.bre_lender_rules set is_active = true where id = _id;
  end if;

  -- Keep lenders.bre_rule_id pointed at the active rule for this lender
  update public.lenders set bre_rule_id = _id, updated_at = now() where id = v_lender;

  insert into public.audit_logs (entity_type, entity_id, action_type, actor_user_id, actor_role, meta)
  values (
    'bre_lender_rule', _id, 'bre_lender_rule_activated', v_actor, v_role,
    jsonb_build_object(
      'lender_id', v_lender,
      'new_version', v_new_version,
      'deactivated_id', v_old_id,
      'deactivated_version', v_old_version
    )
  );

  return jsonb_build_object(
    'ok', true,
    'lender_id', v_lender,
    'activated_id', _id,
    'activated_version', v_new_version,
    'deactivated_id', v_old_id,
    'deactivated_version', v_old_version
  );
end $$;