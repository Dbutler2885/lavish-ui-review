// Render a review surface under the same sandbox conditions the Lavish
// viewer imposes, so sandbox-only breakage (localStorage throwing,
// CORS-blocked file-path fonts) is caught BEFORE the human opens it, and so
// the agent can do its own design review of what the client will see.
//
// A plain file:// load is same-origin and hides these failures entirely.
// This helper serves the target's directory over local HTTP, wraps the HTML
// in an <iframe sandbox="allow-scripts"> (no allow-same-origin, matching
// Lavish), prints it with headless Chrome, rasterizes every page with
// pdftoppm, and writes the PNGs next to the target. The agent must then
// LOOK at them: real fonts, full layout, nothing collapsed or clipped.
//
// With no file argument it checks the project's generated proof.
//
// Usage: node lib/sandbox-check.mjs <slug> [file.html]
//        (file.html is relative to the project folder, e.g.
//         design-language/proposal-1.html, or an absolute path)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
import { projectDir, readProject, toInches } from "./paths.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: pdf-check.sh <slug> [file.html]");
  process.exit(1);
}
const project = readProject(slug);

let targetPath;
if (process.argv[3]) {
  targetPath = path.resolve(projectDir(slug), process.argv[3]);
  if (!fs.existsSync(targetPath)) {
    console.error(`No such file: ${targetPath}`);
    process.exit(1);
  }
} else {
  targetPath = path.join(projectDir(slug), "drafts", "proof", "proof.html");
  if (!fs.existsSync(targetPath)) {
    console.error(`No proof found for "${slug}". Run bin/pdf-proof.sh ${slug} first, or pass a file to check.`);
    process.exit(1);
  }
}
const serveDir = path.dirname(targetPath);
const targetName = path.basename(targetPath);
const shotStem = targetName.replace(/\.html?$/i, "") + "-sandbox-check";

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
};

// Oversized print pages capture the whole surface; the wrapper is printed
// with --print-to-pdf (Brave's --screenshot hangs on this machine) and then
// every page is rasterized with pdftoppm.
const fmtForSize = project.format || {};
const pageWIn = Math.max(12, toInches(fmtForSize.width || "8.5in") + 3);
const pageHIn = Math.max(24, toInches(fmtForSize.height || "11in") * 2.4 + 4);
const wrapper = `<!doctype html>
<html><head><meta charset="utf-8"><title>sandbox check</title>
<style>
@page { size: ${pageWIn}in ${pageHIn}in; margin: 0; }
html,body{margin:0}
iframe{border:0;width:${pageWIn}in;height:${pageHIn}in;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style>
</head><body>
<iframe sandbox="allow-scripts" src="/${encodeURIComponent(targetName)}"></iframe>
</body></html>`;

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (urlPath === "/" || urlPath === "/wrapper.html") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(wrapper);
    return;
  }
  const filePath = path.join(serveDir, urlPath);
  if (!filePath.startsWith(serveDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  // No CORS headers on purpose: the sandboxed iframe has an opaque origin,
  // so this reproduces the Lavish viewer's font/CORS behavior.
  res.writeHead(200, { "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
});

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Arc.app/Contents/MacOS/Arc",
  "google-chrome",
  "chromium",
].filter(Boolean);
let chrome = null;
for (const candidate of CHROME_CANDIDATES) {
  try {
    if (candidate.includes("/") ? fs.existsSync(candidate) : (execFileSync("which", [candidate], { stdio: "pipe" }), true)) {
      chrome = candidate;
      break;
    }
  } catch {}
}
if (!chrome) {
  console.error("No Chrome/Chromium found. Install Google Chrome or set CHROME_BIN.");
  process.exit(1);
}

server.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-check-"));
  const tmpPdf = path.join(tmpDir, "check.pdf");
  try {
    // stale shots from a previous run must not survive next to fresh ones
    for (const f of fs.readdirSync(serveDir)) {
      if (f.startsWith(shotStem) && f.endsWith(".png")) fs.unlinkSync(path.join(serveDir, f));
    }
    // Chrome must run async: a sync spawn would block the event loop and
    // deadlock the HTTP server that Chrome is trying to fetch from.
    await execFileP(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=8000",
      "--print-to-pdf=" + tmpPdf,
      `http://127.0.0.1:${port}/wrapper.html`,
    ], { timeout: 120000 });
    execFileSync("pdftoppm", ["-png", "-r", "72", tmpPdf, path.join(serveDir, shotStem)], { stdio: "pipe", timeout: 60000 });
    const shots = fs.readdirSync(serveDir).filter((f) => f.startsWith(shotStem) && f.endsWith(".png")).sort();
    if (shots.length === 0) throw new Error("pdftoppm produced no PNG");
    for (const shot of shots) console.log(path.join(serveDir, shot));
    console.log("Now LOOK at these: real fonts, full layout, nothing collapsed or clipped.");
  } catch (err) {
    console.error("Sandbox check failed: " + err.message);
    console.error("Requires headless Chrome and pdftoppm (brew install poppler).");
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
