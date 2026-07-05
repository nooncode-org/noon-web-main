// One-off: optimize the NORR mockup product photos for inline base64 embedding.
// Product shots → 640px, the wide lamp hero → 1280px. JPEG q82. Writes to opt/.
import sharp from "sharp";
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve("design/mockup-assets");
const OUT = path.join(DIR, "opt");

// per-image target width (longest side); default 640 for product-on-white shots
const WIDTHS = {
  "lamp-scene": 1280, // wide lifestyle hero
  "lamp-sage": 900, // closer lifestyle
  "lamp-studio": 1400, // large standalone hero product shot
};

await mkdir(OUT, { recursive: true });

const files = (await readdir(DIR)).filter((f) => f.endsWith(".png"));
let total = 0;
for (const f of files) {
  const name = path.basename(f, ".png");
  const width = WIDTHS[name] ?? 640;
  const outPath = path.join(OUT, `${name}.jpg`);
  await sharp(path.join(DIR, f))
    .resize({ width, withoutEnlargement: true })
    .flatten({ background: "#f6f5f1" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outPath);
  const kb = Math.round((await stat(outPath)).size / 1024);
  total += kb;
  console.log(`${name.padEnd(20)} ${String(width).padStart(4)}px  ${kb} KB`);
}
console.log(`\nTOTAL optimizado: ${total} KB (${(total / 1024).toFixed(1)} MB) para ${files.length} imágenes`);
