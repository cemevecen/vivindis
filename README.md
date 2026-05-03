# Vivindis

SaaS: Play / App Store yorumlarını toplama ve analiz.

**Bağlam:** [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md)  
**Kurallar:** [.cursorrules](./.cursorrules)  
**Repo:** https://github.com/cemevecen/vivindis

## Oturum 1 (mevcut)

Monorepo iskeleti, Docker Compose, ortam şablonları, backend paket tanımı, Next.js + Tailwind + shadcn başlangıcı. İş mantığı yok.

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000  
- API: http://localhost:8001/docs (Compose’ta host portu 8001; konteyner içi 8000)  
- Flower: http://localhost:5555  
- PostgreSQL (host): `localhost:5433` → konteyner `postgres:5432`  
