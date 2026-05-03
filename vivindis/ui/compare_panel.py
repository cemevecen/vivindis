"""
İki uygulama için mağaza yorumu çekme + duygu özeti (Karşılaştır sekmesi).
"""

from __future__ import annotations

import concurrent.futures
import html
import time
from typing import Any, Optional

import pandas as pd
import streamlit as st

from vivindis.config.i18n import get_lang, t
from vivindis.core.ai_providers import RichAnalyzer
from vivindis.core.analyzer import analyze_batch, dedupe_reviews
from vivindis.fetchers.app_discovery import (
    ResolvedApp,
    looks_like_search_keyword,
    resolve_direct_input,
    search_app_store_itunes,
    search_play_store,
)
from vivindis.fetchers.app_store import get_app_vivindiss
from vivindis.fetchers.google_play import fetch_google_play_reviews
from vivindis.ui.review_cards import render_analyzed_review_cards
from vivindis.ui.store_link_panel import (
    RANGE_DAYS,
    RANGE_OPTIONS,
    _fmt_date_range,
    _inject_store_search_css,
    _migrate_date_session,
    _migrate_scope_session_key,
    _seed_scope_from_legacy,
    _seed_time_range_from_legacy,
    time_range_state_key,
)

_CMP_COMPACT_CSS = """
<style>
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="element-container"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="element-container"] {
  margin-top: 0 !important;
  margin-bottom: 0.2rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stSelectbox"] [data-testid="stWidgetLabel"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stSelectbox"] [data-testid="stWidgetLabel"] {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stSelectbox"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stSelectbox"] {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell .cmp-selected-summary,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell .cmp-selected-summary {
  margin-top: -4px !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [class*="plat_radio_wrap"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [class*="plat_radio_wrap"] {
  margin: 4px 0 6px !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell hr,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell hr {
  display: none !important;
  margin: 0 !important;
  height: 0 !important;
  border: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stMetricContainer"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stMetricContainer"] {
  padding-top: 0.1rem !important;
  padding-bottom: 0.1rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stPlotlyChart"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stPlotlyChart"] {
  margin-top: 0.25rem !important;
  margin-bottom: 0.35rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stCaption"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stCaption"] {
  margin-top: 0.1rem !important;
  margin-bottom: 0.15rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stHeadingWithActionElements"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stHeadingWithActionElements"] {
  margin-top: 0.35rem !important;
  margin-bottom: 0.15rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="column"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="column"] {
  min-width: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-testid="stHorizontalBlock"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-testid="stHorizontalBlock"] {
  gap: 0.35rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-baseweb="segmented-control"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-baseweb="segmented-control"] {
  width: 100% !important;
  max-width: 100% !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_shell [data-baseweb="segmented-control"] button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-baseweb="segmented-control"] button {
  flex: 1 1 0 !important;
  min-width: 0 !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_0 [class*="plat_radio_wrap"],
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_1 [class*="plat_radio_wrap"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_0 [class*="plat_radio_wrap"],
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_1 [class*="plat_radio_wrap"] {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlock"].st-key-cmp_reset_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlock"].st-key-cmp_reset_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_reset_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_reset_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: center !important;
  align-self: center !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlock"].st-key-cmp_reset_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlock"].st-key-cmp_reset_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_reset_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_reset_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton {
  width: auto !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlock"].st-key-cmp_plat_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_plat_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlock"].st-key-cmp_reset_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlock"].st-key-cmp_reset_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_reset_row_0 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_reset_row_1 [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button {
  width: auto !important;
  min-width: 5.5rem !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_date_method_row [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_date_method_row [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child {
  display: flex !important;
  justify-content: flex-start !important;
  align-items: center !important;
}
[data-testid="stVerticalBlock"].st-key-cmp_date_method_row [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
[data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_date_method_row [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: center !important;
}
.cmp-prepare-title {
  margin: 8px 0 6px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #334155;
  letter-spacing: 0.02em;
}
.cmp-prepare-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 4px;
}
.cmp-prepare-status {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.cmp-prepare-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
  line-height: 1.2;
}
.cmp-prepare-chip--pct { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
.cmp-prepare-chip--elapsed { background: #f1f5f9; border-color: #e2e8f0; color: #475569; }
.cmp-pool-summary {
  margin: 8px 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  padding: 10px 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}
.cmp-pool-summary-head {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #64748b;
  text-transform: uppercase;
  margin: 0 0 6px;
}
.cmp-pool-summary-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cmp-pool-summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.92rem;
}
.cmp-pool-summary-row .cmp-pool-name {
  color: #0f172a;
  font-weight: 600;
  word-break: break-word;
}
.cmp-pool-summary-row .cmp-pool-count {
  color: #0f172a;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.cmp-pool-summary-row .cmp-pool-meta {
  color: #64748b;
  font-size: 0.75rem;
  margin-left: 6px;
  font-weight: 500;
}
@media (max-width: 768px) {
  .cmp-pool-summary-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .cmp-pool-summary-row .cmp-pool-meta { margin-left: 0; }
  [data-testid="stVerticalBlock"].st-key-cmp_shell [data-baseweb="segmented-control"],
  [data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-baseweb="segmented-control"] {
    flex-wrap: wrap !important;
    min-width: 0 !important;
  }
  [data-testid="stVerticalBlock"].st-key-cmp_shell [data-baseweb="segmented-control"] button,
  [data-testid="stVerticalBlockBorderWrapper"].st-key-cmp_shell [data-baseweb="segmented-control"] button {
    flex: 1 1 min(100%, 10rem) !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  [class*="st-key-cmp_plat_row_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
  [class*="st-key-cmp_plat_row_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child,
  [class*="st-key-cmp_reset_row_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
  [class*="st-key-cmp_reset_row_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child {
    justify-content: center !important;
    width: 100% !important;
  }
  [class*="st-key-cmp_plat_row_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
  [class*="st-key-cmp_plat_row_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child .stButton > button,
  [class*="st-key-cmp_reset_row_"] [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child .stButton > button,
  [class*="st-key-cmp_reset_row_"] [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child .stButton > button {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
}
</style>
"""


def _prepare_pool(rows: list[dict]) -> list[dict]:
    from vivindis.utils.validators import is_valid_comment

    out: list[dict] = []
    for r in dedupe_reviews(rows):
        t = str(r.get("text", "")).strip()
        if len(t) < 2:
            continue
        rr = dict(r)
        rr["is_valid"] = is_valid_comment(t)
        out.append(rr)
    return out


def _cmp_scope_state_key(slot: int) -> str:
    return f"cmp_scope_{slot}_{get_lang()}"


def _cmp_scope_for_slot(slot: int) -> str:
    """Slot için yerel/global seçimini canonical ('local'/'global') string'e çevir."""
    sk = _cmp_scope_state_key(slot)
    raw = st.session_state.get(sk)
    if raw is None:
        raw = st.session_state.get(f"cmp_scope_{slot}")
    if raw in ("local", "Yerel"):
        return "local"
    return "global"


def _cmp_prepared_key() -> str:
    return (
        f"{_cmp_slot_effective_raw(0)}|{_cmp_slot_effective_raw(1)}|"
        f"{st.session_state.get(time_range_state_key('cmp_time_range'), '')}|"
        f"{_cmp_scope_for_slot(0)}|{_cmp_scope_for_slot(1)}"
    )


def _reset_prepared_pools() -> None:
    st.session_state["cmp_prepared_pools"] = {}
    st.session_state.pop("_cmp_prepared_key", None)


def _fmt_cmp_duration(total_seconds: float) -> str:
    secs = max(0, int(total_seconds))
    mins, sec = divmod(secs, 60)
    return f"{mins:02d}:{sec:02d}"


def _fetch_compare_pools(days: int) -> tuple[dict[str, dict[str, Any]], list[str]]:
    """İki slot için yorum havuzunu paralel çeker; progress bar + canlı sayım gösterir."""
    inputs = [(0, _cmp_slot_effective_raw(0)), (1, _cmp_slot_effective_raw(1))]
    resolved_pairs: list[tuple[int, Optional[ResolvedApp], str]] = []
    errors: list[str] = []

    for slot, raw in inputs:
        res, _msg = resolve_direct_input(raw) if raw else (None, None)
        if res is None:
            if raw and len(raw) > 48:
                errors.append(
                    t("compare.err_unresolvable_long", i=slot + 1, raw=raw[:48])
                )
            else:
                errors.append(t("compare.err_unresolvable", i=slot + 1))
        resolved_pairs.append((slot, res, raw))

    if errors:
        return {}, errors

    with st.container(key="cmp_prepare_box"):
        st.markdown(
            f'<p class="cmp-prepare-title">{html.escape(t("compare.prep_title"))}</p>',
            unsafe_allow_html=True,
        )
        col1, col2 = st.columns(2, gap="small")
        slots_ui = {}
        for slot, res, raw in resolved_pairs:
            meta_preview = _metadata(res) if res else {"title": raw}
            title = str(meta_preview.get("title") or (res.app_id if res else raw))
            target_col = col1 if slot == 0 else col2
            with target_col:
                st.markdown(
                    f'<div class="cmp-prepare-label">{html.escape(title)}</div>',
                    unsafe_allow_html=True,
                )
                bar = st.progress(0.0)
                status = st.empty()
                slots_ui[slot] = (title, bar, status, meta_preview, res)

    progress_state: dict[int, dict[str, float]] = {
        0: {"pct": 0.0, "done": 0.0, "display": 0.0},
        1: {"pct": 0.0, "done": 0.0, "display": 0.0},
    }
    start_ts = time.perf_counter()

    def _worker(slot: int, res: ResolvedApp) -> list[dict]:
        def _cb(x: float | int) -> None:
            try:
                val = float(x)
            except Exception:
                val = 0.0
            new_pct = max(0.0, min(1.0, val))
            # Gerçek ilerleme asla geri gitmesin
            progress_state[slot]["pct"] = max(
                float(progress_state[slot]["pct"]), new_pct
            )

        scope_val = _cmp_scope_for_slot(slot)
        if res.platform == "android":
            pool = fetch_google_play_reviews(
                res.app_id, days, _progress_callback=_cb, scope=scope_val
            )
        else:
            pool = get_app_vivindiss(
                res.app_id, _progress_callback=_cb, _days_limit=days, scope=scope_val
            )
        progress_state[slot]["done"] = 1.0
        return pool

    futures: dict[int, concurrent.futures.Future] = {}
    pools_out: dict[int, list[dict]] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        for slot, res, _raw in resolved_pairs:
            if res is not None:
                futures[slot] = ex.submit(_worker, slot, res)

        while any(not f.done() for f in futures.values()):
            for slot, f in futures.items():
                title, bar, status, _meta, _res = slots_ui[slot]
                pct_now = float(progress_state[slot]["pct"])
                elapsed = time.perf_counter() - start_ts
                # Sentetik ramp: yalnızca alt sınır olarak, %25'i asla geçmez
                # (gerçek veri gelmediyse "çalışıyor" hissi için). Gerçek veri
                # gelince onu kullanırız ve display'i maksimum ile izleriz ki
                # asla geri gitmesin.
                if pct_now > 0.0:
                    candidate = min(0.99, pct_now)
                else:
                    candidate = min(0.25, 1.0 - (2.71828 ** (-elapsed / 14.0)))
                prev_display = float(progress_state[slot]["display"])
                display_pct = max(prev_display, candidate)
                progress_state[slot]["display"] = display_pct
                bar.progress(min(0.99, display_pct))
                # Kullanıcıya gösterilen % da geri gitmesin: display'i baz al
                shown_pct = int(display_pct * 100)
                status.markdown(
                    (
                        '<div class="cmp-prepare-status">'
                        f'<span class="cmp-prepare-chip cmp-prepare-chip--pct">%{shown_pct}</span>'
                        f'<span class="cmp-prepare-chip cmp-prepare-chip--elapsed">{html.escape(t("compare.elapsed"))} {_fmt_cmp_duration(elapsed)}</span>'
                        "</div>"
                    ),
                    unsafe_allow_html=True,
                )
            time.sleep(0.18)

        for slot, f in futures.items():
            try:
                pools_out[slot] = f.result()
            except Exception as e:
                title, _bar, _status, _meta, _res = slots_ui[slot]
                errors.append(f"{title}: {e}")
                pools_out[slot] = []

    # UI alanını temizle — son durumu göstermeyeceğiz, özet ayrı blokta verilecek.
    for slot, (_title, bar, status, _meta, _res) in slots_ui.items():
        bar.empty()
        status.empty()

    prepared: dict[str, dict[str, Any]] = {}
    for slot, res, _raw in resolved_pairs:
        if res is None:
            continue
        pool = pools_out.get(slot, []) or []
        prepared_rows = _prepare_pool(pool)
        meta = _metadata(res)
        slug = f"{res.platform}:{res.app_id}"
        prepared[slug] = {
            "slot": slot,
            "title": meta.get("title") or res.app_id,
            "platform": res.platform,
            "app_id": res.app_id,
            "meta": meta,
            "fetched_n": len(pool),
            "prepared": prepared_rows,
        }

    return prepared, errors


def _run_compare_search_with_progress(query: str, platform_filter: str, slot: int) -> list:
    """Karşılaştırma slot aramasını arka thread'de çalıştırıp kademeli göster."""
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
            while not future.done():
                elapsed = time.perf_counter() - start
                staged = min(0.92, 1.0 - (2.71828 ** (-elapsed / 1.35)))
                status.caption(f"uygulama {slot + 1} için mağaza sonuçları taranıyor…")
                bar.progress(staged)
                time.sleep(0.12)
            results = future.result()

        bar.progress(0.98)
        status.caption(f"{len(results)} sonuç işlendi…")
        bar.progress(1.0)
        return results
    finally:
        bar.empty()
        status.empty()


def _metadata_android(app_id: str) -> dict[str, Any]:
    try:
        from google_play_scraper import app as play_app

        info = play_app(app_id, lang="tr", country="tr")
        cats = info.get("categories") or []
        genre = "—"
        if cats and isinstance(cats[0], dict):
            genre = str(cats[0].get("name", "—"))
        return {
            "title": str(info.get("title") or app_id),
            "icon": str(info.get("icon") or "").strip(),
            "store": "Google Play",
            "rating": round(float(info.get("score") or 0), 1),
            "ratings": int(info.get("ratings") or 0),
            "installs": str(info.get("installs") or "—"),
            "version": str(info.get("version") or "—"),
            "genre": genre,
        }
    except Exception:
        return {
            "title": app_id,
            "icon": "",
            "store": "Google Play",
            "rating": 0.0,
            "ratings": 0,
            "installs": "—",
            "version": "—",
            "genre": "—",
        }


def _metadata_ios(app_id: str) -> dict[str, Any]:
    import requests

    title, icon, rating, ratings, ver, genre = app_id, "", 0.0, 0, "—", "—"
    for cc in ("tr", "us", "gb"):
        try:
            r = requests.get(
                f"https://itunes.apple.com/lookup?id={app_id}&country={cc}",
                timeout=8,
            )
            if r.status_code != 200:
                continue
            data = r.json().get("results") or []
            if not data:
                continue
            a0 = data[0]
            title = str(a0.get("trackCensoredName") or a0.get("trackName") or app_id)
            icon = str(a0.get("artworkUrl512") or a0.get("artworkUrl100") or "").strip()
            rating = round(float(a0.get("averageUserRating") or 0), 1)
            ratings = int(a0.get("userRatingCount") or 0)
            ver = str(a0.get("version") or "—")
            genre = str(a0.get("primaryGenreName") or "—")
            break
        except Exception:
            continue
    return {
        "title": title,
        "icon": icon,
        "store": "App Store",
        "rating": rating,
        "ratings": ratings,
        "installs": "App Store",
        "version": ver,
        "genre": genre,
    }


def _metadata(resolved: ResolvedApp) -> dict[str, Any]:
    if resolved.platform == "android":
        return _metadata_android(resolved.app_id)
    return _metadata_ios(resolved.app_id)


def _aggregate_rows(rows: list[dict]) -> dict[str, int | float]:
    if not rows:
        return {
            "total": 0,
            "pos": 0,
            "neg": 0,
            "neu": 0,
            "pos_pct": 0,
            "neg_pct": 0,
            "neu_pct": 0,
            "score": 0,
        }
    df = pd.DataFrame(rows)
    vc = df["Baskın Duygu"].value_counts() if "Baskın Duygu" in df.columns else pd.Series(dtype=int)
    pos = int(vc.get("Olumlu", 0))
    neg = int(vc.get("Olumsuz", 0))
    neu = int(vc.get("İstek/Görüş", 0))
    total_v = pos + neg + neu
    if total_v < 1:
        total_v = 1
    pos_pct = int(pos * 100 / total_v)
    neg_pct = int(neg * 100 / total_v)
    neu_pct = int(neu * 100 / total_v)
    score = int((pos * 100 + neu * 50) / total_v)
    return {
        "total": len(rows),
        "pos": pos,
        "neg": neg,
        "neu": neu,
        "pos_pct": pos_pct,
        "neg_pct": neg_pct,
        "neu_pct": neu_pct,
        "score": score,
    }


def _cmp_review_chip_label(meta_by_slug: dict[str, Any], slug: str, letter: str, *, max_len: int = 30) -> str:
    t = str((meta_by_slug.get(slug) or {}).get("title") or slug).strip()
    if len(t) > max_len:
        t = t[: max_len - 1] + "…"
    return f"{letter} · {t}"


def _cmp_pick_prefix(slot: int) -> str:
    return f"cmp_pick_{slot}_"


def _init_cmp_pick_defaults(slot: int) -> None:
    p = _cmp_pick_prefix(slot)
    pairs: list[tuple[str, Any]] = [
        ("selected_id", None),
        ("selected_platform", None),
        ("selected_title", ""),
        ("search_results", []),
        ("last_query", ""),
        ("last_filter", "Android"),
        ("display_n", 12),
        ("search_performed", False),
        ("prev_filter", ""),
    ]
    for name, val in pairs:
        k = f"{p}{name}"
        if k not in st.session_state:
            st.session_state[k] = val


def _apply_pending_cmp_store_in(slot: int) -> None:
    pk = f"_pending_cmp_store_in_{slot}"
    if pk not in st.session_state:
        return
    val = st.session_state.pop(pk)
    st.session_state[f"cmp_store_in_{slot}"] = val


def _reset_cmp_slot(slot: int) -> None:
    p = _cmp_pick_prefix(slot)
    # cmp_store_in_* bu slotta text_input ile bağlı; widget çizildikten sonra doğrudan
    # atamak StreamlitAPIException üretir. Bir sonraki run başında _apply_pending_cmp_store_in uygular.
    st.session_state[f"_pending_cmp_store_in_{slot}"] = ""
    st.session_state[f"{p}selected_id"] = None
    st.session_state[f"{p}selected_platform"] = None
    st.session_state[f"{p}selected_title"] = ""
    st.session_state[f"{p}search_results"] = []
    st.session_state[f"{p}last_query"] = ""
    st.session_state[f"{p}display_n"] = 12
    st.session_state[f"{p}search_performed"] = False
    st.session_state[f"{p}prev_filter"] = ""
    # Slot değişince mevcut karşılaştırma havuzu/analizi eskimiş olur.
    st.session_state["cmp_prepared_pools"] = {}
    st.session_state.pop("_cmp_prepared_key", None)
    st.session_state.cmp_results = {}
    st.session_state.cmp_detail_rows = {}
    st.session_state.analysis_rows = []


def _cmp_slot_effective_raw(slot: int) -> str:
    p = _cmp_pick_prefix(slot)
    sid = st.session_state.get(f"{p}selected_id")
    if sid:
        return str(sid).strip()
    return (st.session_state.get(f"cmp_store_in_{slot}") or "").strip()


def compare_tab_has_user_input() -> bool:
    """Karşılaştır: en az bir slotta arama metni veya seçili uygulama var mı (havuz metrik şeridi için)."""
    return bool(_cmp_slot_effective_raw(0) or _cmp_slot_effective_raw(1))


def _render_compare_app_picker(slot: int, heading: str) -> None:
    """Mağaza sekmesiyle aynı: isim araması + Android/iOS + sonuç listesi + Seç; paket/ID/link doğrudan."""
    _apply_pending_cmp_store_in(slot)
    _init_cmp_pick_defaults(slot)
    p = _cmp_pick_prefix(slot)
    in_key = f"cmp_store_in_{slot}"

    st.text_input(
        t("store.slot_input_label", heading=heading),
        key=in_key,
        placeholder=t("compare.input_placeholder"),
        label_visibility="visible",
    )
    text = (st.session_state.get(in_key) or "").strip()

    sel_id = st.session_state.get(f"{p}selected_id")
    # Metin kutusu listeden seçilen paketten farklı olabilir (örn. hâlâ "letgo" yazıyor);
    # arama kelimesi iken seçimi silme — yoksa Karşılaştır yalnızca kelimeye düşer ve çözülemez.
    if sel_id and text and text != str(sel_id):
        direct_res, _ = resolve_direct_input(text)
        if direct_res is not None and str(direct_res.app_id) != str(sel_id):
            st.session_state[f"{p}selected_id"] = None
            st.session_state[f"{p}selected_platform"] = None
            st.session_state[f"{p}selected_title"] = ""

    resolved, resolve_msg = resolve_direct_input(text)
    if resolve_msg:
        st.info(resolve_msg)

    is_selected = st.session_state.get(f"{p}selected_id") is not None

    if not text and not is_selected:
        st.session_state[f"{p}search_results"] = []
        st.session_state[f"{p}last_query"] = ""

    if looks_like_search_keyword(text):
        st.session_state[f"{p}search_performed"] = True

    sid = st.session_state.get(f"{p}selected_id")
    splat = st.session_state.get(f"{p}selected_platform")

    if st.session_state.get(f"{p}search_performed"):

        def _cmp_plat_changed() -> None:
            st.session_state[f"{p}last_query"] = ""

        with st.container(key=f"cmp_plat_row_{slot}"):
            plat_c, reset_c = st.columns([4, 1], gap="small", vertical_alignment="center")
            with plat_c:
                # Gerçek wrapper: `st-key-cmp_plat_radio_wrap_{slot}` sınıfı,
                # ortak `[class*="plat_radio_wrap"]` CSS'iyle logo görünümünü alır.
                with st.container(key=f"cmp_plat_radio_wrap_{slot}"):
                    st.radio(
                        t("platform.label"),
                        ["Android", "iOS"],
                        horizontal=True,
                        key=f"{p}last_filter",
                        label_visibility="collapsed",
                        on_change=_cmp_plat_changed,
                    )
            with reset_c:
                if sid and st.button(t("common.reset"), key=f"cmp_slot_reset_{slot}", use_container_width=False):
                    _reset_cmp_slot(slot)
                    st.rerun()

        with st.container(key=f"cmp_scope_row_{slot}"):
            st.markdown(
                f'<p class="sl-scope-label">{t("scope.label")}</p>',
                unsafe_allow_html=True,
            )
            _csk = _cmp_scope_state_key(slot)
            _legacy_sk = f"cmp_scope_{slot}"
            _migrate_scope_session_key(_legacy_sk)
            _migrate_scope_session_key(_csk)
            _seed_scope_from_legacy(_csk, _legacy_sk)
            st.segmented_control(
                t("scope.label"),
                options=["local", "global"],
                format_func=lambda c: t("scope.local") if c == "local" else t("scope.global"),
                selection_mode="single",
                default="global",
                key=_csk,
                label_visibility="collapsed",
                width="stretch",
                help=t("scope.help"),
            )

        filt = st.session_state.get(f"{p}last_filter", "Android")
        if looks_like_search_keyword(text) and len(text) >= 2:
            if text != st.session_state.get(f"{p}last_query") or filt != st.session_state.get(f"{p}prev_filter"):
                combined = _run_compare_search_with_progress(text, filt, slot)
                st.session_state[f"{p}search_results"] = combined
                st.session_state[f"{p}last_query"] = text
                st.session_state[f"{p}display_n"] = 12
                st.session_state[f"{p}prev_filter"] = filt

            results = st.session_state.get(f"{p}search_results") or []
            if results:
                st.markdown(
                    f'<p class="sl-results-head">{html.escape(t("store.found_apps", n=len(results)))}</p>',
                    unsafe_allow_html=True,
                )
                n_show = min(int(st.session_state.get(f"{p}display_n") or 12), len(results))
                for idx, app in enumerate(results[:n_show]):
                    aid = app.get("appId", "")
                    plat = app.get("platform", "Android")
                    with st.container(border=True, key=f"cmp_hit_{slot}_{idx}"):
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
                            key=f"cmp_sel_{slot}_{idx}_{aid}",
                            use_container_width=True,
                        ):
                            st.session_state[f"{p}selected_id"] = aid
                            st.session_state[f"{p}selected_platform"] = plat
                            st.session_state[f"{p}selected_title"] = str(app.get("title") or "")[:120]
                            st.session_state[f"{p}search_results"] = []
                            st.session_state[f"{p}last_query"] = ""
                            st.session_state[f"_pending_cmp_store_in_{slot}"] = aid
                            st.rerun()
                if len(results) > n_show:
                    if st.button(t("common.show_more"), key=f"cmp_more_{slot}"):
                        st.session_state[f"{p}display_n"] = min(
                            int(st.session_state.get(f"{p}display_n") or 12) + 12,
                            len(results),
                        )
                        st.rerun()
            elif len(text) >= 2 and looks_like_search_keyword(text):
                st.warning(t("store.no_results"))
    elif sid:
        with st.container(key=f"cmp_reset_row_{slot}"):
            _, reset_c = st.columns([4, 1], gap="small", vertical_alignment="center")
            with reset_c:
                if st.button(t("common.reset"), key=f"cmp_slot_reset_{slot}", use_container_width=False):
                    _reset_cmp_slot(slot)
                    st.rerun()

    sid = st.session_state.get(f"{p}selected_id")
    splat = st.session_state.get(f"{p}selected_platform")
    if sid:
        stitle = (st.session_state.get(f"{p}selected_title") or "").strip()
        if stitle:
            st.markdown(
                '<div class="cmp-selected-summary">'
                f'<p style="margin:0;font-size:0.88rem;color:#0f172a;line-height:1.3;"><b>{html.escape(stitle)}</b></p>'
                f'<p style="margin:2px 0 0 0;font-size:0.75rem;color:#64748b;line-height:1.25;word-break:break-all;">'
                f'<code style="font-size:0.72rem;">{html.escape(str(sid))}</code> · '
                f"<b>{html.escape(str(splat or '—'))}</b></p>"
                "</div>",
                unsafe_allow_html=True,
            )
        else:
            sid_e = html.escape(str(sid))
            sp_e = html.escape(str(splat or "—"))
            st.markdown(
                '<div class="cmp-selected-summary">'
                f'<p style="margin:0;font-size:0.82rem;color:#64748b;">Seçili: <code>{sid_e}</code> · <b>{sp_e}</b></p>'
                "</div>",
                unsafe_allow_html=True,
            )


def merge_compare_details_for_dashboard() -> list[dict[str, Any]]:
    """cmp_detail_rows + cmp_results → ana ekran analiz tablosu (Uygulama sütunu)."""
    detail_cmp = st.session_state.get("cmp_detail_rows") or {}
    meta_cmp = st.session_state.get("cmp_results") or {}
    merged: list[dict[str, Any]] = []
    n = 1
    for slug, app_rows in detail_cmp.items():
        title = (meta_cmp.get(slug) or {}).get("title", slug)
        for r in app_rows:
            row = dict(r)
            row["No"] = n
            n += 1
            row["Uygulama"] = title
            merged.append(row)
    return merged


def execute_compare_analysis(
    *,
    rich: RichAnalyzer,
    has_llm_keys: bool,
    default_models: dict[str, str],
    use_heuristic_only: bool,
    analysis_mode: int,
) -> tuple[int, list[str]]:
    """
    Önceden hazırlanmış yorum havuzunu (cmp_prepared_pools) analiz eder;
    cmp_results / cmp_detail_rows güncellenir.
    Dönüş: (tamamlanan uygulama sayısı 0–2, hata metinleri).
    """
    provider = "Google Gemini"
    model = (default_models.get("Google Gemini") or "").strip() or default_models.get(provider, "")

    time_label = st.session_state.get(time_range_state_key("cmp_time_range")) or RANGE_OPTIONS[1]
    if time_label not in RANGE_DAYS:
        time_label = RANGE_OPTIONS[1]
    days = RANGE_DAYS[time_label]

    prepared_pools: dict[str, dict[str, Any]] = st.session_state.get("cmp_prepared_pools") or {}
    errors: list[str] = []

    if len(prepared_pools) < 2:
        return 0, [t("compare.warn_need_pools")]
    if not use_heuristic_only and not has_llm_keys:
        return 0, [t("analysis.err_need_api")]

    results: dict[str, dict[str, Any]] = {}
    detail_rows: dict[str, list[dict]] = {}
    n_pool = len(prepared_pools)
    bar = st.progress(0.0)
    status = st.empty()
    try:
        for idx, (slug, entry) in enumerate(prepared_pools.items()):
            meta = entry.get("meta") or {}
            title = meta.get("title") or slug
            try:
                prepared = entry.get("prepared") or []
                pool_n = int(entry.get("fetched_n") or 0)
                prep_n = len(prepared)
                if not prepared:
                    errors.append(f"{title}: analiz edilecek yorum yok.")
                    continue
                title_short = str(title)[:44] + ("…" if len(str(title)) > 44 else "")

                def _prog(
                    done: int,
                    total: int,
                    *,
                    _ts: str = title_short,
                    _i: int = idx,
                    _np: int = n_pool,
                ) -> None:
                    base = _i / max(_np, 1)
                    span = 1.0 / max(_np, 1)
                    frac = base + span * (done / max(total, 1))
                    bar.progress(min(0.99, frac))
                    status.caption(
                        t("compare.analysis_caption", title=_ts, done=done, total=total)
                    )

                rows = analyze_batch(
                    prepared,
                    use_heuristic_only=use_heuristic_only,
                    analysis_mode=analysis_mode,
                    rich=None if use_heuristic_only else rich,
                    provider=provider,
                    model=model,
                    max_workers=28 if use_heuristic_only else 12,
                    progress=_prog,
                    max_rich_items=500,
                    ui_lang=get_lang(),
                )
                agg = _aggregate_rows(rows)
                detail_rows[slug] = list(rows)
                rich_cap = (not use_heuristic_only) and (prep_n > 500)
                platform = entry.get("platform") or "android"
                app_id = entry.get("app_id") or slug
                results[slug] = {
                    **meta,
                    **agg,
                    "app_id": app_id,
                    "platform": platform,
                    "chart_label": f"{title[:36]}{'…' if len(title) > 36 else ''} ({'Play' if platform == 'android' else 'App Store'})",
                    "cmp_pool_fetched": pool_n,
                    "cmp_pool_prepared": prep_n,
                    "cmp_rich_capped": rich_cap,
                    "cmp_rich_cap_limit": 500 if rich_cap else None,
                }
            except Exception as e:
                errors.append(f"{title}: {e}")
        bar.progress(1.0)
    finally:
        bar.empty()
        status.empty()

    st.session_state.cmp_results = results
    st.session_state.cmp_detail_rows = detail_rows
    st.session_state.cmp_range_label = time_label
    st.session_state.cmp_days_used = int(days)
    return len(results), errors


def render_compare_tab(
    *,
    rich: RichAnalyzer,
    has_llm_keys: bool,
    default_models: dict[str, str],
) -> None:
    if "cmp_results" not in st.session_state:
        st.session_state.cmp_results = {}
    if "cmp_detail_rows" not in st.session_state:
        st.session_state.cmp_detail_rows = {}

    _inject_store_search_css()
    st.markdown(_CMP_COMPACT_CSS, unsafe_allow_html=True)
    with st.container(key="cmp_shell"):
        ca, cb = st.columns(2, gap="small")
        with ca:
            _render_compare_app_picker(0, t("compare.slot_heading", i=1))
        with cb:
            _render_compare_app_picker(1, t("compare.slot_heading", i=2))

        _ct_key = time_range_state_key("cmp_time_range")
        _migrate_date_session(("sl_time_range", "cmp_time_range", _ct_key))
        _seed_time_range_from_legacy(_ct_key, "cmp_time_range")
        with st.container(key="cmp_date_method_row"):
            tcol, _sp = st.columns([1, 2.2], gap="medium", vertical_alignment="center")
            with tcol:
                time_label = st.selectbox(
                    t("date.range"),
                    RANGE_OPTIONS,
                    index=None,
                    placeholder=t("date.placeholder"),
                    key=_ct_key,
                    label_visibility="hidden",
                    format_func=_fmt_date_range,
                )
            with _sp:
                st.empty()

        both_selected = bool(_cmp_slot_effective_raw(0)) and bool(_cmp_slot_effective_raw(1))
        date_chosen = isinstance(time_label, str) and time_label in RANGE_DAYS
        days = RANGE_DAYS[time_label] if date_chosen else 0

        res = st.session_state.get("cmp_results") or {}

        # 1) Havuzu yalnızca "iki uygulama seçildi + tarih elle belirlendi" durumunda
        #    otomatik hazırla. Açılış sırasında ön-seçili bir tarih yok; böylece
        #    kullanıcı tarih aralığına bilinçli karar vermeden çekim başlamaz.
        if both_selected and not date_chosen:
            st.caption(t("compare.hint_pick_date"))
        current_key = _cmp_prepared_key() if date_chosen else ""
        prepared_pools = st.session_state.get("cmp_prepared_pools") or {}
        if (
            both_selected
            and date_chosen
            and st.session_state.get("_cmp_prepared_key") != current_key
        ):
            prepared_pools, prep_errors = _fetch_compare_pools(days)
            st.session_state["cmp_prepared_pools"] = prepared_pools
            st.session_state["_cmp_prepared_key"] = current_key
            # Yeni havuz geldi; mevcut karşılaştırma sonuçları eskidi
            st.session_state.cmp_results = {}
            st.session_state.cmp_detail_rows = {}
            st.session_state.analysis_rows = []
            res = {}
            for er in prep_errors:
                st.warning(er)

        # 2) Havuz özeti — her uygulama için benzersiz yorum sayısı
        if prepared_pools:
            rows_html_parts: list[str] = []
            for _slug, entry in prepared_pools.items():
                name = html.escape(str(entry.get("title") or _slug))
                plat_lbl = "Play" if entry.get("platform") == "android" else "App Store"
                prep_n = int(len(entry.get("prepared") or []))
                fetched_n = int(entry.get("fetched_n") or 0)
                meta_bits = [plat_lbl]
                if fetched_n and fetched_n != prep_n:
                    meta_bits.append(f"ham {fetched_n}")
                meta_line = " · ".join(meta_bits)
                rows_html_parts.append(
                    '<div class="cmp-pool-summary-row">'
                    f'<span class="cmp-pool-name">{name}<span class="cmp-pool-meta">{meta_line}</span></span>'
                    f'<span class="cmp-pool-count">{prep_n}</span>'
                    "</div>"
                )
            st.markdown(
                '<div class="cmp-pool-summary">'
                f'<p class="cmp-pool-summary-head">{html.escape(t("compare.pool_summary_head"))}</p>'
                '<div class="cmp-pool-summary-list">'
                + "".join(rows_html_parts)
                + "</div></div>",
                unsafe_allow_html=True,
            )

        # 3) Analiz yöntemi seçimi — "Karşılaştırmayı başlat" butonunun hemen üstünde.
        st.markdown(
            f'<p class="section-title section-title--tight">{html.escape(t("compare.analysis_settings"))}</p>',
            unsafe_allow_html=True,
        )
        _method_label_map = {
            "Hızlı (heuristic)": t("compare.method_fast"),
            "Zengin (LLM)": t("compare.method_rich"),
        }
        _method_pick_cmp = st.segmented_control(
            t("compare.analysis_settings"),
            options=["Hızlı (heuristic)", "Zengin (LLM)"],
            format_func=lambda v: _method_label_map.get(v, v),
            selection_mode="single",
            default="Hızlı (heuristic)",
            key="main_analysis_method",
            label_visibility="collapsed",
            width="stretch",
        )
        _method_cmp = _method_pick_cmp if _method_pick_cmp is not None else st.session_state.get(
            "main_analysis_method", "Hızlı (heuristic)"
        )
        if _method_cmp != "Hızlı (heuristic)":
            _depth_label_map = {
                "Standart": t("compare.depth_std"),
                "Gelişmiş": t("compare.depth_adv"),
            }
            st.radio(
                t("compare.depth_label"),
                ["Standart", "Gelişmiş"],
                horizontal=True,
                key="main_depth",
                format_func=lambda v: _depth_label_map.get(v, v),
            )

        # 4) Tek buton: "Karşılaştırmayı başlat". Basıldığında analiz + merge.
        _ready_to_start = bool(prepared_pools) and len(prepared_pools) >= 2
        with st.container(key="cmp_start_method_row"):
            if st.button(
                t("common.start_compare"),
                type="primary",
                use_container_width=True,
                key="cmp_start",
                disabled=not _ready_to_start,
            ):
                main_pick = st.session_state.get("main_analysis_method", "Hızlı (heuristic)")
                use_fast = main_pick == "Hızlı (heuristic)"
                main_depth = st.session_state.get("main_depth", "Standart")
                mode_idx = 0 if str(main_depth) == "Standart" else 1
                if not _ready_to_start:
                    st.warning(t("compare.warn_need_pools"))
                elif not use_fast and not has_llm_keys:
                    st.error(t("compare.err_rich_api"))
                else:
                    with st.spinner(t("compare.spinner")):
                        n_ok, errs = execute_compare_analysis(
                            rich=rich,
                            has_llm_keys=has_llm_keys,
                            default_models=default_models,
                            use_heuristic_only=use_fast,
                            analysis_mode=mode_idx,
                        )
                    for er in errs:
                        st.error(er)
                    # Ana dashboard için satırları birleştir ve analysis_rows'a yaz.
                    merged_cmp = merge_compare_details_for_dashboard()
                    if merged_cmp:
                        st.session_state.analysis_rows = merged_cmp
                        st.session_state._last_analysis_use_fast = use_fast
                    res = st.session_state.get("cmp_results") or {}

        _, c_clear = st.columns([3, 1], gap="small")
        with c_clear:
            if res and st.button(t("common.clear_results"), key="cmp_clear", use_container_width=True):
                st.session_state.cmp_results = {}
                st.session_state.cmp_detail_rows = {}
                st.session_state.pop("cmp_range_label", None)
                st.session_state.pop("cmp_days_used", None)
                st.session_state.analysis_rows = []
                st.rerun()

        if res:
            st.markdown(f"#### {t('compare.results_summary_heading')}")
            days_u = st.session_state.get("cmp_days_used")
            rng_lbl = st.session_state.get("cmp_range_label") or time_label
            if days_u is not None:
                st.markdown(
                    f'<p style="margin:0 0 10px 0;font-size:0.8rem;color:#475569;">'
                    f"{html.escape(str(rng_lbl))} · <b>{int(days_u)}</b> gün</p>",
                    unsafe_allow_html=True,
                )
            cols = st.columns(len(res))
            colors = ["#6366F1", "#F97316", "#0EA5E9"]
            for i, (_slug, data) in enumerate(res.items()):
                app_nm = data.get("title") or _slug
                with cols[i]:
                    accent = colors[i % len(colors)]
                    st.markdown(
                        f'<div style="font-size:0.75rem;font-weight:700;color:{accent};margin-bottom:6px;">'
                        f"{html.escape(str(app_nm))}</div>",
                        unsafe_allow_html=True,
                    )
                    icon = (data.get("icon") or "").strip()
                    if icon.startswith("http"):
                        st.image(icon, width=56)
                    st.caption(f"{data.get('store', '')} · {data.get('genre', '—')}")
                    rt = data.get("rating")
                    rct = data.get("ratings")
                    if rt is not None or (rct is not None and int(rct or 0) > 0):
                        st.markdown(
                            f'<p style="margin:0 0 4px 0;font-size:0.72rem;color:#64748b;">'
                            f"Mağaza <b>{float(rt or 0):.1f}</b> · <b>{int(rct or 0)}</b> oy</p>",
                            unsafe_allow_html=True,
                        )
                    fe = data.get("cmp_pool_fetched")
                    if fe is not None:
                        pr = int(data.get("cmp_pool_prepared") or 0)
                        cap = bool(data.get("cmp_rich_capped"))
                        lim = data.get("cmp_rich_cap_limit")
                        bits = [f"Ham <b>{int(fe)}</b>", f"Filtre <b>{pr}</b>"]
                        if cap and lim:
                            bits.append(f"LLM ≤<b>{int(lim)}</b>")
                        st.markdown(
                            '<p style="margin:0 0 8px 0;font-size:0.72rem;color:#64748b;line-height:1.4;">'
                            + " · ".join(bits)
                            + "</p>",
                            unsafe_allow_html=True,
                        )
                    # Duygu skoru / progress bar ikili özet + olumlu-olumsuz bar grafiği
                    # compare akışında kaldırıldı — aynı bilgi altta split dashboard'ta
                    # (metric pill'ler + duygu dağılımı + puan dağılımı) gösteriliyor.

            st.markdown("#### Yorumlar")
            detail = st.session_state.get("cmp_detail_rows") or {}
            if not detail:
                st.markdown(
                    '<p style="color:#64748b;font-size:0.92rem;margin:0;">'
                    "Yorum satırları bulunamadı. Karşılaştırmayı yeniden çalıştırın.</p>",
                    unsafe_allow_html=True,
                )
            else:
                key_list = list(res.keys())[:2]
                if len(key_list) == 1:
                    slug = key_list[0]
                    data = res.get(slug) or {}
                    title = html.escape(str(data.get("title") or slug))
                    rows_d = detail.get(slug) or []
                    st.markdown(
                        f'<p style="font-weight:700;color:#334155;margin:8px 0 4px 0;">{title}</p>',
                        unsafe_allow_html=True,
                    )
                    aid_disp = str(data.get("app_id", "") or "")
                    ch_disp = str(data.get("chart_label", "") or "")
                    st.caption(f"{int(data.get('total', 0))} · {aid_disp} · {ch_disp}")
                    if not rows_d:
                        st.write("—")
                    else:
                        render_analyzed_review_cards(rows_d, key_prefix="cmp_0")
                else:
                    slugs = key_list
                    icon_a = str((res.get(slugs[0]) or {}).get("icon") or "").strip()
                    icon_b = str((res.get(slugs[1]) or {}).get("icon") or "").strip()
                    title_a = str((res.get(slugs[0]) or {}).get("title") or slugs[0])
                    title_b = str((res.get(slugs[1]) or {}).get("title") or slugs[1])
                    have_icons = icon_a.startswith("http") and icon_b.startswith("http")

                    cur = st.session_state.get("cmp_review_slug")
                    if cur not in slugs:
                        cur = slugs[0]
                        st.session_state["cmp_review_slug"] = cur

                    if have_icons:
                        st.markdown(
                            "<style>"
                            ".st-key-cmp_rev_sel_a button, .st-key-cmp_rev_sel_b button {"
                            "  min-height: 56px !important;"
                            "  background-size: 36px 36px !important;"
                            "  background-position: center !important;"
                            "  background-repeat: no-repeat !important;"
                            "  font-size: 0 !important;"
                            "  color: transparent !important;"
                            "  padding: 6px !important;"
                            "  border-radius: 12px !important;"
                            "}"
                            f".st-key-cmp_rev_sel_a button {{ background-image: url('{html.escape(icon_a, quote=True)}') !important; }}"
                            f".st-key-cmp_rev_sel_b button {{ background-image: url('{html.escape(icon_b, quote=True)}') !important; }}"
                            "</style>",
                            unsafe_allow_html=True,
                        )

                    c1, c2 = st.columns(2, gap="small")
                    with c1:
                        with st.container(key="cmp_rev_sel_a"):
                            label_a = " " if have_icons else _cmp_review_chip_label(res, slugs[0], "a")
                            if st.button(
                                label_a,
                                key="cmp_rev_sel_a_btn",
                                use_container_width=True,
                                type="primary" if cur == slugs[0] else "secondary",
                                help=title_a,
                            ):
                                st.session_state["cmp_review_slug"] = slugs[0]
                                st.rerun()
                    with c2:
                        with st.container(key="cmp_rev_sel_b"):
                            label_b = " " if have_icons else _cmp_review_chip_label(res, slugs[1], "b")
                            if st.button(
                                label_b,
                                key="cmp_rev_sel_b_btn",
                                use_container_width=True,
                                type="primary" if cur == slugs[1] else "secondary",
                                help=title_b,
                            ):
                                st.session_state["cmp_review_slug"] = slugs[1]
                                st.rerun()

                    slug = st.session_state.get("cmp_review_slug") or slugs[0]
                    if slug not in slugs:
                        slug = slugs[0]
                    idx = slugs.index(slug)
                    data = res.get(slug) or {}
                    title = html.escape(str(data.get("title") or slug))
                    rows_d = detail.get(slug) or []
                    st.markdown(
                        f'<p style="font-weight:700;color:#334155;margin:10px 0 4px 0;">{title}</p>',
                        unsafe_allow_html=True,
                    )
                    aid_disp = str(data.get("app_id", "") or "")
                    ch_disp = str(data.get("chart_label", "") or "")
                    st.caption(f"{int(data.get('total', 0))} · {aid_disp} · {ch_disp}")
                    if not rows_d:
                        st.write("—")
                    else:
                        render_analyzed_review_cards(rows_d, key_prefix=f"cmp_{idx}")
