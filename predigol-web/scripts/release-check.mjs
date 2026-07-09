import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const npmCli = process.env.npm_execpath;

function runNpm(script) {
  assert(npmCli, "No fue posible localizar npm-cli.js.");

  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Fallo npm run ${script}.`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

console.log("[1/3] Ejecutando lint...");
runNpm("lint");

console.log("[2/3] Generando build de produccion...");
runNpm("build");

console.log("[3/3] Revisando entrega...");

const requiredFiles = [
  "dist/index.html",
  "dist/manifest.webmanifest",
  "dist/favicon.svg",
  "dist/sw.js",
  "vercel.json",
];

for (const file of requiredFiles) {
  assert(existsSync(resolve(root, file)), `Falta ${file}.`);
}

const envPath = resolve(root, ".env.local");
const envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const hasEnv = (name) =>
  Boolean(process.env[name]) || new RegExp(`^${name}=.+$`, "m").test(envContent);

assert(hasEnv("VITE_SUPABASE_URL"), "Falta VITE_SUPABASE_URL.");
assert(
  hasEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  "Falta VITE_SUPABASE_PUBLISHABLE_KEY."
);

const envFiles = [".env.example", ...(existsSync(envPath) ? [".env.local"] : [])];
for (const file of envFiles) {
  assert(
    !/VITE_.*(?:SERVICE_ROLE|SECRET)/i.test(read(file)),
    `${file} expone una llave administrativa mediante VITE_.`
  );
}

const manifest = JSON.parse(read("public/manifest.webmanifest"));
assert(manifest.name === "PrediGol", "El manifest no identifica PrediGol.");
assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, "El manifest no tiene iconos.");

const vercel = JSON.parse(read("vercel.json"));
assert(vercel.rewrites?.length > 0, "Falta el rewrite SPA de Vercel.");
assert(vercel.headers?.length > 0, "Faltan headers de seguridad en Vercel.");

const indexHtml = read("index.html");
assert(indexHtml.includes('lang="es"'), "index.html debe declarar idioma espanol.");
assert(indexHtml.includes("PrediGol |"), "index.html no tiene titulo publico.");

const assets = readdirSync(resolve(root, "dist/assets"));
assert(assets.some((file) => file.endsWith(".js")), "El build no genero JavaScript.");
assert(assets.some((file) => file.endsWith(".css")), "El build no genero CSS.");

console.log("PrediGol listo para entrega: lint, build, entorno, PWA y seguridad OK.");
