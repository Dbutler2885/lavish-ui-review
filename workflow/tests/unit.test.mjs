// Tests for the unit-of-guidance model (slice 04). External behavior only:
// construction of every composition, round-trip, validation, refs, coverage.
import test from "node:test";
import assert from "node:assert/strict";
import { createUnit, serialize, deserialize, listRefs, coverage, problems } from "../lib/unit.mjs";

const box = (id, extra = {}) => ({ id, type: "box", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], ...extra });
const curve = (id, extra = {}) => ({ id, type: "curve", points: [{ x: 0, y: 0 }, { x: 5, y: 8 }, { x: 10, y: 0 }], ...extra });
const domRef = (selector = "#title") => ({ type: "dom", selector });
const regionRef = () => ({ type: "region", image: "files/inspo.png", rect: { x: 10, y: 20, w: 100, h: 50 } });

test("composition: a drawing alone", () => {
  const u = createUnit({ marks: [box("m1")] });
  assert.equal(u.state, "default");
  assert.ok(u.id.length > 0);
});

test("composition: text-annotated drawings", () => {
  const u = createUnit({
    marks: [curve("m1", { tag: "shape" })],
    notes: [{ text: "curve the header like this", binds: ["m1"] }],
  });
  assert.equal(u.notes[0].binds[0], "m1");
});

test("composition: text over drawings plus bounding boxes", () => {
  const u = createUnit({
    state: "modal-open",
    refs: [domRef("#modal .title")],
    marks: [curve("m1"), box("m2")],
    notes: [{ text: "move this text up and curve it", binds: ["m1", "m2", "ref:0"] }],
  });
  assert.equal(u.state, "modal-open");
});

test("composition: text-annotated bounding boxes alone", () => {
  const u = createUnit({
    refs: [domRef("#a"), domRef("#b")],
    notes: [{ text: "these overlap", binds: ["ref:0", "ref:1"] }],
  });
  assert.equal(u.refs.length, 2);
});

test("region refs and group binding", () => {
  const u = createUnit({
    refs: [regionRef()],
    marks: [box("m1", { group: "g1" }), curve("m2", { group: "g1" })],
    notes: [{ text: "this object, like the reference", binds: ["g1", "ref:0"] }],
  });
  const cov = coverage(u);
  assert.deepEqual(cov.unbound, []);
});

test("serialize/deserialize round-trips losslessly", () => {
  const u = createUnit({
    refs: [domRef(), regionRef()],
    marks: [box("m1", { tag: "look-here" }), curve("m2", { group: "g1" })],
    notes: [{ text: "note", binds: ["m1", "ref:1"] }],
  });
  assert.deepEqual(deserialize(serialize(u)), u);
});

test("malformed units are rejected with clear errors", () => {
  // Text alone is not a unit.
  assert.throws(() => createUnit({ notes: [{ text: "just words", binds: [] }] }), /at least one ref or mark/);
  // Bad mark type and too few points.
  assert.throws(() => createUnit({ marks: [{ id: "m1", type: "scribble", points: [] }] }), /type must be one of/);
  assert.throws(() => createUnit({ marks: [{ id: "m1", type: "arc", points: [{ x: 0, y: 0 }] }] }), /at least 3/);
  // Duplicate mark ids.
  assert.throws(() => createUnit({ marks: [box("m1"), box("m1")] }), /duplicate mark id/);
  // Dangling note binds.
  assert.throws(() => createUnit({ marks: [box("m1")], notes: [{ text: "x", binds: ["m9"] }] }), /matches no mark/);
  assert.throws(() => createUnit({ marks: [box("m1")], notes: [{ text: "x", binds: ["ref:0"] }] }), /out of range/);
  // Region without rect; dom without selector.
  assert.throws(() => createUnit({ refs: [{ type: "region", image: "a.png" }] }), /needs a rect/);
  assert.throws(() => createUnit({ refs: [{ type: "dom" }] }), /needs a selector/);
  // problems() collects rather than throwing.
  assert.ok(problems({}).length > 0);
});

test("listRefs enumerates normalized targets", () => {
  const u = createUnit({ refs: [domRef("#hero"), regionRef()], marks: [box("m1")] });
  const refs = listRefs(u);
  assert.deepEqual(refs[0], { index: 0, type: "dom", target: "#hero" });
  assert.equal(refs[1].type, "region");
  assert.match(refs[1].target, /files\/inspo\.png@10,20,100x50/);
});

test("coverage reports bound and floating parts", () => {
  const u = createUnit({
    refs: [domRef()],
    marks: [box("m1"), curve("m2")],
    notes: [{ text: "only m1", binds: ["m1"] }],
  });
  const cov = coverage(u);
  assert.deepEqual(cov.marks, [{ id: "m1", bound: true }, { id: "m2", bound: false }]);
  assert.deepEqual(cov.refs, [{ id: "ref:0", bound: false }]);
  assert.deepEqual(cov.unbound, ["m2", "ref:0"]);
});
