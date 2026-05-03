# Vivindis

SaaS: Google Play ve Apple App Store yorumlarını toplama, **heuristic** ve **AI (Gemini)** ile analiz; uygulama sahipleri ve geliştiriciler için dashboard.

**Bağlam:** [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md)  
**Kurallar:** [.cursorrules](./.cursorrules)  
**Repo:** https://github.com/cemevecen/vivindis

## Mevcut yığın (özet)

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query, **next-intl** (12 dil, varsayılan `tr`), Clerk, Recharts, Sonner |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Alembic, Celery, structlog |
| Yerel | Docker Compose: Postgres, Redis, API, worker, Flower, Next dev |

## Yerel çalıştırma

```bash
cp .env.example .env
docker compose config   # YAML doğrulama
docker compose up --build
```

- Frontend: http://localhost:3000 — URL’ler locale önekli: `/tr/...`, `/en/...`  
- Analiz merkezi: `/tr/analyze` (mağaza araması, dosya/metin için yer tutucu, karşılaştırma sekmesi)  
- API Swagger: http://localhost:8001/docs (host **8001**; konteyner içi **8000**)  
- Sağlık: http://localhost:8001/health  
- Flower: http://localhost:5555  
- PostgreSQL (host): `localhost:5433` → konteyner `postgres:5432`  

**Manuel smoke:** `/docs`; dar ekranda dashboard menü çekmecesi; `/tr/compare` boş durum + CTA; formlarda Sonner.

**Sadece frontend:** `cd frontend && npm install && npm run lint && npm run build`

## Üretim mimarisi (özet)

Tipik kurulum:

- **Site (Next.js):** [Vercel](https://vercel.com) — özel alan adı örn. `vivindis.com` / `www.vivindis.com`  
- **API + worker:** [Railway](https://railway.app) — özel alan adı örn. `api.vivindis.com`  
- **Veritabanı:** yönetilen PostgreSQL (ör. Supabase); `DATABASE_URL` içinde **`postgresql+asyncpg://`** kullanın  
- **Redis:** yönetilen Redis (ör. Upstash); Celery için **`rediss://`** TCP URL  
- **Kimlik:** [Clerk](https://clerk.com) — publishable + secret + JWKS + JWT issuer + webhook (`POST /api/v1/auth/sync`)

Frontend, API’ye `NEXT_PUBLIC_API_URL` ile ulaşır — değer **yalnızca kök origin** olmalıdır (örn. `https://api.vivindis.com`). Sonuna **`/api/v1` eklemeyin**; istemci yolları zaten `/api/v1/...` ile başlar; aksi halde istek `/api/v1/api/v1/...` olur ve **404 Not Found** görürsünüz.

**CORS’suz alternatif:** Vercel’de `NEXT_PUBLIC_API_URL`’ü boş bırakıp yalnızca `BACKEND_ORIGIN` verin (örn. `https://api.vivindis.com`). Next.js, aynı site üzerinden `/api/v1/*` isteklerini bu köke proxylar (`frontend/next.config.mjs`).

DNS’te `api` genelde Railway’e **CNAME** ile gider; kök/`www` kayıtları Vercel dokümantasyonuna göre ayarlanır.

### Vercel (frontend)

1. Projeyi GitHub’dan import edin.  
2. **Settings → General → Root Directory:** `frontend` (zorunlu; monorepo kökünde `package.json` yok).  
3. **Framework:** Next.js (otomatik algılanır).  
4. **Environment Variables (Production)** örnekleri:  
   - `NEXT_PUBLIC_API_URL` — canlı API **kökü** (`https://api…`, `/api/v1` **yok**)  
   - **veya** (CORS’u baypas): `BACKEND_ORIGIN` aynı kök + `NEXT_PUBLIC_API_URL` boş → site üzerinden `/api/v1` proxy  
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`  
   - İsteğe bağlı: `NEXT_PUBLIC_APP_URL` — kendi sitenizin kök URL’si  

Kökte **`vercel.json` kullanılmıyor**; monorepo için yeterli ayar Root Directory + env değişkenleridir.

### Railway (backend)

1. Aynı repoyu bağlayın; kökteki [railway.json](./railway.json) **DOCKERFILE** + `dockerfilePath: "backend/Dockerfile"` kullanır.  
2. [backend/Dockerfile](./backend/Dockerfile) **build context’in repo kökü** olduğunu varsayar (`COPY backend/...`). Yerelde doğrulama:

   `docker build -f backend/Dockerfile .`

3. **Variables:** `.env.example` ile hizalı tutun (`DATABASE_URL`, `REDIS_URL`, `CELERY_*`, Clerk, `SECRET_KEY`, `CORS_ORIGINS`, `GEMINI_API_KEY`, …).  
4. **Worker:** ayrı bir Railway servisi; aynı imaj/kaynak, start örneği:  
   `celery -A app.core.celery:celery_app worker -Q scraper,analysis --loglevel=info`  
5. İlk şema veya güncellemeler için konteyner/shell üzerinden: `alembic upgrade head`

`COPY alembic` / **`"/alembic": not found`** hatası: imaj **kök dizinden** üretilmiyorsa oluşur. `main`’deki Dockerfile + yukarıdaki `docker build` komutu ile uyumlu olun; gerekirse **Clear build cache** ve yeniden deploy.

### Kök `nixpacks.toml`

[Railway Nixpacks](https://docs.railway.com/) ile kökten Python kurulumu için [nixpacks.toml](./nixpacks.toml) vardır. Servis **Dockerfile** kullanıyorsa (`railway.json`) Nixpacks devre dışı kalır; çakışma olursa Railway arayüzünde builder’ı kontrol edin.

---

Ayrıntılı oturum geçmişi, API listesi ve kod kuralları için [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md).
