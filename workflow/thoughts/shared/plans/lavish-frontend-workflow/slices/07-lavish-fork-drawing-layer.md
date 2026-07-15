# Slice 07: Lavish fork - pixel drawing layer

**Type**: HITL
**Status**: Built - pending user sign-off on feel

## Blocked by

- Slice 04: Unit-of-guidance model

## What to build

Fork the open-source `lavish-axi` repo and add the pixel drawing layer to its review client.
A Konva-based vector layer over the rendered artifact supporting selection boxes, arrows, arcs, circles, curves, and freehand marks.
Each mark has its own identity; marks can be selected and grouped into objects; a selection box is just another kind of mark meaning "look at this area".

Reference implementation: `HomeBoysHouse` (branch `main`), `src/features/maps/components/MapDrawingEditor.tsx` (react-konva).
Lift its patterns: origin-plus-relative shape geometry (move/group-move/paste are origin translation), single-active-tool toolbar, shift-click and marquee multi-select, Transformer resize, snapshot-stack undo/redo (one stroke = one undo step), Esc-clears semantics, and dual raster+vector persistence (`stage.toBlob` plus scene JSON).
Do NOT port its textured fills (`mapTextures.ts`, fill-pattern plumbing); plain solid fills are enough for guidance marks.
Caution: its stamp persistence uses `localStorage`, which throws in the Lavish sandbox; keep it guarded or persist through the Lavish server.
This slice is the drawing surface only; DOM binding and cueing are slice 08.

Viewer-chrome requirement (user, 2026-07-05): the conversation sidebar must OVERLAY the artifact and be minimizable, instead of upstream's fixed 360px grid column that squeezes the artifact iframe.
Reviewing a fixed-viewport mockup wants the full window; the panel should slide over on demand.

## Acceptance criteria

- [ ] The forked editor still does everything upstream Lavish does (element annotation, queue, poll)
- [ ] All six mark types can be drawn, adjusted, and deleted over the artifact
- [ ] Marks have stable identities and can be multi-selected and grouped
- [ ] Marks serialize into the unit-of-guidance mark shape from slice 04
- [ ] The user has driven the drawing layer by hand and signed off on its feel

## User stories addressed

- User story 10
- User story 11
- User story 20
- User story 22
