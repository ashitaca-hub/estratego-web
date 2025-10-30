-- sql/create_prematch_metric_weights_api.sql
-- Expone funciones seguras en el esquema public para leer/escribir
-- los pesos de estratego_v1.prematch_metric_weights desde Supabase.

begin;

create schema if not exists estratego_v1;

create or replace function public.prematch_metric_weights_get()
returns table(metric text, weight numeric)
language sql
security definer
set search_path to estratego_v1, public
as $$
  select
    trim(metric)::text as metric,
    weight::numeric as weight
  from estratego_v1.prematch_metric_weights
  order by metric;
$$;

create or replace function public.prematch_metric_weights_upsert(p_weights jsonb)
returns integer
language plpgsql
security definer
set search_path = public, estratego_v1
as $$
declare
  affected integer := 0;
begin
  if p_weights is null or jsonb_typeof(p_weights) <> 'array' then
    raise exception 'p_weights must be a JSON array';
  end if;

  with upsert as (
    insert into estratego_v1.prematch_metric_weights (metric, weight)
    select
      trim(w.metric)::text,
      w.weight::numeric
    from jsonb_to_recordset(p_weights) as w(metric text, weight numeric)
    where trim(w.metric) <> ''
    on conflict (metric) do update
      set weight = excluded.weight
    returning 1
  )
  select count(*) into affected from upsert;

  return coalesce(affected, 0);
end;
$$;

grant execute on function public.prematch_metric_weights_get() to anon, authenticated, service_role;
grant execute on function public.prematch_metric_weights_upsert(jsonb) to service_role;

commit;
