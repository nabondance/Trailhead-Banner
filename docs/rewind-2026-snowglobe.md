# Trailhead Rewind 2026 — the snow globe

The 2026 Rewind is the 3D snow globe (no poster image this year). It lives at
`/rewind`, opens on **December 1st** (the page shows `RewindWaitingPage` outside
December–January), and `/snowglobe` permanently redirects there.

Outside production (local dev and Vercel preview deployments) `/rewind` is always open, for testing.

## Rewinds-of-2026 counter

Each globe (`POST /api/snowglobe/data`) inserts a row into `rewinds` with
`year = 2026` and `source_env`, via `SupabaseUtils.recordSnowglobeRewind`.
The page counts that year only, per environment, through a 3-argument overload
of `generation_count`. The existing 2-argument function and the broadcast
trigger are untouched: the live broadcast still carries the all-years total,
so the year counter just refetches its own count on each broadcast.

### Migration (run once in the Supabase SQL editor)

```sql
-- Count one Rewind edition (rewinds.year) in one environment. Overload of
-- generation_count(p_table, p_env), written in the same style; PostgREST
-- picks it when p_year is passed. Other tables return null.
create or replace function public.generation_count(p_table text, p_env text, p_year integer)
returns bigint
language sql
stable
security definer
set search_path to ''
as $function$
  select case p_table
    when 'rewinds' then (select count(*) from public.rewinds where source_env = p_env and year = p_year)
  end;
$function$;

revoke all on function public.generation_count(text, text, integer) from public;
grant execute on function public.generation_count(text, text, integer) to anon, authenticated, service_role;
```

Test: `select public.generation_count('rewinds', 'development', 2026);`

Until the migration runs, the year counter's fetch fails and the page shows
the deploy-time fallback (also null), so the counter line stays at 0.
