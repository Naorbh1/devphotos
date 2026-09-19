#!/bin/bash
# מתקין את התלויות של הפאנל כך שכל סשן של Claude Code על הווב מתחיל מוכן לעבודה.
set -euo pipefail

# רץ רק בסביבה המרוחקת (Claude Code on the web) - לא על מחשב מקומי.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

python3 -m pip install --quiet --disable-pip-version-check --root-user-action=ignore -r panel/requirements.txt

# שמירה על ברירות מחדל נוחות לשאר הסשן.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PYTHONUNBUFFERED=1' >> "$CLAUDE_ENV_FILE"
fi
