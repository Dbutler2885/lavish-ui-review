// CLI over the intent-space store. See bin/fe-intent.sh for usage.
import fs from "node:fs";
import path from "node:path";
import { projectDir, projectJsonPath } from "./paths.mjs";
import { deposit, setMode, setTargetRepo, assemble } from "./intent-space.mjs";

const [cmd, slug, ...rest] = process.argv.slice(2);

function usage() {
  console.error("Usage: fe-intent.sh deposit|note|mode|target|assemble <slug> ...  (see bin/fe-intent.sh header)");
  process.exit(1);
}

if (!cmd || !slug) usage();
const dir = projectDir(slug);
if (!fs.existsSync(projectJsonPath(slug))) {
  console.error(`No such project: ${slug}. Create it with bin/fe-new.sh first.`);
  process.exit(1);
}

try {
  switch (cmd) {
    case "deposit": {
      const source = rest[0];
      if (!source || source.startsWith("--")) usage();
      const opts = {};
      for (let i = 1; i < rest.length; i++) {
        if (rest[i].startsWith("--")) ((opts[rest[i].slice(2)] = rest[i + 1]), i++);
      }
      const entry = deposit(dir, {
        name: opts.name || path.join("files", path.basename(source)),
        sourcePath: source,
        kind: opts.kind || "file",
        tool: opts.tool || "agent",
      });
      console.log(`Deposited intent/${entry.file} (${entry.kind}, ${entry.bytes} bytes)`);
      break;
    }
    case "note": {
      const [name, ...words] = rest;
      if (!name || words.length === 0) usage();
      const entry = deposit(dir, { name, content: words.join(" ") + "\n", kind: "note", tool: "agent" });
      console.log(`Deposited intent/${entry.file}`);
      break;
    }
    case "mode": {
      if (!rest[0]) usage();
      const p = setMode(dir, rest[0]);
      console.log(`Mode: ${p.mode}`);
      break;
    }
    case "target": {
      if (!rest[0]) usage();
      const p = setTargetRepo(dir, rest[0]);
      console.log(`Target repo: ${p.targetRepo}`);
      break;
    }
    case "assemble": {
      console.log(JSON.stringify(assemble(dir), null, 2));
      break;
    }
    default:
      usage();
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
