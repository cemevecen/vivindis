"""Hakkında gövdesi — `streamlit_app` içinde masthead pill seçimiyle gösterilir."""

from __future__ import annotations

import streamlit as st

from vivindis.config.i18n import get_lang, t


ABOUT_BODY: dict[str, str] = {
    "tr": """
<div class="about-card">
  <p><strong>geliştiren: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>girdi kanalları</span><strong>mağaza linki · dosya · metin · karşılaştırma</strong></div>
    <div class="about-kpi"><span>analiz modları</span><strong>hızlı (heuristic) · zengin (llm)</strong></div>
    <div class="about-kpi"><span>çıktılar</span><strong>dashboard · yorum kartları · csv/excel/pdf</strong></div>
  </div>
  <p>
    Bu platform, binlerce uygulama yorumunu tek ekranda toplar ve kullanıcıların aslında ne hissettiğini anlaşılır bir özete çevirir.
    Hızlı mod basit kurallarla çalışır; yorumları saniyeler içinde olumlu, olumsuz ve nötr olarak ayırıp genel tabloyu gösterir.
    Zengin mod bir yapay zekâ modeli kullanır; cümlenin tonunu, bağlamını ve ince ayrıntılarını daha iyi yorumlar.
    Genel eğilimi tek bakışta görebilir, istediğin yorumu tek tek açıp hangi cümlenin hangi sonucu ürettiğini kontrol edebilirsin.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>aşama</th><th>ne olur</th><th>çıktı</th></tr></thead>
      <tbody>
        <tr><td>1. toplama</td><td>yorumlar seçilen kaynaktan alınır ve normalize edilir</td><td>temiz giriş havuzu</td></tr>
        <tr><td>2. filtreleme</td><td>tekrarlı ve düşük sinyalli kayıtlar ayıklanır</td><td>analize hazır veri seti</td></tr>
        <tr><td>3. skorlama</td><td>heuristic veya llm hattı duygu ve bağlam analizi yapar</td><td>yapısal duygu satırları</td></tr>
        <tr><td>4. özetleme</td><td>metrikler, dağılımlar ve uygulama bazlı kıyaslar üretilir</td><td>aksiyon alınabilir ürün görünümü</td></tr>
        <tr><td>5. dışa aktarma</td><td>ham ve analizlenmiş çıktılar raporlama için hazırlanır</td><td>csv, excel, pdf dosyaları</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>özellik</th><th>kapsam</th></tr></thead>
      <tbody>
        <tr><td>tek uygulama analizi</td><td>tek ürün için duygu kalitesi ve trend görünümü</td></tr>
        <tr><td>karşılaştırma modu</td><td>iki uygulamayı aynı zaman penceresinde hizalı kıyaslama</td></tr>
        <tr><td>operasyonel raporlama</td><td>ürün, destek ve operasyon ekipleriyle paylaşılabilir çıktı</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "en": """
<div class="about-card">
  <p><strong>developer: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>input channels</span><strong>store link · file · text · compare</strong></div>
    <div class="about-kpi"><span>analysis modes</span><strong>fast (heuristic) · rich (llm)</strong></div>
    <div class="about-kpi"><span>outputs</span><strong>dashboard · review cards · csv/excel/pdf</strong></div>
  </div>
  <p>
    This platform reads thousands of app reviews in one place and turns them into a clear picture of what users actually feel.
    Fast mode gives a quick and consistent sentiment read using simple rules; Rich mode uses an AI model to better understand tone, context and nuance.
    You can follow the overall trend and still open each individual review to see the exact words behind every number.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>stage</th><th>what happens</th><th>result</th></tr></thead>
      <tbody>
        <tr><td>1. collect</td><td>reviews are fetched from the selected source and normalized</td><td>clean input pool</td></tr>
        <tr><td>2. filter</td><td>duplicates and low-signal entries are removed</td><td>analysis-ready dataset</td></tr>
        <tr><td>3. score</td><td>heuristic or llm pipeline runs sentiment and context extraction</td><td>structured sentiment rows</td></tr>
        <tr><td>4. summarize</td><td>metrics, distributions, and app-level comparisons are aggregated</td><td>actionable product view</td></tr>
        <tr><td>5. export</td><td>raw and analyzed outputs are generated for reporting</td><td>csv, excel, pdf files</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>capability</th><th>scope</th></tr></thead>
      <tbody>
        <tr><td>single-app analysis</td><td>sentiment quality view for one product timeline</td></tr>
        <tr><td>compare mode</td><td>same-window benchmark for two apps with aligned settings</td></tr>
        <tr><td>operational exports</td><td>sharable output for product, support and ops teams</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "es": """
<div class="about-card">
  <p><strong>desarrollador: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>canales de entrada</span><strong>enlace de tienda · archivo · texto · comparar</strong></div>
    <div class="about-kpi"><span>modos de análisis</span><strong>rápido (heurística) · avanzado (llm)</strong></div>
    <div class="about-kpi"><span>salidas</span><strong>panel · tarjetas de reseñas · csv/excel/pdf</strong></div>
  </div>
  <p>
    Esta plataforma reúne miles de reseñas de apps en un solo lugar y las convierte en una imagen clara de lo que los usuarios realmente sienten.
    El modo Rápido ofrece una lectura de sentimiento rápida y coherente con reglas simples; el modo Avanzado usa un modelo de IA para entender mejor el tono, el contexto y los matices.
    Puedes seguir la tendencia general y también abrir cada reseña para ver con exactitud las palabras detrás de cada número.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>etapa</th><th>qué ocurre</th><th>resultado</th></tr></thead>
      <tbody>
        <tr><td>1. recopilar</td><td>las reseñas se obtienen de la fuente seleccionada y se normalizan</td><td>pool de entrada limpio</td></tr>
        <tr><td>2. filtrar</td><td>se eliminan duplicados y entradas de baja señal</td><td>conjunto listo para el análisis</td></tr>
        <tr><td>3. puntuar</td><td>el pipeline heurístico o llm extrae sentimiento y contexto</td><td>filas de sentimiento estructuradas</td></tr>
        <tr><td>4. resumir</td><td>se agregan métricas, distribuciones y comparaciones</td><td>vista de producto accionable</td></tr>
        <tr><td>5. exportar</td><td>se preparan salidas brutas y analizadas para reportes</td><td>archivos csv, excel, pdf</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>capacidad</th><th>alcance</th></tr></thead>
      <tbody>
        <tr><td>análisis de una app</td><td>calidad de sentimiento y tendencia para un producto</td></tr>
        <tr><td>modo comparación</td><td>benchmark alineado entre dos apps en la misma ventana</td></tr>
        <tr><td>exportaciones operativas</td><td>salida compartible con equipos de producto, soporte y operaciones</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "de": """
<div class="about-card">
  <p><strong>Entwickler: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>Eingabekanäle</span><strong>Store-Link · Datei · Text · Vergleich</strong></div>
    <div class="about-kpi"><span>Analysemodi</span><strong>schnell (heuristisch) · ausführlich (llm)</strong></div>
    <div class="about-kpi"><span>Ausgaben</span><strong>Dashboard · Rezensions-Cards · csv/excel/pdf</strong></div>
  </div>
  <p>
    Diese Plattform bündelt tausende App-Rezensionen an einem Ort und verwandelt sie in ein klares Bild davon, wie Nutzer wirklich empfinden.
    Der Schnellmodus liefert eine rasche, konsistente Stimmungsauswertung mit einfachen Regeln; der ausführliche Modus setzt ein KI-Modell ein, um Ton, Kontext und Nuancen besser zu erfassen.
    Du kannst den Gesamttrend im Blick behalten und jede einzelne Rezension öffnen, um die Worte hinter jeder Zahl zu sehen.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>Schritt</th><th>was passiert</th><th>Ergebnis</th></tr></thead>
      <tbody>
        <tr><td>1. Sammeln</td><td>Rezensionen werden aus der gewählten Quelle geholt und normalisiert</td><td>sauberer Eingabepool</td></tr>
        <tr><td>2. Filtern</td><td>Duplikate und signalarme Einträge werden entfernt</td><td>analysetaugliches Datenset</td></tr>
        <tr><td>3. Bewerten</td><td>heuristische oder LLM-Pipeline extrahiert Sentiment und Kontext</td><td>strukturierte Sentiment-Zeilen</td></tr>
        <tr><td>4. Zusammenfassen</td><td>Metriken, Verteilungen und App-Vergleiche werden aggregiert</td><td>handlungsreife Produktsicht</td></tr>
        <tr><td>5. Exportieren</td><td>rohe und ausgewertete Ausgaben werden für Reporting vorbereitet</td><td>CSV-, Excel-, PDF-Dateien</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>Fähigkeit</th><th>Umfang</th></tr></thead>
      <tbody>
        <tr><td>Single-App-Analyse</td><td>Sentiment-Qualität und Trend für ein Produkt</td></tr>
        <tr><td>Vergleichsmodus</td><td>aufeinander abgestimmter Benchmark zweier Apps im gleichen Zeitfenster</td></tr>
        <tr><td>operative Exporte</td><td>teilbare Ausgabe für Produkt-, Support- und Ops-Teams</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "fr": """
<div class="about-card">
  <p><strong>développeur : cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>canaux d'entrée</span><strong>lien boutique · fichier · texte · comparer</strong></div>
    <div class="about-kpi"><span>modes d'analyse</span><strong>rapide (heuristique) · enrichi (llm)</strong></div>
    <div class="about-kpi"><span>sorties</span><strong>tableau de bord · cartes d'avis · csv/excel/pdf</strong></div>
  </div>
  <p>
    Cette plateforme regroupe des milliers d'avis d'apps au même endroit et les transforme en une vision claire de ce que les utilisateurs ressentent vraiment.
    Le mode Rapide offre une lecture de sentiment rapide et cohérente à partir de règles simples ; le mode Enrichi utilise un modèle d'IA pour mieux saisir le ton, le contexte et les nuances.
    Tu peux suivre la tendance générale tout en ouvrant chaque avis pour voir précisément les mots derrière chaque chiffre.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>étape</th><th>ce qui se passe</th><th>résultat</th></tr></thead>
      <tbody>
        <tr><td>1. collecte</td><td>les avis sont récupérés depuis la source sélectionnée et normalisés</td><td>pool d'entrée propre</td></tr>
        <tr><td>2. filtrage</td><td>les doublons et entrées à faible signal sont retirés</td><td>jeu de données prêt à l'analyse</td></tr>
        <tr><td>3. notation</td><td>le pipeline heuristique ou llm extrait sentiment et contexte</td><td>lignes de sentiment structurées</td></tr>
        <tr><td>4. synthèse</td><td>métriques, distributions et comparaisons sont agrégées</td><td>vue produit actionnable</td></tr>
        <tr><td>5. export</td><td>sorties brutes et analysées prêtes pour le reporting</td><td>fichiers csv, excel, pdf</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>capacité</th><th>portée</th></tr></thead>
      <tbody>
        <tr><td>analyse d'une app</td><td>qualité de sentiment et tendance pour un produit</td></tr>
        <tr><td>mode comparaison</td><td>benchmark aligné entre deux apps sur la même fenêtre</td></tr>
        <tr><td>exports opérationnels</td><td>sortie partageable avec les équipes produit, support et opérations</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "ar": """
<div class="about-card" dir="rtl">
  <p><strong>المطور: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>قنوات الإدخال</span><strong>رابط المتجر · ملف · نص · مقارنة</strong></div>
    <div class="about-kpi"><span>أوضاع التحليل</span><strong>سريع (استدلالي) · غني (llm)</strong></div>
    <div class="about-kpi"><span>المخرجات</span><strong>لوحة · بطاقات مراجعات · csv/excel/pdf</strong></div>
  </div>
  <p>
    تجمع هذه المنصة آلاف مراجعات التطبيقات في مكان واحد وتحوّلها إلى صورة واضحة لما يشعر به المستخدمون فعلاً.
    يقدّم الوضع السريع قراءةً سريعة ومتسقة للمشاعر باستخدام قواعد بسيطة، بينما يستخدم الوضع الغني نموذج ذكاء اصطناعي لفهم النبرة والسياق والتفاصيل الدقيقة بشكل أفضل.
    يمكنك متابعة الاتجاه العام، كما يمكنك فتح كل مراجعة على حدة لرؤية الكلمات الفعلية وراء كل رقم.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>المرحلة</th><th>ما يحدث</th><th>النتيجة</th></tr></thead>
      <tbody>
        <tr><td>١. الجمع</td><td>تُجلب المراجعات من المصدر المختار ويتم تنسيقها</td><td>تجمع مدخلات نظيف</td></tr>
        <tr><td>٢. التصفية</td><td>تُحذف المكررات والإدخالات ضعيفة الإشارة</td><td>مجموعة بيانات جاهزة للتحليل</td></tr>
        <tr><td>٣. التقييم</td><td>الخط الاستدلالي أو LLM يستخرج المشاعر والسياق</td><td>صفوف مشاعر منظمة</td></tr>
        <tr><td>٤. التلخيص</td><td>تُجمَّع المقاييس والتوزيعات والمقارنات</td><td>رؤية منتج قابلة للتنفيذ</td></tr>
        <tr><td>٥. التصدير</td><td>تُجهَّز المخرجات الخام والمحلَّلة للتقارير</td><td>ملفات csv و excel و pdf</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>الإمكانية</th><th>النطاق</th></tr></thead>
      <tbody>
        <tr><td>تحليل تطبيق واحد</td><td>جودة المشاعر والاتجاه لمنتج واحد</td></tr>
        <tr><td>وضع المقارنة</td><td>مقارنة متزامنة لتطبيقين في النافذة الزمنية نفسها</td></tr>
        <tr><td>التصدير التشغيلي</td><td>مخرجات قابلة للمشاركة مع فرق المنتج والدعم والعمليات</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "zh": """
<div class="about-card">
  <p><strong>开发者：cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>输入通道</span><strong>商店链接 · 文件 · 文本 · 对比</strong></div>
    <div class="about-kpi"><span>分析模式</span><strong>快速（启发式）· 丰富（llm）</strong></div>
    <div class="about-kpi"><span>输出</span><strong>仪表盘 · 评论卡片 · csv/excel/pdf</strong></div>
  </div>
  <p>
    该平台将数以千计的应用评论汇集在一起，转化为用户真实感受的清晰画面。
    快速模式通过简单规则提供快速且一致的情感解读；丰富模式使用 AI 模型更好地理解语气、上下文与细节。
    你可以一目了然地把握整体趋势，并打开每条评论查看每个数字背后的具体文字。
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>阶段</th><th>发生什么</th><th>结果</th></tr></thead>
      <tbody>
        <tr><td>1. 采集</td><td>从所选来源获取评论并进行规范化处理</td><td>干净的输入池</td></tr>
        <tr><td>2. 筛选</td><td>移除重复项与低信号条目</td><td>可分析的数据集</td></tr>
        <tr><td>3. 评分</td><td>启发式或 LLM 管线执行情感与上下文抽取</td><td>结构化的情感行</td></tr>
        <tr><td>4. 汇总</td><td>聚合指标、分布与应用级对比</td><td>可执行的产品视图</td></tr>
        <tr><td>5. 导出</td><td>生成用于报告的原始与已分析输出</td><td>csv、excel、pdf 文件</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>能力</th><th>范围</th></tr></thead>
      <tbody>
        <tr><td>单应用分析</td><td>单一产品的情感质量与趋势视图</td></tr>
        <tr><td>对比模式</td><td>在同一时间窗口内两款应用的对齐基准</td></tr>
        <tr><td>运营导出</td><td>可分享给产品、支持与运营团队的输出</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "ru": """
<div class="about-card">
  <p><strong>разработчик: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>каналы ввода</span><strong>ссылка магазина · файл · текст · сравнение</strong></div>
    <div class="about-kpi"><span>режимы анализа</span><strong>быстрый (эвристика) · расширенный (llm)</strong></div>
    <div class="about-kpi"><span>выходные данные</span><strong>дашборд · карточки отзывов · csv/excel/pdf</strong></div>
  </div>
  <p>
    Эта платформа собирает тысячи отзывов о приложениях в одном месте и превращает их в понятную картину того, что пользователи на самом деле чувствуют.
    Быстрый режим даёт оперативную и согласованную оценку тональности по простым правилам; Расширенный режим использует ИИ-модель, чтобы лучше улавливать тон, контекст и нюансы.
    Можно следить за общим трендом и при этом открывать каждый отзыв отдельно, чтобы увидеть конкретные слова за каждым числом.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>этап</th><th>что происходит</th><th>результат</th></tr></thead>
      <tbody>
        <tr><td>1. сбор</td><td>отзывы забираются из выбранного источника и нормализуются</td><td>чистый входной пул</td></tr>
        <tr><td>2. фильтрация</td><td>удаляются дубликаты и записи с низким сигналом</td><td>датасет, готовый к анализу</td></tr>
        <tr><td>3. оценка</td><td>эвристический или LLM-пайплайн извлекает тональность и контекст</td><td>структурированные строки тональности</td></tr>
        <tr><td>4. сводка</td><td>агрегируются метрики, распределения и сравнения приложений</td><td>продуктовая картина с выводами</td></tr>
        <tr><td>5. экспорт</td><td>готовятся исходные и проанализированные выходные данные для отчётов</td><td>файлы csv, excel, pdf</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>возможность</th><th>охват</th></tr></thead>
      <tbody>
        <tr><td>анализ одного приложения</td><td>качество тональности и тренд для одного продукта</td></tr>
        <tr><td>режим сравнения</td><td>согласованный бенчмарк двух приложений в одном окне</td></tr>
        <tr><td>операционные экспорты</td><td>общий вывод для команд продукта, поддержки и операций</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "pt": """
<div class="about-card">
  <p><strong>desenvolvedor: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>canais de entrada</span><strong>link da loja · arquivo · texto · comparar</strong></div>
    <div class="about-kpi"><span>modos de análise</span><strong>rápido (heurística) · avançado (llm)</strong></div>
    <div class="about-kpi"><span>saídas</span><strong>painel · cartões de avaliação · csv/excel/pdf</strong></div>
  </div>
  <p>
    Esta plataforma reúne milhares de avaliações de apps em um só lugar e as transforma em uma imagem clara do que os usuários realmente sentem.
    O modo Rápido entrega uma leitura de sentimento rápida e consistente com regras simples; o modo Avançado usa um modelo de IA para compreender melhor tom, contexto e nuances.
    Você pode acompanhar a tendência geral e também abrir cada avaliação para ver exatamente as palavras por trás de cada número.
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>etapa</th><th>o que acontece</th><th>resultado</th></tr></thead>
      <tbody>
        <tr><td>1. coleta</td><td>as avaliações são obtidas da fonte escolhida e normalizadas</td><td>pool de entrada limpo</td></tr>
        <tr><td>2. filtragem</td><td>duplicatas e entradas de baixo sinal são removidas</td><td>dataset pronto para análise</td></tr>
        <tr><td>3. pontuação</td><td>pipeline heurístico ou LLM extrai sentimento e contexto</td><td>linhas de sentimento estruturadas</td></tr>
        <tr><td>4. resumo</td><td>métricas, distribuições e comparações entre apps são agregadas</td><td>visão de produto acionável</td></tr>
        <tr><td>5. exportação</td><td>saídas brutas e analisadas são preparadas para relatório</td><td>arquivos csv, excel, pdf</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>capacidade</th><th>escopo</th></tr></thead>
      <tbody>
        <tr><td>análise de um app</td><td>qualidade de sentimento e tendência para um produto</td></tr>
        <tr><td>modo comparação</td><td>benchmark alinhado entre dois apps na mesma janela</td></tr>
        <tr><td>exportações operacionais</td><td>saída compartilhável com os times de produto, suporte e operações</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
    "ja": """
<div class="about-card">
  <p><strong>開発者: cem evecen</strong></p>
  <div class="about-grid">
    <div class="about-kpi"><span>入力チャネル</span><strong>ストアリンク · ファイル · テキスト · 比較</strong></div>
    <div class="about-kpi"><span>分析モード</span><strong>高速（ヒューリスティック）· 詳細（LLM）</strong></div>
    <div class="about-kpi"><span>出力</span><strong>ダッシュボード · レビューカード · csv/excel/pdf</strong></div>
  </div>
  <p>
    このプラットフォームは数千件のアプリレビューを一つの画面に集め、ユーザーが実際に何を感じているかを分かりやすくまとめます。
    高速モードはシンプルなルールで素早く一貫した感情の読み取りを行い、詳細モードは AI モデルでニュアンスや文脈をより深く捉えます。
    全体の傾向を一望できるほか、各レビューを開いて数値の背後にある文言も確認できます。
  </p>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>段階</th><th>内容</th><th>結果</th></tr></thead>
      <tbody>
        <tr><td>1. 収集</td><td>選択したソースからレビューを取得し正規化</td><td>クリーンな入力プール</td></tr>
        <tr><td>2. フィルタ</td><td>重複や低シグナルの行を除去</td><td>分析可能なデータセット</td></tr>
        <tr><td>3. スコア</td><td>ヒューリスティックまたは LLM で感情・文脈を抽出</td><td>構造化された感情行</td></tr>
        <tr><td>4. 要約</td><td>指標・分布・アプリ間比較を集約</td><td>アクション可能なプロダクトビュー</td></tr>
        <tr><td>5. エクスポート</td><td>レポート用に生データと分析結果を整形</td><td>csv / excel / pdf</td></tr>
      </tbody>
    </table>
  </div>
  <div class="about-table-wrap">
    <table class="about-table">
      <thead><tr><th>機能</th><th>範囲</th></tr></thead>
      <tbody>
        <tr><td>単一アプリ分析</td><td>1製品の感情の質とトレンド</td></tr>
        <tr><td>比較モード</td><td>同一期間で2アプリを並べたベンチマーク</td></tr>
        <tr><td>運用向けエクスポート</td><td>プロダクト・サポート・オペレーションと共有できる出力</td></tr>
      </tbody>
    </table>
  </div>
</div>
""",
}


def render_about_body() -> None:
    st.markdown(
        f'<p class="section-title">{t("nav.about")}</p>',
        unsafe_allow_html=True,
    )
    lang = get_lang()
    body = ABOUT_BODY.get(lang) or ABOUT_BODY["en"]
    st.markdown(body, unsafe_allow_html=True)
