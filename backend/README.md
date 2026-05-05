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

## Railway / Supabase (canlı)

1. **Deploy:** `DATABASE_URL` değişince yeni build’in **Success / Active** olduğundan emin olun; bitmeden test etmeyin.
2. **Şifre özel karakterleri:** `@`, `#`, `%` vb. DSN içinde yüzde kodlu olmalı. Backend, `DATABASE_URL` yüklenirken şifrede bu karakterleri **otomatik encode** etmeye çalışır (`app.core.database_url`); yine de Supabase panelinde verilen havuz linkini aynen kopyalamak en güvenlisidir.
3. Bu sürümde arka plan kuyruğu yok; yorum çekme ve analiz API çağrısı içinde senkron çalışır.
