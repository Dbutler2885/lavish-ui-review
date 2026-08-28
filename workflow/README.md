# lavish-frontend-workflow

A local, agent-centered frontend-design workspace: constructed intent in, converged HTML mockups out.

Open this repo in Claude Code or Codex and speak naturally:

> "Redesign my settings page."
> "Grill me first."
> "Make the mockup."
> "Let me see it."
> "I approve it."

The agent reads `AGENTS.md` (the operating manual and the real product surface), infers the next step from the project files on disk, and does the design work itself.
You review through a Lavish-derived surface that is both a pixel canvas and a live DOM, cue rich units of guidance (drawings + element references + notes), and the agent turns each into a precise, tracked edit.

## The core idea

The deliverable is an HTML mockup artifact of the real thing, plus the intent packet it was built from - never production code.

1. **Intent.** An optional grill-me interview and an optional visual intent UI deposit into one shared intent space. Three job modes: redesign an existing frontend, extend it in its own design language, or build new.
2. **Build.** The agent builds per-screen mockups from the assembled intent and must visually self-review its renders against a defect checklist before you ever see them.
3. **Iterate.** You draw and annotate directly over the rendered mockup; cued units of guidance are batched, planned into an execution queue (every annotation accounted for), and applied serially with re-render and self-review between edits.
4. **Handoff.** On your explicit approval, the mockup set and intent packet are bundled for downstream build (e.g. by [First Mate](https://github.com/kunchenguid/firstmate)).

Suggestion in, precision out: you express intent, the agent owns the exact result.
The deepest purpose is reducing your brain effort - strong provisional choices, exposed visually, corrected only where they feel wrong.

## Status

This workspace is now consolidated under the Lavish fork at `workflow/`.
The modified Lavish review surface lives in the parent repo `src/` and is treated as one tool in this workflow.
Slices 01, 02, 04, 05, 06, and 11 are implemented and tested in this workspace.
Slice 03 is built and pending approval on the `game-night` tracer project.
Slices 07 and 08 are implemented in the parent Lavish fork surface and still need hands-on sign-off.
Slices 09, 10, 12, 13, and 14 remain unstarted.

## What is here

```
AGENTS.md                the agent operating manual: workflow, stages, file contracts
VISION.md                the narrative statement of intent
thoughts/shared/plans/   the PRD and implementation slices
bin/fe-new.sh            create a project
bin/fe-status.sh         disk-derived project status
bin/fe-fonts.sh          catalog-driven font library: list, use in a project, sync
templates/               one-screen mockup starter with the state contract
assets/fonts/            ~95-family embeddable font catalog (OFL/Apache)
projects/<slug>/         one folder per job: intent space, mockups, renders, queue, handoff
lib/legacy/              retired print-era bases awaiting adaptation
```

## Requirements

- Node 18+ (uses only the standard library).
- The `lavish-ui-review` CLI from this repository for the review surfaces. See the [root README](../README.md) for how to install it.
- A Chromium-based browser for rendering checks.
