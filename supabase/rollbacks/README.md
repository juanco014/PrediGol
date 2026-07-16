# Supabase Rollbacks Manuales

Los archivos en este directorio son rollbacks manuales y no forman parte de la cadena automatica de migraciones.

Son scripts destructivos: pueden eliminar funciones, indices, columnas o tablas. No deben ejecutarse sin revisar primero el entorno, el estado de datos y el objetivo del rollback.

Nunca deben ejecutarse accidentalmente contra produccion.
