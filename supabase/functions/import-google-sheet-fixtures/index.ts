import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-import-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const DEFAULT_SHEET_CSV_URL = Deno.env.get("GOOGLE_SHEET_FIXTURES_CSV_URL");
const IMPORT_SECRET = Deno.env.get("GOOGLE_SHEET_IMPORT_SECRET");

function getSupabaseAdminKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    const parsedKeys = JSON.parse(secretKeys);
    return parsedKeys.default ?? Object.values(parsedKeys)[0] ?? null;
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function assertEnvironment() {
  const missing = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!getSupabaseAdminKey()) missing.push("SUPABASE_SECRET_KEYS");

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }

      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((csvRow) => csvRow.some((value) => value.trim() !== ""));
}

function rowsToObjects(rows: string[][]) {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map(normalizeHeader);

  return dataRows.map((row, rowIndex) => {
    const item: Record<string, string> = { fila: String(rowIndex + 2) };

    headers.forEach((header, index) => {
      item[header] = normalizeValue(row[index]);
    });

    return item;
  });
}

function getFirst(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeValue(row[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function parseInteger(value: string) {
  if (!value) {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function parseBoolean(value: string, defaultValue: boolean) {
  const normalized = normalizeHeader(value);

  if (!normalized) {
    return defaultValue;
  }

  return ["1", "si", "s", "true", "yes", "y", "relevante", "mostrar"].includes(normalized);
}

function parseEstado(value: string) {
  const normalized = normalizeHeader(value);

  if (!normalized) return "proximo";
  if (["finalizado", "final", "ft"].includes(normalized)) return "finalizado";
  if (["cancelado", "cancelada", "canceled", "canc"].includes(normalized)) return "cancelado";
  if (["en_vivo", "envivo", "live", "vivo"].includes(normalized)) return "en_vivo";
  if (["proximo", "programado", "pendiente", "ns"].includes(normalized)) return "proximo";

  return "__invalid__";
}

function parseDateTime(row: Record<string, string>) {
  const explicitDate = getFirst(row, ["fecha_orden", "datetime", "date_time", "kickoff_at"]);
  const date = explicitDate || getFirst(row, ["fecha", "date"]);
  const time = getFirst(row, ["hora", "time"]) || "00:00";

  if (!date) {
    return "";
  }

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(date) || date.includes("T")) {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/);

  if (isoMatch) {
    const [, year, month, day, inlineHour, inlineMinute] = isoMatch;
    const [fallbackHour, fallbackMinute] = time.split(":");
    const hour = inlineHour ?? fallbackHour ?? "00";
    const minute = inlineMinute ?? fallbackMinute ?? "00";
    return `${year}-${month}-${day}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00-05:00`;
  }

  const latinMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);

  if (latinMatch) {
    const [, day, month, year, inlineHour, inlineMinute] = latinMatch;
    const [fallbackHour, fallbackMinute] = time.split(":");
    const hour = inlineHour ?? fallbackHour ?? "00";
    const minute = inlineMinute ?? fallbackMinute ?? "00";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(
      2,
      "0",
    )}:${minute.padStart(2, "0")}:00-05:00`;
  }

  const parsed = new Date(`${date} ${time}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function toGoogleCsvUrl(inputUrl: string) {
  const url = new URL(inputUrl);

  if (!url.hostname.includes("docs.google.com")) {
    return inputUrl;
  }

  if (url.pathname.includes("/export")) {
    url.searchParams.set("format", "csv");
    return url.toString();
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);

  if (!match) {
    return inputUrl;
  }

  const gid = url.hash.match(/gid=(\d+)/)?.[1] ?? url.searchParams.get("gid") ?? "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

function buildExternalId(row: Record<string, string>) {
  const explicitId = getFirst(row, ["id", "external_id", "partido_id"]);

  if (explicitId) {
    return explicitId;
  }

  const torneo = getFirst(row, ["torneo", "liga", "competicion", "competicion_nombre"]);
  const local = getFirst(row, ["local", "equipo_local", "home", "home_team"]);
  const visitante = getFirst(row, ["visitante", "equipo_visitante", "away", "away_team"]);
  const fecha = parseDateTime(row);

  return normalizeHeader(`${torneo}_${fecha}_${local}_${visitante}`);
}

function rowToPayload(row: Record<string, string>) {
  const torneo = getFirst(row, ["torneo", "liga", "competicion", "competicion_nombre"]);
  const local = getFirst(row, ["local", "equipo_local", "home", "home_team"]);
  const visitante = getFirst(row, ["visitante", "equipo_visitante", "away", "away_team"]);
  const fechaOrden = parseDateTime(row);
  const estadoOriginal = getFirst(row, ["estado", "status"]);
  const estado = parseEstado(getFirst(row, ["estado", "status"]));
  const golesLocal = parseInteger(getFirst(row, ["goles_local", "local_goles", "home_goals"]));
  const golesVisitante = parseInteger(
    getFirst(row, ["goles_visitante", "visitante_goles", "away_goals"]),
  );

  return {
    externalId: buildExternalId(row),
    torneo,
    local,
    visitante,
    fechaOrden,
    estado,
    estadoOriginal,
    localCorto: getFirst(row, ["local_corto", "codigo_local", "home_code"]),
    visitanteCorto: getFirst(row, ["visitante_corto", "codigo_visitante", "away_code"]),
    temporada: parseInteger(getFirst(row, ["temporada", "season"])),
    ronda: getFirst(row, ["ronda", "fecha_torneo", "round"]),
    fuenteDetalle: getFirst(row, ["fuente", "fuente_detalle", "source"]) || "google sheets",
    esRelevante: parseBoolean(getFirst(row, ["relevante", "mostrar", "es_relevante"]), true),
    prioridadVisual: parseInteger(getFirst(row, ["prioridad", "prioridad_visual"])) ?? 10,
    golesLocal,
    golesVisitante,
    raw: row,
  };
}

function validatePayload(payload: ReturnType<typeof rowToPayload>) {
  const issues = [];

  if (!payload.externalId) issues.push("Falta id o no se pudo generar un id externo.");
  if (!payload.torneo) issues.push("Falta torneo.");
  if (!payload.local) issues.push("Falta local.");
  if (!payload.visitante) issues.push("Falta visitante.");
  if (!payload.fechaOrden) issues.push("Falta fecha o tiene formato invalido.");
  if (payload.estado === "__invalid__") {
    issues.push(
      `Estado invalido: ${payload.estadoOriginal}. Usa proximo, en_vivo, finalizado o cancelado.`,
    );
  }

  if (
    payload.estado === "finalizado" &&
    (payload.golesLocal === null || payload.golesVisitante === null)
  ) {
    issues.push("Faltan goles para partido finalizado.");
  }

  return issues;
}

function buildPreviewItem(
  row: Record<string, string>,
  payload: ReturnType<typeof rowToPayload>,
  action: string,
  reason = "",
) {
  return {
    fila: row.fila,
    action,
    reason,
    externalId: payload.externalId,
    torneo: payload.torneo,
    fechaOrden: payload.fechaOrden,
    local: payload.local,
    visitante: payload.visitante,
    estado: payload.estado,
    relevante: payload.esRelevante,
    prioridad: payload.prioridadVisual,
  };
}

async function validateAdmin(supabaseAdmin: any, authorization: string | null) {
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Debes iniciar sesion para importar partidos.");
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new Error("Sesion no valida para importar partidos.");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("rol, es_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.rol !== "admin" && !profile?.es_admin) {
    throw new Error("Tu usuario no tiene permisos de administrador.");
  }
}

async function loadSyncConfig(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from("predigol_google_sheet_sync_config")
    .select("csv_url, enabled, import_secret")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function validateAccess(supabaseAdmin: any, request: Request, syncConfig: any) {
  const importSecret = request.headers.get("x-import-secret");

  if (IMPORT_SECRET && importSecret && importSecret === IMPORT_SECRET) {
    return "system";
  }

  if (syncConfig?.import_secret && importSecret && importSecret === syncConfig.import_secret) {
    return "system";
  }

  await validateAdmin(supabaseAdmin, request.headers.get("authorization"));
  return "admin";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertEnvironment();

    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const supabaseAdmin = createClient(SUPABASE_URL!, getSupabaseAdminKey() as string);
    const syncConfig = await loadSyncConfig(supabaseAdmin);
    const actor = await validateAccess(supabaseAdmin, request, syncConfig);
    const csvTextFromBody = normalizeValue(body.csvText ?? body.csv ?? "");
    const csvUrl = normalizeValue(
      csvTextFromBody ? "" : body.csvUrl ?? body.url ?? DEFAULT_SHEET_CSV_URL ?? syncConfig?.csv_url,
    );
    const dryRun = Boolean(body.dryRun);
    const recordSyncResult = Boolean(body.recordSyncResult);

    if (!csvTextFromBody && !csvUrl) {
      throw new Error("Debes enviar csvUrl, csvText o configurar GOOGLE_SHEET_FIXTURES_CSV_URL.");
    }

    let csvText = csvTextFromBody;

    if (!csvText) {
      const response = await fetch(toGoogleCsvUrl(csvUrl));

      if (!response.ok) {
        throw new Error(`No fue posible leer la hoja: ${response.status} ${response.statusText}`);
      }

      csvText = await response.text();
    }

    const rows = rowsToObjects(parseCsv(csvText));
    const result = {
      ok: true,
      actor,
      dryRun,
      rows: rows.length,
      created: 0,
      updated: 0,
      skipped: [] as Array<Record<string, string>>,
      errors: [] as Array<Record<string, string>>,
      preview: [] as Array<Record<string, unknown>>,
    };

    for (const row of rows) {
      const payload = rowToPayload(row);
      const issues = validatePayload(payload);

      if (issues.length > 0) {
        const reason = issues.join(" ");
        result.skipped.push({
          fila: row.fila,
          reason,
        });
        result.preview.push(buildPreviewItem(row, payload, "skipped", reason));
        continue;
      }

      if (dryRun) {
        const { data: existingPartido, error: existingError } = await supabaseAdmin
          .from("partidos")
          .select("id")
          .eq("external_source", "google_sheets")
          .eq("external_id", payload.externalId)
          .maybeSingle();

        if (existingError) {
          result.errors.push({
            fila: row.fila,
            reason: existingError.message,
          });
          result.preview.push(buildPreviewItem(row, payload, "error", existingError.message));
          continue;
        }

        const action = existingPartido ? "updated" : "created";

        if (existingPartido) {
          result.updated += 1;
        } else {
          result.created += 1;
        }

        result.preview.push(buildPreviewItem(row, payload, action));
        continue;
      }

      const { data, error } = await supabaseAdmin.rpc("importar_partido_externo", {
        p_external_source: "google_sheets",
        p_external_id: payload.externalId,
        p_torneo: payload.torneo,
        p_fecha_orden: payload.fechaOrden,
        p_local_nombre: payload.local,
        p_visitante_nombre: payload.visitante,
        p_local_corto: payload.localCorto || null,
        p_visitante_corto: payload.visitanteCorto || null,
        p_temporada: payload.temporada,
        p_ronda: payload.ronda || null,
        p_fuente_detalle: payload.fuenteDetalle,
        p_es_relevante: payload.esRelevante,
        p_prioridad_visual: payload.prioridadVisual,
        p_estado: payload.estado,
        p_goles_local: payload.golesLocal,
        p_goles_visitante: payload.golesVisitante,
        p_raw_import_payload: payload.raw,
      });

      if (error) {
        result.errors.push({
          fila: row.fila,
          reason: error.message,
        });
        result.preview.push(buildPreviewItem(row, payload, "error", error.message));
        continue;
      }

      if (data?.action === "updated") {
        result.updated += 1;
      } else {
        result.created += 1;
      }

      result.preview.push(buildPreviewItem(row, payload, data?.action ?? "created"));
    }

    if (!dryRun && (actor === "system" || recordSyncResult)) {
      await supabaseAdmin.rpc("registrar_google_sheet_sync_result", {
        p_result: result,
        p_error: null,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
