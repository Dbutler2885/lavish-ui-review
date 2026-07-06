/* global document, window */

// The pixel drawing layer: vector marks drawn over the rendered artifact.
//
// Modeled on HomeBoysHouse's MapDrawingEditor (react-konva): every shape
// carries an (x, y) origin with geometry stored relative to it, so move,
// group-move, and duplicate are always origin translation. Tools: select,
// box, arrow, circle, curve, arc, freehand. Marks have stable identities,
// can be multi-selected (click, shift-click, marquee) and grouped, and
// serialize to the unit-of-guidance mark shape:
//   { id, type, points: [{x, y}...], group?, tag? }
//
// Like createArtifactSdk, createDrawLayer is injected into the artifact by
// STRINGIFYING it (server.js createSdkJs), so it must be fully
// self-contained: no imports, no captured module scope. The pure helpers
// live in drawHelpers, serialized alongside it the same way the mermaid
// helpers are, which also makes them unit-testable in Node.
//
// Konva itself is not stringified: the layer lazily injects
// <script src="/vendor/konva.min.js"> (served by the Lavish server, same
// origin as /sdk.js) the first time drawing is activated.

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in test/draw-layer.test.js)
// ---------------------------------------------------------------------------

// Absolute-point serialization of internal shapes (origin + relative points)
// into the unit-of-guidance mark shape.
export function shapesToMarks(shapes) {
  return shapes.map((shape) => {
    const mark = {
      id: shape.id,
      type: shape.type,
      points: shape.rel.map((p) => ({ x: shape.x + p.x, y: shape.y + p.y })),
    };
    if (shape.group) mark.group = shape.group;
    if (shape.tag) mark.tag = shape.tag;
    return mark;
  });
}

// Rebuild internal shapes from serialized marks (first point becomes the
// origin).
export function marksToShapes(marks) {
  return marks.map((mark) => {
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

// Decimate a dragged point trail: keep points at least minDist apart plus
// the final point. Curve marks use a coarser spacing than freehand.
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

// A 3-point arc from a drag: start, apex (midpoint pushed perpendicular by
// a third of the drag length), end.
export function arcPointsFromDrag(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const bulge = len / 3;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return [start, { x: mid.x - (dy / len) * bulge, y: mid.y + (dx / len) * bulge }, end];
}

// Axis-aligned bounds of a shape's absolute points.
export function shapeBounds(shape) {
  const xs = shape.rel.map((p) => shape.x + p.x);
  const ys = shape.rel.map((p) => shape.y + p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Snapshot-stack undo/redo over { shapes, selectedIds }, MapDrawingEditor
// style: one user gesture = one snapshot; capped depth.
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

// A shape is draft-discardable when the gesture was too small to mean
// anything (MapDrawingEditor's MIN_SHAPE_SIZE rule).
export function isDegenerateShape(shape, min = 4) {
  const b = shapeBounds(shape);
  if (shape.type === "freehand" || shape.type === "curve") return shape.rel.length < 3;
  return b.w < min && b.h < min;
}

export const drawHelpers = {
  shapesToMarks,
  marksToShapes,
  decimatePoints,
  arcPointsFromDrag,
  shapeBounds,
  rectsIntersect,
  createHistory,
  isDegenerateShape,
};

// ---------------------------------------------------------------------------
// The browser layer (stringified into /sdk.js; self-contained by contract)
// ---------------------------------------------------------------------------

export function createDrawLayer(helpers) {
  const win = /** @type {any} */ (window);
  const {
    shapesToMarks,
    marksToShapes,
    decimatePoints,
    arcPointsFromDrag,
    shapeBounds,
    rectsIntersect,
    createHistory,
    isDegenerateShape,
  } = helpers;

  const STROKES = ["#ff2d55", "#2e77b5", "#2f7d32", "#e8a33d", "#111111", "#ffffff"];
  const TOOLS = [
    ["select", "Select / move", "&#10548;"],
    ["box", "Selection box", "&#9633;"],
    ["arrow", "Arrow", "&#8599;"],
    ["circle", "Circle", "&#9675;"],
    ["curve", "Curve", "&#8767;"],
    ["arc", "Arc", "&#9697;"],
    ["freehand", "Freehand", "&#9998;"],
    ["erase", "Delete mark", "&#10005;"],
  ];

  let konvaReady = null;
  let stage = null;
  let layer = null;
  let marquee = null;
  let active = false;
  let tool = "box";
  let stroke = STROKES[0];
  let shapes = [];
  let selectedIds = [];
  let groupSeq = 0;
  let markSeq = 0;
  const history = createHistory();
  let drag = null; // in-progress draw gesture
  let moveDrag = null; // in-progress selection move
  let ui = {};

  function nextMarkId() {
    markSeq += 1;
    return "m" + markSeq;
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

  // --- rendering ------------------------------------------------------------

  function konvaNode(shape) {
    const K = win.Konva;
    const abs = shape.rel.map((p) => [p.x, p.y]).flat();
    const common = {
      id: shape.id,
      x: shape.x,
      y: shape.y,
      stroke: shape.stroke,
      strokeWidth: 3,
      hitStrokeWidth: 14,
      listening: true,
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
      return new K.Circle({ ...common, radius: Math.max(r, 2) });
    }
    if (shape.type === "arrow") {
      return new K.Arrow({ ...common, points: abs, pointerLength: 12, pointerWidth: 12, fill: shape.stroke });
    }
    // curve, arc, freehand: smoothed line through the points
    return new K.Line({
      ...common,
      points: abs,
      lineCap: "round",
      lineJoin: "round",
      tension: shape.type === "freehand" ? 0.2 : 0.5,
    });
  }

  function render() {
    if (!layer) return;
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
    }
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
    layer.batchDraw();
    syncToolbar();
  }

  function snapshot() {
    return {
      shapes: shapes.map((s) => ({ ...s, rel: s.rel.map((p) => ({ ...p })) })),
      selectedIds: selectedIds.slice(),
    };
  }

  function restore(snap) {
    shapes = snap.shapes;
    selectedIds = snap.selectedIds;
    render();
  }

  function commit(mutate) {
    history.record(snapshot());
    mutate();
    render();
  }

  // --- pointer handling -------------------------------------------------------

  function pagePos(evt) {
    return { x: evt.clientX + window.scrollX, y: evt.clientY + window.scrollY };
  }

  function shapeAt(pos) {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const b = shapeBounds(shapes[i]);
      if (pos.x >= b.x - 8 && pos.x <= b.x + b.w + 8 && pos.y >= b.y - 8 && pos.y <= b.y + b.h + 8) return shapes[i];
    }
    return null;
  }

  function onDown(evt) {
    if (!active) return;
    const pos = pagePos(evt);
    if (tool === "select") {
      const hit = shapeAt(pos);
      if (hit) {
        if (evt.shiftKey) {
          selectedIds = selectedIds.includes(hit.id)
            ? selectedIds.filter((i) => i !== hit.id)
            : [...selectedIds, hit.id];
        } else if (!selectedIds.includes(hit.id)) {
          selectedIds = [hit.id];
        }
        const origins = {};
        for (const s of shapes) if (selectedIds.includes(s.id)) origins[s.id] = { x: s.x, y: s.y };
        moveDrag = { start: pos, origins, before: snapshot(), moved: false };
      } else {
        marquee = { x: pos.x, y: pos.y, width: 0, height: 0 };
        moveDrag = { marqueeStart: pos, shift: evt.shiftKey };
      }
      render();
      return;
    }
    if (tool === "erase") {
      const hit = shapeAt(pos);
      if (hit)
        commit(() => {
          shapes = shapes.filter((s) => s.id !== hit.id);
          selectedIds = selectedIds.filter((i) => i !== hit.id);
        });
      return;
    }
    drag = { start: pos, trail: [pos], before: snapshot() };
  }

  function onMove(evt) {
    if (!active) return;
    const pos = pagePos(evt);
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
    // Live preview: render committed shapes plus the draft.
    const draft = draftShape(drag);
    if (draft) {
      const keep = shapes;
      shapes = [...keep, draft];
      render();
      shapes = keep;
    }
  }

  function draftShape(gesture) {
    const start = gesture.start;
    const end = gesture.trail[gesture.trail.length - 1];
    const base = { id: "draft", x: start.x, y: start.y, stroke, group: null, tag: null };
    if (tool === "box")
      return {
        ...base,
        type: "box",
        rel: [
          { x: 0, y: 0 },
          { x: end.x - start.x, y: end.y - start.y },
        ],
      };
    if (tool === "circle")
      return {
        ...base,
        type: "circle",
        rel: [
          { x: 0, y: 0 },
          { x: end.x - start.x, y: end.y - start.y },
        ],
      };
    if (tool === "arrow")
      return {
        ...base,
        type: "arrow",
        rel: [
          { x: 0, y: 0 },
          { x: end.x - start.x, y: end.y - start.y },
        ],
      };
    if (tool === "arc") {
      const pts = arcPointsFromDrag(start, end);
      return { ...base, type: "arc", rel: pts.map((p) => ({ x: p.x - start.x, y: p.y - start.y })) };
    }
    const spacing = tool === "curve" ? 24 : 6;
    const pts = decimatePoints(gesture.trail, spacing);
    return {
      ...base,
      type: tool === "curve" ? "curve" : "freehand",
      rel: pts.map((p) => ({ x: p.x - start.x, y: p.y - start.y })),
    };
  }

  function onUp() {
    if (!active) return;
    if (moveDrag && moveDrag.marqueeStart) {
      if (marquee && (marquee.width > 3 || marquee.height > 3)) {
        const box = { x: marquee.x, y: marquee.y, w: marquee.width, h: marquee.height };
        const hits = shapes.filter((s) => rectsIntersect(shapeBounds(s), box)).map((s) => s.id);
        selectedIds = moveDrag.shift ? [...new Set([...selectedIds, ...hits])] : hits;
      } else if (!moveDrag.shift) {
        selectedIds = [];
      }
      marquee = null;
      moveDrag = null;
      render();
      return;
    }
    if (moveDrag) {
      if (moveDrag.moved) {
        history.record(moveDrag.before);
      }
      moveDrag = null;
      render();
      return;
    }
    if (!drag) return;
    const draft = draftShape(drag);
    drag = null;
    if (!draft || isDegenerateShape(draft)) {
      render();
      return;
    }
    history.record(snapshot());
    shapes = [...shapes, { ...draft, id: nextMarkId() }];
    render();
  }

  function onKey(evt) {
    if (!active) return;
    const t = evt.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const mod = evt.metaKey || evt.ctrlKey;
    if (mod && evt.key.toLowerCase() === "z") {
      evt.preventDefault();
      const snap = evt.shiftKey ? history.redo(snapshot()) : history.undo(snapshot());
      if (snap) restore(snap);
    } else if (evt.key === "Delete" || evt.key === "Backspace") {
      if (selectedIds.length === 0) return;
      evt.preventDefault();
      commit(() => {
        shapes = shapes.filter((s) => !selectedIds.includes(s.id));
        selectedIds = [];
      });
    } else if (evt.key === "Escape") {
      selectedIds = [];
      render();
    }
  }

  // --- UI ---------------------------------------------------------------------

  function ensureUi() {
    if (ui.host) return;
    const host = document.createElement("div");
    host.className = "lavish-draw-root";
    host.setAttribute("data-lavish-ui", "draw-root");
    document.documentElement.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{all:initial;position:fixed;z-index:2147483647;left:0;bottom:0;font-family:Geist,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}" +
      "*{box-sizing:border-box}" +
      ".pill{position:fixed;left:14px;bottom:14px;display:flex;align-items:center;gap:8px;border:1px solid #3c4557;background:#11141a;color:#f7f3ea;font-size:13px;font-weight:600;padding:9px 14px;border-radius:999px;cursor:pointer;box-shadow:0 20px 70px rgba(0,0,0,.35)}" +
      ".pill.on{border-color:#f4c95d;color:#f4c95d}" +
      ".palette{position:fixed;left:14px;bottom:60px;display:none;flex-direction:column;gap:6px;border:1px solid #303745;background:#11141a;border-radius:14px;padding:8px;box-shadow:0 20px 70px rgba(0,0,0,.35)}" +
      ".palette.open{display:flex}" +
      ".row{display:flex;gap:4px}" +
      "button.tool{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;background:transparent;color:#b9c0cf;border-radius:8px;cursor:pointer;font-size:15px;padding:0}" +
      "button.tool:hover{background:#1c212b}" +
      "button.tool.active{border-color:#f4c95d;color:#f4c95d}" +
      "button.tool:disabled{opacity:.4;cursor:default}" +
      ".swatch{width:18px;height:18px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}" +
      ".swatch.active{border-color:#f4c95d}" +
      ".sep{height:1px;background:#303745;margin:2px 0}";
    shadowRoot.appendChild(style);

    const pill = document.createElement("button");
    pill.className = "pill";
    pill.innerHTML = "&#9998; Draw";
    pill.addEventListener("click", () => setActive(!active));
    shadowRoot.appendChild(pill);

    const palette = document.createElement("div");
    palette.className = "palette";
    const toolRow = document.createElement("div");
    toolRow.className = "row";
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
    swatchRow.className = "row";
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
    actionRow.className = "row";
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
        "Group selection",
        "&#9707;",
        () => {
          if (selectedIds.length < 2) return;
          groupSeq += 1;
          const gid = "g" + groupSeq;
          commit(() => {
            shapes = shapes.map((s) => (selectedIds.includes(s.id) ? { ...s, group: gid } : s));
          });
        },
      ],
      [
        "clear",
        "Clear all marks",
        "&#128465;",
        () => {
          if (shapes.length === 0) return;
          commit(() => {
            shapes = [];
            selectedIds = [];
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
    shadowRoot.appendChild(palette);

    ui = { host, shadowRoot, pill, palette };
  }

  function syncToolbar() {
    if (!ui.palette) return;
    for (const b of ui.palette.querySelectorAll("button.tool[data-tool]")) {
      b.classList.toggle("active", b.dataset.tool === tool);
    }
    for (const b of ui.palette.querySelectorAll(".swatch")) {
      b.classList.toggle("active", b.dataset.stroke === stroke);
    }
    const undoBtn = ui.palette.querySelector('button[data-action="undo"]');
    const redoBtn = ui.palette.querySelector('button[data-action="redo"]');
    const groupBtn = ui.palette.querySelector('button[data-action="group"]');
    if (undoBtn) undoBtn.disabled = !history.canUndo();
    if (redoBtn) redoBtn.disabled = !history.canRedo();
    if (groupBtn) groupBtn.disabled = selectedIds.length < 2;
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
    // Pointer events are handled at the document level in page coordinates,
    // so the Konva stage stays a pure renderer and never fights the page.
    container.addEventListener("pointerdown", (e) => {
      onDown(e);
      e.preventDefault();
    });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    ui.stageContainer = container;
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
    } else if (ui.stageContainer) {
      ui.stageContainer.style.pointerEvents = "none";
    }
  }

  // --- boot + public API --------------------------------------------------------

  function boot() {
    ensureUi();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  win.lavishDraw = {
    getMarks: () => shapesToMarks(shapes),
    setMarks: (marks) => {
      shapes = marksToShapes(marks);
      markSeq = shapes.length;
      selectedIds = [];
      if (layer) render();
    },
    getSelectedIds: () => selectedIds.slice(),
    setActive,
    isActive: () => active,
  };
}
