import test from "node:test";
import assert from "node:assert/strict";

import {
  arcFromDrag,
  arcGuideSegments,
  arcHandlePoints,
  arcPointsFromDrag,
  draftShapeFromGesture,
  buildUnit,
  createStateBuckets,
  createHistory,
  decimatePoints,
  normalizeDrawTool,
  isDegenerateShape,
  isEditableEventTarget,
  drawingGroupsFromMarks,
  marksToShapes,
  rectsIntersect,
  selectionBounds,
  selectionSummary,
  shapeBounds,
  shapesToMarks,
  surfaceStateDescriptor,
  unitPreview,
  visualFeedbackFromUnit,
  updateArcHandle,
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

test("isEditableEventTarget uses composedPath so shadow-DOM textareas are recognized", () => {
  // Retargeting: evt.target is the shadow host <div>, but composedPath()[0] is
  // the real textarea inside the shadow root - typing must not trigger shortcuts.
  const textareaInShadow = {
    composedPath: () => [{ tagName: "TEXTAREA" }, { tagName: "DIV" }],
    target: { tagName: "DIV" },
  };
  assert.equal(isEditableEventTarget(textareaInShadow), true);

  assert.equal(isEditableEventTarget({ composedPath: () => [{ tagName: "INPUT" }] }), true);
  assert.equal(isEditableEventTarget({ composedPath: () => [{ tagName: "DIV", isContentEditable: true }] }), true);
  assert.equal(isEditableEventTarget({ composedPath: () => [{ tagName: "CANVAS" }] }), false);
  // Falls back to evt.target when composedPath is unavailable.
  assert.equal(isEditableEventTarget({ target: { tagName: "TEXTAREA" } }), true);
  assert.equal(isEditableEventTarget({ target: null }), false);
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

test("normalizeDrawTool accepts toolbar aliases without falling through to freehand", () => {
  assert.equal(normalizeDrawTool("arc"), "arc");
  assert.equal(normalizeDrawTool("arch"), "arc");
  assert.equal(normalizeDrawTool("arrowFreehand"), "");
  assert.equal(normalizeDrawTool("freehand-arrow"), "");
  assert.equal(normalizeDrawTool("bogus"), "");
});

test("draftShapeFromGesture creates only the requested drawing tool shape", () => {
  const gesture = {
    start: { x: 10, y: 20 },
    trail: [
      { x: 10, y: 20 },
      { x: 40, y: 50 },
    ],
  };

  assert.equal(draftShapeFromGesture("arc", gesture).type, "arc");
  assert.equal(draftShapeFromGesture("arch", gesture).type, "arc");
  assert.equal(draftShapeFromGesture("freehand", gesture).type, "freehand");
  assert.equal(draftShapeFromGesture("arrowfreehand", gesture), null);
  assert.equal(draftShapeFromGesture("bogus", gesture), null);
});

test("arcFromDrag builds a three-point arch anchored at A with a bowed apex", () => {
  const arc = { ...shape(), ...arcFromDrag({ x: 100, y: 100 }, { x: 180, y: 100 }) };
  assert.equal(arc.type, "arc");
  assert.equal(arc.x, 100);
  assert.equal(arc.y, 100);

  const handles = arcHandlePoints(arc);
  assert.deepEqual(handles.a, { x: 100, y: 100 });
  assert.deepEqual(handles.b, { x: 180, y: 100 });
  // Apex sits over the chord midpoint, bowed to the "up" side of a rightward drag.
  assert.equal(Math.round(handles.vertex.x), 140);
  assert.ok(handles.vertex.y < 100, "apex bows upward");

  // The angle line runs straight through the vertex (h1 and h2 are mirror ends).
  const [line] = arcGuideSegments(arc);
  assert.deepEqual(line.from, handles.h1);
  assert.deepEqual(line.to, handles.h2);
  assert.equal(Math.round((handles.h1.x + handles.h2.x) / 2), Math.round(handles.vertex.x));
  assert.equal(Math.round((handles.h1.y + handles.h2.y) / 2), Math.round(handles.vertex.y));
  // A level drag gives a horizontal (chord-parallel) apex tangent.
  assert.equal(Math.round(handles.h1.y), Math.round(handles.h2.y));

  // The sampled curve passes through A, the apex, and B.
  const pts = arc.rel.map((p) => ({ x: p.x + arc.x, y: p.y + arc.y }));
  assert.deepEqual(pts[0], { x: 100, y: 100 });
  assert.deepEqual(pts[pts.length - 1], { x: 180, y: 100 });
});

test("arc handles move A, B, the vertex, and the protractor angle line", () => {
  const arc = { ...shape(), ...arcFromDrag({ x: 100, y: 100 }, { x: 180, y: 100 }) };

  // Moving the vertex handle raises/lowers the apex only.
  const raised = updateArcHandle(arc, "vertex", { x: 140, y: 40 });
  assert.deepEqual(arcHandlePoints(raised).vertex, { x: 140, y: 40 });
  assert.deepEqual(arcHandlePoints(raised).a, { x: 100, y: 100 });
  assert.deepEqual(arcHandlePoints(raised).b, { x: 180, y: 100 });

  // Dragging a square handle rotates the angle line about the vertex; the
  // opposite handle mirrors it so the line still runs through the vertex.
  const tilted = updateArcHandle(raised, "h2", { x: 160, y: 20 });
  const th = arcHandlePoints(tilted);
  assert.deepEqual({ x: Math.round(th.h2.x), y: Math.round(th.h2.y) }, { x: 160, y: 20 });
  assert.equal(Math.round((th.h1.x + th.h2.x) / 2), Math.round(th.vertex.x));
  assert.equal(Math.round((th.h1.y + th.h2.y) / 2), Math.round(th.vertex.y));

  // Moving endpoint A leaves B and the vertex where they were.
  const movedA = updateArcHandle(tilted, "a", { x: 60, y: 120 });
  const mh = arcHandlePoints(movedA);
  assert.deepEqual(mh.a, { x: 60, y: 120 });
  assert.deepEqual({ x: Math.round(mh.b.x), y: Math.round(mh.b.y) }, { x: 180, y: 100 });
  assert.deepEqual({ x: Math.round(mh.vertex.x), y: Math.round(mh.vertex.y) }, { x: 140, y: 40 });
});

test("arc marks serialize A/B/vertex/tangent and round-trip", () => {
  const arc = { id: "a1", ...arcFromDrag({ x: 50, y: 60 }, { x: 150, y: 60 }), group: "g1", tag: "look-here" };
  const [mark] = shapesToMarks([arc]);
  assert.equal(mark.type, "arc");
  assert.deepEqual(mark.a, { x: 50, y: 60 });
  assert.deepEqual(mark.b, { x: 150, y: 60 });
  assert.ok(mark.vertex && mark.tan, "arch carries an apex and tangent");
  assert.ok(mark.points.length >= 3, "arch still carries sampled points for the unit model");
  assert.equal(mark.group, "g1");
  assert.equal(mark.tag, "look-here");

  const [restored] = marksToShapes([mark]);
  const before = arcHandlePoints(arc);
  const after = arcHandlePoints(restored);
  for (const kind of ["a", "b", "vertex", "h1", "h2"]) {
    assert.deepEqual(
      { x: Math.round(after[kind].x), y: Math.round(after[kind].y) },
      { x: Math.round(before[kind].x), y: Math.round(before[kind].y) },
    );
  }
});

test("marksToShapes upgrades a legacy center/radius arc into the arch model", () => {
  const [restored] = marksToShapes([
    { id: "a1", type: "arc", center: { x: 100, y: 100 }, radius: 40, startAngle: 0, endAngle: 180 },
  ]);
  assert.equal(restored.type, "arc");
  const h = arcHandlePoints(restored);
  assert.deepEqual({ x: Math.round(h.a.x), y: Math.round(h.a.y) }, { x: 140, y: 100 });
  assert.deepEqual({ x: Math.round(h.b.x), y: Math.round(h.b.y) }, { x: 60, y: 100 });
});

test("arc-arrow shares arch geometry but keeps its own type through serialize", () => {
  const arrow = draftShapeFromGesture("arc-arrow", {
    start: { x: 20, y: 200 },
    trail: [
      { x: 20, y: 200 },
      { x: 220, y: 200 },
    ],
  });
  assert.equal(arrow.type, "arc-arrow");
  // Same editable handles as a plain arch.
  const h = arcHandlePoints(arrow);
  assert.deepEqual(h.a, { x: 20, y: 200 });
  assert.deepEqual(h.b, { x: 220, y: 200 });
  assert.ok(h.vertex.y < 200, "apex bows off the chord");

  const [mark] = shapesToMarks([{ ...arrow, id: "aa1" }]);
  assert.equal(mark.type, "arc-arrow");
  const [restored] = marksToShapes([mark]);
  assert.equal(restored.type, "arc-arrow");
});

test("arcPointsFromDrag remains a three-point compatibility helper", () => {
  const pts = arcPointsFromDrag({ x: 0, y: 0 }, { x: 90, y: 0 });
  assert.equal(pts.length, 3);
});

test("shapeBounds and rectsIntersect", () => {
  const b = shapeBounds(shape());
  assert.deepEqual(b, { x: 100, y: 50, w: 40, h: 30 });
  assert.ok(rectsIntersect(b, { x: 130, y: 70, w: 50, h: 50 }));
  assert.ok(!rectsIntersect(b, { x: 500, y: 500, w: 10, h: 10 }));
});

test("shapeBounds squares a circle around its center so hit-testing lands on it", () => {
  // A circle is stored anchored at its center (shape.x/y) with rel endpoints
  // giving the radius; its bounds must be the square around the center, not the
  // rel corner box, or select/erase clicks miss the visible circle.
  const circle = {
    id: "c1",
    type: "circle",
    x: 200,
    y: 150,
    rel: [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
    ],
  };
  // radius = hypot(30, 40) = 50
  assert.deepEqual(shapeBounds(circle), { x: 150, y: 100, w: 100, h: 100 });
});

test("selectionBounds unions selected marks and HTML refs", () => {
  const bounds = selectionBounds({
    shapes: [shape(), shape({ id: "m2", x: 10, y: 10 })],
    selectedIds: ["m1"],
    refs: [{ rect: { x: 20, y: 200, w: 80, h: 30 } }],
  });
  assert.deepEqual(bounds, { x: 20, y: 50, w: 120, h: 180 });
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

test("drawingGroupsFromMarks turns selected marks into public drawing groups", () => {
  const groups = drawingGroupsFromMarks([
    {
      id: "m1",
      type: "box",
      group: "draw-1",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      tag: "look-here",
    },
    {
      id: "m2",
      type: "arrow",
      group: "draw-1",
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    },
  ]);
  assert.deepEqual(groups, [
    { id: "draw-1", label: "A", markIds: ["m1", "m2"], markTypes: ["box", "arrow"], tags: ["look-here"] },
  ]);
});

test("visualFeedbackFromUnit links drawing groups, html refs, notes, and images without coordinates", () => {
  const unit = buildUnit({
    id: "u1",
    state: "default",
    marks: [
      {
        id: "m1",
        type: "arrow",
        group: "draw-1",
        points: [
          { x: 10, y: 20 },
          { x: 50, y: 20 },
        ],
      },
    ],
    refs: [{ uid: "7", selector: "button.start", text: "Start session", rect: { x: 100, y: 40, w: 120, h: 40 } }],
    noteText: "this way",
  });
  const feedback = visualFeedbackFromUnit(unit, { drawingOverlayPng: "data:image/png;base64,abc" });
  assert.deepEqual(feedback.drawingGroups, [
    { id: "draw-1", label: "A", markIds: ["m1"], markTypes: ["arrow"], tags: [] },
  ]);
  assert.deepEqual(feedback.htmlRefs, [
    { id: "html-1", uid: "7", type: "dom", selector: "button.start", text: "Start session", boundTo: ["draw-1"] },
  ]);
  assert.deepEqual(feedback.notes, [{ text: "this way", boundTo: ["draw-1", "html-1"] }]);
  assert.equal(feedback.images.drawingOverlayPng, "data:image/png;base64,abc");
  const serialized = JSON.stringify(feedback);
  assert.equal(serialized.includes('"points"'), false);
  assert.equal(serialized.includes('"rect"'), false);
  assert.equal(serialized.includes('"x"'), false);
});

test("selectionSummary describes mixed mark and element selections", () => {
  assert.equal(selectionSummary(0, 0), "Nothing selected");
  assert.equal(selectionSummary(1, 0), "1 mark selected");
  assert.equal(selectionSummary(2, 1), "2 marks + 1 element selected");
  assert.equal(selectionSummary(0, 3), "3 elements selected");
});

test("surfaceStateDescriptor keeps the declared state order while the active state changes", () => {
  const root = {
    dataset: { state: "proposed-mobile" },
    querySelectorAll() {
      return [
        { dataset: { state: "default" } },
        { dataset: { state: "current-mobile" } },
        { dataset: { state: "proposed-desktop" } },
        { dataset: { state: "proposed-mobile" } },
      ];
    },
  };

  assert.deepEqual(surfaceStateDescriptor(root), {
    states: ["default", "current-mobile", "proposed-desktop", "proposed-mobile"],
    active: "proposed-mobile",
  });
});

test("state buckets restore each state's drawings when switching between states", () => {
  const drawings = createStateBuckets(() => []);
  drawings.set([shape({ id: "desktop-mark" })]);

  assert.deepEqual(drawings.switchTo("proposed-mobile"), []);
  drawings.set([shape({ id: "mobile-mark" })]);

  assert.deepEqual(
    drawings.switchTo("default").map((item) => item.id),
    ["desktop-mark"],
  );
  assert.deepEqual(
    drawings.switchTo("proposed-mobile").map((item) => item.id),
    ["mobile-mark"],
  );
});
