create unique index if not exists partidos_import_fallback_identity_key
  on public.partidos ((payload_api->'fallback_identity'->>'key'))
  where payload_api->'fallback_identity'->>'key' is not null;
