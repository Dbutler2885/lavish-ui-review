#!/usr/bin/env bash
# Create a new frontend-design project: folder scaffold plus project.json stage state.
# Usage: bin/fe-new.sh <slug> [--title "Settings redesign"] [--mode redesign|extend|new]
#        [--target-repo <git-url-or-path>]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/lib/new-project.mjs" "$@"
