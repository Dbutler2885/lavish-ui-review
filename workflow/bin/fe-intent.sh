#!/usr/bin/env bash
# The intent-space store CLI: deposit artifacts, record the job mode and
# target repo, and assemble the builder packet.
#
# Usage:
#   bin/fe-intent.sh deposit <slug> <file> [--name <dest>] [--kind <k>] [--tool <t>]
#   bin/fe-intent.sh note <slug> <name> <text...>        write a text deposit
#   bin/fe-intent.sh mode <slug> redesign|extend|new
#   bin/fe-intent.sh target <slug> <git-url-or-path>
#   bin/fe-intent.sh assemble <slug>                     print the builder packet JSON
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/lib/intent-cli.mjs" "$@"
