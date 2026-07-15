# lavish-axi-web - vision

This document is the durable statement of intent for this workspace.
It is a fork of `lavish-axi-PDF`, a print-design workspace, reoriented toward web frontend design.
It exists to be corrected: read it, mark what is wrong, and it becomes the anchor every other document and script is built against.

## 1. The one-sentence purpose

Reduce the user's brain effort: the system makes strong provisional design choices, exposes them visually, lets the user correct only what feels wrong, and keeps every revision anchored to the original intent.

Everything below is in service of that sentence.

## 2. What this is

A Lavish-extension workspace for building web frontend artifacts (components, pages, prototypes, whole interfaces) through a tight loop of:

- structured intent construction (before any code is generated),
- loose wireframing with semantic annotation,
- visual markup drawn directly over rendered output,
- side-by-side comparison review,
- deterministic (non-LLM) automation for everything mechanical,
- controlled, serial agent patching of a single live artifact.

The agent owns interpretation, design judgment, critique, patch planning, and code generation.
Everything mechanical is offloaded to scripts (see pillar 6).

## 3. Where this came from

The print workspace (`lavish-axi-PDF`) was built around fixed-size PDFs and "Greetings from" postcard-style genre simulation, where inspiration and side-by-side visual matching matter a lot.
That surfaced a deeper realization: the more useful product is for web design, because the real need is better intent construction, better interaction design, and faster visual iteration - not print geometry.
This fork keeps the parts that generalize (intake, design language, render-to-image review, the Lavish loop, the folder-as-durable-state discipline) and drops the print-only parts (physical page geometry, bleed/safe-zone, PDF export with MediaBox verification).

## 4. The core loop

One artifact moves through a loop where design and review are never translated into different representations:

1. **Intent surface.** Text-first or visual-first construction of what the artifact must be and do, captured as durable files (design direction, interface contract, genre contract, PRD).
2. **Design/build surface.** The HTML/CSS/JS artifact the agent writes.
3. **Review surface.** The same artifact rendered as an image with a drawing layer over it. The human draws intent; the agent turns rough gestures into precise edits.
4. **Comparison surface.** The reference, sketch, marked-up intent, or previous version shown beside the current output so the model can judge whether the output visually matches the request and recursively improve it.

The guiding equation stays the same as the print workspace: **suggestion in, precision out.**
The human never sets final geometry or code; they express intent, and the agent produces the exact result.

## 5. The pillars (the innovations)

### 5.1 Visual markup bound to meaning

The review surface treats the artifact as a rendered image even when it comes from HTML/CSS.
A Konva-based drawing layer sits over it (candidate for reuse: the `homeboyshouse` repo's drawing/stamp code).
Gestures supported: selection boxes, arrows, arcs, circles, curves, freehand marks, rough placement.

Every markup binds three connected pieces of data:

1. the HTML element or rendered region being referenced,
2. the drawing gesture over it,
3. an optional written annotation/tag explaining intent (written only when the drawing alone is ambiguous).

So the user selects a DOM region, draws where something should move or how it should curve, and adds a note only when needed.

### 5.2 The same annotation system over any image

The markup system works over inspiration images, screenshots, rough sketches, and generated output alike.
For inspiration, the user boxes a region and tags it: typography, layout, texture, mood, color, density, or anti-example.
The system preserves three artifacts per annotation: the full screenshot with the visible box drawn on it, the cropped region on its own, and a JSON object linking the selection to its meaning.

### 5.3 Side-by-side comparison review

Show the reference, sketch, marked-up intent, or previous version beside the current output.
The model's job in this mode is narrow: judge whether the output visually matches the request, then improve it.
This is the recursive-improvement engine.

### 5.4 Loose wireframing as semantic contract

A mode where the user sketches a rough interface or layout, then annotates the drawing with meaning:
what each region is, what should be primary, what should be instant, what the user should notice first, what should be avoided.
This becomes a semantic wireframe the agent turns into an interface contract.

### 5.5 Capture intent once, reuse it (the stamp principle)

From the role-playing map UI and stamp creator: the user draws once, selects the drawing, turns it into a reusable stamp, and moves fast.
The broader principle: capture a bit of user intent once and turn it into a reusable object.
In this system, annotations, wireframes, inspiration regions, and intent docs all play that role - authored once, referenced many times.

### 5.6 Deterministic automation offloads all mechanical work

Non-LLM automation handles: file copying, screenshots, crops, boxed images, manifests, normalized coordinates, annotation indexing, rendering HTML to images, side-by-side composites, visual diffs, live reload, versioning, and task queues.
The model is reserved for interpretation, design judgment, critique, patch planning, and code generation.
If a step is mechanical and deterministic, a script does it, not the model.

### 5.7 The edit queue (controlled serial patching)

Multi-agent workflows create coordination problems: agents overwrite each other, work from stale reads, or diverge.
Full git worktrees for every tiny change are too heavy.
The answer is an edit queue: each visual feedback item becomes an atomic, queued edit request.
Models may produce proposed diffs, but a controlled process applies them serially to the single live artifact.

The workflow:
user draws markup -> system creates a structured edit request -> request enters the queue -> model proposes a patch/diff -> system applies it -> artifact re-renders -> review surface updates -> the next edit runs.

### 5.8 Compact task packets over messy history

The project folder holds durable state:
locked user request, creative direction, genre/interface contract, annotations, renders, comparisons, reports, patches, and current output.
The main agent reads compact task packets built from that durable state, not the whole conversation history, so it never gets buried in mixed context.

## 6. Two phases the print workspace lacked

### 6.1 Stronger intake = intent construction

Before generation, the system helps construct intent, two ways:

- **Text-first:** the user gives a rich description; the agent produces a design direction, checksheet, PRD, or interface contract.
- **Visual-first:** the user uploads inspiration, sketches a layout, boxes reference regions, or annotates screenshots.

There is an existing workflow the user likes - an agent grills one question at a time, clarifies the idea, builds a PRD/design doc, then slices it into implementation chunks.
It produces good results but is slow.
The goal is to preserve that clarity while reducing back-and-forth and cognitive effort (fewer, sharper questions; more strong provisional defaults the user only corrects when wrong).

### 6.2 A dedicated interaction-design phase

A PRD describes what the product should do.
The hard UI work is different: where buttons go, what states exist, what happens after clicks, what is visible by default, what updates instantly, and how the user moves through the interface.
This deserves its own artifacts before code generation: an interface contract, a wireflow, or a screen-state spec.

## 7. How the existing scaffolding remaps

The fork inherits the print pipeline. Here is the intended reorientation (not yet built):

| Print (inherited) | Web (target) |
|---|---|
| `bin/pdf-new.sh` + `lib/formats.json` (print sizes, bleed, safe zone) | project creation with web presets (viewport/breakpoint targets, component vs page vs app) |
| `bin/pdf-intake.sh` (files, notes, print format, blocking sketch) | intent construction: text-first and visual-first intake, inspiration tagging, wireframe sketch |
| `bin/pdf-proof.sh` + `lib/proof-wrap.mjs` (inch rulers, trim/bleed/safe-zone overlays, calibration) | review surface: render + Konva markup layer; overlays become annotation, not print guides |
| `bin/pdf-check.sh` + `lib/sandbox-check.mjs` (render HTML to PNG under Lavish sandbox) | keep: render-to-image is core to the comparison + review surfaces |
| `bin/pdf-export.sh` + `lib/export-pdf.mjs` (PDF at physical size, MediaBox verify) | drop or replace: web has no physical export; may become screenshot/deploy/publish |
| `bin/pdf-asset.sh` (crop/resize to print DPI) | keep/adapt: image prep, crops, boxed-region generation for annotations |
| `bin/pdf-fonts.sh` + `assets/fonts/` (~95 embeddable families) | keep: still useful; web fonts and specimen previews |
| stage machine (new -> intake -> design-language -> drafting -> proofing -> exported) | reoriented stages: intent -> design language -> wireframe/interaction -> draft -> visual review loop -> ship |
| `AGENTS.md` operating manual | rewritten as the web operating manual |

New pieces with no print ancestor: the Konva markup layer, the annotation JSON model, the side-by-side comparison composer, the edit queue, and the task-packet builder.

## 8. Open decisions (for the user)

These shape the build and are not yet decided:

1. **Scope of the first buildable slice.** Candidates: (a) the visual markup layer over rendered HTML, (b) the intent-construction intake, (c) the edit queue. Which delivers value soonest?
2. **Lavish relationship.** Does the Konva markup layer live inside a Lavish fork, or as a separate surface this workspace renders and Lavish just displays? (The print repo's next phase was already "graphical proof annotations on a Lavish fork.")
3. **`homeboyshouse` reuse.** How much of its drawing/stamp code is liftable, and under what shape?
4. **Where automation runs.** Node scripts in `bin`/`lib` like the print workspace, or a longer-lived local service (the edit queue and live reload imply something more persistent than one-shot scripts)?
5. **Artifact target shape.** Single self-contained HTML files (like Lavish artifacts today), or real multi-file frontend projects (a component in a real build)? This changes rendering, patching, and versioning.

## 9. What is NOT changing

- The folder is the durable source of truth; a pointer file is a convenience, and folders win on conflict.
- The client (user) is never the first reviewer: the agent self-reviews the rendered surface before presenting it.
- Suggestion in, precision out: the human expresses intent, the agent owns the exact result.
- Render against real output (the sandboxed render), never a naive same-origin load that hides breakage.
