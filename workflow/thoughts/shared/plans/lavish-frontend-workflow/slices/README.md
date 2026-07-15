# Implementation Slices

Parent PRD: [../prd.md](../prd.md)

## Overview

| #   | Slice                                           | Type | Status                  | Blocked by     |
| --- | ----------------------------------------------- | ---- | ----------------------- | -------------- |
| 01  | Workspace reorientation skeleton                | AFK  | Done                    | None           |
| 02  | Intent-space store                              | AFK  | Done                    | 01             |
| 03  | Tracer bullet - text intent to presented mockup | HITL | Built, pending approval | 02             |
| 04  | Unit-of-guidance model                          | AFK  | Done                    | None           |
| 05  | Image-packet generator                          | AFK  | Done                    | 04             |
| 06  | Edit-queue engine                               | AFK  | Done                    | 04             |
| 07  | Lavish fork - pixel drawing layer               | HITL | Built, pending sign-off | 04             |
| 08  | Lavish fork - DOM binding and unit cueing       | HITL | Built, pending sign-off | 07             |
| 09  | Iterate loop integration                        | HITL | Not started             | 03, 05, 06, 08 |
| 10  | Intent UI - visual intake                       | HITL | Not started             | 02, 04, 05     |
| 11  | Grill-me integration                            | AFK  | Done                    | 02             |
| 12  | Target checkout and existing-code modes         | HITL | Not started             | 03             |
| 13  | Multi-state mockups and state-aware annotation  | AFK  | Not started             | 09             |
| 14  | Approval gate and First Mate handoff            | AFK  | Not started             | 09             |

## Slice details

- **01 - Workspace reorientation skeleton**: Strip print inheritance, stand up the new stage machine, project shape, and scripts, rewrite the manual's core loop.
- **02 - Intent-space store**: The shared deposit folder, job mode, target pointer, and builder-packet assembly; tested.
- **03 - Tracer bullet - text intent to presented mockup**: First end-to-end spine using existing lavish-axi: brief in, self-reviewed mockup presented and approvable.
- **04 - Unit-of-guidance model**: The canonical annotation object (refs, marks, notes, state, coverage); tested.
- **05 - Image-packet generator**: Deterministic clean plus annotated-drawings images, with HTML refs as manifest metadata per unit; tested.
- **06 - Edit-queue engine**: Two-layer queue with serial execution and coverage tracking; tested.
- **07 - Lavish fork - pixel drawing layer**: Fork lavish-axi and add identity-bearing vector marks with grouping.
- **08 - Lavish fork - DOM binding and unit cueing**: Multi-select bounding boxes, bind notes to marks+boxes, cue and batch-send units.
- **09 - Iterate loop integration**: Batch in, image packets, model-authored plan, serial apply with re-render and self-review, coverage report.
- **10 - Intent UI - visual intake**: The same drawing vocabulary over static inspo images and blank canvas, meaning tags, deposits into the intent space.
- **11 - Grill-me integration**: Optional bounded opening interview whose artifact deposits into the intent space.
- **12 - Target checkout and existing-code modes**: Pull the target repo, build faithful redesign or in-language extend mockups.
- **13 - Multi-state mockups and state-aware annotation**: Clickable in-place states, state-aware rendering, units and edits pinned to states.
- **14 - Approval gate and First Mate handoff**: Explicit approval, handoff bundle, callable entry contract for First Mate.
