#!/usr/bin/env bash
# Generate the review surface for a mockup (inlined, scaled to fit beside
# Lavish's sidebar, with state buttons) into mockups/review/, then open it
# with: lavish-axi projects/<slug>/mockups/review/<screen>-review.html
# Usage: bin/fe-review.sh <slug> [screen.html]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/lib/review-wrap.mjs" "$@"
