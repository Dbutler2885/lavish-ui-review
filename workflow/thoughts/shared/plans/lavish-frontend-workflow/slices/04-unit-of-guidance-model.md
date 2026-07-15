# Slice 04: Unit-of-guidance model

**Type**: AFK
**Status**: Done

## Blocked by

None - can start immediately.

## What to build

The canonical annotation object and its serialization, per the PRD's deep-module definition.
A unit holds: references (each a DOM selector or an image pixel-region), vector marks (each with its own identity, optional group membership, and optional semantic tag), text notes bound to marks or references, a captured state id, and a coverage list.
Responsibilities: construct, validate, serialize/deserialize, enumerate references, report coverage.
Pure data module, no UI and no model calls; everything else in the system speaks this shape.

## Acceptance criteria

- [ ] Units of every composition can be constructed: drawing alone; text + drawings; text + drawings + bounding boxes; text + bounding boxes
- [ ] Serialize/deserialize round-trips losslessly
- [ ] Malformed units are rejected with clear validation errors
- [ ] Reference enumeration and coverage reporting work as specified
- [ ] Unit tests cover all of the above (per PRD Testing Decisions)

## User stories addressed

- User story 11
- User story 12
- User story 21
- User story 22
- User story 23
- User story 24
- User story 25
