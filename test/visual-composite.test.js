import test from "node:test";
import assert from "node:assert/strict";

import { artifactUrlForState, compositeSvg, findChrome, pngSize } from "../src/visual-composite.js";

// A minimal valid PNG (1x1) to exercise the IHDR reader.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("pngSize reads width and height from the IHDR chunk", () => {
  assert.deepEqual(pngSize(PNG_1X1), { width: 1, height: 1 });
});

test("pngSize rejects non-PNG buffers", () => {
  assert.throws(() => pngSize(Buffer.from("not a png")), /not a PNG/);
});

test("compositeSvg stacks overlay over background at 1:1 with file hrefs", () => {
  const svg = compositeSvg({
    backgroundPath: "/tmp/clean.png",
    overlayPath: "/tmp/overlay.png",
    width: 800,
    height: 600,
  });
  assert.match(svg, /width="800" height="600"/);
  assert.match(svg, /viewBox="0 0 800 600"/);
  // Background first, overlay second (drawn on top).
  const bg = svg.indexOf("file:///tmp/clean.png");
  const overlay = svg.indexOf("file:///tmp/overlay.png");
  assert.ok(bg > -1 && overlay > -1 && bg < overlay, "background must render before overlay");
});

test("compositeSvg escapes special characters in paths", () => {
  const svg = compositeSvg({ backgroundPath: '/tmp/a&b".png', overlayPath: "/tmp/o.png", width: 1, height: 1 });
  assert.match(svg, /a&amp;b&quot;\.png/);
  assert.doesNotMatch(svg, /a&b"\.png/);
});

test("findChrome returns null when no candidate exists", () => {
  assert.equal(findChrome({ LAVISH_AXI_CHROME_BIN: "/no/such/chrome" }, []), null);
});

test("findChrome honors an existing explicit binary", () => {
  // process.execPath always exists; use it as a stand-in binary path.
  assert.equal(findChrome({ CHROME_BIN: process.execPath }), process.execPath);
});

test("artifactUrlForState restores the feedback state when rendering the background", () => {
  assert.equal(
    artifactUrlForState("/tmp/dashboard ideas.html", "proposed-mobile"),
    "file:///tmp/dashboard%20ideas.html#state=proposed-mobile",
  );
});
