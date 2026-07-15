/* global CSS, MutationObserver, document, window */

// The pixel drawing layer: vector marks drawn over the rendered artifact.
//
// The important model is deliberately simple:
//   - draw tools create selectable mark objects;
//   - select mode selects mark objects and DOM element references into one mixed selection;
//   - hand mode moves selected mark objects as a group;
//   - the comment composer queues the current mixed selection plus note text as a unit of guidance.
//
// Like createArtifactSdk, createDrawLayer is injected into the artifact by
// STRINGIFYING it (server.js createSdkJs), so it must be fully self-contained:
// no imports, no captured module scope. The pure helpers live in drawHelpers,
// serialized alongside it the same way the mermaid helpers are, which also
// makes them unit-testable in Node.

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in test/draw-layer.test.js)
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;
const ARC_MIN_RADIUS = 6;
const DRAW_TOOLS = ["select", "hand", "box", "arrow", "circle", "arc", "arc-arrow", "freehand", "erase"];

// The arch and the arrow-tipped arch share one editable geometry (A, apex
// vertex, B, plus a protractor tangent line); only the rendered stroke differs.
export function isArchShape(shape) {
  return Boolean(shape) && (shape.type === "arc" || shape.type === "arc-arrow");
}

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function normalizeDrawTool(tool) {
  const raw = String(tool || "");
  if (DRAW_TOOLS.includes(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (normalized === "arch") return "arc";
  return "";
}

// True when a keyboard event originates in an editable field, so window-level
// mark shortcuts (Delete/Backspace, undo) must stand down and let the user type.
// The draw UI lives in a shadow root, so events bubbling to window are
// retargeted to the shadow host; evt.target is the host, not the field. The
// composedPath's innermost node is the real target across that boundary.
export function isEditableEventTarget(evt) {
  const target = (evt && evt.composedPath && evt.composedPath()[0]) || (evt && evt.target);
  if (!target) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || Boolean(target.isContentEditable);
}

export function normalizeAngle(deg) {
  const n = finite(deg) % 360;
  return n < 0 ? n + 360 : n;
}

export function angleBetween(a, b) {
  const d = normalizeAngle(b) - normalizeAngle(a);
  return d < 0 ? d + 360 : d;
}

export function pointAtAngle(center, radius, angle) {
  const r = finite(radius, 0);
  const rad = normalizeAngle(angle) * DEG;
  return { x: center.x + Math.cos(rad) * r, y: center.y + Math.sin(rad) * r };
}

export function angleForPoint(center, point) {
  return normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x) / DEG);
}

// ---- Arch (three-point apex + protractor tangent) ---------------------------
// An arch is a smooth curve from point A to point B that passes through a
// movable vertex V. A straight "angle line" runs through V; its two square
// handles - h1 on the A side, h2 on the B side - set the curve's tangent
// direction and strength at the apex. The rendered curve is two quadratic
// Beziers, A->V (control h1) and V->B (control h2), so it always passes through
// A, V and B and stays smooth across the vertex.
//
// A shape is stored anchored at A: { x, y } is A, and `end`, `vertex` are
// offsets from A; `tan` is the half-vector of the angle line measured from V
// (so h2 = V + tan, h1 = V - tan). Moving the shape only shifts x/y, which
// carries the whole arch, so it composes with the hand tool unchanged.

export function archAbsPoints(shape) {
  const a = { x: shape.x, y: shape.y };
  const b = { x: shape.x + shape.end.x, y: shape.y + shape.end.y };
  const v = { x: shape.x + shape.vertex.x, y: shape.y + shape.vertex.y };
  const h1 = { x: v.x - shape.tan.x, y: v.y - shape.tan.y };
  const h2 = { x: v.x + shape.tan.x, y: v.y + shape.tan.y };
  return { a, b, v, h1, h2 };
}

function quadPoint(p0, c, p1, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
}

export function arcSamplePoints(shape, steps = 24) {
  const { a, b, v, h1, h2 } = archAbsPoints(shape);
  const per = Math.max(2, Math.min(steps || 16, 24));
  const pts = [quadPoint(a, h1, v, 0)];
  for (let i = 1; i <= per; i++) pts.push(quadPoint(a, h1, v, i / per));
  for (let i = 1; i <= per; i++) pts.push(quadPoint(v, h2, b, i / per));
  return pts;
}

export function arcRelPoints(shape, steps = 24) {
  return arcSamplePoints(shape, steps).map((p) => ({ x: p.x - shape.x, y: p.y - shape.y }));
}

export function arcHandlePoints(shape) {
  const { a, b, v, h1, h2 } = archAbsPoints(shape);
  return { a, b, vertex: v, h1, h2 };
}

export function arcGuideSegments(shape) {
  const { h1, h2 } = archAbsPoints(shape);
  return [{ from: h1, to: h2 }];
}

// Build an arch from three points: A, apex V, B. The apex tangent runs parallel
// to the chord A->B, so a symmetric drag reads as a level-topped arch.
export function archFromThreePoints(a, v, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy) || 1;
  const tanLen = Math.max(16, chord * 0.28);
  const arc = {
    type: "arc",
    x: a.x,
    y: a.y,
    end: { x: dx, y: dy },
    vertex: { x: v.x - a.x, y: v.y - a.y },
    tan: { x: (dx / chord) * tanLen, y: (dy / chord) * tanLen },
  };
  return { ...arc, rel: arcRelPoints(arc) };
}

export function arcFromDrag(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // Bow the apex to the "up" side of the chord (a rightward drag arches upward).
  const bow = Math.max(24, len * 0.4);
  const nx = dy / len;
  const ny = -dx / len;
  const vertex = { x: start.x + dx / 2 + nx * bow, y: start.y + dy / 2 + ny * bow };
  return archFromThreePoints(start, vertex, end);
}

export function updateArcHandle(shape, handle, point) {
  const abs = archAbsPoints(shape);
  let next = shape;
  if (handle === "a") {
    next = {
      ...shape,
      x: point.x,
      y: point.y,
      end: { x: abs.b.x - point.x, y: abs.b.y - point.y },
      vertex: { x: abs.v.x - point.x, y: abs.v.y - point.y },
    };
  } else if (handle === "b") {
    next = { ...shape, end: { x: point.x - shape.x, y: point.y - shape.y } };
  } else if (handle === "vertex") {
    next = { ...shape, vertex: { x: point.x - shape.x, y: point.y - shape.y } };
  } else if (handle === "h1") {
    // Drag the A-side square handle: rotate/scale the angle line about V.
    next = { ...shape, tan: { x: abs.v.x - point.x, y: abs.v.y - point.y } };
  } else if (handle === "h2") {
    next = { ...shape, tan: { x: point.x - abs.v.x, y: point.y - abs.v.y } };
  }
  return isArchShape(next) ? { ...next, rel: arcRelPoints(next) } : next;
}

// Compatibility helper kept for old callers. Returns three points: A, apex, B.
export function arcPointsFromDrag(start, end) {
  const arc = arcFromDrag(start, end);
  const { a, vertex, b } = arcHandlePoints(arc);
  return [a, vertex, b];
}

export function shapesToMarks(shapes) {
  return shapes.map((shape) => {
    const mark = { id: shape.id, type: shape.type };
    if (isArchShape(shape)) {
      const abs = archAbsPoints(shape);
      mark.a = abs.a;
      mark.b = abs.b;
      mark.vertex = abs.v;
      mark.tan = { x: shape.tan.x, y: shape.tan.y };
      mark.points = arcSamplePoints(shape, 12);
    } else {
      mark.points = shape.rel.map((p) => ({ x: shape.x + p.x, y: shape.y + p.y }));
    }
    if (shape.group) mark.group = shape.group;
    if (shape.tag) mark.tag = shape.tag;
    return mark;
  });
}

export function marksToShapes(marks) {
  return marks.map((mark) => {
    if (isArchShape(mark)) {
      const meta = {
        type: mark.type,
        group: mark.group || null,
        tag: mark.tag || null,
        stroke: mark.stroke || "#ff2d55",
      };
      // Current format: explicit A, apex vertex, B, plus the tangent half-vector.
      if (mark.a && mark.b && mark.vertex) {
        const a = { x: finite(mark.a.x), y: finite(mark.a.y) };
        const b = { x: finite(mark.b.x), y: finite(mark.b.y) };
        const v = { x: finite(mark.vertex.x), y: finite(mark.vertex.y) };
        const arch = archFromThreePoints(a, v, b);
        if (mark.tan) arch.tan = { x: finite(mark.tan.x), y: finite(mark.tan.y) };
        return { id: mark.id, ...arch, rel: arcRelPoints({ ...arch }), ...meta };
      }
      // Legacy formats: geometric center/radius/angles, or a 3-point sample.
      if (mark.center && mark.radius != null) {
        const center = { x: finite(mark.center.x), y: finite(mark.center.y) };
        const radius = Math.max(ARC_MIN_RADIUS, finite(mark.radius, ARC_MIN_RADIUS));
        const startAngle = normalizeAngle(mark.startAngle ?? 0);
        const endAngle = normalizeAngle(mark.endAngle ?? 120);
        const midAngle = startAngle + angleBetween(startAngle, endAngle) / 2;
        const arch = archFromThreePoints(
          pointAtAngle(center, radius, startAngle),
          pointAtAngle(center, radius, midAngle),
          pointAtAngle(center, radius, endAngle),
        );
        return { id: mark.id, ...arch, ...meta };
      }
      if (Array.isArray(mark.points) && mark.points.length >= 3) {
        const start = mark.points[0];
        const end = mark.points[mark.points.length - 1];
        const apex = mark.points[Math.floor(mark.points.length / 2)];
        const arch = archFromThreePoints(start, apex, end);
        return { id: mark.id, ...arch, ...meta };
      }
    }
    const first = mark.points[0] || { x: 0, y: 0 };
    return {
      id: mark.id,
      type: mark.type,
      x: first.x,
      y: first.y,
      rel: mark.points.map((p) => ({ x: p.x - first.x, y: p.y - first.y })),
      group: mark.group || null,
      tag: mark.tag || null,
      stroke: mark.stroke || "#ff2d55",
    };
  });
}

export function decimatePoints(points, minDist) {
  if (points.length <= 2) return points.slice();
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minDist) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function draftShapeFromGesture(tool, gesture, { id = "draft", stroke = "#ff2d55" } = {}) {
  const selectedTool = normalizeDrawTool(tool);
  if (!selectedTool || selectedTool === "select" || selectedTool === "hand" || selectedTool === "erase") return null;
  const start = gesture.start;
  const end = gesture.trail[gesture.trail.length - 1];
  const base = { id, x: start.x, y: start.y, stroke, group: null, tag: null };
  if (selectedTool === "box")
    return {
      ...base,
      type: "box",
      rel: [
        { x: 0, y: 0 },
        { x: end.x - start.x, y: end.y - start.y },
      ],
    };
  if (selectedTool === "circle")
    return {
      ...base,
      type: "circle",
      rel: [
        { x: 0, y: 0 },
        { x: end.x - start.x, y: end.y - start.y },
      ],
    };
  if (selectedTool === "arrow")
    return {
      ...base,
      type: "arrow",
      rel: [
        { x: 0, y: 0 },
        { x: end.x - start.x, y: end.y - start.y },
      ],
    };
  if (selectedTool === "arc" || selectedTool === "arc-arrow")
    return { ...base, ...arcFromDrag(start, end), type: selectedTool };
  const pts = decimatePoints(gesture.trail, 6);
  return {
    ...base,
    type: "freehand",
    rel: pts.map((p) => ({ x: p.x - start.x, y: p.y - start.y })),
  };
}

function pointBounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function shapeBounds(shape) {
  if (isArchShape(shape)) return pointBounds([...arcSamplePoints(shape), ...Object.values(arcHandlePoints(shape))]);
  // A circle renders centered at (shape.x, shape.y) with a radius derived from
  // its rel endpoints, so its bounds are the square around that center - not the
  // rel corner box the other shapes use. Without this the hit-box sits off the
  // visible circle and select/erase clicks miss it.
  if (shape.type === "circle") {
    const r = Math.max(Math.hypot(shape.rel[1].x - shape.rel[0].x, shape.rel[1].y - shape.rel[0].y), 2);
    return { x: shape.x - r, y: shape.y - r, w: 2 * r, h: 2 * r };
  }
  const xs = shape.rel.map((p) => shape.x + p.x);
  const ys = shape.rel.map((p) => shape.y + p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function unionRects(rects) {
  const valid = (rects || []).filter(
    (rect) =>
      rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h),
  );
  if (valid.length === 0) return null;
  const x1 = Math.min(...valid.map((rect) => rect.x));
  const y1 = Math.min(...valid.map((rect) => rect.y));
  const x2 = Math.max(...valid.map((rect) => rect.x + rect.w));
  const y2 = Math.max(...valid.map((rect) => rect.y + rect.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function selectionBounds({ shapes = [], selectedIds = [], refs = [] }) {
  const selected = new Set(selectedIds || []);
  return unionRects([
    ...shapes.filter((shape) => selected.has(shape.id)).map(shapeBounds),
    ...(refs || []).map((ref) => ref.rect),
  ]);
}

export function createHistory(limit = 80) {
  const past = [];
  const future = [];
  return {
    record(snapshot) {
      past.push(snapshot);
      if (past.length > limit) past.shift();
      future.length = 0;
    },
    undo(current) {
      if (past.length === 0) return null;
      future.push(current);
      return past.pop();
    },
    redo(current) {
      if (future.length === 0) return null;
      past.push(current);
      return future.pop();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}

export function isDegenerateShape(shape, min = 4) {
  if (isArchShape(shape)) return Math.hypot(shape.end.x, shape.end.y) < ARC_MIN_RADIUS;
  if (shape.type === "freehand" || shape.type === "curve" || shape.type === "freehand-arrow")
    return shape.rel.length < 3;
  const b = shapeBounds(shape);
  return b.w < min && b.h < min;
}

export function buildUnit({ id, state = "default", marks = [], refs = [], noteText = "", selectedMarkIds = [] }) {
  const boundMarks = selectedMarkIds.length > 0 ? selectedMarkIds : marks.map((m) => m.id);
  const binds = [...boundMarks, ...refs.map((_, i) => "ref:" + i)];
  const unit = {
    v: 1,
    id,
    state,
    refs: refs.map((r) => ({
      type: r.type || "dom",
      ...(r.uid ? { uid: r.uid } : {}),
      selector: r.selector,
      rect: r.rect,
      ...(r.text ? { text: r.text } : {}),
      ...(r.target ? { target: r.target } : {}),
    })),
    marks,
    notes: [],
    createdAt: new Date().toISOString(),
  };
  const text = String(noteText || "").trim();
  if (text) unit.notes.push({ text, binds });
  return unit;
}

export function unitPreview(unit) {
  const parts = [];
  if (unit.marks.length) parts.push(unit.marks.length + " mark" + (unit.marks.length === 1 ? "" : "s"));
  if (unit.refs.length) parts.push(unit.refs.length + " element" + (unit.refs.length === 1 ? "" : "s"));
  const what = parts.length ? " [" + parts.join(" + ") + "]" : "";
  const note = unit.notes[0]?.text || "(visual guidance, no note)";
  return note + what;
}

const GROUP_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function drawingGroupsFromMarks(marks) {
  const groups = new Map();
  for (const mark of marks ?? []) {
    const key = mark.group || mark.id;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        label: GROUP_LABELS[groups.size] || "G" + (groups.size + 1),
        markIds: [],
        markTypes: [],
        tags: [],
      });
    }
    const group = groups.get(key);
    group.markIds.push(mark.id);
    if (!group.markTypes.includes(mark.type)) group.markTypes.push(mark.type);
    if (mark.tag && !group.tags.includes(mark.tag)) group.tags.push(mark.tag);
  }
  return [...groups.values()];
}

export function visualFeedbackFromUnit(unit, { drawingOverlayPng = "" } = {}) {
  const drawingGroups = drawingGroupsFromMarks(unit.marks);
  const markToGroup = new Map();
  for (const group of drawingGroups) for (const markId of group.markIds) markToGroup.set(markId, group.id);
  const htmlRefs = (unit.refs ?? []).map((ref, index) => ({
    id: "html-" + (index + 1),
    uid: String(ref.uid || ""),
    type: ref.type,
    selector: ref.selector || "",
    text: String(ref.text || ""),
    boundTo: drawingGroups.map((group) => group.id),
  }));
  const bindTargets = (binds = []) => {
    const out = [];
    for (const bind of binds) {
      if (bind.startsWith("ref:")) {
        const index = Number(bind.slice(4));
        if (htmlRefs[index]) out.push(htmlRefs[index].id);
        continue;
      }
      if (drawingGroups.some((group) => group.id === bind)) {
        out.push(bind);
        continue;
      }
      const groupId = markToGroup.get(bind);
      if (groupId) out.push(groupId);
    }
    return [...new Set(out)];
  };
  return {
    v: 1,
    id: unit.id,
    state: unit.state,
    drawingGroups,
    htmlRefs,
    notes: (unit.notes ?? []).map((note) => ({ text: note.text, boundTo: bindTargets(note.binds ?? []) })),
    images: {
      ...(drawingOverlayPng ? { drawingOverlayPng } : {}),
      ...(drawingGroups.length
        ? { annotatedDrawings: "generated-from-drawing-overlay" }
        : { cleanScreenshot: "generate-on-send" }),
    },
  };
}

export function selectionSummary(markCount, refCount) {
  const parts = [];
  if (markCount) parts.push(markCount + " mark" + (markCount === 1 ? "" : "s"));
  if (refCount) parts.push(refCount + " element" + (refCount === 1 ? "" : "s"));
  return parts.length ? parts.join(" + ") + " selected" : "Nothing selected";
}

export function surfaceStateDescriptor(root) {
  if (!root) return { states: [], active: "default" };
  const active = String(root.dataset?.state || "default");
  const descendants = typeof root.querySelectorAll === "function" ? [...root.querySelectorAll("[data-state]")] : [];
  const states = [...new Set(descendants.map((element) => String(element.dataset?.state || "")).filter(Boolean))];
  if (!states.includes(active)) states.unshift(active);
  return { states, active };
}

export function createStateBuckets(createValue, initialState = "default") {
  let active = String(initialState || "default");
  const buckets = new Map([[active, createValue(active)]]);
  const current = () => {
    if (!buckets.has(active)) buckets.set(active, createValue(active));
    return buckets.get(active);
  };
  return {
    active: () => active,
    current,
    set(value) {
      buckets.set(active, value);
      return value;
    },
    switchTo(state) {
      active = String(state || "default");
      return current();
    },
  };
}

export const drawHelpers = {
  DEG,
  ARC_MIN_RADIUS,
  DRAW_TOOLS,
  GROUP_LABELS,
  isArchShape,
  finite,
  pointBounds,
  normalizeAngle,
  angleBetween,
  pointAtAngle,
  angleForPoint,
  archAbsPoints,
  quadPoint,
  archFromThreePoints,
  arcSamplePoints,
  arcRelPoints,
  arcHandlePoints,
  arcGuideSegments,
  arcFromDrag,
  updateArcHandle,
  shapesToMarks,
  marksToShapes,
  decimatePoints,
  arcPointsFromDrag,
  normalizeDrawTool,
  shapeBounds,
  rectsIntersect,
  unionRects,
  selectionBounds,
  createHistory,
  isDegenerateShape,
  draftShapeFromGesture,
  buildUnit,
  unitPreview,
  drawingGroupsFromMarks,
  visualFeedbackFromUnit,
  selectionSummary,
  surfaceStateDescriptor,
  createStateBuckets,
};

// ---------------------------------------------------------------------------
// The browser layer (stringified into /sdk.js; self-contained by contract)
// ---------------------------------------------------------------------------

export function createDrawLayer(helpers) {
  const win = /** @type {any} */ (window);
  const {
    arcRelPoints,
    arcHandlePoints,
    arcGuideSegments,
    updateArcHandle,
    shapesToMarks,
    marksToShapes,
    shapeBounds,
    rectsIntersect,
    selectionBounds,
    createHistory,
    isDegenerateShape,
    isArchShape,
    normalizeDrawTool,
    draftShapeFromGesture,
    buildUnit,
    unitPreview,
    visualFeedbackFromUnit,
    selectionSummary,
    surfaceStateDescriptor,
    createStateBuckets,
  } = helpers;

  const STROKES = ["#ff2d55", "#f4c95d", "#36d399", "#7dd3fc", "#111111", "#ffffff"];
  const CURSOR_ICON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l7.8 18 2.1-7.9 7.7-2.4L3 3z"/><path d="m13 13 6 6"/></svg>';
  const TOOLS = [
    ["select", "Select marks and page elements", CURSOR_ICON],
    ["hand", "Move selected marks", "&#9995;"],
    ["box", "Selection box", "&#9633;"],
    ["arrow", "Arrow", "&#8599;"],
    ["arc-arrow", "Arch arrow", '<span style="font-size:22px;line-height:1">&#10557;</span>'],
    ["circle", "Circle", "&#9675;"],
    ["arc", "Arch", "&#8994;"],
    ["freehand", "Freehand", "&#9998;"],
    ["erase", "Delete mark", "&#10005;"],
  ];

  let konvaReady = null;
  let stage = null;
  let layer = null;
  let marquee = null;
  let active = false;
  let tool = "select";
  let stroke = STROKES[0];
  const shapeBuckets = createStateBuckets(() => []);
  let shapes = shapeBuckets.current();
  let selectedIds = [];
  let selectedRefs = [];
  let groupSeq = 0;
  let markSeq = 0;
  let refSeq = 0;
  const historyBuckets = createStateBuckets(() => createHistory());
  let history = historyBuckets.current();
  let drag = null;
  let draftPreview = null;
  let moveDrag = null;
  let handleDrag = null;
  let ui = {};
  let unitSeq = 0;
  let chromeToolbarMounted = false;
  let lastSelectionKey = "";
  let feedbackCardMoved = false;
  let feedbackCardDrag = null;
  let stateObserver = null;
  const queuedKeysByMarkId = new Map();

  function nextMarkId() {
    markSeq += 1;
    return "m" + markSeq;
  }

  function nextRefId() {
    refSeq += 1;
    return "r" + refSeq;
  }

  function loadKonva() {
    if (win.Konva) return Promise.resolve();
    if (konvaReady) return konvaReady;
    konvaReady = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/konva.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Konva"));
      document.documentElement.appendChild(script);
    });
    return konvaReady;
  }

  function pagePos(evt) {
    return { x: evt.clientX + window.scrollX, y: evt.clientY + window.scrollY };
  }

  function cloneShape(s) {
    if (isArchShape(s))
      return {
        ...s,
        end: { ...s.end },
        vertex: { ...s.vertex },
        tan: { ...s.tan },
        rel: (s.rel || []).map((p) => ({ ...p })),
      };
    return { ...s, rel: s.rel.map((p) => ({ ...p })) };
  }

  function konvaNode(shape) {
    const K = win.Konva;
    const common = {
      id: shape.id,
      stroke: shape.stroke,
      strokeWidth: 3,
      hitStrokeWidth: 14,
      listening: false,
    };
    if (shape.type === "box") {
      const b = shapeBounds({ ...shape, x: 0, y: 0 });
      return new K.Rect({
        ...common,
        x: shape.x + b.x,
        y: shape.y + b.y,
        width: b.w,
        height: b.h,
        fill: shape.stroke + "14",
        offsetX: b.x,
        offsetY: b.y,
      });
    }
    if (shape.type === "circle") {
      const r = Math.hypot(shape.rel[1].x - shape.rel[0].x, shape.rel[1].y - shape.rel[0].y);
      return new K.Circle({ ...common, x: shape.x, y: shape.y, radius: Math.max(r, 2) });
    }
    if (shape.type === "arrow" || shape.type === "freehand-arrow") {
      return new K.Arrow({
        ...common,
        x: shape.x,
        y: shape.y,
        points: shape.rel.map((p) => [p.x, p.y]).flat(),
        pointerLength: 12,
        pointerWidth: 12,
        fill: shape.stroke,
        lineCap: "round",
        lineJoin: "round",
        tension: shape.type === "freehand-arrow" ? 0.2 : 0,
      });
    }
    if (isArchShape(shape)) {
      const points = (shape.rel || arcRelPoints(shape)).map((p) => [p.x, p.y]).flat();
      const Ctor = shape.type === "arc-arrow" ? K.Arrow : K.Line;
      return new Ctor({
        ...common,
        x: shape.x,
        y: shape.y,
        points,
        lineCap: "round",
        lineJoin: "round",
        ...(shape.type === "arc-arrow" ? { pointerLength: 12, pointerWidth: 12, fill: shape.stroke } : {}),
      });
    }
    return new K.Line({
      ...common,
      x: shape.x,
      y: shape.y,
      points: shape.rel.map((p) => [p.x, p.y]).flat(),
      lineCap: "round",
      lineJoin: "round",
      tension: shape.type === "freehand" ? 0.2 : 0.5,
    });
  }

  function renderArcHandles(shape) {
    const K = win.Konva;
    const handles = arcHandlePoints(shape);
    // The protractor "angle line" running through the vertex.
    for (const segment of arcGuideSegments(shape)) {
      layer.add(
        new K.Line({
          points: [segment.from.x, segment.from.y, segment.to.x, segment.to.y],
          stroke: "#f4c95d",
          strokeWidth: 1.5,
          dash: [5, 4],
          listening: false,
        }),
      );
    }
    // Round handles for the endpoints A/B and the apex vertex.
    for (const kind of ["a", "b", "vertex"]) {
      const p = handles[kind];
      layer.add(
        new K.Circle({
          x: p.x,
          y: p.y,
          radius: kind === "vertex" ? 6 : 5,
          fill: kind === "vertex" ? "#f4c95d" : "#101013",
          stroke: "#f4c95d",
          strokeWidth: 2,
          listening: false,
        }),
      );
    }
    // Square handles at the ends of the angle line set the apex tangent.
    for (const kind of ["h1", "h2"]) {
      const p = handles[kind];
      layer.add(
        new K.Rect({
          x: p.x,
          y: p.y,
          width: 10,
          height: 10,
          offsetX: 5,
          offsetY: 5,
          fill: "#101013",
          stroke: "#f4c95d",
          strokeWidth: 2,
          listening: false,
        }),
      );
    }
  }

  function render() {
    if (!layer) return;
    shapeBuckets.set(shapes);
    layer.destroyChildren();
    for (const shape of shapes) {
      const node = konvaNode(shape);
      if (selectedIds.includes(shape.id)) {
        node.shadowColor("#f4c95d");
        node.shadowBlur(0);
        node.shadowOffset({ x: 0, y: 0 });
        node.strokeWidth(4.5);
      }
      layer.add(node);
      if (isArchShape(shape) && selectedIds.includes(shape.id)) renderArcHandles(shape);
    }
    if (draftPreview) layer.add(konvaNode(draftPreview));
    if (marquee) {
      layer.add(
        new win.Konva.Rect({
          ...marquee,
          stroke: "#2e77b5",
          dash: [6, 4],
          fill: "rgba(46,119,181,0.10)",
          listening: false,
        }),
      );
    }
    for (const ref of selectedRefs) {
      layer.add(
        new win.Konva.Rect({
          x: ref.rect.x,
          y: ref.rect.y,
          width: ref.rect.w,
          height: ref.rect.h,
          stroke: "#f4c95d",
          dash: [8, 5],
          strokeWidth: 2,
          listening: false,
        }),
      );
    }
    layer.batchDraw();
    syncToolbar();
  }

  function snapshot() {
    return {
      shapes: shapes.map(cloneShape),
      selectedIds: selectedIds.slice(),
      selectedRefs: selectedRefs.map((r) => ({ ...r, rect: { ...r.rect } })),
    };
  }

  function restore(snap) {
    shapes = snap.shapes;
    selectedIds = snap.selectedIds;
    selectedRefs = snap.selectedRefs || [];
    render();
  }

  function commit(mutate) {
    history.record(snapshot());
    mutate();
    render();
  }

  function handleAt(pos) {
    for (const shape of shapes) {
      if (!isArchShape(shape) || !selectedIds.includes(shape.id)) continue;
      const handles = arcHandlePoints(shape);
      for (const kind of ["h1", "h2", "vertex", "a", "b"]) {
        const p = handles[kind];
        if (Math.hypot(pos.x - p.x, pos.y - p.y) <= 10) return { shape, kind };
      }
    }
    return null;
  }

  function shapeAt(pos) {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const b = shapeBounds(shapes[i]);
      if (pos.x >= b.x - 8 && pos.x <= b.x + b.w + 8 && pos.y >= b.y - 8 && pos.y <= b.y + b.h + 8) return shapes[i];
    }
    return null;
  }

  function underlyingElementAt(evt) {
    const previous = ui.stageContainer ? ui.stageContainer.style.pointerEvents : "";
    if (ui.stageContainer) ui.stageContainer.style.pointerEvents = "none";
    const el = document.elementFromPoint(evt.clientX, evt.clientY);
    if (ui.stageContainer) ui.stageContainer.style.pointerEvents = previous;
    if (!el || el.closest("[data-lavish-ui]")) return null;
    if (el === document.documentElement || el === document.body) return null;
    return el;
  }

  function selectorFor(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(part + "#" + CSS.escape(node.id));
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((x) => x.tagName === node.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(" > ");
  }

  function refForElement(el) {
    const r = el.getBoundingClientRect();
    return {
      id: nextRefId(),
      selector: selectorFor(el),
      rect: {
        x: Math.round(r.left + window.scrollX),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
    };
  }

  function refFromContext(c, options = {}) {
    const raw = options.rect || c?.rect || null;
    const numberOr = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
    const rect = raw
      ? {
          x: Math.round(numberOr(raw.x, numberOr(raw.left, 0) + window.scrollX)),
          y: Math.round(numberOr(raw.y, numberOr(raw.top, 0) + window.scrollY)),
          w: Math.round(numberOr(raw.w, numberOr(raw.width, 0))),
          h: Math.round(numberOr(raw.h, numberOr(raw.height, 0))),
        }
      : null;
    return {
      id: nextRefId(),
      uid: String(c?.uid || ""),
      selector: String(c?.selector || ""),
      tag: String(c?.tag || "element"),
      text: String(c?.text || ""),
      target: c?.target || null,
      rect:
        rect && rect.w >= 0 && rect.h >= 0
          ? rect
          : {
              x: 0,
              y: 0,
              w: 0,
              h: 0,
            },
    };
  }

  function setSelectedRef(ref, additive) {
    const exists = selectedRefs.some((r) => r.selector === ref.selector && r.tag === ref.tag && r.text === ref.text);
    if (additive) {
      selectedRefs = exists
        ? selectedRefs.filter((r) => !(r.selector === ref.selector && r.tag === ref.tag && r.text === ref.text))
        : [...selectedRefs, ref];
    } else {
      selectedIds = [];
      selectedRefs = [ref];
    }
  }

  function selectElementAt(evt, additive) {
    const el = underlyingElementAt(evt);
    if (!el) {
      if (!additive) selectedRefs = [];
      return;
    }
    setSelectedRef(refForElement(el), additive);
  }

  function cancelGesture() {
    drag = null;
    draftPreview = null;
    moveDrag = null;
    handleDrag = null;
    marquee = null;
  }

  function capturePointer(evt) {
    try {
      ui.stageContainer?.setPointerCapture?.(evt.pointerId);
    } catch {
      // Pointer capture is best-effort; drawing must still work if the browser rejects it.
    }
  }

  function releasePointer(evt) {
    try {
      ui.stageContainer?.releasePointerCapture?.(evt.pointerId);
    } catch {
      // Ignore stale pointer ids from cancelled drags.
    }
  }

  function onDown(evt) {
    if (!active) return;
    capturePointer(evt);
    const pos = pagePos(evt);
    const handle = handleAt(pos);
    if (handle) {
      handleDrag = { ...handle, before: snapshot(), moved: false };
      return;
    }
    if (tool === "hand") {
      const hit = shapeAt(pos);
      if (!hit) return;
      if (!selectedIds.includes(hit.id)) {
        selectedIds = evt.shiftKey ? [...selectedIds, hit.id] : [hit.id];
        selectedRefs = evt.shiftKey ? selectedRefs : [];
      }
      const origins = {};
      for (const s of shapes) if (selectedIds.includes(s.id)) origins[s.id] = { x: s.x, y: s.y };
      moveDrag = { start: pos, origins, before: snapshot(), moved: false };
      render();
      return;
    }
    if (tool === "select") {
      const hit = shapeAt(pos);
      if (hit) {
        if (evt.shiftKey) {
          selectedIds = selectedIds.includes(hit.id)
            ? selectedIds.filter((i) => i !== hit.id)
            : [...selectedIds, hit.id];
        } else {
          selectedIds = [hit.id];
          selectedRefs = [];
        }
        render();
        return;
      }
      marquee = { x: pos.x, y: pos.y, width: 0, height: 0 };
      moveDrag = { marqueeStart: pos, shift: evt.shiftKey, originalRefs: selectedRefs.slice() };
      render();
      return;
    }
    if (tool === "erase") {
      const hit = shapeAt(pos);
      if (hit)
        commit(() => {
          removeQueuedUnitsForMarks([hit.id]);
          shapes = shapes.filter((s) => s.id !== hit.id);
          selectedIds = selectedIds.filter((i) => i !== hit.id);
        });
      return;
    }
    draftPreview = null;
    drag = { start: pos, trail: [pos], before: snapshot() };
  }

  function onMove(evt) {
    if (!active) return;
    const pos = pagePos(evt);
    if (handleDrag) {
      handleDrag.moved = true;
      shapes = shapes.map((s) => (s.id === handleDrag.shape.id ? updateArcHandle(s, handleDrag.kind, pos) : s));
      render();
      return;
    }
    if (moveDrag && moveDrag.marqueeStart) {
      const s = moveDrag.marqueeStart;
      marquee = {
        x: Math.min(s.x, pos.x),
        y: Math.min(s.y, pos.y),
        width: Math.abs(pos.x - s.x),
        height: Math.abs(pos.y - s.y),
      };
      render();
      return;
    }
    if (moveDrag) {
      const dx = pos.x - moveDrag.start.x;
      const dy = pos.y - moveDrag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) moveDrag.moved = true;
      shapes = shapes.map((s) =>
        moveDrag.origins[s.id] ? { ...s, x: moveDrag.origins[s.id].x + dx, y: moveDrag.origins[s.id].y + dy } : s,
      );
      render();
      return;
    }
    if (!drag) return;
    drag.trail.push(pos);
    draftPreview = draftShape(drag);
    render();
  }

  function draftShape(gesture) {
    return draftShapeFromGesture(tool, gesture, { id: "draft", stroke });
  }

  function onUp(evt) {
    if (!active) return;
    releasePointer(evt);
    if (handleDrag) {
      if (handleDrag.moved) {
        history.record(handleDrag.before);
        removeQueuedUnitsForMarks([handleDrag.shape.id]);
      }
      handleDrag = null;
      render();
      return;
    }
    if (moveDrag && moveDrag.marqueeStart) {
      if (marquee && (marquee.width > 3 || marquee.height > 3)) {
        const box = { x: marquee.x, y: marquee.y, w: marquee.width, h: marquee.height };
        const hits = shapes.filter((s) => rectsIntersect(shapeBounds(s), box)).map((s) => s.id);
        selectedIds = moveDrag.shift ? [...new Set([...selectedIds, ...hits])] : hits;
        if (!moveDrag.shift) selectedRefs = [];
      } else {
        selectElementAt(evt, moveDrag.shift);
      }
      marquee = null;
      moveDrag = null;
      render();
      return;
    }
    if (moveDrag) {
      if (moveDrag.moved) {
        history.record(moveDrag.before);
        removeQueuedUnitsForMarks(Object.keys(moveDrag.origins || {}));
      }
      moveDrag = null;
      render();
      return;
    }
    if (!drag) return;
    const pos = pagePos(evt);
    drag.trail.push(pos);
    const draft = draftShape(drag);
    drag = null;
    draftPreview = null;
    if (!draft || isDegenerateShape(draft)) {
      render();
      return;
    }
    history.record(snapshot());
    const next = { ...draft, id: nextMarkId() };
    shapes = [...shapes, next];
    selectedIds = [next.id];
    selectedRefs = [];
    tool = "select";
    render();
  }

  function onCancel(evt) {
    releasePointer(evt);
    cancelGesture();
    render();
  }

  function onKey(evt) {
    if (!active) return;
    if (isEditableEventTarget(evt)) return;
    const mod = evt.metaKey || evt.ctrlKey;
    if (mod && evt.key.toLowerCase() === "z") {
      evt.preventDefault();
      const snap = evt.shiftKey ? history.redo(snapshot()) : history.undo(snapshot());
      if (snap) restore(snap);
    } else if (evt.key === "Delete" || evt.key === "Backspace") {
      if (selectedIds.length === 0 && selectedRefs.length === 0) return;
      evt.preventDefault();
      deleteSelection();
    } else if (evt.key === "Escape") {
      selectedIds = [];
      selectedRefs = [];
      render();
    }
  }

  function selectedShapes() {
    return shapes.filter((s) => selectedIds.includes(s.id));
  }

  function rememberQueuedUnit(markIds, queueKey) {
    for (const markId of markIds) {
      if (!queuedKeysByMarkId.has(markId)) queuedKeysByMarkId.set(markId, new Set());
      queuedKeysByMarkId.get(markId).add(queueKey);
    }
  }

  function removeQueuedUnitsForMarks(markIds) {
    const queueKeys = new Set();
    for (const markId of markIds) {
      const keys = queuedKeysByMarkId.get(markId);
      if (!keys) continue;
      for (const key of keys) queueKeys.add(key);
      queuedKeysByMarkId.delete(markId);
    }
    const lavish = win.lavish;
    for (const queueKey of queueKeys) {
      if (lavish && typeof lavish.removeQueuedPrompt === "function") lavish.removeQueuedPrompt(queueKey);
      else win.parent?.postMessage?.({ type: "lavish:removeQueuedPrompt", queueKey }, "*");
    }
  }

  function selectedKey() {
    return JSON.stringify({
      marks: selectedIds.slice().sort(),
      refs: selectedRefs.map((ref) => [ref.selector, ref.tag || "", ref.text || ""]).sort(),
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function placeFeedbackCard() {
    if (!ui.card || ui.card.hidden || feedbackCardMoved) return;
    const bounds = selectionBounds({ shapes, selectedIds, refs: selectedRefs });
    if (!bounds) return;
    const left = bounds.x - window.scrollX;
    const bottom = bounds.y + bounds.h - window.scrollY;
    const cardWidth = ui.card.offsetWidth || 320;
    const cardHeight = ui.card.offsetHeight || 180;
    ui.card.style.left = clamp(left, 12, window.innerWidth - cardWidth - 12) + "px";
    ui.card.style.top = clamp(bottom + 8, 12, window.innerHeight - cardHeight - 12) + "px";
  }

  function syncFeedbackCard() {
    if (!ui.card) return;
    const key = selectedKey();
    if (key !== lastSelectionKey) {
      lastSelectionKey = key;
      feedbackCardMoved = false;
    }
    const hasSelection = selectedIds.length > 0 || selectedRefs.length > 0;
    ui.card.hidden = !hasSelection;
    if (!hasSelection) return;
    if (ui.cardTitle) ui.cardTitle.textContent = selectionSummary(selectedIds.length, selectedRefs.length);
    if (ui.queue)
      ui.queue.disabled = selectedIds.length === 0 && selectedRefs.length === 0 && !(ui.note?.value || "").trim();
    placeFeedbackCard();
  }

  function clearSelection() {
    selectedIds = [];
    selectedRefs = [];
    render();
  }

  function deleteSelection() {
    if (selectedIds.length === 0 && selectedRefs.length === 0) return;
    commit(() => {
      removeQueuedUnitsForMarks(selectedIds);
      shapes = shapes.filter((s) => !selectedIds.includes(s.id));
      selectedIds = [];
      selectedRefs = [];
    });
  }

  function startFeedbackCardDrag(evt) {
    if (!ui.card) return;
    feedbackCardDrag = {
      pointerId: evt.pointerId,
      dx: evt.clientX - ui.card.offsetLeft,
      dy: evt.clientY - ui.card.offsetTop,
    };
    feedbackCardMoved = true;
    ui.cardHandle?.setPointerCapture?.(evt.pointerId);
    evt.preventDefault();
    evt.stopPropagation();
  }

  function moveFeedbackCard(evt) {
    if (!feedbackCardDrag || !ui.card || evt.pointerId !== feedbackCardDrag.pointerId) return;
    const cardWidth = ui.card.offsetWidth || 320;
    const cardHeight = ui.card.offsetHeight || 180;
    ui.card.style.left = clamp(evt.clientX - feedbackCardDrag.dx, 12, window.innerWidth - cardWidth - 12) + "px";
    ui.card.style.top = clamp(evt.clientY - feedbackCardDrag.dy, 12, window.innerHeight - cardHeight - 12) + "px";
    evt.preventDefault();
    evt.stopPropagation();
  }

  function endFeedbackCardDrag(evt) {
    if (!feedbackCardDrag || evt.pointerId !== feedbackCardDrag.pointerId) return;
    ui.cardHandle?.releasePointerCapture?.(evt.pointerId);
    feedbackCardDrag = null;
    evt.preventDefault();
    evt.stopPropagation();
  }

  function selectReferenceFromLavish(c, options = {}) {
    ensureUi();
    setSelectedRef(refFromContext(c, options), Boolean(options.additive || options.shiftKey));
    setActive(true);
    tool = "select";
    render();
    window.setTimeout(() => ui.note?.focus(), 0);
    return true;
  }

  function captureDrawingOverlayPng(unitShapes) {
    if (!stage || !win.Konva || unitShapes.length === 0) return "";
    const width = stage.width();
    const height = stage.height();
    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;left:-100000px;top:0;width:" + width + "px;height:" + height + "px;pointer-events:none;opacity:0";
    document.body.appendChild(container);
    try {
      const tempStage = new win.Konva.Stage({ container, width, height, listening: false });
      const tempLayer = new win.Konva.Layer({ listening: false });
      tempStage.add(tempLayer);
      for (const shape of unitShapes) tempLayer.add(konvaNode(shape));
      tempLayer.draw();
      const png = tempStage.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
      tempStage.destroy();
      return png;
    } catch {
      return "";
    } finally {
      container.remove();
    }
  }

  function queueSelection(noteArg) {
    // The editing card lives in the chrome sidebar when the chrome toolbar is
    // mounted, so the note text arrives as an argument. Fall back to the
    // in-iframe card's textarea when Lavish runs without the chrome.
    const note = (typeof noteArg === "string" ? noteArg : ui.note?.value || "").trim();
    const lavish = win.lavish;
    if (!lavish || typeof lavish.queuePrompt !== "function") return;
    const unitShapes = selectedShapes();
    const marks = shapesToMarks(unitShapes);
    const refs = selectedRefs.map(({ uid, selector, rect, tag, text, target }) => ({
      uid,
      selector,
      rect,
      type: tag || "element",
      text,
      target,
    }));
    if (marks.length === 0 && refs.length === 0) {
      if (!note) return;
      lavish.queuePrompt(note, { tag: "message", text: "General note" });
      ui.note.value = "";
      syncToolbar();
      return;
    }
    unitSeq += 1;
    const unit = buildUnit({
      id: "u" + Date.now().toString(36) + "-" + unitSeq,
      state: currentState(),
      marks,
      refs,
      noteText: note,
    });
    const preview = unitPreview(unit);
    const feedback = visualFeedbackFromUnit(unit, { drawingOverlayPng: captureDrawingOverlayPng(unitShapes) });
    const queueKey = "draw-unit:" + unit.id;
    lavish.queuePrompt(preview, {
      tag: "feedback-unit",
      text: preview,
      target: { type: "visual-feedback-unit", feedback },
      queueKey,
    });
    rememberQueuedUnit(
      unitShapes.map((shape) => shape.id),
      queueKey,
    );
    ui.note.value = "";
    selectedIds = [];
    selectedRefs = [];
    render();
  }

  function ensureUi() {
    if (ui.host) return;
    const host = document.createElement("div");
    host.className = "lavish-draw-root";
    host.setAttribute("data-lavish-ui", "draw-root");
    document.documentElement.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{all:initial;position:fixed;z-index:2147483647;left:0;top:0;font-family:Geist,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color-scheme:dark;--fg-faint:#aeb6c6}" +
      "*{box-sizing:border-box}" +
      ".dock{position:fixed;left:12px;top:54px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}" +
      ".pill{display:flex;align-items:center;gap:8px;border:1px solid #3c4557;background:#11141a;color:#f7f3ea;font-size:13px;font-weight:700;padding:9px 14px;border-radius:999px;cursor:pointer;box-shadow:0 20px 70px rgba(0,0,0,.35)}" +
      ".pill.on{border-color:#f4c95d;color:#f4c95d}" +
      ".palette{display:none;flex-direction:column;gap:7px;border:1px solid #303745;background:#11141a;border-radius:14px;padding:8px;box-shadow:0 20px 70px rgba(0,0,0,.35);width:360px}" +
      ".palette.open{display:flex}" +
      ":host(.chrome) .dock{display:none}" +
      ":host(.chrome) .feedback-card{display:none!important}" +
      ".row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}" +
      "button.tool{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;background:transparent;color:#b9c0cf;border-radius:8px;cursor:pointer;font-size:15px;padding:0}" +
      "button.tool svg{width:16px;height:16px}" +
      "button.tool:hover{background:#1c212b}" +
      "button.tool.active{border-color:#f4c95d;color:#f4c95d}" +
      "button.tool:disabled{opacity:.4;cursor:default}" +
      ".swatch{width:18px;height:18px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}" +
      ".swatch.active{border-color:#f4c95d}" +
      ".sep{height:1px;background:#303745;margin:2px 0;width:100%}" +
      ".meta{font-size:11px;color:#aeb6c6;padding:0 2px}" +
      ".feedback-card{position:fixed;width:min(336px,calc(100vw - 24px));padding:12px;border-radius:14px;background:#11141a;color:#f7f3ea;border:1px solid #f4c95d;box-shadow:0 20px 70px rgba(0,0,0,.35);font:14px/1.4 Geist,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}" +
      ".feedback-card[hidden]{display:none}" +
      ".feedback-handle{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:-4px -4px 8px;padding:4px;border-radius:10px;cursor:grab;user-select:none;color:#f7f3ea}" +
      ".feedback-handle:active{cursor:grabbing}" +
      ".feedback-title{font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".feedback-grip{color:#aeb6c6;font:16px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0}" +
      ".feedback-card textarea{width:100%;min-height:86px;resize:vertical;border-radius:10px;border:1px solid #3c4557;background:#0f1115;color:#f7f3ea;padding:9px;font:14px/1.35 inherit}" +
      ".feedback-card textarea::placeholder{color:var(--fg-faint)}" +
      ".feedback-hint{margin-top:6px;font-size:11px;color:var(--fg-faint)}" +
      ".feedback-row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}" +
      ".feedback-card button{border:0;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}" +
      ".feedback-cancel{background:#2a2f3a;color:#f7f3ea}" +
      ".queue{background:#f4c95d;color:#17130a}" +
      ".queue:disabled{opacity:.45;cursor:default}";
    shadowRoot.appendChild(style);

    const dock = document.createElement("div");
    dock.className = "dock";
    const pill = document.createElement("button");
    pill.className = "pill";
    pill.innerHTML = "&#9998; Markup";
    pill.addEventListener("click", () => setActive(!active));
    dock.appendChild(pill);

    const palette = document.createElement("div");
    palette.className = "palette";
    const toolRow = document.createElement("div");
    toolRow.className = "row tool-row";
    for (const [id, label, icon] of TOOLS) {
      const b = document.createElement("button");
      b.className = "tool";
      b.title = label;
      b.dataset.tool = id;
      b.innerHTML = icon;
      b.addEventListener("click", () => {
        tool = id;
        syncToolbar();
      });
      toolRow.appendChild(b);
    }
    palette.appendChild(toolRow);

    const swatchRow = document.createElement("div");
    swatchRow.className = "row swatch-row";
    for (const c of STROKES) {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = c;
      b.dataset.stroke = c;
      b.title = c;
      b.addEventListener("click", () => {
        stroke = c;
        syncToolbar();
      });
      swatchRow.appendChild(b);
    }
    palette.appendChild(swatchRow);

    const sep = document.createElement("div");
    sep.className = "sep";
    palette.appendChild(sep);

    const actionRow = document.createElement("div");
    actionRow.className = "row action-row";
    /** @type {Array<[string, string, string, () => void]>} */
    const actions = [
      [
        "undo",
        "Undo (Cmd/Ctrl+Z)",
        "&#8630;",
        () => {
          const s = history.undo(snapshot());
          if (s) restore(s);
        },
      ],
      [
        "redo",
        "Redo (Cmd/Ctrl+Shift+Z)",
        "&#8631;",
        () => {
          const s = history.redo(snapshot());
          if (s) restore(s);
        },
      ],
      [
        "group",
        "Group selected marks",
        "&#9707;",
        () => {
          if (selectedIds.length < 2) return;
          groupSeq += 1;
          const gid = "g" + groupSeq;
          commit(() => {
            removeQueuedUnitsForMarks(selectedIds);
            shapes = shapes.map((s) => (selectedIds.includes(s.id) ? { ...s, group: gid } : s));
          });
        },
      ],
      [
        "clear",
        "Clear all marks",
        "&#128465;",
        () => {
          if (shapes.length === 0 && selectedRefs.length === 0) return;
          commit(() => {
            removeQueuedUnitsForMarks(shapes.map((s) => s.id));
            shapes = [];
            selectedIds = [];
            selectedRefs = [];
          });
        },
      ],
    ];
    for (const [id, label, icon, fn] of actions) {
      const b = document.createElement("button");
      b.className = "tool";
      b.dataset.action = id;
      b.title = label;
      b.innerHTML = icon;
      b.addEventListener("click", fn);
      actionRow.appendChild(b);
    }
    palette.appendChild(actionRow);

    const meta = document.createElement("div");
    meta.className = "meta";
    palette.appendChild(meta);
    dock.appendChild(palette);
    shadowRoot.appendChild(dock);

    const card = document.createElement("div");
    card.className = "feedback-card";
    card.hidden = true;
    card.innerHTML =
      '<div class="feedback-handle"><div class="feedback-title">Nothing selected</div><div class="feedback-grip">::</div></div><textarea name="feedback-comment" placeholder="Comment on the selected marks and elements."></textarea><div class="feedback-hint">Enter to queue. Drag the handle to move this box.</div><div class="feedback-row"><button class="feedback-cancel" type="button">Cancel</button><button class="queue" type="button">Queue</button></div>';
    shadowRoot.appendChild(card);
    const cardHandle = card.querySelector(".feedback-handle");
    const cardTitle = card.querySelector(".feedback-title");
    const note = card.querySelector("textarea");
    const queue = card.querySelector(".queue");
    const cancel = card.querySelector(".feedback-cancel");
    cardHandle?.addEventListener("pointerdown", startFeedbackCardDrag);
    cardHandle?.addEventListener("pointermove", moveFeedbackCard);
    cardHandle?.addEventListener("pointerup", endFeedbackCardDrag);
    cardHandle?.addEventListener("pointercancel", endFeedbackCardDrag);
    queue?.addEventListener("click", queueSelection);
    cancel?.addEventListener("click", clearSelection);
    note?.addEventListener("input", syncToolbar);
    note?.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" && !evt.shiftKey && !evt.isComposing) {
        evt.preventDefault();
        queueSelection();
      }
    });

    ui = { host, shadowRoot, pill, palette, meta, card, cardHandle, cardTitle, note, queue };
  }

  function postDrawState() {
    if (!win.parent || win.parent === window) return;
    win.parent.postMessage(
      {
        type: "lavish:draw:state",
        state: {
          active,
          tool,
          stroke,
          canUndo: history.canUndo(),
          canRedo: history.canRedo(),
          canGroup: selectedIds.length >= 2,
          summary: selectionSummary(selectedIds.length, selectedRefs.length),
          hasSelection: selectedIds.length > 0 || selectedRefs.length > 0,
        },
      },
      "*",
    );
  }

  function syncToolbar() {
    if (!ui.palette) {
      postDrawState();
      return;
    }
    for (const b of ui.palette.querySelectorAll("button.tool[data-tool]"))
      b.classList.toggle("active", b.dataset.tool === tool);
    for (const b of ui.palette.querySelectorAll(".swatch")) b.classList.toggle("active", b.dataset.stroke === stroke);
    const undoBtn = ui.palette.querySelector('button[data-action="undo"]');
    const redoBtn = ui.palette.querySelector('button[data-action="redo"]');
    const groupBtn = ui.palette.querySelector('button[data-action="group"]');
    if (undoBtn) undoBtn.disabled = !history.canUndo();
    if (redoBtn) redoBtn.disabled = !history.canRedo();
    if (groupBtn) groupBtn.disabled = selectedIds.length < 2;
    if (ui.meta) ui.meta.textContent = selectionSummary(selectedIds.length, selectedRefs.length);
    syncFeedbackCard();
    postDrawState();
  }

  function ensureStage() {
    const K = win.Konva;
    if (stage) return;
    const container = document.createElement("div");
    container.className = "lavish-draw-stage";
    container.setAttribute("data-lavish-ui", "draw-stage");
    container.style.cssText = "position:absolute;left:0;top:0;z-index:2147483600;pointer-events:none;";
    document.documentElement.appendChild(container);
    const width = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    container.style.width = width + "px";
    container.style.height = height + "px";
    stage = new K.Stage({ container, width, height, listening: false });
    layer = new K.Layer({ listening: false });
    stage.add(layer);
    container.addEventListener("pointerdown", (e) => {
      onDown(e);
      e.preventDefault();
    });
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onCancel);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("keydown", onKey);
    ui.stageContainer = container;
  }

  function currentState() {
    const stateRoot = surfaceStateRoot();
    return (stateRoot && stateRoot.getAttribute("data-state")) || "default";
  }

  function surfaceStateRoot() {
    return document.querySelector("[data-lavish-state-root][data-state], .screen[data-state]");
  }

  function postSurfaceStates() {
    const descriptor = surfaceStateDescriptor(surfaceStateRoot());
    win.parent.postMessage({ type: "lavish:states", ...descriptor }, "*");
  }

  function onSurfaceStateChange() {
    shapeBuckets.set(shapes);
    historyBuckets.set(history);
    shapes = shapeBuckets.switchTo(currentState());
    history = historyBuckets.switchTo(currentState());
    cancelGesture();
    selectedIds = [];
    selectedRefs = [];
    render();
    postSurfaceStates();
  }

  function watchSurfaceState() {
    const root = surfaceStateRoot();
    if (!root || typeof MutationObserver !== "function") {
      postSurfaceStates();
      return;
    }
    stateObserver?.disconnect();
    stateObserver = new MutationObserver((records) => {
      if (records.some((record) => record.type === "attributes" && record.attributeName === "data-state")) {
        onSurfaceStateChange();
      }
    });
    stateObserver.observe(root, { attributes: true, attributeFilter: ["data-state"] });
    postSurfaceStates();
  }

  function setActive(on) {
    active = on;
    ensureUi();
    ui.pill.classList.toggle("on", on);
    ui.palette.classList.toggle("open", on);
    if (on) {
      loadKonva().then(() => {
        ensureStage();
        ui.stageContainer.style.pointerEvents = "auto";
        render();
      });
    } else {
      if (ui.stageContainer) ui.stageContainer.style.pointerEvents = "none";
      syncToolbar();
    }
  }

  function runToolbarAction(action) {
    ensureUi();
    const button = ui.palette?.querySelector('button[data-action="' + action + '"]');
    if (button && !button.disabled) button.click();
    else syncToolbar();
  }

  function handleDrawMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "lavish:state:set") {
      const state = String(msg.state || "");
      if (!state) return;
      if (typeof win.setState === "function") win.setState(state);
      else {
        const root = surfaceStateRoot();
        if (root) root.setAttribute("data-state", state);
      }
      onSurfaceStateChange();
      return;
    }
    if (msg.type === "lavish:draw:chromeMounted") {
      chromeToolbarMounted = true;
      ensureUi();
      ui.host.classList.add("chrome");
      syncToolbar();
      return;
    }
    if (msg.type !== "lavish:draw:command") return;
    ensureUi();
    if (msg.command === "requestState") {
      syncToolbar();
    } else if (msg.command === "setActive") {
      setActive(Boolean(msg.active));
    } else if (msg.command === "setTool") {
      const next = normalizeDrawTool(msg.tool);
      if (TOOLS.some(([id]) => id === next)) {
        cancelGesture();
        tool = next;
      }
      syncToolbar();
    } else if (msg.command === "setStroke") {
      const next = String(msg.stroke || "");
      if (STROKES.includes(next)) stroke = next;
      syncToolbar();
    } else if (msg.command === "action") {
      runToolbarAction(String(msg.action || ""));
    } else if (msg.command === "queue") {
      queueSelection(typeof msg.note === "string" ? msg.note : "");
    } else if (msg.command === "clearSelection") {
      clearSelection();
    } else if (msg.command === "deleteSelection") {
      deleteSelection();
    }
  }

  function boot() {
    ensureUi();
    if (chromeToolbarMounted) ui.host.classList.add("chrome");
    syncToolbar();
    watchSurfaceState();
  }
  window.addEventListener("message", (event) => handleDrawMessage(event.data || {}));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  win.lavishDraw = {
    getMarks: () => shapesToMarks(shapes),
    getSelectedRefs: () => selectedRefs.slice(),
    getSelectedIds: () => selectedIds.slice(),
    setMarks: (marks) => {
      shapes = marksToShapes(marks);
      markSeq = shapes.length;
      selectedIds = [];
      selectedRefs = [];
      if (layer) render();
    },
    setActive,
    isActive: () => active,
    queueSelection,
  };
  win.lavishUnifiedFeedback = {
    selectReference: selectReferenceFromLavish,
    queueSelection,
  };
}
