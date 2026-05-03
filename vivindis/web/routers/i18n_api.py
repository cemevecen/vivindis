from __future__ import annotations

from fastapi import APIRouter

from vivindis.config.i18n import DEFAULT_LANG, LANGUAGES, STRINGS, lang_meta
from vivindis.web.deps import normalize_lang

router = APIRouter(prefix="/i18n", tags=["i18n"])


@router.get("/languages")
def list_languages() -> list[dict[str, str]]:
    return [{"code": c, "name": n, "flag": f} for c, n, f in LANGUAGES]


@router.get("/bundle")
def translation_bundle(lang: str | None = None) -> dict[str, str | dict[str, str]]:
    """Seçilen dil için tüm anahtar → metin (frontend önbelleği)."""
    code = normalize_lang(lang)
    out: dict[str, str] = {}
    for key, variants in STRINGS.items():
        out[key] = str(variants.get(code) or variants.get(DEFAULT_LANG) or key)
    name, flag = lang_meta(code)
    return {"lang": code, "lang_name": name, "lang_flag": flag, "strings": out}
