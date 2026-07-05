#!/usr/bin/env bash
# auto-release-update.sh — keep the release-pinned DocWright dev-cloud instances (#2/#3/#4)
# on the newest v* release tag. For each instance not on the newest tag, checks it out and
# rebuilds+recreates the container. Idempotent; safe on a cron (only rebuilds when the tag
# actually moved). Vault content + the .env/override (untracked) are left untouched.
#
# Cron: 0 * * * * /home/gemini/Projects/docwright-deploy/auto-release-update.sh >> .../auto-release.log 2>&1
set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/gemini/.local/bin"
ts(){ date -Iseconds; }

DEPLOY=/home/gemini/Projects/docwright-deploy
# instance dir -> docker compose project name
INSTANCES=( "csdocs:docwright-csdocs" "erp-images:docwright-erp-images" "msp:docwright-msp" )

# Newest release tag (all clones share the growlf/docwright remote).
cd "$DEPLOY/csdocs" || { echo "$(ts) ERROR: $DEPLOY/csdocs missing"; exit 1; }
git fetch origin --tags --prune -q 2>/dev/null
NEWEST=$(git tag -l 'v*' --sort=-v:refname | head -1)
if [ -z "$NEWEST" ]; then echo "$(ts) no v* tag found — skipping"; exit 0; fi

for entry in "${INSTANCES[@]}"; do
  name="${entry%%:*}"; proj="${entry##*:}"; dir="$DEPLOY/$name"
  [ -d "$dir/.git" ] || { echo "$(ts) $name: $dir not a checkout — skip"; continue; }
  cd "$dir" || continue
  git fetch origin --tags --prune -q 2>/dev/null
  CUR=$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
  if [ "$CUR" = "$NEWEST" ]; then
    echo "$(ts) $name up to date @ $NEWEST"
    # ensure it's actually running (e.g. after a host reboot the policy handles this, but double-check)
    docker compose -p "$proj" ps --status running 2>/dev/null | grep -q docwright || {
      echo "$(ts) $name not running — starting"; docker compose -p "$proj" up -d; }
    continue
  fi
  echo "$(ts) $name: ${CUR} -> ${NEWEST} — checkout + rebuild"
  if git checkout -q "$NEWEST" 2>/dev/null; then
    if docker compose -p "$proj" up -d --build; then
      echo "$(ts) $name rebuilt + restarted on $NEWEST"
    else
      echo "$(ts) ERROR: $name compose up failed on $NEWEST"
    fi
  else
    echo "$(ts) ERROR: $name checkout $NEWEST failed (local changes?) — skipping"
  fi
done
