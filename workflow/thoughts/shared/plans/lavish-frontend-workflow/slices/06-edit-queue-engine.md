# Slice 06: Edit-queue engine

**Type**: AFK
**Status**: Done

## Blocked by

- Slice 04: Unit-of-guidance model

## What to build

The two-layer queue state machine, per the PRD's deep-module definition.
Layer one ingests the batch of user-cued units.
Layer two holds the model-authored execution items, each citing the unit ids it addresses.
The engine exposes the serial executor: advance to the next item, mark an item complete, and track coverage so every cued unit is accounted for by at least one execution item (flagging any that are not).
The engine is deterministic and independent of the model; the model's plan and patches are inputs to it, not part of it.

## Acceptance criteria

- [ ] A batch of cued units can be ingested and held
- [ ] A model-authored plan (items with unit citations) can be loaded against the batch
- [ ] Serial advancement works: one active item at a time, complete-then-next, full pending queue visible
- [ ] Coverage tracking flags any unit not cited by any item
- [ ] Unit tests cover ingestion, planning, serial advancement, and coverage (per PRD Testing Decisions)

## User stories addressed

- User story 26
- User story 27
- User story 28
- User story 29
- User story 32
