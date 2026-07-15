# Slice 14: Approval gate and First Mate handoff

**Type**: AFK
**Status**: Not started

## Blocked by

- Slice 09: Iterate loop integration

## What to build

The exit of the workflow, per the PRD's handoff decisions.
An explicit approval action moves the project to `approved`; nothing ships downstream before it.
On approval, package the finished mockup set together with its intent packet into a handoff bundle, and define the callable entry contract so First Mate can invoke this workflow as a specialty: intent or existing-code reference in, converged approved mockup plus intent packet out.
The real-code build from the bundle is First Mate's job and stays out of scope.

## Acceptance criteria

- [ ] Approval is an explicit user action recorded in the project history
- [ ] The handoff bundle contains the mockup set and the assembled intent packet
- [ ] The workflow's entry contract is documented well enough for a First Mate crewmate to drive it end-to-end without a human explaining it
- [ ] Attempting handoff before approval is refused

## User stories addressed

- User story 33
- User story 34
- User story 35
- User story 36
