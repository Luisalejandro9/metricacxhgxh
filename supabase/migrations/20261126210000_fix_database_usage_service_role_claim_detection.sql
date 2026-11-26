CREATE OR REPLACE FUNCTION public.get_database_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'storage'
AS $function$
declare
  v_db_bytes bigint;
  v_storage_bytes bigint;
  v_storage_objects bigint;
  v_db_limit bigint := 524288000;
  v_storage_limit bigint := 1073741824;
  v_history jsonb;
  v_avg_daily_growth numeric;
  v_days_to_80 numeric;
  v_days_to_100 numeric;
begin
  -- Accept both JWT claim accessors used by PostgREST versions.
  if coalesce(nullif(auth.jwt()->>'role', ''), nullif(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     and (auth.uid() is null or not public.is_admin()) then
    raise exception 'Acceso denegado: se requiere un administrador habilitado.'
      using errcode = '42501';
  end if;

  v_db_bytes := pg_database_size(current_database());
  select coalesce(sum((o.metadata->>'size')::bigint),0), count(*)
    into v_storage_bytes, v_storage_objects
    from storage.objects o
    where coalesce(o.metadata->>'size','') ~ '^[0-9]+$';

  insert into public.database_usage_daily(usage_date,database_bytes,storage_bytes,storage_objects,measured_at)
  values(current_date,v_db_bytes,v_storage_bytes,v_storage_objects,now())
  on conflict(usage_date) do update set
    database_bytes=excluded.database_bytes,
    storage_bytes=excluded.storage_bytes,
    storage_objects=excluded.storage_objects,
    measured_at=excluded.measured_at;

  delete from public.database_usage_daily where usage_date < current_date - 90;

  with first_last as (
    select (array_agg(database_bytes order by usage_date))[1] first_bytes,
           (array_agg(database_bytes order by usage_date desc))[1] last_bytes,
           (array_agg(usage_date order by usage_date))[1] first_date,
           (array_agg(usage_date order by usage_date desc))[1] last_date
    from public.database_usage_daily where usage_date >= current_date - 30
  )
  select case when last_date > first_date
    then greatest(0,(last_bytes-first_bytes)::numeric/(last_date-first_date))
    else null end
  into v_avg_daily_growth from first_last;

  if v_avg_daily_growth > 0 then
    v_days_to_80 := greatest(0,((v_db_limit*0.8)-v_db_bytes)::numeric/v_avg_daily_growth);
    v_days_to_100 := greatest(0,(v_db_limit-v_db_bytes)::numeric/v_avg_daily_growth);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',usage_date::text,'database_bytes',database_bytes,
    'storage_bytes',storage_bytes,'storage_objects',storage_objects
  ) order by usage_date),'[]'::jsonb)
  into v_history from public.database_usage_daily where usage_date >= current_date - 30;

  return jsonb_build_object(
    'database_bytes',v_db_bytes,'database_limit_bytes',v_db_limit,
    'database_percent',round(v_db_bytes::numeric/v_db_limit*100,2),
    'storage_bytes',v_storage_bytes,'storage_limit_bytes',v_storage_limit,
    'storage_percent',round(v_storage_bytes::numeric/v_storage_limit*100,2),
    'storage_objects',v_storage_objects,'average_daily_growth_bytes',v_avg_daily_growth,
    'estimated_days_to_80_percent',case when v_days_to_80 is null then null else round(v_days_to_80,1) end,
    'estimated_days_to_100_percent',case when v_days_to_100 is null then null else round(v_days_to_100,1) end,
    'history',v_history,'measured_at',now()
  );
end;
$function$;
