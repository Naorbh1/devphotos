#!/usr/bin/env bash
# Prepares the runtime for the vendored geo-seo-claude skills
# (https://github.com/zubair-trabzada/geo-seo-claude, MIT).
# The skill files reference ~/.claude/skills/geo/{scripts,schema,templates,hooks}
# and ~/.claude/skills/geo/.venv, so link those to the repo copy and build the venv.
set -euo pipefail

# Only in cloud sessions; local machines use the upstream installer.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

SRC="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/skills/geo"
DEST="${HOME}/.claude/skills/geo"
mkdir -p "$DEST"

for sub in scripts schema templates hooks; do
    [ -d "$SRC/$sub" ] && ln -sfn "$SRC/$sub" "$DEST/$sub"
done

if [ ! -x "$DEST/.venv/bin/python3" ]; then
    python3 -m venv "$DEST/.venv"
    "$DEST/.venv/bin/python3" -m pip install --quiet -r "$SRC/requirements.txt"
fi
chmod +x "$SRC"/scripts/*.py 2>/dev/null || true
