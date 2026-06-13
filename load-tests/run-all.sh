#!/usr/bin/env bash
# Orquestra todos os cenários k6 e salva os summaries em results/.
#
# Pré-requisitos (ver README.md):
#   - k6 instalado            (https://grafana.com/docs/k6/latest/set-up/install-k6/)
#   - docker-compose up -d    (Postgres/PostGIS + Redis)
#   - pnpm db:seed            (usuários + eventos); opcional: tsx load-tests/seed-loadtest.ts
#   - API no ar               (ver nota sobre rate limit abaixo)
#
# A maioria dos cenários assume a API SEM throttling, pra medir vazão pura:
#   RATE_LIMIT_ENABLED=false pnpm dev
# A demonstração de rate limit (05) roda nas DUAS configs e é tratada à parte.
#
# Uso:
#   bash load-tests/run-all.sh                       # base http://localhost:3333
#   K6_BASE_URL=http://host:3333 bash load-tests/run-all.sh
set -euo pipefail

cd "$(dirname "$0")"

BASE_URL="${K6_BASE_URL:-http://localhost:3333}"
mkdir -p results

echo "▶ Alvo: $BASE_URL"
if ! curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
  echo "✗ API não respondeu em $BASE_URL/health. Suba o servidor primeiro." >&2
  exit 1
fi
echo "✓ API no ar"

run() {
  local script="$1"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ k6 run $script"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  K6_BASE_URL="$BASE_URL" RESULTS_DIR="results" \
    K6_SUMMARY_TREND_STATS="avg,min,med,max,p(90),p(95),p(99)" \
    k6 run "$script" || true
}

run 00-smoke.js
run 01-geo-baseline.js
run 02-geo-stress.js
run 03-spike.js
run 04-authenticated.js

echo ""
echo "ℹ A demonstração de rate limit (05) precisa de DOIS estados da API."
echo "  Fase OFF (rode com RATE_LIMIT_ENABLED=false pnpm dev):"
echo "    PHASE=off bash load-tests/run-rate-limit.sh"
echo "  Fase ON (rode com pnpm dev — default ligado):"
echo "    PHASE=on  bash load-tests/run-rate-limit.sh"

echo ""
echo "✅ Resultados em load-tests/results/*.json"
