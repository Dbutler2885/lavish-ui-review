# Slice 09: Iterate loop integration

**Type**: HITL
**Status**: Not started

## Blocked by

- Slice 03: Tracer bullet - text intent to presented mockup
- Slice 05: Image-packet generator
- Slice 06: Edit-queue engine
- Slice 08: Lavish fork - DOM binding and unit cueing

## What to build

The system's heart: wire the batch of cued units into the full loop-two revision cycle.
When a batch lands, the image-packet generator produces each unit's image set; the model receives everything (all packets plus the current mockup) and authors the execution queue, each item citing the units it addresses; the edit-queue engine then drives serial execution - the model applies one item's edit, the mockup re-renders, the self-review gate runs, the item completes, the next begins.
After the batch, the review surface shows the updated mockup and the user cues the next round.
The coverage report shows which annotations each edit addressed.

## Acceptance criteria

- [ ] Sending a batch generates image packets for every unit deterministically
- [ ] The model's execution plan cites units and passes the engine's coverage check
- [ ] Items apply serially with a re-render and self-review between each
- [ ] The updated mockup reappears on the review surface for the next round
- [ ] A user-visible record maps each applied edit to the units it addressed
- [ ] A real multi-unit revision round has been run end-to-end and signed off

## User stories addressed

- User story 27
- User story 28
- User story 29
- User story 30
- User story 31
- User story 32
