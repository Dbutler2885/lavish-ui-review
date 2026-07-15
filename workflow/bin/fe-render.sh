#!/usr/bin/env bash
# Render a mockup screen to renders/<screen>-<state>.png under Lavish-like
# sandbox conditions (opaque-origin iframe over HTTP). You must then LOOK at
# the PNG: this is the self-review gate's evidence.
# Usage: bin/fe-render.sh <slug> [screen.html] [--state <id>] [--width N] [--height N] [--out path]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/lib/render.mjs" "$@"
