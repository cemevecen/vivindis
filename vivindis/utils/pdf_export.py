"""PDF export — dashboard ile birebir uyumlu, zengin görseller içeren rapor üretimi.

Notlar:
- Tüm metinler `vivindis.config.i18n.t` üzerinden seçili dile göre gelir.
- Grafikler FPDF2 primitifleriyle (ek kütüphane yok) çizilir: metrik pill'ler, duygu
    yatay bar dağılımı, deneyim skoru kartı, trend ve haftalık negatif oran şeridi,
    özet bloğu, aylık puan dağılımı stacked bar.
- Uygulama karşılaştırma modu otomatik algılanır (`Uygulama` kolonunda ≥ 2 farklı
    değer). Bu durumda her uygulama için ayrı bir dashboard sayfası basılır.
"""

from __future__ import annotations

import io
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from vivindis.config.i18n import t as _t

_FONT_PATH = Path(__file__).resolve().parent.parent / "data" / "fonts" / "NotoSans-Regular.ttf"

_ANALYSIS_COL_ORDER = (
    "No",
    "Uygulama",
    "Yorum",
    "Baskın Duygu",
    "Olumlu %",
    "İstek/Görüş %",
    "Olumsuz %",
    "Tarih",
    "Puan",
    "Versiyon",
    "lang",
    "Yöntem",
)

# Dashboard renk paleti (analysis_results_dashboard.py ile birebir)
_COLOR_POS = (16, 185, 129)        # #10b981
_COLOR_NEG = (244, 63, 94)         # #f43f5e
_COLOR_NEU = (129, 140, 248)       # #818cf8
_COLOR_TOTAL = (99, 102, 241)      # #6366f1
_COLOR_INK = (15, 23, 42)          # #0f172a
_COLOR_INK_SOFT = (51, 65, 85)     # #334155
_COLOR_MUTED = (100, 116, 139)     # #64748b
_COLOR_FAINT = (148, 163, 184)     # #94a3b8
_COLOR_CARD_BG = (255, 255, 255)
_COLOR_CARD_BORDER = (226, 232, 240)  # #e2e8f0
_COLOR_SOFT_BG = (248, 250, 252)      # #f8fafc
_COLOR_PAGE_BG = (244, 246, 251)      # #f4f6fb
_COLOR_BRAND = (255, 106, 0)          # #ff6a00

_STAR_COLORS = [
    (229, 62, 62),    # 1★  #E53E3E
    (246, 173, 85),   # 2★  #F6AD55
    (246, 224, 94),   # 3★  #F6E05E
    (104, 211, 145),  # 4★  #68D391
    (47, 133, 90),    # 5★  #2F855A
]


def _ensure_font() -> Path:
    if not _FONT_PATH.is_file():
        raise FileNotFoundError(
            f"PDF font eksik: {_FONT_PATH}. NotoSans-Regular.ttf veri klasörüne ekleyin."
        )
    return _FONT_PATH


def _cell_text(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, float) and pd.isna(x):
        return ""
    s = str(x).replace("\r\n", "\n").replace("\r", "\n")
    # Plotly/HTML artıkları ve kontrol karakterlerini temizle.
    s = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > 8000:
        s = s[:8000] + "…"
    return s


def _ordered_columns(df: pd.DataFrame) -> list[str]:
    seen: list[str] = []
    for c in _ANALYSIS_COL_ORDER:
        if c in df.columns and c not in seen:
            seen.append(c)
    for c in df.columns:
        if c not in seen:
            seen.append(c)
    return seen


# =============================================================================
#  FPDF çizim yardımcıları
# =============================================================================


def _set_rgb(pdf, role: str, color: tuple[int, int, int]) -> None:
    r, g, b = color
    if role == "fill":
        pdf.set_fill_color(r, g, b)
    elif role == "text":
        pdf.set_text_color(r, g, b)
    elif role == "draw":
        pdf.set_draw_color(r, g, b)


def _card_bg(
    pdf,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    bg: tuple[int, int, int] = _COLOR_CARD_BG,
    border: tuple[int, int, int] | None = _COLOR_CARD_BORDER,
    radius: float = 3.0,
) -> None:
    """Yuvarlatılmış kart arka planı."""
    _set_rgb(pdf, "fill", bg)
    if border is None:
        pdf.set_draw_color(*bg)
    else:
        _set_rgb(pdf, "draw", border)
    pdf.set_line_width(0.2)
    try:
        pdf.rect(x, y, w, h, style="DF", round_corners=True, corner_radius=radius)
    except TypeError:
        # Eski fpdf2 sürümleri round_corners argümanını desteklemiyor olabilir.
        pdf.rect(x, y, w, h, style="DF")


def _safe_set_xy(pdf, x: float, y: float) -> None:
    pdf.set_xy(x, y)


def _section_title(pdf, x: float, y: float, w: float, title: str, *, size: float = 12.0) -> float:
    pdf.set_font("NotoSans", "", size)
    _set_rgb(pdf, "text", _COLOR_INK)
    _safe_set_xy(pdf, x, y)
    pdf.cell(w, size * 0.45, _cell_text(title))
    return y + size * 0.55


def _small_label(
    pdf, x: float, y: float, text: str, *, color: tuple[int, int, int] = _COLOR_MUTED, size: float = 6.5
) -> None:
    pdf.set_font("NotoSans", "", size)
    _set_rgb(pdf, "text", color)
    _safe_set_xy(pdf, x, y)
    pdf.cell(0, size * 0.45, _cell_text(text))


def _value(
    pdf, x: float, y: float, text: str, *, color: tuple[int, int, int] = _COLOR_INK, size: float = 11.0
) -> None:
    pdf.set_font("NotoSans", "", size)
    _set_rgb(pdf, "text", color)
    _safe_set_xy(pdf, x, y)
    pdf.cell(0, size * 0.45, _cell_text(text))


# =============================================================================
#  Metrik / özet hesapları (dashboard ile aynı mantık)
# =============================================================================


def _counts(rows: list[dict]) -> tuple[int, int, int, int]:
    pos = sum(1 for r in rows if r.get("Baskın Duygu") == "Olumlu")
    neg = sum(1 for r in rows if r.get("Baskın Duygu") == "Olumsuz")
    neu = sum(1 for r in rows if r.get("Baskın Duygu") == "İstek/Görüş")
    return pos, neg, neu, len(rows)


def _experience_score(pos: int, neg: int, neu: int) -> int | None:
    total = pos + neg + neu
    if total <= 0:
        return None
    return int(((pos * 100) + (neu * 50)) / total)


def _compute_trend(rows: list[dict]) -> tuple[str, tuple[int, int, int], str] | None:
    dated = [r for r in rows if r.get("Tarih") and r.get("Baskın Duygu") != "—"]
    if len(dated) < 20:
        return None
    dated_sorted = sorted(dated, key=lambda x: x["Tarih"])
    half = len(dated_sorted) // 2
    first_half = dated_sorted[:half]
    second_half = dated_sorted[half:]

    def neg_rate(lst: list[dict]) -> float:
        if not lst:
            return 0.0
        return sum(1 for r in lst if r["Baskın Duygu"] == "Olumsuz") / len(lst)

    diff = neg_rate(second_half) - neg_rate(first_half)
    if diff > 0.05:
        return ("up", _COLOR_NEG, _t("dash.trend_neg_rising", pct=int(diff * 100)))
    if diff < -0.05:
        return ("down", _COLOR_POS, _t("dash.trend_sat_rising", pct=int(abs(diff) * 100)))
    return ("flat", (245, 158, 11), _t("dash.trend_stable"))


def _compute_daily_neg(rows: list[dict]) -> list[tuple[str, float, int]] | None:
    dated = [r for r in rows if r.get("Tarih") and r.get("Baskın Duygu") != "—"]
    if len(dated) < 14:
        return None
    day_neg: defaultdict[str, int] = defaultdict(int)
    day_total: defaultdict[str, int] = defaultdict(int)
    for r in dated:
        try:
            d = pd.to_datetime(r["Tarih"]).strftime("%a")
            day_total[d] += 1
            if r["Baskın Duygu"] == "Olumsuz":
                day_neg[d] += 1
        except Exception:
            pass
    days_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    labels = {
        "Mon": _t("dash.dow_mon"), "Tue": _t("dash.dow_tue"), "Wed": _t("dash.dow_wed"),
        "Thu": _t("dash.dow_thu"), "Fri": _t("dash.dow_fri"), "Sat": _t("dash.dow_sat"),
        "Sun": _t("dash.dow_sun"),
    }
    out: list[tuple[str, float, int]] = []
    for d in days_order:
        if day_total[d] == 0:
            continue
        out.append((labels[d], day_neg[d] / day_total[d], day_total[d]))
    return out or None


def _top_common(rows: list[dict], key: str) -> str:
    vals = [str(r.get(key, "")).strip() for r in rows if r.get(key)]
    vals = [v for v in vals if v and v not in ("—", "nan", "None")]
    if not vals:
        return _t("dash.undetermined")
    return Counter(vals).most_common(1)[0][0]


# =============================================================================
#  Dashboard bileşenleri
# =============================================================================


def _draw_metric_pill(
    pdf,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    label: str,
    value: str,
    accent: tuple[int, int, int],
) -> None:
    _card_bg(pdf, x, y, w, h, radius=3.0)
    # Sol şerit
    _set_rgb(pdf, "fill", accent)
    try:
        pdf.rect(x, y, 1.4, h, style="F", round_corners=True, corner_radius=1.4)
    except TypeError:
        pdf.rect(x, y, 1.4, h, style="F")

    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x + 4, y + 3)
    pdf.cell(w - 6, 3.2, _cell_text(label))

    pdf.set_font("NotoSans", "", 14.0)
    _set_rgb(pdf, "text", accent)
    _safe_set_xy(pdf, x + 4, y + 8)
    pdf.cell(w - 6, 7, _cell_text(value))


def _draw_metric_row(pdf, x: float, y: float, w: float, *, pos: int, neg: int, neu: int, total: int) -> float:
    gap = 2.5
    pill_w = (w - gap * 3) / 4
    h = 16.0
    _draw_metric_pill(pdf, x + 0 * (pill_w + gap), y, pill_w, h,
                      label=_t("dash.sent_pos"), value=str(pos), accent=_COLOR_POS)
    _draw_metric_pill(pdf, x + 1 * (pill_w + gap), y, pill_w, h,
                      label=_t("dash.sent_neg"), value=str(neg), accent=_COLOR_NEG)
    _draw_metric_pill(pdf, x + 2 * (pill_w + gap), y, pill_w, h,
                      label=_t("dash.sent_req"), value=str(neu), accent=_COLOR_NEU)
    _draw_metric_pill(pdf, x + 3 * (pill_w + gap), y, pill_w, h,
                      label=_t("dash.pill_total"), value=str(total), accent=_COLOR_TOTAL)
    return y + h + 3.0


def _draw_sent_distribution(
    pdf, x: float, y: float, w: float, *, pos: int, neg: int, neu: int
) -> float:
    """Dashboard'daki yatay duygu dağılımını yansıtır (3 renkli bar)."""
    total = pos + neg + neu or 1
    parts = [
        (_t("dash.sent_pos"), pos, (pos / total) * 100, _COLOR_POS),
        (_t("dash.sent_neg"), neg, (neg / total) * 100, _COLOR_NEG),
        (_t("dash.sent_req"), neu, (neu / total) * 100, _COLOR_NEU),
    ]

    card_h = 6 + 3 * 9 + 3
    _card_bg(pdf, x, y, w, card_h)

    pdf.set_font("NotoSans", "", 7.5)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x + 4, y + 3)
    pdf.cell(w - 8, 4, _cell_text(_t("dash.sent_dist")).upper())

    row_y = y + 9
    label_w = 28.0
    pct_w = 14.0
    bar_x = x + 4 + label_w
    bar_w = w - 8 - label_w - pct_w
    for label, count, pct, color in parts:
        pdf.set_font("NotoSans", "", 8.5)
        _set_rgb(pdf, "text", _COLOR_INK_SOFT)
        _safe_set_xy(pdf, x + 4, row_y)
        pdf.cell(label_w, 5, _cell_text(label))

        # Bar arka plan
        _set_rgb(pdf, "fill", (241, 245, 249))
        try:
            pdf.rect(bar_x, row_y + 0.5, bar_w, 4.5, style="F", round_corners=True, corner_radius=2.0)
        except TypeError:
            pdf.rect(bar_x, row_y + 0.5, bar_w, 4.5, style="F")
        fill_w = bar_w * min(max(pct, 0), 100) / 100.0
        if fill_w > 0.2:
            _set_rgb(pdf, "fill", color)
            try:
                pdf.rect(bar_x, row_y + 0.5, fill_w, 4.5, style="F",
                         round_corners=True, corner_radius=2.0)
            except TypeError:
                pdf.rect(bar_x, row_y + 0.5, fill_w, 4.5, style="F")

        pdf.set_font("NotoSans", "", 8.5)
        _set_rgb(pdf, "text", color)
        _safe_set_xy(pdf, bar_x + bar_w + 1.5, row_y)
        pdf.cell(pct_w - 1.5, 5, f"%{int(round(pct))} ({count})")
        row_y += 9

    return y + card_h + 3.0


def _draw_experience_and_trend(
    pdf, x: float, y: float, w: float, *, pos: int, neg: int, neu: int,
    trend: tuple[str, tuple[int, int, int], str] | None,
) -> float:
    gap = 3.0
    col_w = (w - gap) / 2
    card_h = 22.0

    # Deneyim Skoru
    _card_bg(pdf, x, y, col_w, card_h)
    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x + 4, y + 3)
    pdf.cell(col_w - 8, 3, _cell_text(_t("dash.exp_score")).upper())
    score = _experience_score(pos, neg, neu)
    if score is None:
        score_color = _COLOR_FAINT
        value_txt = "—"
    else:
        score_color = _COLOR_POS if score >= 70 else (
            (245, 158, 11) if score >= 40 else _COLOR_NEG
        )
        value_txt = f"{score}/100"
    pdf.set_font("NotoSans", "", 18.0)
    _set_rgb(pdf, "text", score_color)
    _safe_set_xy(pdf, x + 4, y + 8)
    pdf.cell(col_w - 8, 10, _cell_text(value_txt))

    # Trend
    tx = x + col_w + gap
    _card_bg(pdf, tx, y, col_w, card_h)
    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, tx + 4, y + 3)
    pdf.cell(col_w - 8, 3, _cell_text(_t("dash.trend")).upper())
    if trend is None:
        pdf.set_font("NotoSans", "", 9.0)
        _set_rgb(pdf, "text", _COLOR_FAINT)
        _safe_set_xy(pdf, tx + 4, y + 10)
        pdf.cell(col_w - 8, 6, _cell_text(_t("dash.trend_insufficient")))
    else:
        icon, color, txt = trend
        # Üçgen / çizgi ikonu FPDF primitifleriyle (font-bağımsız, her dilde çalışır).
        ax, ay, sz = tx + 5.5, y + 12.5, 4.0
        _set_rgb(pdf, "fill", color)
        _set_rgb(pdf, "draw", color)
        if icon == "up":
            pdf.polygon(
                [(ax, ay + sz), (ax + sz, ay + sz), (ax + sz / 2, ay)],
                style="F",
            )
        elif icon == "down":
            pdf.polygon(
                [(ax, ay), (ax + sz, ay), (ax + sz / 2, ay + sz)],
                style="F",
            )
        else:
            pdf.set_line_width(0.9)
            pdf.line(ax, ay + sz / 2, ax + sz, ay + sz / 2)
        pdf.set_font("NotoSans", "", 9.0)
        _set_rgb(pdf, "text", color)
        _safe_set_xy(pdf, tx + 12, y + 11)
        pdf.multi_cell(col_w - 16, 4.2, _cell_text(txt))

    return y + card_h + 3.0


def _draw_daily_negative(
    pdf, x: float, y: float, w: float, *, rates: list[tuple[str, float, int]] | None
) -> float:
    if not rates:
        return y
    card_h = 22.0
    _card_bg(pdf, x, y, w, card_h)
    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x + 4, y + 3)
    pdf.cell(w - 8, 3, _cell_text(_t("dash.daily_neg")).upper())

    cell_gap = 1.8
    inner_w = w - 8
    cells = max(1, len(rates))
    cw = (inner_w - cell_gap * (cells - 1)) / cells
    ch = 11.0
    cy = y + 8
    cx = x + 4
    for label, rate, _n in rates:
        if rate >= 0.6:
            bg = (254, 226, 226)
            fg = (220, 38, 38)
        elif rate >= 0.35:
            bg = (254, 249, 195)
            fg = (217, 119, 6)
        else:
            bg = (220, 252, 231)
            fg = (22, 163, 74)
        _set_rgb(pdf, "fill", bg)
        try:
            pdf.rect(cx, cy, cw, ch, style="F", round_corners=True, corner_radius=1.8)
        except TypeError:
            pdf.rect(cx, cy, cw, ch, style="F")
        pdf.set_font("NotoSans", "", 6.5)
        _set_rgb(pdf, "text", fg)
        _safe_set_xy(pdf, cx, cy + 1.5)
        pdf.cell(cw, 3.2, _cell_text(label), align="C")
        pdf.set_font("NotoSans", "", 8.0)
        _safe_set_xy(pdf, cx, cy + 5.8)
        pdf.cell(cw, 3.5, f"%{int(round(rate * 100))}", align="C")
        cx += cw + cell_gap

    return y + card_h + 3.0


def _draw_summary_block(
    pdf,
    x: float,
    y: float,
    w: float,
    *,
    rows: list[dict],
    pos: int,
    neg: int,
    neu: int,
    total: int,
    use_fast: bool,
) -> float:
    if total <= 0:
        card_h = 16
        _card_bg(pdf, x, y, w, card_h, bg=_COLOR_SOFT_BG)
        pdf.set_font("NotoSans", "", 9.0)
        _set_rgb(pdf, "text", _COLOR_MUTED)
        _safe_set_xy(pdf, x + 4, y + 5)
        pdf.multi_cell(w - 8, 5, _cell_text(_t("dash.no_data_yet")))
        return y + card_h + 3.0

    pos_p = int(pos / total * 100) if total else 0
    neg_p = int(neg / total * 100) if total else 0
    neu_p = int(neu / total * 100) if total else 0

    if pos_p >= 55:
        title_txt = _t("dash.summary_pos_title")
        intro = _t(
            "dash.summary_narrative_positive",
            total=total,
            pos=pos,
            neg=neg,
            neu=neu,
            pos_p=pos_p,
            neg_p=neg_p,
            neu_p=neu_p,
        )
    elif neg_p >= 50:
        title_txt = _t("dash.summary_neg_title")
        intro = _t(
            "dash.summary_narrative_negative",
            total=total,
            pos=pos,
            neg=neg,
            neu=neu,
            pos_p=pos_p,
            neg_p=neg_p,
            neu_p=neu_p,
        )
    else:
        title_txt = _t("dash.summary_mixed_title")
        intro = _t(
            "dash.summary_narrative_mixed",
            total=total,
            pos=pos,
            neg=neg,
            neu=neu,
            pos_p=pos_p,
            neg_p=neg_p,
            neu_p=neu_p,
        )

    body = _cell_text(intro.strip())

    subtitle = _t("dash.summary_subtitle_fast") if use_fast else _t("dash.summary_subtitle_rich")
    best_v = _top_common(rows, "Versiyon")
    all_lang = [str(r.get("lang", "tr")).upper() for r in rows]
    best_l = Counter(all_lang).most_common(1)[0][0] if all_lang else "TR"

    # Gövde yüksekliği tahmini
    pdf.set_font("NotoSans", "", 9.0)
    inner_w = w - 8
    approx_chars_per_line = max(40, int(inner_w / 1.8))
    body_lines = max(14, (len(body) // approx_chars_per_line) + 4)
    body_h = body_lines * 4.5

    card_h = 6 + 5 + 6 + body_h + 18 + 7
    _card_bg(pdf, x, y, w, card_h, bg=_COLOR_SOFT_BG)

    row_y = y + 4
    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x + 4, row_y)
    pdf.cell(inner_w, 4, _cell_text(subtitle))
    row_y += 4.5

    pdf.set_font("NotoSans", "", 10.0)
    _set_rgb(pdf, "text", (99, 102, 241) if use_fast else (91, 33, 182))
    _safe_set_xy(pdf, x + 4, row_y)
    pdf.cell(inner_w, 5.5, _cell_text(title_txt).upper())
    row_y += 6.5

    pdf.set_font("NotoSans", "", 9.0)
    _set_rgb(pdf, "text", _COLOR_INK)
    _safe_set_xy(pdf, x + 4, row_y)
    pdf.multi_cell(inner_w, 4.5, body)
    # multi_cell sonrası gerçek y konumunu al
    row_y = pdf.get_y() + 2

    # Persona kutusu
    persona_h = 15
    _set_rgb(pdf, "fill", (239, 246, 255))
    _set_rgb(pdf, "draw", (219, 234, 254))
    try:
        pdf.rect(x + 4, row_y, inner_w, persona_h, style="DF",
                 round_corners=True, corner_radius=2.0)
    except TypeError:
        pdf.rect(x + 4, row_y, inner_w, persona_h, style="DF")
    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", (59, 130, 246))
    _safe_set_xy(pdf, x + 6, row_y + 1.5)
    pdf.cell(inner_w - 4, 3, _cell_text(_t("dash.persona")).upper())
    pdf.set_font("NotoSans", "", 8.0)
    _set_rgb(pdf, "text", (30, 64, 175))
    _safe_set_xy(pdf, x + 6, row_y + 5)
    pdf.cell(
        inner_w - 4,
        3.5,
        _cell_text(f"• {_t('dash.persona_version')} {best_v}    • {_t('dash.persona_language')} {best_l}"),
    )
    _safe_set_xy(pdf, x + 6, row_y + 9)
    pdf.cell(
        inner_w - 4, 3.5,
        _cell_text(f"• {_t('dash.persona_note_label')} {_t('dash.persona_note')}"),
    )
    row_y += persona_h + 2

    # Sayaç özet
    pdf.set_font("NotoSans", "", 7.0)
    _set_rgb(pdf, "text", _COLOR_FAINT)
    _safe_set_xy(pdf, x + 4, row_y)
    pdf.cell(inner_w, 3.5,
             _cell_text(_t("dash.summary_counts_line", pos=pos, neg=neg, neu=neu)))
    row_y += 4

    return max(row_y + 2, y + card_h + 3.0)


# -------------------- Puan dağılımı (aylık stacked bar) -------------------- #


def _build_rating_distribution(rows: list[dict]) -> list[dict] | None:
    df = pd.DataFrame(rows)
    if "Puan" not in df.columns or "Tarih" not in df.columns:
        return None
    df = df.dropna(subset=["Puan", "Tarih"]).copy()
    if df.empty:
        return None
    df["Puan_val"] = pd.to_numeric(df["Puan"], errors="coerce").fillna(0).astype(int)
    df = df[(df["Puan_val"] >= 1) & (df["Puan_val"] <= 5)]
    if df.empty:
        return None
    df["Tarih_dt"] = pd.to_datetime(df["Tarih"], errors="coerce")
    df = df.dropna(subset=["Tarih_dt"])
    if df.empty:
        return None

    months_i18n = {i: _t(f"dash.month_{i}") for i in range(1, 13)}
    df["Period"] = df["Tarih_dt"].dt.to_period("M").apply(lambda r: r.start_time)
    df["Label"] = df["Period"].apply(lambda x: f"{months_i18n[x.month]} {x.year}")
    grouped = df.groupby(["Period", "Label", "Puan_val"]).size().reset_index(name="count")
    groups: dict[Any, dict[str, Any]] = {}
    for _, r in grouped.iterrows():
        key = r["Period"]
        bucket = groups.setdefault(key, {"label": r["Label"], "total": 0, "stars": {i: 0 for i in range(1, 6)}})
        bucket["stars"][int(r["Puan_val"])] += int(r["count"])
        bucket["total"] += int(r["count"])
    ordered = [groups[k] for k in sorted(groups.keys())]
    return ordered


def _draw_rating_distribution(
    pdf, x: float, y: float, w: float, *, dist: list[dict], date_range: tuple[str, str]
) -> float:
    # Başlık + tarih aralığı
    pdf.set_font("NotoSans", "", 11.0)
    _set_rgb(pdf, "text", _COLOR_INK)
    _safe_set_xy(pdf, x, y)
    pdf.cell(w, 5, _cell_text(_t("dash.score_dist")))
    y += 6
    pdf.set_font("NotoSans", "", 7.5)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x, y)
    pdf.cell(w, 3.5, _cell_text(_t("dash.date_range_label", min_d=date_range[0], max_d=date_range[1])))
    y += 5

    card_h = 58.0
    _card_bg(pdf, x, y, w, card_h)

    # Sol dikey eksen (0 .. max_total)
    max_total = max((g["total"] for g in dist), default=0)
    if max_total <= 0:
        pdf.set_font("NotoSans", "", 9.0)
        _set_rgb(pdf, "text", _COLOR_MUTED)
        _safe_set_xy(pdf, x + 4, y + 5)
        pdf.cell(w - 8, 5, _cell_text(_t("dash.no_date_rating")))
        return y + card_h + 2

    inner_left = x + 12
    inner_top = y + 6
    inner_bottom = y + card_h - 14  # alt kısımda 14mm etiket alanı
    inner_right = x + w - 4
    chart_w = inner_right - inner_left
    chart_h = inner_bottom - inner_top

    # Y eksen yardımcı çizgileri (3 adet)
    pdf.set_draw_color(229, 231, 235)
    pdf.set_line_width(0.15)
    pdf.set_font("NotoSans", "", 6.5)
    _set_rgb(pdf, "text", _COLOR_FAINT)
    for frac in (0.0, 0.5, 1.0):
        ly = inner_bottom - chart_h * frac
        pdf.line(inner_left, ly, inner_right, ly)
        _safe_set_xy(pdf, x + 2, ly - 2)
        pdf.cell(9, 3, str(int(round(max_total * frac))), align="R")

    # Her ay için stacked bar
    n = len(dist)
    max_bars_visible = min(n, 14)
    visible = dist[-max_bars_visible:]
    gap = 2.0
    bar_w = max(2.0, (chart_w - gap * (len(visible) - 1)) / max(1, len(visible)))
    bx = inner_left
    for bucket in visible:
        total = bucket["total"]
        if total <= 0:
            bx += bar_w + gap
            continue
        seg_y = inner_bottom
        total_h = chart_h * (total / max_total)
        stack_start = inner_bottom - total_h
        running_y = inner_bottom
        for star in (1, 2, 3, 4, 5):
            cnt = bucket["stars"].get(star, 0)
            if cnt <= 0:
                continue
            seg_h = total_h * (cnt / total)
            running_y -= seg_h
            _set_rgb(pdf, "fill", _STAR_COLORS[star - 1])
            pdf.rect(bx, running_y, bar_w, max(seg_h, 0.2), style="F")
        # Etiket (ay ismi)
        pdf.set_font("NotoSans", "", 6.2)
        _set_rgb(pdf, "text", _COLOR_INK_SOFT)
        # multi_cell ile döndürme yerine kısaltarak yazıyoruz (basit kalması için)
        lbl = _cell_text(bucket["label"])
        if len(lbl) > 10:
            lbl = lbl[:10] + "…"
        _safe_set_xy(pdf, bx - 0.5, inner_bottom + 1.5)
        pdf.cell(bar_w + 1, 3, lbl, align="C")
        bx += bar_w + gap

    # Legend (yıldız renkleri)
    lg_y = inner_bottom + 6.5
    lg_x = inner_left
    pdf.set_font("NotoSans", "", 6.8)
    for i in range(5):
        _set_rgb(pdf, "fill", _STAR_COLORS[i])
        pdf.rect(lg_x, lg_y, 3, 3, style="F")
        _set_rgb(pdf, "text", _COLOR_INK_SOFT)
        _safe_set_xy(pdf, lg_x + 4, lg_y - 0.5)
        pdf.cell(14, 4, _cell_text(_t("dash.stars_suffix", n=i + 1)))
        lg_x += 22

    return y + card_h + 4


# =============================================================================
#  Kapak / başlık yardımcıları
# =============================================================================


def _draw_header_band(pdf, *, title: str, subtitle: str, src_label: str) -> None:
    page_w = pdf.w
    band_h = 22.0
    _set_rgb(pdf, "fill", _COLOR_BRAND)
    pdf.rect(0, 0, page_w, band_h, style="F")

    pdf.set_font("NotoSans", "", 15.0)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(14, 4.5)
    pdf.cell(page_w - 28, 8, _cell_text(title))

    pdf.set_font("NotoSans", "", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(14, 12.5)
    pdf.cell(page_w - 28, 5, _cell_text(subtitle))

    pdf.set_font("NotoSans", "", 7.5)
    pdf.set_xy(14, 17.0)
    pdf.cell(
        page_w - 28, 4,
        _cell_text(
            f"{_t('pdf.source_label')}: {src_label}  ·  "
            f"{_t('pdf.generated_at')}: {datetime.now():%Y-%m-%d %H:%M}"
        ),
    )


# =============================================================================
#  Uygulama dashboard'u
# =============================================================================


def _compute_date_range(rows: list[dict]) -> tuple[str, str] | None:
    dates = [r.get("Tarih") for r in rows if r.get("Tarih")]
    if not dates:
        return None
    try:
        ser = pd.to_datetime(pd.Series(dates), errors="coerce").dropna()
        if ser.empty:
            return None
        return ser.min().strftime("%d-%m-%Y"), ser.max().strftime("%d-%m-%Y")
    except Exception:
        return None


def _render_app_dashboard(
    pdf, *, app_label: str, rows: list[dict], use_fast: bool = True, is_compare: bool = False
) -> None:
    page_w = pdf.w - pdf.l_margin - pdf.r_margin
    x = pdf.l_margin
    y = pdf.get_y() + 2

    # Uygulama başlığı
    pdf.set_font("NotoSans", "", 14.0)
    _set_rgb(pdf, "text", _COLOR_BRAND)
    _safe_set_xy(pdf, x, y)
    if is_compare:
        prefix = _t("pdf.app_section_prefix")
        pdf.cell(page_w, 7, _cell_text(f"{prefix}: {app_label}"))
    else:
        pdf.cell(page_w, 7, _cell_text(_t("dash.page_title")))
    y += 8

    pdf.set_font("NotoSans", "", 8.5)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x, y)
    pdf.cell(page_w, 4, _cell_text(app_label if is_compare else ""))
    y += 5

    pos, neg, neu, total = _counts(rows)
    # Metrik pill'ler
    y = _draw_metric_row(pdf, x, y, page_w, pos=pos, neg=neg, neu=neu, total=total)
    # Duygu dağılımı yatay barlar
    y = _draw_sent_distribution(pdf, x, y, page_w, pos=pos, neg=neg, neu=neu)
    # Deneyim skoru + trend
    trend = _compute_trend(rows)
    y = _draw_experience_and_trend(pdf, x, y, page_w, pos=pos, neg=neg, neu=neu, trend=trend)
    # Günlük negatif oran
    rates = _compute_daily_neg(rows)
    if rates:
        y = _draw_daily_negative(pdf, x, y, page_w, rates=rates)
    # Özet
    y = _draw_summary_block(pdf, x, y, page_w, rows=rows, pos=pos, neg=neg, neu=neu,
                            total=total, use_fast=use_fast)

    pdf.set_y(y + 1)

    # Puan dağılımı — yer yoksa yeni sayfa
    dist = _build_rating_distribution(rows)
    if dist:
        dr = _compute_date_range(rows) or ("—", "—")
        needed_h = 78
        if pdf.get_y() + needed_h > pdf.h - pdf.b_margin:
            pdf.add_page()
        _draw_rating_distribution(pdf, x, pdf.get_y() + 2, page_w, dist=dist, date_range=dr)


# =============================================================================
#  Yorum listesi (metin tablosu)
# =============================================================================


def _render_reviews_section(pdf, df: pd.DataFrame) -> None:
    if df is None or df.empty:
        return
    pdf.add_page()
    page_w = pdf.w - pdf.l_margin - pdf.r_margin
    x = pdf.l_margin

    pdf.set_font("NotoSans", "", 14.0)
    _set_rgb(pdf, "text", _COLOR_BRAND)
    _safe_set_xy(pdf, x, pdf.get_y())
    pdf.cell(page_w, 7, _cell_text(_t("pdf.reviews_section_title")))
    pdf.set_y(pdf.get_y() + 8)

    pdf.set_font("NotoSans", "", 9.0)
    _set_rgb(pdf, "text", _COLOR_MUTED)
    _safe_set_xy(pdf, x, pdf.get_y())
    pdf.cell(page_w, 5, _cell_text(_t("pdf.reviews_count", n=len(df))))
    pdf.set_y(pdf.get_y() + 6)

    cols = _ordered_columns(df)

    for i in range(len(df)):
        row = df.iloc[i]
        if pdf.get_y() + 22 > pdf.h - pdf.b_margin:
            pdf.add_page()
        card_x = pdf.l_margin
        card_y = pdf.get_y()
        # Renk: baskın duyguya göre
        verdict = str(row.get("Baskın Duygu", "—"))
        if verdict == "Olumlu":
            accent = _COLOR_POS
        elif verdict == "Olumsuz":
            accent = _COLOR_NEG
        elif verdict == "İstek/Görüş":
            accent = _COLOR_NEU
        else:
            accent = _COLOR_FAINT

        pdf.set_font("NotoSans", "", 9.0)
        _set_rgb(pdf, "text", accent)
        _safe_set_xy(pdf, card_x, card_y)
        app_lbl = _cell_text(row.get("Uygulama", ""))
        idx_lbl = _t("pdf.row_prefix", i=i + 1)
        header = f"{idx_lbl}  ·  {app_lbl}  ·  {_cell_text(verdict)}" if app_lbl else f"{idx_lbl}  ·  {_cell_text(verdict)}"
        pdf.cell(page_w, 4.5, header)
        pdf.set_y(pdf.get_y() + 5)

        pdf.set_font("NotoSans", "", 8.5)
        _set_rgb(pdf, "text", _COLOR_INK)
        _safe_set_xy(pdf, card_x, pdf.get_y())
        pdf.multi_cell(page_w, 4.2, _cell_text(row.get("Yorum", "")))
        pdf.set_y(pdf.get_y() + 1)

        # Meta satırı
        meta_parts: list[str] = []
        for k in ("Tarih", "Puan", "Versiyon", "lang", "Yöntem", "Olumlu %", "Olumsuz %", "İstek/Görüş %"):
            if k in cols:
                val = _cell_text(row.get(k))
                if val:
                    meta_parts.append(f"{k}: {val}")
        if meta_parts:
            pdf.set_font("NotoSans", "", 7.5)
            _set_rgb(pdf, "text", _COLOR_MUTED)
            _safe_set_xy(pdf, card_x, pdf.get_y())
            pdf.multi_cell(page_w, 3.8, _cell_text("   ·   ".join(meta_parts)))
        pdf.set_y(pdf.get_y() + 1)

        # Ayraç
        pdf.set_draw_color(*_COLOR_CARD_BORDER)
        pdf.set_line_width(0.15)
        y0 = pdf.get_y()
        pdf.line(card_x, y0, card_x + page_w, y0)
        pdf.set_y(y0 + 2.0)


# =============================================================================
#  Giriş noktaları
# =============================================================================


def _detect_compare(df: pd.DataFrame) -> list[str]:
    if "Uygulama" not in df.columns:
        return []
    uniq = [v for v in df["Uygulama"].dropna().astype(str).tolist() if v.strip()]
    unique_ordered: list[str] = []
    for v in uniq:
        if v not in unique_ordered:
            unique_ordered.append(v)
    return unique_ordered if len(unique_ordered) >= 2 else []


def _detect_method(df: pd.DataFrame) -> bool:
    """True → hızlı (heuristic); False → zengin (llm). Baskın yönteme göre."""
    if "Yöntem" not in df.columns:
        return True
    vc = df["Yöntem"].dropna().astype(str).str.lower().value_counts()
    if vc.empty:
        return True
    top = vc.idxmax()
    return "fast" in top or "hızlı" in top or "heur" in top


def build_analysis_pdf_bytes(rows: list[dict[str, Any]], *, source_label: str) -> bytes:
    """Analiz sonuçları → modern dashboard PDF'i."""
    from fpdf import FPDF  # PyPI: fpdf2

    if not rows:
        raise ValueError("rows boş olamaz")
    font = _ensure_font()
    df = pd.DataFrame(rows)
    apps = _detect_compare(df)
    use_fast = _detect_method(df)

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.set_margins(14, 30, 14)  # üst margin header için
    pdf.add_font("NotoSans", "", str(font))

    pdf.set_title(_t("dash.page_title"))
    pdf.set_creator("vivindis")
    pdf.set_subject(_t("pdf.subject"))

    title_txt = _t("dash.page_title")
    if apps:
        subtitle = _t(
            "pdf.subtitle_compare",
            a=apps[0],
            b=apps[1] if len(apps) > 1 else "",
        )
    else:
        subtitle = _t("pdf.subtitle_single")

    # Kapak / ilk sayfa
    pdf.add_page()
    _draw_header_band(pdf, title=title_txt, subtitle=subtitle, src_label=_cell_text(source_label))
    pdf.set_y(26)

    if apps:
        for idx, app in enumerate(apps):
            sub_rows = [r for r in rows if str(r.get("Uygulama", "")).strip() == app]
            if not sub_rows:
                continue
            if idx > 0:
                pdf.add_page()
                _draw_header_band(pdf, title=title_txt, subtitle=subtitle,
                                  src_label=_cell_text(source_label))
                pdf.set_y(26)
            _render_app_dashboard(pdf, app_label=app, rows=sub_rows,
                                  use_fast=use_fast, is_compare=True)
    else:
        _render_app_dashboard(pdf, app_label=source_label, rows=rows,
                              use_fast=use_fast, is_compare=False)

    # Yorum listesi
    _render_reviews_section(pdf, df)

    out = io.BytesIO()
    pdf.output(out)
    return out.getvalue()


def build_raw_pool_pdf_bytes(rows: list[dict[str, Any]], *, source_label: str) -> bytes:
    """Ham havuz (analiz öncesi) yorumları → basit PDF. Analiz öncesi görsel yok,
    sadece liste."""
    from fpdf import FPDF  # PyPI: fpdf2

    if not rows:
        raise ValueError("rows boş olamaz")
    font = _ensure_font()
    df = pd.DataFrame(rows)
    cols = list(df.columns)

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.set_margins(14, 14, 14)
    pdf.add_font("NotoSans", "", str(font))
    pdf.add_page()
    pdf.set_font("NotoSans", "", 11)
    pdf.set_text_color(17, 24, 39)
    pdf.set_title("yorum havuzu (ham)")
    pdf.set_creator("vivindis")

    w = pdf.epw
    pdf.set_font("NotoSans", "", 14)
    pdf.multi_cell(w, 8, "yorum havuzu (analiz öncesi)")
    pdf.set_font("NotoSans", "", 10)
    pdf.multi_cell(w, 6, f"kaynak: {_cell_text(source_label)}")
    pdf.multi_cell(w, 6, f"oluşturulma: {datetime.now():%Y-%m-%d %H:%M}")
    pdf.multi_cell(w, 6, f"kayıt: {len(df)}")
    pdf.ln(3)

    for i in range(len(df)):
        row = df.iloc[i]
        pdf.set_font("NotoSans", "", 10)
        pdf.multi_cell(w, 6, f"— kayıt {i + 1} —")
        pdf.set_font("NotoSans", "", 8.5)
        for c in cols:
            pdf.multi_cell(w, 5, f"{c}: {_cell_text(row.get(c))}")
        pdf.ln(2)

    out = io.BytesIO()
    pdf.output(out)
    return out.getvalue()


def safe_pdf_filename(prefix: str) -> str:
    base = datetime.now().strftime("%Y%m%d_%H%M")
    pfx = re.sub(r"[^\w\-]+", "_", prefix.lower())[:32].strip("_") or "export"
    return f"{pfx}_{base}.pdf"
