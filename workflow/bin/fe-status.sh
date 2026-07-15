#!/usr/bin/env bash
# Disk-derived status for one project or all projects; flags stale state files.
# Usage: bin/fe-status.sh [slug]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/lib/status.mjs" "$@"
