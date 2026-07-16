drop policy if exists "profiles_owner_update_safe" on public.profiles;

create policy "profiles_owner_update_personal"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (nombre, username, avatar_url) on public.profiles to authenticated;
