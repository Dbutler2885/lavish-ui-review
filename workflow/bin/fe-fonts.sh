#!/usr/bin/env bash
# fe-fonts.sh sync [--force] | list [query] | use <slug> <family>
#
# Manage the shared font library (assets/fonts/, driven by catalog.json).
#   sync    download missing catalog fonts from the Google Fonts API
#   list    browse the catalog by category, with role notes; query filters
#   use     copy a family into a project's mockups/assets/ and print the
#           @font-face rules to paste into the mockup
set -euo pipefail
cd "$(dirname "$0")/.."
exec node lib/fonts.mjs "$@"
