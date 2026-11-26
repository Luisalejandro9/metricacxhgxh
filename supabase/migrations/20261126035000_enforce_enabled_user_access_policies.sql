create or replace function public.is_enabled_user() returns boolean language sql security definer
set search_path=pg_catalog,public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and is_enabled is true);
$$;
revoke all on function public.is_enabled_user() from public, anon;
grant execute on function public.is_enabled_user() to authenticated;

drop policy if exists "Users can view their own metrics" on public.daily_metrics;
create policy "Enabled users can view own metrics" on public.daily_metrics for select to authenticated
using ((select auth.uid())=user_id and public.is_enabled_user());
drop policy if exists "Admins can view all metrics" on public.daily_metrics;
create policy "Enabled admins can view all metrics" on public.daily_metrics for select to authenticated
using (public.is_admin());
drop policy if exists "Users can insert their own metrics" on public.daily_metrics;
create policy "Enabled users can insert own metrics" on public.daily_metrics for insert to authenticated
with check ((select auth.uid())=user_id and public.is_enabled_user());
drop policy if exists "Users can update their own metrics" on public.daily_metrics;
drop policy if exists "Enabled users can update own metrics" on public.daily_metrics;
create policy "Enabled users can update own metrics" on public.daily_metrics for update to authenticated
using ((select auth.uid())=user_id and public.is_enabled_user())
with check ((select auth.uid())=user_id and public.is_enabled_user());
drop policy if exists "Users can delete their own metrics" on public.daily_metrics;
create policy "Enabled users can delete own metrics" on public.daily_metrics for delete to authenticated
using ((select auth.uid())=user_id and public.is_enabled_user());

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated
using ((select auth.uid())=id);
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles for select to authenticated
using (public.is_admin());
