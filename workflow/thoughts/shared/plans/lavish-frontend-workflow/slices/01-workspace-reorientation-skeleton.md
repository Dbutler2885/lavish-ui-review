# Slice 01: Workspace reorientation skeleton

**Type**: AFK
**Status**: Done

## Blocked by

None - can start immediately.

## What to build

Reorient the forked print workspace into the frontend workflow's skeleton.
Strip the print-only inheritance (format presets, bleed/safe-zone, proof wrapper, PDF export) and stand up the new stage machine: `intent -> build -> iterate -> approved -> handoff`.
Define the new `project.json` shape (slug, title, stage, job mode, pointers, history) and provide `fe-new` and `fe-status` scripts in the style of the existing `pdf-new`/`pdf-status` (disk-derived truth, folders win over state files).
Rewrite the core-loop sections of `AGENTS.md` to describe this workflow instead of the print one, per the PRD's Stage machine and Architecture sections.

## Acceptance criteria

- [ ] `fe-new` creates a project folder with the new `project.json` shape and an empty intent space
- [ ] `fe-status` derives each project's stage from disk and flags stale state
- [ ] Print-only scripts and stages are removed or clearly retired
- [ ] `AGENTS.md` describes the new stage machine and core loop
- [ ] A fresh agent session can create a project and report its status using only the manual

## User stories addressed

- User story 2
- User story 37
