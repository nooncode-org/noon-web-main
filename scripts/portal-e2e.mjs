#!/usr/bin/env node
/**
 * scripts/portal-e2e.mjs
 *
 * Ejercita el portal del cliente contra la base de datos local y COMPRUEBA en la
 * base que cada acción ocurrió de verdad: que la interfaz no proteste no
 * significa que el dato viajara.
 *
 * Requisitos: `node scripts/dev-db-server.mjs` + `npm run dev` + `npm run db:seed`.
 *
 * NOTA: nunca uses rutas con contrabarras aquí. El escáner de Tailwind lee los
 * archivos del proyecto y trata las secuencias `\x` como escapes CSS: una ruta
 * de Windows literal hace fallar globals.css y tumba la app entera.
 */
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    if (/^[A-Z0-9_]+$/.test(key) && !process.env[key]) {
      process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

/** El Postgres embebido atiende UNA conexión; la app tiene la suya. */
async function db(run) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 1, prepare: false });
    try {
      return await run(sql);
    } catch (error) {
      if (attempt === 6) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    } finally {
      await sql.end({ timeout: 5 }).catch(() => {});
    }
  }
}

const WS = "dev-demo-workspace";
const SESSION = "dev-demo-session";
const URL = `http://localhost:3211/en/maxwell/workspace/${SESSION}`;

/**
 * Dos rutas dependen de servicios externos que una máquina de desarrollo no
 * tiene: crear una petición rastreada exige el puente con el App, y adjuntar
 * exige Supabase Storage. Sin ellos la interfaz OCULTA esas acciones a
 * propósito, así que aquí se informan como no verificables en vez de como
 * fallos — decir "falla" de algo que no se puede probar es ruido.
 */
const HAS_APP_BRIDGE = Boolean(process.env.NOON_APP_URL);
const HAS_STORAGE = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK   " : "FALLO"} ${name}${detail ? " — " + detail : ""}`);
};
const skip = (name, why) => {
  results.push({ name, skipped: true, detail: why });
  console.log(`OMITIDO ${name} — ${why}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const crashes = [];
page.on("pageerror", (e) => crashes.push(e.message.slice(0, 90)));

const load = async () => {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
};
const openTab = async (id) => {
  await page.locator(`nav[aria-label="Workspace sections"] [role="tab"][data-tabid="${id}"]`).click();
  await page.waitForTimeout(1000);
};
const broke = () => page.evaluate(() => document.body.innerText.includes("didn't go as planned"));

try {
  await load();
  const heading = await page.evaluate(() => document.querySelector("header h1")?.textContent?.trim());
  check("Overview carga con datos reales", !(await broke()) && !!heading, heading);

  // ── Convertir un mensaje en petición rastreada
  await openTab("chat");
  await page.locator('[data-panel="chat"] button[aria-label="Add"]').click();
  await page.waitForTimeout(1400);
  const track = page.getByRole("menuitem", { name: /Track as request/i });
  if (!HAS_APP_BRIDGE) {
    check("El menu ofrece rastrear como peticion", (await track.count()) > 0);
    await page.keyboard.press("Escape");
    skip("Peticion rastreada llega a la base", "requiere el puente con el App (NOON_APP_URL)");
  } else if (await track.count()) {
    await track.click();
    await page.waitForTimeout(500);
    await page.locator('[data-panel="chat"] textarea').fill("El boton de exportar no responde en movil");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(6000);
    const rows = await db((sql) => sql`
      SELECT type, body FROM client_request
      WHERE client_workspace_id = ${WS} ORDER BY created_at DESC LIMIT 1
    `);
    check("Peticion rastreada llega a la base", rows.length > 0 && rows[0].body.includes("exportar"), rows[0]?.type ?? "sin fila");
  } else {
    check("Peticion rastreada llega a la base", false, "la opcion no aparece");
  }

  // ── Responder a esa petición
  await load();
  await openTab("chat");
  const reply = page.getByRole("button", { name: "Reply" }).last();
  if (!HAS_APP_BRIDGE) {
    skip("Respuesta a la peticion se guarda", "no hay peticiones sin el puente con el App");
  } else if (await reply.count()) {
    await reply.click();
    await page.waitForTimeout(500);
    await page.locator('[data-panel="chat"] textarea').fill("Pasa en iPhone con Safari");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(6000);
    const ups = await db((sql) => sql`SELECT body FROM client_request_update ORDER BY created_at DESC LIMIT 1`);
    check("Respuesta a la peticion se guarda", ups.length > 0 && ups[0].body.includes("iPhone"), ups[0]?.body?.slice(0, 28) ?? "sin fila");
  } else {
    check("Respuesta a la peticion se guarda", false, "no hay boton Reply");
  }

  // ── Adjuntar archivo
  await load();
  await openTab("chat");
  await page.locator('[data-panel="chat"] button[aria-label="Add"]').click();
  await page.waitForTimeout(1400);
  const fileItem = page.getByRole("menuitem", { name: /^File$/i });
  if (!HAS_STORAGE) {
    check("Sin almacenamiento, el selector de archivo se oculta", (await fileItem.count()) === 0);
    await page.keyboard.press("Escape");
    skip("Adjuntar archivo funciona", "requiere Supabase Storage");
  } else if (await fileItem.count()) {
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 });
    await fileItem.click();
    const fc = await chooser;
    await fc.setFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
    await page.waitForTimeout(900);
    await page.locator('[data-panel="chat"] textarea').fill("Aqui va nuestro logo");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(8000);
    const uiErr = await page.evaluate(() => document.querySelector('[data-panel="chat"] [role="alert"]')?.textContent?.trim() ?? null);
    const att = await db((sql) => sql`SELECT filename FROM client_request_attachment ORDER BY created_at DESC LIMIT 1`);
    check("Adjuntar archivo funciona", att.length > 0, att[0]?.filename ?? `sin fila (UI: ${uiErr ?? "sin error"})`);
  } else {
    check("Adjuntar archivo funciona", false, "la opcion File no aparece");
  }

  // ── Proyecto aún no conectado al App
  await db((sql) => sql`UPDATE client_workspace SET noon_app_project_id = NULL WHERE id = ${WS}`);
  await load();
  check("Proyecto sin conectar al App no rompe", !(await broke()));
  await openTab("chat");
  await page.locator('[data-panel="chat"] button[aria-label="Add"]').click();
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="dropdown-menu-content"] [role="menuitem"]')].map((i) => i.textContent.trim()),
  );
  check(
    "Sin conectar, no ofrece acciones imposibles",
    !menu.includes("Track as request") && !menu.includes("File"),
    menu.join("/") || "menu vacio",
  );
  await page.keyboard.press("Escape");
  await db((sql) => sql`UPDATE client_workspace SET noon_app_project_id = 'dev-demo-project' WHERE id = ${WS}`);

  // ── Propuesta en pago pendiente
  await db((sql) => sql`UPDATE proposal_request SET status = 'payment_pending' WHERE studio_session_id = ${SESSION}`);
  await load();
  check("Pago pendiente no rompe el portal", !(await broke()));
  await db((sql) => sql`UPDATE proposal_request SET status = 'paid' WHERE studio_session_id = ${SESSION}`);

  // ── Ajustes
  await load();
  let gear = page.locator('button[aria-label="Project settings"]:visible').first();
  if ((await gear.count()) === 0) {
    await page.locator('button[aria-label*="sidebar" i]:visible').first().click();
    await page.waitForTimeout(700);
    gear = page.locator('button[aria-label="Project settings"]:visible').first();
  }
  await gear.click();
  await page.waitForTimeout(1000);
  const settings = await page.evaluate(() => ({
    open: !!document.querySelector('[data-slot="dialog-content"]'),
    secciones: [...document.querySelectorAll('nav[aria-label="Settings sections"] button')].map((b) => b.textContent.trim()),
  }));
  check("Panel de ajustes abre con datos reales", settings.open, settings.secciones.join("/"));

  check("Sin errores de JavaScript en toda la pasada", crashes.length === 0, crashes.slice(0, 2).join(" | "));
} catch (error) {
  check("la pasada termino", false, String(error.message).slice(0, 150));
} finally {
  await browser.close();
  // Lo omitido no cuenta como aprobado NI como fallo: no se pudo probar aquí.
  const probados = results.filter((r) => !r.skipped);
  const fallos = probados.filter((r) => !r.ok);
  const omitidos = results.filter((r) => r.skipped);
  console.log(
    `\n=== ${probados.length - fallos.length}/${probados.length} correctos` +
      (omitidos.length ? `, ${omitidos.length} no verificables aqui` : "") +
      " ===",
  );
  for (const r of fallos) console.log(`  FALLA: ${r.name} — ${r.detail}`);
  for (const r of omitidos) console.log(`  requiere entorno: ${r.name} — ${r.detail}`);
  process.exit(fallos.length === 0 ? 0 : 1);
}
