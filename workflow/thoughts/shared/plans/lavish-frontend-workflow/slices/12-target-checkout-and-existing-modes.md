# Slice 12: Target checkout and existing-code modes

**Type**: HITL
**Status**: Not started

## Blocked by

- Slice 03: Tracer bullet - text intent to presented mockup

## What to build

The redesign-existing and extend-existing job modes, per the PRD's Target checkout module and job-mode decisions.
Pull the target repo treehouse-style into a working area inside this workspace, locate the frontend code being targeted, and produce a code-context bundle for the builder.
In redesign mode, the agent reads the real code and reproduces the current UI faithfully as a mockup, adding nothing the user did not ask for; the user then drives changes through the loop.
In extend mode, the agent extracts the existing design language from the code and builds the new thing in that language, combined with the intent-space deposits.

## Acceptance criteria

- [ ] A GitHub repo can be pulled into an isolated working area inside the workspace
- [ ] The code-context bundle identifies the targeted frontend surfaces
- [ ] Redesign mode produces a mockup that faithfully reproduces the current UI without invented additions
- [ ] Extend mode produces new work that visibly matches the existing design language
- [ ] The real repo is never modified by this workflow
- [ ] The user has run a redesign of a real repo of theirs and signed off on the reproduction fidelity

## User stories addressed

- User story 3
- User story 4
- User story 5
