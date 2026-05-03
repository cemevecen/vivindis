# Vivindis — Ürün ve Teknik Şartname

Bu projeyi inşa ederken bağlam için **bu dosyayı oku**.

**GitHub:** https://github.com/cemevecen/vivindis

## Proje Tanımı

Vivindis, uygulama geliştiricilerin ve uygulama sahiplerinin Google Play Store ve Apple App Store yorumlarını toplu olarak çekip analiz ettiği bir SaaS platformdur.

### Temel iş akışı

1. Kullanıcı hesap açar (Clerk ile)
2. Analiz etmek istediği uygulamayı ekler (package name, arama kelimesi veya App Store URL)
3. Tarih aralığı seçer
4. Sistem yorumları çeker (Celery worker)
5. Hem heuristic (anlık, ücretsiz) hem AI (Gemini, GROQ, OpenAI) analizi yapılır
6. Kullanıcı dashboard'da sonuçları görür: sentiment, konular, sorunlar, trend, puanlar

## Kesin Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 14+ App Router + TypeScript **strict** |
| UI | shadcn/ui + Tailwind CSS |
| Grafikler | Recharts |
| Auth | Clerk |
| State (server) | TanStack Query v5 |
| State (client) | Zustand |
| Form | react-hook-form + Zod |
| Toast | Sonner |
| Backend | FastAPI + Python 3.12 |
| Validation | Pydantic v2 |
| ORM | SQLAlchemy 2.0 **async** |
| Migration | Alembic |
| Queue | Celery 5.x |
| Message Broker | Redis (Upstash production, local Redis dev) |
| Veritabanı | PostgreSQL (Supabase production, local Docker dev) |
| AI | Google Gemini API (gemini-1.5-flash) |
| Scraping | google-play-scraper + app-store-scraper (Python) |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |
| Container | Docker + Docker Compose |

## Oturum Planı (Cursor)

- **Oturum 1** — Monorepo, docker-compose, .env.example, backend pyproject, Next.js + shadcn iskeleti (iş mantığı yok)
- **Oturum 2** — DB katmanı: config, async session, models, Alembic
- **Oturum 3** — FastAPI API: schemas, deps, routers, main
- **Oturum 4** — Celery workers: scraper, heuristic, AI, retry/rate limit
- **Oturum 5** — Clerk, layout, lib/api.ts
- **Oturum 6** — Dashboard, apps listesi, formlar
- **Oturum 7** — Analiz sayfası, Recharts, polling
- **Oturum 8** — Polish, toast, empty states, responsive, test

## Cursor — Dikkat Edilecek Hatalar

### Backend

- SQLAlchemy **1.x** değil — **2.0 async** (`async with session`)
- Pydantic **v1** değil — **v2** (`model_config = ConfigDict(...)`)
- `from_orm()` yok — **`model_validate()`**
- Celery task içinde gerektiğinde **`asyncio.run()`** (sync task varsayılan)

### Frontend

- `pages/` router yok — **`app/`** App Router
- `useEffect` ile ham fetch yok — **TanStack Query**
- Gereksiz **`use client`** yok
- Ham `fetch` dağınık yok — **`src/lib/api.ts`** (veya belirlenen tek modül)

## Domain ve Portlar (Local)

| Adres | Servis |
|--------|--------|
| localhost:3000 | Next.js |
| localhost:8000 | FastAPI (`/docs`) |
| localhost:5555 | Flower |
| localhost:5432 | PostgreSQL |
| localhost:6379 | Redis |

## Production

- vivindis.com → Vercel (Next.js)
- api.vivindis.com → Railway (FastAPI + Celery)
- DB → Supabase
- Redis → Upstash

## Gelecek Özellikler (Mimariye Hazır)

Karşılaştırma, rakip takibi, haftalık PDF rapor, embed widget, kullanıcı API key, React Native (Expo), çoklu dil (TR, EN, DE, IT, JA, ZH-CN, PT, FR), webhook.
