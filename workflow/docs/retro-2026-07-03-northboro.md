# Retro: northboro-postcard (first real project, 2026-07-03)

What broke on the first real project, and what changed in the repo because of it.
Items marked "fixed" landed the same day.

## Rendering and sandbox

1. **Proof was blank in Lavish** (fixed in `lib/proof-wrap.mjs`).
   Lavish renders artifacts in a sandboxed iframe without `allow-same-origin`, where `localStorage` throws; the proof read it at script top, the exception killed the layout script, and the card collapsed.
   Fix: try/catch storage shim.
2. **Card was not annotatable** (fixed in `lib/proof-wrap.mjs`).
   The proof nested the draft in an inner `<iframe>`; Lavish's annotation layer cannot see into a child document.
   Fix: the generator now inlines the draft's DOM into the proof, with rulers/overlays as `pointer-events: none` layers.
3. **Fonts silently fell back in Lavish** (fixed in `lib/proof-wrap.mjs`).
   `@font-face` file paths are CORS-blocked in the opaque-origin sandbox, with no error visible in the layout.
   Fix: the proof generator inlines local font urls as data URIs; drafting rules updated.
4. **Blurred shadows became opaque rectangles in the PDF** (fixed: rule in AGENTS.md section 7, warning in `lib/export-pdf.mjs`).
   Chrome `--print-to-pdf` rasterizes any nonzero blur radius into a solid box.
   Rule: 0-blur offset shadows only.
5. **Verified against `file://`, which hid problems 1, 3, and 4** (fixed: `bin/pdf-check.sh` + rasterized export previews, both mandated in AGENTS.md).
   `file://` is same-origin and renders blur softly, so everything looked fine while broken for the reviewer and the print.

## Process

6. **Design language showed a composed near-final mock** (fixed: AGENTS.md section 6).
   It pre-committed geometry and read as a finished draft.
   Rule: design language is a style system (palette, type specimens, texture, treatments, sample elements), never the whole piece at true size.
7. **1.4 MB inline base64 image made the draft uneditable** (fixed: AGENTS.md section 7 + `bin/pdf-asset.sh`).
   Read hit token limits, grep dumped megabytes, offset reads failed.
   Rule: images as relative `assets/` paths prepared at 300 DPI; only fonts get inlined, and only by the proof generator.
8. **Annotation-to-geometry churn on ambiguous edits** (fixed: AGENTS.md section 8).
   Rule: confirm interpretation before committing drastic or ambiguous edits; just do small unambiguous nudges.
9. **No commercial-print path** (open).
   Export is trim-only; a shop wanting true bleed and crop marks needs the WeasyPrint/Prince path AGENTS.md section 9 already flags as unbuilt.

## Tooling gaps found

- ImageMagick was missing; CSS-filter fakery for period photo treatment does not fully survive to print (installed 2026-07-03; use `magick` on prepared assets).
- No raster object-remover / generative edit tool for painting out power lines or signs; cropping is the only dodge for now.
- Fonts were downloaded ad hoc; they now live in `assets/fonts/` with a role table in its README.
