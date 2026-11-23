-- Two protected super-admin identities with elevated controls over other admins.

create or replace function public.set_profile_admin_role(
  p_target_user_id uuid,
  p_make_admin boolean
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
    raise exception 'Debes iniciar sesión para realizar esta acción.'
      using errcode = '28000';
  end if;

  select exists (
    select 1 from public.profiles actor
    where actor.id = v_actor_id and actor.role = 'admin' and actor.is_enabled is true
  ) into v_actor_is_admin;

  if not v_actor_is_admin then
    raise exception 'Acceso denegado: solo un administrador habilitado puede cambiar roles.'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.profiles actor
    where actor.id = v_actor_id
      and actor.role = 'admin'
      and actor.is_enabled is true
      and lower(actor.email) in ('luis.acosta@konecta.com', 'lacosta161999@gmail.com')
      and actor.id in (
        '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
        '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
      )
  ) into v_actor_is_super_admin;

  if p_target_user_id is null then
    raise exception 'Debes seleccionar un perfil.' using errcode = '22023';
  end if;
  if p_make_admin is null then
    raise exception 'La acción solicitada no es válida.' using errcode = '22023';
  end if;
  if p_target_user_id = v_actor_id then
    raise exception 'No puedes modificar tu propio rol desde esta operación.' using errcode = '22023';
  end if;

  select * into v_target
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found or v_target.is_enabled is not true then
    raise exception 'El perfil no existe o está deshabilitado.' using errcode = 'P0002';
  end if;

  if v_target.id in (
    '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
    '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
  ) then
    raise exception 'Las cuentas de administrador total están protegidas.' using errcode = '42501';
  end if;

  if v_target.role = 'admin' and not v_actor_is_super_admin then
    raise exception 'Solo los administradores totales pueden modificar el rol de otro administrador.'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = case when p_make_admin then 'admin' else 'user' end
  where id = p_target_user_id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace function public.clear_user_data_and_sessions(target_user_id uuid)
returns boolean
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
    raise exception 'Debes iniciar sesión para realizar esta acción.' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.profiles actor
    where actor.id = v_actor_id and actor.role = 'admin' and actor.is_enabled is true
  ) into v_actor_is_admin;

  if not v_actor_is_admin then
    raise exception 'Acceso denegado: solo los administradores pueden realizar esta acción.'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.profiles actor
    where actor.id = v_actor_id
      and actor.role = 'admin'
      and actor.is_enabled is true
      and lower(actor.email) in ('luis.acosta@konecta.com', 'lacosta161999@gmail.com')
      and actor.id in (
        '1e9fa2df-d9be-43b1-9141-ab78edbd0442'::uuid,
        '921703ad-c1fe-4641-a728-548bf6c6a220'::uuid
      )
  ) into v_actor_is_super_admin;

  if target_user_id is null then
    raise exception 'Debes seleccionar un perfil.' using errcode = '22023';
  end if;
  if target_user_id = v_actor_id then
    raise exception 'No puedes limpiar tu propia cuenta desde esta operación.' using errcode = '22023';
  end if;

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
    raise exception 'Solo los administradores totales pueden limpiar los datos de otro administrador.'
      using errcode = '42501';
  end if;

  delete from public.daily_metrics where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
  delete from auth.sessions where user_id = target_user_id;

  return true;
end;
$$;

revoke all on function public.set_profile_admin_role(uuid, boolean) from public, anon;
grant execute on function public.set_profile_admin_role(uuid, boolean) to authenticated;
revoke all on function public.clear_user_data_and_sessions(uuid) from public, anon;
grant execute on function public.clear_user_data_and_sessions(uuid) to authenticated;

comment on function public.set_profile_admin_role(uuid, boolean)
  is 'Admin role management with two protected super-admin identities; only super-admins can change another admin role.';
comment on function public.clear_user_data_and_sessions(uuid)
  is 'Clears metrics/profile and revokes sessions; only super-admins may target another admin. Super-admin identities are protected.';
