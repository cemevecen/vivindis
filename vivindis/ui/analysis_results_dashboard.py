"""
Analiz sonuçları — nlp-sentiment-project ile uyumlu kart + iki sütun + özet düzeni.
"""

from __future__ import annotations

import html
import re
from collections import Counter
from collections import defaultdict

import pandas as pd
import plotly.express as px
import streamlit as st

from vivindis.config.i18n import t as _t

# Karşılaştırma kartı başlığı: mağaza / API genelde tam küçük harf döner; Türkçe i/ı için güvenli baş harf
_TC_FIRST = {
    "a": "A",
    "b": "B",
    "c": "C",
    "ç": "Ç",
    "d": "D",
    "e": "E",
    "f": "F",
    "g": "G",
    "ğ": "Ğ",
    "h": "H",
    "i": "İ",
    "ı": "I",
    "j": "J",
    "k": "K",
    "l": "L",
    "m": "M",
    "n": "N",
    "o": "O",
    "ö": "Ö",
    "p": "P",
    "q": "Q",
    "r": "R",
    "s": "S",
    "ş": "Ş",
    "t": "T",
    "u": "U",
    "ü": "Ü",
    "v": "V",
    "w": "W",
    "x": "X",
    "y": "Y",
    "z": "Z",
}


def _format_compact_section_title(raw: str) -> str:
    """Örn. 'döviz: canlı kur' → 'Döviz: Canlı Kur' (kelime başları, ayırıcılar korunur)."""
    s = (raw or "").strip()
    if not s:
        return s
    parts = re.split(r"([^a-zA-ZğüşıöçĞÜŞİÖÇıİ0-9]+)", s)
    out: list[str] = []
    for p in parts:
        if not p:
            continue
        if not re.search(r"[a-zA-ZğüşıöçĞÜŞİÖÇıİ]", p):
            out.append(p)
            continue
        if p[0].isdigit():
            out.append(p)
            continue
        fl = p[0].lower()
        head = _TC_FIRST.get(fl, p[0].upper() if fl.isalpha() else p[0])
        tail = p[1:].lower()
        out.append(head + tail)
    return "".join(out)


def _counts(df: pd.DataFrame) -> tuple[int, int, int, int]:
    analysis_df = df[df["Baskın Duygu"] != "—"].copy()
    vc = analysis_df["Baskın Duygu"].value_counts()
    m_pos = int(vc.get("Olumlu", 0))
    m_neg = int(vc.get("Olumsuz", 0))
    m_neu = int(vc.get("İstek/Görüş", 0))
    return m_pos, m_neg, m_neu, len(df)


def _arc_pct(pct: float, circ: float) -> tuple[float, float]:
    filled = round(circ * pct / 100, 1)
    gap = round(circ - filled, 1)
    return filled, gap


def _render_concentric_legend(m_olumlu: int, m_olumsuz: int, m_istek: int) -> None:
    total_for_chart = m_olumlu + m_olumsuz + m_istek or 1
    pos_pct = int((m_olumlu / total_for_chart) * 100)
    neg_pct = int((m_olumsuz / total_for_chart) * 100)
    neu_pct = max(0, 100 - pos_pct - neg_pct)

    r_outer, r_mid, r_inner = 54, 38, 22
    c_outer = 2 * 3.14159 * r_outer
    c_mid = 2 * 3.14159 * r_mid
    c_inner = 2 * 3.14159 * r_inner

    pf, pg = _arc_pct(pos_pct, c_outer)
    nf, ng = _arc_pct(neg_pct, c_mid)
    uf, ug = _arc_pct(neu_pct, c_inner)

    st.markdown(
        f"""
        <div class="sr-responsive-row" style="display:flex;align-items:center;gap:20px;padding:8px 0 4px 0;">
            <svg width="140" height="140" viewBox="0 0 140 140" style="flex-shrink:0;">
                <circle cx="70" cy="70" r="{r_outer}" fill="none" stroke="#E2E8F0" stroke-width="10"/>
                <circle cx="70" cy="70" r="{r_mid}" fill="none" stroke="#E2E8F0" stroke-width="10"/>
                <circle cx="70" cy="70" r="{r_inner}" fill="none" stroke="#E2E8F0" stroke-width="10"/>
                <circle cx="70" cy="70" r="{r_outer}" fill="none" stroke="#10b981" stroke-width="10"
                    stroke-linecap="round" stroke-dasharray="{pf} {pg}" transform="rotate(-90 70 70)"/>
                <circle cx="70" cy="70" r="{r_mid}" fill="none" stroke="#f43f5e" stroke-width="10"
                    stroke-linecap="round" stroke-dasharray="{nf} {ng}" transform="rotate(-90 70 70)"/>
                <circle cx="70" cy="70" r="{r_inner}" fill="none" stroke="#818cf8" stroke-width="10"
                    stroke-linecap="round" stroke-dasharray="{uf} {ug}" transform="rotate(-90 70 70)"/>
                <text x="70" y="75" text-anchor="middle"
                    style="font-size:14px;font-weight:700;fill:#1E293B;font-family:Poppins,sans-serif;">
                    {pos_pct}%
                </text>
            </svg>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:28px;height:4px;border-radius:2px;background:#10b981;"></div>
                    <div>
                        <div style="font-size:0.9rem;font-weight:700;color:#10b981;line-height:1.2;">{pos_pct}%</div>
                        <div style="font-size:0.7rem;color:#94A3B8;font-weight:600;">{html.escape(_t("dash.sent_pos"))}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:28px;height:4px;border-radius:2px;background:#f43f5e;"></div>
                    <div>
                        <div style="font-size:0.9rem;font-weight:700;color:#f43f5e;line-height:1.2;">{neg_pct}%</div>
                        <div style="font-size:0.7rem;color:#94A3B8;font-weight:600;">{html.escape(_t("dash.sent_neg"))}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:28px;height:4px;border-radius:2px;background:#818cf8;"></div>
                    <div>
                        <div style="font-size:0.9rem;font-weight:700;color:#818cf8;line-height:1.2;">{neu_pct}%</div>
                        <div style="font-size:0.7rem;color:#94A3B8;font-weight:600;">{html.escape(_t("dash.sent_req"))}</div>
                    </div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _render_experience_score(m_olumlu: int, m_olumsuz: int, m_istek: int) -> None:
    total_valid = m_olumlu + m_olumsuz + m_istek
    if total_valid <= 0:
        return
    score = int(((m_olumlu * 100) + (m_istek * 50)) / total_valid)
    score_color = "#10b981" if score >= 70 else "#f59e0b" if score >= 40 else "#f43f5e"
    st.markdown(
        f"""
        <div style="background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:15px;
                    margin-top:4px;margin-bottom:12px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.02);">
            <div style="font-size:0.85rem;color:#64748B;font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:1px;">{html.escape(_t("dash.exp_score"))}</div>
            <div style="font-size:2.5rem;font-weight:800;color:{score_color};line-height:1;">{score}<span style="font-size:1.2rem;color:#94A3B8;">/100</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _render_trend(rows: list[dict]) -> None:
    try:
        dated = [r for r in rows if r.get("Tarih") and r.get("Baskın Duygu") != "—"]
        if len(dated) < 20:
            return
        dated_sorted = sorted(dated, key=lambda x: x["Tarih"])
        half = len(dated_sorted) // 2
        first_half = dated_sorted[:half]
        second_half = dated_sorted[half:]

        def neg_rate(lst: list) -> float:
            if not lst:
                return 0.0
            return sum(1 for r in lst if r["Baskın Duygu"] == "Olumsuz") / len(lst)

        r1 = neg_rate(first_half)
        r2 = neg_rate(second_half)
        diff_trend = r2 - r1
        if diff_trend > 0.05:
            trend_icon = "↑"
            trend_color = "#f43f5e"
            trend_text = _t("dash.trend_neg_rising", pct=int(diff_trend * 100))
        elif diff_trend < -0.05:
            trend_icon = "↓"
            trend_color = "#10b981"
            trend_text = _t("dash.trend_sat_rising", pct=int(abs(diff_trend) * 100))
        else:
            trend_icon = "→"
            trend_color = "#f59e0b"
            trend_text = _t("dash.trend_stable")
        st.markdown(
            f"""
            <div class="sr-responsive-row" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:12px 15px;margin-top:8px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.6rem;color:{trend_color};font-weight:800;line-height:1;">{trend_icon}</span>
                <div>
                    <div style="font-size:0.7rem;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">{html.escape(_t("dash.trend"))}</div>
                    <div style="font-size:0.85rem;font-weight:600;color:{trend_color};">{html.escape(trend_text)}</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    except Exception:
        pass


def _render_daily_negative(rows: list[dict]) -> None:
    try:
        dated2 = [r for r in rows if r.get("Tarih") and r.get("Baskın Duygu") != "—"]
        if len(dated2) < 14:
            return
        day_neg: defaultdict[str, int] = defaultdict(int)
        day_total: defaultdict[str, int] = defaultdict(int)
        for r in dated2:
            try:
                d = pd.to_datetime(r["Tarih"]).strftime("%a")
                day_total[d] += 1
                if r["Baskın Duygu"] == "Olumsuz":
                    day_neg[d] += 1
            except Exception:
                pass
        days_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        days_i18n = {
            "Mon": _t("dash.dow_mon"),
            "Tue": _t("dash.dow_tue"),
            "Wed": _t("dash.dow_wed"),
            "Thu": _t("dash.dow_thu"),
            "Fri": _t("dash.dow_fri"),
            "Sat": _t("dash.dow_sat"),
            "Sun": _t("dash.dow_sun"),
        }
        cells = ""
        for d in days_order:
            if day_total[d] == 0:
                continue
            rate = day_neg[d] / day_total[d]
            bg = "#FEE2E2" if rate >= 0.6 else ("#FEF9C3" if rate >= 0.35 else "#DCFCE7")
            fc = "#DC2626" if rate >= 0.6 else ("#D97706" if rate >= 0.35 else "#16A34A")
            cells += (
                f'<div style="flex:1;text-align:center;background:{bg};border-radius:8px;padding:6px 2px;">'
                f'<div style="font-size:0.65rem;color:{fc};font-weight:700;">{html.escape(days_i18n[d])}</div>'
                f'<div style="font-size:0.7rem;color:{fc};font-weight:600;">%{int(rate * 100)}</div>'
                f"</div>"
            )
        if cells:
            st.markdown(
                f"""
                <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:12px 15px;margin-top:8px;">
                    <div style="font-size:0.7rem;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">{html.escape(_t("dash.daily_neg"))}</div>
                    <div class="sr-week-dow-strip" style="display:flex;gap:4px;">{cells}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
    except Exception:
        pass


def _render_sentiment_summary(
    rows: list[dict],
    m_olumlu: int,
    m_olumsuz: int,
    m_istek: int,
    total_all: int,
    use_fast: bool,
) -> None:
    st.markdown(f"### {_t('dash.sent_dist')}")

    if total_all == 0:
        st.markdown(
            f"""
<div style="background:#F8FAFC;border-radius:12px;padding:20px 24px;border:1px solid #E2E8F0;">
    <div style="font-size:0.9rem;color:#64748b;">{html.escape(_t("dash.no_data_yet"))}</div>
</div>
""",
            unsafe_allow_html=True,
        )
        return

    pos_l = [r for r in rows if r.get("Baskın Duygu") == "Olumlu"]
    neg_l = [r for r in rows if r.get("Baskın Duygu") == "Olumsuz"]

    pos_p = int(len(pos_l) / total_all * 100) if total_all else 0
    neg_p = int(len(neg_l) / total_all * 100) if total_all else 0
    neu_p = int(m_istek / total_all * 100) if total_all else 0

    if pos_p >= 55:
        summary_title = _t("dash.summary_pos_title")
        summary_raw = _t(
            "dash.summary_narrative_positive",
            total=total_all,
            pos=m_olumlu,
            neg=m_olumsuz,
            neu=m_istek,
            pos_p=pos_p,
            neg_p=neg_p,
            neu_p=neu_p,
        )
    elif neg_p >= 50:
        summary_title = _t("dash.summary_neg_title")
        summary_raw = _t(
            "dash.summary_narrative_negative",
            total=total_all,
            pos=m_olumlu,
            neg=m_olumsuz,
            neu=m_istek,
            pos_p=pos_p,
            neg_p=neg_p,
            neu_p=neu_p,
        )
    else:
        summary_title = _t("dash.summary_mixed_title")
        summary_raw = _t(
            "dash.summary_narrative_mixed",
            total=total_all,
            pos=m_olumlu,
            neg=m_olumsuz,
            neu=m_istek,
            pos_p=pos_p,
            neg_p=neg_p,
            neu_p=neu_p,
        )

    summary_body = html.escape(summary_raw.strip())

    all_v = [str(r.get("Versiyon", "")).strip() for r in rows if r.get("Versiyon") and str(r.get("Versiyon")).strip() not in ("", "—")]
    top_v = Counter(all_v).most_common(1)
    best_v = html.escape(top_v[0][0]) if top_v else html.escape(_t("dash.undetermined"))
    all_lang = [str(r.get("lang", "tr")).upper() for r in rows]
    top_l = Counter(all_lang).most_common(1)
    best_l = html.escape(top_l[0][0]) if top_l else "TR"

    subtitle = (
        _t("dash.summary_subtitle_fast") if use_fast else _t("dash.summary_subtitle_rich")
    )
    title_color = "#6366F1" if use_fast else "#5b21b6"

    persona_html = f"""
<div style="margin-top:16px;padding:12px;background:#eff6ff;border-radius:10px;border:1px solid #dbeafe;">
    <div style="font-size:0.75rem;font-weight:700;color:#3b82f6;text-transform:uppercase;margin-bottom:4px;">{html.escape(_t("dash.persona"))}</div>
    <div style="font-size:0.85rem;color:#1e40af;line-height:1.5;">
        • <b>{html.escape(_t("dash.persona_version"))}</b> {best_v}<br>
        • <b>{html.escape(_t("dash.persona_language"))}</b> {best_l}<br>
        • <b>{html.escape(_t("dash.persona_note_label"))}</b> {html.escape(_t("dash.persona_note"))}
    </div>
</div>"""

    st.markdown(
        f"""
<div style="background:#F8FAFC;border-radius:12px;padding:20px 24px;position:relative;border:1px solid #E2E8F0;">
    <div style="font-size:0.75rem;font-weight:600;color:#64748b;margin-bottom:6px;">{html.escape(subtitle)}</div>
    <div style="font-size:0.82rem;font-weight:700;color:{title_color};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">{html.escape(summary_title)}</div>
    <div style="font-size:0.9rem;color:#1E293B;line-height:1.75;margin:0;">{summary_body}</div>
    {persona_html}
    <div class="sr-summary-counts-line" style="margin-top:18px;padding-top:12px;border-top:1px solid #E2E8F0;display:flex;gap:12px;align-items:center;">
        <div style="display:flex;gap:4px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#10b981;"></div>
            <div style="width:8px;height:8px;border-radius:50%;background:#f43f5e;"></div>
            <div style="width:8px;height:8px;border-radius:50%;background:#818cf8;"></div>
        </div>
        <span style="font-size:0.7rem;color:#94A3B8;font-weight:500;">{html.escape(_t("dash.summary_counts_line", pos=m_olumlu, neg=m_olumsuz, neu=m_istek))}</span>
    </div>
</div>
""",
        unsafe_allow_html=True,
    )


_FREQ_CODES = ("daily", "weekly", "monthly")
_LEGACY_FREQ_MAP = {
    "Günlük": "daily",
    "Haftalık": "weekly",
    "Aylık": "monthly",
}


def _stars_label(n: int) -> str:
    return _t("dash.stars_suffix", n=n)


def _render_puan_distribution(df: pd.DataFrame, *, key_suffix: str = "") -> None:
    if "Puan" not in df.columns or not df["Puan"].notna().any():
        return
    st.markdown("---")
    st.markdown(f"### {_t('dash.score_dist')}")

    radio_key = f"sr_puan_freq_sel{('_' + key_suffix) if key_suffix else ''}"
    # Eski oturumlarda Türkçe etiket kayıtlıysa code'a migrate et.
    _cur = st.session_state.get(radio_key)
    if isinstance(_cur, str) and _cur in _LEGACY_FREQ_MAP:
        st.session_state[radio_key] = _LEGACY_FREQ_MAP[_cur]
    elif isinstance(_cur, str) and _cur not in _FREQ_CODES:
        try:
            del st.session_state[radio_key]
        except KeyError:
            pass

    _freq_labels = {
        "daily": _t("dash.freq_daily"),
        "weekly": _t("dash.freq_weekly"),
        "monthly": _t("dash.freq_monthly"),
    }
    freq_code = st.radio(
        _t("dash.freq_label"),
        list(_FREQ_CODES),
        horizontal=True,
        label_visibility="collapsed",
        key=radio_key,
        format_func=lambda c: _freq_labels.get(c, c),
    )
    df_puan = df.dropna(subset=["Tarih", "Puan"]).copy()
    try:
        df_puan["Puan_val"] = pd.to_numeric(df_puan["Puan"], errors="coerce").fillna(0).astype(int)
        df_puan = df_puan[(df_puan["Puan_val"] >= 1) & (df_puan["Puan_val"] <= 5)]
    except Exception:
        return
    if df_puan.empty:
        st.caption(_t("dash.no_date_rating"))
        return

    df_puan["Tarih_dt"] = pd.to_datetime(df_puan["Tarih"])
    min_d = df_puan["Tarih_dt"].min().strftime("%d-%m-%Y")
    max_d = df_puan["Tarih_dt"].max().strftime("%d-%m-%Y")
    st.caption(_t("dash.date_range_label", min_d=min_d, max_d=max_d))

    months_i18n = {i: _t(f"dash.month_{i}") for i in range(1, 13)}

    if freq_code == "weekly":
        df_puan["Grup"] = df_puan["Tarih_dt"].dt.to_period("W").apply(lambda r: r.start_time)
        df_puan["Grup_Label"] = df_puan["Grup"].apply(lambda x: f"{x.day} {months_i18n[x.month]} {x.year}")
        title_txt = _t("dash.chart_title_weekly")
    elif freq_code == "monthly":
        df_puan["Grup_Label"] = df_puan["Tarih_dt"].apply(lambda x: f"{months_i18n[x.month]} {x.year}")
        df_puan["Grup"] = df_puan["Tarih_dt"].dt.to_period("M").apply(lambda r: r.start_time)
        title_txt = _t("dash.chart_title_monthly")
    else:
        df_puan["Grup_Label"] = df_puan["Tarih_dt"].dt.strftime("%d-%m-%Y")
        df_puan["Grup"] = df_puan["Tarih_dt"].dt.date
        title_txt = _t("dash.chart_title_daily")

    star_labels = [_stars_label(i) for i in range(1, 6)]
    star_label_map = {i: star_labels[i - 1] for i in range(1, 6)}

    dist_trend = df_puan.groupby(["Grup", "Grup_Label", "Puan_val"]).size().reset_index(name="Oy Sayısı")
    dist_trend["Puan_Label"] = dist_trend["Puan_val"].apply(lambda x: star_label_map[int(x)])
    dist_trend = dist_trend.sort_values(["Grup", "Puan_val"], ascending=[True, True])
    _sorted_dates = dist_trend["Grup_Label"].unique().tolist()

    fig_dist = px.bar(
        dist_trend,
        x="Grup_Label",
        y="Oy Sayısı",
        color="Puan_Label",
        title=title_txt,
        color_discrete_map={
            star_labels[0]: "#E53E3E",
            star_labels[1]: "#F6AD55",
            star_labels[2]: "#F6E05E",
            star_labels[3]: "#68D391",
            star_labels[4]: "#2F855A",
        },
        category_orders={
            "Puan_Label": star_labels,
            "Grup_Label": _sorted_dates,
        },
        labels={
            "Puan_Label": "",
            "Grup_Label": _t("dash.chart_xaxis_time"),
            "Oy Sayısı": _t("dash.chart_yaxis_count"),
        },
    )
    fig_dist.update_layout(
        height=420,
        margin={"t": 60, "b": 100, "l": 10, "r": 10},
        xaxis_title="",
        yaxis_title=_t("dash.chart_yaxis_count"),
        legend={
            "orientation": "h",
            "yanchor": "bottom",
            "y": 1.02,
            "xanchor": "right",
            "x": 1,
            "font": {"color": "#0f172a"},
        },
        barmode="stack",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(248,250,252,0.6)",
        font=dict(color="#334155"),
    )
    fig_dist.update_xaxes(tickangle=-45)
    st.plotly_chart(
        fig_dist,
        use_container_width=True,
        key=f"puan_dist_chart{('_' + key_suffix) if key_suffix else ''}",
    )


def render_analysis_results_dashboard(
    rows: list[dict],
    *,
    use_fast: bool = True,
    key_suffix: str = "",
    compact: bool = False,
    section_title: str | None = None,
    section_store_url: str | None = None,
) -> None:
    """nlp-sentiment tarzı özet paneli: metrik hapları, sol göstergeler, sağ metin özeti, isteğe bağlı puan grafiği.

    Args:
        key_suffix: Birden fazla dashboard aynı sayfada render edildiğinde widget
            key çakışmalarını önlemek için benzersiz bir ek.
        compact: True ise üstteki büyük başlık gizlenir; split (yan yana)
            düzenlerde alt-başlıkla kullanılır.
        section_title: compact modda üste yazılacak alt-başlık (uygulama adı vs.).
        section_store_url: Varsa mağaza listeleme URL'si (h3 kullanılmaz; Streamlit yanlış köprü eklemez).
    """
    if not rows:
        return
    df = pd.DataFrame(rows)
    if df.empty or "Baskın Duygu" not in df.columns:
        st.info(_t("dash.missing_cols"))
        return

    m_olumlu, m_olumsuz, m_istek, n_total = _counts(df)
    total_all = m_olumlu + m_olumsuz + m_istek

    if not compact:
        st.markdown(
            f'<h2 class="sr-analysis-page-title">{html.escape(_t("dash.page_title"))}</h2>',
            unsafe_allow_html=True,
        )
    elif section_title:
        display_title = _format_compact_section_title(section_title)
        esc_title = html.escape(display_title)
        # h2/h3 Streamlit otomatik köprü (#/...) ekler; div + role=heading ile gerçek mağaza linki verilebilir.
        if section_store_url:
            esc_url = html.escape(section_store_url, quote=True)
            link_lbl = html.escape(_t("dash.open_store_listing"), quote=True)
            st.markdown(
                f'<div class="sr-analysis-subhead-wrap">'
                f'<div class="sr-analysis-page-title sr-analysis-page-title--sub" role="heading" aria-level="3">{esc_title}</div>'
                f'<a class="sr-store-listing-link" href="{esc_url}" target="_blank" rel="noopener noreferrer" '
                f'title="{link_lbl}" aria-label="{link_lbl}">↗</a>'
                f"</div>",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                f'<div class="sr-analysis-page-title sr-analysis-page-title--sub" role="heading" aria-level="3">{esc_title}</div>',
                unsafe_allow_html=True,
            )

    metric_row_cls = (
        "sr-analysis-metric-row sr-analysis-metric-row--tight-top"
        if compact
        else "sr-analysis-metric-row"
    )
    st.markdown(
        f"""
    <div class="{metric_row_cls}">
        <div class="sr-analysis-metric-pill">
            <div class="sr-analysis-metric-value" style="color:#10b981;">{m_olumlu}</div>
            <div class="sr-analysis-metric-label">{html.escape(_t("dash.sent_pos"))}</div>
        </div>
        <div class="sr-analysis-metric-pill">
            <div class="sr-analysis-metric-value" style="color:#f43f5e;">{m_olumsuz}</div>
            <div class="sr-analysis-metric-label">{html.escape(_t("dash.sent_neg"))}</div>
        </div>
        <div class="sr-analysis-metric-pill">
            <div class="sr-analysis-metric-value" style="color:#3b82f6;">{m_istek}</div>
            <div class="sr-analysis-metric-label">{html.escape(_t("dash.sent_req"))}</div>
        </div>
        <div class="sr-analysis-metric-pill">
            <div class="sr-analysis-metric-value" style="color:#a78bfa;">{n_total}</div>
            <div class="sr-analysis-metric-label">{html.escape(_t("dash.pill_total"))}</div>
        </div>
    </div>
    """,
        unsafe_allow_html=True,
    )

    # Split (compact) modda iki sütun dar olduğu için alt grafikleri dikey dizelim.
    if compact:
        _render_concentric_legend(m_olumlu, m_olumsuz, m_istek)
        _render_experience_score(m_olumlu, m_olumsuz, m_istek)
        _render_trend(rows)
        _render_daily_negative(rows)
        _render_sentiment_summary(rows, m_olumlu, m_olumsuz, m_istek, total_all, use_fast)
    else:
        col_pie, col_summary = st.columns([1, 1], gap="medium")
        with col_pie:
            _render_concentric_legend(m_olumlu, m_olumsuz, m_istek)
            _render_experience_score(m_olumlu, m_olumsuz, m_istek)
            _render_trend(rows)
            _render_daily_negative(rows)
        with col_summary:
            _render_sentiment_summary(rows, m_olumlu, m_olumsuz, m_istek, total_all, use_fast)

    _render_puan_distribution(df, key_suffix=key_suffix)
