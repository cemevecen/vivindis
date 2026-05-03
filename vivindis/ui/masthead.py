"""Ortak üst bant (masthead): hero başlığı, veri kaynağı + Hakkında pill'leri, sağ üst bayrak dili."""

from __future__ import annotations

import html

import streamlit as st

from vivindis.branding import header_logo_data_uri
from vivindis.config.i18n import LANGUAGES, get_lang, lang_query_suffix, set_lang, t
from vivindis.ui.masthead_flags import masthead_flag_css_block

SOURCE_OPTIONS = [
    "Mağaza",
    "Dosya",
    "Metin",
    "Uygulama karşılaştır",
    "Hakkında",
]
SOURCE_POOL_KEY = {
    "Mağaza": "store",
    "Dosya": "file",
    "Metin": "paste",
    "Uygulama karşılaştır": "compare",
}
# Analiz satırlarını sıfırlama: yalnız dört veri kaynağı arasında geçişte (Hakkında hariç).
_NAV_CLEAR_SOURCES = frozenset(
    {"Mağaza", "Dosya", "Metin", "Uygulama karşılaştır"},
)
# st.pills on_change içinde st.switch_page / st.rerun yasak.
_LEGACY_SOURCE_TAB = {
    "Mağaza (ara / link)": "Mağaza",
    "Dosya yükle": "Dosya",
    "Metin yapıştır": "Metin",
    "Karşılaştır": "Uygulama karşılaştır",
}


def session_main_data_source() -> str:
    """Pills değerini normalize et — eski etiketlerle geriye dönük uyum."""
    v = st.session_state.get("main_data_source_tab")
    if isinstance(v, (list, tuple)):
        v = v[0] if v else None
    if isinstance(v, str):
        v = _LEGACY_SOURCE_TAB.get(v, v)
    if isinstance(v, str) and v in SOURCE_OPTIONS:
        return v
    return SOURCE_OPTIONS[0]


def _on_main_nav_change() -> None:
    """Kaynak pill'leri değişince; Hakkında'ya girip çıkarken analiz durumunu koru."""
    cur = session_main_data_source()
    prev = st.session_state.get("_nav_prev_pill", cur)
    if prev == cur:
        return
    if cur in _NAV_CLEAR_SOURCES and prev in _NAV_CLEAR_SOURCES:
        st.session_state.analysis_rows = []


def render_masthead() -> None:
    """Ana uygulama üst bandı: dil popover + tek satır pill (kaynaklar + Hakkında)."""
    _q = lang_query_suffix()
    _home_href = f"./{_q}"
    _home_tip = html.escape(t("nav.home"), quote=True)
    _hdr_uri = header_logo_data_uri()
    logo_html = ""
    if _hdr_uri:
        logo_html = (
            f'<a class="hero-brand-logo-link" href="{_home_href}" '
            f'aria-label="{_home_tip}" title="{_home_tip}">'
            f'<img class="hero-brand-logo" src="{_hdr_uri}" width="48" height="48" alt="" '
            'loading="lazy" decoding="async" />'
            "</a>"
        )

    with st.container(border=True, key="pg_masthead", width="stretch"):
        row_brand, row_lang = st.columns([1, 0.15], vertical_alignment="top")
        with row_brand:
            st.markdown(
                '<span class="hero-band-target" aria-hidden="true"></span>'
                '<div class="hero-masthead-brand hero-masthead-brand--row">'
                f"{logo_html}"
                f'<h1 class="hero-title">{html.escape(t("hero.title"))}</h1>'
                "</div>",
                unsafe_allow_html=True,
            )
        with row_lang:
            with st.container(key="masthead_lang_slot"):
                cur = get_lang()
                cur_name = next(n for c, n, _ in LANGUAGES if c == cur)
                st.markdown(masthead_flag_css_block(cur), unsafe_allow_html=True)
                with st.popover(
                    "\u00a0",
                    key=f"masthead_lang_pop_{cur}",
                    width=35,
                    help=cur_name,
                    type="secondary",
                ):
                    _per_row = 5
                    for i in range(0, len(LANGUAGES), _per_row):
                        chunk = LANGUAGES[i : i + _per_row]
                        cols = st.columns(len(chunk))
                        for col, (code, name, _) in zip(cols, chunk):
                            with col:
                                if st.button("\u200b", key=f"masthead_pick_{code}", help=name):
                                    set_lang(code)
                                    st.rerun()

        _pill_raw = st.session_state.get("main_data_source_tab")
        if isinstance(_pill_raw, (list, tuple)):
            _pill_raw = _pill_raw[0] if _pill_raw else None
        if isinstance(_pill_raw, str):
            _pill_fix = _LEGACY_SOURCE_TAB.get(_pill_raw, _pill_raw)
            if _pill_fix in SOURCE_OPTIONS and _pill_fix != _pill_raw:
                st.session_state.main_data_source_tab = _pill_fix

        _source_labels = {
            "Mağaza": t("source.store"),
            "Dosya": t("source.file"),
            "Metin": t("source.text"),
            "Uygulama karşılaştır": t("source.compare"),
            "Hakkında": t("nav.about"),
        }
        with st.container(key="masthead_pills_about"):
            with st.container(key="hero_chip_row"):
                st.pills(
                    t("nav.data_source"),
                    SOURCE_OPTIONS,
                    selection_mode="single",
                    default=SOURCE_OPTIONS[0],
                    format_func=lambda v: _source_labels.get(v, v),
                    key="main_data_source_tab",
                    label_visibility="collapsed",
                    # "stretch" → Streamlit ButtonGroup flex-wrap + %100 genişlik ile pill'leri satır kırar.
                    # "content" tek satır intrinsic genişlik; dar ekranda yatay kaydırma theme CSS ile.
                    width="content",
                    on_change=_on_main_nav_change,
                )
