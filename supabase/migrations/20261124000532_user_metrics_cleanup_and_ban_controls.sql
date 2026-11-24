create or replace function public.clear_user_metrics(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_actor_is_super_admin boolean := false;
  v_target public.profiles%rowtype;
  v_deleted integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin' and is_enabled is true
  ) into v_actor_is_admin;
  if not v_actor_is_admin then
    raise exception 'Solo un administrador habilitado puede limpiar métricas.' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_actor_id
      and role = 'admin'
      and is_enabled is true
      and lower(email) in ('luis.acosta@konecta.com', 'lacosta161999@gmail.com')
      and id in (
        '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
        '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
      )
  ) into v_actor_is_super_admin;

  select * into v_target
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'El perfil seleccionado no existe.' using errcode = 'P0002';
  end if;

  if v_target.id in (
    '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
    '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
  ) then
    raise exception 'Las cuentas de administrador total están protegidas.' using errcode = '42501';
  end if;

  if v_target.role = 'admin' and not v_actor_is_super_admin then
    raise exception 'Solo los administradores totales pueden limpiar métricas de otro administrador.'
      using errcode = '42501';
  end if;

  delete from public.daily_metrics where user_id = target_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.set_profile_ban_status(
  p_target_user_id uuid,
  p_banned boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_actor_is_super_admin boolean := false;
  v_target public.profiles%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin' and is_enabled is true
  ) into v_actor_is_admin;
  if not v_actor_is_admin then
    raise exception 'Solo un administrador habilitado puede gestionar baneos.' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_actor_id
      and role = 'admin'
      and is_enabled is true
      and lower(email) in ('luis.acosta@konecta.com', 'lacosta161999@gmail.com')
      and id in (
        '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
        '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
      )
  ) into v_actor_is_super_admin;

  if p_target_user_id is null or p_banned is null then
    raise exception 'La acción solicitada no es válida.' using errcode = '22023';
  end if;
  if p_target_user_id = v_actor_id then
    raise exception 'No puedes banear ni desbanear tu propia cuenta.' using errcode = '42501';
  end if;

  select * into v_target
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'El perfil seleccionado no existe.' using errcode = 'P0002';
  end if;

  if v_target.id in (
    '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
    '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
  ) then
    raise exception 'Las cuentas de administrador total están protegidas.' using errcode = '42501';
  end if;

  if v_target.role = 'admin' and not v_actor_is_super_admin then
    raise exception 'Solo los administradores totales pueden banear o desbanear a otro administrador.'
      using errcode = '42501';
  end if;

  update public.profiles
  set is_enabled = not p_banned
  where id = p_target_user_id
  returning * into v_target;

  if p_banned then
    delete from auth.sessions where user_id = p_target_user_id;
  end if;

  return v_target;
end;
$$;

revoke all on function public.clear_user_metrics(uuid) from public, anon;
grant execute on function public.clear_user_metrics(uuid) to authenticated;
revoke all on function public.set_profile_ban_status(uuid, boolean) from public, anon;
grant execute on function public.set_profile_ban_status(uuid, boolean) to authenticated;

comment on function public.clear_user_metrics(uuid)
  is 'Deletes a user daily metrics only, preserving their profile and all active sessions.';
comment on function public.set_profile_ban_status(uuid, boolean)
  is 'Enables/disables an app profile; banning revokes refreshable sessions. Protected super-admin accounts cannot be banned.';
