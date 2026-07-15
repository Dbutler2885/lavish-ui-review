// Print a recovery-friendly status summary for one project or all projects.
// The summary is derived from what is actually on disk, then compared with
// project.json, so a stale state file is flagged instead of trusted.
// Usage: node lib/status.mjs [slug]
import fs from "node:fs";
import path from "node:path";
import { listProjects, projectDir, readProject } from "./paths.mjs";

function entries(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => !f.startsWith(".") && filter(f));
}

function latest(dir, exts) {
  const files = entries(dir, (f) => exts.some((e) => f.toLowerCase().endsWith(e)))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.f ?? null;
}

function inspect(slug) {
  const dir = projectDir(slug);
  const p = readProject(slug);
  // intent/ deposits: anything except the (possibly empty) files/ subdir,
  // plus dropped files inside files/.
  const intentDeposits =
    entries(path.join(dir, "intent"), (f) => f !== "files").length + entries(path.join(dir, "intent", "files")).length;
  const disk = {
    intentDeposits,
    mockups: entries(path.join(dir, "mockups"), (f) => f.endsWith(".html")),
    latestMockup: latest(path.join(dir, "mockups"), [".html"]),
    renders: entries(path.join(dir, "renders")).length,
    queue: entries(path.join(dir, "queue")).length,
    handoff: entries(path.join(dir, "handoff")).length,
  };

  // What the folder contents imply the stage should at least be.
  // "approved" is an explicit human action and is never disk-implied.
  let implied = "new";
  if (disk.intentDeposits > 0) implied = "intent";
  if (disk.mockups.length > 0) implied = "build";
  if (disk.queue > 0) implied = "iterate";
  if (disk.handoff > 0) implied = "handoff";

  return { p, disk, implied };
}

function report(slug) {
  const { p, disk, implied } = inspect(slug);
  const mode = p.mode ? `mode: ${p.mode}` : "mode not set";
  console.log(`${slug}  [${p.stage}]  ${p.title}  (${mode})`);
  console.log(`  intent: ${disk.intentDeposits} deposit(s)`);
  if (p.targetRepo) console.log(`  target repo: ${p.targetRepo}`);
  if (disk.mockups.length > 0) {
    console.log(`  mockups: ${disk.mockups.length} screen(s), latest: mockups/${disk.latestMockup}`);
  }
  if (disk.renders > 0) console.log(`  renders: ${disk.renders} file(s)`);
  if (disk.queue > 0) console.log(`  queue: ${disk.queue} item(s)`);
  if (disk.handoff > 0) console.log(`  handoff: ${disk.handoff} file(s) bundled`);
  // Rank stages so we can tell when the folder is ahead of the state file.
  const rank = { new: 0, intent: 1, build: 2, iterate: 3, approved: 4, handoff: 5 };
  if ((rank[implied] ?? 0) > (rank[p.stage] ?? 0)) {
    console.log(
      `  NOTE: folder contents imply stage "${implied}" but project.json says "${p.stage}" - state file may be stale.`,
    );
  }
}

const slug = process.argv[2];
const slugs = slug ? [slug] : listProjects();
if (slugs.length === 0) console.log("No projects yet. Create one with: bin/fe-new.sh <slug>");
for (const s of slugs) report(s);
