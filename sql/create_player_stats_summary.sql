drop function if exists public.player_stats_summary(numeric, text, text);

create or replace function public.player_stats_summary(
  p_player_id numeric,
  p_surface text default null,
  p_tourney_id text default null
)
returns table (
  player_id text,
  surface_used text,
  tourney_id text,
  previous_tourney_id text,
  aces_best_of_3 numeric,
  aces_same_surface numeric,
  aces_previous_tournament numeric,
  double_faults_best_of_3 numeric,
  double_faults_same_surface numeric,
  double_faults_previous_tournament numeric,
  aces_previous_minus_best_of_3 numeric,
  double_faults_previous_minus_best_of_3 numeric,
  opponent_aces_best_of_3_same_surface numeric,
  opponent_double_faults_best_of_3_same_surface numeric,
  sample_aces_best_of_3 integer,
  sample_aces_same_surface integer,
  sample_aces_previous_tournament integer,
  sample_double_faults_best_of_3 integer,
  sample_double_faults_same_surface integer,
  sample_double_faults_previous_tournament integer,
  sample_opponent_aces_best_of_3_same_surface integer,
  sample_opponent_double_faults_best_of_3_same_surface integer
)
language plpgsql
security definer
set search_path = public, estratego_v1
as $$
declare
  v_player_id numeric;
  v_surface text;
  v_tourney text;
  v_previous text;
  v_previous_candidates text[] := array[]::text[];
  v_suffix text;
  v_year integer;
begin
  if p_player_id is null then
    raise exception 'player_id requerido';
  end if;

  v_player_id := p_player_id;
  v_surface := case
    when p_surface is null then null
    else upper(trim(p_surface))
  end;
  v_tourney := case
    when p_tourney_id is null then null
    else trim(p_tourney_id)
  end;

  if v_tourney ~ '^\d{4}-.+' then
    v_year := substring(v_tourney from 1 for 4)::integer;
    v_suffix := (regexp_match(v_tourney, '^\d{4}-(.+)$'))[1];
    if v_suffix is not null then
      v_previous := (v_year - 1)::text || '-' || v_suffix;
      v_previous_candidates := array[v_previous];
      if v_suffix ~ '^\d+$' then
        v_previous_candidates := array_append(
          v_previous_candidates,
          (v_year - 1)::text || '-' || lpad(v_suffix, 4, '0')
        );
      end if;
      if array_length(v_previous_candidates, 1) > 1 then
        select array_agg(distinct elem)
          into v_previous_candidates
        from unnest(v_previous_candidates) as elem;
      end if;
    else
      v_previous := (v_year - 1)::text || '-' || substring(v_tourney from 5);
      v_previous_candidates := array[v_previous];
    end if;
  else
    v_previous := null;
    v_previous_candidates := array[]::text[];
  end if;

  return query
  with base as (
    select
      m.best_of,
      upper(trim(m.surface)) as surface_norm,
      m.tourney_id,
      m.winner_id = v_player_id as is_winner,
      m.w_ace,
      m.w_df,
      m.l_ace,
      m.l_df
    from matches_full m
    where m.winner_id = v_player_id
       or m.loser_id = v_player_id
  ),
  calc as (
    select
      base.best_of,
      base.surface_norm,
      base.tourney_id as match_tourney_id,
      case when base.is_winner then base.w_ace else base.l_ace end as aces_for,
      case when base.is_winner then base.w_df else base.l_df end as df_for,
      case when base.is_winner then base.l_ace else base.w_ace end as aces_against,
      case when base.is_winner then base.l_df else base.w_df end as df_against
    from base
  ),
  stats as (
    select
      avg(calc.aces_for) filter (where calc.best_of = 3 and calc.aces_for is not null) as aces_best_of_3,
      avg(calc.aces_for) filter (
        where v_surface is not null
          and calc.surface_norm = v_surface
          and calc.aces_for is not null
      ) as aces_same_surface,
      avg(calc.aces_for) filter (
        where array_length(v_previous_candidates, 1) > 0
          and calc.match_tourney_id = any(v_previous_candidates)
          and calc.aces_for is not null
      ) as aces_previous_tournament,
      avg(calc.df_for) filter (where calc.best_of = 3 and calc.df_for is not null) as double_faults_best_of_3,
      avg(calc.df_for) filter (
        where v_surface is not null
          and calc.surface_norm = v_surface
          and calc.df_for is not null
      ) as double_faults_same_surface,
      avg(calc.df_for) filter (
        where array_length(v_previous_candidates, 1) > 0
          and calc.match_tourney_id = any(v_previous_candidates)
          and calc.df_for is not null
      ) as double_faults_previous_tournament,
      avg(calc.aces_against) filter (
        where calc.best_of = 3
          and v_surface is not null
          and calc.surface_norm = v_surface
          and calc.aces_against is not null
      ) as opponent_aces_best_of_3_same_surface,
      avg(calc.df_against) filter (
        where calc.best_of = 3
          and v_surface is not null
          and calc.surface_norm = v_surface
          and calc.df_against is not null
      ) as opponent_double_faults_best_of_3_same_surface,
      (count(calc.aces_for) filter (where calc.best_of = 3 and calc.aces_for is not null))::integer as sample_aces_best_of_3,
      (count(calc.aces_for) filter (
        where v_surface is not null
          and calc.surface_norm = v_surface
          and calc.aces_for is not null
      ))::integer as sample_aces_same_surface,
      (count(calc.aces_for) filter (
        where array_length(v_previous_candidates, 1) > 0
          and calc.match_tourney_id = any(v_previous_candidates)
          and calc.aces_for is not null
      ))::integer as sample_aces_previous_tournament,
      (count(calc.df_for) filter (where calc.best_of = 3 and calc.df_for is not null))::integer as sample_double_faults_best_of_3,
      (count(calc.df_for) filter (
        where v_surface is not null
          and calc.surface_norm = v_surface
          and calc.df_for is not null
      ))::integer as sample_double_faults_same_surface,
      (count(calc.df_for) filter (
        where array_length(v_previous_candidates, 1) > 0
          and calc.match_tourney_id = any(v_previous_candidates)
          and calc.df_for is not null
      ))::integer as sample_double_faults_previous_tournament,
      (count(calc.aces_against) filter (
        where calc.best_of = 3
          and v_surface is not null
          and calc.surface_norm = v_surface
          and calc.aces_against is not null
      ))::integer as sample_opponent_aces_best_of_3_same_surface,
      (count(calc.df_against) filter (
        where calc.best_of = 3
          and v_surface is not null
          and calc.surface_norm = v_surface
          and calc.df_against is not null
      ))::integer as sample_opponent_double_faults_best_of_3_same_surface
    from calc
  )
  select
    v_player_id::text as player_id,
    v_surface as surface_used,
    v_tourney as tourney_id,
    v_previous as previous_tourney_id,
    stats.aces_best_of_3,
    stats.aces_same_surface,
    stats.aces_previous_tournament,
    stats.double_faults_best_of_3,
    stats.double_faults_same_surface,
    stats.double_faults_previous_tournament,
    case
      when stats.aces_previous_tournament is null or stats.aces_best_of_3 is null
      then null
      else stats.aces_previous_tournament - stats.aces_best_of_3
    end as aces_previous_minus_best_of_3,
    case
      when stats.double_faults_previous_tournament is null or stats.double_faults_best_of_3 is null
      then null
      else stats.double_faults_previous_tournament - stats.double_faults_best_of_3
    end as double_faults_previous_minus_best_of_3,
    stats.opponent_aces_best_of_3_same_surface,
    stats.opponent_double_faults_best_of_3_same_surface,
    stats.sample_aces_best_of_3,
    stats.sample_aces_same_surface,
    stats.sample_aces_previous_tournament,
    stats.sample_double_faults_best_of_3,
    stats.sample_double_faults_same_surface,
    stats.sample_double_faults_previous_tournament,
    stats.sample_opponent_aces_best_of_3_same_surface,
    stats.sample_opponent_double_faults_best_of_3_same_surface
  from stats;
end;
$$;

grant execute on function public.player_stats_summary(
  numeric,
  text,
  text
) to anon, authenticated, service_role;

drop function if exists public.tournament_highs_summary(text);

create or replace function public.tournament_highs_summary(
  p_tourney_id text
)
returns table (
  tourney_id text,
  previous_tourney_id text,
  aces_player_id text,
  aces_player_name text,
  aces_value numeric,
  double_faults_player_id text,
  double_faults_player_name text,
  double_faults_value numeric,
  received_aces_player_id text,
  received_aces_player_name text,
  received_aces_value numeric,
  received_double_faults_player_id text,
  received_double_faults_player_name text,
  received_double_faults_value numeric
)
language plpgsql
security definer
set search_path = public, estratego_v1
as $$
declare
  v_tourney text;
  v_previous text;
  v_suffix text;
  v_year integer;
  v_previous_candidates text[] := array[]::text[];
begin
  v_tourney := case
    when p_tourney_id is null then null
    else trim(p_tourney_id)
  end;

  if v_tourney ~ '^\d{4}-.+' then
    v_year := substring(v_tourney from 1 for 4)::integer;
    v_suffix := (regexp_match(v_tourney, '^\d{4}-(.+)$'))[1];
    if v_suffix is not null then
      v_previous := (v_year - 1)::text || '-' || v_suffix;
      v_previous_candidates := array[v_previous];
      if v_suffix ~ '^\d+$' then
        v_previous_candidates := array_append(
          v_previous_candidates,
          (v_year - 1)::text || '-' || lpad(v_suffix, 4, '0')
        );
      end if;
      if array_length(v_previous_candidates, 1) > 1 then
        select array_agg(distinct elem)
          into v_previous_candidates
        from unnest(v_previous_candidates) as elem;
      end if;
    else
      v_previous := (v_year - 1)::text || '-' || substring(v_tourney from 5);
      v_previous_candidates := array[v_previous];
    end if;
  else
    v_previous := null;
    v_previous_candidates := array[]::text[];
  end if;

  return query
  with matches as (
    select
      m.tourney_id,
      m.winner_id,
      m.loser_id,
      m.w_ace,
      m.l_ace,
      m.w_df,
      m.l_df
    from matches_full m
    where array_length(v_previous_candidates, 1) > 0
      and m.tourney_id = any(v_previous_candidates)
  ),
  player_rows as (
    select
      winner_id as player_id,
      w_ace as aces_value,
      w_df as double_faults_value,
      l_ace as received_aces_value,
      l_df as received_double_faults_value
    from matches
    union all
    select
      loser_id as player_id,
      l_ace as aces_value,
      l_df as double_faults_value,
      w_ace as received_aces_value,
      w_df as received_double_faults_value
    from matches
  ),
  decorated as (
    select
      r.player_id,
      p.name as player_name,
      r.aces_value,
      r.double_faults_value,
      r.received_aces_value,
      r.received_double_faults_value
    from player_rows r
    left join players_min p on p.player_id = r.player_id
  ),
  aces as (
    select d.player_id, coalesce(d.player_name, d.player_id::text) as player_name, d.aces_value
    from decorated d
    where d.aces_value is not null
    order by d.aces_value desc
    limit 1
  ),
  double_faults as (
    select d.player_id, coalesce(d.player_name, d.player_id::text) as player_name, d.double_faults_value
    from decorated d
    where d.double_faults_value is not null
    order by d.double_faults_value desc
    limit 1
  ),
  received_aces as (
    select d.player_id, coalesce(d.player_name, d.player_id::text) as player_name, d.received_aces_value
    from decorated d
    where d.received_aces_value is not null
    order by d.received_aces_value desc
    limit 1
  ),
  received_double_faults as (
    select d.player_id, coalesce(d.player_name, d.player_id::text) as player_name, d.received_double_faults_value
    from decorated d
    where d.received_double_faults_value is not null
    order by d.received_double_faults_value desc
    limit 1
  )
  select
    v_tourney as tourney_id,
    v_previous as previous_tourney_id,
    aces.player_id::text as aces_player_id,
    aces.player_name as aces_player_name,
    aces.aces_value::numeric,
    double_faults.player_id::text as double_faults_player_id,
    double_faults.player_name as double_faults_player_name,
    double_faults.double_faults_value::numeric,
    received_aces.player_id::text as received_aces_player_id,
    received_aces.player_name as received_aces_player_name,
    received_aces.received_aces_value::numeric,
    received_double_faults.player_id::text as received_double_faults_player_id,
    received_double_faults.player_name as received_double_faults_player_name,
    received_double_faults.received_double_faults_value::numeric
  from (select 1) dummy
  left join aces on true
  left join double_faults on true
  left join received_aces on true
  left join received_double_faults on true;
end;
$$;

grant execute on function public.tournament_highs_summary(text)
  to anon, authenticated, service_role;
