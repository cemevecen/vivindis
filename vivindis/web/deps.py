from __future__ import annotations

from vivindis.config.i18n import DEFAULT_LANG, LANGUAGES

_LANG_CODES = {code for code, _, _ in LANGUAGES}


def normalize_lang(code: str | None) -> str:
    if isinstance(code, str) and code in _LANG_CODES:
        return code
    return DEFAULT_LANG
