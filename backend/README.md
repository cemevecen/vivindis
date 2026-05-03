# Vivindis Backend

FastAPI uygulaması (`app` paketi). Şartname: repo kökünde `VIVINDIS_SPEC.md`.

Yerel (Docker dışı):

```bash
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Ortam değişkenleri: kökteki `.env` (`.env.example` şablonu).

Alembic (async; `DATABASE_URL` zorunlu):

```bash
# Örnek: Docker Postgres host portu 5433
export DATABASE_URL=postgresql+asyncpg://vivindis:vivindis@127.0.0.1:5433/vivindis
alembic upgrade head
alembic revision --autogenerate -m "mesaj"
```

Migration dosyaları: `alembic/versions/`.
