// The unit-of-guidance model: the canonical annotation object (slice 04).
//
// A unit is one cued bundle of feedback. It binds together:
//   - refs:  what it points at - a live DOM element (selector) or a pixel
//            region of a static image
//   - marks: vector drawings, each with its own identity, optional group
//            membership, and an optional semantic tag; a selection box is
//            just another kind of mark
//   - notes: text bound to specific marks, refs, or groups; the note is
//            authoritative - the drawing shows, the tag hints, the words
//            decide
//   - state: the mockup state the unit was captured in (e.g. "default",
//            "modal-open"), so the edit lands on the right state
//
// Pure data module: no UI, no model calls, no filesystem. Everything else
// in the system speaks this shape.

export const UNIT_VERSION = 1;

export const MARK_TYPES = ["box", "arrow", "curve", "arc", "circle", "freehand"];
// Minimum points a mark of each type needs to mean anything.
const MIN_POINTS = { box: 2, arrow: 2, curve: 2, arc: 3, circle: 2, freehand: 2 };

// Semantic tags are advisory hints, not a closed enum; these are the
// expected ones.
export const MARK_TAGS = ["move", "resize", "shape", "look-here", "anti-example"];

let counter = 0;
export function newId(prefix = "u") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function isFiniteNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function isPoint(p) {
  return p && isFiniteNum(p.x) && isFiniteNum(p.y);
}

function isRect(r) {
  return r && isFiniteNum(r.x) && isFiniteNum(r.y) && isFiniteNum(r.w) && isFiniteNum(r.h) && r.w >= 0 && r.h >= 0;
}

// Collect all human-readable problems with a candidate unit. Empty = valid.
export function problems(unit) {
  const errs = [];
  if (!unit || typeof unit !== "object") return ["unit must be an object"];
  if (typeof unit.id !== "string" || unit.id.length === 0) errs.push("id must be a non-empty string");
  if (typeof unit.state !== "string" || unit.state.length === 0) errs.push("state must be a non-empty string");
  if (unit.v !== UNIT_VERSION) errs.push(`v must be ${UNIT_VERSION}`);

  const refs = unit.refs ?? [];
  const marks = unit.marks ?? [];
  const notes = unit.notes ?? [];
  if (!Array.isArray(refs) || !Array.isArray(marks) || !Array.isArray(notes)) {
    return [...errs, "refs, marks, and notes must be arrays"];
  }
  if (refs.length + marks.length === 0) {
    errs.push("a unit needs at least one ref or mark (text alone is a plain annotation, not a unit)");
  }

  refs.forEach((r, i) => {
    if (r?.type === "dom") {
      if (typeof r.selector !== "string" || r.selector.length === 0) errs.push(`refs[${i}]: dom ref needs a selector`);
      if (r.rect != null && !isRect(r.rect)) errs.push(`refs[${i}]: rect is malformed`);
    } else if (r?.type === "region") {
      if (typeof r.image !== "string" || r.image.length === 0) errs.push(`refs[${i}]: region ref needs an image path`);
      if (!isRect(r.rect)) errs.push(`refs[${i}]: region ref needs a rect {x,y,w,h}`);
    } else {
      errs.push(`refs[${i}]: type must be "dom" or "region"`);
    }
  });

  const markIds = new Set();
  const groupIds = new Set();
  marks.forEach((m, i) => {
    if (typeof m?.id !== "string" || m.id.length === 0) errs.push(`marks[${i}]: needs an id`);
    else if (markIds.has(m.id)) errs.push(`marks[${i}]: duplicate mark id "${m.id}"`);
    else markIds.add(m.id);
    if (!MARK_TYPES.includes(m?.type)) errs.push(`marks[${i}]: type must be one of ${MARK_TYPES.join(", ")}`);
    else {
      const min = MIN_POINTS[m.type];
      if (!Array.isArray(m.points) || m.points.length < min || !m.points.every(isPoint)) {
        errs.push(`marks[${i}]: ${m.type} needs at least ${min} {x,y} points`);
      }
    }
    if (m?.group != null) {
      if (typeof m.group !== "string" || m.group.length === 0)
        errs.push(`marks[${i}]: group must be a non-empty string`);
      else groupIds.add(m.group);
    }
    if (m?.tag != null && typeof m.tag !== "string") errs.push(`marks[${i}]: tag must be a string`);
  });

  notes.forEach((n, i) => {
    if (typeof n?.text !== "string" || n.text.trim().length === 0) errs.push(`notes[${i}]: needs non-empty text`);
    const binds = n?.binds ?? [];
    if (!Array.isArray(binds)) {
      errs.push(`notes[${i}]: binds must be an array`);
      return;
    }
    binds.forEach((b) => {
      if (typeof b !== "string") {
        errs.push(`notes[${i}]: bind targets must be strings`);
      } else if (b.startsWith("ref:")) {
        const idx = Number(b.slice(4));
        if (!Number.isInteger(idx) || idx < 0 || idx >= refs.length)
          errs.push(`notes[${i}]: bind "${b}" is out of range`);
      } else if (!markIds.has(b) && !groupIds.has(b)) {
        errs.push(`notes[${i}]: bind "${b}" matches no mark id or group id`);
      }
    });
  });

  return errs;
}

export function validate(unit) {
  const errs = problems(unit);
  if (errs.length > 0) {
    throw new Error(`Invalid unit${unit?.id ? ` "${unit.id}"` : ""}:\n  - ${errs.join("\n  - ")}`);
  }
  return unit;
}

// Construct a valid unit from parts, filling defaults.
export function createUnit({ id, state = "default", refs = [], marks = [], notes = [], createdAt } = {}) {
  return validate({
    v: UNIT_VERSION,
    id: id ?? newId(),
    state,
    refs,
    marks,
    notes,
    createdAt: createdAt ?? new Date().toISOString(),
  });
}

export function serialize(unit) {
  return JSON.stringify(validate(unit), null, 2);
}

export function deserialize(json) {
  return validate(JSON.parse(json));
}

// Enumerate everything the unit points at, normalized.
export function listRefs(unit) {
  return (unit.refs ?? []).map((r, i) =>
    r.type === "dom"
      ? { index: i, type: "dom", target: r.selector }
      : { index: i, type: "region", target: `${r.image}@${r.rect.x},${r.rect.y},${r.rect.w}x${r.rect.h}` },
  );
}

// Coverage: which marks and refs are bound by at least one note, and which
// are floating (drawn but never referenced by text). Floating parts are not
// errors - a drawing alone is a legal unit - but the executor should know.
export function coverage(unit) {
  const bound = new Set();
  for (const n of unit.notes ?? []) {
    for (const b of n.binds ?? []) bound.add(b);
  }
  const marks = (unit.marks ?? []).map((m) => ({
    id: m.id,
    bound: bound.has(m.id) || (m.group != null && bound.has(m.group)),
  }));
  const refs = (unit.refs ?? []).map((_, i) => ({ id: `ref:${i}`, bound: bound.has(`ref:${i}`) }));
  return {
    marks,
    refs,
    unbound: [...marks.filter((m) => !m.bound).map((m) => m.id), ...refs.filter((r) => !r.bound).map((r) => r.id)],
  };
}
