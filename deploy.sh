#!/usr/bin/env bash
# Production redeploy on the VM. Rebuilds only what actually changed (Docker
# layer cache handles the rest), applies migrations, and prints a health check.
#
#   ./deploy.sh              # pull + rebuild changed services + migrate
#   ./deploy.sh --no-pull    # skip git pull (deploy the current checkout)
#   ./deploy.sh seed         # also run the content seed profile
set -euo pipefail
cd "$(dirname "$0")"

CE="docker compose --env-file .env.prod -f docker/docker-compose.prod.yml"

[[ "${1:-}" == "--no-pull" ]] && shift || git pull

# `--build` with no service name still short-circuits on unchanged layers, so an
# untouched frontend is a cache hit (seconds), a changed one rebuilds.
$CE up -d --build

echo "--- migrations ---"
$CE logs migrate --tail=15 || true

if [[ "${1:-}" == "seed" ]]; then
  echo "--- seeding content ---"
  $CE --profile seed run --rm seed
fi

echo "--- status ---"
docker compose -p codesquare ps
curl -fsS -o /dev/null -w "http://localhost:8084 -> %{http_code}\n" http://localhost:8084 || echo "frontend not answering yet"
$CE logs backend --tail=8 | (grep -i admin || true)
