# Vivindis

**Vivindis** — Google Play ve App Store (ve dosya / yapıştırma) kaynaklı kullanıcı yorumlarını analiz eden ürün. **Arayüz: React (Vite) · API: FastAPI · Analiz motoru: Python `vivindis` paketi.** Streamlit kullanılmaz.

**Depo:** [github.com/cemevecen/vivindis](https://github.com/cemevecen/vivindis) · **Alan adı:** [vivindis.com](https://vivindis.com) — üretimde kendi sunucunda Nginx/Caddy arkasında `uvicorn` + statik `frontend/dist` yayınlanır.

---

## Mimari

```text
frontend/          # React + TypeScript (Vite)
backend/app/       # FastAPI — /api/v1/…
vivindis/          # Çekirdek: fetchers, analyzer, i18n, utils (Streamlit yok)
```

| Katman | Görev |
|--------|--------|
| **frontend** | Kullanıcı arayüzü; `/api` istekleri (geliştirmede Vite proxy, üretimde aynı origin veya CORS). |
| **backend** | REST API, dosya yükleme, mağaza arama/çekme, analiz çağrıları. |
| **vivindis** | Heuristik / LLM analizi, mağaza istemcileri, PDF/Excel yardımcıları. |

---

## Yerel geliştirme

**1) Python bağımlılıkları** (repo kökü):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**2) API** (repo kökünden):

```bash
./scripts/run_api.sh
```

Varsayılan: `http://127.0.0.1:8000` — OpenAPI şeması: `http://127.0.0.1:8000/docs`

**3) Web arayüzü**

```bash
cd frontend && npm install && npm run dev
```

Tarayıcı: `http://127.0.0.1:5173` — Vite, `/api` isteklerini 8000 portuna yönlendirir.

Zengin (LLM) analiz için repo kökünde `.env` (bkz. `.env.example`); anahtarlar yalnızca sunucu ortamında tutulur.

---

## Üretim (özet)

1. `cd frontend && npm run build` → `frontend/dist/`.
2. Sunucuda `PYTHONPATH=<repo_kökü> uvicorn backend.app.main:app --host 127.0.0.1 --port 8000` (systemd veya benzeri).
3. İsteğe bağlı: `SERVE_FRONTEND=1` ile FastAPI aynı süreçte `frontend/dist` sunar; çoğu kurulumda Nginx statik dosyayı servis eder, `/api`yi `uvicorn`a vekil eder.
4. **HTTPS:** Let’s Encrypt (Certbot / Caddy).
5. **GoDaddy DNS:** `@` ve `www` için sunucu **A** kaydı veya CDN ters vekili.

---

## API uçları (önek)

| Yöntem | Yol | Açıklama |
|--------|-----|----------|
| GET | `/api/v1/health` | Sağlık kontrolü |
| GET | `/api/v1/i18n/bundle?lang=tr` | Çeviri paketi |
| POST | `/api/v1/reviews/upload` | CSV / XLSX yükleme |
| POST | `/api/v1/reviews/paste` | Yapıştırılmış metin |
| POST | `/api/v1/analyze` | Heuristik veya LLM analizi |
| POST | `/api/v1/apps/search` | Mağaza araması |
| POST | `/api/v1/apps/resolve` | Link / ID çözümleme |
| POST | `/api/v1/apps/fetch-reviews` | Seçilen uygulama yorumlarını çekme |

Dil: istek başlığı **`X-App-Lang: tr`** veya sorgu **`?lang=en`**.

---

## Depo yapısı

```text
backend/app/main.py       # FastAPI giriş
backend/app/routers/      # health, i18n, reviews, analyze, apps
frontend/src/             # React uygulaması
vivindis/config/          # i18n (contextvars), settings
vivindis/core/            # analyzer, LLM sağlayıcıları
vivindis/fetchers/        # Play, App Store, dosya, yapıştırma
vivindis/utils/           # CSV/Excel/PDF, doğrulama
scripts/run_api.sh        # Yerel API başlatıcı
```

---

## Gizlilik

API anahtarlarını repoya koymayın. **Hızlı (heuristic)** modda yorum metni dışarı gönderilmez; **zengin** modda metin yapılandırdığınız LLM sağlayıcısına gider.

---

## English

Ingest Play/App Store reviews (or file/paste), classify sentiment, export CSV/Excel/PDF. **No Streamlit** — SPA + FastAPI + shared Python library.
