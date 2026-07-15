# Slice 05: Image-packet generator

**Type**: AFK
**Status**: Done

## Blocked by

- Slice 04: Unit-of-guidance model

## What to build

The deterministic image-set producer, per the PRD's deep-module definition.
Given a rendered surface and a unit of guidance, produce: the clean image, the full annotated-drawings image with only the unit's drawing marks rendered over the page, and a JSON manifest describing drawing group ids, HTML refs, note bindings, state, and image linkage.
HTML selections are not rendered into the packet image; they stay as metadata links to the drawing groups.
This is the core "offload the mechanical work to non-LLM automation" module: same input, same output, no model in the loop.

## Acceptance criteria

- [ ] Given fixture surfaces and units, the generator emits the clean image, annotated-drawings image, and manifest
- [ ] The manifest is complete and correct (drawing groups, HTML refs, state, text bindings, image linkage)
- [ ] Output is deterministic for identical input
- [ ] HTML selections are absent from packet imagery and present only as manifest metadata
- [ ] Unit tests cover manifest correctness and deterministic output (per PRD Testing Decisions)

## User stories addressed

- User story 10
- User story 14
