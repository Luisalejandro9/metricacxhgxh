-- Migración: historico_pulso
-- Descripción: Tablas y funciones RPC para ingesta y lectura de métricas históricas de Pulso.

create table if not exists settings (
  key text primary key,
  value text
);

insert into settings (key, value) values
  ('ingest_token', 'PLACEHOLDER-CARGA'),
  ('view_token',   'PLACEHOLDER-VISTA')
on conflict (key) do nothing;

create table if not exists snapshots (
  id bigserial primary key,
  fecha_hora_carga text not null,
  intervalo text not null,
  responsable text,
  capturado_en timestamptz default now(),
  unique (fecha_hora_carga, intervalo)
);

create table if not exists metricas (
  snapshot_id bigint references snapshots(id) on delete cascade,
  agente text not null,
  cerrados int,
  gestionados int,
  descartados int,
  transferidos int,
  finalizados int,
  cxh numeric,
  gxh numeric,
  pct_cierre numeric,
  working_s int,
  login_s int,
  avail_s int,
  break_s int,
  coaching_s int,
  auxiliares_s int,
  tmo_s int,
  resolucion numeric,
  service_fan int,
  primary key (snapshot_id, agente)
);

-- RLS activado y SIN políticas: nadie accede a las tablas directamente.
alter table settings  enable row level security;
alter table snapshots enable row level security;
alter table metricas  enable row level security;

create or replace function secs(t text) returns int language sql immutable as $$
  select case 
    when t is null or t = '' then null
    else split_part(t,':',1)::int*3600 + split_part(t,':',2)::int*60 + split_part(t,':',3)::int 
  end
$$;

revoke execute on function secs(text) from public, anon;

create or replace function ingest(p_token text, p_info jsonb, p_produ jsonb, p_rel jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare 
  sid bigint; 
  r jsonb; 
  rel jsonb;
begin
  if p_token is distinct from (select value from settings where key='ingest_token') then
    raise exception 'token de carga invalido';
  end if;

  insert into snapshots (fecha_hora_carga, intervalo, responsable)
  values (p_info->>'fecha_hora', p_info->>'intervalo', p_info->>'responsable')
  on conflict do nothing returning id into sid;

  if sid is null then 
    return 'sin cambios (ya estaba guardado)'; 
  end if;

  for r in select * from jsonb_array_elements(p_produ) loop
    continue when r->>'Nombre' = 'TOTAL EQUIPO';
    
    select x into rel from jsonb_array_elements(coalesce(p_rel,'[]'::jsonb)) x
      where x->>'Nombre' = r->>'Nombre' limit 1;

    insert into metricas (
      snapshot_id, agente, cerrados, gestionados, descartados, transferidos,
      finalizados, cxh, gxh, pct_cierre, working_s, login_s, avail_s, break_s, coaching_s,
      auxiliares_s, tmo_s, resolucion, service_fan
    )
    values (
      sid, 
      r->>'Nombre',
      (r->>'Cerrados')::int, 
      (r->>'Gestionados')::int, 
      (r->>'Descartados')::int,
      (r->>'Transferidos')::int, 
      (r->>'Finalizados')::int,
      (r->>'CxH')::numeric, 
      (r->>'GxH')::numeric, 
      (r->>'% Cierre')::numeric,
      secs(r->>'Working'), 
      secs(r->>'Login'), 
      secs(r->>'Avail'), 
      secs(r->>'Break'),
      secs(r->>'Coaching'), 
      secs(r->>'Auxiliares'), 
      secs(r->>'TMO'),
      (rel->>'REL')::numeric, 
      (rel->>'SERVICE')::int
    );
  end loop;

  return 'guardado';
end $$;

create or replace function leer(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_token is distinct from (select value from settings where key='view_token') then
    raise exception 'token de vista invalido';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t)) from (
      select 
        s.fecha_hora_carga, 
        s.intervalo, 
        s.responsable,
        m.*
      from metricas m 
      join snapshots s on s.id = m.snapshot_id
      order by s.id desc 
      limit 5000
    ) t
  ), '[]'::jsonb);
end $$;

