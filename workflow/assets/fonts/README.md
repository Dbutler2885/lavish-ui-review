# Shared font library

A curated, catalog-driven library of embeddable print fonts, all OFL or Apache licensed (fetched from the Google Fonts API), so embedding in PDFs and print pieces is fine.

`catalog.json` is the source of truth: ~95 families across these categories, each with a one-line role note.

| Category            | What it covers                                  |
| ------------------- | ----------------------------------------------- |
| serif               | body-text serifs for books, letters, editorial  |
| serif-display       | didones, engraved caps, formal headline serifs  |
| slab                | slab serifs from sturdy to vintage              |
| sans                | body-text sans workhorses                       |
| sans-display        | geometric and deco display sans                 |
| condensed           | space-tight gothics for posters, dates, venues  |
| display             | fat poster faces, retro, western, deco, marquee |
| script              | brush and casual scripts                        |
| script-formal       | calligraphic scripts for invitations            |
| handwriting         | marker, chalk, and hand-note faces              |
| blackletter-stencil | blackletter and stencil                         |
| typewriter-mono     | typewriter and retro mono                       |

## Commands

```
bin/pdf-fonts.sh list [query]         browse the catalog; query filters family/category/notes
bin/pdf-fonts.sh use <slug> <family>  copy a family into projects/<slug>/drafts/assets/
                                      and print the @font-face rules to paste
bin/pdf-fonts.sh sync [--force]       download whatever the catalog lists but disk lacks
```

Files live at `<category>/<FamilyNoSpaces>-<weight>[italic].ttf` (static instances, not variable fonts).
The TTFs are not committed; `sync` rebuilds the library from `catalog.json` on any machine.

To add a family: append an entry to `catalog.json` (use `italicWeights` when italics exist only in some weights) and run `sync`.
The proof generator inlines font urls as data URIs automatically, so the Lavish sandbox shows the real typography.
