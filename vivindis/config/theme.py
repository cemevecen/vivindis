"""Streamlit görünüm katmanı — açık tema, yüksek kontrast, kart + turuncu CTA."""

APP_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

/* Font: yalnızca uygulama gövdesi — [class*="css"] kullanma (Streamlit widget'larını bozuyor) */
.stApp {
  font-family: 'Poppins', 'Source Sans Pro', sans-serif;
  background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 45%, #f8fafc 100%) !important;
  color: #0f172a;
}

/* Streamlit 1.33+ kök metin */
.stApp span, .stApp p, .stApp label {
  color: inherit;
}

.block-container {
  padding-top: 0.35rem !important;
  padding-bottom: 0.65rem !important;
  padding-left: clamp(0.75rem, 2vw, 1.5rem) !important;
  padding-right: clamp(0.75rem, 2vw, 1.5rem) !important;
  max-width: min(1240px, calc(100vw - 1.5rem)) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

/* Ana sütun — widget aralıklarını sıkılaştır */
[data-testid="stAppViewContainer"] .main [data-testid="element-container"], [data-testid="stAppScrollToBottomContainer"] [data-testid="element-container"] {
  margin-top: 0 !important;
  margin-bottom: 0.2rem !important;
}
[data-testid="stAppViewContainer"] .main hr, [data-testid="stAppScrollToBottomContainer"] hr {
  margin: 0.25rem 0 !important;
}
[data-testid="stAppViewContainer"] .main .stMarkdown, [data-testid="stAppScrollToBottomContainer"] .stMarkdown {
  margin-bottom: 0.15rem !important;
}
[data-testid="stAppViewContainer"] .main .stRadio, [data-testid="stAppScrollToBottomContainer"] .stRadio {
  margin-bottom: 0.1rem !important;
  padding-bottom: 0 !important;
}
[data-testid="stAppViewContainer"] .main .stButton, [data-testid="stAppScrollToBottomContainer"] .stButton {
  margin-bottom: 0.15rem !important;
}
[data-testid="stAppViewContainer"] .main [data-testid="stMetricContainer"], [data-testid="stAppScrollToBottomContainer"] [data-testid="stMetricContainer"] {
  margin-bottom: 0 !important;
  padding-top: 0.2rem !important;
  padding-bottom: 0.2rem !important;
}
[data-testid="stAppViewContainer"] .main [data-testid="stPlotlyChart"], [data-testid="stAppScrollToBottomContainer"] [data-testid="stPlotlyChart"] {
  margin-top: 0.2rem !important;
  margin-bottom: 0.2rem !important;
}
[data-testid="stAppViewContainer"] .main [data-testid="stColumn"], [data-testid="stAppScrollToBottomContainer"] [data-testid="stColumn"] {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
[data-testid="stAppViewContainer"] .main .streamlit-expander, [data-testid="stAppScrollToBottomContainer"] .streamlit-expander {
  margin-top: 0.15rem !important;
  margin-bottom: 0.15rem !important;
}
[data-testid="stAppViewContainer"] .main [data-testid="stCaption"], [data-testid="stAppScrollToBottomContainer"] [data-testid="stCaption"] {
  margin-top: 0.1rem !important;
  margin-bottom: 0.1rem !important;
}
[data-testid="stAppViewContainer"] .main .stProgress, [data-testid="stAppScrollToBottomContainer"] .stProgress {
  margin-top: 0.15rem !important;
  margin-bottom: 0.15rem !important;
}

/* Widget etiketleri — beyaz yazı / soluk yazı sorununu gider */
[data-testid="stWidgetLabel"] p,
[data-testid="stWidgetLabel"] label span,
.stWidget > label span {
  color: #0f172a !important;
  font-weight: 500 !important;
}

/* Veri kaynağı — sekme şeridi (segmented / tek vurgu) */
[data-testid="stTabs"] {
  margin-top: 2px;
}
[data-testid="stTabs"] [data-baseweb="tab-list"] {
  display: flex !important;
  width: 100% !important;
  flex-wrap: nowrap !important;
  gap: 8px !important;
  background: linear-gradient(180deg, #eef2f7 0%, #e2e8f0 100%) !important;
  padding: 8px !important;
  border-radius: 16px !important;
  border: 1px solid #d0d9e6 !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}
[data-testid="stTabs"] [data-baseweb="tab"] {
  flex: 1 1 0 !important;
  min-height: 48px !important;
  margin: 0 !important;
  padding: 10px 12px !important;
  border-radius: 12px !important;
  border: 1px solid transparent !important;
  border-bottom: none !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}
[data-testid="stTabs"] [data-baseweb="tab"]:hover {
  background: rgba(255, 255, 255, 0.55) !important;
}
[data-testid="stTabs"] [data-baseweb="tab"][aria-selected="true"] {
  background: #ffffff !important;
  border: 1px solid #a5b4fc !important;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.14), 0 1px 2px rgba(15, 23, 42, 0.05) !important;
}
[data-testid="stTabs"] [data-baseweb="tab"] p,
[data-testid="stTabs"] [data-baseweb="tab"] span {
  color: #64748b !important;
  font-weight: 500 !important;
  font-size: 0.88rem !important;
  line-height: 1.35 !important;
  text-align: center !important;
}
[data-testid="stTabs"] [data-baseweb="tab"][aria-selected="true"] p,
[data-testid="stTabs"] [data-baseweb="tab"][aria-selected="true"] span {
  color: #4338ca !important;
  font-weight: 600 !important;
}
/* BaseWeb seçili sekme alt çizgisi — kart vurgusu yeterli */
[data-testid="stTabs"] [data-baseweb="tab-highlight"] {
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
}
[data-testid="stTabs"] [data-baseweb="tab-panel"] {
  padding-top: 1.15rem !important;
}

/* Giriş alanları — açık kutu, koyu metin */
.stTextInput input,
.stNumberInput input,
.stSelectbox div[data-baseweb="select"] > div,
textarea {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 10px !important;
}

/* İpucu metni — gerçek girişle karışmasın diye belirgin şekilde silik */
.stTextInput input::placeholder,
.stTextInput input::-webkit-input-placeholder,
textarea::placeholder,
textarea::-webkit-input-placeholder {
  color: #94a3b8 !important;
  opacity: 0.38 !important;
  font-weight: 400 !important;
}

.stRadio div[role="radiogroup"] label {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px 14px;
  margin-right: 8px;
}
.stRadio div[role="radiogroup"] label span {
  color: #0f172a !important;
}

/* Metrik */
[data-testid="stMetricValue"] {
  color: #0f172a !important;
  font-size: 1.5rem;
  font-weight: 700;
}
[data-testid="stMetricLabel"] {
  color: #475569 !important;
}

/* Butonlar */
.stButton > button {
  border-radius: 12px !important;
  font-weight: 600 !important;
}
.stButton > button[kind="primary"] {
  background: linear-gradient(180deg, #fb923c, #ea580c) !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
}
.stButton > button[kind="primary"]:hover {
  border: none !important;
  color: #fff !important;
}
.stButton > button[kind="secondary"] {
  background: #1e293b !important;
  color: #f8fafc !important;
  border: none !important;
}

/* File uploader */
[data-testid="stFileUploader"] section {
  background: #ffffff !important;
  border: 1px dashed #94a3b8 !important;
  border-radius: 12px !important;
}

/* Sidebar */
[data-testid="stSidebar"] {
  background: linear-gradient(180deg, #f1f5f9, #e2e8f0) !important;
  border-right: 1px solid #cbd5e1;
}
[data-testid="stSidebar"] .stMarkdown,
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span,
[data-testid="stSidebar"] label {
  color: #1e293b !important;
}

/* Divider / expander / dataframe başlıkları */
hr {
  border-color: #cbd5e1 !important;
}
.streamlit-expanderHeader {
  color: #0f172a !important;
}

/* Dataframe */
div[data-testid="stDataFrame"] {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

/* Tam genişlik header taşması — Streamlit ana sütunu kırpmasın */
[data-testid="stAppViewContainer"] .main,
[data-testid="stAppScrollToBottomContainer"],
[data-testid="stAppViewContainer"] .main .block-container,
[data-testid="stAppScrollToBottomContainer"] [data-testid="stMainBlockContainer"] {
  overflow-x: visible !important;
}

/*
 * Masthead — yalnızca .st-key-pg_masthead (+ eski BorderWrapper). :has(.hero-masthead-brand) kullanma:
 * üst stVerticalBlock tüm sayfayı sarınca sayfa içi tüm radyolara da uygulanıyordu.
 */
[data-testid="stVerticalBlock"].st-key-pg_masthead,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead {
  width: 100vw !important;
  min-width: 100vw !important;
  max-width: 100vw !important;
  position: relative !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  margin-top: -1.25rem !important;
  margin-bottom: 4px !important;
  padding: 16px clamp(16px, 4vw, 40px) 12px !important;
  box-sizing: border-box !important;
  min-height: 88px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  border: none !important;
  border-radius: 0 0 22px 22px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.14) !important;
  box-shadow: 0 10px 32px rgba(48, 8, 16, 0.38) !important;
  overflow: hidden !important;
  /* Bordo / şarap tonları (önceki teal yerine) */
  background: linear-gradient(
    102deg,
    #120608 0%,
    #1f0a0e 18%,
    #3a0f18 40%,
    #5c1524 62%,
    #7a1f30 82%,
    #8f2840 100%
  ) !important;
}

[data-testid="stVerticalBlock"].st-key-pg_masthead::after,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  border-radius: inherit !important;
  opacity: 0.05 !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23ffffff' d='M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'/%3E%3C/svg%3E") !important;
  background-size: 24px 24px !important;
}

.hero-band-target {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

[data-testid="stVerticalBlock"].st-key-pg_masthead div[data-testid="stMarkdownContainer"]:has(.hero-band-target),
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead div[data-testid="stMarkdownContainer"]:has(.hero-band-target) {
  margin-bottom: 0 !important;
  margin-top: 4px !important;
}

.hero-masthead-brand {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;
  min-width: 0 !important;
  width: 100% !important;
  max-width: min(100%, 720px) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  text-align: center !important;
}

.hero-brand-logo-link {
  display: inline-flex !important;
  align-items: center !important;
  text-decoration: none !important;
  color: inherit !important;
  line-height: 0 !important;
  flex-shrink: 0 !important;
  border-radius: 12px !important;
}

.hero-brand-logo-link:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.55) !important;
  outline-offset: 3px !important;
}

.hero-brand-logo {
  width: 48px !important;
  height: 48px !important;
  border-radius: 12px !important;
  object-fit: contain !important;
  flex-shrink: 0 !important;
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.25) !important;
}

.hero-masthead-brand .hero-title {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(1.1rem, 2.4vw, 1.5rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0 !important;
  letter-spacing: -0.02em;
  text-align: center !important;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

/* Marka satırı — sol sütunda ortalanmış (sağda dil kutusu ile aynı hizada) */
.hero-masthead-brand--row {
  max-width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

[data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"] {
  width: 100% !important;
  align-items: stretch !important;
  min-height: 56px !important;
}
/* Marka + dil satırı — kompakt yükseklik (:first-of-type div’de güvenilir değil; marka satırı :has ile) */
[data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand),
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) {
  min-height: 48px !important;
  padding-top: 8px !important;
  box-sizing: border-box !important;
}

/* Dil sütunu — yalnız logo satırındaki sütun (pill satırlarına sızmasın) */
[data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="stColumn"]:has(.st-key-masthead_lang_slot),
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="stColumn"]:has(.st-key-masthead_lang_slot),
[data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="column"]:has(.st-key-masthead_lang_slot),
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="column"]:has(.st-key-masthead_lang_slot) {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  text-align: center !important;
  min-height: 44px !important;
}

/* Masthead — st.pills satırı ortada (dar ekranda aşağıda flex-start) */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-main_data_source_tab,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-main_data_source_tab {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

/*
 * Streamlit ButtonGroup (st.pills) — width stretch iken flexWrap:wrap + max-width:100% (kaynak: ButtonGroup.tsx).
 * width=content ile çoğu durumda tek satır olur; yine de wrap enjekte edildiği için masthead'te nowrap zorunlu.
 */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [role="radiogroup"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [role="radiogroup"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button-group"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button-group"] {
  flex-wrap: nowrap !important;
  align-items: center !important;
}

/* Masthead — dil: kare zorunlu; bayrak background-size masthead_flags ile auto + yükseklik % */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button {
  box-sizing: border-box !important;
  position: relative !important;
  aspect-ratio: 1 / 1 !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  width: 35px !important;
  height: 35px !important;
  min-width: 35px !important;
  max-width: 35px !important;
  min-height: 35px !important;
  max-height: 35px !important;
  flex: 0 0 35px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  align-self: center !important;
  padding: 0 !important;
  margin: 0 !important;
  font-size: 0 !important;
  line-height: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background-size: auto 138% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-color: transparent !important;
  border: 1px solid rgba(15, 23, 42, 0.1) !important;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1) !important;
}
/* Türk bayrağı (flagcdn PNG): ay–yıldız geometrik merkezin solunda; daire içinde yalnız TR optik ortala */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop_tr"] button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop_tr"] button {
  background-position: calc(42% + 5px) center !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button svg,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button svg {
  display: none !important;
}
/* İç sarmalayıcılar: buton karesini doldurur, flex ile genişlik daralmasın */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button > div,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button > div {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: auto !important;
  height: auto !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  pointer-events: none !important;
  background: transparent !important;
  background-color: transparent !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button p,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button p,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button span,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button span,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button [data-testid="stMarkdownContainer"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] button [data-testid="stMarkdownContainer"] {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  font-size: 0 !important;
  line-height: 0 !important;
  letter-spacing: 0 !important;
  pointer-events: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Dil popover: sütun daireyi sıkıştırmasın (min-width 0 → yatay basık elips) */
div[data-baseweb="popover"] [data-testid="stColumn"]:has([class*="st-key-masthead_pick_"]) {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  min-width: 36px !important;
}
div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: fit-content !important;
  max-width: 100% !important;
  flex-shrink: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
/* Dil popover içi (portal): kare zorunlu; bayrak ölçeği masthead_flags ile auto + yükseklik % */
div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button {
  box-sizing: border-box !important;
  position: relative !important;
  aspect-ratio: 1 / 1 !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  max-width: 32px !important;
  min-height: 32px !important;
  max-height: 32px !important;
  flex: 0 0 32px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  align-self: center !important;
  padding: 0 !important;
  margin: 3px auto !important;
  font-size: 0 !important;
  line-height: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background-size: auto 138% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-color: transparent !important;
  border: 1px solid rgba(15, 23, 42, 0.1) !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
}
div[data-baseweb="popover"] .st-key-masthead_pick_tr button {
  background-position: calc(42% + 5px) center !important;
}
div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button > div {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: auto !important;
  height: auto !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  pointer-events: none !important;
  background: transparent !important;
  background-color: transparent !important;
}
div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button p,
div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button span,
div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button [data-testid="stMarkdownContainer"] {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  font-size: 0 !important;
  line-height: 0 !important;
  letter-spacing: 0 !important;
  pointer-events: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Sağ üst dil: marka satırıyla hizalı, fazla dikey boşluk yok */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: flex-start !important;
  width: 100% !important;
  max-width: 45px !important;
  margin-left: auto !important;
  margin-top: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot [class*="st-key-masthead_lang_pop"] {
  width: auto !important;
  max-width: 45px !important;
  min-width: 0 !important;
}

@media (min-width: 769px) {
  /* Marka + dil: chip satırı yönünde +4px (yalnız geniş ekran; mobilde HB padding-top 8px kalır) */
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) {
    padding-top: 12px !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot {
    margin-top: 8px !important;
  }
}

/* Kaynak pill + Hakkında chip: satır stretch; sütunlar pill yüksekliğine eşit, chip dikey ortada */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about {
  width: 100% !important;
  --masthead-chip-w: 14rem;
  --masthead-chip-h: 40px;
  /* Sol 4 kaynak pill (Hakkında hariç) — sabit kutu */
  --masthead-pill-w: 224px;
  --masthead-pill-h: 44px;
  --masthead-chip-px: 12px;
  --masthead-chip-bg: #ffffff;
  --masthead-chip-fg: #0f172a;
  --masthead-chip-border: rgba(15, 23, 42, 0.12);
  --masthead-chip-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  --masthead-chip-radius: 9999px;
}
/* Kaynak pill satırı: genişlik/yükseklik --masthead-pill-* ; Hakkında --masthead-chip-* */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab > div:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab > div:last-child {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: stretch !important;
  gap: 8px !important;
  width: max-content !important;
  max-width: none !important;
  justify-content: flex-start !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"] {
  box-sizing: border-box !important;
  width: var(--masthead-pill-w) !important;
  min-width: var(--masthead-pill-w) !important;
  max-width: var(--masthead-pill-w) !important;
  height: var(--masthead-pill-h) !important;
  min-height: var(--masthead-pill-h) !important;
  max-height: var(--masthead-pill-h) !important;
  flex: 0 0 var(--masthead-pill-w) !important;
  padding: 0 var(--masthead-chip-px) !important;
  margin: 0 !important;
  justify-content: center !important;
  align-items: center !important;
  text-align: center !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.2 !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  border-radius: var(--masthead-chip-radius) !important;
  background: var(--masthead-chip-bg) !important;
  background-color: var(--masthead-chip-bg) !important;
  color: var(--masthead-chip-fg) !important;
  border: 1px solid var(--masthead-chip-border) !important;
  box-shadow: var(--masthead-chip-shadow) !important;
  -webkit-tap-highlight-color: transparent !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][kind="primary"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][kind="primary"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][kind="secondary"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][kind="secondary"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][kind="tertiary"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][kind="tertiary"] {
  background: var(--masthead-chip-bg) !important;
  background-color: var(--masthead-chip-bg) !important;
  color: var(--masthead-chip-fg) !important;
  border: 1px solid var(--masthead-chip-border) !important;
  box-shadow: var(--masthead-chip-shadow) !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button:hover,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button:hover,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"]:hover,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"]:hover {
  background: #f8fafc !important;
  background-color: #f8fafc !important;
  color: var(--masthead-chip-fg) !important;
  border-color: rgba(15, 23, 42, 0.2) !important;
  box-shadow: var(--masthead-chip-shadow) !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button[aria-checked="true"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button[aria-checked="true"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][aria-checked="true"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][aria-checked="true"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button[aria-pressed="true"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button[aria-pressed="true"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][aria-pressed="true"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"][aria-pressed="true"] {
  background: var(--masthead-chip-bg) !important;
  background-color: var(--masthead-chip-bg) !important;
  color: var(--masthead-chip-fg) !important;
  border: 1px solid var(--masthead-chip-border) !important;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.2), var(--masthead-chip-shadow) !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"] > div,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"] > div {
  background: transparent !important;
  background-color: transparent !important;
  color: inherit !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button:focus-visible,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button:focus-visible,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"]:focus-visible,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"]:focus-visible {
  outline: 2px solid rgba(15, 23, 42, 0.35) !important;
  outline-offset: 2px !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button p,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button p,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"] p,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"] p {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  max-width: 100% !important;
  line-height: 1.2 !important;
  font-size: inherit !important;
  font-weight: inherit !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child [data-testid="element-container"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child [data-testid="element-container"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child [data-testid="element-container"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child [data-testid="element-container"] {
  min-height: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] {
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  column-gap: 8px !important;
  row-gap: 8px !important;
  flex-wrap: nowrap !important;
  min-height: max(calc(var(--masthead-pill-h) + 4px), calc(var(--masthead-chip-h) + 4px)) !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior-x: contain !important;
  scrollbar-width: thin !important;
  scrollbar-color: rgba(15, 23, 42, 0.28) transparent !important;
  width: 100% !important;
  max-width: 100% !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]::-webkit-scrollbar,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]::-webkit-scrollbar {
  height: 5px !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]::-webkit-scrollbar-thumb,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.22) !important;
  border-radius: 999px !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"] {
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  align-items: center !important;
  align-self: stretch !important;
  min-height: 0 !important;
}
/* Pill sütunu içeriğe göre daralsın — Hakkında chip pill’lerle aynı 8px aralıkta */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child {
  flex: 0 0 auto !important;
  width: fit-content !important;
  max-width: none !important;
  min-width: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child,
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child {
  flex: 0 0 auto !important;
  width: auto !important;
  margin-left: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab {
  width: fit-content !important;
  max-width: none !important;
  min-height: var(--masthead-pill-h) !important;
  align-self: center !important;
  background: transparent !important;
  background-color: transparent !important;
}
/* Hakkında sütunu: Streamlit dikey blokları sütunu doldurur, chip ortada */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child [data-testid="stVerticalBlock"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child [data-testid="stVerticalBlock"],
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child [data-testid="stVerticalBlock"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child [data-testid="stVerticalBlock"] {
  flex: 1 1 auto !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  align-items: center !important;
  min-height: 0 !important;
  width: 100% !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="stMarkdownContainer"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="stMarkdownContainer"] {
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  width: 100% !important;
  min-height: 0 !important;
  max-height: var(--masthead-chip-h) !important;
  height: var(--masthead-chip-h) !important;
  overflow: hidden !important;
}
/* Streamlit markdown iç sarmalayıcısı — varsayılan ~44px dokunma yüksekliğini chip ile eşitle */
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="stMarkdownContainer"] > div,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="stMarkdownContainer"] > div {
  box-sizing: border-box !important;
  min-height: 0 !important;
  max-height: var(--masthead-chip-h) !important;
  height: var(--masthead-chip-h) !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="stMarkdownContainer"] > div > div,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="stMarkdownContainer"] > div > div {
  box-sizing: border-box !important;
  min-height: 0 !important;
  max-height: var(--masthead-chip-h) !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="element-container"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stColumn"]:last-child [data-testid="element-container"] {
  min-height: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill-wrap,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill-wrap {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: var(--masthead-chip-w) !important;
  min-width: 0 !important;
  max-width: var(--masthead-chip-w) !important;
  height: var(--masthead-chip-h) !important;
  min-height: var(--masthead-chip-h) !important;
  max-height: var(--masthead-chip-h) !important;
  padding: 0 !important;
  margin: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill {
  box-sizing: border-box !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: var(--masthead-chip-h) !important;
  min-height: var(--masthead-chip-h) !important;
  max-height: var(--masthead-chip-h) !important;
  padding: 0 var(--masthead-chip-px) !important;
  margin: 0 !important;
  justify-content: center !important;
  align-items: center !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  line-height: 1.2 !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  border-radius: var(--masthead-chip-radius) !important;
  background: var(--masthead-chip-bg) !important;
  background-color: var(--masthead-chip-bg) !important;
  color: var(--masthead-chip-fg) !important;
  border: 1px solid var(--masthead-chip-border) !important;
  box-shadow: var(--masthead-chip-shadow) !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill:hover,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill:hover {
  background: #f8fafc !important;
  background-color: #f8fafc !important;
  border-color: rgba(15, 23, 42, 0.2) !important;
  transform: none !important;
}
[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill-dot,
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill-dot {
  width: 16px !important;
  height: 16px !important;
  font-size: 0.62rem !important;
}

/* Kaynak pill'lerinin yanında — Streamlit pill ile uyumlu beyaz chip (yükseklik masthead'te --masthead-chip-h ile eşitlenir) */
.masthead-source-pill-wrap {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-height: 40px !important;
}
.masthead-source-pill {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  min-height: 40px !important;
  padding: 0 14px !important;
  border-radius: 9999px !important;
  background: #ffffff !important;
  color: #0f172a !important;
  font-size: 0.82rem !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  text-decoration: none !important;
  white-space: nowrap !important;
  box-sizing: border-box !important;
  border: 1px solid rgba(15, 23, 42, 0.12) !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease !important;
}
.masthead-source-pill:hover {
  background: #f8fafc !important;
  border-color: rgba(15, 23, 42, 0.2) !important;
  transform: translateY(-1px) !important;
}
.masthead-source-pill-dot {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 18px !important;
  height: 18px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(15, 23, 42, 0.2) !important;
  font-size: 0.68rem !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  flex-shrink: 0 !important;
}

/* Masthead: başlık dışındaki markdown kutularında üst margin sıfır */
[data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stMarkdownContainer"]:not(:has(.hero-masthead-brand)),
[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stMarkdownContainer"]:not(:has(.hero-masthead-brand)) {
  margin-top: 0 !important;
}

.metric-strip {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 14px;
  margin: 2px 0 4px;
  box-shadow: 0 2px 12px rgba(15,23,42,0.04);
}
.metric-strip-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 2px;
}
.metric-strip-value {
  font-size: 1.85rem;
  font-weight: 700;
  color: #0f172a;
}

.section-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #0f172a;
  margin: 4px 0 2px;
}
.section-title--tight {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
}

/* Chip'i barındıran row'un dikey hizası: pill satırıyla aynı baseline. */
[data-testid="stHorizontalBlock"]:has(.hero-about-chip-wrap) {
  align-items: center !important;
}
[data-testid="stHorizontalBlock"]:has(.hero-about-chip-wrap) > [data-testid="stColumn"] {
  align-self: center !important;
  display: flex;
  align-items: center;
}
.hero-about-chip-wrap {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.hero-about-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.38);
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.10);
  text-decoration: none !important;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  box-sizing: border-box;
  transition: transform 0.12s ease, background 0.16s ease, border-color 0.16s ease;
}
.hero-about-chip:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.65);
  transform: translateY(-1px);
}
.hero-about-chip-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}
.about-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  margin: 4px 0 8px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
}
.about-card p {
  margin: 0 0 10px;
  font-size: 0.92rem;
  color: #1e293b;
  line-height: 1.6;
}
.about-card p:last-child {
  margin-bottom: 0;
}
.about-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 6px 0 12px;
}
@media (max-width: 900px) {
  .about-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }
}
.about-kpi {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 10px 11px;
}
.about-kpi span {
  display: block;
  font-size: 0.72rem;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 600;
}
.about-kpi strong {
  display: block;
  font-size: 0.82rem;
  color: #0f172a;
  line-height: 1.45;
}
.about-table-wrap {
  margin: 10px 0 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: auto;
  background: #ffffff;
}
.about-table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
}
@media (min-width: 769px) {
  .about-table {
    min-width: 640px;
  }
}
.about-table thead th {
  background: #f8fafc;
  color: #334155;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
}
.about-table tbody td {
  font-size: 0.84rem;
  color: #1e293b;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}
.about-table tbody tr:last-child td {
  border-bottom: none;
}

/* Yorum kartları — tek sütun, tablo yerine */
.review-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 0 4px;
}
.review-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px 16px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}
.review-card-app {
  font-size: 0.78rem;
  font-weight: 600;
  color: #6366f1;
  margin: 0 0 8px 0;
}
.review-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.86rem;
  color: #475569;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.review-card-head-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-weight: 600;
  color: #334155;
}
.review-card-no {
  font-variant-numeric: tabular-nums;
}
.review-card-sep {
  color: #cbd5e1;
  font-weight: 400;
  user-select: none;
}
.review-card-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06);
}
.review-card-date {
  color: #64748b;
  font-weight: 500;
  font-size: 0.86rem;
  margin-left: auto;
}
.review-card-body {
  font-size: 0.94rem;
  line-height: 1.55;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Analiz sonuçları — nlp-sentiment tarzı üst metrik + özet */
.sr-analysis-page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0.35rem 0 0.45rem;
  letter-spacing: -0.02em;
}
.sr-analysis-subhead-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  margin: 0.25rem 0 12px;
}
.sr-analysis-subhead-wrap .sr-analysis-page-title--sub {
  margin: 0 !important;
  flex: 1 1 auto;
  min-width: 0;
}
.sr-store-listing-link {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  margin-top: 0.2rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 1.05rem;
  line-height: 1;
  text-decoration: none !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.sr-store-listing-link:hover {
  background: #f8fafc;
  color: #0f172a;
  border-color: #cbd5e1;
}
.sr-analysis-page-title--sub {
  font-size: 1.05rem;
  color: #1f2937;
  /* Başlık kutusu ile altındaki metrik hapları arasında 12px (tek başlıkta) */
  margin: 0.25rem 0 12px;
  text-transform: none;
  /* Turuncu şeritten sonra metin: en az ~1 harf (em) + ekstra nefes alanı */
  padding: 0.45rem 0.75rem 0.45rem max(1.35rem, 16px + 1.65em);
  background: linear-gradient(135deg, rgba(255,237,213,0.65), rgba(255,255,255,0));
  border-left: 3px solid #fb923c;
  border-radius: 6px;
  display: block;
  box-sizing: border-box;
}
/* Streamlit markdown sarmalayıcısı bazen başlık padding'ini sıfırlar; şerit–metin arası korunsun */
[data-testid="stAppViewContainer"] .main [data-testid="stMarkdownContainer"] h3.sr-analysis-page-title--sub,
[data-testid="stAppScrollToBottomContainer"] .main [data-testid="stMarkdownContainer"] h3.sr-analysis-page-title--sub,
[data-testid="stAppViewContainer"] .main [data-testid="stMarkdownContainer"] div.sr-analysis-page-title--sub,
[data-testid="stAppScrollToBottomContainer"] .main [data-testid="stMarkdownContainer"] div.sr-analysis-page-title--sub {
  padding-left: max(1.35rem, 16px + 1.65em) !important;
  padding-inline-start: max(1.35rem, 16px + 1.65em) !important;
  padding-top: 0.45rem !important;
  padding-right: 0.75rem !important;
  padding-bottom: 0.45rem !important;
}
.sr-analysis-metric-row {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
  margin: 0.15rem 0 0.75rem;
  flex-wrap: wrap;
}
/* Karşılaştırma (compact): alt başlığın 12px margin-bottom'ı tek başına yeter; üst birikme olmasın */
.sr-analysis-metric-row.sr-analysis-metric-row--tight-top {
  margin-top: 0;
}
.sr-analysis-metric-pill {
  background: #ffffff !important;
  border: 2px solid #ffe4d6 !important;
  border-radius: 100px !important;
  padding: 0.55rem 0.75rem !important;
  text-align: center;
  flex: 1 1 128px;
  max-width: 188px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04) !important;
}
.sr-analysis-metric-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.15;
}
.sr-analysis-metric-label {
  font-size: 0.72rem;
  color: #64748b !important;
  font-weight: 600;
  margin-top: 0.15rem;
  text-transform: lowercase !important;
  letter-spacing: 0.02em;
}

/* ---- Mobil / dar ekran (≤768px) — yatay sütunları dikey yığ, taşmayı kes ---- */
@media (max-width: 768px) {
  .stApp {
    max-width: 100vw !important;
  }
  [data-testid="stAppViewContainer"],
  [data-testid="stAppViewContainer"] .main {
    max-width: 100vw !important;
    min-width: 0 !important;
  }
  [data-testid="stAppViewContainer"] .main .block-container {
    width: 100% !important;
    min-width: 0 !important;
  }
  [data-testid="stVerticalBlock"],
  [data-testid="stVerticalBlockBorderWrapper"] {
    min-width: 0 !important;
  }
  [data-testid="stAppViewContainer"] .main img,
  [data-testid="stAppScrollToBottomContainer"] img,
  [data-testid="stAppViewContainer"] .main video {
    max-width: 100% !important;
    height: auto !important;
  }
  [data-testid="stAppViewContainer"] .main pre,
  [data-testid="stAppScrollToBottomContainer"] pre {
    max-width: 100% !important;
    overflow-x: auto !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  }
  [data-testid="stAppViewContainer"] .main [data-baseweb="segmented-control"],
  [data-testid="stAppScrollToBottomContainer"] .main [data-baseweb="segmented-control"] {
    display: flex !important;
    flex-wrap: wrap !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
  }
  [data-testid="stAppViewContainer"] .main [data-baseweb="segmented-control"] button,
  [data-testid="stAppScrollToBottomContainer"] .main [data-baseweb="segmented-control"] button {
    flex: 1 1 min(100%, 12rem) !important;
    min-width: 0 !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .block-container {
    padding-left: clamp(0.5rem, 3vw, 1rem) !important;
    padding-right: clamp(0.5rem, 3vw, 1rem) !important;
    padding-top: 0.08rem !important;
    padding-bottom: 0.4rem !important;
    max-width: 100% !important;
  }
  [data-testid="stAppViewContainer"] .main [data-testid="element-container"],
  [data-testid="stAppScrollToBottomContainer"] [data-testid="element-container"] {
    margin-bottom: 0.08rem !important;
  }
  [data-testid="stAppViewContainer"] .main .stMarkdown,
  [data-testid="stAppScrollToBottomContainer"] .stMarkdown {
    margin-bottom: 0.08rem !important;
  }
  [data-testid="stAppViewContainer"] .main .stButton,
  [data-testid="stAppScrollToBottomContainer"] .stButton {
    margin-bottom: 0.08rem !important;
  }
  [data-testid="stTabs"] [data-baseweb="tab-panel"] {
    padding-top: 0.55rem !important;
  }
  /* pg_masthead içi hariç: chip/pill iç yatay blokları dikey yığma */
  [data-testid="stAppViewContainer"] .main [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-pg_masthead"] [data-testid="stHorizontalBlock"])),
  [data-testid="stAppScrollToBottomContainer"] [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-pg_masthead"] [data-testid="stHorizontalBlock"])) {
    flex-direction: column !important;
    align-items: stretch !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  [data-testid="stAppViewContainer"] .main [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-pg_masthead"] [data-testid="stHorizontalBlock"])) > [data-testid="stColumn"],
  [data-testid="stAppScrollToBottomContainer"] [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-pg_masthead"] [data-testid="stHorizontalBlock"])) > [data-testid="stColumn"],
  [data-testid="stAppViewContainer"] .main [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-pg_masthead"] [data-testid="stHorizontalBlock"])) > [data-testid="column"],
  [data-testid="stAppScrollToBottomContainer"] [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-pg_masthead"] [data-testid="stHorizontalBlock"])) > [data-testid="column"] {
    width: 100% !important;
    min-width: 0 !important;
    flex: 1 1 auto !important;
  }
  /*
   * st.pills iç yapısı: her seçenek ayrı stHorizontalBlock > stColumn içinde.
   * Genel mobil kural yukarıda tüm HB'leri column yaptığı için dört pill dikey diziliyordu.
   * main_data_source_tab altındaki HB'leri tekrar tek satırda tut.
   */
  [data-testid="stAppViewContainer"] .main .st-key-main_data_source_tab [data-testid="stHorizontalBlock"],
  [data-testid="stAppScrollToBottomContainer"] .main .st-key-main_data_source_tab [data-testid="stHorizontalBlock"],
  [data-testid="stAppViewContainer"] .main [class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"],
  [data-testid="stAppScrollToBottomContainer"] .main [class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"] {
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: stretch !important;
    width: max-content !important;
    max-width: none !important;
    min-width: 0 !important;
  }
  [data-testid="stAppViewContainer"] .main .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stAppViewContainer"] .main .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="column"],
  [data-testid="stAppScrollToBottomContainer"] .main .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stAppScrollToBottomContainer"] .main .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="column"],
  [data-testid="stAppViewContainer"] .main [class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stAppViewContainer"] .main [class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"] > [data-testid="column"],
  [data-testid="stAppScrollToBottomContainer"] .main [class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stAppScrollToBottomContainer"] .main [class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"] > [data-testid="column"] {
    width: auto !important;
    max-width: none !important;
    flex: 0 0 auto !important;
    min-width: 0 !important;
  }
  /* Masthead: yalnız marka+dil satırı dikey; pill+chip (masthead_pills_about) hariç */
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-masthead_pills_about"] [data-testid="stHorizontalBlock"])),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-masthead_pills_about"] [data-testid="stHorizontalBlock"])) {
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 6px !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-masthead_pills_about"] [data-testid="stHorizontalBlock"])) > [data-testid="stColumn"],
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-masthead_pills_about"] [data-testid="stHorizontalBlock"])) > [data-testid="column"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-masthead_pills_about"] [data-testid="stHorizontalBlock"])) > [data-testid="stColumn"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-masthead_pills_about"] [data-testid="stHorizontalBlock"])) > [data-testid="column"] {
    width: 100% !important;
    max-width: 100% !important;
    flex: 1 1 auto !important;
  }
  /*
   * Marka + dil (mobil): Streamlit [data-testid="element-container"] çoğunlukla position:relative;
   * dil absolute olduğunda CB dar kalıp bayrak solda görünüyor → masthead içi tüm element-container static.
   * Dil konumu doğrudan .st-key-masthead_lang_slot üzerinden .st-key-pg_masthead padding kutusuna pinlenir.
   */
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="element-container"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="element-container"] {
    position: static !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) {
    min-height: 0 !important;
    gap: 0 !important;
    padding-top: 8px !important;
    box-sizing: border-box !important;
    position: static !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="stColumn"]:has(.hero-masthead-brand),
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="column"]:has(.hero-masthead-brand),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="stColumn"]:has(.hero-masthead-brand),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="column"]:has(.hero-masthead-brand) {
    padding-right: 44px !important;
    box-sizing: border-box !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="stColumn"]:has(.st-key-masthead_lang_slot),
  [data-testid="stVerticalBlock"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="column"]:has(.st-key-masthead_lang_slot),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="stColumn"]:has(.st-key-masthead_lang_slot),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead [data-testid="stHorizontalBlock"]:has(.hero-masthead-brand) > [data-testid="column"]:has(.st-key-masthead_lang_slot) {
    position: static !important;
    height: 0 !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
    flex: 0 0 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    align-items: flex-end !important;
    justify-content: flex-start !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot {
    position: absolute !important;
    top: 14px !important;
    right: clamp(14px, 4vw, 32px) !important;
    left: auto !important;
    bottom: auto !important;
    width: auto !important;
    max-width: 52px !important;
    margin: 0 !important;
    z-index: 25 !important;
    direction: ltr !important;
    justify-content: flex-end !important;
    align-items: flex-start !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about {
    /* Mobilde sabit geniş pill yok — metin kadar, satır yatay kayar */
    --masthead-chip-w: max-content !important;
    --masthead-pill-w: max-content !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-hero_chip_row,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-hero_chip_row {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    padding-left: 2px !important;
    padding-right: 2px !important;
  }
  /* st.pills kökü: yatay kaydırma burada; iç flex satırı max-content ile taşar */
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab {
    justify-content: flex-start !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior-x: contain !important;
    scrollbar-width: none !important;
    padding-bottom: 4px !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab::-webkit-scrollbar,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab::-webkit-scrollbar {
    display: none !important;
    height: 0 !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab > div:last-child,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab > div:last-child {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 8px !important;
    width: max-content !important;
    min-width: min-content !important;
    max-width: none !important;
    box-sizing: border-box !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
  /*
   * hero-chip-row (st-key-hero_chip_row): yalnız pill+hakkında dış satırı kayar.
   * st.pills iç içe HB'leri :not(:is(...)) ile hariç tutulur.
   */
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"])),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"])) {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 8px !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    padding: 2px 12px 8px 12px !important;
    box-sizing: border-box !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior-x: contain !important;
    scroll-snap-type: x proximity !important;
    scrollbar-width: none !important;
    min-height: max(calc(var(--masthead-pill-h) + 4px), calc(var(--masthead-chip-h) + 4px)) !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"]))::-webkit-scrollbar,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"]))::-webkit-scrollbar {
    display: none !important;
    height: 0 !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"])) > [data-testid="stColumn"],
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"])) > [data-testid="column"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"])) > [data-testid="stColumn"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about [data-testid="stHorizontalBlock"]:not(:is([class*="st-key-main_data_source_tab"] [data-testid="stHorizontalBlock"])) > [data-testid="column"] {
    width: auto !important;
    max-width: none !important;
    flex: 0 0 auto !important;
    min-width: max-content !important;
    scroll-snap-align: start !important;
  }
  /*
   * masthead_pills_about içindeki TÜM stHorizontalBlock kurallarını kaldırdık:
   * width:100% iç pill satırlarına sızıyordu → pill'ler dikey kırılıyordu.
   * st.pills iç HB'leri aşağıda masthead kapsamında yeniden sıkılaştırıyoruz.
   */
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-testid="stHorizontalBlock"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] {
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: stretch !important;
    width: max-content !important;
    min-width: min-content !important;
    max-width: none !important;
    flex: 0 0 auto !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="column"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-testid="stHorizontalBlock"] > [data-testid="column"] {
    width: auto !important;
    max-width: none !important;
    flex: 0 0 auto !important;
    min-width: max-content !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab button,
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .st-key-main_data_source_tab [data-baseweb="button"] {
    width: auto !important;
    min-width: max-content !important;
    max-width: none !important;
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill {
    width: auto !important;
    min-width: max-content !important;
    max-width: none !important;
    white-space: nowrap !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill-wrap,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about .masthead-source-pill-wrap {
    width: auto !important;
    min-width: max-content !important;
    max-width: none !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead {
    padding: 14px clamp(12px, 4vw, 20px) 10px !important;
    min-height: 0 !important;
    /* Marka bloğu ile pill şeridi arası hedef ~10px (justify flex-start ile ekstra dağılım yok) */
    gap: 10px !important;
    justify-content: flex-start !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead div[data-testid="stMarkdownContainer"]:has(.hero-band-target),
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead div[data-testid="stMarkdownContainer"]:has(.hero-band-target) {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }
  [data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_pills_about,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_pills_about {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }
  [data-testid="stTabs"] [data-baseweb="tab-list"] {
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  [data-testid="stTabs"] [data-baseweb="tab"] {
    flex: 1 1 calc(50% - 6px) !important;
    min-height: 44px !important;
    padding: 8px 10px !important;
  }
  [data-testid="stTabs"] [data-baseweb="tab"] p,
  [data-testid="stTabs"] [data-baseweb="tab"] span {
    font-size: 0.8rem !important;
  }
  [data-testid="stAppViewContainer"] .main .stRadio div[role="radiogroup"], [data-testid="stAppScrollToBottomContainer"] .stRadio div[role="radiogroup"] {
    flex-wrap: wrap !important;
    gap: 8px !important;
  }
  [data-testid="stAppViewContainer"] .main .stRadio div[role="radiogroup"] label, [data-testid="stAppScrollToBottomContainer"] .stRadio div[role="radiogroup"] label {
    flex: 1 1 auto !important;
    min-height: 44px !important;
    margin-right: 0 !important;
  }
  .stButton > button {
    min-height: 44px !important;
  }
  .stTextInput input,
  .stNumberInput input,
  textarea {
    font-size: 16px !important;
  }
  [data-testid="stPlotlyChart"],
  div[data-testid="stDataFrame"] {
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  .js-plotly-plot,
  .js-plotly-plot .plotly {
    max-width: 100% !important;
  }
  .metric-strip {
    padding: 12px 14px !important;
  }
  .hero-about-chip-wrap {
    justify-content: center !important;
    margin-top: 6px !important;
  }
  .hero-about-chip {
    height: 34px !important;
    padding: 0 12px !important;
    font-size: 0.78rem !important;
  }
  .about-card {
    padding: 12px 13px !important;
    border-radius: 12px !important;
  }
  .about-card p {
    font-size: 0.89rem !important;
    line-height: 1.55 !important;
  }
  .about-grid {
    grid-template-columns: 1fr !important;
    gap: 8px !important;
  }
  .about-table {
    min-width: 0 !important;
    width: 100% !important;
  }
  .about-table thead th,
  .about-table tbody td {
    padding: 9px 10px !important;
  }
  .sr-analysis-page-title {
    font-size: 1.15rem !important;
  }
  [data-testid="stAppViewContainer"] .main [data-testid="stMarkdownContainer"] h3.sr-analysis-page-title--sub,
  [data-testid="stAppScrollToBottomContainer"] .main [data-testid="stMarkdownContainer"] h3.sr-analysis-page-title--sub,
  [data-testid="stAppViewContainer"] .main [data-testid="stMarkdownContainer"] div.sr-analysis-page-title--sub,
  [data-testid="stAppScrollToBottomContainer"] .main [data-testid="stMarkdownContainer"] div.sr-analysis-page-title--sub {
    padding-left: max(1.2rem, 14px + 1.5em) !important;
    padding-inline-start: max(1.2rem, 14px + 1.5em) !important;
  }
  .sr-analysis-metric-pill {
    flex: 1 1 calc(50% - 0.5rem) !important;
    max-width: none !important;
  }
  .review-card {
    padding: 12px 14px 14px !important;
  }
  .review-card-head {
    flex-direction: column !important;
    align-items: flex-start !important;
  }
  .review-card-date {
    margin-left: 0 !important;
  }
  /* Inline HTML blokları (analiz özeti) */
  .sr-responsive-row {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
  }
  .sr-week-dow-strip {
    flex-wrap: wrap !important;
    justify-content: center !important;
  }
  .sr-summary-counts-line {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
  /* Yorum sayfalama: anahtar dinamik (ör. main_analiz_review_pager) — sınıf adında _review_pager geçer */
  [data-testid="stVerticalBlock"][class*="_review_pager"] [data-testid="stHorizontalBlock"],
  [data-testid="stVerticalBlockBorderWrapper"][class*="_review_pager"] [data-testid="stHorizontalBlock"] {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 0.35rem !important;
  }
  [data-testid="stVerticalBlock"][class*="_review_pager"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stVerticalBlock"][class*="_review_pager"] [data-testid="stHorizontalBlock"] > [data-testid="column"],
  [data-testid="stVerticalBlockBorderWrapper"][class*="_review_pager"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  [data-testid="stVerticalBlockBorderWrapper"][class*="_review_pager"] [data-testid="stHorizontalBlock"] > [data-testid="column"] {
    width: auto !important;
    flex: 0 1 auto !important;
    min-width: 0 !important;
  }
}

@media (max-width: 480px) {
  .hero-masthead-brand .hero-title {
    font-size: 1rem !important;
  }
  .hero-brand-logo {
    width: 40px !important;
    height: 40px !important;
  }
  [data-testid="stTabs"] [data-baseweb="tab"] {
    flex: 1 1 100% !important;
    min-width: 0 !important;
  }
  .sr-analysis-metric-value {
    font-size: 1.45rem !important;
  }
  [data-testid="stAppViewContainer"] .main [data-baseweb="segmented-control"] button,
  [data-testid="stAppScrollToBottomContainer"] .main [data-baseweb="segmented-control"] button {
    flex: 1 1 100% !important;
  }
}

/*
 * Küçük harf kuralı: arayüzün tamamı (buton, etiket, uyarı vb.).
 * İstisna: mağaza / App Store’dan gelen uygulama adı ve paket satırları, grafikler, kullanıcı giriş alanları, SVG.
 */
[data-testid="stAppViewContainer"],
[data-testid="stAppViewContainer"] *,
[data-testid="stSidebar"],
[data-testid="stSidebar"] *,
[data-testid="stDecoration"],
[data-testid="stDecoration"] *,
[data-testid="stToolbar"],
[data-testid="stToolbar"] * {
  text-transform: lowercase !important;
}

.stTextInput input,
.stNumberInput input,
.stTextArea textarea,
[data-testid="stTextArea"] textarea,
textarea,
[data-baseweb="input"] input,
[data-baseweb="textarea"] textarea,
[data-testid="stDateInput"] input,
[data-testid="stDateInput"] button {
  text-transform: none !important;
}

.sl-row-title,
.sl-row-id,
.sl-app-banner-title,
.sl-app-banner-meta,
.sl-app-banner-score,
.cmp-selected-summary,
.review-card-app,
.st-key-cmp_review_segment [data-baseweb="segmented-control"],
.st-key-cmp_review_segment [data-baseweb="segmented-control"] button,
[data-testid="stPlotlyChart"],
[data-testid="stPlotlyChart"] *,
[data-testid="stJson"],
[data-testid="stJson"] *,
svg,
svg *,
pre,
code,
kbd,
samp {
  text-transform: none !important;
}
"""
