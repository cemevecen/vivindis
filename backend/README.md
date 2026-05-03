# Vivindis Backend

FastAPI uygulaması (`app` paketi). Şartname: repo kökünde `VIVINDIS_SPEC.md`.

Yerel (Docker dışı):

```bash
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Ortam değişkenleri: kökteki `.env` (`.env.example` şablonu).
