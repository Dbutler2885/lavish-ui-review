# Slice 03: Tracer bullet - text intent to presented mockup

**Type**: HITL
**Status**: Built, pending approval

## Blocked by

- Slice 02: Intent-space store

## What to build

The first end-to-end path through the whole pipeline, using existing tools wherever a bespoke one does not exist yet.
A user deposits text-only intent (a written brief dropped into the intent space), the agent builds a per-screen HTML mockup from it, runs the mandatory bounded visual self-review gate (render the mockup with a renderer adapted from the print `sandbox-check`, critique against a specific frontend checklist covering overlaps, sizing, alignment, and similar, fix, re-render), and only then presents it through the existing unforked `lavish-axi` for review and approval.
This proves the spine (intent -> build -> self-review -> present -> approve) before any fork, queue, or drawing-layer work exists.

## Acceptance criteria

- [ ] A text brief in the intent space produces a standalone HTML mockup (one file per screen)
- [ ] The mockup renderer renders a screen to a raster under sandbox conditions
- [ ] The agent demonstrably runs the critique checklist against the render and fixes at least what it catches before presenting
- [ ] The mockup is presented through existing `lavish-axi` and the user can approve it, advancing the stage to `approved`
- [ ] The self-review loop is bounded and cannot run forever

## User stories addressed

- User story 15
- User story 18
- User story 19
- User story 30
- User story 33
