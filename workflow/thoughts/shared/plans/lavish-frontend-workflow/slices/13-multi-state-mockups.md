# Slice 13: Multi-state mockups and state-aware annotation

**Type**: AFK
**Status**: Not started

## Blocked by

- Slice 09: Iterate loop integration

## What to build

In-place interaction in the mockup and state-awareness through the whole loop, per the PRD's screen/state decisions.
The mockup builds in-place states (modals, popovers, expand/collapse, tabs, error states) as real clickable HTML within one screen's mockup; navigation to a wholly different screen is a separate mockup.
The renderer can render a named state; a unit of guidance records the state it was captured in; the execution loop applies each edit against the state the unit named and self-reviews that state's render.

## Acceptance criteria

- [ ] A mockup with a modal and an expanded section can be clicked through on the review surface
- [ ] The renderer renders a named state of a screen deterministically
- [ ] A unit cued while viewing the open-modal state records that state id
- [ ] An edit about the open modal lands on and is verified against the open-modal state
- [ ] Screens sharing no content are produced as separate mockups

## User stories addressed

- User story 16
- User story 17
- User story 25
