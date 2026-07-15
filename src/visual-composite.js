// Composite drawn marks onto a screenshot of the artifact they were drawn
// over, so the feedback file the agent inspects is the marks-on-the-page
// picture the user actually saw - not the marks floating on transparency.
//
// The marks are captured in the browser (draw-layer.js, Konva) as a
// transparent overlay PNG. The background does not exist there: a sandboxed
// iframe has no reliable way to raster its own DOM. So the background comes
// from a headless-Chrome screenshot of the artifact file, sized to the
// overlay's own pixel dimensions so the two line up, then the two are
// stacked into one PNG (an SVG with both images, rasterized).
//
// This ports the proven techniques from the frontend workflow's render.mjs
// (headless screenshot) and image-packet.mjs (SVG stack + rasterize) down
// into Lavish, where the drawing layer lives. It is deliberately
// best-effort: any failure (no Chrome, render timeout) leaves the caller to
// fall back to the transparent overlay, so polling never breaks.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const execFileP = promisify(execFile);

const CHROME_CANDIDATES = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

// Locate a Chromium-family binary, or null when none is present (the signal
// to skip compositing and keep the transparent overlay).
export function findChrome(env = process.env, fallbacks = CHROME_CANDIDATES) {
  const candidates = [env.LAVISH_AXI_CHROME_BIN, env.CHROME_BIN, ...fallbacks].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Read a PNG's intrinsic width/height from its IHDR chunk. The overlay's
// pixel size is the coordinate space the marks were drawn in, so it also
// dictates the screenshot size the background must be rendered at.
export function pngSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("not a PNG buffer");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function artifactUrlForState(artifactFile, state = "default") {
  const url = pathToFileURL(artifactFile);
  url.hash = `state=${encodeURIComponent(String(state || "default"))}`;
  return url.href;
}

// An SVG that stacks the overlay over the background at 1:1 scale. Both
// images are referenced by absolute file:// href so the headless rasterizer
// (run with --allow-file-access-from-files) loads them off disk.
export function compositeSvg({ backgroundPath, overlayPath, width, height }) {
  const href = (p) => esc(`file://${p}`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
    `<image href="${href(backgroundPath)}" x="0" y="0" width="${width}" height="${height}"/>\n` +
    `<image href="${href(overlayPath)}" x="0" y="0" width="${width}" height="${height}"/>\n` +
    `</svg>\n`
  );
}

function shoot(chromeBin, targetUrl, outPath, width, height, timeoutMs) {
  return execFileP(
    chromeBin,
    [
      "--headless",
      "--disable-gpu",
      "--allow-file-access-from-files",
      `--screenshot=${outPath}`,
      `--window-size=${width},${height}`,
      "--default-background-color=FFFFFFFF",
      "--hide-scrollbars",
      targetUrl,
    ],
    { timeout: timeoutMs },
  );
}

// Produce a composite PNG at outPath from the artifact file and an overlay
// PNG on disk. Two headless passes: one screenshots the artifact (which must
// execute its own JS to lay out), one rasterizes the two-image stack. On any
// failure returns null so the caller keeps the transparent overlay.
export async function renderComposite({
  artifactFile,
  overlayPngPath,
  outPath,
  state = "default",
  chromeBin = null,
  timeoutMs = 30000,
}) {
  const bin = chromeBin || findChrome();
  if (!bin) return null;
  try {
    const overlayBuffer = await readFile(overlayPngPath);
    const { width, height } = pngSize(overlayBuffer);
    const dir = path.dirname(outPath);
    await mkdir(dir, { recursive: true });

    const cleanPath = path.join(dir, "clean.png");
    await shoot(bin, artifactUrlForState(artifactFile, state), cleanPath, width, height, timeoutMs);
    if (!fs.existsSync(cleanPath)) return null;

    const svgPath = path.join(dir, "composite.svg");
    await writeFile(svgPath, compositeSvg({ backgroundPath: cleanPath, overlayPath: overlayPngPath, width, height }));
    await shoot(bin, pathToFileURL(svgPath).href, outPath, width, height, timeoutMs);
    return fs.existsSync(outPath) ? outPath : null;
  } catch {
    return null;
  }
}
