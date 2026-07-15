# Direction Note: Multi-Substrate Lavish Review

**Status:** Exploratory direction

**Purpose:** Record the current direction without turning it into a complete PRD or implementation plan.

## Emerging direction

Lavish should evolve from an HTML-artifact review tool into one review system that can operate over several kinds of surface.

The current candidate surface types are:

- A local HTML artifact rendered through the existing Lavish sandbox.
- A static screenshot uploaded by the user or captured by the agent.
- A blank drawing surface for expressing new interface intent.
- A live local application, such as a running React application, with its real rendered DOM and authenticated state.

These should share the existing Lavish interaction language wherever possible:

- One drawing toolbar.
- One feedback sidebar.
- Vector marks and mark grouping.
- Optional DOM references when the substrate has a DOM.
- Text notes bound to selected marks and references.
- Queued feedback units sent through the Lavish polling channel.
- Persistent review sessions that remain open after feedback is sent.
- Explicit session ending as a separate user action.

The surface types should not become separate products.
They should be substrate adapters within `lavish-axi-fork`, using one session, feedback, and agent-loop model.

## First product milestone

The first milestone is not a storyboard or a multi-screen flow editor.
It is a dependable loop for reviewing one surface repeatedly without ending the session.

The basic loop is:

```text
open a surface
-> annotate it
-> send feedback to the agent
-> keep the session open
-> reload, replace, or recapture the surface after changes
-> annotate again
-> repeat until the user explicitly ends the review
```

The initial implementation should unify the two substrates that already have working code:

1. The existing Lavish HTML-artifact surface.
2. The screenshot annotation prototype.

This should validate a shared surface host, shared feedback-unit contract, persistent submission loop, and common chrome before more difficult substrates are added.

## Candidate progression

The current preferred progression is:

1. Preserve the current HTML-artifact behavior behind a shared surface boundary.
2. Bring screenshot upload, fit, zoom, and annotation into the same Lavish chrome and polling loop.
3. Add a blank drawing surface as a small extension of the image-based surface.
4. Build a narrow live-application tracer bullet that proves authentication, SDK injection, DOM selection, drawing, capture, and repeated submission on one local route.
5. Add multiple surfaces to a session only after the individual surface types are reliable.
6. Explore storyboard organization and cross-surface intent only after the shared primitives have settled.

The live-application tracer bullet should remain deliberately narrow.
It only needs to prove that one authenticated local route can be reviewed without behaving differently from the application the user normally sees.

## Tentative shared model

The durable model should remain small while leaving room for later multi-surface work.

```text
session
├── surfaces
│   ├── stable surface identity
│   ├── substrate kind and source
│   └── revisions
└── feedback units
    ├── surface and revision identity
    ├── vector marks
    ├── optional DOM references
    ├── user-authored notes
    └── captured visual evidence
```

The chrome should depend on surface capabilities rather than substrate-specific conditionals wherever practical.
Candidate capabilities include rendering, dimensional reporting, visual capture, reload or replacement, DOM reference selection, and application interaction.

Every submitted visual unit should preserve what the user actually reviewed.
For HTML artifacts and live applications, this means capturing the reviewed browser state rather than assuming a later independent render will reproduce it exactly.

## Live-application security question

The existing artifact iframe deliberately omits `allow-same-origin` because agent-generated HTML is treated as untrusted.
That opaque sandbox is likely incompatible with authenticated applications that depend on cookies, local storage, IndexedDB, service workers, OAuth, or ordinary CORS behavior.

Artifact mode and live-application mode therefore need different trust policies.
The current candidates for live applications are a real-origin iframe with an injected SDK or direct SDK injection into the user's existing authenticated tab.
This must be proven with a tracer bullet before the live mode is designed more broadly.

The current headless composite process is also insufficient for authenticated live state because it rerenders the source independently after submission.
Live mode should capture the actual reviewed frame or tab when feedback is sent.

## Later multi-surface direction

A later session may contain HTML artifacts, screenshots, blank concepts, and live application states together.
A comic-book or storyboard overview is a promising way to arrange those surfaces in left-to-right reading order with wrapping rows.

The storyboard could establish a default sequence while allowing a user to enter a focused annotation view for any panel.
Transition captions and directed cross-surface connections could later express relationships that cannot be drawn as an arrow within one surface.

This is intentionally deferred.
The system should first prove that individual surfaces and the repeated feedback loop are coherent.

## Questions to resolve before a larger plan

- What is the smallest clean interface between the Lavish chrome and a surface adapter?
- Which session state belongs in the shared store, and which state remains substrate-specific?
- How should screenshot replacement and surface revisions appear in the existing conversation UI?
- How should a blank concept surface handle text labels without becoming a full design application?
- Can a live application preserve authentication and normal behavior inside an iframe, or is direct-tab injection required?
- How should the SDK survive live application navigation and full-page reloads?
- How should the reviewed browser state be captured at submission time?
- Which parts of the screenshot prototype should be ported directly, and which should be replaced by existing Lavish mechanisms?
- When multiple surfaces arrive, is a storyboard the primary session view or an optional overview?
- How should directed connections identify selected marks, DOM references, and whole-surface endpoints across revisions?

## Explicitly deferred

This note does not define:

- A complete product requirements document.
- Final command names or CLI syntax.
- A final adapter API.
- Storyboard interaction details.
- Cross-surface connection controls.
- Branching or conditional user flows.
- Automatic mapping from rendered DOM elements to React source components.
- A migration or release plan.

Those decisions should follow small technical proofs and hands-on review rather than being fixed from discussion alone.
