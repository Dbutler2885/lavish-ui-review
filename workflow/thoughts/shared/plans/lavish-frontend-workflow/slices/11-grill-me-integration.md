# Slice 11: Grill-me integration

**Type**: AFK
**Status**: Done

## Blocked by

- Slice 02: Intent-space store

## What to build

The optional text-first opening pass.
When the user states what they want to work on, the workflow offers the choice: begin with a grill-me session or go straight to the intent UI.
If chosen, the grill-me interview runs with a bounded question budget and bails to "I have enough to start" early, then offers the intent UI next.
The grill-me artifact (the distilled brief/decisions) is deposited into the same intent space the intent UI writes to, so the mockup builder reads both from one place.

## Acceptance criteria

- [ ] The opening choice (grill-me vs intent UI) is part of the documented workflow entry
- [ ] The interview respects a question budget and can end early with "enough to start"
- [ ] The grill-me artifact lands in the intent space as a deposit
- [ ] `assemble()` includes the grill-me artifact in the builder packet alongside intent UI deposits

## User stories addressed

- User story 1
- User story 6
- User story 7
- User story 8
