create or replace view public.leaderboard_points
with (security_invoker = true)
as
select
  p.user_id,
  coalesce(pr.display_name, 'Player') as display_name,
  count(*)::integer as picks_made,
  count(*) filter (where g.status = 'final')::integer as final_picks,
  count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id)::integer as correct,
  0::integer as upsets,
  (count(*) + count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id) +
    count(*) filter (where pp.game_id is not null and g.status = 'final' and p.picked_team_id = g.winner_team_id))::integer as points,
  case
    when count(*) filter (where g.status = 'final') = 0 then 0::numeric
    else round(
      100.0 * count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id)
      / count(*) filter (where g.status = 'final'),
      1
    )
  end as accuracy
from public.picks p
left join public.profiles pr on pr.user_id = p.user_id
join public.games g on g.id = p.game_id
left join public.pretzel_picks pp on pp.user_id = p.user_id and pp.season = g.season and pp.week = g.week and pp.game_id = g.id and (pp.underdog_team_id is null or pp.underdog_team_id = p.picked_team_id)
where g.kickoff_at <= now()
group by p.user_id, pr.display_name;
