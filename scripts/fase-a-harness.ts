/**
 * scripts/fase-a-harness.ts — el arnés del ANTES/DESPUÉS (Fase A, Entrega 1).
 *
 * La degustación única de la spec (docs/maxwell/fase-a-spec.md § Aceptación):
 * toma proyectos de prueba y genera cada uno DOS veces — con el pipeline de
 * hoy (sin cerebro) y con el cerebro nuevo (estudio → ficha → orden →
 * candidatos → aduana → prompt milimétrico) — y deja las capturas lado a
 * lado para que el owner juzgue con los ojos. Manual, una sola vez, nada
 * queda corriendo. SE DESMONTA al aprobar.
 *
 * Cómo se corre (dos terminales):
 *   1. node scripts/dev-db-server.mjs        ← la base local (el ledger la necesita)
 *   2. npx tsx scripts/fase-a-harness.ts     ← el arnés
 *
 * Necesita en .env.local: OPENAI_API_KEY, V0_API_KEY, PEXELS_API_KEY,
 * DATABASE_URL (la local). Nada se imprime jamás de esos valores.
 *
 * Salida: .data/fase-a-harness/<runId>/ con old.png / new.png / briefs +
 * un index.html con la comparación. Coste aproximado de una corrida
 * completa: ~4 generaciones v0 + ~$0.30 de LLM.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

async function loadEnvLocal(): Promise<void> {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*["']?([^"'\r\n]*)["']?\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

type HarnessProject = {
  slug: string;
  language: string;
  projectType: string;
  initialPrompt: string;
  goalSummary: string;
  lastUserMsg: string;
  lastAssistantMsg: string;
};

const PROJECTS: HarnessProject[] = [
  {
    slug: "panaderia",
    language: "es",
    projectType: "landing",
    initialPrompt:
      "Una página para mi panadería artesanal en Madrid: nuestro pan de masa madre, la historia del obrador y pedidos por WhatsApp.",
    goalSummary:
      "Landing para panadería artesanal en Madrid: pan de masa madre, historia del obrador, pedidos por WhatsApp.",
    lastUserMsg: "Genera el prototipo, por favor.",
    lastAssistantMsg: "Voy — preparo la primera versión interactiva de tu página.",
  },
  {
    slug: "dental",
    language: "en",
    projectType: "landing",
    initialPrompt:
      "A website for my family dental clinic in Austin — our services, meet-the-team, patient reviews and online booking.",
    goalSummary:
      "Landing for a family dental clinic in Austin: services, team, reviews, online booking.",
    lastUserMsg: "Generate the prototype please.",
    lastAssistantMsg: "On it — building the first interactive version now.",
  },
];

async function main(): Promise<void> {
  await loadEnvLocal();
  for (const key of ["OPENAI_API_KEY", "V0_API_KEY", "PEXELS_API_KEY", "DATABASE_URL"]) {
    if (!process.env[key]) {
      console.error(`Falta ${key} en .env.local — el arnés no puede correr sin ella.`);
      process.exit(1);
    }
  }

  // Imports AFTER env load — several lib modules capture config at call
  // time, but the DB pre-flight below must see DATABASE_URL for sure.
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { getDb } = await import("../lib/server/db");
  const { classifyStylePack } = await import("../lib/maxwell/style-classifier");
  const { studyReference } = await import("../lib/maxwell/reference-study/study");
  const { buildCreativeOrder } = await import("../lib/maxwell/creative-order");
  const { gatherShotCandidates } = await import("../lib/maxwell/design-dossier");
  const { verifyShotCandidates } = await import("../lib/maxwell/image-verify");
  const { buildPrototypeBrief } = await import("../lib/maxwell/prototype-brief");
  const { V0_PROTOTYPE_SYSTEM_PROMPT } = await import("../lib/maxwell/prompts");
  const { createV0Prototype, getV0PrototypeStatus } = await import("../lib/api-ia");
  type StudioSessionT = import("../lib/maxwell/repositories").StudioSession;

  // Pre-flight: the ledger writes every call to the DB. If it's down, the
  // LLM helpers would swallow errors and the "new" path would silently
  // degrade into the old one — a FALSE comparison. Refuse instead.
  try {
    const sql = getDb();
    await sql`SELECT 1`;
  } catch {
    console.error(
      "La base local no responde. Arranca primero: node scripts/dev-db-server.mjs",
    );
    process.exit(1);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outRoot = path.join(".data", "fase-a-harness", runId);
  await mkdir(outRoot, { recursive: true });

  const fakeSession = (p: HarnessProject): StudioSessionT => ({
    id: `harness-${p.slug}`,
    initialPrompt: p.initialPrompt,
    status: "generating_prototype",
    ownerEmail: "harness@noon.internal",
    ownerName: "Harness",
    ownerImage: null,
    projectType: p.projectType,
    goalSummary: p.goalSummary,
    complexityHint: "low",
    language: p.language,
    correctionsUsed: 0,
    maxCorrections: 2,
    proposalRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stylePackId: null,
    direction: null,
    prototypeWorkspaceId: null,
    shareToken: null,
    shareTokenUrl: null,
    prototypeSharedAt: null,
  });

  type Row = {
    slug: string;
    pack: string;
    dossierSource: string;
    orderShots: number;
    verified: number;
    fallback: number;
    empty: number;
    oldUrl: string;
    newUrl: string;
  };
  const rows: Row[] = [];

  for (const project of PROJECTS) {
    console.log(`\n═══ ${project.slug} ═══`);
    const dir = path.join(outRoot, project.slug);
    await mkdir(dir, { recursive: true });
    const session = fakeSession(project);
    const history = [{ role: "user" as const, content: project.initialPrompt }];

    // Clasificación (asiento ejecutor) — compartida por ambos caminos.
    const { pack, imageQueries } = await classifyStylePack(session, project.initialPrompt);
    console.log(`  familia: ${pack.id}  ·  queries: ${imageQueries.join(" | ") || "(ninguna)"}`);

    // ── CAMINO VIEJO: el brief de hoy, sin cerebro ─────────────────────────
    const oldBrief = buildPrototypeBrief(
      session,
      null,
      history,
      project.lastUserMsg,
      project.lastAssistantMsg,
      pack,
    );

    // ── CAMINO NUEVO: estudio → orden → candidatos → aduana → prompt ──────
    const primaryUrl = `https://${pack.refs[0].url.replace(/^https?:\/\//, "")}`;
    console.log(`  estudiando referencia primaria: ${primaryUrl}`);
    const study = await studyReference(primaryUrl);
    console.log(`  ficha: ${study.source}${study.stale ? " (caducada)" : ""}`);

    const order = await buildCreativeOrder({
      session,
      brief: null,
      stylePack: pack,
      dossier: study.dossier,
      conversationDigest: `Client: ${project.initialPrompt}`,
    });
    console.log(`  orden: ${order ? `${order.shotList.length} shots · "${order.copy.headline}"` : "NULL (degradado)"}`);

    const slots = order ? await gatherShotCandidates(order.shotList) : [];
    const verified = order ? await verifyShotCandidates(slots) : [];
    const counts = {
      verified: verified.filter((v) => v.verdict === "verified").length,
      fallback: verified.filter((v) => v.verdict === "fallback").length,
      empty: verified.filter((v) => v.verdict === "empty").length,
    };
    console.log(`  aduana: ${counts.verified} aprobadas · ${counts.fallback} fallback · ${counts.empty} vacías`);

    const newBrief = buildPrototypeBrief(
      session,
      null,
      history,
      project.lastUserMsg,
      project.lastAssistantMsg,
      pack,
      null,
      { referenceDossier: study.dossier, order, verifiedSlots: verified },
    );

    await writeFile(path.join(dir, "old-brief.txt"), oldBrief, "utf8");
    await writeFile(path.join(dir, "new-brief.txt"), newBrief, "utf8");

    // Modo ensayo: valida toda la mitad barata (estudio → orden → aduana →
    // prompt) sin gastar generaciones de v0. La degustación real se lanza
    // sin la variable.
    if (process.env.HARNESS_SKIP_V0) {
      console.log(`  [ensayo] briefs escritos en ${dir} — v0 omitido`);
      rows.push({
        slug: project.slug,
        pack: pack.id,
        dossierSource: study.source,
        orderShots: order?.shotList.length ?? 0,
        ...counts,
        oldUrl: "(omitido)",
        newUrl: "(omitido)",
      });
      continue;
    }

    // ── v0 genera ambos ────────────────────────────────────────────────────
    console.log("  v0: generando ANTES y DESPUÉS…");
    const [oldProto, newProto] = await Promise.all([
      createV0Prototype({ prompt: oldBrief, systemPrompt: V0_PROTOTYPE_SYSTEM_PROMPT }),
      createV0Prototype({ prompt: newBrief, systemPrompt: V0_PROTOTYPE_SYSTEM_PROMPT }),
    ]);

    const waitForDemo = async (chatId: string, label: string): Promise<string> => {
      for (let i = 0; i < 36; i++) {
        const status = await getV0PrototypeStatus(chatId);
        if (status.status === "completed" && status.demoUrl) return status.demoUrl;
        if (status.status === "failed") throw new Error(`v0 falló en ${label}`);
        await new Promise((r) => setTimeout(r, 10_000));
      }
      throw new Error(`v0 no completó ${label} en 6 minutos`);
    };
    const [oldUrl, newUrl] = await Promise.all([
      waitForDemo(oldProto.chatId, "ANTES"),
      waitForDemo(newProto.chatId, "DESPUÉS"),
    ]);
    console.log(`  ANTES:   ${oldUrl}\n  DESPUÉS: ${newUrl}`);

    // ── capturas ───────────────────────────────────────────────────────────
    const { chromium } = (await import("playwright")) as unknown as {
      chromium: {
        launch(o?: object): Promise<{
          newContext(o?: object): Promise<{
            newPage(): Promise<{
              goto(u: string, o?: object): Promise<unknown>;
              waitForTimeout(ms: number): Promise<void>;
              screenshot(o?: object): Promise<Buffer>;
            }>;
            close(): Promise<void>;
          }>;
          close(): Promise<void>;
        }>;
      };
    };
    const browser = await chromium.launch({ headless: true });
    try {
      for (const [label, url] of [
        ["old", oldUrl],
        ["new", newUrl],
      ] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
        } catch {
          await page.goto(url, { waitUntil: "load", timeout: 60_000 });
        }
        await page.waitForTimeout(2_500);
        await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage: true });
        await context.close();
      }
    } finally {
      await browser.close();
    }
    console.log(`  capturas: ${path.join(dir, "old.png")} · new.png`);

    rows.push({
      slug: project.slug,
      pack: pack.id,
      dossierSource: study.source,
      orderShots: order?.shotList.length ?? 0,
      ...counts,
      oldUrl,
      newUrl,
    });
  }

  // ── index.html: la comparación lado a lado ───────────────────────────────
  const blocks = rows
    .map((r) =>
      r.oldUrl === "(omitido)"
        ? `
  <section>
    <h2>${r.slug} <small>familia ${r.pack} · ficha ${r.dossierSource} · ${r.orderShots} shots · aduana ${r.verified}/${r.fallback}/${r.empty} · ensayo sin v0</small></h2>
  </section>`
        : `
  <section>
    <h2>${r.slug} <small>familia ${r.pack} · ficha ${r.dossierSource} · ${r.orderShots} shots · aduana ${r.verified}/${r.fallback}/${r.empty}</small></h2>
    <div class="pair">
      <figure><figcaption>ANTES <a href="${r.oldUrl}">demo</a></figcaption><img src="${r.slug}/old.png" alt="antes"></figure>
      <figure><figcaption>DESPUÉS <a href="${r.newUrl}">demo</a></figcaption><img src="${r.slug}/new.png" alt="después"></figure>
    </div>
  </section>`,
    )
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>Fase A — antes/después (${runId})</title>
<style>body{font-family:system-ui;margin:24px;background:#0d0d0d;color:#eee}h1{font-size:20px}h2{font-size:16px;margin:32px 0 8px}small{color:#999;font-weight:400}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden}figcaption{padding:8px 12px;font-size:13px;color:#bbb;border-bottom:1px solid #2a2a2a}figcaption a{color:#7ab0ff}img{width:100%;display:block}</style>
<h1>Fase A — la degustación: sistema de hoy vs. cerebro nuevo</h1>
${blocks}`;
  await writeFile(path.join(outRoot, "index.html"), html, "utf8");
  await writeFile(path.join(outRoot, "summary.json"), JSON.stringify(rows, null, 2), "utf8");

  console.log(`\n✔ Listo. Abre: ${path.resolve(outRoot, "index.html")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
