-- Ejecutar en Supabase SQL Editor cuando un partido termine.
-- Primero copia el id desde Table Editor > partidos.

select public.cerrar_partido_manual(
  p_partido_id => 'PEGA_AQUI_EL_ID_DEL_PARTIDO',
  p_goles_local => 2,
  p_goles_visitante => 1
);

-- Si el partido fue cancelado o aplazado sin resultado:
-- select public.cancelar_partido_manual('PEGA_AQUI_EL_ID_DEL_PARTIDO');
