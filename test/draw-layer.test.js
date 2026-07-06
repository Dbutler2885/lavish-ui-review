import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnit,
  unitPreview,
  shapesToMarks,
  marksToShapes,
  decimatePoints,
  arcPointsFromDrag,
  shapeBounds,
  rectsIntersect,
  createHistory,
  isDegenerateShape,
} from "../src/draw-layer.js";

const shape = (over = {}) => ({
  id: "m1",
  type: "box",
  x: 100,
  y: 50,
  rel: [
    { x: 0, y: 0 },
    { x: 40, y: 30 },
  ],
  group: null,
  tag: null,
  stroke: "#ff2d55",
  ...over,
});

test("shapesToMarks serializes absolute points and optional group/tag", () => {
  const marks = shapesToMarks([shape(), shape({ id: "m2", group: "g1", tag: "look-here" })]);
  assert.deepEqual(marks[0], {
    id: "m1",
    type: "box",
    points: [
      { x: 100, y: 50 },
      { x: 140, y: 80 },
    ],
  });
  assert.equal(marks[1].group, "g1");
  assert.equal(marks[1].tag, "look-here");
  assert.equal("group" in marks[0], false);
});

test("marksToShapes round-trips through shapesToMarks", () => {
  const original = [
    shape(),
    shape({
      id: "m2",
      type: "curve",
      rel: [
        { x: 0, y: 0 },
        { x: 10, y: -20 },
        { x: 30, y: 0 },
      ],
    }),
  ];
  const restored = marksToShapes(shapesToMarks(original));
  assert.deepEqual(shapesToMarks(restored), shapesToMarks(original));
});

test("decimatePoints keeps endpoints and spacing", () => {
  const trail = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
  const out = decimatePoints(trail, 10);
  assert.deepEqual(out[0], { x: 0, y: 0 });
  assert.deepEqual(out[out.length - 1], { x: 49, y: 0 });
  for (let i = 1; i < out.length - 1; i++) {
    assert.ok(out[i].x - out[i - 1].x >= 10);
  }
});

test("arcPointsFromDrag bulges the midpoint perpendicular to the drag", () => {
  const [a, apex, b] = arcPointsFromDrag({ x: 0, y: 0 }, { x: 90, y: 0 });
  assert.deepEqual(a, { x: 0, y: 0 });
  assert.deepEqual(b, { x: 90, y: 0 });
  assert.equal(apex.x, 45);
  assert.equal(Math.round(Math.abs(apex.y)), 30);
});

test("shapeBounds and rectsIntersect", () => {
  const b = shapeBounds(shape());
  assert.deepEqual(b, { x: 100, y: 50, w: 40, h: 30 });
  assert.ok(rectsIntersect(b, { x: 130, y: 70, w: 50, h: 50 }));
  assert.ok(!rectsIntersect(b, { x: 500, y: 500, w: 10, h: 10 }));
});

test("history: one gesture per snapshot, undo/redo round-trip, cap", () => {
  const h = createHistory(3);
  assert.equal(h.canUndo(), false);
  h.record({ n: 1 });
  h.record({ n: 2 });
  const prev = h.undo({ n: 3 });
  assert.deepEqual(prev, { n: 2 });
  const redone = h.redo(prev);
  assert.deepEqual(redone, { n: 3 });
  // Cap: recording beyond the limit drops the oldest.
  h.record({ n: 4 });
  h.record({ n: 5 });
  h.record({ n: 6 });
  h.record({ n: 7 });
  let count = 0;
  while (h.undo({})) count++;
  assert.equal(count, 3);
});

test("recording clears the redo stack", () => {
  const h = createHistory();
  h.record({ n: 1 });
  h.undo({ n: 2 });
  h.record({ n: 9 });
  assert.equal(h.canRedo(), false);
});

test("isDegenerateShape discards meaningless gestures", () => {
  assert.ok(
    isDegenerateShape(
      shape({
        rel: [
          { x: 0, y: 0 },
          { x: 2, y: 2 },
        ],
      }),
    ),
  );
  assert.ok(!isDegenerateShape(shape()));
  assert.ok(
    isDegenerateShape(
      shape({
        type: "freehand",
        rel: [
          { x: 0, y: 0 },
          { x: 9, y: 9 },
        ],
      }),
    ),
  );
  assert.ok(
    !isDegenerateShape(
      shape({
        type: "freehand",
        rel: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
          { x: 9, y: 9 },
        ],
      }),
    ),
  );
});

test("buildUnit binds selected marks (or all) plus refs, matching the unit model", () => {
  const marks = [
    {
      id: "m1",
      type: "box",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    },
    {
      id: "m2",
      type: "arrow",
      points: [
        { x: 5, y: 5 },
        { x: 20, y: 20 },
      ],
    },
  ];
  const refs = [{ selector: "#title", rect: { x: 1, y: 2, w: 30, h: 40 } }];
  const unit = buildUnit({
    id: "u1",
    state: "modal-open",
    marks,
    refs,
    noteText: "  move this up  ",
    selectedMarkIds: ["m2"],
  });
  assert.equal(unit.v, 1);
  assert.equal(unit.state, "modal-open");
  assert.deepEqual(unit.refs[0], { type: "dom", selector: "#title", rect: { x: 1, y: 2, w: 30, h: 40 } });
  assert.deepEqual(unit.notes[0].binds, ["m2", "ref:0"]);
  assert.equal(unit.notes[0].text, "move this up");
  // No selection: binds all marks.
  const all = buildUnit({ id: "u2", marks, refs: [], noteText: "x" });
  assert.deepEqual(all.notes[0].binds, ["m1", "m2"]);
  // No note text: no notes entry (drawing alone is a legal unit).
  const bare = buildUnit({ id: "u3", marks, refs: [] });
  assert.deepEqual(bare.notes, []);
});

test("unitPreview summarizes note, marks, and elements", () => {
  const unit = buildUnit({
    id: "u1",
    marks: [
      {
        id: "m1",
        type: "box",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    ],
    refs: [{ selector: "#a", rect: { x: 0, y: 0, w: 1, h: 1 } }],
    noteText: "curve the title",
  });
  assert.equal(unitPreview(unit), "curve the title [1 mark + 1 element]");
  const bare = buildUnit({ id: "u2", marks: [], refs: [{ selector: "#a", rect: { x: 0, y: 0, w: 1, h: 1 } }] });
  assert.match(unitPreview(bare), /visual guidance, no note/);
});
