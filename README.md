# Vivindis

Google Play ve App Store yorumlarını toplayıp duygu analizi yapan ürün. **Tek Python paketi** (`vivindis`): çekirdek mantık + **`vivindis.web`** HTTP API (FastAPI). **Arayüz:** `frontend/` (React + Vite).

---

## Hızlı başlangıç (yerel)

```bash
git clone https://github.com/cemevecen/vivindis.git && cd vivindis
./scripts/bootstrap.sh    # venv + pip install -e ".[api]" + npm ci
./scripts/dev.sh          # API :8000 + Vite :5173 (Ctrl+C kapatır)
```

Veya **Make**:

```bash
make install   # install-py + install-js
make dev       # ./scripts/dev.sh ile aynı
```

- Arayüz: [http://127.0.0.1:5173](http://127.0.0.1:5173)  
- API şeması: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Sadece API: `make api` veya `.venv/bin/vivindis-api --reload`

---

## Mimari

| Bölüm | Rol |
|-------|-----|
| **`vivindis/`** | Çekirdek: `config`, `core`, `fetchers`, `utils`, `data`, `branding` |
| **`vivindis/web/`** | `factory.py`, `routers/`, `schemas/`, `services/`, `dependencies.py` — Streamlit yok |
| **`frontend/src/`** | `app/`, `pages/`, `widgets/`, `shared/` — Tailwind + React Router |
| **`frontend/`** | Vite; geliştirmede `/api` → backend proxy |

Bağımlılık: **`pyproject.toml`**. `pip install -e ".[api]"` · `requirements.txt` → `-e .[api]`.

---

## Docker (isteğe bağlı)

```bash
docker compose up --build api
```

API [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). İstersen `docker-compose.yml` içine `GEMINI_API_KEY` vb. `environment` ekleyebilirsin.

---

## Üretim notu

1. `cd frontend && npm run build` → `frontend/dist/`.  
2. `SERVE_FRONTEND=1` ile `vivindis.web.main` statik dosyayı aynı süreçte sunabilir; çoğu kurulumda Nginx/Caddy ile `/` → `dist`, `/api` → uvicorn tercih edilir.  
3. HTTPS: Let’s Encrypt veya barındırıcı sertifikası.

---

## API özeti

| Yöntem | Yol |
|--------|-----|
| GET | `/api/v1/health` |
| GET | `/api/v1/i18n/bundle?lang=tr` |
| POST | `/api/v1/reviews/upload`, `/api/v1/reviews/paste` |
| POST | `/api/v1/analyze` |
| POST | `/api/v1/apps/search`, `/resolve`, `/fetch-reviews` |

Dil: başlık **`X-App-Lang`** veya **`?lang=`**.

---

## Gizlilik

API anahtarlarını repoya koymayın; `.env` (git dışı) veya barındırıcı secret store kullanın.

---

## English

Monorepo: **editable Python package** + **FastAPI** in `vivindis.web` + **Vite/React** frontend. Install with `./scripts/bootstrap.sh` or `make install`, run with `./scripts/dev.sh` or `make dev`.
