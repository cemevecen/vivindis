"""
Tek mağaza sekmesi: isim araması (Play + App Store), Android/iOS filtresi, sonuçtan seçim, tarih aralığı, çekme.
Eski monolitik streamlit_app "Mağaza Linki" akışının sadeleştirilmiş hali.
"""

from __future__ import annotations

import concurrent.futures
import html
import time
from typing import Any

import streamlit as st

from vivindis.config.i18n import STRINGS, get_lang, t
from vivindis.fetchers.app_discovery import (
    looks_like_search_keyword,
    resolve_direct_input,
    search_app_store_itunes,
    search_play_store,
)
from vivindis.fetchers.app_store import get_app_vivindiss
from vivindis.fetchers.google_play import fetch_google_play_reviews


_DATE_I18N_KEYS = {
    "w1": "date.week",
    "m1": "date.month1",
    "m3": "date.month3",
    "m6": "date.month6",
    "y1": "date.year1",
    "y2": "date.year2",
}

# Daha önceki sürümlerde session state'e Türkçe string olarak kaydedilmiş
# seçimleri dil-nötr koda taşımak için geriye dönük uyum haritası. Dil
# değişince eski string option listesinde bulunamadığı için selectbox "kilitli"
# görünüyordu — migrasyon bunu çözer.
_LEGACY_DATE_LABELS = {
    "Son 1 hafta": "w1", "son 1 hafta": "w1",
    "Son 1 ay": "m1", "son 1 ay": "m1",
    "Son 3 ay": "m3", "son 3 ay": "m3",
    "Son 6 ay": "m6", "son 6 ay": "m6",
    "Son 1 yıl": "y1", "son 1 yıl": "y1",
    "Son 2 yıl": "y2", "son 2 yıl": "y2",
}

_DATE_LABEL_CF_TO_CODE: dict[str, str] | None = None


def _date_label_cf_to_code_map() -> dict[str, str]:
    """Tüm dillerdeki tarih aralığı etiketleri → kod (session'da ham metin kalmışsa)."""
    global _DATE_LABEL_CF_TO_CODE
    if _DATE_LABEL_CF_TO_CODE is None:
        m: dict[str, str] = {}
        for code, ikey in _DATE_I18N_KEYS.items():
            entry = STRINGS.get(ikey) or {}
            for lbl in entry.values():
                if isinstance(lbl, str) and lbl.strip():
                    m[lbl.strip().casefold()] = code
        _DATE_LABEL_CF_TO_CODE = m
    return _DATE_LABEL_CF_TO_CODE


def time_range_state_key(base: str) -> str:
    """Dil değişince selectbox iç metni güncellensin diye widget state dil bazlı ayrılır."""
    return f"{base}_{get_lang()}"


def _resolved_date_code(raw: str) -> str | None:
    s = (raw or "").strip()
    if s in RANGE_DAYS:
        return s
    if s in _LEGACY_DATE_LABELS:
        return _LEGACY_DATE_LABELS[s]
    cf = s.casefold()
    for k, code in _LEGACY_DATE_LABELS.items():
        if k.casefold() == cf:
            return code
    return _date_label_cf_to_code_map().get(cf)


def _fmt_date_range(code: str) -> str:
    k = _DATE_I18N_KEYS.get(code)
    return t(k) if k else code


def _migrate_date_session(keys: tuple[str, ...]) -> None:
    """Session'daki tarih seçimini dil-nötr koda normalize et (Türkçe/İngilizce/Rusça etiket vb.)."""
    for k in keys:
        v = st.session_state.get(k)
        if not isinstance(v, str):
            continue
        code = _resolved_date_code(v)
        if code:
            st.session_state[k] = code
        else:
            st.session_state.pop(k, None)


def _seed_time_range_from_legacy(new_key: str, legacy_key: str) -> None:
    """Yeni dil-anahtarı boşsa eski tek anahtar veya diğer dil anahtarlarından (ör. sl_time_range_ru) kopyala."""
    if new_key in st.session_state:
        return
    candidates: list[str] = []
    if legacy_key in st.session_state:
        candidates.append(legacy_key)
    prefix = f"{legacy_key}_"
    for k in st.session_state.keys():
        if isinstance(k, str) and k.startswith(prefix) and k != new_key:
            candidates.append(k)
    for ckey in candidates:
        v = st.session_state.get(ckey)
        if isinstance(v, str) and (code := _resolved_date_code(v)):
            st.session_state[new_key] = code
            return


def _migrate_scope_session_key(key: str) -> None:
    v = st.session_state.get(key)
    if v in ("local", "global"):
        return
    if v == "Yerel":
        st.session_state[key] = "local"
    elif v == "Global":
        st.session_state[key] = "global"
    elif isinstance(v, str) and v.casefold() in ("local", "yerel"):
        st.session_state[key] = "local"
    elif isinstance(v, str) and v.casefold() in ("global",):
        st.session_state[key] = "global"


def scope_state_key() -> str:
    return f"sl_scope_{get_lang()}"


def _seed_scope_from_legacy(new_key: str, legacy_key: str = "sl_scope") -> None:
    """Karşılaştırma için legacy_key örn. cmp_scope_0; diğer dil anahtarlarından da kopyalanır."""
    if new_key in st.session_state:
        return
    candidates: list[str] = []
    if legacy_key in st.session_state:
        candidates.append(legacy_key)
    prefix = f"{legacy_key}_"
    for k in st.session_state.keys():
        if isinstance(k, str) and k.startswith(prefix) and k != new_key:
            candidates.append(k)
    for ckey in candidates:
        _migrate_scope_session_key(ckey)
        v = st.session_state.get(ckey)
        if v in ("local", "global"):
            st.session_state[new_key] = v
            return


def _run_store_search_with_progress(query: str, platform_filter: str) -> list:
    """Aramayı arka thread'de çalıştırıp kademeli canlı ilerleme göster."""
    bar = st.progress(0.0)
    status = st.empty()
    start = time.perf_counter()

    def _search() -> list:
        if platform_filter == "iOS":
            return list(search_app_store_itunes(query))
        return list(search_play_store(query))

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_search)
            # Görev bitene kadar akıcı şekilde yaklaşan bir ilerleme eğrisi.
            while not future.done():
                elapsed = time.perf_counter() - start
                staged = min(0.92, 1.0 - (2.71828 ** (-elapsed / 1.35)))
                status.caption(t("store.search_scanning"))
                bar.progress(staged)
                time.sleep(0.12)
            results = future.result()

        bar.progress(0.98)
        status.caption(t("store.results_processing", n=len(results)))
        bar.progress(1.0)
        return results
    finally:
        bar.empty()
        status.empty()


def _fmt_duration(total_seconds: float) -> str:
    secs = max(0, int(total_seconds))
    mins, sec = divmod(secs, 60)
    hrs, mins = divmod(mins, 60)
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{sec:02d}"
    return f"{mins:02d}:{sec:02d}"


def _render_fetch_progress_text(slot: st.delta_generator.DeltaGenerator, pct: float, elapsed: float, eta: float) -> None:
    pct_i = int(max(0.0, min(1.0, pct)) * 100)
    _eta = html.escape(t("store.fetch_eta", dur=_fmt_duration(eta)), quote=True)
    _elp = html.escape(f"{t('compare.elapsed')} {_fmt_duration(elapsed)}", quote=True)
    _st = html.escape(t("store.fetch_pool_state"), quote=True)
    slot.markdown(
        (
            '<div class="sl-fetch-progress">'
            f'<span class="sl-fetch-chip sl-fetch-chip--state">{_st}</span>'
            f'<span class="sl-fetch-chip sl-fetch-chip--pct">%{pct_i}</span>'
            f'<span class="sl-fetch-chip sl-fetch-chip--elapsed">{_elp}</span>'
            f'<span class="sl-fetch-chip sl-fetch-chip--eta">{_eta}</span>'
            "</div>"
        ),
        unsafe_allow_html=True,
    )


def _init_store_state() -> None:
    defaults = {
        "sl_selected_id": None,
        "sl_selected_platform": None,
        "sl_show_search": True,
        "sl_search_results": [],
        "sl_last_query": "",
        "sl_last_filter": "Android",
        "sl_display_n": 12,
        "sl_search_performed": False,
        "_sl_prev_filter": "",
        "_sl_pool_owner": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


def _sl_expected_pool_owner(resolved: Any) -> str | None:
    """Mevcut seçim/çözümlemeden havuzun beklenen sahibini (platform:app_id) üret."""
    sid = st.session_state.get("sl_selected_id")
    if sid:
        plat = "ios" if st.session_state.get("sl_selected_platform") == "iOS" else "android"
        return f"{plat}:{sid}"
    if resolved is not None:
        return f"{resolved.platform}:{resolved.app_id}"
    return None


def _sl_invalidate_pool_if_owner_mismatch(resolved: Any) -> None:
    """Havuz önceki uygulamadan kalmışsa (sahibi farklıysa) temizle."""
    owner = st.session_state.get("_sl_pool_owner")
    expected = _sl_expected_pool_owner(resolved)
    pool = st.session_state.get("review_pool_store") or []
    if not pool:
        return
    if expected is None or owner != expected:
        st.session_state["review_pool_store"] = []
        st.session_state["analysis_rows"] = []
        st.session_state["_sl_pool_owner"] = None


def _apply_pending_sl_store_input() -> None:
    """st.text_input(sl_store_input) oluşmadan önce çağrılmalı (Streamlit kuralı)."""
    if "_pending_sl_store_input" not in st.session_state:
        return
    val = st.session_state.pop("_pending_sl_store_input")
    st.session_state["sl_store_input"] = val


def _inject_store_search_css() -> None:
    st.markdown(
        """
<style>
.sl-platform-wrap { display:flex; gap:10px; margin:10px 0 14px; flex-wrap:wrap; }
.sl-platform-wrap button {
  border-radius: 999px !important;
  font-weight: 600 !important;
  border: 2px solid #e2e8f0 !important;
  background: #fff !important;
  color: #0f172a !important;
}
/*
 * Android / iOS — logo + metin. Kök: `st-key-*plat_radio_wrap` (substring eşleşmesi).
 * Yalnızca [data-testid=stVerticalBlock] ile sınırlamak iç içe DOM'da stRadio'yu
 * kaçırabiliyordu; bu yüzden herhangi bir ata `class*="plat_radio_wrap"` kullanılır.
 */
[class*="plat_radio_wrap"] {
  margin: 10px 0 14px !important;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] > div {
  width: 100% !important;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  align-items: stretch !important;
  gap: 12px !important;
  width: 100% !important;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label {
  min-width: 0 !important;
  width: 100% !important;
  min-height: 52px !important;
  height: 52px !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 12px !important;
  border-radius: 14px !important;
  border: 2px solid #cbd5e1 !important;
  background: #ffffff !important;
  color: #334155 !important;
  font-weight: 600 !important;
  font-size: 0.82rem !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease !important;
}
/* BaseWeb metin gövdesi (p / span / div) — tek satır, sarılma yok */
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label p,
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label span,
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label > div:last-child {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  min-width: 0 !important;
  margin: 0 !important;
  line-height: 1.2 !important;
}
/* Yerleşik radyo dairesi — gizle */
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label > div:first-child,
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label > span:first-child,
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label [role="presentation"] {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
}
/* Logo yuvası */
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label::before {
  content: "";
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.08));
  transition: filter 0.15s ease;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:nth-of-type(1)::before {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%233DDC84' d='M17.523 15.341a1.149 1.149 0 1 1 1.148-1.149 1.149 1.149 0 0 1-1.148 1.149m-11.046 0a1.149 1.149 0 1 1 1.148-1.149 1.149 1.149 0 0 1-1.148 1.149m11.46-6.02 2.295-3.973a.478.478 0 0 0-.827-.478l-2.322 4.023a14.4 14.4 0 0 0-11.166 0L3.595 4.87a.478.478 0 1 0-.827.478L5.063 9.32A13.54 13.54 0 0 0 .25 20.016h23.5a13.54 13.54 0 0 0-4.813-10.695'/></svg>");
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:nth-of-type(2)::before {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%230f172a' d='M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z'/></svg>");
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:has(input:checked) {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
  color: #ffffff !important;
  border-color: #0f172a !important;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.28) !important;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:has(input:checked) p,
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:has(input:checked) span,
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:has(input:checked) > div:last-child {
  color: #ffffff !important;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:nth-of-type(2):has(input:checked)::before {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ffffff' d='M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z'/></svg>");
  filter: none;
}
[class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label:has(input:checked)::before {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
}
/* theme.py mobilde .stRadio flex-wrap — platform satırını yine grid tut */
@media (max-width: 768px) {
  [class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    flex-wrap: nowrap !important;
  }
  [class*="plat_radio_wrap"] [data-testid="stRadio"] div[role="radiogroup"] label {
    flex: none !important;
    min-height: 50px !important;
    height: 50px !important;
  }
}
.sl-results-head {
  font-size:0.82rem; color:#64748b; font-weight:700; text-transform:uppercase;
  letter-spacing:0.06em; margin:6px 0 10px;
}
.sl-scope-label {
  font-size: 0.78rem; color: #64748b; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; margin: 10px 0 4px 0;
}
@media (max-width: 640px) {
  .sl-scope-label { font-size: 0.72rem; }
}
.sl-row-icon img { width:40px; height:40px; border-radius:50%; object-fit:cover; display:block; }
.sl-row-noicon {
  width:40px; height:40px; border-radius:50%; background:#e2e8f0; color:#64748b;
  display:flex; align-items:center; justify-content:center; font-size:0.62rem;
  font-weight:700; letter-spacing:0.02em;
}
.sl-row-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.9rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.sl-row-id { font-size:0.72rem; color:#94a3b8; margin-top:2px; word-break:break-all; }
.sl-app-banner {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 14px 16px;
  margin: 8px 0 14px 0;
  box-shadow: 0 2px 14px rgba(15, 23, 42, 0.06);
}
.sl-app-banner-grid {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.sl-app-banner-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sl-app-banner-icon img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  display: block;
}
.sl-app-banner-body { flex: 1; min-width: 0; }
.sl-app-banner-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.25;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
}
.sl-app-banner-meta {
  font-size: 0.82rem;
  color: #64748b;
  font-weight: 500;
  margin: 0 0 8px 0;
}
.sl-app-banner-rating {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.sl-app-stars {
  display: inline-flex;
  gap: 2px;
  letter-spacing: 0;
}
.sl-star-on { color: #f59e0b; font-size: 1rem; line-height: 1; }
.sl-star-off { color: #e2e8f0; font-size: 1rem; line-height: 1; }
.sl-app-banner-score {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}
.sl-app-banner-score.muted { color: #94a3b8; font-weight: 600; }
.sl-fetch-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  /* Altındaki analiz metodu butonlarıyla arasında görünür bir 6px boşluk kalsın. */
  margin: 6px 0 6px;
}
.sl-fetch-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
}
.sl-fetch-chip--state {
  background: #e0f2fe;
  color: #075985;
  border-color: #bae6fd;
}
.sl-fetch-chip--pct {
  background: #ede9fe;
  color: #5b21b6;
  border-color: #ddd6fe;
}
.sl-fetch-chip--elapsed {
  background: #ecfeff;
  color: #0f766e;
  border-color: #a5f3fc;
}
.sl-fetch-chip--eta {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fed7aa;
}
/* Uygulama arama sonucu kartı: üstte ikon+başlık (yan yana), altta tam genişlik seç — mobilde çakışmayı önler */
.sl-row-icon {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
}
[class*="st-key-sl_hit_"] .stButton,
[class*="st-key-cmp_hit_"] .stButton {
  margin-top: 8px !important;
}
[class*="st-key-sl_hit_"] .stButton > button,
[class*="st-key-cmp_hit_"] .stButton > button {
  border-radius: 12px !important;
}
.stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"],
.stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] {
  align-items: flex-start !important;
  gap: 10px !important;
}
@media (max-width: 768px) {
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"],
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] {
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="column"],
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="column"] {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    width: auto !important;
    max-width: none !important;
  }
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child,
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child,
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child {
    flex: 0 0 48px !important;
    min-width: 48px !important;
    max-width: 52px !important;
  }
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:nth-child(2),
  .stApp [class*="st-key-sl_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:nth-child(2),
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:nth-child(2),
  .stApp [class*="st-key-cmp_hit_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:nth-child(2) {
    flex: 1 1 0% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  .sl-app-banner-grid {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center;
  }
  .sl-app-banner-body { width: 100%; }
  .sl-app-banner-title { font-size: 1rem !important; }
  .sl-platform-wrap { justify-content: center; }
}
</style>
""",
        unsafe_allow_html=True,
    )


def _stars_html(rating: object) -> tuple[str, str]:
    """5 yıldız satırı + sayısal metin (Türkçe ondalık)."""
    if not isinstance(rating, (int, float)) or rating <= 0:
        return (
            '<span class="sl-app-stars">'
            + "".join('<span class="sl-star-off">&#9733;</span>' for _ in range(5))
            + "</span>",
            f'<span class="sl-app-banner-score muted">{html.escape(t("store.no_score"), quote=True)}</span>',
        )
    r = max(0.0, min(5.0, float(rating)))
    n_on = int(round(r))
    stars_inner = "".join(
        f'<span class="{"sl-star-on" if i < n_on else "sl-star-off"}">&#9733;</span>' for i in range(5)
    )
    score_txt = f"{r:.1f}".replace(".", ",") + " / 5"
    return (
        f'<span class="sl-app-stars" aria-hidden="true">{stars_inner}</span>',
        f'<span class="sl-app-banner-score">{html.escape(score_txt)}</span>',
    )


def _render_app_banner(
    *,
    title: str,
    platform: str,
    icon_url: str,
    rating: object,
    extra_meta: str | None = None,
) -> None:
    t_esc = html.escape(str(title))
    p_esc = html.escape(str(platform))
    extra = f'<div class="sl-app-banner-meta">{html.escape(extra_meta)}</div>' if extra_meta else ""
    stars_h, score_h = _stars_html(rating)
    icon_block = (
        f'<div class="sl-app-banner-icon"><img src="{html.escape(icon_url, quote=True)}" alt="" referrerpolicy="no-referrer"/></div>'
        if icon_url.startswith("http")
        else '<div class="sl-app-banner-icon" style="font-size:0.65rem;font-weight:700;color:#64748b;text-align:center;line-height:1.1;">APP</div>'
    )
    st.markdown(
        f'<div class="sl-app-banner"><div class="sl-app-banner-grid">{icon_block}'
        f'<div class="sl-app-banner-body"><div class="sl-app-banner-title">{t_esc}</div>'
        f'<div class="sl-app-banner-meta">{p_esc}</div>{extra}'
        f'<div class="sl-app-banner-rating">{stars_h}{score_h}</div></div></div></div>',
        unsafe_allow_html=True,
    )


def _banner_play(app_id: str) -> None:
    try:
        from google_play_scraper import app as play_app

        info = play_app(app_id, lang="tr", country="tr")
        title = str(info.get("title", app_id))
        icon = (info.get("icon") or "").strip()
        score = info.get("score")
        genre = info.get("genre") or ""
        if not genre and info.get("categories"):
            c0 = info["categories"][0]
            if isinstance(c0, dict):
                genre = str(c0.get("name", ""))
        _render_app_banner(
            title=title,
            platform="Google Play",
            icon_url=icon,
            rating=score,
            extra_meta=genre if genre else None,
        )
    except Exception:
        _render_app_banner(
            title=f"Seçili: {app_id}",
            platform="Google Play",
            icon_url="",
            rating=None,
            extra_meta="Bilgi alınamadı",
        )


def _banner_ios(app_id: str) -> None:
    import requests

    title = str(app_id)
    icon = ""
    rating: object = None
    genre = ""
    for cc in ("tr", "us", "gb"):
        try:
            r = requests.get(
                f"https://itunes.apple.com/lookup?id={app_id}&country={cc}",
                timeout=6,
            )
            if r.status_code == 200:
                data = r.json().get("results") or []
                if data:
                    a0 = data[0]
                    title = str(a0.get("trackCensoredName") or a0.get("trackName") or app_id)
                    icon = (a0.get("artworkUrl512") or a0.get("artworkUrl100") or "").strip()
                    ar = a0.get("averageUserRating")
                    rating = float(ar) if isinstance(ar, (int, float)) else None
                    genre = str(a0.get("primaryGenreName") or "").strip()
                    break
        except Exception:
            continue
    extra_parts = [p for p in (genre, f"ID {app_id}") if p]
    extra = " · ".join(extra_parts) if extra_parts else None
    _render_app_banner(
        title=title,
        platform="App Store",
        icon_url=icon,
        rating=rating,
        extra_meta=extra,
    )


RANGE_OPTIONS = ["w1", "m1", "m3", "m6", "y1", "y2"]
RANGE_DAYS = {
    "w1": 7,
    "m1": 30,
    "m3": 90,
    "m6": 180,
    "y1": 365,
    "y2": 730,
}


def render_store_link_tab() -> None:
    _init_store_state()
    _apply_pending_sl_store_input()
    _inject_store_search_css()

    q = st.text_input(
        t("store.input_label"),
        key="sl_store_input",
        placeholder=t("store.input_placeholder"),
        label_visibility="visible",
    )
    text = (q or "").strip()

    if not text and not st.session_state.sl_selected_id:
        st.session_state.sl_search_results = []
        st.session_state.sl_last_query = ""

    resolved, resolve_msg = resolve_direct_input(text)
    if resolve_msg:
        st.info(resolve_msg)

    _sl_invalidate_pool_if_owner_mismatch(resolved)

    is_selected = st.session_state.sl_selected_id is not None
    looks_pkg = text.startswith(("com.", "org.", "net.", "io.")) and "." in text

    if is_selected or looks_pkg or (resolved is not None):
        st.session_state.sl_show_search = False
    elif not text:
        st.session_state.sl_show_search = True

    if looks_like_search_keyword(text):
        st.session_state.sl_search_performed = True

    if st.session_state.sl_search_performed:

        def _sl_plat_changed() -> None:
            st.session_state["sl_last_query"] = ""

        # Streamlit, `st.container(key=K)` için sarmalayıcı DOM düğümüne
        # `st-key-K` sınıfı ekler — platform logosu CSS'i bu sınıfa bağlı.
        with st.container(key="sl_plat_radio_wrap"):
            st.radio(
                t("platform.label"),
                ["Android", "iOS"],
                horizontal=True,
                key="sl_last_filter",
                label_visibility="collapsed",
                on_change=_sl_plat_changed,
            )

        filt = st.session_state.sl_last_filter
        if looks_like_search_keyword(text) and len(text) >= 2:
            if text != st.session_state.sl_last_query or filt != st.session_state.get("_sl_prev_filter"):
                combined = _run_store_search_with_progress(text, filt)
                st.session_state.sl_search_results = combined
                st.session_state.sl_last_query = text
                st.session_state.sl_display_n = 12
                st.session_state._sl_prev_filter = filt

            results = st.session_state.sl_search_results or []
            if results:
                st.markdown(
                    f'<p class="sl-results-head">{html.escape(t("store.found_apps", n=len(results)))}</p>',
                    unsafe_allow_html=True,
                )
                n_show = min(st.session_state.sl_display_n, len(results))
                for idx, app in enumerate(results[:n_show]):
                    aid = app.get("appId", "")
                    plat = app.get("platform", "Android")
                    with st.container(border=True, key=f"sl_hit_{idx}"):
                        ic, inf = st.columns([1, 4], gap="small")
                        with ic:
                            icon = app.get("icon") or ""
                            if isinstance(icon, str) and icon.startswith("http"):
                                st.markdown(
                                    f'<div class="sl-row-icon"><img src="{html.escape(icon)}" alt=""/></div>',
                                    unsafe_allow_html=True,
                                )
                            else:
                                st.markdown('<div class="sl-row-noicon">app</div>', unsafe_allow_html=True)
                        with inf:
                            t_esc = html.escape(str(app.get("title", "—")))
                            id_esc = html.escape(str(app.get("appId", "")))
                            st.markdown(
                                f'<div class="sl-row-title">{t_esc}</div><div class="sl-row-id">{id_esc}</div>',
                                unsafe_allow_html=True,
                            )
                        if st.button(
                            t("common.select"),
                            key=f"sl_sel_{idx}_{aid}",
                            use_container_width=True,
                        ):
                            st.session_state.sl_selected_id = aid
                            st.session_state.sl_selected_platform = plat
                            st.session_state.sl_show_search = False
                            st.session_state.sl_search_results = []
                            st.session_state.sl_last_query = ""
                            st.session_state["_pending_sl_store_input"] = aid
                            st.session_state.review_pool_store = []
                            st.session_state.analysis_rows = []
                            st.session_state._sl_pool_owner = None
                            st.rerun()
                if len(results) > n_show:
                    if st.button(t("common.show_more"), key="sl_more"):
                        st.session_state.sl_display_n = min(st.session_state.sl_display_n + 12, len(results))
                        st.rerun()
            elif len(text) >= 2:
                st.warning(t("store.no_results"))

    if text or st.session_state.sl_selected_id:
        if st.button(t("common.reset_selection"), key="sl_reset"):
            st.session_state.sl_selected_id = None
            st.session_state.sl_selected_platform = None
            st.session_state.sl_show_search = True
            st.session_state.sl_search_results = []
            st.session_state.sl_last_query = ""
            st.session_state.sl_search_performed = False
            st.session_state["_pending_sl_store_input"] = ""
            # Tüm store havuzu ve analiz çıktıları temizlenir
            st.session_state.review_pool_store = []
            st.session_state.analysis_rows = []
            st.session_state._sl_pool_owner = None
            st.rerun()

    sid = st.session_state.sl_selected_id
    splat = st.session_state.sl_selected_platform

    if sid:
        st.divider()
        if splat == "iOS":
            _banner_ios(str(sid))
        else:
            _banner_play(str(sid))
    elif resolved:
        st.divider()
        if resolved.platform == "ios":
            _banner_ios(resolved.app_id)
        else:
            _banner_play(resolved.app_id)

    _sl_tr_key = time_range_state_key("sl_time_range")
    _migrate_date_session(("sl_time_range", "cmp_time_range", _sl_tr_key))
    _seed_time_range_from_legacy(_sl_tr_key, "sl_time_range")
    time_label = st.selectbox(
        t("date.range"),
        RANGE_OPTIONS,
        index=1,
        key=_sl_tr_key,
        format_func=_fmt_date_range,
    )
    days = RANGE_DAYS[time_label]

    st.markdown(f'<p class="sl-scope-label">{t("scope.label")}</p>', unsafe_allow_html=True)
    _sk = scope_state_key()
    _migrate_scope_session_key("sl_scope")
    _migrate_scope_session_key(_sk)
    _seed_scope_from_legacy(_sk, "sl_scope")
    scope_pick = st.segmented_control(
        t("scope.label"),
        options=["local", "global"],
        format_func=lambda c: t("scope.local") if c == "local" else t("scope.global"),
        selection_mode="single",
        default="global",
        key=_sk,
        label_visibility="collapsed",
        width="stretch",
        help=t("scope.help"),
    )
    scope_lbl = scope_pick if scope_pick is not None else st.session_state.get(_sk, "global")
    scope_val = "local" if scope_lbl == "local" else "global"

    if st.button(t("common.fetch_reviews"), type="secondary", use_container_width=True, key="sl_fetch_btn"):
        app_id: str | None = None
        platform: str | None = None

        if st.session_state.sl_selected_id:
            app_id = str(st.session_state.sl_selected_id)
            platform = "ios" if st.session_state.sl_selected_platform == "iOS" else "android"
        elif resolved:
            app_id = resolved.app_id
            platform = resolved.platform
        else:
            st.error(t("store.need_selection"))
            return

        # Yeni çekimden önce önceki havuzu/analizi sıfırla
        st.session_state.review_pool_store = []
        st.session_state.analysis_rows = []
        st.session_state._sl_pool_owner = None

        prog = st.progress(0.0)
        prog_txt = st.empty()
        t0 = time.perf_counter()
        # Progress asla geri gitmesin — fetcher veya UI kaynaklı değerleri
        # burada maksimum ile izleriz.
        _pct_state: dict[str, float] = {"max": 0.0}

        def _on_progress(x: float) -> None:
            pct = min(max(float(x), 0.0), 1.0)
            pct = max(_pct_state["max"], pct)
            _pct_state["max"] = pct
            prog.progress(pct)
            elapsed = time.perf_counter() - t0
            if pct > 0.001:
                eta = max(0.0, (elapsed / pct) - elapsed)
                _render_fetch_progress_text(prog_txt, pct, elapsed, eta)
            else:
                _render_fetch_progress_text(prog_txt, 0.0, elapsed, 0.0)

        try:
            if platform == "android":
                pool = fetch_google_play_reviews(
                    app_id,
                    days,
                    _progress_callback=_on_progress,
                    scope=scope_val,
                )
            else:
                pool = get_app_vivindiss(
                    app_id,
                    _progress_callback=_on_progress,
                    _days_limit=days,
                    scope=scope_val,
                )
            st.session_state.review_pool_store = pool
            st.session_state.analysis_rows = []
            st.session_state._sl_pool_owner = f"{platform}:{app_id}"
            prog.empty()
            prog_txt.empty()
            _range_display = _fmt_date_range(time_label)
            _scope_display = t("scope.local") if scope_val == "local" else t("scope.global")
            st.caption(
                t(
                    "store.loaded_summary",
                    n=len(pool),
                    range=_range_display,
                    scope=_scope_display.lower(),
                )
            )
        except Exception as e:
            prog.empty()
            prog_txt.empty()
            st.error(t("store.fetch_error", err=e))
