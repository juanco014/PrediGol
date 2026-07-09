-- Ejecutar en Supabase SQL Editor.
-- Cambia equipos, torneo y fecha antes de ejecutar.
-- Las fechas quedan en zona horaria de Colombia (-05:00).

select public.crear_partido_manual(
  p_torneo => 'Liga BetPlay',
  p_fecha_orden => '2026-07-01 19:00:00-05',
  p_local_nombre => 'Equipo Local',
  p_visitante_nombre => 'Equipo Visitante',
  p_local_corto => 'LOC',
  p_visitante_corto => 'VIS',
  p_temporada => 2026,
  p_ronda => 'Fecha 1',
  p_fuente_detalle => 'cargado manualmente'
);

select public.crear_partido_manual(
  p_torneo => 'Copa Libertadores',
  p_fecha_orden => '2026-07-02 20:30:00-05',
  p_local_nombre => 'Otro Local',
  p_visitante_nombre => 'Otro Visitante',
  p_local_corto => 'OTL',
  p_visitante_corto => 'OTV',
  p_temporada => 2026,
  p_ronda => 'Octavos',
  p_fuente_detalle => 'cargado manualmente'
);
