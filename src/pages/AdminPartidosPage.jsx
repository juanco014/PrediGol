import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  Pencil,
  RefreshCw,
  Save,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useProfile } from "../hooks/useProfile";

const formularioInicial = {
  torneo: "Liga BetPlay",
  fecha: "",
  local: "",
  visitante: "",
  localCorto: "",
  visitanteCorto: "",
  temporada: new Date().getFullYear(),
  ronda: "",
};

const apiFootballInicial = {
  mode: "range",
  season: "2024",
  from: "2024-08-01",
  to: "2024-08-31",
  limit: "15",
};

const MINIMO_HISTORICOS_MODELO = 30;

const mesesHistoricos = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fechaLocalAIso(fechaLocal) {
  if (!fechaLocal) {
    return "";
  }

  return new Date(fechaLocal).toISOString();
}

function fechaAInputLocal(fecha) {
  if (!fecha) {
    return "";
  }

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function etiquetaAccionImportacion(action) {
  if (action === "created") return "Nuevo";
  if (action === "updated") return "Actualiza";
  if (action === "skipped") return "Omitido";
  return "Error";
}

function obtenerRangoMesHistorico(yearValue, monthValue) {
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  const monthText = String(month).padStart(2, "0");
  const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, "0");

  return {
    from: `${year}-${monthText}-01`,
    to: `${year}-${monthText}-${lastDay}`,
  };
}

function AdminPartidosPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const { profile, loadingProfile } = useProfile(usuarioId);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [partidos, setPartidos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState({});
  const [filtroPartidos, setFiltroPartidos] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetCsvText, setSheetCsvText] = useState("");
  const [sheetCsvFileName, setSheetCsvFileName] = useState("");
  const [importandoSheet, setImportandoSheet] = useState(false);
  const [previsualizandoSheet, setPrevisualizandoSheet] = useState(false);
  const [previewSheet, setPreviewSheet] = useState(null);
  const [previewSheetUrl, setPreviewSheetUrl] = useState("");
  const [syncConfig, setSyncConfig] = useState(null);
  const [guardandoSync, setGuardandoSync] = useState(false);
  const [sincronizandoAhora, setSincronizandoAhora] = useState(false);
  const [ediciones, setEdiciones] = useState({});
  const [apiFootball, setApiFootball] = useState(apiFootballInicial);
  const [sincronizandoApi, setSincronizandoApi] = useState(false);
  const [resultadoApiFootball, setResultadoApiFootball] = useState(null);
  const [resumenDatos, setResumenDatos] = useState(null);
  const [cargandoResumenDatos, setCargandoResumenDatos] = useState(false);
  const [historicoBatch, setHistoricoBatch] = useState({ year: "2024", month: "8" });

  const esAdmin = profile?.rol === "admin" || Boolean(profile?.es_admin);

  const resumenPartidos = useMemo(
    () => ({
      total: partidos.length,
      relevantes: partidos.filter((partido) => partido.es_relevante).length,
      ocultos: partidos.filter((partido) => !partido.es_relevante).length,
      proximos: partidos.filter((partido) => partido.estado === "proximo").length,
      enVivo: partidos.filter((partido) => partido.estado === "en_vivo").length,
      finalizados: partidos.filter((partido) => partido.estado === "finalizado").length,
    }),
    [partidos]
  );

  const opcionesFiltro = useMemo(
    () => [
      { id: "todos", label: "Todos", cantidad: resumenPartidos.total },
      { id: "relevantes", label: "Relevantes", cantidad: resumenPartidos.relevantes },
      { id: "ocultos", label: "Ocultos", cantidad: resumenPartidos.ocultos },
      { id: "proximos", label: "Proximos", cantidad: resumenPartidos.proximos },
      { id: "en_vivo", label: "En vivo", cantidad: resumenPartidos.enVivo },
      { id: "finalizados", label: "Finalizados", cantidad: resumenPartidos.finalizados },
    ],
    [resumenPartidos]
  );

  const partidosFiltrados = useMemo(() => {
    const terminoBusqueda = normalizarTexto(busqueda);

    return partidos.filter((partido) => {
      const coincideFiltro =
        filtroPartidos === "todos" ||
        (filtroPartidos === "relevantes" && partido.es_relevante) ||
        (filtroPartidos === "ocultos" && !partido.es_relevante) ||
        partido.estado === filtroPartidos;

      if (!coincideFiltro) {
        return false;
      }

      if (!terminoBusqueda) {
        return true;
      }

      const textoPartido = normalizarTexto(
        [
          partido.torneo,
          partido.local_nombre,
          partido.visitante_nombre,
          partido.estado,
          partido.origen_datos,
          partido.fuente_detalle,
        ].join(" ")
      );

      return textoPartido.includes(terminoBusqueda);
    });
  }, [busqueda, filtroPartidos, partidos]);

  const partidosOrdenados = useMemo(
    () =>
      [...partidosFiltrados].sort(
        (a, b) => new Date(a.fecha_orden).getTime() - new Date(b.fecha_orden).getTime()
      ),
    [partidosFiltrados]
  );

  const fuenteImportacionSheet = useMemo(() => {
    if (sheetCsvText) {
      return {
        key: `csv:${sheetCsvFileName}:${sheetCsvText.length}`,
        type: "csv",
        value: sheetCsvText,
        label: sheetCsvFileName || "archivo CSV local",
      };
    }

    return {
      key: sheetUrl.trim(),
      type: "url",
      value: sheetUrl.trim(),
      label: sheetUrl.trim(),
    };
  }, [sheetCsvFileName, sheetCsvText, sheetUrl]);

  const estadoDatosMvp = useMemo(() => {
    if (!resumenDatos) {
      return {
        className: "admin-data-health-neutral",
        texto: "Calculando salud de datos del MVP.",
      };
    }

    if (resumenDatos.error) {
      return {
        className: "admin-data-health-warning",
        texto: resumenDatos.error,
      };
    }

    if (resumenDatos.listoModelo && resumenDatos.faltanPredicciones === 0) {
      return {
        className: "admin-data-health-ready",
        texto: "Modelo listo: los partidos proximos relevantes ya tienen prediccion guardada.",
      };
    }

    if (resumenDatos.listoModelo) {
      return {
        className: "admin-data-health-ready",
        texto: `Modelo listo para ejecutar: faltan ${resumenDatos.faltanPredicciones} predicciones por guardar.`,
      };
    }

    if (resumenDatos.faltanHistoricos > 0) {
      return {
        className: "admin-data-health-warning",
        texto: `Faltan ${resumenDatos.faltanHistoricos} partidos finalizados con marcador para entrenar el modelo.`,
      };
    }

    return {
      className: "admin-data-health-warning",
      texto: "Falta al menos un partido proximo marcado como relevante para generar predicciones visibles.",
    };
  }, [resumenDatos]);

  const cargarPartidos = useCallback(async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from("partidos")
      .select(
        `
          id,
          torneo,
          fecha_texto,
          fecha_orden,
          local_nombre,
          visitante_nombre,
          local_corto,
          visitante_corto,
          estado,
          goles_local_final,
          goles_visitante_final,
          temporada,
          ronda,
          origen_datos,
          fuente_detalle,
          es_relevante,
          prioridad_visual
        `
      )
      .order("fecha_orden", { ascending: false })
      .limit(120);

    if (error) {
      setMensaje(error.message || "No fue posible cargar partidos.");
      setCargando(false);
      return;
    }

    setPartidos(data || []);
    setCargando(false);
  }, []);

  const cargarResumenDatos = useCallback(async () => {
    setCargandoResumenDatos(true);

    const [respuestaPartidos, respuestaPredicciones] = await Promise.all([
      supabase
        .from("partidos")
        .select(
          `
            id,
            estado,
            origen_datos,
            es_relevante,
            goles_local_final,
            goles_visitante_final,
            api_football_fixture_id
          `
        )
        .limit(3000),
      supabase
        .from("model_predictions")
        .select("api_football_fixture_id,confidence,generated_at")
        .order("generated_at", { ascending: false })
        .limit(3000),
    ]);

    if (respuestaPartidos.error) {
      setResumenDatos({
        error: respuestaPartidos.error.message || "No fue posible calcular la salud de datos.",
      });
      setCargandoResumenDatos(false);
      return;
    }

    const filas = respuestaPartidos.data || [];
    const predicciones = respuestaPredicciones.error ? [] : respuestaPredicciones.data || [];
    const fixturesConPrediccion = new Set(
      predicciones
        .map((prediccion) => prediccion.api_football_fixture_id)
        .filter((fixtureId) => fixtureId !== null && fixtureId !== undefined)
    );
    const historicosEntrenables = filas.filter(
      (partido) =>
        partido.estado === "finalizado" &&
        partido.goles_local_final !== null &&
        partido.goles_visitante_final !== null
    ).length;
    const proximosRelevantesLista = filas.filter(
      (partido) =>
        partido.estado === "proximo" &&
        partido.es_relevante &&
        partido.api_football_fixture_id !== null
    );
    const proximosRelevantes = proximosRelevantesLista.length;
    const proximosConPrediccion = proximosRelevantesLista.filter((partido) =>
      fixturesConPrediccion.has(partido.api_football_fixture_id)
    ).length;
    const faltanHistoricos = Math.max(MINIMO_HISTORICOS_MODELO - historicosEntrenables, 0);
    const confianzaPromedio =
      predicciones.length > 0
        ? predicciones.reduce((total, prediccion) => total + Number(prediccion.confidence || 0), 0) /
          predicciones.length
        : 0;

    setResumenDatos({
      total: filas.length,
      finalizados: filas.filter((partido) => partido.estado === "finalizado").length,
      historicosEntrenables,
      proximosRelevantes,
      apiFootball: filas.filter((partido) => partido.origen_datos === "api_football").length,
      googleSheets: filas.filter((partido) => partido.origen_datos === "google_sheets").length,
      manuales: filas.filter((partido) => !partido.origen_datos || partido.origen_datos === "manual")
        .length,
      prediccionesGuardadas: predicciones.length,
      proximosConPrediccion,
      faltanPredicciones: Math.max(proximosRelevantes - proximosConPrediccion, 0),
      ultimaPrediccion: predicciones[0]?.generated_at ?? null,
      confianzaPromedio,
      prediccionesError: respuestaPredicciones.error?.message ?? null,
      faltanHistoricos,
      listoModelo: faltanHistoricos === 0 && proximosRelevantes > 0,
    });
    setCargandoResumenDatos(false);
  }, []);

  const actualizarDatosAdmin = useCallback(async () => {
    await Promise.all([cargarPartidos(), cargarResumenDatos()]);
  }, [cargarPartidos, cargarResumenDatos]);

  const cargarSyncConfig = useCallback(async () => {
    const { data, error } = await supabase.rpc("obtener_google_sheet_sync_config");

    if (error) {
      setMensaje(error.message || "No fue posible cargar la sincronizacion automatica.");
      return;
    }

    setSyncConfig(data);

    if (data?.csv_url) {
      setSheetUrl((actual) => actual || data.csv_url);
    }
  }, []);

  useEffect(() => {
    if (!loadingProfile && esAdmin) {
      const temporizador = window.setTimeout(() => {
        actualizarDatosAdmin();
        cargarSyncConfig();
      }, 0);

      return () => {
        window.clearTimeout(temporizador);
      };
    }

    return undefined;
  }, [loadingProfile, esAdmin, actualizarDatosAdmin, cargarSyncConfig]);

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const crearPartido = async (event) => {
    event.preventDefault();
    setProcesando(true);
    setMensaje("");

    const { error } = await supabase.rpc("crear_partido_manual", {
      p_torneo: formulario.torneo,
      p_fecha_orden: fechaLocalAIso(formulario.fecha),
      p_local_nombre: formulario.local,
      p_visitante_nombre: formulario.visitante,
      p_local_corto: formulario.localCorto || null,
      p_visitante_corto: formulario.visitanteCorto || null,
      p_temporada: Number(formulario.temporada) || null,
      p_ronda: formulario.ronda || null,
      p_fuente_detalle: "panel admin",
    });

    if (error) {
      setMensaje(error.message || "No fue posible crear el partido.");
      setProcesando(false);
      return;
    }

    setFormulario(formularioInicial);
    setMensaje("Partido creado correctamente.");
    setProcesando(false);
    await actualizarDatosAdmin();
  };

  const actualizarResultado = (partidoId, campo, valor) => {
    setResultados((actual) => ({
      ...actual,
      [partidoId]: {
        ...actual[partidoId],
        [campo]: valor,
      },
    }));
  };

  const cerrarPartido = async (partidoId) => {
    const resultado = resultados[partidoId] || {};
    const golesLocal = Number(resultado.local);
    const golesVisitante = Number(resultado.visitante);

    if (!Number.isInteger(golesLocal) || !Number.isInteger(golesVisitante)) {
      setMensaje("Ingresa un resultado valido antes de cerrar.");
      return;
    }

    const confirmar = window.confirm(
      `Vas a cerrar este partido con marcador ${golesLocal}-${golesVisitante}. Esta accion bloqueara nuevos pronosticos.`
    );

    if (!confirmar) {
      return;
    }

    setProcesando(true);
    setMensaje("");

    const { error } = await supabase.rpc("cerrar_partido_manual", {
      p_partido_id: String(partidoId),
      p_goles_local: golesLocal,
      p_goles_visitante: golesVisitante,
    });

    if (error) {
      setMensaje(error.message || "No fue posible cerrar el partido.");
      setProcesando(false);
      return;
    }

    setMensaje("Resultado guardado correctamente.");
    setProcesando(false);
    await actualizarDatosAdmin();
  };

  const cancelarPartido = async (partidoId) => {
    const confirmar = window.confirm(
      "Vas a cancelar este partido. Se ocultara como partido jugable y no aceptara nuevos pronosticos."
    );

    if (!confirmar) {
      return;
    }

    setProcesando(true);
    setMensaje("");

    const { error } = await supabase.rpc("cancelar_partido_manual", {
      p_partido_id: String(partidoId),
    });

    if (error) {
      setMensaje(error.message || "No fue posible cancelar el partido.");
      setProcesando(false);
      return;
    }

    setMensaje("Partido cancelado.");
    setProcesando(false);
    await actualizarDatosAdmin();
  };

  const iniciarEdicion = (partido) => {
    setEdiciones((actual) => ({
      ...actual,
      [partido.id]: {
        torneo: partido.torneo ?? "",
        fecha: fechaAInputLocal(partido.fecha_orden),
        local: partido.local_nombre ?? "",
        visitante: partido.visitante_nombre ?? "",
        localCorto: partido.local_corto ?? "",
        visitanteCorto: partido.visitante_corto ?? "",
        estado: partido.estado ?? "proximo",
        golesLocal: partido.goles_local_final ?? "",
        golesVisitante: partido.goles_visitante_final ?? "",
        temporada: partido.temporada ?? new Date().getFullYear(),
        ronda: partido.ronda ?? "",
        esRelevante: Boolean(partido.es_relevante),
        prioridadVisual: partido.prioridad_visual ?? 100,
      },
    }));
  };

  const cancelarEdicion = (partidoId) => {
    setEdiciones((actual) => {
      const siguiente = { ...actual };
      delete siguiente[partidoId];
      return siguiente;
    });
  };

  const actualizarEdicion = (partidoId, campo, valor) => {
    setEdiciones((actual) => ({
      ...actual,
      [partidoId]: {
        ...actual[partidoId],
        [campo]: valor,
      },
    }));
  };

  const guardarEdicion = async (partidoId) => {
    const edicion = ediciones[partidoId];

    if (!edicion) {
      return;
    }

    const golesLocal = edicion.golesLocal === "" ? null : Number(edicion.golesLocal);
    const golesVisitante = edicion.golesVisitante === "" ? null : Number(edicion.golesVisitante);

    if (
      edicion.estado === "finalizado" &&
      (!Number.isInteger(golesLocal) || !Number.isInteger(golesVisitante))
    ) {
      setMensaje("Para finalizar desde edicion debes ingresar ambos goles.");
      return;
    }

    setProcesando(true);
    setMensaje("");

    const { error } = await supabase.rpc("editar_partido_admin", {
      p_partido_id: String(partidoId),
      p_torneo: edicion.torneo,
      p_fecha_orden: fechaLocalAIso(edicion.fecha),
      p_local_nombre: edicion.local,
      p_visitante_nombre: edicion.visitante,
      p_estado: edicion.estado,
      p_goles_local: golesLocal,
      p_goles_visitante: golesVisitante,
      p_es_relevante: edicion.esRelevante,
      p_prioridad_visual: Number(edicion.prioridadVisual) || 100,
      p_local_corto: edicion.localCorto || null,
      p_visitante_corto: edicion.visitanteCorto || null,
      p_temporada: Number(edicion.temporada) || null,
      p_ronda: edicion.ronda || null,
    });

    if (error) {
      setMensaje(error.message || "No fue posible editar el partido.");
      setProcesando(false);
      return;
    }

    cancelarEdicion(partidoId);
    setMensaje("Partido actualizado correctamente.");
    setProcesando(false);
    await actualizarDatosAdmin();
  };

  const marcarRelevancia = async (partido) => {
    setProcesando(true);
    setMensaje("");

    const { error } = await supabase.rpc("marcar_partido_relevante", {
      p_partido_id: String(partido.id),
      p_es_relevante: !partido.es_relevante,
      p_prioridad_visual: partido.prioridad_visual ?? 100,
    });

    if (error) {
      setMensaje(error.message || "No fue posible actualizar la relevancia.");
      setProcesando(false);
      return;
    }

    setMensaje(
      partido.es_relevante
        ? "Partido oculto de Inicio."
        : "Partido marcado como relevante."
    );
    setProcesando(false);
    await actualizarDatosAdmin();
  };

  const cambiarPrioridad = async (partido, valor) => {
    const prioridadVisual = Number(valor);

    if (!Number.isInteger(prioridadVisual)) {
      return;
    }

    setProcesando(true);
    setMensaje("");

    const { error } = await supabase.rpc("marcar_partido_relevante", {
      p_partido_id: String(partido.id),
      p_es_relevante: partido.es_relevante,
      p_prioridad_visual: prioridadVisual,
    });

    if (error) {
      setMensaje(error.message || "No fue posible actualizar la prioridad.");
      setProcesando(false);
      return;
    }

    setMensaje("Prioridad actualizada.");
    setProcesando(false);
    await actualizarDatosAdmin();
  };

  const ejecutarGoogleSheet = async (dryRun) => {
    if (!fuenteImportacionSheet.value) {
      setMensaje("Pega una URL de Google Sheets o carga un archivo CSV.");
      return;
    }

    if (!dryRun && previewSheetUrl !== fuenteImportacionSheet.key) {
      setMensaje("Primero previsualiza esta fuente antes de importar.");
      return;
    }

    if (dryRun) {
      setPrevisualizandoSheet(true);
    } else {
      setImportandoSheet(true);
    }

    setMensaje("");

    const body =
      fuenteImportacionSheet.type === "csv"
        ? {
            csvText: fuenteImportacionSheet.value,
            csvSource: fuenteImportacionSheet.label,
            dryRun,
          }
        : { csvUrl: fuenteImportacionSheet.value, dryRun };

    const { data, error } = await supabase.functions.invoke("import-google-sheet-fixtures", {
      body,
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
    });

    if (error || data?.ok === false) {
      setMensaje(
        data?.error ||
          error?.message ||
          "No fue posible importar partidos desde Google Sheets."
      );
      setImportandoSheet(false);
      setPrevisualizandoSheet(false);
      return;
    }

    const skipped = data?.skipped?.length ?? 0;
    const errors = data?.errors?.length ?? 0;
    const created = data?.created ?? 0;
    const updated = data?.updated ?? 0;

    setPreviewSheet(data);
    setPreviewSheetUrl(fuenteImportacionSheet.key);

    setMensaje(
      dryRun
        ? `Previsualizacion lista: ${created} nuevos, ${updated} para actualizar, ${skipped} omitidos, ${errors} con error.`
        : `Importacion lista: ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors} con error.`
    );

    setImportandoSheet(false);
    setPrevisualizandoSheet(false);

    if (!dryRun) {
      await actualizarDatosAdmin();
    }
  };

  const previsualizarGoogleSheet = async () => {
    await ejecutarGoogleSheet(true);
  };

  const importarGoogleSheet = async (event) => {
    event.preventDefault();
    await ejecutarGoogleSheet(false);
  };

  const guardarSyncAutomatica = async (enabled) => {
    const urlActual = sheetUrl.trim() || syncConfig?.csv_url || "";

    if (enabled && !urlActual) {
      setMensaje("Pega una URL antes de activar la sincronizacion automatica.");
      return;
    }

    setGuardandoSync(true);
    setMensaje("");

    const { data, error } = await supabase.rpc("guardar_google_sheet_sync_config", {
      p_csv_url: urlActual,
      p_enabled: enabled,
    });

    if (error) {
      setMensaje(error.message || "No fue posible guardar la sincronizacion automatica.");
      setGuardandoSync(false);
      return;
    }

    setSyncConfig(data);
    setMensaje(
      enabled
        ? "Sincronizacion automatica activada. Supabase revisara la hoja cada hora."
        : "Sincronizacion automatica desactivada."
    );
    setGuardandoSync(false);
  };

  const actualizarApiFootball = (campo, valor) => {
    setApiFootball((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const cargarArchivoCsv = async (event) => {
    const archivo = event.target.files?.[0];

    if (!archivo) {
      setSheetCsvText("");
      setSheetCsvFileName("");
      return;
    }

    const contenido = await archivo.text();
    setSheetCsvText(contenido);
    setSheetCsvFileName(archivo.name);
    setSheetUrl("");
    setPreviewSheet(null);
    setPreviewSheetUrl("");
    setMensaje(`CSV cargado: ${archivo.name}. Puedes previsualizarlo antes de importar.`);
  };

  const actualizarHistoricoBatch = (campo, valor) => {
    setHistoricoBatch((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const prepararMesHistorico = () => {
    const rango = obtenerRangoMesHistorico(historicoBatch.year, historicoBatch.month);

    if (!rango) {
      setMensaje("Elige un ano y mes validos para preparar el rango historico.");
      return null;
    }

    const siguienteConfig = {
      ...apiFootball,
      mode: "range",
      season: String(historicoBatch.year),
      ...rango,
    };

    setApiFootball(siguienteConfig);
    setMensaje(`Rango preparado: ${rango.from} a ${rango.to}.`);
    return siguienteConfig;
  };

  const ejecutarSyncApiFootball = async (configuracion) => {
    setSincronizandoApi(true);
    setMensaje("");

    const parametros = new URLSearchParams({
      mode: configuracion.mode,
      season: configuracion.season,
    });

    if (configuracion.mode === "range") {
      parametros.set("from", configuracion.from);
      parametros.set("to", configuracion.to);
    } else {
      parametros.set("limit", configuracion.limit);
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-live-fixtures?${parametros.toString()}`,
        {
          method: "POST",
          headers: session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : undefined,
        }
      );

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "No fue posible sincronizar API-Football.");
      }

      setResultadoApiFootball(data);
      setMensaje(
        `API-Football listo: ${data.fixtures ?? 0} fixtures, ${
          data.partidos ?? 0
        } partidos, ${data.teams ?? 0} equipos.`
      );
      await actualizarDatosAdmin();
    } catch (error) {
      setMensaje(error.message || "No fue posible sincronizar API-Football.");
    } finally {
      setSincronizandoApi(false);
    }
  };

  const sincronizarApiFootball = async (event) => {
    event.preventDefault();
    await ejecutarSyncApiFootball(apiFootball);
  };

  const sincronizarMesHistorico = async () => {
    const siguienteConfig = prepararMesHistorico();

    if (!siguienteConfig) {
      return;
    }

    await ejecutarSyncApiFootball(siguienteConfig);
  };

  const sincronizarAhora = async () => {
    const urlActual = sheetUrl.trim() || syncConfig?.csv_url || "";

    if (!urlActual) {
      setMensaje("Pega una URL o activa una hoja automatica antes de sincronizar.");
      return;
    }

    setSincronizandoAhora(true);
    setMensaje("");

    const { data, error } = await supabase.functions.invoke("import-google-sheet-fixtures", {
      body: {
        csvUrl: urlActual,
        recordSyncResult: true,
      },
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
    });

    if (error || data?.ok === false) {
      setMensaje(data?.error || error?.message || "No fue posible sincronizar ahora.");
      setSincronizandoAhora(false);
      return;
    }

    setPreviewSheet(data);
    setPreviewSheetUrl(urlActual);
    setMensaje(
      `Sincronizacion ejecutada: ${data?.created ?? 0} creados, ${
        data?.updated ?? 0
      } actualizados, ${data?.skipped?.length ?? 0} omitidos, ${
        data?.errors?.length ?? 0
      } con error.`
    );
    setSincronizandoAhora(false);
    await actualizarDatosAdmin();
    await cargarSyncConfig();
  };

  if (loadingProfile) {
    return (
      <main className="admin-page">
        <section className="empty-league-card">
          <p>Cargando permisos...</p>
          <span>Estamos revisando tu perfil.</span>
        </section>
      </main>
    );
  }

  if (!esAdmin) {
    return (
      <main className="admin-page">
        <button className="league-back-button" type="button" onClick={() => navigate("/perfil")}>
          <ArrowLeft size={19} />
          Volver
        </button>

        <section className="empty-league-card">
          <p>Panel restringido.</p>
          <span>Tu usuario no tiene permisos de administrador.</span>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <button className="league-back-button" type="button" onClick={() => navigate("/perfil")}>
        <ArrowLeft size={19} />
        Volver al perfil
      </button>

      <header className="admin-header">
        <p className="brand">PREDIGOL ADMIN</p>
        <h1>Partidos de temporada</h1>
        <p>Carga partidos actuales y marca solo los encuentros relevantes que deben verse en Inicio.</p>
      </header>

      {mensaje && <p className="prediction-message">{mensaje}</p>}

      <section className="admin-demo-card">
        <div>
          <p className="section-label">FASE 5</p>
          <h2>Demo MVP publico</h2>
          <span>
            Inicio muestra maximo 10 partidos relevantes. Para una demo limpia, importa la
            hoja de ejemplo, deja 5 a 10 visibles, guarda pronosticos y cierra un resultado.
          </span>
        </div>

        <ol>
          <li>Usa `manual-data/google-sheets-demo-mvp.csv` como hoja inicial.</li>
          <li>Marca solo los partidos importantes como visibles.</li>
          <li>Cierra un partido desde este panel para probar puntos y ranking.</li>
        </ol>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header">
          <div>
            <p className="section-label">FASE 2</p>
            <h2>Salud de datos MVP</h2>
            <span>
              Revisa si ya hay historicos suficientes para entrenar y partidos relevantes para
              mostrar predicciones.
            </span>
          </div>

          <button type="button" onClick={actualizarDatosAdmin} disabled={cargandoResumenDatos || cargando}>
            <RefreshCw size={17} />
            {cargandoResumenDatos ? "Revisando..." : "Actualizar salud"}
          </button>
        </div>

        <div className="admin-data-health-grid">
          <span>Total: {resumenDatos?.total ?? "-"}</span>
          <span>Finalizados: {resumenDatos?.finalizados ?? "-"}</span>
          <span>Entrenables: {resumenDatos?.historicosEntrenables ?? "-"}</span>
          <span>Proximos relevantes: {resumenDatos?.proximosRelevantes ?? "-"}</span>
          <span>API-Football: {resumenDatos?.apiFootball ?? "-"}</span>
          <span>Google Sheets: {resumenDatos?.googleSheets ?? "-"}</span>
          <span>Manuales: {resumenDatos?.manuales ?? "-"}</span>
          <span>Predicciones: {resumenDatos?.prediccionesGuardadas ?? "-"}</span>
          <span>Proximos con modelo: {resumenDatos?.proximosConPrediccion ?? "-"}</span>
          <span>
            Confianza prom.:{" "}
            {resumenDatos?.prediccionesGuardadas
              ? `${Math.round((resumenDatos.confianzaPromedio || 0) * 100)}%`
              : "-"}
          </span>
          {resumenDatos?.ultimaPrediccion && (
            <span>Ultima prediccion: {formatearFecha(resumenDatos.ultimaPrediccion)}</span>
          )}
        </div>

        {resumenDatos?.prediccionesError && (
          <p className="admin-data-health-note">
            No fue posible leer predicciones: {resumenDatos.prediccionesError}
          </p>
        )}

        <p className={`admin-data-health-status ${estadoDatosMvp.className}`}>
          {estadoDatosMvp.texto}
        </p>
      </section>

      <form className="admin-form" onSubmit={crearPartido}>
        <label>
          Torneo
          <input
            value={formulario.torneo}
            onChange={(event) => actualizarCampo("torneo", event.target.value)}
          />
        </label>

        <label>
          Fecha y hora
          <input
            type="datetime-local"
            value={formulario.fecha}
            onChange={(event) => actualizarCampo("fecha", event.target.value)}
          />
        </label>

        <label>
          Local
          <input
            value={formulario.local}
            onChange={(event) => actualizarCampo("local", event.target.value)}
          />
        </label>

        <label>
          Visitante
          <input
            value={formulario.visitante}
            onChange={(event) => actualizarCampo("visitante", event.target.value)}
          />
        </label>

        <label>
          Código local
          <input
            maxLength="4"
            value={formulario.localCorto}
            onChange={(event) => actualizarCampo("localCorto", event.target.value.toUpperCase())}
          />
        </label>

        <label>
          Código visitante
          <input
            maxLength="4"
            value={formulario.visitanteCorto}
            onChange={(event) => actualizarCampo("visitanteCorto", event.target.value.toUpperCase())}
          />
        </label>

        <label>
          Temporada
          <input
            type="number"
            value={formulario.temporada}
            onChange={(event) => actualizarCampo("temporada", event.target.value)}
          />
        </label>

        <label>
          Ronda
          <input
            value={formulario.ronda}
            onChange={(event) => actualizarCampo("ronda", event.target.value)}
          />
        </label>

        <button type="submit" disabled={procesando}>
          <Save size={18} />
          {procesando ? "Guardando..." : "Crear partido"}
        </button>
      </form>

      <form className="admin-import-panel" onSubmit={importarGoogleSheet}>
        <div>
          <p className="section-label">IMPORTACION</p>
          <h2>Importar desde Google Sheets</h2>
          <span>
            Pega el enlace de una hoja publicada como CSV. La API crea partidos nuevos y
            actualiza los que ya tengan el mismo id externo.
          </span>
          <span className="admin-sync-status">
            Sync automatico: {syncConfig?.enabled ? "activo cada hora" : "inactivo"}
            {syncConfig?.last_synced_at
              ? ` - ultimo: ${formatearFecha(syncConfig.last_synced_at)}`
              : ""}
          </span>
        </div>

        <label className="admin-import-url">
          URL de Google Sheets o CSV
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            value={sheetUrl}
            onChange={(event) => {
              setSheetUrl(event.target.value);
              setSheetCsvText("");
              setSheetCsvFileName("");
              setPreviewSheet(null);
              setPreviewSheetUrl("");
            }}
          />
          <span>O carga un CSV local para demo rapida.</span>
          <input
            className="admin-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={cargarArchivoCsv}
          />
          {sheetCsvFileName && <small>Archivo listo: {sheetCsvFileName}</small>}
        </label>

        <div className="admin-import-actions">
          <button
            type="button"
            className="admin-preview-button"
            onClick={previsualizarGoogleSheet}
            disabled={previsualizandoSheet || importandoSheet}
          >
            <Search size={18} />
            {previsualizandoSheet ? "Revisando..." : "Previsualizar"}
          </button>

          <button
            type="submit"
            disabled={
              importandoSheet ||
              previsualizandoSheet ||
              !previewSheet ||
              previewSheetUrl !== fuenteImportacionSheet.key ||
              (previewSheet.created ?? 0) + (previewSheet.updated ?? 0) === 0
            }
          >
            <UploadCloud size={18} />
            {importandoSheet ? "Importando..." : "Importar hoja"}
          </button>

          <button
            type="button"
            className="admin-sync-button"
            onClick={() => guardarSyncAutomatica(true)}
            disabled={guardandoSync || importandoSheet || previsualizandoSheet}
          >
            {guardandoSync ? "Guardando..." : "Activar auto"}
          </button>

          {syncConfig?.enabled && (
            <button
              type="button"
              className="admin-sync-disable-button"
              onClick={() => guardarSyncAutomatica(false)}
              disabled={guardandoSync || importandoSheet || previsualizandoSheet}
            >
              Desactivar auto
            </button>
          )}

          <button
            type="button"
            className="admin-sync-now-button"
            onClick={sincronizarAhora}
            disabled={sincronizandoAhora || importandoSheet || previsualizandoSheet}
          >
            <RefreshCw size={18} />
            {sincronizandoAhora ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </div>
      </form>

      <form className="admin-api-football-panel" onSubmit={sincronizarApiFootball}>
        <div>
          <p className="section-label">API-FOOTBALL</p>
          <h2>Sincronizar datos historicos</h2>
          <span>
            Usa API-Football para cargar historicos gratuitos. En plan Free, lo mas estable
            es usar modo rango con temporadas 2022 a 2024.
          </span>
        </div>

        <div className="admin-history-helper">
          <div>
            <strong>Importador rapido por mes</strong>
            <span>Prepara o sincroniza un mes completo para poblar historicos gratis.</span>
          </div>

          <label>
            Ano
            <input
              type="number"
              min="2022"
              max="2024"
              value={historicoBatch.year}
              onChange={(event) => actualizarHistoricoBatch("year", event.target.value)}
            />
          </label>

          <label>
            Mes
            <select
              value={historicoBatch.month}
              onChange={(event) => actualizarHistoricoBatch("month", event.target.value)}
            >
              {mesesHistoricos.map((mes) => (
                <option key={mes.value} value={mes.value}>
                  {mes.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="admin-history-secondary-button"
            onClick={prepararMesHistorico}
            disabled={sincronizandoApi}
          >
            Usar mes
          </button>

          <button type="button" onClick={sincronizarMesHistorico} disabled={sincronizandoApi}>
            <RefreshCw size={18} />
            {sincronizandoApi ? "Sincronizando..." : "Sincronizar mes"}
          </button>
        </div>

        <label>
          Modo
          <select
            value={apiFootball.mode}
            onChange={(event) => actualizarApiFootball("mode", event.target.value)}
          >
            <option value="range">Rango de fechas</option>
            <option value="results">Resultados</option>
            <option value="upcoming">Proximos</option>
            <option value="live">En vivo</option>
          </select>
        </label>

        <label>
          Temporada
          <input
            type="number"
            value={apiFootball.season}
            onChange={(event) => actualizarApiFootball("season", event.target.value)}
          />
        </label>

        {apiFootball.mode === "range" ? (
          <>
            <label>
              Desde
              <input
                type="date"
                value={apiFootball.from}
                onChange={(event) => actualizarApiFootball("from", event.target.value)}
              />
            </label>

            <label>
              Hasta
              <input
                type="date"
                value={apiFootball.to}
                onChange={(event) => actualizarApiFootball("to", event.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            Limite
            <input
              type="number"
              min="1"
              max="50"
              value={apiFootball.limit}
              onChange={(event) => actualizarApiFootball("limit", event.target.value)}
            />
          </label>
        )}

        <button type="submit" disabled={sincronizandoApi}>
          <RefreshCw size={18} />
          {sincronizandoApi ? "Sincronizando..." : "Sincronizar API"}
        </button>
      </form>

      {resultadoApiFootball && (
        <section className="admin-api-football-result">
          <strong>Resultado API-Football</strong>
          <span>{resultadoApiFootball.requests ?? 0} requests</span>
          <span>{resultadoApiFootball.fixtures ?? 0} fixtures</span>
          <span>{resultadoApiFootball.partidos ?? 0} partidos</span>
          <span>{resultadoApiFootball.teams ?? 0} equipos</span>
          <span>{resultadoApiFootball.skipped?.length ?? 0} omitidos</span>
          {(resultadoApiFootball.skipped ?? []).slice(0, 4).map((item) => (
            <small key={item}>{item}</small>
          ))}
        </section>
      )}

      {syncConfig?.last_result && (
        <section className="admin-sync-last-result">
          <strong>Ultima sincronizacion automatica</strong>
          <span>{syncConfig.last_result.rows ?? 0} filas leidas</span>
          <span>{syncConfig.last_result.created ?? 0} creados</span>
          <span>{syncConfig.last_result.updated ?? 0} actualizados</span>
          <span>{syncConfig.last_result.skipped?.length ?? 0} omitidos</span>
          <span>{syncConfig.last_result.errors?.length ?? 0} errores</span>
          {syncConfig.last_error && <em>{syncConfig.last_error}</em>}
          {[
            ...(syncConfig.last_result.errors ?? []),
            ...(syncConfig.last_result.skipped ?? []),
          ].length > 0 && (
            <div className="admin-sync-error-list">
              {[
                ...(syncConfig.last_result.errors ?? []),
                ...(syncConfig.last_result.skipped ?? []),
              ]
                .slice(0, 4)
                .map((item) => (
                  <small key={`${item.fila}-${item.reason}`}>
                    Fila {item.fila}: {item.reason}
                  </small>
                ))}
            </div>
          )}
        </section>
      )}

      {previewSheet && (
        <section className="admin-import-preview">
          <div className="admin-preview-summary">
            <strong>Previsualizacion</strong>
            <span>{previewSheet.rows ?? 0} filas leidas</span>
            <span>{previewSheet.created ?? 0} nuevos</span>
            <span>{previewSheet.updated ?? 0} actualizaciones</span>
            <span>{previewSheet.skipped?.length ?? 0} omitidos</span>
            <span>{previewSheet.errors?.length ?? 0} errores</span>
          </div>

          <div className="admin-preview-list">
            {(previewSheet.preview ?? []).slice(0, 12).map((item) => (
              <article
                className={`admin-preview-row admin-preview-${item.action}`}
                key={`${item.fila}-${item.externalId}`}
              >
                <div>
                  <span>Fila {item.fila}</span>
                  <strong>
                    {item.local || "Local"} vs {item.visitante || "Visitante"}
                  </strong>
                  <small>
                    {item.torneo || "Sin torneo"} - {item.estado || "sin estado"} -{" "}
                    {item.reason || item.externalId}
                  </small>
                </div>

                <b>{etiquetaAccionImportacion(item.action)}</b>
              </article>
            ))}
          </div>

          {(previewSheet.preview?.length ?? 0) > 12 && (
            <p className="admin-preview-note">
              Mostrando 12 de {previewSheet.preview.length} filas. Importar hoja procesara todas.
            </p>
          )}
        </section>
      )}

      <section className="admin-list-header">
        <div>
          <p className="section-label">GESTION</p>
          <h2>Partidos administrables</h2>
        </div>

        <button type="button" onClick={actualizarDatosAdmin} disabled={cargando || cargandoResumenDatos}>
          <RefreshCw size={17} />
          Actualizar
        </button>
      </section>

      <section className="admin-filter-panel">
        <div className="admin-filter-buttons" aria-label="Filtrar partidos">
          {opcionesFiltro.map((opcion) => (
            <button
              type="button"
              key={opcion.id}
              className={filtroPartidos === opcion.id ? "admin-filter-active" : ""}
              onClick={() => setFiltroPartidos(opcion.id)}
              aria-pressed={filtroPartidos === opcion.id}
            >
              {opcion.label}
              <span>{opcion.cantidad}</span>
            </button>
          ))}
        </div>

        <label className="admin-search-box">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar por equipo, torneo o fuente"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>

        <div className="admin-filter-summary">
          <span>
            Mostrando {partidosOrdenados.length} de {resumenPartidos.total} partidos cargados.
          </span>

          {(busqueda || filtroPartidos !== "todos") && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltroPartidos("todos");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {cargando ? (
        <section className="empty-league-card">
          <p>Cargando partidos...</p>
          <span>Un momento.</span>
        </section>
      ) : partidosOrdenados.length === 0 ? (
        <section className="empty-league-card">
          <p>No hay partidos con estos filtros.</p>
          <span>Cambia el filtro o limpia la busqueda para revisar la temporada completa.</span>
        </section>
      ) : (
        <section className="admin-match-list">
          {partidosOrdenados.map((partido) => {
            const bloqueado = partido.estado === "finalizado" || partido.estado === "cancelado";
            const edicion = ediciones[partido.id];
            const clasesPartido = [
              "admin-match-card",
              partido.estado === "finalizado" ? "admin-match-card-finalizado" : "",
              partido.estado === "cancelado" ? "admin-match-card-cancelado" : "",
              !partido.es_relevante ? "admin-match-card-oculto" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article className={clasesPartido} key={partido.id}>
                <div>
                  <span>{partido.torneo}</span>
                  <h3>
                    {partido.local_nombre} vs {partido.visitante_nombre}
                  </h3>
                  <p>
                    {formatearFecha(partido.fecha_orden)} - {partido.estado} -{" "}
                    {partido.origen_datos || "api"} -{" "}
                    {partido.es_relevante ? "visible en Inicio" : "oculto"}
                  </p>
                </div>

                {partido.estado === "finalizado" && (
                  <strong>
                    {partido.goles_local_final} - {partido.goles_visitante_final}
                  </strong>
                )}

                <div className="admin-result-actions">
                  <button
                    type="button"
                    onClick={() => iniciarEdicion(partido)}
                    disabled={procesando}
                    title="Editar partido"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    className={partido.es_relevante ? "admin-visible-button" : ""}
                    onClick={() => marcarRelevancia(partido)}
                    disabled={procesando}
                  >
                    {partido.es_relevante ? "Ocultar" : "Mostrar"}
                  </button>

                  <input
                    type="number"
                    min="1"
                    max="999"
                    title="Prioridad visual"
                    value={partido.prioridad_visual ?? 100}
                    onChange={(event) => cambiarPrioridad(partido, event.target.value)}
                  />

                  {!bloqueado && (
                    <>
                      <input
                        type="number"
                        min="0"
                        placeholder="L"
                        value={resultados[partido.id]?.local ?? ""}
                        onChange={(event) =>
                          actualizarResultado(partido.id, "local", event.target.value)
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="V"
                        value={resultados[partido.id]?.visitante ?? ""}
                        onChange={(event) =>
                          actualizarResultado(partido.id, "visitante", event.target.value)
                        }
                      />
                      <button type="button" onClick={() => cerrarPartido(partido.id)} disabled={procesando}>
                        <Check size={16} />
                      </button>
                      <button type="button" onClick={() => cancelarPartido(partido.id)} disabled={procesando}>
                        <Ban size={16} />
                      </button>
                    </>
                  )}
                </div>

                {edicion && (
                  <div className="admin-match-edit-form">
                    <label>
                      Torneo
                      <input
                        value={edicion.torneo}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "torneo", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Fecha
                      <input
                        type="datetime-local"
                        value={edicion.fecha}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "fecha", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Local
                      <input
                        value={edicion.local}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "local", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Visitante
                      <input
                        value={edicion.visitante}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "visitante", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Estado
                      <select
                        value={edicion.estado}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "estado", event.target.value)
                        }
                      >
                        <option value="proximo">Proximo</option>
                        <option value="en_vivo">En vivo</option>
                        <option value="finalizado">Finalizado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </label>

                    <label>
                      Goles local
                      <input
                        type="number"
                        min="0"
                        value={edicion.golesLocal}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "golesLocal", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Goles visitante
                      <input
                        type="number"
                        min="0"
                        value={edicion.golesVisitante}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "golesVisitante", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Prioridad
                      <input
                        type="number"
                        min="1"
                        value={edicion.prioridadVisual}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "prioridadVisual", event.target.value)
                        }
                      />
                    </label>

                    <label className="admin-edit-check">
                      <input
                        type="checkbox"
                        checked={edicion.esRelevante}
                        onChange={(event) =>
                          actualizarEdicion(partido.id, "esRelevante", event.target.checked)
                        }
                      />
                      Visible en Inicio
                    </label>

                    <div className="admin-edit-actions">
                      <button type="button" onClick={() => guardarEdicion(partido.id)} disabled={procesando}>
                        <Save size={16} />
                        Guardar
                      </button>
                      <button type="button" onClick={() => cancelarEdicion(partido.id)}>
                        <X size={16} />
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default AdminPartidosPage;
