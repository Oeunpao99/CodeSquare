#!/usr/bin/env bash
# ship.sh — stage everything, commit, and push the current branch.
#
#   ./ship.sh                     # commit with an auto timestamp message
#   ./ship.sh "fix: rate limits"  # commit with your own message
#
set -euo pipefail
cd "$(dirname "$0")"

msg="${*:-chore: update $(date '+%Y-%m-%d %H:%M:%S')}"

# Bail early if there is genuinely nothing to do.
if git diff --quiet && git diff --cached --quiet \
   && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "Working tree clean — nothing to commit."
  exit 0
fi

branch="$(git branch --show-current)"
if [ -z "$branch" ]; then
  echo "Detached HEAD — checkout a branch before shipping." >&2
  exit 1
fi

git add -A
git status --short
git commit -m "$msg"

# Push; set the upstream automatically on the first push of a new branch.
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  git push
else
  git push -u origin "$branch"
fi

echo "✓ Shipped '$msg' to $branch."
