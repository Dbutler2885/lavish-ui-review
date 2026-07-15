// Local intake UI server for one project. Zero npm dependencies.
//
// Collects files, global notes, per-item notes, format settings, and an
// optional blocking sketch into projects/<slug>/intake/. Working state is
// autosaved to intake/intake-state.json so intake is restartable. "Finish
// intake" writes the agent-facing packet: notes.md, manifest.json, and
// blocking.png, then advances project.json to stage "intake-complete".
//
// Usage: node lib/intake-server.mjs <slug> [--port 0] [--no-open]
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import {
  FORMATS,
  STATE_DIR,
  projectDir,
  readProject,
  timestamp,
  writeProject,
} from "./paths.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: pdf-intake.sh <slug> [--port <n>] [--no-open]");
  process.exit(1);
}
const dir = projectDir(slug);
if (!fs.existsSync(path.join(dir, "project.json"))) {
  console.error(`No such project: ${slug}. Create it first with bin/pdf-new.sh ${slug}`);
  process.exit(1);
}
const argPort = process.argv.includes("--port") ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10) : 0;
const noOpen = process.argv.includes("--no-open");

const intakeDir = path.join(dir, "intake");
const filesDir = path.join(intakeDir, "files");
fs.mkdirSync(filesDir, { recursive: true });
const statePath = path.join(intakeDir, "intake-state.json");

// ---------------------------------------------------------------- state

function defaultState() {
  const p = readProject(slug);
  return {
    notes: [],            // [{ id, text, createdAt }]
    inspo: [],            // [{ id, text, createdAt }] inspiration sources / style preferences
    items: {},            // filename -> { note, inspo }
    format: p.format || { kind: "postcard", width: "5in", height: "7in", bleed: "0.125in", safeZone: "0.25in" },
    printIntent: "home-or-office-printer",
    orientation: null,    // derived from width/height; kept for UI round-trip
    sketchStrokes: [],    // [{ color, size, points: [[x,y],...] }] normalized 0..1
    finishedAt: null,
  };
}

let state = fs.existsSync(statePath)
  ? { ...defaultState(), ...JSON.parse(fs.readFileSync(statePath, "utf8")) }
  : defaultState();

function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

// ------------------------------------------------------- file utilities

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const FONT_EXT = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const DOC_EXT = new Set([".md", ".txt", ".doc", ".docx", ".rtf", ".pages"]);

function categorize(name) {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (FONT_EXT.has(ext)) return "font";
  if (DOC_EXT.has(ext)) return "document";
  return "other";
}

// Minimal header parsing for PNG / JPEG / GIF dimensions.
function imageDimensions(buf, name) {
  const ext = path.extname(name).toLowerCase();
  try {
    if (ext === ".png" && buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (ext === ".gif" && buf.length > 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if ((ext === ".jpg" || ext === ".jpeg") && buf.length > 4) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch { /* dimensions stay unknown */ }
  return null;
}

function safeName(name) {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_");
  let candidate = base;
  let n = 1;
  while (fs.existsSync(path.join(filesDir, candidate))) {
    const ext = path.extname(base);
    candidate = `${base.slice(0, base.length - ext.length)}-${n}${ext}`;
    n++;
  }
  return candidate;
}

function listFiles() {
  return fs
    .readdirSync(filesDir)
    .filter((f) => !f.startsWith("."))
    .sort()
    .map((name) => {
      const full = path.join(filesDir, name);
      const stat = fs.statSync(full);
      const category = categorize(name);
      let dims = null;
      if (category === "image" && path.extname(name).toLowerCase() !== ".svg") {
        dims = imageDimensions(fs.readFileSync(full), name);
      }
      return {
        name,
        category,
        bytes: stat.size,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        note: state.items[name]?.note || "",
        inspiration: !!state.items[name]?.inspo,
      };
    });
}

// ------------------------------------------------------- finish outputs

function writeManifest() {
  const manifest = {
    savedAt: timestamp(),
    format: state.format,
    printIntent: state.printIntent,
    hasBlockingSketch: fs.existsSync(path.join(intakeDir, "blocking.png")),
    files: listFiles(),
  };
  fs.writeFileSync(path.join(intakeDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function writeNotesMd(manifest) {
  const p = readProject(slug);
  const lines = [];
  lines.push(`# Intake notes: ${p.title}`);
  lines.push("");
  lines.push(`Saved ${manifest.savedAt}.`);
  lines.push("");
  lines.push("## Format");
  lines.push("");
  const f = state.format;
  lines.push(`- Kind: ${f.kind}`);
  lines.push(`- Size: ${f.width} x ${f.height}`);
  lines.push(`- Bleed: ${f.bleed}`);
  lines.push(`- Safe zone: ${f.safeZone}`);
  lines.push(`- Print intent: ${state.printIntent}`);
  lines.push("");
  lines.push("## Global notes");
  lines.push("");
  if (state.notes.length === 0) {
    lines.push("(none)");
  } else {
    for (const n of state.notes) {
      lines.push(`- ${n.text.replace(/\n/g, "\n  ")}`);
    }
  }
  lines.push("");
  lines.push("## Inspiration and style preferences");
  lines.push("");
  if (state.inspo.length === 0) {
    lines.push("(none given; infer the tradition from the brief and files)");
  } else {
    lines.push("The client named these styles, sources, and preferences; steer research toward them:");
    lines.push("");
    for (const n of state.inspo) {
      lines.push(`- ${n.text.replace(/\n/g, "\n  ")}`);
    }
  }
  lines.push("");
  lines.push("## Files");
  lines.push("");
  if (manifest.files.length === 0) {
    lines.push("(none)");
  } else {
    for (const file of manifest.files) {
      const dims = file.width ? `, ${file.width}x${file.height}px` : "";
      lines.push(`### files/${file.name}${file.inspiration ? " (inspiration)" : ""}`);
      lines.push("");
      lines.push(`Type: ${file.category}${dims}, ${file.bytes} bytes.`);
      if (file.inspiration) {
        lines.push("Marked by the client as inspiration/reference: treat it as a style cue and a clue for what tradition to research, not as content to place.");
      }
      if (file.note) {
        lines.push("");
        lines.push(file.note);
      }
      lines.push("");
    }
  }
  if (manifest.hasBlockingSketch) {
    lines.push("## Blocking sketch");
    lines.push("");
    lines.push("A rough blocking sketch was drawn during intake: `intake/blocking.png`.");
    lines.push("Treat it as visual guidance for the first draft, not structured geometry.");
    lines.push("");
  }
  fs.writeFileSync(path.join(intakeDir, "notes.md"), lines.join("\n"));
}

// --------------------------------------------------------------- server

const uiHtml = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "intake-ui.html"), "utf8");

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req, limitBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(uiHtml);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/project") {
      const p = readProject(slug);
      json(res, 200, { project: p, state, files: listFiles(), formats: FORMATS });
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/files/")) {
      const name = path.basename(decodeURIComponent(url.pathname.slice("/files/".length)));
      const full = path.join(filesDir, name);
      if (!fs.existsSync(full)) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "Content-Type": MIME[path.extname(name).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(full).pipe(res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/upload") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const name = safeName(body.name || "file");
      const buf = Buffer.from(body.dataBase64, "base64");
      fs.writeFileSync(path.join(filesDir, name), buf);
      json(res, 200, { ok: true, name });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/delete-file") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const name = path.basename(body.name || "");
      const full = path.join(filesDir, name);
      if (fs.existsSync(full)) fs.unlinkSync(full);
      delete state.items[name];
      saveState();
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/state") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      for (const key of ["notes", "inspo", "items", "format", "printIntent", "sketchStrokes"]) {
        if (key in body) state[key] = body[key];
      }
      saveState();
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/finish") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      // Persist any final state included with the finish call.
      for (const key of ["notes", "inspo", "items", "format", "printIntent", "sketchStrokes"]) {
        if (key in body) state[key] = body[key];
      }
      if (body.sketchPngBase64) {
        fs.writeFileSync(path.join(intakeDir, "blocking.png"), Buffer.from(body.sketchPngBase64, "base64"));
      }
      state.finishedAt = timestamp();
      saveState();
      const manifest = writeManifest();
      writeNotesMd(manifest);
      const p = readProject(slug);
      p.format = state.format;
      p.stage = "intake-complete";
      p.updatedAt = timestamp();
      p.history.push({ at: timestamp(), event: "intake-complete" });
      writeProject(slug, p);
      json(res, 200, { ok: true, notes: "intake/notes.md", manifest: "intake/manifest.json" });
      console.log(`Intake complete for "${slug}". Wrote notes.md and manifest.json. Shutting down in 3s.`);
      setTimeout(() => process.exit(0), 3000);
      return;
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 500, { error: String(err.message || err) });
  }
});

server.listen(argPort, "127.0.0.1", () => {
  const port = server.address().port;
  const urlStr = `http://127.0.0.1:${port}/`;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(STATE_DIR, `intake-${slug}.json`),
    JSON.stringify({ slug, port, pid: process.pid, startedAt: timestamp() }, null, 2) + "\n"
  );
  console.log(`Intake UI for "${slug}" running at ${urlStr}`);
  console.log("Finish intake in the browser to write the packet and stop this server.");
  if (!noOpen && process.platform === "darwin") execFile("open", [urlStr]);
});

process.on("exit", () => {
  try { fs.unlinkSync(path.join(STATE_DIR, `intake-${slug}.json`)); } catch { /* already gone */ }
});
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => process.exit(0));
}
