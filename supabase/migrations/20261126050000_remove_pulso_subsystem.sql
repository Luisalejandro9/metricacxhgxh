-- Remove exclusivamente el subsistema histórico de Pulso.
-- Las tablas y RPC fueron creadas por historico_pulso/acumulado_pulso.
drop function if exists public.leer_acumulado_pulso();
drop function if exists public.corregir_fecha_snapshot(text, bigint, date);
drop function if exists public.ingest(text, jsonb, jsonb, jsonb);
drop function if exists public.leer(text);
drop function if exists public.leer();
drop function if exists public.secs(text);
drop table if exists public.metricas;
drop table if exists public.snapshots;
drop table if exists public.settings;
