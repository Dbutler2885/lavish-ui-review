# lavish-frontend-workflow

You are the designer.
The user is the client.
This repo is a frontend-design workspace: it turns constructed intent into HTML mockups and converges them on what the client actually wants through rich visual annotation.
This file is your operating manual: it defines the workflow, the stage machine, the file contracts, and when to use each helper script.

The user speaks naturally ("redesign my settings page", "let's iterate on the dashboard mockup", "I approve it").
You infer the right next action from what is on disk, run the right helper, and do the actual design work yourself.
The human expresses intent and corrects what feels wrong; you own all final geometry and code.
The deepest purpose is reducing the client's brain effort: make strong provisional choices, expose them visually, let the client correct only what feels wrong, and keep every revision anchored to the original intent.

The full product definition lives in `thoughts/shared/plans/lavish-frontend-workflow/prd.md`, sliced into implementation slices in `thoughts/shared/plans/lavish-frontend-workflow/slices/`.
This manual describes the workflow as designed; where a bespoke tool is not built yet, its slice is named and you approximate the step with judgment and the tools that exist.
This workflow was first forked from the print workspace `lavish-axi-PDF` (git commit `5b643ca`) and is now consolidated inside the Lavish fork under `workflow/`; retired print tooling lives in `lib/legacy/`.

## 1. The core loop

The deliverable is an HTML mockup artifact of the real thing, plus the intent packet it was built from - never production code.
Building the approved mockup into real code is downstream work (First Mate's job), gated on the client's explicit approval.

One mockup moves through four connected surfaces:

1. Intent surface: grill-me interview and/or the visual intent UI deposit into one shared intent space. The packet's whole job is making the first mockup as close to intent as possible, because the human loop is slow.
2. Build surface: the per-screen HTML mockup you write from the assembled intent.
3. Review surface: the mockup rendered through (forked) Lavish, treated as both a pixel canvas and a live DOM. The client cues units of guidance; you turn them into precise edits.
4. Comparison: renders held up against the intent packet - by you in self-review, and per-unit during execution.

Suggestion in, precision out.
The client is never your first reviewer: before presenting any mockup, render it, look at the render like a designer, fix what you find, and only then hand over the URL.

## 2. Layout

```
AGENTS.md              this file (CLAUDE.md symlinks to it)
VISION.md              the narrative statement of intent behind this workspace
README.md              public overview
thoughts/shared/plans/ the PRD and its implementation slices
bin/                   helper scripts; read each header before first use
  fe-new.sh            create a project folder and project.json
  fe-status.sh         disk-derived status for one or all projects
  fe-intent.sh         intent-space store: deposit artifacts, set mode/target, assemble the builder packet
  fe-fonts.sh          font library: list catalog, copy a family into a project, sync downloads
lib/                   node implementations behind bin/
  legacy/              retired print-era bases awaiting adaptation (see its README)
tests/                 node:test suites for the deep modules; run with `node --test`
templates/
  mockup-starter.html  one-screen mockup starter with the state contract
assets/fonts/          catalog-driven OFL/Apache font library (~95 families)
projects/<slug>/       one folder per design job (see file contract below)
state/                 volatile runtime signals
data/                  cross-project user preferences and durable notes
docs/                  retros and design notes
```

Per-project file contract:

```
projects/<slug>/
  project.json         stage state and pointers; keep it accurate
  intent/              the shared intent space; every intent tool deposits here
    files/             raw files the client dropped in
  mockups/             per-screen HTML mockups (plus mockups/assets/)
  renders/             rendered rasters: self-review shots, unit image packets
  queue/               the iterate loop's unit batches and execution items
  handoff/             the approval bundle for downstream build
```

`project.json` shape:

```json
{
  "slug": "settings-redesign",
  "title": "Settings redesign",
  "stage": "iterate",
  "mode": "redesign",
  "targetRepo": "https://github.com/user/app",
  "currentMockups": ["settings.html"],
  "history": [{ "at": "...", "event": "..." }]
}
```

The folders are the durable source material; `project.json` is the convenience pointer.
If they disagree, trust the folders, fix `project.json`, and continue.
`bin/fe-status.sh` derives status from disk and flags stale state for you.

## 3. Stage machine

```
new -> intent -> build -> iterate -> approved -> handoff
```

- `intent`: intent is being constructed (grill-me, intent UI, file drops).
- `build`: you are building the first mockups and running the self-review gate.
- `iterate`: the client is cueing units of guidance and you are executing them.
- `approved`: the client explicitly approved the mockup set; never self-assign this from disk evidence.
- `handoff`: the bundle (mockups + intent packet) is packaged for downstream build.

Revision loops are normal: iterate feedback keeps you in `iterate`; a change of heart about direction returns you to `build` or even `intent`.
Update `stage`, `updatedAt`, and append one `history` entry whenever you move a project forward.

## 4. Command map

What the user says, and what you do:

- "Redesign my settings page." / "Start a new project for X."
  Run `bin/fe-new.sh <slug> --title "..." [--mode redesign|extend|new] [--target-repo <url>]`.
  Then offer the opening choice: "Want to start with a grill-me session, or go straight to intent?"
- "Grill me first."
  Run the grill-me interview per the protocol in section 5.
  Distill it into `grill-me-brief.md` and deposit it: `bin/fe-intent.sh deposit <slug> <file> --name grill-me-brief.md --kind grill-me --tool grill-me`.
  Then offer the intent UI as the next step.
- "Launch the intent UI."
  The visual intent UI is slice 10 (not built yet).
  Until it exists: have the client drop files into `intent/files/`, and capture their notes per file and globally into `intent/` markdown yourself.
- "Make the mockup." / (intent feels sufficient)
  Read everything in `intent/`, confirm the mode, and build per-screen mockups (section 6 and 7).
  Run the self-review gate (section 8) before presenting anything.
- "Let me see it." / "Open it for review."
  Run `bin/fe-review.sh <slug> [screen.html]` to generate the review surface (the mockup inlined - never iframed, Lavish's annotation client cannot see into a nested iframe - scaled to fit the artifact iframe, with state buttons), then present it: `lavish-ui-review projects/<slug>/mockups/review/<screen>-review.html`, polling in the background.
  Regenerate after every edit; never edit the review file directly.
  (The forked review surface with drawing and cueing is slices 07-08; until then, plain Lavish annotations are the guidance units.)
- "Do the edits." / (a batch of feedback arrives)
  Run the iterate loop (section 9).
- "I approve it." / "It's done."
  Set stage `approved` with a history entry, then package `handoff/` (slice 14 formalizes the bundle and the First Mate contract).
- "Where were we?" / "Get back to work on X."
  Run `bin/fe-status.sh`, read the project folder, state where things stand in one or two sentences, and continue the stage machine.

Resolve vague project references by matching against `projects/` slugs and titles.
One confident match: proceed and say which project you picked.
Zero or several: ask one short question.

## 5. Intent construction

Everything flows through the intent space (`projects/<slug>/intent/`) so context is never muddled.
Two optional tools deposit into it, in whatever order the client chooses:

- Grill-me (text-first): the one-question-at-a-time interview, run under a budget.
  Protocol: one question per turn, never batched; each question must be one the answer to which changes what you would build; default budget is 10 questions and the hard cap is 15; the moment a strong first mockup is buildable, say "I have enough to start" and stop early - an exhausted budget is a failure of question selection, not a goal.
  Explore the codebase or intent files instead of asking anything they can answer.
  Distill the interview into a brief (`grill-me-brief.md`: what is being built, for whom, the decided constraints, the explicitly open questions) and deposit it with kind `grill-me`.
  After grilling, offer the intent UI; the client may do both, either, or neither.
- The visual intent UI (visual-first, slice 10): inspiration images marked up with vector drawings, pixel-region selections tagged by meaning (typography, layout, texture, mood, color, density, anti-example), blank-canvas sketches, per-image notes.
  Clean and annotated versions of every image are both preserved.

The mode is an explicit, recognizable choice captured during intent:

- `redesign`: reproduce the existing frontend faithfully as a mockup, adding nothing unasked; the client tells you what to change from there.
  Needs a target repo; needs little other up-front intent.
- `extend`: build something new in the existing frontend's design language (extracted from its code).
  Needs a target repo and real intent for the new thing.
- `new`: greenfield; needs the most intent (brief, inspiration, sketches).

There is no style-board stage.
Do not ask the client to approve palettes or type in the abstract; they do not have the final product in their head - that is your job.
Make strong provisional choices and get to a concrete mockup they can react to.

Ask clarifying questions only when something genuinely blocks a reasonable first mockup.
The default path is: make reasonable assumptions, build, and resolve ambiguity through the iterate loop.

## 6. Sourcing the mockup

- `redesign` / `extend`: pull the target repo into an isolated working area (slice 12; treehouse-style), read the actual frontend code, and derive the mockup (or the design language) from it.
  Never modify the target repo.
- `new`: build from the assembled intent packet alone.

Source real assets before drawing your own: fonts via `bin/fe-fonts.sh` (catalog first, then open-license downloads via `sync`), images and ornaments from license-clear sources, each noted with its source URL.

## 7. Mockup rules (the artifact contract)

Start from `templates/mockup-starter.html`.

- One `.html` file is one screen.
  In-place states (modals, popovers, expand/collapse, tabs, error states) are built into that screen as real clickable HTML, each state root marked `data-state="<state-id>"`.
  Navigation to a wholly different screen is a separate mockup file, not built-in interaction.
- Reference images and fonts as relative `assets/` paths; never inline base64, never hotlink.
- Guard storage access: the Lavish sandbox iframe has no `allow-same-origin`, so `localStorage` access throws and kills the artifact's JS.
  Fonts must be inlineable as data URIs by the tooling for the same reason; never rely on file-path fonts surviving review.
- Keep interaction self-contained and minimal: enough functionality to review the states, not a working app.
- Save mockups as `mockups/<screen>.html` and keep `currentMockups` accurate.

Never trust a plain `file://` load for visual verification: it hides sandbox breakage.
Verify against sandbox-condition renders (slice 03 rebuilds the checker; until then adapt `lib/legacy/sandbox-check.mjs` thinking to your verification).

## 8. The self-review gate (loop 1)

Before the client ever sees a mockup, and again after every batch of edits, you must:

1. Render every affected screen and state to rasters in `renders/`.
2. Look at the renders like a designer against a specific checklist: elements overlapping that should not; text or controls too small or too large; misalignment and broken spacing rhythm; clipped or collapsed regions; fonts that fell back; placeholder copy; hierarchy that does not read.
3. Hold the render up against the intent packet: does this match what was asked?
4. Fix what you find, re-render, and re-check.

The gate is mandatory and bounded: it must run at least once and must not loop forever - a few passes, then present.
Hopefully it catches the big mistakes so the client never has to spend a unit of guidance on one.
(A dedicated multi-agent corrector for this loop is deliberately deferred; V1 is you, looking, with this checklist.)

## 9. The iterate loop (loop 2)

The client reviews on the Lavish surface and cues units of guidance.
A unit binds any combination of: DOM bounding-box references, vector drawings in pixel space, and a text note bound to those marks - plus the state it was captured in.
Cueing accumulates units; the client sends the batch when ready.
(The rich drawing/cueing surface is slices 07-08; the image packets, slice 05; the queue engine, slice 06.
Until they exist, plain Lavish annotations arrive as the units.)

When a batch arrives:

1. Generate each unit's image packet (clean render, annotated render, solo crop, labeled context shot) - deterministically, by script, not by hand (slice 05).
2. Read everything - all units, all packets, the current mockup - and author the execution queue: ordered items, each citing the unit ids it addresses.
   Every unit must be cited by at least one item; reconcile conflicting units at planning time.
3. Execute serially: apply one item's edit, re-render, run the self-review gate on what changed, complete the item, take the next.
   Keep the full pending queue visible to yourself while executing each item.
4. When the batch is done, regenerate the review surface so the client sees the new mockup, and report which annotations each edit addressed.

Annotations are intent: a loose arrow or region means you choose the exact clean geometry.
For drastic or ambiguous units (deleting a major element, rewording copy, two plausible readings), state your interpretation and confirm before committing; small unambiguous nudges you just do.
Version control of the mockup is loose and chat-historical, a la Lavish; the durable record is the queue and its unit citations.

## 10. Approval and handoff

Approval is the client's explicit act; record it in `history` and set stage `approved`.
Only after approval, package `handoff/`: the mockup set plus the assembled intent packet (slice 14 defines the bundle and the callable First Mate contract).
Building the approved mockup into real production code is First Mate's job, not yours.

## 11. Recovery

A restart must be a non-event.
On "get back to work" or any ambiguous resumption:

1. Run `bin/fe-status.sh` to see every project's disk-derived state.
2. If `project.json` disagrees with the folder contents, trust the folders and repair the state file.
3. Tell the user where things stand in one or two sentences, then continue the stage machine.

Never let a stale state file stall you; the folders are the truth.
