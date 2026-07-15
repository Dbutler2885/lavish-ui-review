// Tests for the edit-queue engine (slice 06). External behavior only:
// ingestion, planning with coverage, serial advancement, persistence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createUnit } from "../lib/unit.mjs";
import {
  createBatch,
  loadPlan,
  next,
  complete,
  uncoveredUnits,
  coverageReport,
  saveBatch,
  loadBatch,
  listBatches,
} from "../lib/queue.mjs";

const unit = (id) =>
  createUnit({
    id,
    marks: [
      {
        id: `${id}-m1`,
        type: "box",
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      },
    ],
  });

function plannedBatch() {
  const batch = createBatch([unit("A1"), unit("A2"), unit("A3")]);
  return loadPlan(batch, [
    { summary: "Fix header overlap", unitIds: ["A1", "A3"] },
    { summary: "Curve the title", unitIds: ["A2"] },
  ]);
}

test("createBatch validates units and rejects empties and duplicates", () => {
  assert.throws(() => createBatch([]), /at least one unit/);
  assert.throws(() => createBatch([unit("A1"), unit("A1")]), /Duplicate unit id/);
  assert.throws(() => createBatch([{ id: "junk" }]), /Invalid unit/);
  const b = createBatch([unit("A1")]);
  assert.equal(b.status, "pending-plan");
});

test("loadPlan enforces citations and full coverage", () => {
  const b = createBatch([unit("A1"), unit("A2")]);
  assert.throws(() => loadPlan(b, []), /at least one item/);
  assert.throws(() => loadPlan(b, [{ summary: "x", unitIds: ["nope"] }]), /unknown unit/);
  assert.throws(() => loadPlan(b, [{ summary: "x", unitIds: [] }]), /citing at least one/);
  assert.throws(() => loadPlan(b, [{ summary: "only A1", unitIds: ["A1"] }]), /unaddressed: A2/);
  assert.deepEqual(uncoveredUnits(b, [{ unitIds: ["A1"] }]), ["A2"]);
  const planned = loadPlan(b, [{ summary: "both", unitIds: ["A1", "A2"] }]);
  assert.equal(planned.status, "executing");
  assert.equal(planned.items[0].id, `${b.id}-i1`);
  assert.throws(() => loadPlan(planned, [{ summary: "again", unitIds: ["A1", "A2"] }]), /already has a plan/);
});

test("serial execution: one active item, complete-then-next, batch completes", () => {
  let b = plannedBatch();
  let r = next(b);
  assert.equal(r.item.summary, "Fix header overlap");
  // A second next() while active is refused.
  assert.throws(() => next(r.batch), /already active/);
  b = complete(r.batch, r.item.id, { result: "moved title up 8px" });
  assert.equal(b.status, "executing");
  r = next(b);
  assert.equal(r.item.summary, "Curve the title");
  b = complete(r.batch, r.item.id, { result: "applied arc" });
  assert.equal(b.status, "done");
  assert.throws(() => next(b), /not executing/); // done batches refuse next()
});

test("complete guards against wrong items", () => {
  const b = plannedBatch();
  assert.throws(() => complete(b, "nope", {}), /No such item/);
  assert.throws(() => complete(b, b.items[0].id, {}), /not active/);
});

test("coverageReport is the audit trail", () => {
  let b = plannedBatch();
  const r = next(b);
  b = complete(r.batch, r.item.id, { result: "done" });
  const report = coverageReport(b);
  assert.deepEqual(report[0].units, ["A1", "A3"]);
  assert.equal(report[0].status, "done");
  assert.equal(report[1].status, "pending");
  // Every unit appears somewhere in the report.
  const cited = new Set(report.flatMap((x) => x.units));
  for (const id of ["A1", "A2", "A3"]) assert.ok(cited.has(id));
});

test("persistence round-trips through the queue dir", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-queue-"));
  const b = plannedBatch();
  saveBatch(dir, b);
  assert.deepEqual(loadBatch(dir, b.id), b);
  assert.equal(listBatches(dir).length, 1);
  assert.deepEqual(listBatches(path.join(dir, "missing")), []);
});
