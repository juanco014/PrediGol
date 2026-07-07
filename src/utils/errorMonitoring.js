import { supabase } from "../lib/supabase";

const erroresRecientes = new Map();
const VENTANA_DEDUPLICACION_MS = 5000;

function mensajeSeguro(error) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error || "Error sin mensaje").slice(0, 500);
}

export async function registrarErrorCliente(error, source = "window", metadata = {}) {
  const message = mensajeSeguro(error);
  const clave = `${source}:${message}`;
  const ahora = Date.now();

  if (ahora - (erroresRecientes.get(clave) || 0) < VENTANA_DEDUPLICACION_MS) {
    return;
  }

  erroresRecientes.set(clave, ahora);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await supabase.rpc("registrar_error_cliente", {
      p_source: source,
      p_message: message,
      p_route: window.location.pathname,
      p_metadata: metadata,
    });
  } catch (monitoringError) {
    console.warn("No fue posible registrar el error del cliente:", monitoringError);
  }
}

export function iniciarMonitoreoGlobal() {
  window.addEventListener("error", (event) => {
    registrarErrorCliente(event.error || event.message, "window", {
      filename: event.filename?.split("/").pop() || null,
      line: event.lineno || null,
      column: event.colno || null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    registrarErrorCliente(event.reason, "promise");
  });
}
