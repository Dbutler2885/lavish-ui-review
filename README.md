# lavish-ui-review

Review UI mockups in your browser by drawing on them.
Circle the thing, draw an arrow to where it belongs, click the elements you mean, type one sentence, and your coding agent receives a picture of your marks over the page along with the CSS selectors you picked and your note.

"This card is too close to the header" is faster to draw than to write, and much harder to misread once drawn.

## Origin

This tool began as a fork of [kunchenguid/lavish-axi](https://github.com/kunchenguid/lavish-axi), Kun Chen's Lavish Editor, and the editor underneath it is his work.
That project opens agent-generated HTML in a local browser, lets you annotate elements, text ranges, and Mermaid nodes, and ships the feedback back to an agent over a long-polling CLI.
This one keeps that core and builds a UI review tool on it: a drawing layer, a selection that holds marks and DOM elements together, named states with their own tabs, and a conversation panel that overlays the artifact instead of taking width from it.

It is a hard fork, not a tracking one.
The two projects split in July 2026 and this one does not pull `lavish-axi` releases.
Treat what is here as this tool's behavior, and file anything you find against this repository.

If you already run `lavish-axi`, the two coexist.
This one uses its own command name, port, and state directory.

## What this tool adds

### Marks drawn over the artifact

A `Markup` toggle in the top bar turns on a canvas layer sitting over the rendered page.
Tools are box, arrow, arch, arch arrow, circle, and freehand, plus select, a hand tool for moving marks, and erase.
Lavish stores marks in page coordinates, so they stay put when you scroll.

Undo and redo are Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.
Delete or Backspace removes the selection, Escape clears it.
Select two or more marks and the group button fuses them into one labeled drawing group, which is how the agent learns that the circle and the arrow are one idea.

Lavish never writes into the artifact file.
Marks live in the browser session, so the HTML on disk stays byte-identical and still opens on its own.

### One selection holding marks and elements together

The select tool builds a mixed selection.
Drag a marquee to catch marks, click a page element to add it as a DOM reference, hold Shift to keep adding.
The status readout in the top bar counts both, for example `2 marks + 1 element selected`.

That mixed selection plus a typed note is the unit the agent receives.
The drawing says where, the elements say which nodes, and the note says what to change.
Queueing a unit is Enter in the sidebar note box, Shift+Enter for a newline.

Move, reshape, group, or delete a mark that is already part of a queued edit, and Lavish pulls that edit back out of the queue.
An edit you are still revising never reaches the agent half-finished.

### Named states with their own tabs

An artifact can declare several states, and Lavish renders one tab per state above the frame.
Each state keeps its own marks and its own undo history.
Its tab carries a count of the edits queued against it, so a desktop review and a mobile review do not merge into one pile.

The contract an artifact has to satisfy:

```html
<div class="screen" data-lavish-state-root data-state="desktop">
  <div data-state="desktop">...</div>
  <div data-state="mobile" hidden>...</div>
</div>
<script>
  var root = document.querySelector(".screen");
  window.setState = function (id) {
    root.dataset.state = id;
    root.querySelectorAll("[data-state]").forEach(function (el) {
      el.hidden = el.dataset.state !== id;
    });
  };
</script>
```

Lavish calls `window.setState(id)` when you click a tab, and falls back to setting `data-state` on the root element when the artifact does not define it.
Tabs stay hidden while an artifact has only one state.
`workflow/templates/mockup-starter.html` is a working skeleton.

### A conversation panel that overlays the artifact

The panel is an overlay pinned to the right edge, not a column stealing width from the artifact.
Minimize it and it collapses to a drawer handle showing how many edits are queued, with a dot when a reply arrived while it was closed.
Above the chat log sits a note box that names the current selection, so queueing an edit does not mean hunting for where to type.

### A picture of the marks on the page, not on transparency

The browser can only capture the marks, because the sandboxed iframe cannot raster its own DOM.
So when a unit arrives, the server writes the transparent overlay PNG to disk, screenshots the artifact headlessly at the overlay's exact pixel size, stacks the two, and hands the agent the composite as `annotated.png`.

That step looks for a Chromium-family browser: Brave, Chrome, Chromium, or Edge in `/Applications`, or whatever `LAVISH_AXI_CHROME_BIN` or `CHROME_BIN` points at.
The step is best-effort on purpose.
If no browser is found or the render times out, the agent gets the transparent overlay instead and the review loop keeps going.

## Install

Install the agent skill, which teaches an agent the whole loop:

```sh
npx skills add Dbutler2885/lavish-ui-review --skill lavish-ui-review
```

Add `-g` to install it for every project instead of the current one.
The skill runs the CLI straight from this repository, so there is nothing else to install:

```sh
npm exec --yes --prefer-online --package=github:Dbutler2885/lavish-ui-review#main -- lavish-ui-review <html-file>
```

This repository also carries the original `lavish` skill, inherited unchanged.
Use `lavish` for general visual explainers, plans, and diagrams.
Use `lavish-ui-review` when you are iterating on an interface.

### From source

```sh
git clone https://github.com/Dbutler2885/lavish-ui-review.git
cd lavish-ui-review
pnpm install
pnpm run build
node dist/ui-review.mjs <html-file>
```

## A review session

The examples below write `lavish-ui-review` for whichever launcher you installed, so substitute the `npm exec` form or `node dist/ui-review.mjs` as needed.

```sh
lavish-ui-review mockup.html                 # open the browser and start a session
lavish-ui-review poll mockup.html            # wait for the user to send feedback
lavish-ui-review poll mockup.html --agent-reply "Widened the card."
lavish-ui-review end mockup.html             # finish the review
lavish-ui-review stop                        # shut down the background server
```

`poll` blocks and prints nothing until feedback arrives, which is what makes it usable as an agent's wait state.
Leave it running, and if your harness kills it, run it again.
Queued feedback sits in `~/.lavish-ui-review/state.json` until a poll collects it, so nothing is lost.

| Command                               | What it does                                                           |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `lavish-ui-review`                    | List open sessions and print the usage guidance an agent reads.        |
| `lavish-ui-review <html-file>`        | Open or resume a review session and launch the browser.                |
| `lavish-ui-review poll <html-file>`   | Wait for feedback, layout warnings, or the end of the session.         |
| `lavish-ui-review end <html-file>`    | End the session as the agent, which still allows a later plain reopen. |
| `lavish-ui-review export <html-file>` | Write a single self-contained HTML file with local assets inlined.     |
| `lavish-ui-review stop`               | Shut down the background server.                                       |

Useful flags: `--no-open` creates the session without launching a browser, `--reopen` reopens a session the user ended from the browser, `--no-gate` skips the layout curtain, and `--timeout-ms` bounds a poll for scripting and tests.

### What the agent gets back

A poll that returns feedback looks like this:

```
prompts[1]:
  - tag: feedback-unit
    id: u-demo-2
    state: desktop
    image: /Users/you/.lavish-ui-review/feedback-assets/39f58e28d1019bad/u-demo-2/annotated.png
    marks: "2 marks: 1 box, 1 arrow"
    elements[1]{uid,selector,tag,text}:
      "5",div.card,element,$29 / month Choose Pro
    note: Tighten the card padding
```

Each unit names the state it belongs to, so an agent editing a mobile variant knows not to touch the desktop one.
`image` is an absolute path the agent opens with an image-capable tool, and the poll's `next_step` says to do that before editing anything.
`uid` resolves against the `dom_snapshot` the same response carries.

The CLI strips what the agent does not need before delivery, including individual mark ids, per-mark geometry, byte counts, and the raw overlay path.
What is left is a picture, a selector, and a sentence.

### Coexisting with lavish-axi

|       | `lavish-axi`     | `lavish-ui-review`     |
| ----- | ---------------- | ---------------------- |
| Port  | 4387             | 4391                   |
| State | `~/.lavish-axi/` | `~/.lavish-ui-review/` |

Both binaries ship from this package, so having `lavish-axi` installed too costs you nothing.
`bin/lavish-ui-review.js` sets those defaults and then runs the same CLI, which rewrites every command name it prints so an agent reading the output copies the right one.

Neither binary reports telemetry when you build from this repository.
The analytics endpoint is injected at build time and nothing here injects one, and `dist/ui-review.mjs` is compiled with it hard-coded empty on top of that.

## The frontend workflow workspace

`workflow/` holds `lavish-frontend-workflow`, a local design workspace where the deliverable is an HTML mockup plus the intent it was built from, never production code.
It moved here from a sibling repository so one repo owns both the review UI and the workflow that drives it.
The workflow is the loop around the review step: construct intent, build mockups, iterate through review, hand off.

```sh
pnpm run workflow:status                          # disk-derived status for every project
pnpm run workflow:test                            # the workspace's own tests
pnpm run workflow:render <slug> [screen.html]     # headless PNG render of one screen
pnpm run workflow:review <slug> [screen.html]     # build the review-wrapped HTML
```

Do not write `pnpm run workflow:render -- <slug>`.
pnpm forwards the `--` as a literal argument and the script reads it as the project slug.

The workspace has its own scripts under `workflow/bin/` for things without a root alias, including `fe-new.sh` to scaffold a project, `fe-intent.sh` for the intent store, and `fe-fonts.sh` for the embeddable font catalog.
A typical pass:

```sh
workflow/bin/fe-new.sh settings-redesign --mode redesign
# build projects/settings-redesign/mockups/settings.html
pnpm run workflow:render settings-redesign settings.html
pnpm run workflow:review settings-redesign settings.html
lavish-ui-review workflow/projects/settings-redesign/mockups/review/settings-review.html
```

`workflow/AGENTS.md` is the operating manual and `workflow/thoughts/shared/plans/lavish-frontend-workflow/` holds the PRD and the implementation slices.
Slices 07 and 08, the drawing layer and the DOM binding, are the ones implemented in `src/` here.
Read `workflow/README.md` for which slices are done and which are not.

## The rest of the editor

Drawing is the part that is new here.
The editor underneath carries the rest, all of it inherited from `lavish-axi`:

- Element, text-range, and Mermaid node annotation, with Cmd/Ctrl+I toggling annotate and explore mode.
- A layout audit that runs in the real browser after fonts settle and reports overflow, clipped text, and overlapping text as `layout_warnings`.
  A curtain holds error-severity findings back until a clean reload, and `--no-gate` skips it.
- Live reload when the artifact file changes, with the iframe scroll position preserved across the reload.
- `export`, which inlines local assets into one self-contained HTML file and leaves remote CDN references as links.
- `share`, which publishes that same inlined HTML to [ht-ml.app](https://ht-ml.app), a third-party host that is not part of this tool.
  Pages are public unless you pass `--password`.
- Sessions keyed by the canonical file path, so there are no opaque session IDs to pass around.
- A detached server that shuts itself down once no browser and no poll have been connected.

`AGENTS.md` documents all of it in the detail a contributor needs.

## Development

```sh
pnpm run check          # build, lint, format check, typecheck, tests, skill freshness
pnpm test               # node:test over test/
pnpm run build          # bundle dist/cli.mjs and dist/ui-review.mjs
pnpm run build:skill    # regenerate skills/lavish/SKILL.md and skills/lavish-ui-review/SKILL.md
```

Node 22+, ESM-only JavaScript, type-checked through TypeScript's `checkJs` rather than written in TypeScript.

The default branch is `main`, and pull requests go against it directly.
CI covers lint, format, typecheck, tests, and build across Linux, macOS, and Windows, and a second workflow checks that the generated skills are in sync.
GitHub keeps Actions switched off on a forked repository until they are enabled, so run `pnpm run check` locally rather than waiting for checks to appear.
`CONTRIBUTING.md` has the rest.

## License

MIT.
The editor this was built from is Kun Chen's work, released under the same license.
