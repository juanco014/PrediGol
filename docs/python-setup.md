# Setup Python en Windows

## Estado detectado

En este equipo no existe `py`, pero `python` y `python3` responden con Python 3.11.9. La ruta detectada actualmente es el alias de WindowsApps/Microsoft Store; funciona para ejecutar scripts, pero para un entorno estable se recomienda instalar Python desde python.org y usar un `.venv` local. El proyecto no depende de rutas absolutas ni instalaciones antiguas de Microsoft Store.

## Directorio unico de ejecucion

Ejecuta los comandos Python desde la raiz del repositorio `PrediGol`, no desde `prediction-service`.

Estructura relevante:

```text
PrediGol/
  requirements.txt
  prediction-service/
    .env (local, no versionado)
    requirements.txt
    pyproject.toml
    predigol_model/
    tests/
  scripts/
  manual-data/
  reports/
  supabase/migrations/
```

`pip install -r requirements.txt` instala dependencias e instala `prediction-service` en modo editable. Asi los scripts de `scripts/` importan `predigol_model` sin configurar `PYTHONPATH` manualmente.

## Crear entorno virtual

Desde la raiz del proyecto en Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Si Windows no reconoce `py`, usa el comando validado en este entorno:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Si `python` no existe, instala Python desde `https://www.python.org/downloads/windows/` y marca la opcion `Add python.exe to PATH`.

## Variables de entorno

Crea `prediction-service/.env` usando `prediction-service/.env.example` como base. El archivo `.env` se lee desde `prediction-service/.env` aunque ejecutes los scripts desde la raiz:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
PREDIGOL_HISTORY_LIMIT=2000
PREDIGOL_UPCOMING_LIMIT=250
PREDIGOL_MIN_HISTORY_MATCHES=30
```

No guardes `SUPABASE_SERVICE_ROLE_KEY` en Vite, navegador ni archivos versionados.

## Verificacion

Desde la raiz:

```powershell
python scripts/verificar_python.py
```

El script muestra version de Python, dependencias, conexion a Supabase si esta configurada, cantidad de historicos, finalizados y predicciones.

## Comandos del modelo

Todos estos comandos se ejecutan desde la raiz del repositorio:

```powershell
python -m unittest discover -s prediction-service/tests
python scripts/diagnostico_modelo_v1.py
python scripts/diagnostico_modelo_v2.py
python scripts/importar_temporada.py manual-data/temporada-ejemplo.csv
python scripts/importar_temporada.py manual-data/temporada-ejemplo.csv --confirm
python scripts/backtest_modelo_v1.py --model V1
python scripts/backtest_modelo_v1.py --model V2
python scripts/backtest_v1_v2.py
python scripts/backtest_v1_v2.py --register
```

Tambien puedes usar el paquete directamente desde la raiz despues de instalar dependencias:

```powershell
python -m predigol_model.run --diagnose --model V1
python -m predigol_model.run --dry-run --model V2
python -m predigol_model.run --backtest --dry-run --model V1
```

## Supabase y seguridad

El frontend usa solo `VITE_SUPABASE_PUBLISHABLE_KEY`. No pongas `SUPABASE_SERVICE_ROLE_KEY` en Vite ni en el navegador.

Los scripts Python usan `SUPABASE_SERVICE_ROLE_KEY` desde `prediction-service/.env`, por lo que deben ejecutarse solo en entorno local/servidor confiable. Las RPC administrativas revisan `predigol_es_admin()` antes de leer o escribir configuracion del modelo y alias.
