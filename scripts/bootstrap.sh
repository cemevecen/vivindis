#!/usr/bin/env bash
# İlk kurulum: Python venv + editable paket + frontend bağımlılıkları
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PYTHON="${PYTHON:-python3}"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "Hata: $PYTHON bulunamadı." >&2
  exit 1
fi

if [[ ! -d .venv ]]; then
  "$PYTHON" -m venv .venv
fi
.venv/bin/pip install -U pip wheel
.venv/bin/pip install -e ".[api]"

cd frontend
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo ""
echo "Kurulum bitti."
echo "  Geliştirme:  make dev   veya   ./scripts/dev.sh"
echo "  Yalnız API:  make api   veya   ./scripts/run_api.sh"
echo "  OpenAPI:     http://127.0.0.1:8000/docs"
