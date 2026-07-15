# What this workflow takes from First Mate

Reviewed from `~/Documents/Code/firstmate` (AGENTS.md, docs/architecture.md) on 2026-07-05.
First Mate is the structural DNA for how this workspace operates; this doc records what we adopt, what we adapt, and what we deliberately defer.
The full multi-agent machinery is deferred with the corrector sub-agent (PRD, Multi-agent scope); these are the parts that shape V1.

## Adopted principles

1. **A directory, not an app.**
   The orchestrator is `AGENTS.md` + skills + helper scripts that any terminal agent can follow.
   This workspace has the same product surface.
2. **Restart-proof, disk-based state.**
   All state lives in files; a killed session is a non-event, and the next one reconciles from disk and carries on.
   Ours: the per-project folder contract, `fe-status.sh` disk-derived truth, and the recovery section of the manual.
3. **Scaffolded briefs are the contract.**
   First Mate generates crewmate briefs by script (`fm-brief.sh`) with every path and rule filled in; "the scaffold is the contract, not a suggestion."
   Ours: the compact task packets for queue-item execution (slice 09) are generated programmatically from the queue + image packets, so the executing agent reads a complete, uniform packet rather than the whole messy history.
4. **Sparse, actionable status.**
   Crewmates report only supervisor-actionable phase changes, because every report costs attention.
   Ours: during loop execution, surface only decision-needed / done / blocked to the client; no play-by-play.
5. **Resolution ladder for vague references.**
   Explicit name wins; a follow-up inherits its referent; content match against what is on disk; one confident match proceeds while naming the choice ("a wrong guess costs one correction"); several or zero matches means one short question.
   Ours: the manual's project-resolution rule; apply the same ladder to resolving which screen or mockup a request targets.
6. **Two task shapes: ship versus scout.**
   The deliverable is either a change or knowledge, and knowledge tasks end in a report, never a change.
   Ours: research scouts (inherited from the print workspace's tradition) versus edit execution; keep the shapes distinct.
7. **Explicit modes, recorded not inferred.**
   First Mate records each project's delivery mode in a registry.
   Ours: the job mode (redesign / extend / new) is an explicit recorded choice captured during intent, never inferred.
8. **Fail-closed, honest guards.**
   Teardown refuses dirty worktrees; status lines are never falsely reassuring; guards print the repair command.
   Ours: handoff refuses before approval (slice 14), export-style verifications fail loudly, scripts report exactly what happened.
9. **Worktrees, never the user's checkout.**
   Crewmates work in isolated treehouse worktrees and never touch the primary clone.
   Ours: slice 12 pulls target repos into isolated working areas and never modifies them.
   Corollary learned 2026-07-05: a local checkout can sit on a stale branch; fetch and check against `origin/main` before concluding anything about a repo's contents.
10. **Escalate only real decisions; plain outcome language.**
    The captain hears outcomes and genuinely captain-level questions, nothing else.
    Ours: client etiquette in the iterate loop - confirm drastic or ambiguous units, just do small unambiguous ones, report what changed.

## Deferred with multi-agent (not V1)

- The tmux crew, spawn/supervise/teardown scripts, and the zero-token watcher chain.
- Secondmates (persistent domain supervisors in isolated homes).
- The backlog format and blocked-by dependency queueing across parallel tasks.

When the corrector sub-agent and First Mate callability land, this workflow becomes a callable specialty: First Mate dispatches a design job, this workspace runs intent -> mockup -> converge with the client, and the approved bundle returns for the real-code build.
