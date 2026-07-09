do $$
begin
  if to_regclass('public.partidos_api_football_fixture_id_key') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'partidos_api_football_fixture_id_key'
        and conrelid = 'public.partidos'::regclass
    )
  then
    drop index public.partidos_api_football_fixture_id_key;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'partidos_api_football_fixture_id_key'
      and conrelid = 'public.partidos'::regclass
  ) then
    alter table public.partidos
      add constraint partidos_api_football_fixture_id_key
      unique (api_football_fixture_id);
  end if;
end $$;
