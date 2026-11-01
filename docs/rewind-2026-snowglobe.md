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
-- Count one Rewind edition (rewinds.year) in one environment.
-- Overload of generation_count(p_table, p_env); PostgREST picks it when
-- p_year is passed.
create or replace function public.generation_count(p_table text, p_env text, p_year integer)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result bigint;
begin
  if p_table <> 'rewinds' then
    raise exception 'generation_count: year filter is only supported for rewinds';
  end if;
  select count(*) into result
  from public.rewinds
  where source_env = p_env and year = p_year;
  return result;
end;
$$;

revoke all on function public.generation_count(text, text, integer) from public;
grant execute on function public.generation_count(text, text, integer) to anon, authenticated, service_role;
```

Check that `source_env` is the column the existing 2-argument function filters
on; adjust the `where` clause if it differs.

Until the migration runs, the year counter's fetch fails and the page shows
the deploy-time fallback (also null), so the counter line stays at 0.
