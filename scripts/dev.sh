#!/usr/bin/env bash
# API (8000) + Vite (5173) — Ctrl+C ile ikisi de kapanır
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/vivindis-api ]]; then
  echo "Önce kurulum: ./scripts/bootstrap.sh veya make install" >&2
  exit 1
fi

cleanup() {
  kill "${API_PID:-0}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

.venv/bin/vivindis-api --reload --host "${API_HOST:-127.0.0.1}" --port "${API_PORT:-8000}" &
API_PID=$!

cd frontend
exec npm run dev
