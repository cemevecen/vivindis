# Vivindis

SaaS: Play / App Store yorumlarını toplama ve analiz.

**Bağlam:** [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md)  
**Kurallar:** [.cursorrules](./.cursorrules)  
**Repo:** https://github.com/cemevecen/vivindis

## Yerel çalıştırma

```bash
cp .env.example .env
docker compose config   # YAML doğrulama (CI / ön kontrol)
docker compose up --build
```

- Frontend: http://localhost:3000 (locale öneki: `/tr/...`, `/en/...`)  
- API Swagger: http://localhost:8001/docs (Compose’ta host portu **8001**; konteyner içi **8000**)  
- Sağlık: http://localhost:8001/health  
- Flower: http://localhost:5555  
- PostgreSQL (host): `localhost:5433` → konteyner içi `postgres:5432`  

**Manuel kontrol (Oturum 8):** tarayıcıda `/docs` açılıyor mu; dashboard’da dar ekranda menü çekmecesi; `/tr/compare` veya `/en/compare` boş durum + CTA; form hatalarında Sonner toast’ları.

**Frontend tek başına:** `cd frontend && npm install && npm run lint && npm run build`

## Railway (API / `backend/Dockerfile`)

Build context **repo kökü** olmalı; `backend/Dockerfile` içindeki `COPY` yolları `backend/...` ile başlar. Serviste **Root Directory** alanını boş bırakın (veya `/`), Dockerfile yolu `backend/Dockerfile` olsun. Kökteki [railway.json](./railway.json) DOCKERFILE + bu yolu sabitler.

`COPY alembic` / `"/alembic": not found` hatası genelde (1) eski commit’in deploy edilmesi veya (2) yanlış build context’tir. **Deployments** üzerinden `main`’in en son commit’ini seçin; gerekirse **Clear build cache** ile yeniden derleyin.

Ayrıntılı mimari ve kurallar için [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md).
