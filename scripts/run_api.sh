#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/vivindis-api ]]; then
  echo "Önce: ./scripts/bootstrap.sh veya make install-py" >&2
  exit 1
fi

exec .venv/bin/vivindis-api --reload --host "${API_HOST:-127.0.0.1}" --port "${API_PORT:-8000}"
