// Render a mockup screen to a PNG under Lavish-equivalent sandbox conditions
// (slice 03; the loop-1 self-review gate and unit image packets consume
// these renders).
//
// The mockup is loaded inside an <iframe sandbox="allow-scripts"> - no
// allow-same-origin - which reproduces what the Lavish viewer imposes: an
// opaque origin where localStorage THROWS and file-path fonts are
// CORS-checked. A plain direct load hides both.
//
// MACHINE QUIRKS (bisected 2026-07-05, Brave 150): headless Brave hangs
// forever when given a fresh --user-data-dir, so no profile flag is ever
// passed. Serving over local http from THIS process would also deadlock
// (execFileSync blocks the event loop under the server), so no server: the
// wrapper is a temp FILE next to the mockup, which keeps the iframe's
// relative asset paths working.
//
// lintSandbox() additionally flags the hazards statically so they are
// caught even when a render is skipped.
//
// States: the wrapper's iframe src carries #state=<id>; the mockup contract
// (templates/mockup-starter.html) activates that in-place state from
// location.hash.
//
// Usage: node lib/render.mjs <slug> [screen.html] [--state <id>]
//        [--width 1280] [--height 800] [--out <path.png>]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { projectDir, readProject } from "./paths.mjs";

export function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("No Chromium found; set CHROME_BIN.");
}

// Static checks for Lavish-sandbox hazards, catching them even without a
// render. Returns human-readable warnings; empty = clean.
export function lintSandbox(html) {
  const warnings = [];
  const storage = html.match(/^.*(localStorage|sessionStorage).*$/gm) ?? [];
  for (const line of storage) {
    if (!/try\s*{|catch|\/\//.test(line)) {
      warnings.push(`unguarded storage access (throws under Lavish sandbox): ${line.trim().slice(0, 100)}`);
    }
  }
  const fontRefs = html.match(/url\(["']?[^)"']*\.(ttf|otf|woff2?)["']?\)/gi) ?? [];
  for (const ref of fontRefs) {
    if (!ref.includes("data:")) {
      warnings.push(`file-path font (CORS-blocked under Lavish sandbox; inline as data URI): ${ref}`);
    }
  }
  return warnings;
}

// Render one screen+state of a project's mockup to a PNG. Returns
// { png, warnings }.
export async function renderMockup(slug, screenName, { state = "default", width = 1280, height = 800, out } = {}) {
  const mockupsDir = path.join(projectDir(slug), "mockups");
  const screenPath = path.join(mockupsDir, screenName);
  if (!fs.existsSync(screenPath)) throw new Error(`No such mockup: ${screenPath}`);
  const outPath = out ?? path.join(projectDir(slug), "renders", `${screenName.replace(/\.html?$/i, "")}-${state}.png`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const warnings = lintSandbox(fs.readFileSync(screenPath, "utf8"));

  const hash = state === "default" ? "" : `#state=${encodeURIComponent(state)}`;
  // The wrapper lives next to the mockup so the iframe's relative asset
  // paths resolve; it is a temp file, cleaned up after the shot.
  const wrapPath = path.join(mockupsDir, `.render-wrap-${process.pid}.html`);
  fs.writeFileSync(
    wrapPath,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style>` +
      `<iframe sandbox="allow-scripts" src="${encodeURIComponent(screenName)}${hash}"></iframe>`,
  );
  const chrome = findChrome();
  try {
    execFileSync(
      chrome,
      [
        // NOTE: no --user-data-dir and no http URL - both hang headless Brave
        // on this machine (see header).
        "--headless",
        "--disable-gpu",
        "--allow-file-access-from-files",
        `--screenshot=${outPath}`,
        `--window-size=${width},${height}`,
        "--default-background-color=FFFFFFFF",
        "--hide-scrollbars",
        `file://${wrapPath}`,
      ],
      { stdio: "pipe", timeout: 30000 },
    );
  } finally {
    fs.unlinkSync(wrapPath);
  }
  if (!fs.existsSync(outPath)) throw new Error("Render produced no output.");
  return { png: outPath, warnings };
}

// CLI
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const [slug, ...rest] = process.argv.slice(2);
  if (!slug) {
    console.error("Usage: fe-render.sh <slug> [screen.html] [--state <id>] [--width N] [--height N] [--out path]");
    process.exit(1);
  }
  const opts = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) ((opts[rest[i].slice(2)] = rest[i + 1]), i++);
    else positional.push(rest[i]);
  }
  const project = readProject(slug);
  let screen = positional[0] || project.currentMockups?.[0];
  if (!screen) {
    const mockupsDir = path.join(projectDir(slug), "mockups");
    screen = fs.existsSync(mockupsDir) ? fs.readdirSync(mockupsDir).find((f) => f.endsWith(".html")) : null;
  }
  if (!screen) {
    console.error(`No mockup found for "${slug}". Put a screen in projects/${slug}/mockups/ first.`);
    process.exit(1);
  }
  renderMockup(slug, path.basename(screen), {
    state: opts.state || "default",
    width: Number(opts.width) || 1280,
    height: Number(opts.height) || 800,
    out: opts.out,
  }).then(
    ({ png, warnings }) => {
      for (const w of warnings) console.error(`WARN: ${w}`);
      console.log(png);
    },
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}
