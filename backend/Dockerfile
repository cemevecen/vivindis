FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential libpq-dev \
  && rm -rf /var/lib/apt/lists/*

# Build context must be the monorepo root (see docker-compose.yml).
# Paths are prefixed with backend/ so Railway and `docker build -f backend/Dockerfile .` work.
COPY backend/pyproject.toml backend/README.md backend/alembic.ini ./
COPY backend/app ./app
COPY backend/alembic ./alembic

# app-store-scraper eski requests ile urllib3 1.25 çeker; 1.25’te import hatası var.
# Editable kurulumdan sonra urllib3’ü sabit aralığa yükselt (worker AppStore importu için).
RUN pip install --upgrade pip setuptools wheel \
  && pip install --no-cache-dir -e . \
  && pip install --no-cache-dir --upgrade --no-deps "urllib3>=1.26.18,<2"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
