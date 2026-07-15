# Slice 02: Intent-space store

**Type**: AFK
**Status**: Done

## Blocked by

- Slice 01: Workspace reorientation skeleton

## What to build

The shared intent-space folder abstraction from the PRD's deep-module list.
Tools deposit artifacts (grill-me output, intent UI units and images, uploaded files); the store records the job mode (redesign / extend / build-new) and an optional target-repo pointer; a reader assembles the compact builder packet the mockup builder consumes.
Folder-as-truth: the store is a plain on-disk folder inside the project, and `assemble()` reads the union of whatever was deposited.

## Acceptance criteria

- [ ] Deposits land as plain files in the project's intent space with a small index
- [ ] Job mode and target-repo pointer are recorded and readable
- [ ] `assemble()` produces a well-formed builder packet containing the union of deposits
- [ ] Unit tests cover deposit sequences, job-mode recording, and packet assembly (per PRD Testing Decisions)

## User stories addressed

- User story 2
- User story 8
- User story 34
