create policy "Pool records are available through authenticated RPCs only"
on public.pools for all to authenticated
using (false) with check (false);

create policy "Pool memberships are available through authenticated RPCs only"
on public.pool_members for all to authenticated
using (false) with check (false);
