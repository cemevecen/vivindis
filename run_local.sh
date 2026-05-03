#!/usr/bin/env bash
# Yerel geliştirme (Cloud bu scripti kullanmaz).
# Port doluysa: STREAMLIT_LOCAL_PORT=9520 ./run_local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT="${STREAMLIT_LOCAL_PORT:-9517}"
PY="${PYTHON:-python3}"
if ! "$PY" -c "import streamlit" 2>/dev/null; then
  echo "Hata: streamlit bulunamadı. Kur: $PY -m pip install streamlit" >&2
  exit 1
fi
echo "Başlatılıyor → http://127.0.0.1:${PORT} (Ctrl+C ile dur)"
exec "$PY" -m streamlit run streamlit_app.py \
  --server.port "${PORT}" \
  --server.address 127.0.0.1
