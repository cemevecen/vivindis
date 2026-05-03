"""Masthead dil seçicide yuvarlak bayrak görselleri (flagcdn PNG, orantılı ölçek)."""

from __future__ import annotations

import html

from vivindis.config.i18n import LANGUAGES

# UI dil kodu -> ISO 3166-1 alpha-2 (flagcdn)
_FLAG_CC: dict[str, str] = {
    "tr": "tr",
    "en": "gb",
    "es": "es",
    "de": "de",
    "fr": "fr",
    "ar": "sa",
    "zh": "cn",
    "ru": "ru",
    "pt": "br",
    "ja": "jp",
}


def flag_png_url(lang_code: str, *, width: int = 160) -> str:
    """flagcdn yalnızca belirli ``w*`` genişlikleri sunar (ör. 20, 40, 80, 160, 320); ara değer 404."""
    cc = _FLAG_CC.get(lang_code, lang_code)
    return f"https://flagcdn.com/w{width}/{cc}.png"


def _flag_shared(lang_code: str) -> str:
    """Bayrak arka planı; TR için flagcdn PNG'de ay–yıldız geometrik merkezin solunda — dairede optik ortala."""
    pos = (
        "background-position:calc(42% + 5px) center!important;"
        if lang_code == "tr"
        else "background-position:center!important;"
    )
    return (
        f"{pos}"
        "background-size:auto 138%!important;"
        "background-repeat:no-repeat!important;background-color:transparent!important;"
        "color:transparent!important;-webkit-text-fill-color:transparent!important;"
    )


def masthead_flag_css_block(current_lang: str) -> str:
    """Popover tetikleyici + dil düğmeleri: daire içi tam bayrak, metin/emoji görünmez."""
    pop_cls = f"st-key-masthead_lang_pop_{current_lang}"
    cur_u = html.escape(flag_png_url(current_lang), quote=True)
    trig = ",".join(
        f"{s} .st-key-masthead_lang_slot .{pop_cls} button"
        for s in (
            '[data-testid="stVerticalBlock"].st-key-pg_masthead',
            '[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead',
        )
    )
    chunks: list[str] = [
        f"{trig}{{{_flag_shared(current_lang)}background-image:url({cur_u})!important;}}"
    ]
    for code, _name, _flag in LANGUAGES:
        u = html.escape(flag_png_url(code), quote=True)
        sel = f'div[data-baseweb="popover"] .st-key-masthead_pick_{code} button'
        chunks.append(f"{sel}{{{_flag_shared(code)}background-image:url({u})!important;}}")
    hide = (
        f'[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot .{pop_cls} button p,'
        f'[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot .{pop_cls} button p,'
        f'[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot .{pop_cls} button span,'
        f'[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot .{pop_cls} button span,'
        f'[data-testid="stVerticalBlock"].st-key-pg_masthead .st-key-masthead_lang_slot .{pop_cls} button [data-testid="stMarkdownContainer"],'
        f'[data-testid="stVerticalBlockBorderWrapper"].st-key-pg_masthead .st-key-masthead_lang_slot .{pop_cls} button [data-testid="stMarkdownContainer"],'
        'div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button p,'
        'div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button span,'
        'div[data-baseweb="popover"] [class*="st-key-masthead_pick_"] button [data-testid="stMarkdownContainer"]'
        "{color:transparent!important;-webkit-text-fill-color:transparent!important;"
        "font-size:0!important;line-height:0!important;}"
    )
    chunks.append(hide)
    return "<style>" + "".join(chunks) + "</style>"
