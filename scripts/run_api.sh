#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
export PYTHONPATH="$ROOT"
exec "${PYTHON:-python3}" -m uvicorn app.main:app --host "${API_HOST:-127.0.0.1}" --port "${API_PORT:-8000}" --reload
