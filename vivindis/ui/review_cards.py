"""
Analiz edilmiş yorumları tek sütunlu kart listesi olarak gösterir (çok sütunlu tablo yok).
"""

from __future__ import annotations

import html
from typing import Any

import pandas as pd
import streamlit as st

from vivindis.config.i18n import t


def _format_tr_date(val: Any) -> str:
    if val is None or val == "":
        return "—"
    if isinstance(val, float) and pd.isna(val):
        return "—"
    if hasattr(val, "strftime"):
        try:
            return val.strftime("%d-%m-%Y")
        except Exception:
            pass
    s = str(val).strip()
    if not s:
        return "—"
    try:
        return pd.to_datetime(s).strftime("%d-%m-%Y")
    except Exception:
        return s[:48]


def _sentiment_dot_color(verdict: str) -> str:
    v = (verdict or "").strip()
    if v == "Olumlu":
        return "#22c55e"
    if v == "Olumsuz":
        return "#ef4444"
    if v == "İstek/Görüş":
        return "#3b82f6"
    return "#94a3b8"


def _one_card_html(row: dict[str, Any], fallback_index: int) -> str:
    no = row.get("No")
    try:
        n = int(no) if no is not None else fallback_index + 1
    except (TypeError, ValueError):
        n = fallback_index + 1
    verdict = str(row.get("Baskın Duygu", "") or "").strip()
    dot = _sentiment_dot_color(verdict)
    puan_raw = row.get("Puan", "—")
    if puan_raw is None or (isinstance(puan_raw, float) and pd.isna(puan_raw)):
        puan_s = "—"
    else:
        puan_s = html.escape(str(puan_raw).strip() or "—")
    tarih_disp = html.escape(_format_tr_date(row.get("Tarih")))
    body = str(row.get("Yorum", row.get("text", "")) or "")
    body_e = html.escape(body)
    app = row.get("Uygulama")
    app_block = ""
    if app is not None and str(app).strip():
        app_block = f'<div class="review-card-app">{html.escape(str(app).strip())}</div>'

    return (
        f'<div class="review-card">'
        f"{app_block}"
        f'<div class="review-card-head">'
        f'<span class="review-card-head-left">'
        f'<span class="review-card-no">#{n}</span>'
        f'<span class="review-card-sep">|</span>'
        f'<span class="review-card-dot" style="background:{dot};" title="{html.escape(verdict or "—")}"></span>'
        f'<span class="review-card-sep">|</span>'
        f'<span>Puan: {puan_s}</span>'
        f"</span>"
        f'<span class="review-card-date">Tarih: {tarih_disp}</span>'
        f"</div>"
        f'<div class="review-card-body">{body_e}</div>'
        f"</div>"
    )


PAGE_SIZE = 50
PREVIEW_SIZE = 5
_MAX_PAGE_BUTTONS = 15


def _list_sig(rows: list[dict[str, Any]]) -> tuple[int, str, str]:
    n = len(rows)
    if n == 0:
        return (0, "", "")
    a = str(rows[0].get("Yorum", rows[0].get("text", "")))[:120]
    b = str(rows[-1].get("Yorum", rows[-1].get("text", "")))[:120]
    return (n, a, b)


def _fragment_rerun() -> None:
    """Yalnızca fragment'ı yeniden render et.

    `scope="fragment"` anahtarı Streamlit ≥ 1.37'de stabil; projenin alt sınırı
    `>=1.40` olduğu için doğrudan çağrılır. `TypeError` ise eski / yama
    sürümlerine karşı güvenli bir geri dönüş verir."""
    try:
        st.rerun(scope="fragment")
    except TypeError:
        st.rerun()


@st.fragment
def _paged_cards_fragment(
    rows: list[dict[str, Any]],
    *,
    key_prefix: str,
    page_k: str,
    show_all_k: str,
    expanded_k: str,
) -> None:
    """Sayfalama UI'sı ve kart listesi — fragment sayesinde sayfa değişiminde
    üstteki dashboard / Plotly grafikleri yeniden render edilmez."""
    n = len(rows)
    show_all = bool(st.session_state.get(show_all_k, False))

    # Pager ve aksiyonları tek seferde topla; kartları aksiyonlar bitince bas.
    if n > PAGE_SIZE:
        if show_all:
            if st.button(t("cards.collapse_list"), key=f"{key_prefix}_collapse_list"):
                st.session_state[show_all_k] = False
                st.session_state[page_k] = 0
                _fragment_rerun()
        else:
            page = int(st.session_state.get(page_k, 0))
            total_pages = max(1, (n + PAGE_SIZE - 1) // PAGE_SIZE)

            with st.container(key=f"{key_prefix}_review_pager"):
                c_prev, c_info, c_next = st.columns([1, 3, 1])
                with c_prev:
                    if st.button(
                        t("cards.prev"),
                        key=f"{key_prefix}_prev_page",
                        disabled=page <= 0,
                    ):
                        st.session_state[page_k] = max(0, page - 1)
                        _fragment_rerun()
                with c_next:
                    if st.button(
                        t("cards.next"),
                        key=f"{key_prefix}_next_page",
                        disabled=page >= total_pages - 1,
                    ):
                        st.session_state[page_k] = min(total_pages - 1, page + 1)
                        _fragment_rerun()

                # Sayfa numaraları — görünür eşik üstünde ise sade ipucu.
                if total_pages <= _MAX_PAGE_BUTTONS:
                    cols = st.columns(total_pages)
                    for i in range(total_pages):
                        with cols[i]:
                            is_cur = i == page
                            if st.button(
                                str(i + 1),
                                key=f"{key_prefix}_pgnum_{i}",
                                type="primary" if is_cur else "secondary",
                                use_container_width=True,
                                disabled=is_cur,
                            ):
                                st.session_state[page_k] = i
                                _fragment_rerun()
                else:
                    st.caption(t("cards.paging_hint", n=total_pages))

                if st.button(
                    t("common.show_all"),
                    key=f"{key_prefix}_show_all_reviews",
                    use_container_width=True,
                ):
                    st.session_state[show_all_k] = True
                    _fragment_rerun()

                # Bilgi metnini aksiyonlardan sonra son değerle bas.
                page_now = int(st.session_state.get(page_k, 0))
                page_now = max(0, min(page_now, total_pages - 1))
                start_now = page_now * PAGE_SIZE
                end_now = min(start_now + PAGE_SIZE, n)
                with c_info:
                    st.caption(
                        t(
                            "cards.page_info",
                            start=start_now + 1,
                            end=end_now,
                            n=n,
                            page=page_now + 1,
                            total=total_pages,
                        )
                    )

    # Slice'ı güncel session state üzerinden hesapla.
    show_all = bool(st.session_state.get(show_all_k, False))
    if n <= PAGE_SIZE or show_all:
        slice_rows = rows
    else:
        page_final = int(st.session_state.get(page_k, 0))
        total_pages = max(1, (n + PAGE_SIZE - 1) // PAGE_SIZE)
        page_final = max(0, min(page_final, total_pages - 1))
        st.session_state[page_k] = page_final
        start_final = page_final * PAGE_SIZE
        slice_rows = rows[start_final : start_final + PAGE_SIZE]

    inner = "".join(_one_card_html(r, i) for i, r in enumerate(slice_rows))
    st.markdown(
        f'<div class="review-card-list" data-cards="{html.escape(key_prefix)}">{inner}</div>',
        unsafe_allow_html=True,
    )

    # Önizlemeye geri dönme bağlantısı — yalnızca toplam kayıt önizleme eşiği
    # üstündeyse anlamlı.
    if n > PREVIEW_SIZE:
        with st.container(key=f"{key_prefix}_collapse_preview"):
            st.markdown(
                f"<style>.st-key-{key_prefix}_collapse_preview button {{"
                "  background: transparent !important;"
                "  color: #64748b !important;"
                "  border: 1px solid #e2e8f0 !important;"
                "  font-size: 0.82rem !important;"
                "  margin-top: 6px !important;"
                "}</style>",
                unsafe_allow_html=True,
            )
            if st.button(
                t("cards.collapse_to_preview"),
                key=f"{key_prefix}_collapse_preview_btn",
                use_container_width=True,
            ):
                st.session_state[expanded_k] = False
                st.session_state[show_all_k] = False
                st.session_state[page_k] = 0
                # Önizlemeye dönüş fragment dışı bölüme etki ettiği için
                # tam rerun gerekir.
                st.rerun()


def render_analyzed_review_cards(rows: list[dict[str, Any]], *, key_prefix: str = "cards") -> None:
    """Analiz satırlarını kart listesi olarak basar.

    Performans notu: 50'lik sayfalama etkileşimleri `@st.fragment` içinde çalışır;
    bu nedenle "önceki / sonraki" düğmeleri tıklandığında yalnızca kart bölgesi
    yeniden render edilir — üstteki dashboard ve Plotly grafikleri tekrar
    çizilmez."""
    if not rows:
        return

    sig_k = f"{key_prefix}_review_list_sig"
    page_k = f"{key_prefix}_review_cards_page"
    show_all_k = f"{key_prefix}_review_cards_show_all"
    expanded_k = f"{key_prefix}_review_cards_expanded"
    sig = _list_sig(rows)
    if st.session_state.get(sig_k) != sig:
        st.session_state[sig_k] = sig
        st.session_state[page_k] = 0
        st.session_state[show_all_k] = False
        st.session_state[expanded_k] = False

    n = len(rows)
    expanded = bool(st.session_state.get(expanded_k, False))

    # Önizleme modu: ilk 5 yorum + turuncu "genişlet" butonu.
    # Aşağıdaki grafikler / özetler görünür kalsın diye varsayılan açılış bu.
    if n > PREVIEW_SIZE and not expanded:
        slice_rows = rows[:PREVIEW_SIZE]
        inner = "".join(_one_card_html(r, i) for i, r in enumerate(slice_rows))
        st.markdown(
            f'<div class="review-card-list" data-cards="{html.escape(key_prefix)}">{inner}</div>',
            unsafe_allow_html=True,
        )
        with st.container(key=f"{key_prefix}_preview_expand"):
            st.markdown(
                f"<style>.st-key-{key_prefix}_preview_expand button {{"
                "  background: linear-gradient(90deg,#fb923c,#ea580c) !important;"
                "  color: #fff !important;"
                "  border: 0 !important;"
                "  font-weight: 600 !important;"
                "  letter-spacing: 0.2px !important;"
                "  margin-top: 8px !important;"
                "}</style>",
                unsafe_allow_html=True,
            )
            if st.button(
                t("cards.expand_with_count", n=n - PREVIEW_SIZE),
                key=f"{key_prefix}_expand_reviews",
                use_container_width=True,
            ):
                st.session_state[expanded_k] = True
                st.session_state[page_k] = 0
                st.rerun()
        return

    # Genişletilmiş mod → fragment içinde sayfalama.
    _paged_cards_fragment(
        rows,
        key_prefix=key_prefix,
        page_k=page_k,
        show_all_k=show_all_k,
        expanded_k=expanded_k,
    )
