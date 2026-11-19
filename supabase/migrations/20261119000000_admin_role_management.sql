-- Admin role management.
-- Only an enabled administrator can promote/demote another enabled profile.
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
  v_target public.profiles%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Debes iniciar sesión para realizar esta acción.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles actor
    where actor.id = v_actor_id
      and actor.role = 'admin'
      and actor.is_enabled is true
  ) then
    raise exception 'Acceso denegado: solo un administrador habilitado puede cambiar roles.'
      using errcode = '42501';
  end if;

  if p_target_user_id is null then
    raise exception 'Debes seleccionar un perfil.'
      using errcode = '22023';
  end if;

  if p_make_admin is null then
    raise exception 'La acción solicitada no es válida.'
      using errcode = '22023';
  end if;

  if p_target_user_id = v_actor_id then
    raise exception 'No puedes modificar tu propio rol desde esta operación.'
      using errcode = '22023';
  end if;

  update public.profiles
  set role = case when p_make_admin then 'admin' else 'user' end
  where id = p_target_user_id
    and is_enabled is true
  returning * into v_target;

  if not found then
    raise exception 'El perfil no existe o está deshabilitado.'
      using errcode = 'P0002';
  end if;

  return v_target;
end;
$$;

revoke all on function public.set_profile_admin_role(uuid, boolean) from public, anon;
grant execute on function public.set_profile_admin_role(uuid, boolean) to authenticated;

comment on function public.set_profile_admin_role(uuid, boolean)
  is 'Promotes or demotes an enabled profile; caller must be an enabled admin, validated by auth.uid().';
