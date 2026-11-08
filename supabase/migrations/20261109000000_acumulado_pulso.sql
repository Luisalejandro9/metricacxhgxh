create or replace function public.leer_acumulado_pulso()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with daily as (
    select
      s.fecha_hora_carga::date as dia,
      (array_agg(s.id order by s.id desc))[1] as snapshot_id,
      sum(greatest(0, coalesce(m.gestionados,0) - coalesce(m.transferidos,0)))::bigint as gestionados,
      sum(coalesce(m.cerrados,0))::bigint as cerrados,
      sum(coalesce(m.descartados,0))::bigint as descartados,
      sum(coalesce(m.service_fan,0))::bigint as service_fan,
      sum(coalesce(m.working_s,0))::bigint as working
    from public.snapshots s
    join public.metricas m on m.snapshot_id = s.id
    group by s.fecha_hora_carga::date
  ),
  accumulated as (
    select
      dia,snapshot_id,
      sum(gestionados) over (order by dia rows between unbounded preceding and current row) as gestionados,
      sum(cerrados) over (order by dia rows between unbounded preceding and current row) as cerrados,
      sum(descartados) over (order by dia rows between unbounded preceding and current row) as descartados,
      sum(service_fan) over (order by dia rows between unbounded preceding and current row) as service_fan,
      sum(working) over (order by dia rows between unbounded preceding and current row) as working
    from daily
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'day',dia::text,'snapshot_id',snapshot_id,'managed',gestionados,'closed',cerrados,
    'discarded',descartados,'serviceFan',service_fan,'working',working,
    'closeRate',case when gestionados>0 then cerrados::numeric/gestionados*100 end,
    'resoRate',case when gestionados>0 then (gestionados-descartados-service_fan)::numeric/gestionados*100 end,
    'gxh',case when working>0 then gestionados::numeric/(working::numeric/3600) end
  ) order by dia desc),'[]'::jsonb)
  from accumulated;
$$;
revoke all on function public.leer_acumulado_pulso() from public;
grant execute on function public.leer_acumulado_pulso() to anon,authenticated;