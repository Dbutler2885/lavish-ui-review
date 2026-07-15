# PRD: lavish-frontend-workflow

A callable frontend-design workflow that constructs intent, builds an HTML mockup, and iterates on it through rich visual markup until the user approves it for real-code implementation.

This is a fork of `lavish-axi-PDF` (a print-design workspace) reoriented for web frontend design.
It extends the concepts of three open-source tools the user does not own but builds around: Lavish (visual review), treehouse (git worktrees), and First Mate (multi-agent captain).
See `VISION.md` for the narrative statement of intent this PRD formalizes.

## Problem Statement

When I want to change or design a web frontend, describing the change in words is the wrong medium.
The product is visual, so my feedback should be visual too.
Today, the best method I have is to ask an agent to render a mockup in Lavish and mark it up, but Lavish only lets me attach a text note to a DOM element.
That misses the thing I actually need: to show the model *exactly* what is wrong by pointing at it in the rendered pixels and drawing the change I want, then have that land as a precise, tracked edit.

Two deeper gaps sit underneath that.
First, before anything gets built, I have to construct my intent, and I do not want to do that with cognitive-heavy back-and-forth or by approving abstract style choices I have no opinion on yet.
I want the model to make strong provisional choices and show me something concrete to react to.
Second, when I do give feedback, handing a pile of rich annotations to a model in one lump invites it to drop or half-apply some of them.
I want each unit of feedback protected and tracked.

The result I want is low brain effort: the system makes strong provisional choices, exposes them visually, lets me correct only what feels wrong, and keeps every revision anchored to the original intent.

## Solution

A workflow, drivable by a human directly and callable as a specialty by First Mate, that runs frontend design as a loop between two surfaces sharing one markup vocabulary.

Intent is constructed first, through an optional grill-me interview (text-first) and an optional visual intent UI (visual-first), both depositing into one shared intent space.
The job is one of three modes: redesign an existing frontend, extend an existing frontend in its own design language, or build something new.
For the two existing-code modes, the target repo is pulled in treehouse-style and its frontend code is read.

From the assembled intent, the agent builds an HTML mockup: one mockup per screen, with in-place states (modals, expansions, error states) built into that screen as real clickable HTML, while navigation to a wholly different screen becomes a separate mockup.
Before the user ever sees it, the agent runs a mandatory, bounded visual self-review: it renders the mockup, looks at the render against a specific critique checklist, and fixes what it catches.

The user then iterates on a Lavish-derived surface that is simultaneously a pixel canvas and a live DOM.
The user assembles a unit of guidance from any combination of vector drawings, DOM bounding-box references, and text notes bound to those marks, and cues it.
Cued units accumulate in a queue and are sent as a batch.
The model plans an execution queue from the batch, where each execution item cites the units it addresses, then applies them serially, re-rendering and self-reviewing between items.
Version control of the mockup file is loose, carried by chat history, à la Lavish; the real tracking is the queue plus the annotation coverage map.

When, and only when, the user approves the mockup, the finished mockup plus its intent packet are handed to First Mate, which dispatches the real-code build downstream.

## User Stories

1. As a user, I want to state what I want to work on and be offered a choice to begin with a grill-me session or the intent UI, so that I control how my intent is constructed.
2. As a user, I want to pick one of three job modes (redesign existing, extend existing, build new), so that the workflow gathers the right intent and builds the right starting point.
3. As a user redesigning an existing frontend, I want the system to pull my target repo and reproduce the current UI as a mockup, so that I can change what already exists rather than describe it from scratch.
4. As a user extending an existing frontend, I want the system to build something new in the existing design language, so that the new work matches what is already there.
5. As a user building something new, I want to supply rich intent (brief, inspiration, wireframe) because there is no existing code to derive from, so that the agent has enough to build a strong first mockup.
6. As a user, I want a grill-me interview that asks one sharp question at a time, so that my intent is clarified without me having to write a full spec up front.
7. As a user, I want the grill-me interview to be bounded and to bail to "I have enough to start" early, so that intent construction does not become punishingly slow.
8. As a user, I want the grill-me artifact to be deposited into the same intent space the intent UI writes to, so that the builder reads all my intent from one place.
9. As a user, I want a visual intent UI where I can upload inspiration images and drop my own drawings, so that I can express intent that words cannot carry.
10. As a user, I want to draw vector marks (selection box, arrow, curve, arc, circle, freehand) over an inspiration image, so that I can point at exactly the pixels that matter.
11. As a user, I want each vector mark to have its own identity and to group several marks into one object, so that I can annotate a collection of marks as a single thing.
12. As a user, I want to attach a text note to one mark, several marks, or a group, so that my note refers precisely to what I drew.
13. As a user, I want to tag an inspiration region by meaning (typography, layout, texture, mood, color, density, anti-example), so that the model knows why I flagged it.
14. As a user, I want both the clean image and the annotated image preserved for every annotated image, so that the model can look closely at the marks and also at the untouched original.
15. As a user, I want the workflow to build the mockup as one mockup per screen, so that a project is a set of focused screens rather than one sprawling page.
16. As a user, I want in-place interaction (modals, popovers, expand/collapse, tabs, error states) built into the mockup, so that I can click through and review those states.
17. As a user, I want navigation to a wholly different screen to become a separate mockup, so that the workflow does not try to build my entire website into one file.
18. As a user, I want the agent to run a mandatory visual self-review before showing me anything, so that big mistakes (overlaps, things too small or too large, misalignment) are caught before I have to react to them.
19. As a user, I want that self-review bounded so the agent does not loop forever, so that I get to the iteration loop quickly.
20. As a user, I want the iteration surface to be both a pixel canvas and a live DOM, so that my feedback is about how the page renders, not just about which HTML element is wrong.
21. As a user, I want to drop a selection-box mark over the rendered mockup that binds to the real DOM element underneath, so that my edit is precise and targetable.
22. As a user, I want to also draw free pixel-space marks over the mockup that are read visually, so that I can point at a region that does not map to one clean element.
23. As a user, I want to bind a text note to both a DOM bounding box and pixel-space marks in a single unit, so that the anchor is precise and the intent is visual.
24. As a user, I want to assemble a unit of guidance from any combination of drawings, bounding-box references, and text, and then cue it, so that I decide what belongs together as one edit.
25. As a user, I want a unit of guidance to record which state it was captured in, so that an edit about the open modal lands on the open-modal state.
26. As a user, I want cued units to accumulate and be sent as one batch, so that the model can plan across all of them and reconcile ones that conflict.
27. As a user, I want the model to author an execution queue from my batch, where each item cites the units it addresses, so that nothing I asked for is silently dropped.
28. As a user, I want the execution queue applied serially with a re-render and self-review between items, so that each rich unit gets full attention and I can see the mockup evolve.
29. As a user, I want the model to see the full pending queue while it processes each item, so that it stays aware of everything even as it commits one edit at a time.
30. As a user, I want to review the re-rendered mockup after a batch and then cue the next round, so that iteration proceeds in clear cycles.
31. As a user, I want loose version control via chat history rather than git commits or snapshots for the throwaway mockup, so that the loop stays lightweight.
32. As a user, I want to see which annotations each edit addressed, so that I trust the record of what was changed and why.
33. As a user, I want the mockup to be handed to First Mate only after I explicitly approve it, so that nothing unfinished is sent downstream to be built.
34. As a user, I want the approved mockup and its intent packet handed off together, so that the downstream build has both the target and the reasoning.
35. As a user, I want this workflow to run standalone or be callable by First Mate, so that I can use it directly or as part of a larger crewed job.
36. As a user, I want the real-code round-trip left to First Mate, so that this workflow stays focused on producing a converged, approved mockup.
37. As a user, I want the whole thing to make strong provisional choices and let me correct only what feels wrong, so that my brain effort stays low.

## Implementation Decisions

### Architecture and framing
- The deliverable of this workflow is an HTML mockup artifact (a set of per-screen mockups) plus its intent packet, not production code.
- The mockup is a mockup of the real thing, derived either from existing code (redesign, extend) or from intent alone (build new).
- Syncing the approved mockup back into real production source is out of scope; it is First Mate's job downstream.
- This workflow is designed to run two ways: a human sitting in it directly, and a black-box call from First Mate (intent or existing-code reference in, converged approved mockup plus intent packet out).
- Handoff to First Mate is gated on explicit human approval.

### Modules to build or modify

Deep modules (pure or deterministic, simple stable interface, tested in isolation):

- Unit-of-guidance model.
  The canonical annotation object and its serialization.
  A unit holds: references (each a DOM selector or an image pixel-region), vector marks (each with identity and optional group membership and optional semantic tag), text notes bound to marks or references, a captured state id, and a coverage list.
  Responsibilities: construct, validate, serialize/deserialize, enumerate references, report coverage.
- Image-packet generator.
  Given a rendered surface and a unit, deterministically produces the image set: the clean image and the annotated-drawings image, with only drawing marks rendered over the page.
  HTML selections are metadata links in the manifest, not visual overlays in the submitted packet image.
  This is the core "offload the mechanical work to non-LLM automation" module.
- Edit-queue engine.
  The two-layer queue.
  Layer one ingests user-cued units.
  Layer two holds the model-authored execution items, each citing the units it addresses.
  The engine exposes the serial executor state machine: advance to the next item, mark an item complete, track coverage so every unit is accounted for.
  The engine is deterministic and independent of the model; the model's planning and patching are inputs to it, not part of it.
- Intent-space store.
  The shared folder abstraction.
  Tools (grill-me, intent UI) deposit artifacts; the store records job mode and target-repo pointer; a reader assembles the compact builder packet the mockup builder consumes.
- Mockup renderer.
  Renders one screen and state of an HTML mockup to a raster under Lavish-equivalent sandbox conditions.
  Adapted from the existing `sandbox-check` implementation.
- Target checkout.
  For redesign and extend modes, pulls the target repo treehouse-style, locates the frontend code, and produces a code-context bundle for the builder.
  Reuses First Mate and treehouse patterns.

UI surfaces (shallow to unit-test; verified through the data they emit and by eye):

- Intent UI.
  The visual intake, extending the existing `intake-ui`, with a Konva-based drawing and annotation layer (candidate reuse: the user's `homeboyshouse` drawing/stamp code).
  Emits units and images into the intent space via the unit-of-guidance model and intent-space store.
- Lavish-derived review surface.
  A fork of `lavish-axi`, adding the pixel drawing layer, DOM bounding-box binding, in-place state navigation, and unit cueing on top of Lavish's existing element-annotation client.
- Grill-me integration.
  The existing grill-me skill, run as an optional opening pass, emitting its artifact into the intent space.
- Self-review gate.
  A prompt and discipline enforced by the stage machine: render, look at the render against a specific critique checklist (overlaps, sizing, alignment, and similar), fix, re-render, and only then present.
  Generalizes the existing print `pdf-check` "render, look at the PNGs, self-review before showing the client" pattern to the frontend mockup.

### Stage machine
- The reoriented stages are: intent construction, build (with the loop-1 self-review gate), iterate (the loop-2 queue), approved, handoff.
- There is no design-language / style-board stage.
  The style board is dropped because the user does not have a fully formed final product in mind and should not be asked for abstract style opinion; reacting to a concrete first mockup is cheaper and gets to iteration faster.
- The intent UI is always the front door; everything flows through the shared intent space so context is not muddled.

### Markup and annotation semantics
- One shared drawing/annotation vocabulary is used by both UIs.
- A selection box is not special; it is a vector mark that means "look at this area."
- The only substrate difference between the two UIs: in the intent UI a reference is a pixel region of a static image; on the Lavish-derived surface a reference can also bind to a live DOM element.
- Drawing meaning: a mark may carry an optional semantic tag (for example move, resize, shape, look-here, anti-example), but the text note is authoritative; the drawing shows, the tag hints, the words decide.
- Two convergence loops exist: loop one is the agent building and self-reviewing toward the intent packet before the user sees it (bounded, one strong build plus a mandatory visual self-review pass; a dedicated multi-agent corrector is deferred); loop two is the user-driven annotation queue.

### Multi-agent scope
- V1 leaves out the intentional multi-agent recursive self-improvement (the dedicated corrector sub-agent).
- V1 keeps the essential kernel: the model must render and look at its own output against a specific critique prompt before it can advance.

## Testing Decisions

A good test here exercises external behavior through a module's public interface and asserts on outputs, not on internal structure or implementation details.
Because the deep modules are pure or deterministic, they are testable with fixture inputs and asserted outputs, with no model calls in the loop.

Modules to test:

- Unit-of-guidance model.
  Construct units of each composition (drawing alone; text plus drawings; text plus drawings plus bounding boxes; text plus bounding boxes), serialize and deserialize round-trip, validate rejection of malformed units, and assert reference enumeration and coverage reporting.
- Image-packet generator.
  Given fixture surfaces and units, assert the packet manifest is correct and complete (drawing groups, HTML refs, state, text, image linkage) and that the clean plus annotated-drawings artifacts are produced deterministically for the same input.
- Edit-queue engine.
  Given a batch of cued units and a model-authored execution plan, assert serial advancement, per-item unit citations, and that coverage tracking flags any unit not addressed by any item.
- Intent-space store.
  Given a sequence of deposits (grill-me artifact, intent UI units, job mode, target-repo pointer), assert the assembled builder packet contains the union and is well formed.

Modules not unit-tested (verified by eye and through the data they emit): the intent UI, the Lavish-derived review surface, the mockup renderer, target checkout, and grill-me.
Their correctness surfaces through the deep modules that consume or validate their output.

Prior art in the inherited codebase: the print workspace's `lib` modules (for example `sandbox-check.mjs`, `proof-wrap.mjs`, `intake-server.mjs`) are plain Node with deterministic file outputs and are the shape these deep modules should follow.

## Out of Scope

- Syncing the approved mockup back into real production source; that is First Mate's downstream job.
- The dedicated multi-agent corrector sub-agent for loop-one self-improvement; V1 uses only the single mandatory self-review pass.
- Git commits or snapshot-based version control of the mockup file; V1 uses loose, chat-history-based version control.
- A design-language / style-board approval stage; it is deliberately removed.
- Building an entire multi-screen website into one mockup; screens that share no content are separate mockups.
- Print-specific inheritance from the fork: physical page geometry, bleed and safe zones, and PDF export with MediaBox verification are dropped.

## Further Notes

- The system's deepest purpose is reducing the user's brain effort: make strong provisional choices, expose them visually, correct only what feels wrong, and keep every revision anchored to the original intent.
- The intent packet's job is to make the first auto-generated mockup as close to intent as possible, because the human loop is slow; anything earns a place in the packet only if it improves that first mockup.
- Non-LLM automation should own everything mechanical (file copying, screenshots, crops, boxed images, manifests, normalized coordinates, annotation indexing, rendering HTML to images, side-by-side composites, live reload, the queue); the model is reserved for interpretation, design judgment, critique, patch planning, and code generation.
- Folder-as-truth: the shared intent space is a folder that multiple tools deposit into and the builder reads as a union, which keeps the design extensible as new intent tools are added.
- The workflow inherits its operating style from the print workspace's `AGENTS.md` manual and First Mate's structured, on-disk, restart-proof discipline; the `AGENTS.md` and `README.md` will be rewritten to match this PRD as a follow-up.
