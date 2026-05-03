"""Hafif i18n katmanı (Streamlit yok).

Dil, `contextvars` ile istek başına tutulur. FastAPI içinde
`with use_ui_lang(code):` veya `set_ui_lang` / `reset_ui_lang` kullanın.

Kullanım:
    from vivindis.config.i18n import t, use_ui_lang
    with use_ui_lang("en"):
        label = t("common.fetch_reviews")

Bir anahtar mevcut dilde tanımlı değilse Türkçe (default) değere düşer; Türkçe
de yoksa `default` argümanı veya anahtarın kendisi döner.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Iterator

_ui_lang_ctx: ContextVar[str | None] = ContextVar("ui_lang", default=None)

LANGUAGES: list[tuple[str, str, str]] = [
    ("tr", "Türkçe", "🇹🇷"),
    ("en", "English", "🇬🇧"),
    ("es", "Español", "🇪🇸"),
    ("de", "Deutsch", "🇩🇪"),
    ("fr", "Français", "🇫🇷"),
    ("ar", "العربية", "🇸🇦"),
    ("zh", "简体中文", "🇨🇳"),
    ("ru", "Русский", "🇷🇺"),
    ("pt", "Português", "🇧🇷"),
    ("ja", "日本語", "🇯🇵"),
]

DEFAULT_LANG = "tr"
_LANG_CODES = {code for code, _, _ in LANGUAGES}

STRINGS: dict[str, dict[str, str]] = {
    # --------- Navigation / masthead ---------
    "source.store": {
        "tr": "Mağaza", "en": "Store", "es": "Tienda", "de": "Shop",
        "fr": "Boutique", "ar": "المتجر", "zh": "商店", "ru": "Магазин", "pt": "Loja",
    },
    "source.file": {
        "tr": "Dosya", "en": "File", "es": "Archivo", "de": "Datei",
        "fr": "Fichier", "ar": "ملف", "zh": "文件", "ru": "Файл", "pt": "Arquivo",
    },
    "source.text": {
        "tr": "Metin", "en": "Text", "es": "Texto", "de": "Text",
        "fr": "Texte", "ar": "نص", "zh": "文本", "ru": "Текст", "pt": "Texto",
    },
    "source.compare": {
        "tr": "Uygulama karşılaştır", "en": "Compare apps", "es": "Comparar apps",
        "de": "Apps vergleichen", "fr": "Comparer les apps", "ar": "مقارنة التطبيقات",
        "zh": "应用对比", "ru": "Сравнить приложения", "pt": "Comparar apps",
    },
    "nav.about": {
        "tr": "hakkında", "en": "about", "es": "acerca de", "de": "über",
        "fr": "à propos", "ar": "حول", "zh": "关于", "ru": "о проекте", "pt": "sobre",
    },
    "nav.home": {
        "tr": "ana sayfa", "en": "home", "es": "inicio", "de": "Startseite",
        "fr": "accueil", "ar": "الرئيسية", "zh": "首页", "ru": "главная", "pt": "início",
    },
    "nav.data_source": {
        "tr": "Veri kaynağı", "en": "Data source", "es": "Fuente de datos",
        "de": "Datenquelle", "fr": "Source de données", "ar": "مصدر البيانات",
        "zh": "数据源", "ru": "Источник данных", "pt": "Fonte de dados",
    },
    "hero.title": {
        "tr": "Vivindis", "en": "Vivindis", "es": "Vivindis", "de": "Vivindis",
        "fr": "Vivindis", "ar": "Vivindis", "zh": "Vivindis", "ru": "Vivindis",
        "pt": "Vivindis", "ja": "Vivindis",
    },
    # --------- Platform + scope toggles ---------
    "platform.label": {
        "tr": "Platform", "en": "Platform", "es": "Plataforma", "de": "Plattform",
        "fr": "Plateforme", "ar": "المنصة", "zh": "平台", "ru": "Платформа", "pt": "Plataforma",
    },
    "scope.label": {
        "tr": "Yorum kaynağı", "en": "Review source", "es": "Fuente de reseñas",
        "de": "Rezensionsquelle", "fr": "Source des avis", "ar": "مصدر المراجعات",
        "zh": "评论来源", "ru": "Источник отзывов", "pt": "Fonte de avaliações",
    },
    "scope.local": {
        "tr": "Yerel", "en": "Local", "es": "Local", "de": "Lokal",
        "fr": "Local", "ar": "محلي", "zh": "本地", "ru": "Локальный", "pt": "Local",
    },
    "scope.global": {
        "tr": "Global", "en": "Global", "es": "Global", "de": "Global",
        "fr": "Global", "ar": "عالمي", "zh": "全球", "ru": "Глобальный", "pt": "Global",
    },
    "scope.help": {
        "tr": "yerel: yalnızca türkiye storefront'u. global: tüm ülkelerden birleşik havuz (varsayılan).",
        "en": "local: turkish storefront only. global: merged pool from all countries (default).",
        "es": "local: solo tienda de turquía. global: pool combinado de todos los países (predeterminado).",
        "de": "lokal: nur türkischer storefront. global: kombinierter pool aller länder (standard).",
        "fr": "local : uniquement la boutique turque. global : pool combiné de tous les pays (par défaut).",
        "ar": "محلي: متجر تركيا فقط. عالمي: تجمع موحد من جميع الدول (افتراضي).",
        "zh": "本地：仅土耳其商店。全球：合并所有国家的评论（默认）。",
        "ru": "локальный: только турецкий сторфронт. глобальный: объединённый пул всех стран (по умолчанию).",
        "pt": "local: apenas loja da turquia. global: pool unificado de todos os países (padrão).",
    },
    # --------- Date range ---------
    "date.range": {
        "tr": "Tarih aralığı", "en": "Date range", "es": "Rango de fechas",
        "de": "Zeitraum", "fr": "Plage de dates", "ar": "النطاق الزمني",
        "zh": "日期范围", "ru": "Период", "pt": "Intervalo de datas",
    },
    "date.placeholder": {
        "tr": "tarih aralığı seç", "en": "select date range", "es": "selecciona el rango",
        "de": "Zeitraum wählen", "fr": "choisir la période", "ar": "اختر النطاق الزمني",
        "zh": "选择日期范围", "ru": "выберите период", "pt": "selecionar intervalo",
    },
    "date.week": {
        "tr": "Son 1 hafta", "en": "Last 7 days", "es": "Última semana",
        "de": "Letzte Woche", "fr": "7 derniers jours", "ar": "آخر ٧ أيام",
        "zh": "最近 1 周", "ru": "За неделю", "pt": "Últimos 7 dias",
    },
    "date.month1": {
        "tr": "Son 1 ay", "en": "Last month", "es": "Último mes",
        "de": "Letzter Monat", "fr": "Dernier mois", "ar": "آخر شهر",
        "zh": "最近 1 个月", "ru": "За месяц", "pt": "Último mês",
    },
    "date.month3": {
        "tr": "Son 3 ay", "en": "Last 3 months", "es": "Últimos 3 meses",
        "de": "Letzte 3 Monate", "fr": "3 derniers mois", "ar": "آخر ٣ أشهر",
        "zh": "最近 3 个月", "ru": "За 3 месяца", "pt": "Últimos 3 meses",
    },
    "date.month6": {
        "tr": "Son 6 ay", "en": "Last 6 months", "es": "Últimos 6 meses",
        "de": "Letzte 6 Monate", "fr": "6 derniers mois", "ar": "آخر ٦ أشهر",
        "zh": "最近 6 个月", "ru": "За 6 месяцев", "pt": "Últimos 6 meses",
    },
    "date.year1": {
        "tr": "Son 1 yıl", "en": "Last year", "es": "Último año",
        "de": "Letztes Jahr", "fr": "Dernière année", "ar": "آخر سنة",
        "zh": "最近 1 年", "ru": "За год", "pt": "Último ano",
    },
    "date.year2": {
        "tr": "Son 2 yıl", "en": "Last 2 years", "es": "Últimos 2 años",
        "de": "Letzte 2 Jahre", "fr": "2 dernières années", "ar": "آخر سنتين",
        "zh": "最近 2 年", "ru": "За 2 года", "pt": "Últimos 2 anos",
    },
    # --------- Common buttons ---------
    "common.fetch_reviews": {
        "tr": "Yorumları çek", "en": "Fetch reviews", "es": "Obtener reseñas",
        "de": "Rezensionen abrufen", "fr": "Récupérer les avis", "ar": "جلب المراجعات",
        "zh": "获取评论", "ru": "Загрузить отзывы", "pt": "Carregar avaliações",
    },
    "common.start_compare": {
        "tr": "Karşılaştırmayı başlat", "en": "Start comparison", "es": "Iniciar comparación",
        "de": "Vergleich starten", "fr": "Démarrer la comparaison", "ar": "بدء المقارنة",
        "zh": "开始比较", "ru": "Начать сравнение", "pt": "Iniciar comparação",
    },
    "common.reset": {
        "tr": "Sıfırla", "en": "Reset", "es": "Reiniciar", "de": "Zurücksetzen",
        "fr": "Réinitialiser", "ar": "إعادة تعيين", "zh": "重置", "ru": "Сбросить", "pt": "Redefinir",
    },
    "common.reset_selection": {
        "tr": "Seçimi sıfırla", "en": "Clear selection", "es": "Limpiar selección",
        "de": "Auswahl zurücksetzen", "fr": "Effacer la sélection", "ar": "مسح الاختيار",
        "zh": "清除选择", "ru": "Сбросить выбор", "pt": "Limpar seleção",
    },
    "common.select": {
        "tr": "Seç", "en": "Select", "es": "Elegir", "de": "Wählen",
        "fr": "Choisir", "ar": "اختر", "zh": "选择", "ru": "Выбрать", "pt": "Selecionar",
    },
    "common.show_more": {
        "tr": "Daha fazla göster", "en": "Show more", "es": "Mostrar más",
        "de": "Mehr anzeigen", "fr": "Voir plus", "ar": "عرض المزيد",
        "zh": "显示更多", "ru": "Показать ещё", "pt": "Mostrar mais",
    },
    "common.clear_results": {
        "tr": "Sonuçları temizle", "en": "Clear results", "es": "Limpiar resultados",
        "de": "Ergebnisse löschen", "fr": "Effacer les résultats", "ar": "مسح النتائج",
        "zh": "清除结果", "ru": "Очистить результаты", "pt": "Limpar resultados",
    },
    "common.show_all": {
        "tr": "Tümünü gör", "en": "Show all", "es": "Ver todo",
        "de": "Alle anzeigen", "fr": "Tout afficher", "ar": "عرض الكل",
        "zh": "全部显示", "ru": "Показать всё", "pt": "Ver tudo",
    },
    # --------- Review cards ---------
    "cards.expand_with_count": {
        "tr": "genişlet · {n} yorum daha göster",
        "en": "expand · show {n} more reviews",
        "es": "expandir · mostrar {n} reseñas más",
        "de": "erweitern · {n} weitere Rezensionen anzeigen",
        "fr": "développer · afficher {n} avis de plus",
        "ar": "توسيع · عرض {n} مراجعة إضافية",
        "zh": "展开 · 再显示 {n} 条评论",
        "ru": "развернуть · показать ещё {n} отзывов",
        "pt": "expandir · mostrar mais {n} avaliações",
    },
    "cards.collapse_to_preview": {
        "tr": "daralt · ilk 5 yoruma dön",
        "en": "collapse · back to first 5 reviews",
        "es": "contraer · volver a las 5 primeras reseñas",
        "de": "einklappen · zurück zu den ersten 5 Rezensionen",
        "fr": "réduire · revenir aux 5 premiers avis",
        "ar": "طيّ · العودة إلى أول 5 مراجعات",
        "zh": "收起 · 返回前 5 条评论",
        "ru": "свернуть · вернуться к первым 5 отзывам",
        "pt": "recolher · voltar às 5 primeiras avaliações",
    },
    "cards.prev": {
        "tr": "Önceki", "en": "Previous", "es": "Anterior", "de": "Zurück",
        "fr": "Précédent", "ar": "السابق", "zh": "上一页", "ru": "Назад", "pt": "Anterior",
    },
    "cards.next": {
        "tr": "Sonraki", "en": "Next", "es": "Siguiente", "de": "Weiter",
        "fr": "Suivant", "ar": "التالي", "zh": "下一页", "ru": "Далее", "pt": "Próximo",
    },
    "cards.paging_hint": {
        "tr": "Çok sayfa ({n}); **Önceki** / **Sonraki** ile gezinin.",
        "en": "Many pages ({n}); navigate with **Previous** / **Next**.",
        "es": "Muchas páginas ({n}); navega con **Anterior** / **Siguiente**.",
        "de": "Viele Seiten ({n}); mit **Zurück** / **Weiter** navigieren.",
        "fr": "Plusieurs pages ({n}); naviguez avec **Précédent** / **Suivant**.",
        "ar": "صفحات كثيرة ({n})؛ تنقل عبر **السابق** / **التالي**.",
        "zh": "共 {n} 页；使用 **上一页** / **下一页** 浏览。",
        "ru": "Много страниц ({n}); используйте **Назад** / **Далее**.",
        "pt": "Muitas páginas ({n}); use **Anterior** / **Próximo**.",
    },
    "cards.collapse_list": {
        "tr": "50'şer göster", "en": "Show in pages of 50",
        "es": "Mostrar de 50 en 50", "de": "In 50er-Schritten anzeigen",
        "fr": "Afficher par tranches de 50", "ar": "عرض كل 50",
        "zh": "每页 50 条", "ru": "Показывать по 50", "pt": "Mostrar de 50 em 50",
    },
    "cards.page_info": {
        "tr": "**{start}–{end}** / {n} yorum · sayfa **{page}** / **{total}**",
        "en": "**{start}–{end}** / {n} reviews · page **{page}** / **{total}**",
        "es": "**{start}–{end}** / {n} reseñas · página **{page}** / **{total}**",
        "de": "**{start}–{end}** / {n} Rezensionen · Seite **{page}** / **{total}**",
        "fr": "**{start}–{end}** / {n} avis · page **{page}** / **{total}**",
        "ar": "**{start}–{end}** / {n} مراجعة · صفحة **{page}** / **{total}**",
        "zh": "**{start}–{end}** / {n} 条评论 · 第 **{page}** / **{total}** 页",
        "ru": "**{start}–{end}** / {n} отзывов · стр. **{page}** / **{total}**",
        "pt": "**{start}–{end}** / {n} avaliações · página **{page}** / **{total}**",
    },
    # --------- Compare panel ---------
    "compare.slot_heading": {
        "tr": "Uygulama {i}", "en": "App {i}", "es": "App {i}", "de": "App {i}",
        "fr": "App {i}", "ar": "التطبيق {i}", "zh": "应用 {i}", "ru": "Приложение {i}", "pt": "App {i}",
    },
    "compare.analysis_settings": {
        "tr": "Analiz ayarları", "en": "Analysis settings", "es": "Ajustes de análisis",
        "de": "Analyse-Einstellungen", "fr": "Paramètres d'analyse", "ar": "إعدادات التحليل",
        "zh": "分析设置", "ru": "Настройки анализа", "pt": "Configurações de análise",
    },
    "compare.method_fast": {
        "tr": "Hızlı (heuristic)", "en": "Fast (heuristic)", "es": "Rápido (heurística)",
        "de": "Schnell (heuristisch)", "fr": "Rapide (heuristique)", "ar": "سريع (استدلالي)",
        "zh": "快速（启发式）", "ru": "Быстрый (эвристика)", "pt": "Rápido (heurística)",
    },
    "compare.method_rich": {
        "tr": "Zengin (LLM)", "en": "Rich (LLM)", "es": "Avanzado (LLM)",
        "de": "Ausführlich (LLM)", "fr": "Enrichi (LLM)", "ar": "غني (LLM)",
        "zh": "丰富（LLM）", "ru": "Расширенный (LLM)", "pt": "Avançado (LLM)",
    },
    "compare.depth_label": {
        "tr": "Derinlik (yalnız zengin)", "en": "Depth (rich only)",
        "es": "Profundidad (solo avanzado)", "de": "Tiefe (nur ausführlich)",
        "fr": "Profondeur (enrichi)", "ar": "العمق (غني فقط)",
        "zh": "深度（仅丰富）", "ru": "Глубина (только расширенный)",
        "pt": "Profundidade (apenas avançado)",
    },
    "compare.depth_std": {
        "tr": "Standart", "en": "Standard", "es": "Estándar", "de": "Standard",
        "fr": "Standard", "ar": "قياسي", "zh": "标准", "ru": "Стандарт", "pt": "Padrão",
    },
    "compare.depth_adv": {
        "tr": "Gelişmiş", "en": "Advanced", "es": "Avanzado", "de": "Erweitert",
        "fr": "Avancé", "ar": "متقدم", "zh": "高级", "ru": "Расширенный", "pt": "Avançado",
    },
    "compare.prep_title": {
        "tr": "yorum havuzu hazırlanıyor", "en": "preparing review pool",
        "es": "preparando reseñas", "de": "Rezensionspool wird vorbereitet",
        "fr": "préparation des avis", "ar": "تحضير تجمع المراجعات",
        "zh": "正在准备评论池", "ru": "готовим пул отзывов", "pt": "preparando avaliações",
    },
    "compare.pool_summary_head": {
        "tr": "havuzdaki yorum", "en": "reviews in pool", "es": "reseñas en pool",
        "de": "Rezensionen im Pool", "fr": "avis dans le pool", "ar": "المراجعات في التجمع",
        "zh": "池中评论数", "ru": "отзывов в пуле", "pt": "avaliações no pool",
    },
    "compare.results_summary_heading": {
        "tr": "Özet", "en": "Summary", "es": "Resumen", "de": "Zusammenfassung",
        "fr": "Synthèse", "ar": "ملخص", "zh": "摘要", "ru": "Сводка", "pt": "Resumo",
    },
    "compare.hint_pick_date": {
        "tr": "iki uygulamayı seçtikten sonra tarih aralığı seçince havuzlar otomatik hazırlanır.",
        "en": "after picking both apps, choosing a date range will automatically prepare the pools.",
        "es": "tras elegir ambas apps, seleccionar un rango de fechas preparará los pools automáticamente.",
        "de": "nach Auswahl beider Apps startet das Vorbereiten der Pools automatisch, sobald ein Zeitraum gewählt wird.",
        "fr": "après avoir choisi les deux apps, le choix d'une période prépare automatiquement les pools.",
        "ar": "بعد اختيار التطبيقين، سيؤدي تحديد النطاق الزمني إلى تحضير التجمعات تلقائيًا.",
        "zh": "选定两个应用后，选择日期范围将自动开始准备评论池。",
        "ru": "после выбора двух приложений выбор периода автоматически запустит подготовку пулов.",
        "pt": "após escolher os dois apps, selecionar um intervalo de datas prepara os pools automaticamente.",
    },
    "compare.elapsed": {
        "tr": "geçen", "en": "elapsed", "es": "transcurrido", "de": "vergangen",
        "fr": "écoulé", "ar": "مضى", "zh": "已用", "ru": "прошло", "pt": "decorrido",
    },
    # --------- Store panel ---------
    "store.input_label": {
        "tr": "Uygulama ara veya mağaza linki / ID",
        "en": "Search an app or paste a store link / ID",
        "es": "Busca una app o pega un enlace / ID",
        "de": "App suchen oder Link / ID einfügen",
        "fr": "Rechercher une app ou coller un lien / ID",
        "ar": "ابحث عن تطبيق أو ألصق رابط / معرف المتجر",
        "zh": "搜索应用或粘贴商店链接 / ID",
        "ru": "Поиск приложения либо ссылка / ID магазина",
        "pt": "Busque um app ou cole link / ID da loja",
    },
    "store.input_placeholder": {
        "tr": "Örn. döviz, com.whatsapp mağaza linki",
        "en": "e.g. finance, com.whatsapp, store link",
        "es": "Ej. finanzas, com.whatsapp, enlace a la tienda",
        "de": "z. B. Finanzen, com.whatsapp, Store-Link",
        "fr": "ex. finance, com.whatsapp, lien boutique",
        "ar": "مثال: تطبيق مالي أو com.whatsapp أو رابط متجر",
        "zh": "例如：finance、com.whatsapp、商店链接",
        "ru": "Напр. finance, com.whatsapp, ссылка магазина",
        "pt": "Ex. finanças, com.whatsapp, link da loja",
    },
    "compare.input_placeholder": {
        "tr": "Örn. trendyol, com.example, App Store ID veya mağaza linki",
        "en": "e.g. trendyol, com.example, App Store ID or store link",
        "es": "Ej. trendyol, com.example, ID de App Store o enlace",
        "de": "z. B. trendyol, com.example, App-Store-ID oder Link",
        "fr": "ex. trendyol, com.example, ID App Store ou lien boutique",
        "ar": "مثال: trendyol أو com.example أو معرف App Store أو رابط متجر",
        "zh": "例如：trendyol、com.example、App Store ID 或商店链接",
        "ru": "Напр. trendyol, com.example, App Store ID или ссылка",
        "pt": "Ex. trendyol, com.example, ID do App Store ou link",
    },
    "store.found_apps": {
        "tr": "Bulunan uygulamalar ({n})",
        "en": "Apps found ({n})",
        "es": "Apps encontradas ({n})",
        "de": "Gefundene Apps ({n})",
        "fr": "Apps trouvées ({n})",
        "ar": "التطبيقات الموجودة ({n})",
        "zh": "找到的应用（{n}）",
        "ru": "Найдено приложений ({n})",
        "pt": "Apps encontrados ({n})",
    },
    "store.no_results": {
        "tr": "Sonuç bulunamadı. Farklı anahtar kelime veya platform deneyin.",
        "en": "No results. Try a different keyword or platform.",
        "es": "Sin resultados. Prueba otra palabra clave o plataforma.",
        "de": "Keine Treffer. Bitte anderes Stichwort oder Plattform probieren.",
        "fr": "Aucun résultat. Essayez un autre mot-clé ou plateforme.",
        "ar": "لا توجد نتائج. جرّب كلمة أو منصة أخرى.",
        "zh": "无结果。请尝试其他关键字或平台。",
        "ru": "Ничего не найдено. Попробуйте другое слово или платформу.",
        "pt": "Sem resultados. Tente outra palavra-chave ou plataforma.",
    },
    "store.need_selection": {
        "tr": "Önce listeden bir uygulama **Seç** deyin veya geçerli paket / ID / ürün linki girin.",
        "en": "Please **Select** an app from the list or enter a valid package / ID / product link.",
        "es": "**Elige** una app de la lista o introduce un paquete / ID / enlace válido.",
        "de": "Bitte eine App aus der Liste **wählen** oder gültiges Paket / ID / Link eingeben.",
        "fr": "**Choisissez** une app dans la liste ou saisissez un package / ID / lien valide.",
        "ar": "يرجى **اختيار** تطبيق من القائمة أو إدخال حزمة / معرف / رابط صالح.",
        "zh": "请从列表中 **选择** 应用，或输入有效的包名 / ID / 商品链接。",
        "ru": "**Выберите** приложение из списка или введите пакет / ID / ссылку.",
        "pt": "**Selecione** um app da lista ou insira um pacote / ID / link válido.",
    },
    "store.loaded_summary": {
        "tr": "{n} benzersiz yorum yüklendi ({range} · {scope}).",
        "en": "{n} unique reviews loaded ({range} · {scope}).",
        "es": "{n} reseñas únicas cargadas ({range} · {scope}).",
        "de": "{n} eindeutige Rezensionen geladen ({range} · {scope}).",
        "fr": "{n} avis uniques chargés ({range} · {scope}).",
        "ar": "تم تحميل {n} مراجعة فريدة ({range} · {scope}).",
        "zh": "已加载 {n} 条独立评论（{range} · {scope}）。",
        "ru": "Загружено {n} уникальных отзывов ({range} · {scope}).",
        "pt": "{n} avaliações únicas carregadas ({range} · {scope}).",
    },
    "store.fetch_error": {
        "tr": "Çekim hatası: {err}", "en": "Fetch error: {err}",
        "es": "Error al obtener: {err}", "de": "Abruffehler: {err}",
        "fr": "Erreur de récupération : {err}", "ar": "خطأ في الجلب: {err}",
        "zh": "获取错误：{err}", "ru": "Ошибка загрузки: {err}", "pt": "Erro ao buscar: {err}",
    },
    "store.search_scanning": {
        "tr": "mağaza sonuçları taranıyor…", "en": "scanning store results…",
        "es": "escaneando resultados de la tienda…", "de": "Store-Ergebnisse werden durchsucht…",
        "fr": "analyse des résultats du store…", "ar": "جارٍ مسح نتائج المتجر…",
        "zh": "正在扫描商店结果…", "ru": "сканируем результаты магазина…", "pt": "varrendo resultados da loja…",
    },
    "store.results_processing": {
        "tr": "{n} sonuç işlendi…", "en": "processed {n} results…",
        "es": "procesadas {n} entradas…", "de": "{n} Treffer verarbeitet…",
        "fr": "{n} résultats traités…", "ar": "تمت معالجة {n} نتيجة…",
        "zh": "已处理 {n} 条结果…", "ru": "обработано результатов: {n}…", "pt": "processados {n} resultados…",
    },
    "store.fetch_pool_state": {
        "tr": "yorum havuzu çekiliyor", "en": "fetching review pool",
        "es": "obteniendo pool de reseñas", "de": "Review-Pool wird geladen",
        "fr": "récupération du pool d’avis", "ar": "جلب مجموعة المراجعات",
        "zh": "正在拉取评论池", "ru": "загрузка пула отзывов", "pt": "baixando pool de avaliações",
    },
    "store.fetch_eta": {
        "tr": "kalan ~{dur}", "en": "~{dur} left",
        "es": "quedan ~{dur}", "de": "noch ~{dur}",
        "fr": "reste ~{dur}", "ar": "متبقٍّ ~{dur}",
        "zh": "剩余 ~{dur}", "ru": "осталось ~{dur}", "pt": "faltam ~{dur}",
    },
    "store.no_score": {
        "tr": "Puan yok", "en": "No rating", "es": "Sin puntuación",
        "de": "Keine Bewertung", "fr": "Pas de note", "ar": "لا يوجد تقييم",
        "zh": "无评分", "ru": "Нет оценки", "pt": "Sem nota",
    },
    # --------- File / paste tabs ---------
    "file.upload_label": {
        "tr": "Dosya seç", "en": "Choose a file", "es": "Elegir archivo",
        "de": "Datei wählen", "fr": "Choisir un fichier", "ar": "اختر ملفًا",
        "zh": "选择文件", "ru": "Выбрать файл", "pt": "Escolher arquivo",
    },
    "file.clear_pool": {
        "tr": "Dosya havuzunu temizle", "en": "Clear file pool",
        "es": "Limpiar pool de archivos", "de": "Dateipool leeren",
        "fr": "Vider le pool de fichiers", "ar": "مسح تجمع الملفات",
        "zh": "清除文件池", "ru": "Очистить файл-пул", "pt": "Limpar pool de arquivos",
    },
    "file.loaded_single": {
        "tr": "Yüklenen dosya: **{file}** — **{n}** yorum. Başka dosya ekleyerek havuzu büyütebilirsiniz.",
        "en": "Uploaded file: **{file}** — **{n}** reviews. Add more files to grow the pool.",
        "es": "Archivo cargado: **{file}** — **{n}** reseñas. Puedes añadir más archivos.",
        "de": "Hochgeladene Datei: **{file}** — **{n}** Rezensionen. Weitere Dateien hinzufügen möglich.",
        "fr": "Fichier chargé : **{file}** — **{n}** avis. Ajoutez d'autres fichiers pour agrandir le pool.",
        "ar": "الملف المحمّل: **{file}** — **{n}** مراجعة. يمكن إضافة ملفات أخرى.",
        "zh": "已上传文件：**{file}** — **{n}** 条评论。可继续添加文件扩充评论池。",
        "ru": "Загруженный файл: **{file}** — **{n}** отзывов. Можно добавить ещё.",
        "pt": "Arquivo carregado: **{file}** — **{n}** avaliações. Adicione outros para ampliar o pool.",
    },
    "file.loaded_merged": {
        "tr": "**{count} dosya** birleşik havuz ({files}{more}) — **{n}** benzersiz yorum. Yeni dosya ekleyebilirsiniz.",
        "en": "**{count} files** merged pool ({files}{more}) — **{n}** unique reviews. You can add more.",
        "es": "**{count} archivos** pool combinado ({files}{more}) — **{n}** reseñas únicas. Puedes añadir más.",
        "de": "**{count} Dateien** kombinierter Pool ({files}{more}) — **{n}** eindeutige Rezensionen.",
        "fr": "**{count} fichiers** pool combiné ({files}{more}) — **{n}** avis uniques.",
        "ar": "**{count} ملفات** تجمع موحد ({files}{more}) — **{n}** مراجعة فريدة.",
        "zh": "**{count} 个文件** 合并池（{files}{more}）— **{n}** 条独立评论。",
        "ru": "**{count} файлов** объединённый пул ({files}{more}) — **{n}** уникальных отзывов.",
        "pt": "**{count} arquivos** pool combinado ({files}{more}) — **{n}** avaliações únicas.",
    },
    "paste.label": {
        "tr": "Yorumlar", "en": "Reviews", "es": "Reseñas", "de": "Rezensionen",
        "fr": "Avis", "ar": "المراجعات", "zh": "评论", "ru": "Отзывы", "pt": "Avaliações",
    },
    "paste.placeholder": {
        "tr": "Örn: Uygulama çok iyi ama bildirimler bazen geç geliyor.\nHer satıra bir yorum…",
        "en": "e.g. The app is great but notifications are sometimes late.\nOne review per line…",
        "es": "Ej.: La app es genial pero las notificaciones llegan tarde.\nUna reseña por línea…",
        "de": "z. B. Die App ist super, aber Benachrichtigungen kommen manchmal spät.\nEine Rezension pro Zeile…",
        "fr": "ex. : L'app est super mais les notifications arrivent tard.\nUn avis par ligne…",
        "ar": "مثال: التطبيق ممتاز لكن الإشعارات أحيانًا متأخرة.\nمراجعة واحدة في كل سطر…",
        "zh": "例如：应用很好，但通知有时较慢。\n每行一条评论……",
        "ru": "Напр.: Приложение классное, но уведомления иногда опаздывают.\nПо одному отзыву в строке…",
        "pt": "Ex.: O app é ótimo, mas notificações às vezes atrasam.\nUma avaliação por linha…",
    },
    "paste.upload_btn": {
        "tr": "Metni havuza yükle", "en": "Add text to pool",
        "es": "Añadir texto al pool", "de": "Text in Pool übernehmen",
        "fr": "Ajouter le texte au pool", "ar": "إضافة النص إلى التجمع",
        "zh": "将文本添加到评论池", "ru": "Добавить текст в пул", "pt": "Adicionar ao pool",
    },
    # --------- Dashboard / analysis ---------
    "metric.pool_count": {
        "tr": "Havuzdaki yorum", "en": "Reviews in pool", "es": "Reseñas en el pool",
        "de": "Rezensionen im Pool", "fr": "Avis dans le pool", "ar": "المراجعات في التجمع",
        "zh": "池中评论数", "ru": "Отзывов в пуле", "pt": "Avaliações no pool",
    },
    "section.analysis_settings": {
        "tr": "Analiz ayarları", "en": "Analysis settings",
        "es": "Ajustes de análisis", "de": "Analyse-Einstellungen",
        "fr": "Paramètres d'analyse", "ar": "إعدادات التحليل",
        "zh": "分析设置", "ru": "Настройки анализа", "pt": "Configurações de análise",
    },
    "section.reviews": {
        "tr": "Yorumlar", "en": "Reviews", "es": "Reseñas", "de": "Rezensionen",
        "fr": "Avis", "ar": "المراجعات", "zh": "评论", "ru": "Отзывы", "pt": "Avaliações",
    },
    "analysis.start": {
        "tr": "Duygu analizini başlat", "en": "Start sentiment analysis",
        "es": "Iniciar análisis de sentimiento", "de": "Sentiment-Analyse starten",
        "fr": "Démarrer l'analyse des sentiments", "ar": "بدء تحليل المشاعر",
        "zh": "开始情感分析", "ru": "Начать анализ тональности", "pt": "Iniciar análise de sentimento",
    },
    "analysis.warn_load_first": {
        "tr": "Önce yorum yükleyin.", "en": "Please load reviews first.",
        "es": "Primero carga reseñas.", "de": "Bitte zuerst Rezensionen laden.",
        "fr": "Veuillez d'abord charger des avis.", "ar": "يرجى تحميل المراجعات أولاً.",
        "zh": "请先加载评论。", "ru": "Сначала загрузите отзывы.", "pt": "Carregue avaliações primeiro.",
    },
    "analysis.err_need_api": {
        "tr": "Zengin analiz için en az bir API anahtarı gerekir.",
        "en": "Rich analysis needs at least one API key.",
        "es": "El análisis avanzado requiere al menos una clave API.",
        "de": "Ausführliche Analyse benötigt mindestens einen API-Key.",
        "fr": "L'analyse enrichie nécessite au moins une clé API.",
        "ar": "يحتاج التحليل الغني إلى مفتاح API واحد على الأقل.",
        "zh": "丰富分析至少需要一个 API 密钥。",
        "ru": "Для расширенного анализа нужен хотя бы один API-ключ.",
        "pt": "Análise avançada requer ao menos uma chave de API.",
    },
    "analysis.spinner": {
        "tr": "Yorumlar analiz ediliyor…", "en": "Analyzing reviews…",
        "es": "Analizando reseñas…", "de": "Rezensionen werden analysiert…",
        "fr": "Analyse des avis…", "ar": "جارٍ تحليل المراجعات…",
        "zh": "正在分析评论……", "ru": "Анализируем отзывы…", "pt": "Analisando avaliações…",
    },
    # LLM batch akışı — durum metni (done/total'a ek olarak hangi partiye odaklandığını söyler).
    "analysis.status_first_n": {
        "tr": "İlk {n} yorum analiz ediliyor — {done} / {n}",
        "en": "Analyzing the first {n} reviews — {done} / {n}",
        "es": "Analizando las primeras {n} reseñas — {done} / {n}",
        "de": "Analysiere die ersten {n} Rezensionen — {done} / {n}",
        "fr": "Analyse des {n} premiers avis — {done} / {n}",
        "ar": "يتم تحليل أول {n} مراجعة — {done} / {n}",
        "zh": "正在分析前 {n} 条评论 — {done} / {n}",
        "ru": "Анализируем первые {n} отзывов — {done} / {n}",
        "pt": "Analisando as primeiras {n} avaliações — {done} / {n}",
    },
    "analysis.status_next_n": {
        "tr": "Sonraki {n} yorum analiz ediliyor — {done} / {n}",
        "en": "Analyzing the next {n} reviews — {done} / {n}",
        "es": "Analizando las siguientes {n} reseñas — {done} / {n}",
        "de": "Analysiere die nächsten {n} Rezensionen — {done} / {n}",
        "fr": "Analyse des {n} avis suivants — {done} / {n}",
        "ar": "يتم تحليل {n} مراجعة التالية — {done} / {n}",
        "zh": "正在分析接下来的 {n} 条评论 — {done} / {n}",
        "ru": "Анализируем следующие {n} отзывов — {done} / {n}",
        "pt": "Analisando as próximas {n} avaliações — {done} / {n}",
    },
    "analysis.status_last_n": {
        "tr": "Kalan {n} yorum analiz ediliyor — {done} / {n}",
        "en": "Analyzing the remaining {n} reviews — {done} / {n}",
        "es": "Analizando las {n} reseñas restantes — {done} / {n}",
        "de": "Analysiere die verbleibenden {n} Rezensionen — {done} / {n}",
        "fr": "Analyse des {n} avis restants — {done} / {n}",
        "ar": "يتم تحليل {n} مراجعة المتبقية — {done} / {n}",
        "zh": "正在分析剩余的 {n} 条评论 — {done} / {n}",
        "ru": "Анализируем оставшиеся {n} отзывов — {done} / {n}",
        "pt": "Analisando as {n} avaliações restantes — {done} / {n}",
    },
    "analysis.status_plain": {
        "tr": "{done} / {total}", "en": "{done} / {total}", "es": "{done} / {total}",
        "de": "{done} / {total}", "fr": "{done} / {total}", "ar": "{done} / {total}",
        "zh": "{done} / {total}", "ru": "{done} / {total}", "pt": "{done} / {total}",
    },
    "analysis.batch_caption": {
        "tr": "Şu ana kadar analiz edilen: {done} / {total}",
        "en": "Analyzed so far: {done} / {total}",
        "es": "Analizado hasta ahora: {done} / {total}",
        "de": "Bisher analysiert: {done} / {total}",
        "fr": "Analysé jusqu'ici : {done} / {total}",
        "ar": "المُحلَّل حتى الآن: {done} / {total}",
        "zh": "已分析：{done} / {total}",
        "ru": "Проанализировано: {done} / {total}",
        "pt": "Analisados até agora: {done} / {total}",
    },
    "analysis.continue_next": {
        "tr": "Sonraki {n} yorumu analiz et",
        "en": "Analyze next {n} reviews",
        "es": "Analizar las siguientes {n} reseñas",
        "de": "Nächste {n} Rezensionen analysieren",
        "fr": "Analyser les {n} avis suivants",
        "ar": "تحليل {n} مراجعة التالية",
        "zh": "分析接下来的 {n} 条评论",
        "ru": "Анализировать следующие {n} отзывов",
        "pt": "Analisar as próximas {n} avaliações",
    },
    "analysis.continue_remaining": {
        "tr": "Kalan {n} yorumu da analiz et",
        "en": "Also analyze the remaining {n} reviews",
        "es": "Analizar también las {n} reseñas restantes",
        "de": "Auch die verbleibenden {n} Rezensionen analysieren",
        "fr": "Analyser aussi les {n} avis restants",
        "ar": "حلّل أيضًا {n} المراجعات المتبقية",
        "zh": "继续分析剩余的 {n} 条评论",
        "ru": "Также проанализировать оставшиеся {n} отзывов",
        "pt": "Analisar também as {n} avaliações restantes",
    },
    "analysis.restart": {
        "tr": "Yeniden analiz et", "en": "Re-run analysis",
        "es": "Volver a analizar", "de": "Erneut analysieren",
        "fr": "Relancer l'analyse", "ar": "إعادة التحليل",
        "zh": "重新分析", "ru": "Проанализировать заново", "pt": "Reanalisar",
    },
    "compare.spinner": {
        "tr": "Uygulamalar analiz ediliyor…", "en": "Analyzing apps…",
        "es": "Analizando apps…", "de": "Apps werden analysiert…",
        "fr": "Analyse des apps…", "ar": "جارٍ تحليل التطبيقات…",
        "zh": "正在分析应用……", "ru": "Анализируем приложения…", "pt": "Analisando apps…",
    },
    "compare.analysis_caption": {
        "tr": "{title}: {done}/{total} yorum işlendi",
        "en": "{title}: {done}/{total} reviews processed",
        "es": "{title}: {done}/{total} reseñas procesadas",
        "de": "{title}: {done}/{total} Bewertungen verarbeitet",
        "fr": "{title} : {done}/{total} avis traités",
        "ar": "{title}: تمت معالجة {done}/{total} مراجعة",
        "zh": "{title}: 已处理 {done}/{total} 条评论",
        "ru": "{title}: обработано {done}/{total} отзывов",
        "pt": "{title}: {done}/{total} avaliações processadas",
        "ja": "{title}: {done}/{total} 件のレビューを処理",
    },
    "compare.warn_need_pools": {
        "tr": "Önce iki uygulama için de yorum havuzu hazırlanmalı.",
        "en": "Prepare review pools for both apps first.",
        "es": "Prepara primero los pools de ambas apps.",
        "de": "Zuerst Pools für beide Apps vorbereiten.",
        "fr": "Préparez d'abord les pools des deux apps.",
        "ar": "حضّر تجمعات المراجعات للتطبيقين أولاً.",
        "zh": "请先为两个应用准备评论池。",
        "ru": "Сначала подготовьте пулы для обоих приложений.",
        "pt": "Prepare primeiro os pools dos dois apps.",
    },
    "compare.err_unresolvable_long": {
        "tr": "Uygulama {i}: giriş çözülemedi (`{raw}…`)",
        "en": "App {i}: could not resolve input (`{raw}…`)",
        "es": "App {i}: no se pudo resolver la entrada (`{raw}…`)",
        "de": "App {i}: Eingabe nicht auflösbar (`{raw}…`)",
        "fr": "App {i} : entrée irrésolue (`{raw}…`)",
        "ar": "التطبيق {i}: تعذّر تحليل المدخل (`{raw}…`)",
        "zh": "应用 {i}：无法解析输入（`{raw}…`）",
        "ru": "Приложение {i}: не удалось распознать ввод (`{raw}…`)",
        "pt": "App {i}: entrada não resolvida (`{raw}…`)",
    },
    "compare.err_unresolvable": {
        "tr": "Uygulama {i}: giriş çözülemedi.",
        "en": "App {i}: could not resolve input.",
        "es": "App {i}: no se pudo resolver la entrada.",
        "de": "App {i}: Eingabe nicht auflösbar.",
        "fr": "App {i} : entrée irrésolue.",
        "ar": "التطبيق {i}: تعذّر تحليل المدخل.",
        "zh": "应用 {i}：无法解析输入。",
        "ru": "Приложение {i}: не удалось распознать ввод.",
        "pt": "App {i}: entrada não resolvida.",
    },
    "compare.err_rich_api": {
        "tr": "Zengin analiz için en az bir API anahtarı gerekir (.env veya Streamlit secrets).",
        "en": "Rich analysis needs at least one API key (.env or Streamlit secrets).",
        "es": "El análisis avanzado requiere al menos una clave API (.env o Streamlit secrets).",
        "de": "Ausführliche Analyse benötigt mindestens einen API-Key (.env oder Streamlit-Secrets).",
        "fr": "L'analyse enrichie nécessite au moins une clé API (.env ou Streamlit secrets).",
        "ar": "يحتاج التحليل الغني إلى مفتاح API واحد على الأقل (.env أو Streamlit secrets).",
        "zh": "丰富分析至少需要一个 API 密钥（.env 或 Streamlit secrets）。",
        "ru": "Для расширенного анализа нужен хотя бы один API-ключ (.env или Streamlit secrets).",
        "pt": "Análise avançada requer ao menos uma chave de API (.env ou Streamlit secrets).",
    },
    # --------- Downloads ---------
    "download.raw_section": {
        "tr": "Ham veriyi indir (analiz öncesi)", "en": "Download raw data (before analysis)",
        "es": "Descargar datos sin procesar (antes del análisis)",
        "de": "Rohdaten herunterladen (vor der Analyse)",
        "fr": "Télécharger les données brutes (avant analyse)",
        "ar": "تنزيل البيانات الخام (قبل التحليل)",
        "zh": "下载原始数据（分析前）",
        "ru": "Скачать исходные данные (до анализа)",
        "pt": "Baixar dados brutos (antes da análise)",
    },
    "download.csv": {
        "tr": "CSV indir", "en": "Download CSV", "es": "Descargar CSV",
        "de": "CSV herunterladen", "fr": "Télécharger CSV", "ar": "تنزيل CSV",
        "zh": "下载 CSV", "ru": "Скачать CSV", "pt": "Baixar CSV",
    },
    "download.excel": {
        "tr": "Excel indir", "en": "Download Excel", "es": "Descargar Excel",
        "de": "Excel herunterladen", "fr": "Télécharger Excel", "ar": "تنزيل Excel",
        "zh": "下载 Excel", "ru": "Скачать Excel", "pt": "Baixar Excel",
    },
    "download.pdf": {
        "tr": "PDF indir", "en": "Download PDF", "es": "Descargar PDF",
        "de": "PDF herunterladen", "fr": "Télécharger PDF", "ar": "تنزيل PDF",
        "zh": "下载 PDF", "ru": "Скачать PDF", "pt": "Baixar PDF",
    },
    "download.analysis_csv": {
        "tr": "Sonuçları CSV indir", "en": "Download results (CSV)",
        "es": "Descargar resultados (CSV)", "de": "Ergebnisse als CSV herunterladen",
        "fr": "Télécharger les résultats (CSV)", "ar": "تنزيل النتائج (CSV)",
        "zh": "下载结果 (CSV)", "ru": "Скачать результаты (CSV)", "pt": "Baixar resultados (CSV)",
    },
    "download.analysis_pdf": {
        "tr": "Sonuçları PDF indir", "en": "Download results (PDF)",
        "es": "Descargar resultados (PDF)", "de": "Ergebnisse als PDF herunterladen",
        "fr": "Télécharger les résultats (PDF)", "ar": "تنزيل النتائج (PDF)",
        "zh": "下载结果 (PDF)", "ru": "Скачать результаты (PDF)", "pt": "Baixar resultados (PDF)",
    },
    "download.analysis_excel": {
        "tr": "Sonuçları Excel indir", "en": "Download results (Excel)",
        "es": "Descargar resultados (Excel)", "de": "Ergebnisse als Excel herunterladen",
        "fr": "Télécharger les résultats (Excel)", "ar": "تنزيل النتائج (Excel)",
        "zh": "下载结果 (Excel)", "ru": "Скачать результаты (Excel)", "pt": "Baixar resultados (Excel)",
    },
    # --------- Analysis dashboard ---------
    "dash.page_title": {
        "tr": "Analiz Sonuçları ve İstatistikler", "en": "Analysis results & statistics",
        "es": "Resultados del análisis y estadísticas", "de": "Analyseergebnisse & Statistiken",
        "fr": "Résultats d'analyse & statistiques", "ar": "نتائج التحليل والإحصائيات",
        "zh": "分析结果与统计", "ru": "Результаты анализа и статистика",
        "pt": "Resultados da análise e estatísticas",
    },
    "dash.open_store_listing": {
        "tr": "Uygulamayı mağazada aç",
        "en": "Open app in store",
        "es": "Abrir la app en la tienda",
        "de": "App im Store öffnen",
        "fr": "Ouvrir l’app dans le store",
        "ar": "فتح التطبيق في المتجر",
        "zh": "在商店中打开应用",
        "ru": "Открыть приложение в магазине",
        "pt": "Abrir o app na loja",
    },
    "dash.sent_dist": {
        "tr": "Duygu Dağılımı", "en": "Sentiment distribution",
        "es": "Distribución de sentimiento", "de": "Sentiment-Verteilung",
        "fr": "Distribution du sentiment", "ar": "توزيع المشاعر",
        "zh": "情感分布", "ru": "Распределение тональности", "pt": "Distribuição de sentimento",
    },
    "dash.score_dist": {
        "tr": "Puan Dağılımı", "en": "Rating distribution",
        "es": "Distribución de puntuaciones", "de": "Bewertungsverteilung",
        "fr": "Distribution des notes", "ar": "توزيع التقييمات",
        "zh": "评分分布", "ru": "Распределение оценок", "pt": "Distribuição de notas",
    },
    "dash.no_data_yet": {
        "tr": "Henüz yeterli veri yok.", "en": "Not enough data yet.",
        "es": "Aún no hay suficientes datos.", "de": "Noch nicht genug Daten.",
        "fr": "Pas encore assez de données.", "ar": "لا توجد بيانات كافية بعد.",
        "zh": "数据尚不足。", "ru": "Данных пока недостаточно.", "pt": "Dados insuficientes ainda.",
    },
    "dash.missing_cols": {
        "tr": "Analiz sonucu sütunları eksik.", "en": "Analysis output columns are missing.",
        "es": "Faltan columnas del resultado del análisis.", "de": "Analyse-Ergebnisspalten fehlen.",
        "fr": "Colonnes du résultat d'analyse manquantes.", "ar": "أعمدة نتائج التحليل مفقودة.",
        "zh": "分析结果列缺失。", "ru": "Нет колонок с результатом анализа.",
        "pt": "Faltam colunas do resultado da análise.",
    },
    "dash.exp_score": {
        "tr": "Genel Deneyim Skoru", "en": "Overall experience score",
        "es": "Puntuación global de experiencia", "de": "Gesamt-Erlebnis-Score",
        "fr": "Score d'expérience global", "ar": "درجة التجربة العامة",
        "zh": "总体体验评分", "ru": "Общая оценка опыта", "pt": "Pontuação geral de experiência",
    },
    "dash.trend": {
        "tr": "Trend", "en": "Trend", "es": "Tendencia", "de": "Trend",
        "fr": "Tendance", "ar": "الاتجاه", "zh": "趋势", "ru": "Тренд", "pt": "Tendência",
    },
    "dash.daily_neg": {
        "tr": "Günlük Olumsuz Oran", "en": "Daily negative rate",
        "es": "Tasa diaria de negativos", "de": "Tägliche Negativrate",
        "fr": "Taux négatif quotidien", "ar": "النسبة السلبية اليومية",
        "zh": "每日负面比率", "ru": "Доля негатива по дням", "pt": "Taxa negativa diária",
    },
    "dash.persona": {
        "tr": "Kullanıcı Profili (Persona)", "en": "User profile (persona)",
        "es": "Perfil de usuario (persona)", "de": "Nutzerprofil (Persona)",
        "fr": "Profil utilisateur (persona)", "ar": "ملف المستخدم (Persona)",
        "zh": "用户画像（Persona）", "ru": "Профиль пользователя (Persona)",
        "pt": "Perfil do usuário (persona)",
    },
    "dash.sent_pos": {
        "tr": "Olumlu", "en": "Positive", "es": "Positivo", "de": "Positiv",
        "fr": "Positif", "ar": "إيجابي", "zh": "正面", "ru": "Позитивные", "pt": "Positivo",
    },
    "dash.sent_neg": {
        "tr": "Olumsuz", "en": "Negative", "es": "Negativo", "de": "Negativ",
        "fr": "Négatif", "ar": "سلبي", "zh": "负面", "ru": "Негативные", "pt": "Negativo",
    },
    "dash.sent_req": {
        "tr": "İstek/Görüş", "en": "Request / opinion", "es": "Solicitud / opinión",
        "de": "Anfrage / Meinung", "fr": "Demande / avis", "ar": "طلب / رأي",
        "zh": "建议 / 意见", "ru": "Запрос / мнение", "pt": "Sugestão / opinião",
    },
    "dash.pill_total": {
        "tr": "Toplam Veri", "en": "Total data", "es": "Datos totales",
        "de": "Gesamtdaten", "fr": "Données totales", "ar": "إجمالي البيانات",
        "zh": "数据总量", "ru": "Всего данных", "pt": "Total de dados",
    },
    "dash.trend_neg_rising": {
        "tr": "Olumsuz oran artıyor (+%{pct})",
        "en": "Negative rate is rising (+{pct}%)",
        "es": "La tasa negativa está aumentando (+{pct}%)",
        "de": "Negativ-Rate steigt (+{pct} %)",
        "fr": "Le taux négatif augmente (+{pct} %)",
        "ar": "النسبة السلبية ترتفع (+{pct}%)",
        "zh": "负面比率上升 (+{pct}%)",
        "ru": "Доля негатива растёт (+{pct}%)",
        "pt": "Taxa negativa está subindo (+{pct}%)",
    },
    "dash.trend_sat_rising": {
        "tr": "Memnuniyet artıyor (+%{pct})",
        "en": "Satisfaction is improving (+{pct}%)",
        "es": "La satisfacción mejora (+{pct}%)",
        "de": "Zufriedenheit steigt (+{pct} %)",
        "fr": "La satisfaction s'améliore (+{pct} %)",
        "ar": "الرضا في ازدياد (+{pct}%)",
        "zh": "满意度上升 (+{pct}%)",
        "ru": "Удовлетворённость растёт (+{pct}%)",
        "pt": "Satisfação está melhorando (+{pct}%)",
    },
    "dash.trend_stable": {
        "tr": "Oran stabil seyrediyor", "en": "Rate is steady",
        "es": "La tasa se mantiene estable", "de": "Rate bleibt stabil",
        "fr": "Le taux reste stable", "ar": "النسبة مستقرة",
        "zh": "比率保持稳定", "ru": "Соотношение стабильно",
        "pt": "Taxa permanece estável",
    },
    "dash.dow_mon": {"tr": "Pzt", "en": "Mon", "es": "Lun", "de": "Mo", "fr": "Lun", "ar": "إث", "zh": "一", "ru": "Пн", "pt": "Seg"},
    "dash.dow_tue": {"tr": "Sal", "en": "Tue", "es": "Mar", "de": "Di", "fr": "Mar", "ar": "ثل", "zh": "二", "ru": "Вт", "pt": "Ter"},
    "dash.dow_wed": {"tr": "Çrş", "en": "Wed", "es": "Mié", "de": "Mi", "fr": "Mer", "ar": "أر", "zh": "三", "ru": "Ср", "pt": "Qua"},
    "dash.dow_thu": {"tr": "Per", "en": "Thu", "es": "Jue", "de": "Do", "fr": "Jeu", "ar": "خم", "zh": "四", "ru": "Чт", "pt": "Qui"},
    "dash.dow_fri": {"tr": "Cum", "en": "Fri", "es": "Vie", "de": "Fr", "fr": "Ven", "ar": "جم", "zh": "五", "ru": "Пт", "pt": "Sex"},
    "dash.dow_sat": {"tr": "Cmt", "en": "Sat", "es": "Sáb", "de": "Sa", "fr": "Sam", "ar": "سب", "zh": "六", "ru": "Сб", "pt": "Sáb"},
    "dash.dow_sun": {"tr": "Paz", "en": "Sun", "es": "Dom", "de": "So", "fr": "Dim", "ar": "أح", "zh": "日", "ru": "Вс", "pt": "Dom"},
    "dash.no_date_rating": {
        "tr": "Tarih ve puan bilgisi olan yorum yok.",
        "en": "No reviews with both date and rating data.",
        "es": "No hay reseñas con fecha y puntuación.",
        "de": "Keine Rezensionen mit Datum und Bewertung.",
        "fr": "Aucun avis avec date et note.",
        "ar": "لا توجد مراجعات تحتوي على تاريخ وتقييم.",
        "zh": "没有同时具备日期和评分的评论。",
        "ru": "Нет отзывов с датой и оценкой.",
        "pt": "Nenhuma avaliação com data e nota.",
    },
    "dash.date_range_label": {
        "tr": "**Tespit Edilen Tarih Aralığı:** {min_d} ile {max_d}",
        "en": "**Detected date range:** {min_d} to {max_d}",
        "es": "**Rango de fechas detectado:** {min_d} a {max_d}",
        "de": "**Erkannter Datumsbereich:** {min_d} bis {max_d}",
        "fr": "**Plage de dates détectée :** {min_d} au {max_d}",
        "ar": "**النطاق الزمني المكتشف:** {min_d} إلى {max_d}",
        "zh": "**检测到的日期范围：** {min_d} 至 {max_d}",
        "ru": "**Обнаруженный диапазон дат:** {min_d} – {max_d}",
        "pt": "**Intervalo de datas detectado:** {min_d} a {max_d}",
    },
    "dash.freq_label": {
        "tr": "Zaman ölçeği", "en": "Time scale", "es": "Escala temporal",
        "de": "Zeitskala", "fr": "Échelle temporelle", "ar": "المقياس الزمني",
        "zh": "时间范围", "ru": "Временной масштаб", "pt": "Escala de tempo",
    },
    "dash.freq_daily": {
        "tr": "Günlük", "en": "Daily", "es": "Diario", "de": "Täglich",
        "fr": "Quotidien", "ar": "يومي", "zh": "每日", "ru": "По дням", "pt": "Diário",
    },
    "dash.freq_weekly": {
        "tr": "Haftalık", "en": "Weekly", "es": "Semanal", "de": "Wöchentlich",
        "fr": "Hebdomadaire", "ar": "أسبوعي", "zh": "每周", "ru": "По неделям", "pt": "Semanal",
    },
    "dash.freq_monthly": {
        "tr": "Aylık", "en": "Monthly", "es": "Mensual", "de": "Monatlich",
        "fr": "Mensuel", "ar": "شهري", "zh": "每月", "ru": "По месяцам", "pt": "Mensal",
    },
    "dash.chart_title_daily": {
        "tr": "Günlük Puan Dağılımı", "en": "Daily rating distribution",
        "es": "Distribución diaria de puntuaciones", "de": "Tägliche Bewertungsverteilung",
        "fr": "Distribution quotidienne des notes", "ar": "توزيع التقييمات اليومي",
        "zh": "每日评分分布", "ru": "Распределение оценок по дням",
        "pt": "Distribuição diária de notas",
    },
    "dash.chart_title_weekly": {
        "tr": "Haftalık Puan Dağılımı", "en": "Weekly rating distribution",
        "es": "Distribución semanal de puntuaciones", "de": "Wöchentliche Bewertungsverteilung",
        "fr": "Distribution hebdomadaire des notes", "ar": "توزيع التقييمات الأسبوعي",
        "zh": "每周评分分布", "ru": "Распределение оценок по неделям",
        "pt": "Distribuição semanal de notas",
    },
    "dash.chart_title_monthly": {
        "tr": "Aylık Puan Dağılımı", "en": "Monthly rating distribution",
        "es": "Distribución mensual de puntuaciones", "de": "Monatliche Bewertungsverteilung",
        "fr": "Distribution mensuelle des notes", "ar": "توزيع التقييمات الشهري",
        "zh": "每月评分分布", "ru": "Распределение оценок по месяцам",
        "pt": "Distribuição mensal de notas",
    },
    "dash.chart_xaxis_time": {
        "tr": "Zaman", "en": "Time", "es": "Tiempo", "de": "Zeit",
        "fr": "Temps", "ar": "الزمن", "zh": "时间", "ru": "Время", "pt": "Tempo",
    },
    "dash.chart_yaxis_count": {
        "tr": "Yorum / Puan Sayısı", "en": "Review / rating count",
        "es": "Recuento de reseñas / puntuaciones", "de": "Anzahl Rezensionen / Bewertungen",
        "fr": "Nombre d'avis / notes", "ar": "عدد المراجعات / التقييمات",
        "zh": "评论 / 评分数", "ru": "Количество отзывов / оценок",
        "pt": "Contagem de avaliações / notas",
    },
    "dash.stars_suffix": {
        "tr": "{n} Yıldız", "en": "{n} star", "es": "{n} estrellas",
        "de": "{n} Sterne", "fr": "{n} étoile(s)", "ar": "{n} نجوم",
        "zh": "{n} 星", "ru": "{n} звёзд", "pt": "{n} estrelas",
    },
    "dash.summary_pos_title": {
        "tr": "Topluluk Genel Olarak Olumlu",
        "en": "Community is generally positive",
        "es": "La comunidad es mayormente positiva",
        "de": "Community ist überwiegend positiv",
        "fr": "La communauté est globalement positive",
        "ar": "المجتمع إيجابي بشكل عام",
        "zh": "社区总体正面",
        "ru": "Сообщество в целом позитивное",
        "pt": "A comunidade é, em geral, positiva",
    },
    "dash.summary_neg_title": {
        "tr": "Dikkat çeken olumsuz bir eğilim",
        "en": "A notable negative trend",
        "es": "Tendencia negativa destacable",
        "de": "Auffällig negativer Trend",
        "fr": "Tendance négative notable",
        "ar": "اتجاه سلبي لافت للنظر",
        "zh": "出现显著的负面趋势",
        "ru": "Заметная негативная динамика",
        "pt": "Tendência negativa notável",
    },
    "dash.summary_mixed_title": {
        "tr": "Dengeli kullanıcı deneyimi",
        "en": "Balanced user experience",
        "es": "Experiencia de usuario equilibrada",
        "de": "Ausgewogene Nutzererfahrung",
        "fr": "Expérience utilisateur équilibrée",
        "ar": "تجربة مستخدم متوازنة",
        "zh": "用户体验较为均衡",
        "ru": "Сбалансированный пользовательский опыт",
        "pt": "Experiência do usuário equilibrada",
    },
    "dash.summary_pos_intro": {
        "tr": "Analiz edilen {n} yorumun %{pos}'ü olumlu. Kullanıcılar genel olarak deneyimlerinden memnun.",
        "en": "{pos}% of the {n} analyzed reviews are positive. Users are generally satisfied with the experience.",
        "es": "El {pos}% de las {n} reseñas analizadas son positivas. Los usuarios están, en general, satisfechos.",
        "de": "{pos}% der {n} analysierten Rezensionen sind positiv. Nutzer sind mit der Erfahrung überwiegend zufrieden.",
        "fr": "{pos}% des {n} avis analysés sont positifs. Les utilisateurs sont globalement satisfaits.",
        "ar": "‎{pos}% من أصل {n} مراجعة تم تحليلها إيجابية. المستخدمون راضون بشكل عام عن تجربتهم.",
        "zh": "已分析的 {n} 条评论中 {pos}% 为正面。用户总体对体验感到满意。",
        "ru": "{pos}% из {n} проанализированных отзывов — позитивные. Пользователи в целом удовлетворены.",
        "pt": "{pos}% das {n} avaliações analisadas são positivas. Os usuários estão, em geral, satisfeitos.",
    },
    "dash.summary_neg_intro": {
        "tr": "Yorumların %{neg}'si olumsuz. Teknik sorunlar veya kullanım zorlukları öne çıkıyor.",
        "en": "{neg}% of the reviews are negative. Technical issues or usability difficulties stand out.",
        "es": "El {neg}% de las reseñas son negativas. Destacan problemas técnicos o dificultades de uso.",
        "de": "{neg}% der Rezensionen sind negativ. Technische Probleme oder Nutzungsschwierigkeiten stechen hervor.",
        "fr": "{neg}% des avis sont négatifs. Les problèmes techniques ou difficultés d'utilisation ressortent.",
        "ar": "‎{neg}% من المراجعات سلبية. تبرز مشاكل تقنية أو صعوبات في الاستخدام.",
        "zh": "{neg}% 的评论为负面。技术问题或使用难题较为突出。",
        "ru": "{neg}% отзывов — негативные. Выделяются технические проблемы и сложности использования.",
        "pt": "{neg}% das avaliações são negativas. Destacam-se problemas técnicos ou dificuldades de uso.",
    },
    "dash.summary_mixed_intro": {
        "tr": "Yorumlar olumlu (%{pos}) ve olumsuz (%{neg}) arasında dengeli bir dağılım sergiliyor.",
        "en": "Reviews are fairly balanced between positive ({pos}%) and negative ({neg}%).",
        "es": "Las reseñas están equilibradas entre positivas ({pos}%) y negativas ({neg}%).",
        "de": "Die Rezensionen sind zwischen positiv ({pos} %) und negativ ({neg} %) ausgewogen.",
        "fr": "Les avis sont assez équilibrés entre positifs ({pos} %) et négatifs ({neg} %).",
        "ar": "المراجعات موزعة بشكل متوازن بين الإيجابية (‎{pos}%) والسلبية (‎{neg}%).",
        "zh": "评论在正面 ({pos}%) 与负面 ({neg}%) 之间较为均衡。",
        "ru": "Отзывы распределены между позитивными ({pos}%) и негативными ({neg}%).",
        "pt": "As avaliações estão equilibradas entre positivas ({pos}%) e negativas ({neg}%).",
    },
    "dash.summary_narrative_positive": {
        "tr": "dağılımda kabaca %{pos_p} olumlu ({pos} adet), %{neg_p} olumsuz ({neg}), %{neu_p} ise nötr ya da kararsız tonda ({neu}). bu dilimde ivme iyi tarafa: deneyim büyük ölçüde olumlu okunuyor. olumsuz dilim yine de ihmal edilmemeli — stabilite, hız, ilk kullanım ve beklenti yönetimi ürün ile iletişimde sürtünmeye yol açabilir. çok dillilik aynı ölçütü kullandığından buradaki özet, tekil cümlelerden çok toplu eğilimi yansıtır.",
        "en": "Roughly {pos_p}% read as positive ({pos} voices), {neg_p}% as negative ({neg}), and about {neu_p}% sit neutral or undecided ({neu}). At this snapshot the tilt is favorable: people mostly take the experience as a win. The negative slice still matters—stability, pace, first-run moments, and how expectations are handled can surface friction worth watching in product and comms. Because every language is scored the same way, what you see here is the overall lean rather than pulled quotes.",
        "es": "En torno al {pos_p}% se lee positivo ({pos} voces), el {neg_p}% negativo ({neg}) y cerca del {neu_p}% en tono neutro o indeciso ({neu}). En este recorte la sensación es mayormente buena: la experiencia se percibe favorable. Aun así la parte negativa pesa—fiabilidad, ritmo, primera toma o gestión de expectativas pueden generar roce en producto y comunicación. Con el mismo criterio para todos los idiomas, lo que ves es la inclinación global, no citas literales.",
        "de": "Grobe Verteilung: etwa {pos_p}% wirken positiv ({pos} Stimmen), {neg_p}% negativ ({neg}), rund {neu_p}% neutral oder zwiespältig ({neu}). Im Schnitt dominiert ein freundliches Bild: die Erfahrung wird überwiegend positiv gelesen. Der negative Anteil bleibt relevant—Stabilität, Tempo, Einstieg und Erwartungsklarheit können Reibung erzeugen und sollten in Produkt und Kommunikation im Blick bleiben. Alle Sprachen gleich gewichtet, daher Gesamtlage, keine Auszüge.",
        "fr": "Autour de {pos_p}% sonnent positifs ({pos} voix), {neg_p}% négatifs ({neg}) et environ {neu_p}% neutres ou indécis ({neu}). Sur ce segment, l’ambiance penche nettement du bon côté : l’expérience se vit plutôt bien. La part négative reste à suivre—fiabilité, fluidité, première prise en main, gestion des attentes peuvent créer du frottement côté produit et communication. Notation identique pour toutes les langues : tendance d’ensemble, pas d’extraits mot pour mot.",
        "ar": "نحو {pos_p}% يميل للإيجاب ({pos} صوتًا)، و{neg_p}% للسلب ({neg})، وحوالي {neu_p}% في منطقة محايدة أو مترددة ({neu}). في هذه اللقطة الميل العام إيجابي والتجربة تُقرأ على نحوٍ مُرضٍ. لا يعني ذلك تجاهل الجزء السلبي—الاعتمادية، السرعة، أول استخدام أو إدارة التوقعات قد تسبب احتكاكًا يستحق المتابعة في المنتج والتواصل. وبما أن كل اللغات تُقيَّم بنفس المعيار، فما تسمعونه هو الميل العام لا اقتباسًا حرفيًا.",
        "zh": "约 {pos_p}% 偏正面（{pos} 条），{neg_p}% 偏负面（{neg}），大约 {neu_p}% 处在中性或摇摆（{neu}）。这一批数据里整体氛围偏暖，体验多半被读成加分项。负面部分仍值得关注——稳定性、节奏、上手与预期管理可能在产品和沟通里带来摩擦。各语言同一套标准，因此呈现的是总体走向，而非逐字摘录。",
        "ru": "Примерно {pos_p}% звучат позитивно ({pos} голосов), {neg_p}% — негативно ({neg}), около {neu_p}% остаются в нейтральной или смешанной зоне ({neu}). На этом срезе картинка в целом доброжелательная: опыт чаще читают как удачный. Доля негатива всё равно важна — стабильность, темп, первый контакт и ясность ожиданий могут давать трение, за которым стоит следить в продукте и коммуникациях. Языки оцениваются одинаково, поэтому это общий наклон, а не дословные цитаты.",
        "pt": "Cerca de {pos_p}% soa positivo ({pos} vozes), {neg_p}% negativo ({neg}) e uns {neu_p}% neutros ou indecisos ({neu}). Neste recorte o ambiente é sobretudo bom: a experiência tende a ser lida de forma favorável. Mesmo assim o lado negativo importa — estabilidade, ritmo, primeira utilização ou gestão de expectativas podem criar atrito em produto e comunicação. Com o mesmo critério para todas as línguas, o que ouve é a inclinação geral, não trechos literais.",
    },
    "dash.summary_narrative_negative": {
        "tr": "olumsuz taraf kabaca %{neg_p} ({neg} görüş), olumlu taraf %{pos_p} ({pos}), nötr ya da karışık his de %{neu_p} civarında ({neu}). tablo net bir mesaj veriyor: kullanıcı kitlesinin geniş bir kesimi şu an sıkıntılı veya temkinli. olumlu sinyaller hâlâ çıkabilir ama bu dilimde eleştiren kütleyi geçmiyor. pratikte dikkat stabiliteye, hata temizliğine, gelirin hissedilirliğine ve değer vaadinin netliğine kaymalı. ölçüt tüm dillerde aynı; okunan şey tekil ifadeler değil genel duygu profili.",
        "en": "About {neg_p}% skew negative ({neg} voices), {pos_p}% skew positive ({pos}), and roughly {neu_p}% land neutral or mixed ({neu}). The picture is blunt: a wide slice of the audience sounds unhappy or wary right now. Positives may still surface, but they do not outweigh the dominant critical mass in this window. In practice, weight stability, bug cleanup, how monetization feels, and how clearly promised value shows up. The same yardstick applies across languages—this is the broad sentiment profile, not local phrasing.",
        "es": "Alrededor del {neg_p}% se inclina a lo negativo ({neg} voces), el {pos_p}% a lo positivo ({pos}) y un {neu_p}% queda neutro o mixto ({neu}). La lectura es franca: una parte grande de la base suena insatisfecha o preocupada. Pueden aparecer matices positivos, pero no superan la masa crítica dominante en este recorte. En la práctica, prioriza estabilidad, corrección de fallos, la sensación de equidad de la monetización y una promesa de valor más clara. Con el mismo criterio para todos los idiomas, es la foto amplia del sentimiento, no frases locales.",
        "de": "Etwa {neg_p}% tendieren negativ ({neg} Stimmen), {pos_p}% positiv ({pos}), rund {neu_p}% bleiben neutral oder gemischt ({neu}). Klartext: ein großer Teil der Nutzerbasis wirkt gerade unzufrieden oder besorgt. Positive Signale gibt es noch, aber sie überwiegen in diesem Ausschnitt nicht die kritische Masse. Praktisch zählen Stabilität, Bug-Fixes, wie Monetarisierung wahrgenommen wird, und klar kommunizierter Nutzen. Alle Sprachen gleich gewertet—das große Stimmungsbild, keine lokale Formulierung.",
        "fr": "Environ {neg_p}% penchent négatif ({neg} voix), {pos_p}% positif ({pos}), et quelque {neu_p}% restent neutres ou mitigés ({neu}). Clairement, une large part de l’audience sonne mécontente ou inquiète. Des points positifs peuvent encore apparaître, mais ils ne l’emportent pas sur la masse critique dominante sur ce segment. Concrètement, pensez stabilité, correction des bugs, équité ressentie de la monétisation et valeur promise plus lisible. Même critère pour toutes les langues : tendance globale, pas une formulation locale.",
        "ar": "نحو {neg_p}% يميل للسلب ({neg} صوتًا)، و{pos_p}% للإيجاب ({pos})، وحوالي {neu_p}% محايد أو مختلط ({neu}). الصورة صريحة: شريحة واسعة من الجمهور تبدو غير راضية أو قلقة. قد تظهر إيجابيات، لكنها لا تطغى على الكتلة النقدية السائدة في هذه القطعة. عمليًا ركّزوا على الاستقرار، إصلاح الأعطال، إنصاف الإيرادات كما يُحسّ به، ووضوح القيمة المقدَّمة. اللغات تُقيَّم بنفس المعيار؛ صورة المشاعر العامة لا صياغة محلية.",
        "zh": "约 {neg_p}% 偏负面（{neg} 条），{pos_p}% 偏正面（{pos}），约 {neu_p}% 中性或混合（{neu}）。画面很直白：相当大一部分用户听起来不满意或担忧。正面声音可能还在，但在这批数据里压不过主导的批评声。落地时优先抓稳定性、修缺陷、变现是否“感觉公平”，以及价值承诺是否清楚。各语言同一标准，因此是总体情绪画像，不是局部措辞。",
        "ru": "Примерно {neg_p}% уходит в минус ({neg} голосов), {pos_p}% в плюс ({pos}), около {neu_p}% остаётся нейтральным или смешанным ({neu}). Прямо: заметная часть аудитории звучит недовольной или обеспокоенной. Плюсы ещё мелькают, но в этом срезе они не перебивают доминирующую критическую массу. На практике держите в фокусе стабильность, починку багов, ощущаемую справедливость монетизации и ясность ценности. Языки считаются одинаково — общий срез настроения, не локальные формулировки.",
        "pt": "Cerca de {neg_p}% inclina-se para o negativo ({neg} vozes), {pos_p}% para o positivo ({pos}) e uns {neu_p}% ficam neutros ou mistos ({neu}). A leitura é direta: uma fatia grande do público soa insatisfeita ou preocupada. Ainda há matizes positivos, mas não ultrapassam a massa crítica dominante neste recorte. Na prática, foque estabilidade, correção de erros, justiça percebida da monetização e valor prometido mais claro. Todas as línguas no mesmo critério — retrato amplo, não frases locais.",
    },
    "dash.summary_narrative_mixed": {
        "tr": "yaklaşık %{pos_p} olumlu ({pos}), %{neg_p} olumsuz ({neg}), %{neu_p} da nötr ya da ikisi karışık ({neu}). tek bir anlatı hâkim değil: hem memnuniyet hem hayal kırıklığı belirgin. bunu beklentilerin ikiye ayrıldığı bir tablo gibi okumak işe yarar — bir kesim güçlü değer görürken diğeri tıkanıyor ya da vaat ile gerçeklik arasında kalıyor. yol haritasında segmentlere göre denge kurmak, tek hikâyeye sıkışmaktan daha sağlıklı. özet, tüm dillerde aynı terazide birleşen oranlara dayanır.",
        "en": "Roughly {pos_p}% read positive ({pos}), {neg_p}% negative ({neg}), and about {neu_p}% sit neutral or mixed ({neu}). No single story wins: satisfaction and frustration both read loud. I would frame it as split expectations—one segment sees strong value while another hits friction or a gap between promise and reality. Roadmaps breathe easier when you balance segments instead of forcing one narrative for everyone. The readout tracks blended ratios across languages, not individual lines.",
        "es": "Más o menos {pos_p}% suena positivo ({pos}), {neg_p}% negativo ({neg}) y un {neu_p}% neutro o mixto ({neu}). No gana una sola historia: conviven satisfacción y frustración con fuerza. Lo leería como expectativas partidas—un segmento ve mucho valor y otro choca con bloqueos o con la brecha entre lo prometido y lo vivido. Los roadmaps ganan equilibrando segmentos en vez de imponer un relato único. Con el mismo criterio para todos los idiomas, la guía sigue las proporciones, no frases sueltas.",
        "de": "Etwa {pos_p}% wirken positiv ({pos}), {neg_p}% negativ ({neg}), rund {neu_p}% neutral oder gemischt ({neu}). Es gibt keine dominante Einzelgeschichte: Zufriedenheit und Frustration stehen nebeneinander, beide laut. Ich lese das als gespaltene Erwartungen—ein Teil sieht starken Nutzen, ein anderer stößt auf Blocker oder eine Lücke zwischen Versprechen und Realität. Roadmaps funktionieren besser mit segmentweiser Balance statt einer Einheitsstory. Sprachen gleich gewichtet; die Leitplanken folgen den Anteilen, nicht Einzelsätzen.",
        "fr": "Environ {pos_p}% sonnent positifs ({pos}), {neg_p}% négatifs ({neg}), et quelque {neu_p}% neutres ou mixtes ({neu}). Aucune narration ne l’emporte : satisfaction et frustration coexistent, fortement. Je lirais ça comme des attentes coupées en deux—un segment voit beaucoup de valeur, l’autre bute sur des blocages ou l’écart promesse / réalité. Les roadmaps gagnent à équilibrer les segments plutôt qu’à imposer une seule histoire. Langues notées pareil : la piste suit les proportions, pas des phrases isolées.",
        "ar": "نحو {pos_p}% يبدو إيجابيًا ({pos})، و{neg_p}% سلبيًا ({neg})، وحوالي {neu_p}% محايدًا أو مختلطًا ({neu}). لا قصة واحدة تسيطر: الرضا والإحباط يظهران معًا وبقوة. أقرأها كتوقعات منقسمة—شريحة ترى قيمة كبيرة وأخرى تصطدم بعوائق أو فجوة بين الوعد والتجربة. تنجح الخطط عند موازنة الشرائح بدل فرض سرد واحد للجميع. اللغات تُدمج بنفس المعيار؛ التوجيه يتبع النِسَب لا جملًا منفردة.",
        "zh": "大约 {pos_p}% 偏正面（{pos}），{neg_p}% 偏负面（{neg}），约 {neu_p}% 中性或混合（{neu}）。没有哪条叙事一边倒：满意和受挫同时都很显眼。我会把它读成预期在拉扯——有人看到很强的价值，有人卡在阻碍或“承诺 vs 现实”的落差。路线图更适合按人群做平衡，而不是强行一套故事讲给所有人。各语言同一标准，指引跟着比例走，而不是零散句子。",
        "ru": "Примерно {pos_p}% звучит позитивно ({pos}), {neg_p}% — негативно ({neg}), около {neu_p}% нейтрально или смешанно ({neu}). Одной истории не видно: удовлетворение и разочарование соседствуют и оба громкие. Читаю это как раскол ожиданий — одни видят сильную ценность, другие упираются в блокеры или разрыв между обещанием и реальностью. Дорожным картам легче жить с балансом сегментов, чем с одним сюжетом для всех. Языки смешиваются одинаково — ориентиры на долях, не на отдельных фразах.",
        "pt": "Cerca de {pos_p}% soa positivo ({pos}), {neg_p}% negativo ({neg}) e uns {neu_p}% neutro ou misto ({neu}). Não há uma narrativa a ganhar: satisfação e frustração aparecem juntas, em alto. Eu leria como expectativas repartidas — um segmento vê muito valor, outro encontra bloqueios ou distância entre promessa e realidade. Roadmaps funcionam melhor equilibrando segmentos do que forçando uma história única. Mesmo critério para todas as línguas; a orientação segue as proporções, não frases soltas.",
    },
    "dash.summary_key_phrases": {
        "tr": "Öne çıkan ifadeler: {items}.",
        "en": "Key phrases: {items}.",
        "es": "Frases destacadas: {items}.",
        "de": "Hervorgehobene Phrasen: {items}.",
        "fr": "Expressions clés : {items}.",
        "ar": "العبارات البارزة: {items}.",
        "zh": "关键短语：{items}。",
        "ru": "Ключевые фразы: {items}.",
        "pt": "Frases em destaque: {items}.",
    },
    "dash.summary_neg_samples": {
        "tr": "Olumsuz örnekler: {items}.",
        "en": "Negative examples: {items}.",
        "es": "Ejemplos negativos: {items}.",
        "de": "Negative Beispiele: {items}.",
        "fr": "Exemples négatifs : {items}.",
        "ar": "أمثلة سلبية: {items}.",
        "zh": "负面示例：{items}。",
        "ru": "Примеры негатива: {items}.",
        "pt": "Exemplos negativos: {items}.",
    },
    "dash.summary_subtitle_fast": {
        "tr": "Hızlı analiz özeti", "en": "Quick analysis summary",
        "es": "Resumen del análisis rápido", "de": "Zusammenfassung der Schnellanalyse",
        "fr": "Résumé de l'analyse rapide", "ar": "ملخص التحليل السريع",
        "zh": "快速分析摘要", "ru": "Краткая сводка анализа",
        "pt": "Resumo da análise rápida",
    },
    "dash.summary_subtitle_rich": {
        "tr": "Zengin analiz — özet", "en": "Rich analysis — summary",
        "es": "Análisis enriquecido — resumen", "de": "Detailanalyse — Zusammenfassung",
        "fr": "Analyse enrichie — résumé", "ar": "تحليل غني — ملخص",
        "zh": "深度分析 — 摘要", "ru": "Глубокий анализ — сводка",
        "pt": "Análise aprofundada — resumo",
    },
    "dash.persona_version": {
        "tr": "En yoğun sürüm / kanal:", "en": "Top version / channel:",
        "es": "Versión / canal principal:", "de": "Top-Version / Kanal:",
        "fr": "Version / canal principal :", "ar": "أبرز إصدار / قناة:",
        "zh": "最主要版本 / 渠道：", "ru": "Топ-версия / канал:",
        "pt": "Versão / canal principal:",
    },
    "dash.persona_language": {
        "tr": "Hakim dil etiketi:", "en": "Dominant language tag:",
        "es": "Etiqueta de idioma dominante:", "de": "Dominierendes Sprach-Tag:",
        "fr": "Étiquette de langue dominante :", "ar": "وسم اللغة السائد:",
        "zh": "主要语言标签：", "ru": "Преобладающий язык:",
        "pt": "Rótulo de idioma dominante:",
    },
    "dash.persona_note": {
        "tr": "profil satırı havuzu kısa biçimde okur; yorum metnini buraya satır satır taşımıyoruz.",
        "en": "This line is a quick read of the pool—not a transcript of individual reviews.",
        "es": "La línea resume el bloque de un vistazo; no es una transcripción comentario por comentario.",
        "de": "Die Zeile fasst den Pool knapp zusammen—kein Review‑Transkript.",
        "fr": "Cette ligne lit le bloc en bref ; ce n’est pas une retranscription avis par avis.",
        "ar": "هذا السطر يقرأ المجموعة بسرعة؛ وليس نسخاً للمراجعات سطراً بسطر.",
        "zh": "这一行是对评论池的快速读解，并非逐条复述评论原文。",
        "ru": "Строка даёт быстрый срез пула, а не расшифровку каждого отзыва.",
        "pt": "A linha resume o conjunto de relance—não é transcrição comentário a comentário.",
    },
    "dash.persona_note_label": {
        "tr": "Not:", "en": "Note:", "es": "Nota:", "de": "Hinweis:",
        "fr": "Note :", "ar": "ملاحظة:", "zh": "注：", "ru": "Примечание:", "pt": "Nota:",
    },
    "dash.undetermined": {
        "tr": "Belirlenemedi", "en": "Undetermined", "es": "No determinado",
        "de": "Unbestimmt", "fr": "Indéterminé", "ar": "غير محدد",
        "zh": "未确定", "ru": "Не определено", "pt": "Indeterminado",
    },
    "dash.summary_counts_line": {
        "tr": "{pos} olumlu · {neg} olumsuz · {neu} görüş analiz edildi",
        "en": "{pos} positive · {neg} negative · {neu} opinions analyzed",
        "es": "{pos} positivos · {neg} negativos · {neu} opiniones analizadas",
        "de": "{pos} positiv · {neg} negativ · {neu} Meinungen analysiert",
        "fr": "{pos} positifs · {neg} négatifs · {neu} avis analysés",
        "ar": "{pos} إيجابي · {neg} سلبي · {neu} رأي تم تحليله",
        "zh": "已分析 {pos} 正面 · {neg} 负面 · {neu} 意见",
        "ru": "Проанализировано {pos} поз. · {neg} нег. · {neu} мнений",
        "pt": "{pos} positivas · {neg} negativas · {neu} opiniões analisadas",
    },
    "dash.month_1": {"tr": "Ocak", "en": "January", "es": "Enero", "de": "Januar", "fr": "Janvier", "ar": "يناير", "zh": "一月", "ru": "Январь", "pt": "Janeiro"},
    "dash.month_2": {"tr": "Şubat", "en": "February", "es": "Febrero", "de": "Februar", "fr": "Février", "ar": "فبراير", "zh": "二月", "ru": "Февраль", "pt": "Fevereiro"},
    "dash.month_3": {"tr": "Mart", "en": "March", "es": "Marzo", "de": "März", "fr": "Mars", "ar": "مارس", "zh": "三月", "ru": "Март", "pt": "Março"},
    "dash.month_4": {"tr": "Nisan", "en": "April", "es": "Abril", "de": "April", "fr": "Avril", "ar": "أبريل", "zh": "四月", "ru": "Апрель", "pt": "Abril"},
    "dash.month_5": {"tr": "Mayıs", "en": "May", "es": "Mayo", "de": "Mai", "fr": "Mai", "ar": "مايو", "zh": "五月", "ru": "Май", "pt": "Maio"},
    "dash.month_6": {"tr": "Haziran", "en": "June", "es": "Junio", "de": "Juni", "fr": "Juin", "ar": "يونيو", "zh": "六月", "ru": "Июнь", "pt": "Junho"},
    "dash.month_7": {"tr": "Temmuz", "en": "July", "es": "Julio", "de": "Juli", "fr": "Juillet", "ar": "يوليو", "zh": "七月", "ru": "Июль", "pt": "Julho"},
    "dash.month_8": {"tr": "Ağustos", "en": "August", "es": "Agosto", "de": "August", "fr": "Août", "ar": "أغسطس", "zh": "八月", "ru": "Август", "pt": "Agosto"},
    "dash.month_9": {"tr": "Eylül", "en": "September", "es": "Septiembre", "de": "September", "fr": "Septembre", "ar": "سبتمبر", "zh": "九月", "ru": "Сентябрь", "pt": "Setembro"},
    "dash.month_10": {"tr": "Ekim", "en": "October", "es": "Octubre", "de": "Oktober", "fr": "Octobre", "ar": "أكتوبر", "zh": "十月", "ru": "Октябрь", "pt": "Outubro"},
    "dash.month_11": {"tr": "Kasım", "en": "November", "es": "Noviembre", "de": "November", "fr": "Novembre", "ar": "نوفمبر", "zh": "十一月", "ru": "Ноябрь", "pt": "Novembro"},
    "dash.month_12": {"tr": "Aralık", "en": "December", "es": "Diciembre", "de": "Dezember", "fr": "Décembre", "ar": "ديسمبر", "zh": "十二月", "ru": "Декабрь", "pt": "Dezembro"},
    "dash.trend_insufficient": {
        "tr": "Yeterli veri yok",
        "en": "Not enough data",
        "es": "Datos insuficientes",
        "de": "Nicht genug Daten",
        "fr": "Données insuffisantes",
        "ar": "لا توجد بيانات كافية",
        "zh": "数据不足",
        "ru": "Недостаточно данных",
        "pt": "Dados insuficientes",
    },
    # --------- PDF özel metinler ---------
    "pdf.subject": {
        "tr": "duygu analizi raporu",
        "en": "sentiment analysis report",
        "es": "informe de análisis de sentimiento",
        "de": "Stimmungsanalyse-Bericht",
        "fr": "rapport d'analyse de sentiment",
        "ar": "تقرير تحليل المشاعر",
        "zh": "情感分析报告",
        "ru": "отчёт анализа тональности",
        "pt": "relatório de análise de sentimento",
    },
    "pdf.source_label": {
        "tr": "kaynak", "en": "source", "es": "fuente", "de": "Quelle",
        "fr": "source", "ar": "المصدر", "zh": "来源", "ru": "источник", "pt": "fonte",
    },
    "pdf.generated_at": {
        "tr": "oluşturulma", "en": "generated", "es": "generado",
        "de": "erstellt", "fr": "généré le", "ar": "تاريخ الإنشاء",
        "zh": "生成于", "ru": "создано", "pt": "gerado em",
    },
    "pdf.reviews_section_title": {
        "tr": "Yorum Listesi",
        "en": "Review List",
        "es": "Lista de reseñas",
        "de": "Bewertungsliste",
        "fr": "Liste des avis",
        "ar": "قائمة المراجعات",
        "zh": "评论列表",
        "ru": "Список отзывов",
        "pt": "Lista de avaliações",
    },
    "pdf.reviews_count": {
        "tr": "Kayıt sayısı: {n}",
        "en": "Record count: {n}",
        "es": "Registros: {n}",
        "de": "Anzahl Einträge: {n}",
        "fr": "Nombre d'enregistrements : {n}",
        "ar": "عدد السجلات: {n}",
        "zh": "记录数：{n}",
        "ru": "Количество записей: {n}",
        "pt": "Total de registros: {n}",
    },
    "pdf.row_prefix": {
        "tr": "#{i}", "en": "#{i}", "es": "#{i}", "de": "#{i}",
        "fr": "n°{i}", "ar": "#{i}", "zh": "#{i}", "ru": "№{i}", "pt": "#{i}",
    },
    "pdf.app_section_prefix": {
        "tr": "Uygulama", "en": "Application", "es": "Aplicación", "de": "Anwendung",
        "fr": "Application", "ar": "التطبيق", "zh": "应用", "ru": "Приложение", "pt": "Aplicativo",
    },
    "pdf.subtitle_single": {
        "tr": "Tek uygulama analizi",
        "en": "Single application analysis",
        "es": "Análisis de una sola aplicación",
        "de": "Einzel-App-Analyse",
        "fr": "Analyse d'une seule application",
        "ar": "تحليل تطبيق واحد",
        "zh": "单应用分析",
        "ru": "Анализ одного приложения",
        "pt": "Análise de aplicativo único",
    },
    "pdf.subtitle_compare": {
        "tr": "Karşılaştırma: {a} ve {b}",
        "en": "Comparison: {a} vs {b}",
        "es": "Comparación: {a} vs {b}",
        "de": "Vergleich: {a} vs. {b}",
        "fr": "Comparaison : {a} vs {b}",
        "ar": "المقارنة: {a} مقابل {b}",
        "zh": "对比：{a} 与 {b}",
        "ru": "Сравнение: {a} vs {b}",
        "pt": "Comparação: {a} vs {b}",
    },
    "store.slot_input_label": {
        "tr": "{heading} — uygulama ara veya mağaza linki / ID",
        "en": "{heading} — search an app or paste a store link / ID",
        "es": "{heading} — busca una app o pega un enlace / ID",
        "de": "{heading} — App suchen oder Link / ID einfügen",
        "fr": "{heading} — rechercher une app ou coller un lien / ID",
        "ar": "{heading} — ابحث عن تطبيق أو ألصق رابط / معرف المتجر",
        "zh": "{heading} — 搜索应用或粘贴商店链接 / ID",
        "ru": "{heading} — поиск приложения либо ссылка / ID",
        "pt": "{heading} — busque um app ou cole link / ID",
    },
}

# Japonca çeviriler (dosya boyutu için ayrı modülde tutulur; STRINGS ile aynı anahtarlar)
from vivindis.config.i18n_ja_overlay import JA as _JA_OVERLAY

for _k, _ja in _JA_OVERLAY.items():
    if _k in STRINGS:
        STRINGS[_k]["ja"] = _ja


def get_lang() -> str:
    v = _ui_lang_ctx.get()
    if isinstance(v, str) and v in _LANG_CODES:
        return v
    return DEFAULT_LANG


@contextmanager
def use_ui_lang(code: str) -> Iterator[None]:
    """İstek veya test bloğu için dil bağlamı."""
    if code not in _LANG_CODES:
        code = DEFAULT_LANG
    token: Token = _ui_lang_ctx.set(code)
    try:
        yield
    finally:
        _ui_lang_ctx.reset(token)


def set_ui_lang(code: str) -> Token | None:
    """Elle bağlam ayarla; `reset_ui_lang(token)` ile geri al."""
    if code not in _LANG_CODES:
        return None
    return _ui_lang_ctx.set(code)


def reset_ui_lang(token: Token | None) -> None:
    if token is not None:
        _ui_lang_ctx.reset(token)


def set_lang(code: str) -> None:
    """Geriye dönük uyum: dil bağlamını günceller (Streamlit session yok)."""
    if code in _LANG_CODES:
        _ui_lang_ctx.set(code)


def lang_query_suffix(leading: str = "?") -> str:
    """Navigasyon linkleri için `?lang=fr` tarzı ek. TR default olduğunda boş
    string döner — URL temiz kalır."""
    code = get_lang()
    if code == DEFAULT_LANG:
        return ""
    return f"{leading}lang={code}"


def lang_meta(code: str) -> tuple[str, str]:
    for c, name, flag in LANGUAGES:
        if c == code:
            return name, flag
    return code, ""


def t(key: str, default: str | None = None, **kwargs) -> str:
    lang = get_lang()
    entry = STRINGS.get(key)
    val: str | None = None
    if entry:
        val = entry.get(lang) or entry.get(DEFAULT_LANG)
    if val is None:
        val = default if default is not None else key
    if kwargs:
        try:
            val = val.format(**kwargs)
        except Exception:
            pass
    return val
