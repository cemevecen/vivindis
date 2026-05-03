# Vivindis

**Vivindis** — Google Play ve App Store (ve dosya / yapıştırma) kaynaklı kullanıcı yorumlarını toplayıp **olumlu / olumsuz / istek–nötr** üçlü sınıflandırma, özet göstergeler ve dışa aktarma ile sunan bir **[Streamlit](https://streamlit.io/)** uygulamasıdır.

**Depo:** [github.com/cemevecen/vivindis](https://github.com/cemevecen/vivindis) · **Alan adı:** [vivindis.com](https://vivindis.com) (DNS ve barındırıcıyı aşağıdaki adımlarla bağlayın)

**English:** A Streamlit app that ingests mobile-store (or file / pasted) reviews, classifies sentiment into three buckets, shows a compact dashboard with charts and sample cards, supports **side-by-side app comparison**, and exports **CSV, Excel, and PDF**. **Fast** mode runs with local heuristics; optional **rich** mode uses your configured LLM provider.

---

## Bu proje ne yapar?

| Adım | Açıklama |
|------|-----------|
| **1. Veri** | **Mağaza:** arama veya mağaza linki / paket adı / ID; tarih aralığı; **yerel** (Türkiye vitrini) veya **global** (çok ülke) yorum kapsamı. **Dosya:** CSV / Excel. **Metin:** panodan yapıştırma (CSV/TSV algısı). **Karşılaştır:** iki uygulama seçimi + ortak tarih aralığı ile havuz hazırlama. |
| **2. Analiz** | **Hızlı (heuristic):** kural + sözlük; ek API gerekmez. **Zengin (LLM):** `.env` / barındırıcı secrets ile tanımlanan anahtarlarla isteğe bağlı model çağrısı. |
| **3. Sunum** | Metrikler, dağılımlar, trend, örnek yorum kartları; karşılaştırma özeti. |
| **4. Dışa aktarma** | CSV, Excel; ekrana yakın düzenle **PDF**. |

Kapsam tüketici mağaza yorumlarıdır; genel amaçlı metin analizi aracı değildir.

---

## Depolama ve trafik (karar vermen için özet)

Bu sürümde **son kullanıcı hesabı veya merkezi bir ürün veritabanı yok**; veri çoğunlukla **oturum belleğinde** yaşar (Streamlit `session_state`). Bu, barındırma maliyetini basitleştirir ama **oturumlar sunucu yeniden başlatınca sıfırlanır**; kalıcı arşiv için ileride ayrı bir backend + veritabanı eklemen gerekir.

| Konu | Pratik etki |
|------|-------------|
| **Disk (uygulama)** | Python paketi + statik sözlük (`vivindis/data/heuristic_lexicon.json`) birkaç MB mertebesinde. `vivindis/branding/branding.db` logo/favicon için küçük SQLite; repoda tutulmaz (`.gitignore`). |
| **Yüklenen dosyalar** | CSV/XLSX boyutu Streamlit `server.maxUploadSize` ile sınırlı (ör. 200 MB üst sınır tipik). |
| **Trafik (son kullanıcı)** | Her ziyaretçi için sayfa varlıkları + WebSocket; büyük kısım metin ve grafik. |
| **Trafik (sunucu çıkışı)** | Mağazadan yorum çekme: Google Play / Apple tarafına giden HTTP istekleri sunucunun IP’sinden gider. **Zengin analiz:** yorum metni seçtiğin LLM API’sine gider; bant genişliğine ek olarak **token maliyeti** oluşur. |

**Düşük–orta trafik + hızlı yayın:** [Streamlit Community Cloud](https://streamlit.io/cloud) ücretsiz katmanı genelde yeterli başlangıç noktasıdır; sınırlar ve uyku modu için resmi dokümantasyona bak.

**vivindis.com’u bağlama:** GoDaddy’de alan adını aldın; uygulama **GoDaddy’de değil**, seçtiğin barındırıcının verdiği adreslere **DNS kaydı** ile işaret edilir. Streamlit Cloud kullanıyorsan uygulama ayarlarından **Custom domain** akışını açıp GoDaddy DNS’e istenen **CNAME** (veya talimatlara göre **A**) kaydını eklersin. Barındırıcı değişirse yalnız DNS’i güncellersin.

**Daha fazla kontrol / sürekli trafik:** Railway, Render, Fly.io veya küçük bir VPS üzerinde `streamlit run` (veya ters vekil + süreç yöneticisi) ile çalıştırılabilir; o zaman CPU/RAM ve çıkış bantını planlaman gerekir.

---

## Kimler kullanır?

Ürün, geliştirme veya destek ekipleri: sürüm sonrası tepki, yıldız dağılımı ve yorum metnindeki duygu tonunu tek ekranda görmek isteyenler.

---

## Diller ve arayüz

- Arayüz metinleri **çok dillidir**; varsayılan **Türkçe** (`tr`).
- Desteklenen dil kodları: **tr, en, es, de, fr, ar, zh, ru, pt, ja** (Japonca metinler `vivindis/config/i18n_ja.json` üzerinden birleştirilir).
- Dil, masthead’deki **bayrak / dil menüsü** ile seçilir; oturumda saklanır ve isteğe bağlı olarak **`?lang=ru`** gibi sorgu parametresiyle paylaşılabilir.
- Tarih aralığı seçimi ve yerel/global kapsam gibi kontroller **dil değişince** otomatik olarak seçilen dildeki etiketlerle güncellenir (oturum değerleri dil-nötr kodlarla tutulur).

---

## Gizlilik ve güvenlik (özet)

- **Depoya gerçek API anahtarı veya kişisel veri koymayın.** `.env.example` yalnızca *değişken adları* için şablondur; değerleri yerelde veya barındırıcı **Secrets** alanında tutun.
- **Hızlı analiz:** Yorum metni uygulamanın çalıştığı ortamda işlenir; zengin mod yapılandırılmadıkça harici modele gönderilmez.
- **Zengin analiz:** Metin, tanımladığınız sağlayıcının koşullarına tabi şekilde ilgili API’ye gider. Kurum politikanızı ve sağlayıcı şartlarını gözden geçirin.
- Mağaza araması ve çekme, herkese açık mağaza arayüzüne benzer isteklerle yapılır; bu belgede token veya hesap bilgisi yoktur.

---

## Gereksinimler ve çalıştırma

- **Python:** 3.10 veya üzeri önerilir.
- **Bağımlılıklar:** `requirements.txt` (ör. `streamlit>=1.40`, `pandas`, `plotly`, `fpdf2`, …).

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Zengin analiz denemek için proje kökünde `.env` oluşturun; değişken isimleri için `.env.example` dosyasına bakın. **`.env` dosyasını git’e eklemeyin.**

```bash
streamlit run streamlit_app.py
```

İsteğe bağlı yerel betik: `run_local.sh` (ortamınıza göre port / seçenekler).

---

## Dağıtım (özet akış)

1. Bu repoyu GitHub’a gönder (`git remote add origin …`, `git push -u origin main`).
2. [Streamlit Community Cloud](https://share.streamlit.io/) üzerinde **New app** → GitHub’dan bu repo, main branch, giriş dosyası **`streamlit_app.py`**.
3. Cloud **Secrets** içine `.env.example`’daki anahtar adlarıyla (isteğe bağlı) `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` ekle.
4. **Custom domain:** Streamlit uygulama ayarlarından `vivindis.com` / `www.vivindis.com` için yönergeleri izle; GoDaddy DNS yönetiminde gerekli **CNAME** veya **A** kaydını ekle. Yayılım birkaç dakika–48 saat sürebilir.

---

## Sayfa yapısı ve gezinme

- Ana uygulama kök betikte: **`streamlit_app.py`**.
- Üst bant (**masthead**): logo, başlık, **dil seçici**, veri kaynağı **pill**’leri (Mağaza, Dosya, Metin, Uygulama karşılaştır, Hakkında). **Hakkında** içeriği aynı sayfada gövdede açılır (ayrı tam sayfa `~/+/about` akışı yok).
- **`pages/about.py`:** Eski `/about` veya `~/+/about` bağlantıları için ana akışa yönlendirme (yer imi kırılmasın diye).

---

## Depo yapısı

```text
streamlit_app.py              # Giriş: masthead, kaynak sekmeleri, analiz, dışa aktarma
pages/about.py                # Hakkında yönlendirmesi
run_local.sh                  # İsteğe bağlı yerel çalıştırma
requirements.txt
.env.example                  # Yalnız isim şablonu; gizli değer yok
vivindis/                     # Ana Python paketi
  branding/                   # Logo / favicon yardımcıları (+ yerel SQLite, gitignore)
  config/
    settings.py               # Ortam ayarları
    theme.py                  # Streamlit’e enjekte edilen geniş CSS (masthead, mobil, formlar)
    i18n.py                   # Çeviri sözlüğü + get_lang / set_lang / t()
    i18n_ja.json              # Japonca metinler (i18n_ja_overlay ile birleşir)
    i18n_ja_overlay.py
  core/                       # Heuristik, analiz, LLM sağlayıcı soyutlaması
  data/                       # Heuristik sözlük vb.
  fetchers/                   # Play, App Store, dosya, yapıştırma, keşif
  ui/
    masthead.py               # Üst bant + dil popover
    masthead_flags.py         # Bayrak görselleri (flagcdn) için enjekte CSS
    store_link_panel.py       # Mağaza sekmesi (arama, tarih, kapsam, çekme)
    compare_panel.py          # İki uygulama karşılaştırma
    analysis_results_dashboard.py
    review_cards.py
    about_page.py
  utils/                      # CSV/Excel/PDF, doğrulama, mağaza URL’leri
```

---

## Davranış notları

- Yinelenen ve anlamsız yorumlar mümkün olduğunca elenir; uygulama / kaynak değişince ilgili **havuz ve analiz** durumu sıfırlanır ki veri karışmasın.
- Çok büyük havuzlarda zengin mod **partiler** halinde işlenebilir; arayüzde ilerleme ve isteğe bağlı “devam” akışı kullanılır.
- Heuristik sözlük: `vivindis/data/heuristic_lexicon.json` — değişiklikten sonra süreç yeniden başlatılmalıdır.

---

## Katkı / geliştirici

- Yeni kullanıcı metinleri için `vivindis/config/i18n.py` içinde anahtar ekleyin; mümkünse tüm diller için çeviri sağlayın. Japonca için gerekiyorsa `i18n_ja.json` güncellenir.
- Masthead ve form görünümü büyük ölçüde `theme.py` içindeki `APP_CSS` ile yönetilir.

---

## English summary

| Topic | Detail |
|--------|--------|
| **Purpose** | Ingest Play / App Store reviews (or **file** / **paste**), optional **compare two apps**, classify **positive / negative / request–neutral**, dashboard + **CSV, Excel, PDF**. |
| **Modes** | **Fast** — local heuristics, no API keys. **Rich** — optional LLM when you configure provider keys (`.env` or host secrets). |
| **Languages** | UI strings for **tr, en, es, de, fr, ar, zh, ru, pt, ja**; default Turkish; masthead flag picker + optional **`?lang=`** query param. |
| **Privacy** | Do not commit secrets. Rich mode sends review text to your provider under their terms. |
| **Run** | Python 3.10+, `pip install -r requirements.txt`, `streamlit run streamlit_app.py`. |
| **Layout** | Main logic in `streamlit_app.py`; library under `vivindis/`; global styles in `vivindis/config/theme.py`. |
