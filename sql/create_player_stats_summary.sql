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
  select
    v_player_id::text as player_id,
    v_surface as surface_used,
    v_tourney as tourney_id,
    v_previous as previous_tourney_id,
    avg(calc.aces_for) filter (where calc.best_of = 3 and calc.aces_for is not null) as aces_best_of_3,
    avg(calc.aces_for) filter (
      where v_surface is not null
        and calc.surface_norm = v_surface
        and calc.aces_for is not null
    ) as aces_same_surface,
    avg(calc.aces_for) filter (
      where v_previous is not null
        and calc.match_tourney_id = v_previous
        and calc.aces_for is not null
    ) as aces_previous_tournament,
    avg(calc.df_for) filter (where calc.best_of = 3 and calc.df_for is not null) as double_faults_best_of_3,
    avg(calc.df_for) filter (
      where v_surface is not null
        and calc.surface_norm = v_surface
        and calc.df_for is not null
    ) as double_faults_same_surface,
    avg(calc.df_for) filter (
      where v_previous is not null
        and calc.match_tourney_id = v_previous
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
      where v_previous is not null
        and calc.match_tourney_id = v_previous
        and calc.aces_for is not null
    ))::integer as sample_aces_previous_tournament,
    (count(calc.df_for) filter (where calc.best_of = 3 and calc.df_for is not null))::integer as sample_double_faults_best_of_3,
    (count(calc.df_for) filter (
      where v_surface is not null
        and calc.surface_norm = v_surface
        and calc.df_for is not null
    ))::integer as sample_double_faults_same_surface,
    (count(calc.df_for) filter (
      where v_previous is not null
        and calc.match_tourney_id = v_previous
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
  from (
    select
      base.best_of,
      base.surface_norm,
      base.tourney_id as match_tourney_id,
      case when base.is_winner then base.w_ace else base.l_ace end as aces_for,
      case when base.is_winner then base.w_df else base.l_df end as df_for,
      case when base.is_winner then base.l_ace else base.w_ace end as aces_against,
      case when base.is_winner then base.l_df else base.w_df end as df_against
    from (
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
    ) as base
  ) as calc;
end;
$$;

grant execute on function public.player_stats_summary(
  numeric,
  text,
  text
) to anon, authenticated, service_role;
