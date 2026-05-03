"""Hafif, bağımlılıksız yazı-sistemi (script) filtresi.

`scope="local"` seçildiğinde mağaza, storefront üzerinden yerel olmayan
dillerde (ör. Kiril, Arapça, CJK) yazılmış yorumları da döndürebilir. Bu
modül, TR local için bu tür yorumları kesin biçimde elemeyi sağlar.

Stratejisi:
- Kiril / Arapça / CJK / Thai / Devanagari / İbranice / Yunanca karakter
    oranı `non_latin_cap`'ı aşarsa yerel kabul edilmez.
- Türkçe diakritiklerin varlığı (`ğüşıöçĞÜŞİÖÇ`) pozitif belirleyici.
- Aksi hâlde Latin harf içermesi yeterli sayılır (TR/EN karma içerik
    Türkiye kullanıcıları için olağandır).
"""

from __future__ import annotations

import re

_CYRILLIC = re.compile(r"[\u0400-\u04FF\u0500-\u052F]")
_ARABIC = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
_CJK = re.compile(
    r"[\u3000-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]"
)
_THAI = re.compile(r"[\u0E00-\u0E7F]")
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_HEBREW = re.compile(r"[\u0590-\u05FF]")
_GREEK = re.compile(r"[\u0370-\u03FF]")
_TURKISH_DIACRITICS = re.compile(r"[ğüşıöçĞÜŞİÖÇ]")
_LATIN = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")


def foreign_script_ratio(text: str) -> dict[str, float]:
    """Boşluksuz karakter toplamı üzerinden her yabancı script'in oranı."""
    t = text or ""
    total = max(1, sum(1 for c in t if not c.isspace()))
    return {
        "cyrillic": len(_CYRILLIC.findall(t)) / total,
        "arabic": len(_ARABIC.findall(t)) / total,
        "cjk": len(_CJK.findall(t)) / total,
        "thai": len(_THAI.findall(t)) / total,
        "devanagari": len(_DEVANAGARI.findall(t)) / total,
        "hebrew": len(_HEBREW.findall(t)) / total,
        "greek": len(_GREEK.findall(t)) / total,
    }


def is_local_tr(text: str, *, non_latin_cap: float = 0.15) -> bool:
    """TR local için yerel-olası mı?

    `non_latin_cap`'ı aşan herhangi bir yabancı script anında elenir.
    Türkçe diakritik varsa garanti TR; aksi hâlde Latin harf bulunması
    yeterlidir (TR/EN karma içerik kabul edilir, yorum havuzunda doğal).
    """
    if not text or not isinstance(text, str):
        return False
    ratios = foreign_script_ratio(text)
    if any(r >= non_latin_cap for r in ratios.values()):
        return False
    if _TURKISH_DIACRITICS.search(text):
        return True
    return bool(_LATIN.search(text))


def filter_local_reviews(
    rows: list[dict], *, locale: str = "tr"
) -> tuple[list[dict], int]:
    """Yerel kapsam için yorumları süzer.

    Şu an yalnızca `tr` desteklenir; başka locale'ler geldiğinde burada
    genişletilebilir. Geri dönüş: (süzülmüş liste, elenen kayıt sayısı).
    """
    if not rows:
        return rows, 0
    code = (locale or "tr").lower()
    if code != "tr":
        # Desteklenmeyen locale'de filtreyi devre dışı bırak; regresyon yapma.
        return rows, 0
    kept: list[dict] = []
    dropped = 0
    for r in rows:
        txt = str(r.get("text", ""))
        if is_local_tr(txt):
            kept.append(r)
        else:
            dropped += 1
    return kept, dropped
