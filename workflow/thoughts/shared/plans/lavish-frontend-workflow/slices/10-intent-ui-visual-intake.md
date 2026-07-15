# Slice 10: Intent UI - visual intake

**Type**: HITL
**Status**: Not started

## Blocked by

- Slice 02: Intent-space store
- Slice 04: Unit-of-guidance model
- Slice 05: Image-packet generator

## What to build

The visual-first intent tool, extending the existing `intake-ui` with the same drawing/annotation vocabulary as the review surface, but over static images instead of a live DOM.
Reference implementation: `HomeBoysHouse` `main`, `src/features/maps/components/MapDrawingEditor.tsx` (react-konva) - the toolbar, multi-select, undo, and especially the stamp creator (select shapes, save selection as a reusable stamp with thumbnail, click to place) as the "capture intent once, reuse it" primitive.
Do NOT port its textured fills; solid fills only.
The user uploads inspiration images and screenshots, draws vector marks over them (a selection here is a pixel region), draws freely on a blank canvas, groups marks, attaches text notes to marks or groups, and tags regions by meaning (typography, layout, texture, mood, color, density, anti-example).
Every annotated image is preserved both clean and annotated.
The job-mode choice (redesign / extend / build-new) is a recognizable, explicit step, and everything deposits into the slice-02 intent space as slice-04 units plus images.

## Acceptance criteria

- [ ] Inspiration images can be uploaded and marked up with the full mark vocabulary
- [ ] Pixel-region selections can be tagged with the meaning taxonomy
- [ ] The user can draw on a blank canvas and annotate groups of their own marks
- [ ] Clean and annotated versions of every image are both preserved
- [ ] Job mode is captured as an explicit choice
- [ ] Finishing intake deposits well-formed units, images, and files into the intent space
- [ ] The user has run a real intake by hand and signed off on its feel

## User stories addressed

- User story 9
- User story 10
- User story 11
- User story 12
- User story 13
- User story 14
