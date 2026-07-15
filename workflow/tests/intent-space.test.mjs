// Tests for the intent-space store (slice 02). External behavior only:
// deposit sequences, mode/target recording, and packet assembly against
// temp project dirs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deposit, readIndex, setMode, setTargetRepo, assemble } from "../lib/intent-space.mjs";

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-intent-"));
  fs.mkdirSync(path.join(dir, "intent", "files"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "project.json"),
    JSON.stringify({
      slug: "t",
      title: "T",
      stage: "intent",
      mode: null,
      targetRepo: null,
      currentMockups: [],
      history: [],
    }, null, 2)
  );
  return dir;
}

test("deposit writes the file and indexes it", () => {
  const dir = makeProject();
  const entry = deposit(dir, { name: "brief.md", content: "# Brief\n", kind: "brief", tool: "grill-me" });
  assert.equal(entry.file, "brief.md");
  assert.equal(fs.readFileSync(path.join(dir, "intent", "brief.md"), "utf8"), "# Brief\n");
  const index = readIndex(dir);
  assert.equal(index.deposits.length, 1);
  assert.equal(index.deposits[0].kind, "brief");
  assert.equal(index.deposits[0].tool, "grill-me");
  assert.ok(index.deposits[0].bytes > 0);
});

test("deposit copies from sourcePath and supports subpaths", () => {
  const dir = makeProject();
  const src = path.join(os.tmpdir(), `fe-src-${Date.now()}.png`);
  fs.writeFileSync(src, Buffer.from([1, 2, 3]));
  const entry = deposit(dir, { name: "files/inspo.png", sourcePath: src, kind: "image", tool: "intent-ui" });
  assert.equal(entry.file, "files/inspo.png");
  assert.ok(fs.existsSync(path.join(dir, "intent", "files", "inspo.png")));
  fs.unlinkSync(src);
});

test("re-depositing the same name replaces its index entry", () => {
  const dir = makeProject();
  deposit(dir, { name: "brief.md", content: "v1", kind: "brief" });
  deposit(dir, { name: "brief.md", content: "v2 longer", kind: "brief" });
  const index = readIndex(dir);
  assert.equal(index.deposits.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, "intent", "brief.md"), "utf8"), "v2 longer");
});

test("deposit rejects bad input", () => {
  const dir = makeProject();
  assert.throws(() => deposit(dir, { name: "../escape.md", content: "x" }), /Invalid deposit name/);
  assert.throws(() => deposit(dir, { name: "/abs.md", content: "x" }), /Invalid deposit name/);
  assert.throws(() => deposit(dir, { name: "a.md" }), /exactly one/);
  assert.throws(() => deposit(dir, { name: "a.md", content: "x", sourcePath: "/tmp/y" }), /exactly one/);
});

test("setMode validates and records with history", () => {
  const dir = makeProject();
  assert.throws(() => setMode(dir, "sideways"), /Unknown mode/);
  const p = setMode(dir, "redesign");
  assert.equal(p.mode, "redesign");
  assert.match(p.history.at(-1).event, /mode set: redesign/);
});

test("setTargetRepo records with history", () => {
  const dir = makeProject();
  assert.throws(() => setTargetRepo(dir, ""), /non-empty/);
  const p = setTargetRepo(dir, "https://github.com/example/app");
  assert.equal(p.targetRepo, "https://github.com/example/app");
  assert.match(p.history.at(-1).event, /target repo set/);
});

test("assemble returns the union: indexed, unindexed, and no deleted entries", () => {
  const dir = makeProject();
  deposit(dir, { name: "brief.md", content: "# Brief", kind: "brief", tool: "grill-me" });
  deposit(dir, { name: "gone.md", content: "bye", kind: "note" });
  // A file dropped in manually, never indexed.
  fs.writeFileSync(path.join(dir, "intent", "files", "dropped.png"), Buffer.from([9]));
  // An indexed file later deleted from disk.
  fs.unlinkSync(path.join(dir, "intent", "gone.md"));
  setMode(dir, "extend");
  setTargetRepo(dir, "https://github.com/example/app");

  const packet = assemble(dir);
  assert.equal(packet.slug, "t");
  assert.equal(packet.mode, "extend");
  assert.equal(packet.targetRepo, "https://github.com/example/app");
  const byFile = Object.fromEntries(packet.deposits.map((d) => [d.file, d]));
  assert.equal(byFile["brief.md"].kind, "brief");
  assert.equal(byFile["files/dropped.png"].kind, "unindexed");
  assert.equal(byFile["gone.md"], undefined);
  assert.ok(packet.assembledAt);
});

test("a grill-me artifact deposits and assembles alongside intent UI deposits (slice 11)", () => {
  const dir = makeProject();
  deposit(dir, { name: "grill-me-brief.md", content: "# Brief\nDecided: dense dashboard.\n", kind: "grill-me", tool: "grill-me" });
  deposit(dir, { name: "files/inspo.png", content: Buffer.from([1]), kind: "image", tool: "intent-ui" });
  const packet = assemble(dir);
  const byFile = Object.fromEntries(packet.deposits.map((d) => [d.file, d]));
  assert.equal(byFile["grill-me-brief.md"].kind, "grill-me");
  assert.equal(byFile["grill-me-brief.md"].tool, "grill-me");
  assert.equal(byFile["files/inspo.png"].tool, "intent-ui");
});

test("assemble of an empty intent space is well formed", () => {
  const dir = makeProject();
  const packet = assemble(dir);
  assert.deepEqual(packet.deposits, []);
  assert.equal(packet.mode, null);
});
