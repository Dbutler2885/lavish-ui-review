// The intent-space store: the shared folder every intent tool deposits into
// and the mockup builder reads as a union.
//
// A project's intent space is projects/<slug>/intent/. Deposits are plain
// files plus one entry in intent/index.json recording kind, tool, and time.
// Folder-as-truth: files dropped in without going through deposit() are not
// lost - assemble() includes them as "unindexed". The index enriches; the
// folder decides.
//
// Core functions operate on a project directory path so they can be tested
// against temp dirs; the CLI (bin/fe-intent.sh) resolves slug -> dir.
import fs from "node:fs";
import path from "node:path";
import { MODES, timestamp } from "./paths.mjs";

// Deposit kinds are advisory labels for the builder, not a closed enum;
// these are the expected ones.
export const KINDS = ["brief", "grill-me", "unit", "image", "wireframe", "note", "file", "unindexed"];

export function intentDir(projectDir) {
  return path.join(projectDir, "intent");
}

function indexPath(projectDir) {
  return path.join(intentDir(projectDir), "index.json");
}

export function readIndex(projectDir) {
  if (!fs.existsSync(indexPath(projectDir))) return { deposits: [] };
  return JSON.parse(fs.readFileSync(indexPath(projectDir), "utf8"));
}

function writeIndex(projectDir, index) {
  fs.mkdirSync(intentDir(projectDir), { recursive: true });
  fs.writeFileSync(indexPath(projectDir), JSON.stringify(index, null, 2) + "\n");
}

function readProjectJson(projectDir) {
  return JSON.parse(fs.readFileSync(path.join(projectDir, "project.json"), "utf8"));
}

function writeProjectJson(projectDir, data) {
  fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(data, null, 2) + "\n");
}

// Deposit an artifact into the intent space.
// Exactly one of content (string/Buffer) or sourcePath (file to copy) is
// required. name is the destination filename inside intent/ (subpaths like
// "files/logo.png" are allowed). Returns the index entry.
export function deposit(projectDir, { name, content, sourcePath, kind = "note", tool = "agent" }) {
  if (!name || /(^|[\\/])\.\.([\\/]|$)/.test(name) || path.isAbsolute(name)) {
    throw new Error(`Invalid deposit name: ${name}`);
  }
  if ((content == null) === (sourcePath == null)) {
    throw new Error("Provide exactly one of content or sourcePath.");
  }
  const dest = path.join(intentDir(projectDir), name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (sourcePath != null) {
    fs.copyFileSync(sourcePath, dest);
  } else {
    fs.writeFileSync(dest, content);
  }
  const entry = {
    file: name.split(path.sep).join("/"),
    kind,
    tool,
    at: timestamp(),
    bytes: fs.statSync(dest).size,
  };
  const index = readIndex(projectDir);
  // Re-depositing the same file replaces its entry rather than duplicating.
  index.deposits = index.deposits.filter((d) => d.file !== entry.file);
  index.deposits.push(entry);
  writeIndex(projectDir, index);
  return entry;
}

// Record the job mode (an explicit choice captured during intent).
export function setMode(projectDir, mode) {
  if (!MODES.includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Known: ${MODES.join(", ")}`);
  }
  const p = readProjectJson(projectDir);
  p.mode = mode;
  p.updatedAt = timestamp();
  p.history.push({ at: p.updatedAt, event: `mode set: ${mode}` });
  writeProjectJson(projectDir, p);
  return p;
}

// Record the target repo for redesign/extend modes.
export function setTargetRepo(projectDir, url) {
  if (!url || typeof url !== "string") throw new Error("Target repo must be a non-empty string.");
  const p = readProjectJson(projectDir);
  p.targetRepo = url;
  p.updatedAt = timestamp();
  p.history.push({ at: p.updatedAt, event: `target repo set: ${url}` });
  writeProjectJson(projectDir, p);
  return p;
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".") || name === "index.json") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

// Assemble the compact builder packet: project identity, mode, target repo,
// and the union of everything in the intent space. Indexed deposits carry
// their metadata; files present on disk but not indexed are included as
// kind "unindexed" (folder-as-truth). Indexed entries whose file has been
// deleted are dropped.
export function assemble(projectDir) {
  const p = readProjectJson(projectDir);
  const onDisk = walk(intentDir(projectDir));
  const index = readIndex(projectDir);
  const indexed = new Map(index.deposits.map((d) => [d.file, d]));
  const deposits = onDisk.map((file) => {
    const entry = indexed.get(file);
    if (entry) return entry;
    return {
      file,
      kind: "unindexed",
      tool: null,
      at: null,
      bytes: fs.statSync(path.join(intentDir(projectDir), file)).size,
    };
  });
  return {
    slug: p.slug,
    title: p.title,
    mode: p.mode,
    targetRepo: p.targetRepo,
    assembledAt: timestamp(),
    deposits,
  };
}
