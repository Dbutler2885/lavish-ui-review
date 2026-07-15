// Wrap a fixed-viewport mockup in a review surface for Lavish (the web
// analog of the print workspace's proof-wrap).
//
// The mockup's markup is INLINED into the review document (never an
// <iframe>) so Lavish's annotation layer can see and target the actual
// elements - annotation dies at an iframe boundary. The wrapper:
//   - centers the fixed .screen canvas on a neutral backdrop,
//   - scales it to fit the space Lavish's conversation sidebar leaves,
//   - adds a slim toolbar with the screen name and true size.
// Lavish itself owns the state tab strip.
//
// Generated into mockups/review/; regenerate, do not edit.
//
// Usage: node lib/review-wrap.mjs <slug> [screen.html]
import fs from "node:fs";
import path from "node:path";
import { projectDir, readProject, timestamp, writeProject } from "./paths.mjs";

// NOTE: Lavish renders the artifact in its own sandboxed iframe whose width
// already excludes the conversation panel (grid: 1fr + 360px), so the
// wrapper fits to its OWN innerWidth - no sidebar math here.

export function reviewToolbar({ title, screenName, width, height }) {
  return `<div class="rv-bar"><b>${title}</b> &middot; ${screenName} &middot; ${width}&times;${height}</div>`;
}

export function reviewWrap(slug, screenName) {
  const project = readProject(slug);
  const mockupsDir = path.join(projectDir(slug), "mockups");
  const screenPath = path.join(mockupsDir, screenName);
  const html = fs.readFileSync(screenPath, "utf8");

  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error(`${screenName}: no <body> found`);
  const body = bodyMatch[1];

  const sizeMatch = styles.match(/\.screen\s*{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/s);
  const [w, h] = sizeMatch ? [Number(sizeMatch[1]), Number(sizeMatch[2])] : [1280, 800];

  const title = `Review: ${project.title} - ${screenName.replace(/\.html?$/i, "")}`;
  const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  html, body { margin: 0; }
  body { background: #101013; min-height: 100vh; }
  .rv-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; color: #9aa0ae;
    font: 12px/1 -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  .rv-bar b { color: #d8deea; font-size: 13px; }
  .rv-stage { padding: 6px 24px 40px; }
  .rv-fit { transform-origin: top left; width: ${w}px; }
  .rv-frame { width: ${w}px; height: ${h}px; outline: 1px solid #33363f; }
  /* ---- inlined mockup styles ---- */
${styles}
</style>
</head>
<body>
  ${reviewToolbar({ title: project.title, screenName, width: w, height: h })}
  <div class="rv-stage"><div class="rv-fit"><div class="rv-frame">
${body}
  </div></div></div>
<script>
  // Scale the fixed canvas to this document's viewport (Lavish's artifact
  // iframe is already sidebar-reduced). No storage access (Lavish sandbox:
  // localStorage throws).
  (function () {
    var W = ${w};
    function fit() {
      var avail = window.innerWidth - 48;
      var s = Math.min(1, avail / W);
      document.querySelector(".rv-fit").style.transform = "scale(" + s + ")";
      document.querySelector(".rv-stage").style.height = (document.querySelector(".rv-frame").offsetHeight * s + 60) + "px";
    }
    fit();
    window.addEventListener("resize", fit);
  })();
</script>
</body>
</html>
`;

  const reviewDir = path.join(mockupsDir, "review");
  fs.mkdirSync(reviewDir, { recursive: true });
  const outPath = path.join(reviewDir, screenName.replace(/\.html?$/i, "") + "-review.html");
  fs.writeFileSync(outPath, out);

  project.updatedAt = timestamp();
  project.history.push({ at: project.updatedAt, event: `review surface generated: ${path.basename(outPath)}` });
  writeProject(slug, project);
  return outPath;
}

// CLI
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const [slug, screenArg] = process.argv.slice(2);
  if (!slug) {
    console.error("Usage: fe-review.sh <slug> [screen.html]");
    process.exit(1);
  }
  const project = readProject(slug);
  const screen = screenArg || project.currentMockups?.[0];
  if (!screen) {
    console.error(`No mockup found for "${slug}".`);
    process.exit(1);
  }
  try {
    console.log(reviewWrap(slug, path.basename(screen)));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
