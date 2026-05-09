# Vivindis

SaaS: Google Play ve Apple App Store yorumlarını toplama, **heuristic** ve **AI (Gemini)** ile analiz; uygulama sahipleri ve geliştiriciler için dashboard.

**Bağlam:** [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md)  
**Kurallar:** [.cursorrules](./.cursorrules)  
**Repo:** https://github.com/cemevecen/vivindis

## Vivindis — product overview (10 languages)

Quick navigation (anchor links):

- [English](#readme-en)
- [中文（简体）](#readme-zh)
- [Español](#readme-es)
- [Français](#readme-fr)
- [العربية](#readme-ar)
- [Português](#readme-pt)
- [Русский](#readme-ru)
- [Deutsch](#readme-de)
- [日本語](#readme-ja)
- [Türkçe](#readme-tr)

*The web app offers additional locales (e.g. Italian, Kiswahili); use the in-app language selector.*

<a id="readme-en"></a>

### English

- **Purpose:** Vivindis helps teams pull **Google Play** and **Apple App Store** reviews and turn them into actionable insight—not raw spreadsheets.
- **Workflow:** Authenticated users register apps, choose date ranges, search stores or import files/text, and can line up **two apps for comparison** when benchmarking.
- **Analysis:** Fast **heuristic** summaries plus optional **AI-assisted** analysis; results appear in structured dashboards with charts.
- **Exports:** JSON, CSV, Excel, and a **printable report** from the analytics experience (browser print / PDF-style output).
- **Internationalization:** **Multiple UI languages**; switch from the header without reloading your workflow.
- **High-volume policy:** Depending on deployment settings, **very large review pulls** may wait in a **pending approval** state until an operator confirms—protecting infrastructure while keeping normal imports fast.
- **Security:** API keys and secrets belong **only** in hosting **environment variables** (e.g. Vercel / Railway); they must **never** be committed to git.

<a id="readme-zh"></a>

### 中文（简体）

- **定位：** Vivindis 面向团队集中获取 **Google Play** 与 **Apple App Store** 的用户评论，并将结果转化为可执行的洞察。
- **流程：** 登录后为应用配置日期范围，支持商店检索或文件/文本导入；需要对标时可并排准备 **两个应用**。
- **分析：** 快速的 **启发式** 摘要与可选的 **AI 辅助** 分析；结果以结构化仪表盘与图表呈现。
- **导出：** 支持 JSON、CSV、Excel，以及分析页的 **可打印报告**（浏览器打印 / PDF 类输出）。
- **国际化：** **多语言界面**，可在页眉切换语言。
- **大体量策略：** 视部署配置而定，**超大样本拉取** 可能进入 **待审批** 状态，由运维确认后再执行，以在性能与可用性之间取得平衡。
- **安全：** API 密钥与敏感配置 **仅** 存放在托管平台的 **环境变量** 中，**切勿** 写入仓库。

<a id="readme-es"></a>

### Español

- **Propósito:** Vivindis permite reunir reseñas de **Google Play** y **Apple App Store** y convertirlas en información útil para equipos de producto.
- **Flujo:** Tras iniciar sesión se registran apps, rangos de fechas, búsqueda en tiendas o importación por archivo/texto; opción de preparar **dos aplicaciones** para comparar.
- **Análisis:** Resúmenes **heurísticos** rápidos y análisis opcional **asistido por IA**; tableros estructurados con gráficos.
- **Exportación:** JSON, CSV, Excel e **informe imprimible** desde la vista de analítica.
- **Internacionalización:** **Varios idiomas** en la interfaz; cambio desde la cabecera.
- **Grandes volúmenes:** Según la configuración del entorno, las extracciones **muy grandes** pueden quedar **pendientes de aprobación** operativa antes de ejecutarse.
- **Seguridad:** Credenciales solo en **variables de entorno** del proveedor de hosting; **nunca** en el repositorio.

<a id="readme-fr"></a>

### Français

- **Mission:** Vivindis agrège les avis **Google Play** et **App Store** pour les transformer en insights exploitables par les équipes produit.
- **Parcours:** Compte requis ; enregistrement des apps, plages de dates, recherche magasin ou import fichier/texte ; **comparaison de deux apps** possible.
- **Analyses:** Synthèses **heuristiques** et option d’analyse **assistée par IA** ; tableaux de bord structurés.
- **Exports:** JSON, CSV, Excel et **rapport imprimable** depuis l’espace analytique.
- **i18n:** **Plusieurs langues** d’interface, sélecteur dans l’en-tête.
- **Gros volumes:** Selon le déploiement, les extractions **très importantes** peuvent être **mises en attente** jusqu’à validation opérationnelle.
- **Sécurité:** Secrets uniquement dans les **variables d’environnement** ; **pas** dans Git.

<a id="readme-ar"></a>

### العربية

- **الفكرة:** فيفينديس يجمع مراجعات **Google Play** و**App Store** ويحوّلها إلى معلومات يمكن للفرق العمل بها.
- **التدفق:** بعد تسجيل الدخول تُضاف التطبيقات وتُحدَّد الفترات، مع بحث في المتجر أو استيراد ملف/نص؛ ويمكن تجهيز **تطبيقين** للمقارنة.
- **التحليل:** ملخصات **إرشادية** سريعة وتحليل **مدعوم بالذكاء الاصطناعي** اختياري؛ لوحات ورسوم بيانية.
- **التصدير:** JSON وCSV وExcel وتقرير **قابل للطباعة** من صفحة التحليلات.
- **تعدد اللغات:** واجهة بعدة لغات؛ التبديل من رأس الصفحة.
- **الأحجام الكبيرة:** حسب إعدادات النشر، قد تبقى عمليات السحب **الضخمة جداً** في حالة **انتظار موافقة** تشغيلية.
- **الأمان:** المفاتيح والأسرار **فقط** في **متغيرات البيئة** على منصة الاستضافة؛ **لا** تُرفع إلى المستودع.

<a id="readme-pt"></a>

### Português

- **Objetivo:** A Vivindis reúne avaliações da **Google Play** e da **App Store** para insights acionáveis por times de produto.
- **Fluxo:** Utilizador autenticado regista apps, intervalos de datas, pesquisa na loja ou importação por ficheiro/texto; opção de **duas apps** para comparar.
- **Análise:** Resumos **heurísticos** e análise opcional **assistida por IA**; dashboards com gráficos.
- **Exportação:** JSON, CSV, Excel e **relatório imprimível** a partir da área de analytics.
- **Idiomas:** **Vários idiomas** na UI; seletor no cabeçalho.
- **Grandes volumes:** Conforme a política implantada, extrações **muito grandes** podem ficar **pendentes de aprovação** antes de correrem.
- **Segurança:** Credenciais apenas em **variáveis de ambiente** no hosting; **nunca** no Git.

<a id="readme-ru"></a>

### Русский

- **Задача:** Vivindis собирает отзывы **Google Play** и **App Store** и превращает их в понятные метрики для команд.
- **Сценарий:** После входа добавляются приложения и диапазоны дат, поиск в магазине или импорт файла/текста; можно подготовить **два приложения** для сравнения.
- **Анализ:** Быстрые **эвристические** сводки и опциональный анализ с **ИИ**; структурированные дашборды.
- **Экспорт:** JSON, CSV, Excel и **печатный отчёт** из раздела аналитики.
- **Локализация:** **Несколько языков** интерфейса; переключатель в шапке.
- **Большие объёмы:** В зависимости от настроек среды очень крупные выгрузки могут ожидать **подтверждения оператором**.
- **Безопасность:** Секреты только в **переменных окружения** на хостинге; **не** коммитить в репозиторий.

<a id="readme-de"></a>

### Deutsch

- **Nutzen:** Vivindis bündelt **Google Play**- und **App Store**-Rezensionen und macht sie für Produktteams auswertbar.
- **Ablauf:** Nach Anmeldung Apps und Zeiträume, Storesuche oder Datei-/Textimport; optional **zwei Apps** für den Vergleich vorbereiten.
- **Analyse:** Schnelle **heuristische** Übersichten plus optionale **KI-unterstützte** Auswertung; strukturierte Dashboards.
- **Export:** JSON, CSV, Excel und **druckfertiger Bericht** aus der Analyseansicht.
- **Sprachen:** **Mehrsprachige Oberfläche**; Umschalter im Header.
- **Große Mengen:** Je nach Deployment können **sehr große** Abrufe eine **Freigabe** durch den Betrieb erfordern.
- **Sicherheit:** Schlüssel ausschließlich in **Umgebungsvariablen** der Hosting-Plattform; **nicht** ins Repository.

<a id="readme-ja"></a>

### 日本語

- **概要:** Vivindis は **Google Play** と **App Store** のレビューを集約し、プロダクトチームが活用できる示唆へ変換します。
- **操作:** サインイン後にアプリ・期間を設定し、ストア検索やファイル／テキスト取り込みが可能。**2 アプリ比較**の流れにも対応。
- **分析:** 高速な **ヒューリスティック** 要約とオプションの **AI 支援** 分析。チャート付きダッシュボードで表示。
- **書き出し:** JSON・CSV・Excel、および分析画面からの **印刷可能レポート**。
- **多言語:** UI は **複数言語**；ヘッダーから切り替え。
- **大量取得:** 環境設定により、**極めて大規模な** 取得は運用承認（**保留**）となる場合があります。
- **セキュリティ:** 認証情報はホスティングの **環境変数のみ**。**Git に含めないこと。**

<a id="readme-tr"></a>

### Türkçe

- **Odak:** Vivindis, **Google Play** ve **Apple App Store** yorumlarını toplayıp ürün ekipleri için anlamlı içgörülere dönüştürür.
- **Akış:** Oturum açıldıktan sonra uygulama ve tarih aralığı seçilir; mağaza araması veya dosya/metin içe aktarma kullanılır; gerektiğinde **iki uygulama** karşılaştırmaya hazırlanır.
- **Analiz:** Hızlı **heuristik** özetler ve isteğe bağlı **AI destekli** analiz; grafiklerle yapılandırılmış paneller.
- **Dışa aktarma:** JSON, CSV, Excel ve analitik ekrandan **yazdırılabilir rapor**.
- **Çok dillilik:** Arayüz **birden fazla dilde**; üst menüden dil değiştirilir.
- **Yüksek hacim:** Kurulum politikasına bağlı olarak **çok büyük** çekimler, altyapıyı korumak için **onay bekleyen** durumda tutulabilir.
- **Güvenlik:** Anahtarlar ve sırlar **yalnızca** barındırma ortamındaki **environment variable**’larda tutulur; **repoya yazılmaz.**

---

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
- Analiz merkezi: mağaza kataloğu **`/tr/analyze/store`**, pazaryeri **`/tr/analyze/marketplace`**; dosya/metin/karşılaştırma **`/tr/analyze?mode=file|text|compare`** (eski `/tr/analyze` mağaza için sunucuda `/tr/analyze/store` yönlendirmesi)  
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
4. **Settings → Build & Development → Output Directory:** **boş bırakın.**  
   Yanlışlıkla `public` veya `.next` yazılırsa build biter ama deploy **“No Output Directory named public”** ile düşer; Next çıktısı Vercel tarafından yönetilir.  
5. **Environment Variables (Production)** örnekleri:  
   - `NEXT_PUBLIC_API_URL` — canlı API **kökü** (`https://api…`, `/api/v1` **yok**)  
   - **veya** (CORS’u baypas): `BACKEND_ORIGIN` aynı kök + `NEXT_PUBLIC_API_URL` boş → site üzerinden `/api/v1` proxy  
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`  
   - İsteğe bağlı: `NEXT_PUBLIC_APP_URL` — kendi sitenizin kök URL’si  

`frontend/vercel.json` framework’ü **nextjs** olarak sabitler; monorepo için asıl ayar yine **Root Directory = `frontend`** ve env değişkenleridir.

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

### Canlı tutma (Railway + Vercel)

- **Vercel:** Production branch = `main`, Root Directory = `frontend`, Output Directory boş, `main` push’ta otomatik deploy açık olsun.  
- **Railway:** Aynı repo + `main`, Dockerfile build; backend veya `railway.json` / `backend/Dockerfile` değişince API servisi yeniden deploy edilsin.  
- **Yeni endpoint’ler:** Örn. `GET /api/v1/store/search` — deploy sonrası [OpenAPI](https://api.vivindis.com/docs) içinde görünmeli; yanıt **404** ise genelde **eski imaj** veya yanlış DNS.  
- **Otomatik kontrol:** GitHub’da **Actions → Production smoke** (`main` push, günlük cron, elle tetikleme) — `/health`, `/openapi.json`, store route’un **404 olmaması**. Ayrıntı: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

Ayrıntılı oturum geçmişi, API listesi ve kod kuralları için [VIVINDIS_SPEC.md](./VIVINDIS_SPEC.md).
