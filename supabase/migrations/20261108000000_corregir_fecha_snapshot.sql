-- Permite a administradores corregir el día de referencia de una carga ya registrada.
-- La hora/intervalo y las métricas de agentes permanecen intactos.
create or replace function corregir_fecha_snapshot(
  p_token text,
  p_snapshot_id bigint,
  p_fecha date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is distinct from (select value from settings where key = 'ingest_token') then
    raise exception 'token de carga invalido';
  end if;

  if p_fecha is null then
    raise exception 'la fecha nueva es obligatoria';
  end if;

  update snapshots
  set fecha_hora_carga = to_char(p_fecha, 'YYYY-MM-DD')
  where id = p_snapshot_id;

  if not found then
    raise exception 'no se encontro la carga indicada';
  end if;

  return 'fecha actualizada';
end;
$$;

revoke execute on function corregir_fecha_snapshot(text, bigint, date) from public, anon;
grant execute on function corregir_fecha_snapshot(text, bigint, date) to authenticated;
