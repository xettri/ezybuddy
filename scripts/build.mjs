import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";

const rootDir = new URL("..", import.meta.url).pathname;
const outdir = resolve(rootDir, "dist");

/** Simple helper to copy static files like manifest and HTML. */
function copyStatic() {
  const manifestSrc = resolve(rootDir, "public", "manifest.json");
  const manifestDest = resolve(outdir, "manifest.json");
  mkdirSync(dirname(manifestDest), { recursive: true });
  copyFileSync(manifestSrc, manifestDest);

  const htmlFiles = ["popup.html", "options.html", "offscreen.html"];
  for (const file of htmlFiles) {
    const src = resolve(rootDir, "public", file);
    const dest = resolve(outdir, file);
    try {
      copyFileSync(src, dest);
    } catch {
      // optional, ignore if missing
    }
  }

  // Copy icons directory so manifest icon paths work.
  const iconSizes = ["16", "32", "48", "128"];
  const iconsOutDir = resolve(outdir, "icons");
  mkdirSync(iconsOutDir, { recursive: true });
  for (const size of iconSizes) {
    const filename = `icon${size}.png`;
    const src = resolve(rootDir, "public", "icons", filename);
    const dest = resolve(iconsOutDir, filename);
    try {
      copyFileSync(src, dest);
    } catch {
      // ignore missing icons; Chrome will just not display those sizes
    }
  }
}

async function run() {
  await build({
    entryPoints: {
      background: resolve(rootDir, "src/background/index.ts"),
      contentMain: resolve(rootDir, "src/content/main.ts"),
      options: resolve(rootDir, "src/ui/options.ts"),
      offscreen: resolve(rootDir, "src/offscreen/index.ts"),
    },
    bundle: true,
    sourcemap: true,
    outdir,
    target: ["chrome114"],
    format: "iife",
    platform: "browser",
    external: ["url", "path", "fs"],
  });

  copyStatic();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
