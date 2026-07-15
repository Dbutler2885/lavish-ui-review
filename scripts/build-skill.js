// Generates skills/lavish/SKILL.md from the shared no-args home output so the
// installable skill never drifts from what `lavish-axi` (and the SessionStart hook) print.
//
//   node scripts/build-skill.js          # write the file
//   node scripts/build-skill.js --check  # fail (exit 1) if the committed file is stale
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createSkillMarkdown, createUiReviewSkillMarkdown } from "../src/skill.js";

const outputs = [
  { target: new URL("../skills/lavish/SKILL.md", import.meta.url), expected: createSkillMarkdown() },
  {
    target: new URL("../skills/lavish-ui-review/SKILL.md", import.meta.url),
    expected: createUiReviewSkillMarkdown(),
  },
];
const check = process.argv.includes("--check");

if (check) {
  let stale = false;
  for (const { target, expected } of outputs) {
    let actual = null;
    try {
      actual = await readFile(target, "utf8");
    } catch {
      // Missing files fall through to the mismatch branch below.
    }
    if (actual !== expected) {
      console.error(
        `${fileURLToPath(target)} is out of date. Run \`node scripts/build-skill.js\` and commit the result.`,
      );
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log("Installable skills are up to date.");
} else {
  for (const { target, expected } of outputs) {
    await mkdir(new URL("./", target), { recursive: true });
    await writeFile(target, expected);
    console.log(`Wrote ${fileURLToPath(target)}`);
  }
}
