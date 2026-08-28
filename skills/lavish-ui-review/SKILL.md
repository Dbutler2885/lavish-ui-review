---
name: lavish-ui-review
description: Run iterative visual UI reviews with annotated HTML or screenshot-backed surfaces, including mobile and desktop States, drawing marks, DOM references, queued feedback, and agent code edits. Use when refining an existing or proposed interface through a visual feedback loop. Do not use for general non-UI visual explanations; use the original lavish skill instead.
---

# Lavish UI Review

Use Lavish UI Review as an iterative interface-design loop.
Keep the original `lavish` skill for general visual explanations and rich response artifacts.

## Request

$ARGUMENTS

## Choose the review surface

1. Use the real HTML artifact when reviewing a proposed interface or a model-generated mockup.
2. Embed a screenshot in a fixed HTML surface when reviewing an existing application capture.
3. Use multiple named States when comparing variants such as current, proposed, mobile, and desktop.

When an HTML artifact has multiple States, expose one root with `data-lavish-state-root` and its active `data-state`, expose each available State through a descendant `[data-state]`, and implement `window.setState(id)` to reveal the requested State.
Lavish owns the State tabs, drawing buckets, queued-edit counts, and State-specific feedback images.

## Run the feedback loop

1. Create or identify the review HTML file.
2. Run `npm exec --yes --prefer-online --package=github:Dbutler2885/lavish-ui-review#web-design -- lavish-ui-review <html-file>`.
3. Run `npm exec --yes --prefer-online --package=github:Dbutler2885/lavish-ui-review#web-design -- lavish-ui-review poll <html-file>` and leave the long poll running while the user reviews.
4. Read every returned feedback unit's State, note, marks, DOM references, and image path before editing.
5. Apply feedback sequentially and verify the affected State in a real browser.
6. Run `npm exec --yes --prefer-online --package=github:Dbutler2885/lavish-ui-review#web-design -- lavish-ui-review poll <html-file> --agent-reply "<message>"` to continue the same session.
7. Run `npm exec --yes --prefer-online --package=github:Dbutler2885/lavish-ui-review#web-design -- lavish-ui-review end <html-file>` only when the review is genuinely finished.

Do not recreate an existing application as approximate HTML merely to annotate it.
Use a screenshot-backed surface for an existing UI and reserve HTML mockups for proposed interfaces and alternatives.
Do not collapse multiple feedback States into the default State.
Treat rough marks as intent and make precise implementation decisions in the target codebase.
