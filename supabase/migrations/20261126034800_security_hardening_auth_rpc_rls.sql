-- Security hardening: restrict data grants and privileged RPC execution.
revoke all on table public.profiles, public.daily_metrics, public.metricas, public.snapshots, public.settings, public.app_config from anon;
revoke all on table public.profiles, public.daily_metrics, public.metricas, public.snapshots, public.settings, public.app_config from authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.daily_metrics to authenticated;
grant select, update on table public.app_config to authenticated;

drop policy if exists "Admins can update profiles" on public.profiles;
revoke update, insert, delete, truncate on table public.profiles from anon, authenticated;

drop policy if exists "Allow all for admins" on public.app_config;
create policy "Admins can update app config" on public.app_config for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users can update their own metrics" on public.daily_metrics;
create policy "Users can update their own metrics" on public.daily_metrics for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Allow anon delete to network_incidents" on public.network_incidents;
revoke delete, update, truncate on table public.network_incidents from anon, authenticated;
grant select, insert on table public.network_incidents to anon, authenticated;
grant delete on table public.network_incidents to authenticated;
create policy "Enabled admins can delete network incidents" on public.network_incidents for delete to authenticated
using (public.is_admin());

create or replace function public.is_admin() returns boolean language sql security definer
set search_path = pg_catalog, public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role='admin' and is_enabled is true);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.ensure_own_profile() returns public.profiles language plpgsql security definer
set search_path = pg_catalog, public, auth as $$
declare v_user auth.users%rowtype; v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_user from auth.users where id=auth.uid();
  if not found or v_user.email is null then raise exception 'Authenticated user not found'; end if;
  if lower(v_user.email) not like '%@konecta.com' and lower(v_user.email) not in ('lacosta.develop@gmail.com','lacosta151999@gmail.com') then
    raise exception 'Email domain is not authorized' using errcode='42501';
  end if;
  insert into public.profiles(id,email,role,is_enabled) values(v_user.id,lower(v_user.email),'user',true) on conflict(id) do nothing;
  select * into v_profile from public.profiles where id=v_user.id;
  return v_profile;
end; $$;
revoke all on function public.ensure_own_profile() from public, anon;
grant execute on function public.ensure_own_profile() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.leer(p_token text default null) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Acceso denegado: se requiere un administrador habilitado.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(t)) from (
    select s.fecha_hora_carga,s.intervalo,s.responsable,m.* from public.metricas m
    join public.snapshots s on s.id=m.snapshot_id order by s.id desc limit 5000
  ) t),'[]'::jsonb);
end; $$;
create or replace function public.leer() returns jsonb language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Acceso denegado: se requiere un administrador habilitado.' using errcode='42501'; end if;
  return public.leer(null::text);
end; $$;
revoke all on function public.leer(text), public.leer() from public, anon;
grant execute on function public.leer(text), public.leer() to authenticated;

create or replace function public.leer_acumulado_pulso() returns jsonb language plpgsql security definer
set search_path = pg_catalog, public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Acceso denegado: se requiere un administrador habilitado.' using errcode='42501'; end if;
  with daily as (
    select s.fecha_hora_carga::date dia,(array_agg(s.id order by s.id desc))[1] snapshot_id,
      sum(greatest(0,coalesce(m.gestionados,0)-coalesce(m.transferidos,0)))::bigint gestionados,
      sum(coalesce(m.cerrados,0))::bigint cerrados,sum(coalesce(m.descartados,0))::bigint descartados,
      sum(coalesce(m.service_fan,0))::bigint service_fan,sum(coalesce(m.working_s,0))::bigint working
    from public.snapshots s join public.metricas m on m.snapshot_id=s.id group by s.fecha_hora_carga::date
  ), accumulated as (
    select dia,snapshot_id,
      sum(gestionados) over(order by dia rows between unbounded preceding and current row) gestionados,
      sum(cerrados) over(order by dia rows between unbounded preceding and current row) cerrados,
      sum(descartados) over(order by dia rows between unbounded preceding and current row) descartados,
      sum(service_fan) over(order by dia rows between unbounded preceding and current row) service_fan,
      sum(working) over(order by dia rows between unbounded preceding and current row) working from daily
  )
  select coalesce(jsonb_agg(jsonb_build_object('day',dia::text,'snapshot_id',snapshot_id,'managed',gestionados,'closed',cerrados,
    'discarded',descartados,'serviceFan',service_fan,'working',working,
    'closeRate',case when gestionados>0 then cerrados::numeric/gestionados*100 end,
    'resoRate',case when gestionados>0 then (gestionados-descartados-service_fan)::numeric/gestionados*100 end,
    'gxh',case when working>0 then gestionados::numeric/(working::numeric/3600) end) order by dia desc),'[]'::jsonb)
  into v_result from accumulated;
  return v_result;
end; $$;
revoke all on function public.leer_acumulado_pulso() from public, anon;
grant execute on function public.leer_acumulado_pulso() to authenticated;

create or replace function public.ingest(p_token text,p_info jsonb,p_produ jsonb,p_rel jsonb) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare sid bigint; r jsonb; rel jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Acceso denegado: se requiere un administrador habilitado.' using errcode='42501'; end if;
  if p_token is distinct from (select value from public.settings where key='ingest_token') then raise exception 'token de carga invalido'; end if;
  insert into public.snapshots(fecha_hora_carga,intervalo,responsable) values(p_info->>'fecha_hora',p_info->>'intervalo',p_info->>'responsable')
  on conflict do nothing returning id into sid;
  if sid is null then return 'sin cambios (ya estaba guardado)'; end if;
  for r in select * from jsonb_array_elements(p_produ) loop
    continue when r->>'Nombre'='TOTAL EQUIPO';
    select x into rel from jsonb_array_elements(coalesce(p_rel,'[]'::jsonb)) x where x->>'Nombre'=r->>'Nombre' limit 1;
    insert into public.metricas(snapshot_id,agente,cerrados,gestionados,descartados,transferidos,finalizados,cxh,gxh,pct_cierre,working_s,login_s,avail_s,break_s,coaching_s,auxiliares_s,tmo_s,resolucion,service_fan)
    values(sid,r->>'Nombre',(r->>'Cerrados')::int,(r->>'Gestionados')::int,(r->>'Descartados')::int,(r->>'Transferidos')::int,(r->>'Finalizados')::int,
    (r->>'CxH')::numeric,(r->>'GxH')::numeric,(r->>'% Cierre')::numeric,public.secs(r->>'Working'),public.secs(r->>'Login'),
    public.secs(r->>'Avail'),public.secs(r->>'Break'),public.secs(r->>'Coaching'),public.secs(r->>'Auxiliares'),public.secs(r->>'TMO'),(rel->>'REL')::numeric,(rel->>'SERVICE')::int);
  end loop;
  return 'guardado';
end; $$;
revoke all on function public.ingest(text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.ingest(text,jsonb,jsonb,jsonb) to authenticated;
revoke all on function public.corregir_fecha_snapshot(text,bigint,date) from public, anon, authenticated;
grant execute on function public.corregir_fecha_snapshot(text,bigint,date) to service_role;
revoke all on function public.set_profile_ban_status(uuid,boolean) from public, anon;
grant execute on function public.set_profile_ban_status(uuid,boolean) to authenticated;
alter function public.secs(text) set search_path=pg_catalog,public;
