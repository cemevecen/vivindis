# Üretim: Railway + Vercel — canlı tutma

Bu repoda panellere doğrudan erişim yok; **deploy ayarları** ve **GitHub Actions** (`Production smoke`) ile uçların güncel kalması hedeflenir.

## Vercel (Next.js)

| Kontrol | Açıklama |
|--------|-----------|
| **Git branch** | Production → **`main`** (veya kullandığınız prod dalı). |
| **Root Directory** | **`frontend`** |
| **Output Directory** | **Boş** (Next için zorunlu). |
| **Otomatik deploy** | Git entegrasyonu: `main` push → Production deploy. |
| **Env** | `NEXT_PUBLIC_API_URL=https://api.vivindis.com` (köksüz) **veya** `BACKEND_ORIGIN` + boş `NEXT_PUBLIC_API_URL` (proxy). Clerk anahtarları güncel. |

`frontend/vercel.json` framework’ü **nextjs** olarak sabitler.

## Railway (FastAPI + isteğe bağlı worker)

| Kontrol | Açıklama |
|--------|-----------|
| **Root Directory** | **Boş / monorepo kökü** — `backend/Dockerfile` yolu için gerekli; servis `backend` alt klasörüne kilitlenirse build “Dockerfile skipped” / yanlış context verebilir. |
| **Port** | Konteyner içi API **8000** (`backend/Dockerfile` `CMD`, `railway.json` `startCommand`). Yerelde Compose: **8001:8000** (VIVINDIS_SPEC). |
| **Kaynak** | Aynı GitHub repo, **`main`**. |
| **Builder** | Kökteki [railway.json](../railway.json): **Dockerfile** `backend/Dockerfile`, context **repo kökü**. |
| **Start** | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| **Healthcheck** | `/health` (railway.json içinde). |
| **Yeni API’ler** | Backend değişince serviste **Redeploy** / otomatik deploy açık olmalı. İmaj cache şüphesinde **Clear build cache**. |
| **Worker** | Ayrı servis; API ile aynı imaj veya paylaşımlı — API’den bağımsız route listesi API servisindedir. |

## API uçları (`/api/v1` öneki)

| Yöntem | Yol | Not |
|--------|-----|-----|
| GET | `/health` | Kimlik yok. |
| POST | `/api/v1/auth/sync` | Clerk webhook. |
| GET | `/api/v1/auth/me` | Bearer. |
| GET/POST | `/api/v1/apps` … | Uygulamalar. |
| GET | `/api/v1/apps/{id}/fetches`, … | Fetch / reviews. |
| POST/GET | `/api/v1/...` analysis | Analiz. |
| GET | `/fetches/{id}` | reviews router. |
| **GET** | **`/api/v1/store/search`** | **Bearer** — route yoksa **404**, var ama token yoksa **401**. |

OpenAPI: `https://api.vivindis.com/docs` veya `/openapi.json`.

## CI: Production smoke

[`.github/workflows/production-smoke.yml`](../.github/workflows/production-smoke.yml):

- `GET /health`
- `GET /openapi.json`
- `GET /api/v1/store/search?...` yanıt kodu **404 olmamalı** (genelde **401** = route canlı).

Alan adlarını değiştirdiyseniz workflow içindeki `PROD_API` / `PROD_SITE` env değerlerini güncelleyin.

## Hızlı manuel kontrol

```bash
curl -sS https://api.vivindis.com/health
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://api.vivindis.com/api/v1/store/search?q=test12&platform=google_play&country=tr&lang=tr&num=1"
# Beklenen: 401 (veya 200 test token ile). 404 = backend eski veya yanlış host.
```
