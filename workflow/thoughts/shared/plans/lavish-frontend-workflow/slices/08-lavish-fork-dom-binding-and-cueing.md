# Slice 08: Lavish fork - DOM binding and unit cueing

**Type**: HITL
**Status**: Built - pending user sign-off on feel

## Blocked by

- Slice 07: Lavish fork - pixel drawing layer

## What to build

The fusion that makes the review surface both a pixel canvas and a live DOM, per the PRD's Markup and annotation semantics.
Extend the fork so the user can select one or more real DOM bounding boxes (multi-select, beyond upstream Lavish's single-element annotation), bind a text note to any combination of marks and bounding boxes, and assemble that bundle into a unit of guidance.
Cueing a unit adds it to the queue (it does not send); units accumulate and are sent as one batch, preserving Lavish's queue-then-send model.
The composition is free: a drawing alone, text-annotated drawings, text over drawings plus boxes, or text-annotated boxes alone.

## Acceptance criteria

- [ ] Multiple DOM bounding boxes can be selected into one pending unit
- [ ] A text note can bind to marks, boxes, or both within the unit
- [ ] Cueing produces a valid slice-04 unit in the queue without sending it
- [ ] Queued units accumulate and send as one batch through the poll channel
- [ ] Every unit composition from the PRD can be authored end-to-end by hand
- [ ] The user has driven the cueing flow by hand and signed off on its feel

## User stories addressed

- User story 21
- User story 23
- User story 24
- User story 26
