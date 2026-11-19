create table public.daily_game_scores (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  game text not null check (game in ('draft-duel', 'roster-rescue')),
  day date not null,
  score integer not null check (game <> 'roster-rescue' or score between 0 and 10000),
  primary key (user_id, game, day)
);

create index daily_game_scores_standings_idx
  on public.daily_game_scores (game, day, score desc, user_id);

alter table public.daily_game_scores enable row level security;
revoke all on public.daily_game_scores from public, anon, authenticated;
grant select, insert on public.daily_game_scores to service_role;
