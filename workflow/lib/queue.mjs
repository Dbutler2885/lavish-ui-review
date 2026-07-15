// The edit-queue engine: the two-layer queue (slice 06).
//
// Layer one: a batch of user-cued units of guidance, sent together.
// Layer two: the model-authored execution plan - ordered items, each citing
// the unit ids it addresses.
//
// The engine is a deterministic state machine, independent of the model.
// The model's plan and patches are INPUTS to it, not part of it. It
// guarantees: serial execution (one active item at a time), every unit
// accounted for by at least one item (coverage), and a durable record of
// which units each item addressed.
//
// Batch status:  pending-plan -> executing -> done
// Item status:   pending -> active -> done
//
// Pure functions over plain objects; queue-dir persistence is a thin layer
// at the bottom.
import fs from "node:fs";
import path from "node:path";
import { newId, validate as validateUnit } from "./unit.mjs";

export function createBatch(units) {
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error("A batch needs at least one unit.");
  }
  const ids = new Set();
  for (const u of units) {
    validateUnit(u);
    if (ids.has(u.id)) throw new Error(`Duplicate unit id in batch: "${u.id}"`);
    ids.add(u.id);
  }
  return {
    id: newId("b"),
    receivedAt: new Date().toISOString(),
    status: "pending-plan",
    units,
    items: [],
  };
}

// Which units are not cited by any plan item.
export function uncoveredUnits(batch, items = batch.items) {
  const cited = new Set(items.flatMap((it) => it.unitIds ?? []));
  return batch.units.filter((u) => !cited.has(u.id)).map((u) => u.id);
}

// Load the model-authored plan. Each item: { summary, unitIds }. Strict by
// default: every unit must be cited by at least one item - the planner must
// address every unit, even if an item's summary is "decline: conflicts with
// unit X". Returns a new batch object.
export function loadPlan(batch, items) {
  if (batch.status !== "pending-plan") throw new Error(`Batch ${batch.id} already has a plan.`);
  if (!Array.isArray(items) || items.length === 0) throw new Error("A plan needs at least one item.");
  const unitIds = new Set(batch.units.map((u) => u.id));
  items.forEach((it, i) => {
    if (typeof it?.summary !== "string" || it.summary.trim().length === 0) {
      throw new Error(`items[${i}]: needs a summary`);
    }
    if (!Array.isArray(it.unitIds) || it.unitIds.length === 0) {
      throw new Error(`items[${i}]: needs unitIds citing at least one unit`);
    }
    for (const uid of it.unitIds) {
      if (!unitIds.has(uid)) throw new Error(`items[${i}]: cites unknown unit "${uid}"`);
    }
  });
  const uncovered = uncoveredUnits(batch, items);
  if (uncovered.length > 0) {
    throw new Error(`Plan leaves units unaddressed: ${uncovered.join(", ")}. Every unit must be cited by at least one item.`);
  }
  return {
    ...batch,
    status: "executing",
    plannedAt: new Date().toISOString(),
    items: items.map((it, i) => ({
      id: it.id ?? `${batch.id}-i${i + 1}`,
      order: i + 1,
      summary: it.summary,
      unitIds: [...it.unitIds],
      status: "pending",
    })),
  };
}

// Serial executor: activate and return the next pending item. Exactly one
// item may be active at a time. Returns { batch, item } or { batch, item:
// null } when nothing is pending.
export function next(batch) {
  if (batch.status !== "executing") throw new Error(`Batch ${batch.id} is not executing (status: ${batch.status}).`);
  if (batch.items.some((it) => it.status === "active")) {
    throw new Error("An item is already active; complete it before taking the next.");
  }
  const idx = batch.items.findIndex((it) => it.status === "pending");
  if (idx === -1) return { batch, item: null };
  const items = batch.items.map((it, i) => (i === idx ? { ...it, status: "active", startedAt: new Date().toISOString() } : it));
  const updated = { ...batch, items };
  return { batch: updated, item: items[idx] };
}

// Complete the active item, recording what was done. When the last item
// completes, the batch is done.
export function complete(batch, itemId, { result = "" } = {}) {
  const idx = batch.items.findIndex((it) => it.id === itemId);
  if (idx === -1) throw new Error(`No such item: "${itemId}"`);
  if (batch.items[idx].status !== "active") throw new Error(`Item "${itemId}" is not active.`);
  const items = batch.items.map((it, i) =>
    i === idx ? { ...it, status: "done", result, completedAt: new Date().toISOString() } : it
  );
  const done = items.every((it) => it.status === "done");
  return { ...batch, items, status: done ? "done" : "executing", ...(done ? { completedAt: new Date().toISOString() } : {}) };
}

// The audit trail: which units each item addressed, in execution order.
export function coverageReport(batch) {
  return batch.items.map((it) => ({
    item: it.id,
    order: it.order,
    summary: it.summary,
    status: it.status,
    units: it.unitIds,
  }));
}

// --- persistence -----------------------------------------------------------

export function saveBatch(queueDir, batch) {
  fs.mkdirSync(queueDir, { recursive: true });
  const file = path.join(queueDir, `batch-${batch.id}.json`);
  fs.writeFileSync(file, JSON.stringify(batch, null, 2) + "\n");
  return file;
}

export function loadBatch(queueDir, batchId) {
  return JSON.parse(fs.readFileSync(path.join(queueDir, `batch-${batchId}.json`), "utf8"));
}

export function listBatches(queueDir) {
  if (!fs.existsSync(queueDir)) return [];
  return fs
    .readdirSync(queueDir)
    .filter((f) => f.startsWith("batch-") && f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(queueDir, f), "utf8")))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}
