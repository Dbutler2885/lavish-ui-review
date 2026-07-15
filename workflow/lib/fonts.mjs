// Manage the shared font library in assets/fonts/, driven by catalog.json.
//
//   sync            download any catalog fonts not yet on disk (static TTFs
//                   via the Google Fonts CSS API; a non-browser user agent
//                   makes it serve truetype). --force redownloads everything.
//   list [query]    show the catalog grouped by category; query filters on
//                   family, category, and notes.
//   use <slug> <family>
//                   copy a family's files into projects/<slug>/mockups/assets/
//                   and print ready-to-paste @font-face rules.
//
// Files live at assets/fonts/<category>/<FamilyNoSpaces>-<weight>[italic].ttf.
//
// Usage: bin/fe-fonts.sh sync|list|use ...
import fs from "node:fs";
import path from "node:path";
import { ROOT, projectDir } from "./paths.mjs";

const FONTS_DIR = path.join(ROOT, "assets", "fonts");
const catalog = JSON.parse(fs.readFileSync(path.join(FONTS_DIR, "catalog.json"), "utf8"));

const cmd = process.argv[2];
const args = process.argv.slice(3);

function fileBase(family) {
  return family.replace(/\s+/g, "");
}
function variants(entry) {
  // italicWeights overrides italic for families whose italics only exist in
  // some weights (e.g. Libre Caslon Text has no 700 italic)
  const italicWeights = entry.italicWeights ?? (entry.italic ? entry.weights : []);
  const out = [];
  for (const weight of entry.weights) {
    out.push({ weight, italic: false });
    if (italicWeights.includes(weight)) out.push({ weight, italic: true });
  }
  return out;
}
function fontPath(entry, v) {
  const name = `${fileBase(entry.family)}-${v.weight}${v.italic ? "italic" : ""}.ttf`;
  return path.join(FONTS_DIR, entry.category, name);
}

// ------------------------------------------------------------------- sync

async function sync(force) {
  let ok = 0, skipped = 0, failed = 0;
  for (const entry of catalog.families) {
    const missing = variants(entry).filter((v) => force || !fs.existsSync(fontPath(entry, v)));
    if (missing.length === 0) {
      skipped++;
      continue;
    }
    const axes = variants(entry)
      .map((v) => `${v.italic ? 1 : 0},${v.weight}`)
      .sort()
      .join(";");
    const url =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(entry.family).replace(/%20/g, "+") +
      (entry.italic ? `:ital,wght@${axes}` : `:wght@${entry.weights.join(";")}`);
    let css;
    try {
      // default (non-browser) user agent => API answers with truetype urls
      const res = await fetch(url, { headers: { "user-agent": "curl/8" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      css = await res.text();
    } catch (err) {
      console.error(`FAIL ${entry.family}: ${err.message} (${url})`);
      failed++;
      continue;
    }
    const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => ({
      style: /font-style:\s*italic/.test(m[1]) ? true : false,
      weight: parseInt(m[1].match(/font-weight:\s*(\d+)/)?.[1] || "400", 10),
      url: m[1].match(/src:\s*url\(([^)]+\.ttf)\)/)?.[1],
    }));
    let familyOk = true;
    for (const v of missing) {
      const face = faces.find((f) => f.weight === v.weight && f.style === v.italic && f.url);
      if (!face) {
        console.error(`FAIL ${entry.family} ${v.weight}${v.italic ? " italic" : ""}: variant not in API response`);
        familyOk = false;
        failed++;
        continue;
      }
      try {
        const res = await fetch(face.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const dest = fontPath(entry, v);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
      } catch (err) {
        console.error(`FAIL ${entry.family} ${v.weight}${v.italic ? " italic" : ""}: ${err.message}`);
        familyOk = false;
        failed++;
      }
    }
    if (familyOk) {
      console.log(`ok   ${entry.family} (${missing.length} file${missing.length > 1 ? "s" : ""})`);
      ok++;
    }
  }
  console.log(`\nsynced ${ok}, already present ${skipped}, failures ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

// ------------------------------------------------------------------- list

function list(query) {
  const q = (query || "").toLowerCase();
  const byCat = new Map();
  for (const entry of catalog.families) {
    const hay = `${entry.family} ${entry.category} ${entry.notes}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    if (!byCat.has(entry.category)) byCat.set(entry.category, []);
    byCat.get(entry.category).push(entry);
  }
  if (byCat.size === 0) {
    console.log(`No catalog match for "${query}".`);
    return;
  }
  for (const [cat, entries] of byCat) {
    console.log(`\n${cat}`);
    for (const entry of entries) {
      const have = variants(entry).every((v) => fs.existsSync(fontPath(entry, v)));
      const w = entry.weights.join("/") + (entry.italic ? " +italic" : "");
      console.log(`  ${have ? " " : "!"} ${entry.family.padEnd(24)} ${w.padEnd(16)} ${entry.notes}`);
    }
  }
  console.log("\n('!' = not downloaded yet; run bin/fe-fonts.sh sync)");
}

// -------------------------------------------------------------------- use

function use(slug, familyQuery) {
  if (!slug || !familyQuery) {
    console.error("Usage: pdf-fonts.sh use <slug> <family>");
    process.exit(1);
  }
  const q = familyQuery.toLowerCase();
  const matches = catalog.families.filter((e) => e.family.toLowerCase().includes(q));
  if (matches.length !== 1) {
    console.error(
      matches.length === 0
        ? `No catalog family matches "${familyQuery}".`
        : `Ambiguous: ${matches.map((m) => m.family).join(", ")}`
    );
    process.exit(1);
  }
  const entry = matches[0];
  const destDir = path.join(projectDir(slug), "mockups", "assets");
  fs.mkdirSync(destDir, { recursive: true });
  const rules = [];
  for (const v of variants(entry)) {
    const src = fontPath(entry, v);
    if (!fs.existsSync(src)) {
      console.error(`Missing ${src}; run bin/fe-fonts.sh sync first.`);
      process.exit(1);
    }
    const name = path.basename(src);
    fs.copyFileSync(src, path.join(destDir, name));
    rules.push(
      `@font-face {\n  font-family: "${entry.family}";\n  src: url("assets/${name}");\n  font-weight: ${v.weight};\n  font-style: ${v.italic ? "italic" : "normal"};\n}`
    );
  }
  console.log(`Copied ${variants(entry).length} file(s) to projects/${slug}/mockups/assets/`);
  console.log("\n" + rules.join("\n"));
}

if (cmd === "sync") await sync(args.includes("--force"));
else if (cmd === "list") list(args.filter((a) => !a.startsWith("--")).join(" "));
else if (cmd === "use") use(args[0], args.slice(1).join(" "));
else {
  console.error("Usage: pdf-fonts.sh sync [--force] | list [query] | use <slug> <family>");
  process.exit(1);
}
