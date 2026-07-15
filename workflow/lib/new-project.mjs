// Create a new frontend-design project folder with metadata and stage state.
// Usage: node lib/new-project.mjs <slug> [--title "Settings redesign"]
//        [--mode redesign|extend|new] [--target-repo <git-url-or-path>]
import fs from "node:fs";
import path from "node:path";
import {
  MODES,
  projectDir,
  projectJsonPath,
  slugify,
  timestamp,
  writeProject,
} from "./paths.mjs";

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith("--")) {
  console.error("Usage: fe-new.sh <slug> [--title <t>] [--mode redesign|extend|new] [--target-repo <url>]");
  process.exit(1);
}

const slug = slugify(args[0]);
const opts = {};
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith("--")) opts[args[i].slice(2)] = args[i + 1], i++;
}

if (fs.existsSync(projectJsonPath(slug))) {
  console.error(`Project already exists: ${projectJsonPath(slug)}`);
  process.exit(1);
}

// Mode is often unknown at creation; the intent stage captures it as an
// explicit choice.
let mode = null;
if (opts.mode) {
  if (!MODES.includes(opts.mode)) {
    console.error(`Unknown mode "${opts.mode}". Known: ${MODES.join(", ")}`);
    process.exit(1);
  }
  mode = opts.mode;
}

const dir = projectDir(slug);
// The per-project folder contract. intent/ is the shared intent space that
// grill-me, the intent UI, and file drops all deposit into; the builder
// reads its union. Folders are the durable truth; project.json is the
// convenience pointer.
for (const sub of ["intent/files", "mockups/assets", "renders", "handoff"]) {
  fs.mkdirSync(path.join(dir, sub), { recursive: true });
}

const now = timestamp();
writeProject(slug, {
  slug,
  title: opts.title || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  stage: "new",
  mode,
  targetRepo: opts["target-repo"] || null,
  currentMockups: [],
  createdAt: now,
  updatedAt: now,
  history: [{ at: now, event: "created" }],
});

console.log(`Created project "${slug}" at projects/${slug}/`);
console.log(mode ? `Mode: ${mode}` : "Mode: not set yet (the intent stage captures it as an explicit choice)");
if ((mode === "redesign" || mode === "extend") && !opts["target-repo"]) {
  console.log(`Note: mode "${mode}" targets existing code; record the target repo during intent.`);
}
console.log(`Next: construct intent (offer grill-me or the intent UI); deposits land in projects/${slug}/intent/.`);
