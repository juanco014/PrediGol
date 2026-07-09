import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
const isNodeTest =
  globalThis.process?.env?.npm_lifecycle_event === "test";

if (!supabaseUrl || !supabasePublishableKey) {
  if (!isNodeTest) {
    throw new Error(
      "Faltan las variables de entorno de Supabase. Revisa el archivo .env.local."
    );
  }
}

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : new Proxy(
        {},
        {
          get() {
            throw new Error(
              "Faltan las variables de entorno de Supabase. Revisa el archivo .env.local."
            );
          },
        }
      );
