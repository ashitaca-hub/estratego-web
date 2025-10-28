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

  if v_tourney ~ '^[0-9]{4}-.+' then
    v_previous :=
      ((substring(v_tourney from 1 for 4)::integer - 1)::text) ||
      substring(v_tourney from 5);
  else
    v_previous := null;
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
      best_of,
      surface_norm,
      tourney_id,
      case when is_winner then w_ace else l_ace end as aces_for,
      case when is_winner then w_df else l_df end as df_for,
      case when is_winner then l_ace else w_ace end as aces_against,
      case when is_winner then l_df else w_df end as df_against
    from base
  )
  select
    v_player_id::text,
    v_surface,
    v_tourney,
    v_previous,
    avg(aces_for) filter (where best_of = 3 and aces_for is not null),
    avg(aces_for) filter (where v_surface is not null and surface_norm = v_surface and aces_for is not null),
    avg(aces_for) filter (where v_previous is not null and calc.tourney_id = v_previous and aces_for is not null),
    avg(df_for) filter (where best_of = 3 and df_for is not null),
    avg(df_for) filter (where v_surface is not null and surface_norm = v_surface and df_for is not null),
    avg(df_for) filter (where v_previous is not null and calc.tourney_id = v_previous and df_for is not null),
    avg(aces_against) filter (
      where best_of = 3
        and v_surface is not null
        and surface_norm = v_surface
        and aces_against is not null
    ),
    avg(df_against) filter (
      where best_of = 3
        and v_surface is not null
        and surface_norm = v_surface
        and df_against is not null
    ),
    count(aces_for) filter (where best_of = 3 and aces_for is not null),
    count(aces_for) filter (where v_surface is not null and surface_norm = v_surface and aces_for is not null),
    count(aces_for) filter (where v_previous is not null and calc.tourney_id = v_previous and aces_for is not null),
    count(df_for) filter (where best_of = 3 and df_for is not null),
    count(df_for) filter (where v_surface is not null and surface_norm = v_surface and df_for is not null),
    count(df_for) filter (where v_previous is not null and calc.tourney_id = v_previous and df_for is not null),
    count(aces_against) filter (
      where best_of = 3
        and v_surface is not null
        and surface_norm = v_surface
        and aces_against is not null
    ),
    count(df_against) filter (
      where best_of = 3
        and v_surface is not null
        and surface_norm = v_surface
        and df_against is not null
    );
end;
$$;

grant execute on function public.player_stats_summary(
  numeric,
  text,
  text
) to anon, authenticated, service_role;
