# Vivindis — Proje Şartnamesi ve Cursor Kuralları

**GitHub:** https://github.com/cemevecen/vivindis  
**Kalıcı kısa kurallar:** [.cursorrules](./.cursorrules)

Cursor’da her yeni sohbet açtığında şu cümleyle başla:

> Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: **VIVINDIS_SPEC.md**

---

## Proje Bağlamı

**Vivindis** (vivindis.com), uygulama sahiplerinin ve geliştiricilerin **Google Play Store** ve **Apple App Store** yorumlarını toplu çekip analiz ettiği bir **SaaS** platformudur. Kullanıcılar uygulamalarını ekler, zaman aralığı seçer, yorumlar **Celery** ile çekilir; **heuristic** (anlık, ücretsiz tarzı) ve **AI** (Gemini; ileride GROQ/OpenAI) analizi yapılır; sonuçlar **dashboard**’da (sentiment, konular, sorunlar, trend, puanlar) sunulur.

Temel akış:

1. Clerk ile hesap  
2. Uygulama ekle (package name, arama kelimesi veya App Store URL)  
3. Tarih aralığı seç  
4. Worker yorumları çeker  
5. Heuristic + AI analizi  
6. Dashboard’da sonuçlar  

**Gelecek (mimariye hazır):** karşılaştırma, rakip takibi, haftalık PDF, embed widget, API key, React Native (Expo), webhook. **Çoklu dil:** `next-intl` + locale prefix (tr varsayılan; tr, en, de, fr, it, es, pt, ja, zh, sw, ar, ru).

---

## Mevcut Durum — Oturum 1–8 (API + worker’lar + i18n + uygulama + analiz grafikleri + polish)

### Neyin yazıldığını iyi anla — üzerine yaz, tekrar kurma

**Backend — var olanlar**

- `app/main.py` — CORS, **`GET /health`**, **`/api/v1`** altında tüm router’lar
- `app/core/config.py` — pydantic-settings: DB, Redis, Celery, JWT alanları, `LOG_LEVEL`, `DATABASE_ECHO`, Clerk, AI anahtarları
- `app/core/celery.py` — Celery instance; `include`: scraper / heuristic / ai; `task_routes`: `scraper` ve `analysis` kuyrukları
- `app/db/session.py` — async engine + `get_async_session` (istek sonunda commit / hata rollback)
- `app/models/*` — `User`, `App`, `ReviewFetch`, `Review`, `Analysis` + enum’lar; ilişkiler ve kısıtlar (rating 1–5, `platform`+`store_review_id` unique)
- `alembic/` + `alembic.ini` — async env; ilk migration: **`4a66a17abb57_initial_schema`**
- `pyproject.toml` — FastAPI, Pydantic v2, SQLAlchemy async, asyncpg, Alembic, Celery+redis, httpx, google-play-scraper, app-store-scraper, google-generativeai, langdetect, **flower**
- `app/api/v1/` — `auth`, `apps`, `reviews` (fetch tekil), `analysis`, **`store`** (`GET /store/search?q=&platform=google_play|app_store|both&country=&lang=&num=20` → `{ results: [{ id, name, developer, icon, rating, review_count, platform, store_url }] }`); `deps.py` (`get_current_user`, `require_app_owned`)
- `app/schemas/` — Pydantic v2 Create/Update/Response şemaları
- `app/core/security.py` — Clerk oturum JWT (PyJWT + JWKS); `app/core/logging.py` — structlog
- `app/workers/` — `review_fetch_task` (scraper), `heuristic_analysis_task`, `ai_analysis_task` (analysis); `app/services/gemini.py` batch + merge

**Frontend — var olanlar**

- Next.js 14 **App Router**, TypeScript **strict** (`noUncheckedIndexedAccess` dahil)
- ESLint: **`@typescript-eslint/no-explicit-any`: error**
- `src/lib/api.ts` — merkezi API client; base URL **`NEXT_PUBLIC_API_URL`**; isteğe bağlı **`getToken`** → `Authorization: Bearer` (Clerk)
- TanStack Query v5 + DevTools, Zustand, react-hook-form, Zod, Sonner, Recharts
- Provider’lar: Query client + Sonner; **Clerk** — publishable key yoksa provider ve middleware koruması atlanır
- **`next-intl`** — `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/messages/*.json`, URL **`/{locale}/...`** (varsayılan **tr**), `src/middleware.ts` (Clerk + locale)
- **Oturum 6 — dashboard & uygulamalar:** TanStack Query ile `GET /api/v1/apps`, `POST /apps`, uygulama detayı `GET/POST .../apps/{id}/fetch`; **react-hook-form + zod** (`apps/new`); `AppCard` / liste / skeleton / boş durum; Clerk yoksa bilgilendirici panel
- **Oturum 7 — analiz:** `apps/[id]/analysis?fetchId=…`, **`GET /api/v1/apps/{app_id}/fetches/{fetch_id}`** (tekil fetch), fetch + analiz satırları için **~3 sn `refetchInterval`**; **Recharts** (duygu pasta, puan bar, konu bar); `POST /api/v1/fetches/{id}/analyze`
- **Oturum 8 — polish:** dashboard **mobil drawer** (`DashboardShellClient`, backdrop, `md:` masaüstü); **`EmptyState`** + **`/compare`** placeholder (CTA → `/apps`); **Sonner** (`closeButton`, süre, toast sınıfları); **`compare.*` / `navigation.sidebarNav` / `common.toastNetwork`** 12 dilde
- `globals.css` + Tailwind: shadcn/ui (base-nova); yerel Geist fontları
- `npm run build` ve `npm run lint` temiz geçmeli

**Docker Compose — servisler ve port kararları**

- Servisler: PostgreSQL, Redis, backend, worker (`-Q scraper,analysis`), flower, frontend
- **`5433:5432`** — host PostgreSQL (makinede 5432 çakışması için)
- **`8001:8000`** — host API (makinede 8000 çakışması için)
- Konteyner ağında: **`postgres:5432`**, backend **`0.0.0.0:8000`**
- **`NEXT_PUBLIC_API_URL`** varsayılanı (Compose): **`http://localhost:8001`**

**Kritik sürüm kararı (değiştirme)**

- **`@clerk/nextjs@5.7.5` sabit.** Clerk 7+ Next.js 15 istiyor; proje Next.js 14. Bu sürümü **bilinçli olarak sabitledik**; bağımlılığı **Next 14’e geçmeden güncelleme** (breaking risk ve peer uyumsuzluğu).

---

## Sıradaki Oturumlar (özet)

| Oturum | Kapsam |
|--------|--------|
| **2** | Veritabanı: async session, modeller, Alembic, ilk migration ✅ |
| **3** | REST API, Pydantic şemalar, `deps`, router’lar, `main` ✅ |
| **4** | Celery: scraper, heuristic, AI, kuyruk, retry, rate limit ✅ |
| **5** | Clerk + `next-intl`, middleware, `(auth)` / `(dashboard)`, Header dil seçici ✅ |
| **6** | Dashboard, uygulama listesi, formlar ✅ |
| **7** | Analiz sayfası, Recharts, fetch polling (~3 sn) ✅ |
| **8** | Polish, hata UX, empty state, responsive, uçtan uca test ✅ |

---

## Kesin Kurallar — Asla İhlal Etme

- TypeScript **strict**. **`any` yasak** (ESLint hata verir).
- **`console.log` production kodunda yasak.** Yapılandırılmış **logger** kullan (backend için hedef: **structlog**; frontend’de anlamlı sarıcı veya yalnızca dev ortamı).
- Tüm hassas ve ortam özelindeki değerler **`.env` / platform env** üzerinden; **kod içinde hardcode secret yasak**.
- Her API endpoint’i **Pydantic v2** ile validate edilir.
- Async işlemlerde **uygun hata yakalama** ve anlamlı HTTP cevapları zorunlu.
- SQL **string birleştirme ile yazılmaz**; **SQLAlchemy ORM** (2.0 async).
- Frontend’de ham API URL dağıtımı yok; **`src/lib/api.ts`** kullanılır.
- Tüm şema değişiklikleri **Alembic migration** ile; prod’da “elle tablo oluşturma” yok.
- Secret’lar (**API key, password, token**) **log’a yazılmaz**.
- **`@clerk/nextjs` sürümünü değiştirme** — **5.7.5 sabit** (Next 14 stratejisi).

### Backend — teknik detay

- SQLAlchemy **1.x değil** — **2.0 async** (`async with session:`).
- Pydantic **v1 değil** — **v2**: `model_config = ConfigDict(from_attributes=True)`, **`model_validate()`**; **`from_orm()` yok**.
- Celery task varsayılan **sync**; async DB/API gerekiyorsa **`asyncio.run()`** veya önerilen pattern ile sınırlı kullanım.
- Router handler’lar **`async def`**; DB **`async with session:`**.

### Frontend — teknik detay

- **`pages/` router yok** — yalnızca **`app/`** App Router.
- **`useEffect` + ham `fetch` ile veri çekme yok** — **TanStack Query**.
- Gereksiz **`'use client'`** yok; Server Component öncelikli.
- Form: **react-hook-form + Zod**; hata bildirimi: **Sonner**; yükleme: **Suspense + skeleton** mümkün olduğunca.

---

## Tech Stack — Değiştirme

### Backend

- Python **3.12**
- FastAPI
- Pydantic **v2**
- SQLAlchemy **2.0 async**
- Alembic
- Celery **5.x**
- Redis
- **httpx** (async HTTP)
- google-play-scraper, app-store-scraper

### Frontend

- Next.js **14+** App Router (Pages router değil)
- TypeScript strict
- Tailwind CSS + shadcn/ui
- Recharts
- **`@clerk/nextjs@5.7.5` (sabit)**
- TanStack Query v5
- Zustand
- react-hook-form + Zod
- Sonner

### Altyapı

- Yerel: Docker Compose (Postgres, Redis, API, worker, flower, Next dev)
- Prod hedefi: **Vercel** (web), **Railway** (API + worker), **Supabase** (Postgres), **Upstash** (Redis)

---

## Proje Yapısı (repoya göre güncel)

> Not: Compose’ta frontend için ayrı `Dockerfile` yok; **`node:20-bookworm-slim`** imajı + volume kullanılıyor. `next.config.mjs` kullanılıyor (`.ts` değil).

```
vivindis/
├── .cursorrules
├── .env.example
├── docker-compose.yml
├── VIVINDIS_SPEC.md
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── app/
│       ├── main.py                 ✅ mevcut
│       ├── api/
│       │   ├── deps.py           ✅ Oturum 3
│       │   └── v1/               ✅ Oturum 3 (auth, apps, reviews, analysis, router)
│       ├── core/
│       │   ├── config.py         ✅ Oturum 2–3
│       │   ├── celery.py         ✅ kuyruk yönlendirme + task include
│       │   ├── security.py       ✅ Oturum 3
│       │   └── logging.py        ✅ Oturum 3
│       ├── db/
│       │   ├── session.py        ✅ Oturum 2
│       │   └── …                 (Alembic: `backend/alembic/`, `backend/alembic.ini`)
│       ├── models/               ✅ Oturum 2
│       ├── schemas/              ✅ Oturum 3
│       ├── workers/              ✅ Oturum 4 (scraper, heuristic, ai)
│       └── services/             ✅ gemini batch/merge
│
└── frontend/
    ├── next.config.mjs           ✅ `next-intl` plugin
    ├── tailwind.config.ts
    ├── components.json
    └── src/
        ├── middleware.ts         ✅ Clerk + next-intl
        ├── i18n/                 ✅ routing, request
        ├── messages/             ✅ tr, en, de, … (12 dil)
        ├── app/
        │   ├── layout.tsx        ✅ kök html + provider’lar
        │   └── [locale]/
        │       ├── layout.tsx    ✅ NextIntlClientProvider
        │       ├── page.tsx      ✅ açılış
        │       ├── (auth)/       ✅ sign-in / sign-up (Clerk)
        │       └── (dashboard)/ ✅ shell (mobil drawer), Sidebar, Header; `apps`, `apps/new`, `apps/[id]`, `apps/[id]/analysis`, `dashboard`, `compare`
        ├── components/
        │   ├── ui/               ✅ shadcn (+ Input, Label, SelectNative)
        │   ├── providers/        ✅ Query, Clerk koşullu
        │   ├── layout/           ✅ shell-client, sidebar, header, mobile-nav, language-switcher
        │   ├── apps/             ✅ liste, kart, formlar, detay
        │   ├── analysis/       ✅ grafikler + polling sayfası
        │   ├── dashboard/        ✅ panel özeti
        │   └── i18n/             ✅ `LocaleHtmlAttributes` (lang/dir)
        ├── lib/
        │   ├── api.ts            ✅ Bearer `getToken`
        │   ├── query-keys.ts     ✅ TanStack Query anahtarları
        │   └── utils.ts          ✅
        ├── schemas/              ✅ Zod (app / fetch)
        ├── types/                ✅ API DTO tipleri
        ├── hooks/                ⏳ (isteğe bağlı soyutlama)
        └── …                     ⏳ store/types ihtiyaç halinde
```

---

## Veritabanı Modelleri (Oturum 2)

### User

- `id`: UUID (PK)  
- `clerk_id`: str, **unique**  
- `email`: str, **unique**  
- `plan`: enum — `free`, `pro`, `enterprise`  
- `created_at`, `updated_at`: datetime  

### App

- `id`: UUID (PK)  
- `user_id`: UUID (FK → users)  
- `platform`: enum — `google_play`, `app_store`, `both`  
- `package_name`: str  
- `bundle_id`: str, nullable (iOS)  
- `name`: str  
- `icon_url`, `developer`, `category`: nullable str  
- `is_active`: bool, default True  
- `created_at`, `updated_at`: datetime  

### ReviewFetch

- `id`: UUID (PK)  
- `app_id`: UUID (FK → apps)  
- `status`: enum — `pending`, `running`, `completed`, `failed`  
- `from_date`, `to_date`: date  
- `review_count`: int, default 0  
- `error_message`: str, nullable  
- `started_at`, `completed_at`: datetime, nullable  
- `created_at`: datetime  

### Review

- `id`: UUID (PK)  
- `app_id`: UUID (FK → apps)  
- `fetch_id`: UUID (FK → review_fetches)  
- `store_review_id`: str — **platform başına unique** (composite unique: `platform` + `store_review_id`)  
- `platform`: enum  
- `rating`: int (1–5)  
- `title`: str, nullable  
- `body`: text  
- `author`: str, nullable  
- `lang`: str (ISO 639-1)  
- `date`: date  
- `thumbs_up`: int, default 0  
- `developer_reply`: text, nullable  
- `reply_date`: date, nullable  
- `created_at`: datetime  

### Analysis

- `id`: UUID (PK)  
- `app_id`: UUID (FK → apps)  
- `fetch_id`: UUID (FK → review_fetches)  
- `type`: enum — `heuristic`, `ai`  
- `status`: enum — `pending`, `running`, `completed`, `failed`  
- `result`: JSONB, nullable  
- `model_used`: str, nullable  
- `tokens_used`: int, nullable  
- `error_message`: str, nullable  
- `created_at`: datetime  
- `completed_at`: datetime, nullable  

---

## API Endpoints (hedef — Oturum 3)

Prefix: **`/api/v1`**

### Auth

```
POST /api/v1/auth/sync    # Clerk webhook
GET  /api/v1/auth/me      # Mevcut kullanıcı
```

### Apps

```
GET    /api/v1/apps
POST   /api/v1/apps
GET    /api/v1/apps/{id}
PUT    /api/v1/apps/{id}
DELETE /api/v1/apps/{id}
```

### Reviews / fetch

```
POST /api/v1/apps/{id}/fetch
POST /api/v1/apps/{id}/import-reviews   # dosya / yapıştırma: tamamlanmış fetch + yorum satırları (worker yok)
GET  /api/v1/apps/{id}/fetches
GET  /api/v1/fetches/{id}
GET  /api/v1/apps/{id}/reviews
```

### Analysis

```
POST /api/v1/fetches/{id}/analyze
GET  /api/v1/apps/{id}/analyses
GET  /api/v1/analyses/{id}
```

---

## Analysis Result JSON Şeması (AI / birleşik sonuç hedefi)

```json
{
  "overall_score": 7.4,
  "sentiment": {
    "positive": 0.62,
    "neutral": 0.18,
    "negative": 0.20
  },
  "rating_distribution": {
    "1": 45,
    "2": 23,
    "3": 67,
    "4": 134,
    "5": 289
  },
  "top_topics": [
    { "topic": "performance", "count": 234, "sentiment": "negative" }
  ],
  "top_issues": [
    { "issue": "app crashes on startup", "count": 67, "severity": "high" }
  ],
  "highlights": [
    { "type": "positive", "text": "...", "review_id": "uuid" }
  ],
  "recommendations": ["..."],
  "lang_distribution": { "tr": 0.45, "en": 0.35, "de": 0.20 }
}
```

---

## Ortam Değişkenleri

`.env.example` dosyasındaki anahtarlar boş bırakılır; değerler dağıtım ortamında doldurulur.

Örnek isimler:

```bash
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/vivindis
REDIS_URL=redis://redis:6379/0
SECRET_KEY=
ALGORITHM=
ACCESS_TOKEN_EXPIRE_MINUTES=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=
GROQ_API_KEY=
OPENAI_API_KEY=
CORS_ORIGINS=
ENVIRONMENT=
LOG_LEVEL=

# Celery (broker/result genelde REDIS ile aynı aile)
CELERY_BROKER_URL=
CELERY_RESULT_BACKEND=

# Frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Celery Kuyrukları ve Akış (Oturum 4)

```
scraper  → ReviewFetchTask
analysis → HeuristicTask
analysis → AIAnalysisTask
```

Akış: fetch başlar → **ReviewFetchTask** → tamamlanınca **HeuristicTask** + **AIAnalysisTask** tetiklenir. Frontend fetch süresince yaklaşık **3 saniyede bir** `GET /api/v1/fetches/{id}` ile polling; status **`completed`** olunca analiz sonuç ekranına geçiş.

---

## Heuristic Analiz (Oturum 4)

- Rating dağılımı  
- Sentiment: TR + EN pozitif/negatif kelime listesi  
- Keyword frequency: ilk iterasyonda basit sayım / Counter; ileride TF-IDF  
- Dil tespiti: **langdetect** (veya eşdeğer, env’den konfigüre)  
- Rating trendi: `from_date` → `to_date`  
- Geliştirici yanıt oranı: `developer_reply` doluluk yüzdesi  

## AI Analiz (Oturum 4)

- Model: **gemini-1.5-flash** (env ile override edilebilir)  
- Review’ları **50’lik batch**’lere böl  
- `response_mime_type: application/json` (veya güncel API eşdeğeri)  
- Batch sonuçlarını birleştir  
- **Max 3 retry**; hata durumunda `failed` + mesaj  
- Sonuç **Analysis** tablosuna yazılır  

---

## Erişim Noktaları (Local / Compose varsayılanı)

| Adres | Servis |
|--------|--------|
| http://localhost:3000 | Next.js |
| http://localhost:8001/docs | FastAPI Swagger |
| http://localhost:5555 | Flower |
| localhost:5433 | PostgreSQL (host → konteyner 5432) |
| localhost:6379 | Redis |

---

## Deploy Planı (hazır olduğunda)

- **vivindis.com** → Vercel (Next.js)  
- **api.vivindis.com** → Railway (FastAPI + Celery)  
- **DB** → Supabase  
- **Redis** → Upstash  

---

## Yardımcı Komutlar

```bash
docker compose up
docker compose up backend worker
docker compose exec backend alembic revision --autogenerate -m "add_users_table"
docker compose exec backend alembic upgrade head
docker compose logs -f worker
docker compose down -v
```

---

## Oturum Promptları (Cursor’a kopyala-yapıştır)

### Oturum 2 — Veritabanı Katmanı

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 2: Veritabanı katmanını yaz.

Yapılacaklar (sırayla):
1. app/db/session.py — async SQLAlchemy engine ve session factory
   - DATABASE_URL env'den (asyncpg)
   - get_async_session dependency olarak export

2. app/models/base.py — ortak taban (UUID PK, created_at, updated_at uygunsa)

3. Modeller: user, app, review_fetch, review, analysis — bu dosyadaki şema ile birebir
   - SQLAlchemy 2.0: Mapped[], mapped_column()
   - Enum'lar Python enum.Enum
   - İlişkiler relationship()

4. app/models/__init__.py — tüm modelleri import et (Alembic metadata için)

5. Alembic: async env.py, target_metadata = Base.metadata, DATABASE_URL env'den

6. İlk migration: alembic revision --autogenerate -m "initial_schema"

7. app/core/config.py — eksik env alanlarını tamamla

Kurallar: SQLAlchemy 2.0 async; Pydantic v2; UUID server-side uuid4; migration'ı şema ile tutarlı tut.
```

### Oturum 3 — Backend API

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 3: REST API katmanını yaz.

1. app/schemas/ — Pydantic v2 (Base, Create, Update, Response), ConfigDict(from_attributes=True)
2. app/core/security.py — JWT (python-jose) veya Clerk doğrulama stratejisi şartnameyle uyumlu
3. app/api/deps.py — get_db, get_current_user
4. app/api/v1/auth.py, apps.py, reviews.py, analysis.py — bu dosyadaki endpoint listesi
5. app/main.py — prefix /api/v1, router include

Her endpoint: doğru HTTP kodları, HTTPException, kullanıcı yalnızca kendi verisi, response şeması.
```

### Oturum 4 — Celery Workers

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 4: Celery task'larını yaz.

1. app/core/celery.py — include: workers.scraper, workers.heuristic, workers.ai
2. workers/scraper.py — ReviewFetchTask (Play + App Store scraper, idempotent review insert, status, retry, rate limit)
3. workers/heuristic.py — HeuristicTask → Analysis type=heuristic
4. workers/ai.py — AIAnalysisTask → Gemini batch, merge, retry → Analysis type=ai

Kuyruk: scraper → 'scraper'; analiz → 'analysis'.
```

### Oturum 5 — Frontend Auth ve Layout

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 5: @clerk/nextjs 5.7.5 API'si ile Clerk + middleware + (auth) ve (dashboard) layout,
Sidebar/Header, lib/api.ts içinde Bearer token (Clerk session token).
```

### Oturum 6 — Dashboard ve Uygulamalar

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 6: dashboard, apps listesi, apps/new form (rhf+zod), AppCard/AppList, apps/[id] detay ve fetch başlatma.
TanStack Query + skeleton + empty state.
```

### Oturum 7 — Analiz ve Grafikler

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 7: apps/[id]/analysis, Recharts bileşenleri, /fetches/{id} polling ~3s.
```

### Oturum 8 — Polish

```
Bu projeyi inşa ediyorum, bağlam için bu dosyayı oku: VIVINDIS_SPEC.md

Oturum 8: Sonner ile hata UX, empty state'ler, responsive, docker compose tam test, /docs manuel test, README.
```

---

*Bu dosya tek kaynak şartnamedir; çakışmada önce burayı güncelle, sonra kodu hizala.*
