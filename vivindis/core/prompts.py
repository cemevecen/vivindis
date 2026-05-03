from __future__ import annotations

import json
import re
from typing import Any, Optional

# Uygulama dil kodu → LLM talimatında kullanılan dil adı (İngilizce isim, tüm sağlayıcılar için tutarlı).
_LANG_FOR_PROMPT: dict[str, str] = {
    "tr": "Turkish",
    "en": "English",
    "es": "Spanish",
    "de": "German",
    "fr": "French",
    "ar": "Arabic",
    "zh": "Simplified Chinese",
    "ru": "Russian",
    "pt": "Portuguese",
    "ja": "Japanese",
}


def build_prompt(
    text: str,
    analysis_mode: int = 0,
    rating: Optional[str | int] = None,
    *,
    output_lang: str = "tr",
) -> str:
    """analysis_mode: 0=standard JSON scores, 1=deep JSON with subcategories.

    output_lang: UI dil kodu; derin moddaki ``ozet`` alanı bu dilde yazdırılır.
    """
    rating_line = ""
    if rating is not None and str(rating).strip():
        rating_line = f"Mağaza puanı (yıldız): {rating}\n"

    base = (
        "Sen çok dilli uygulama mağaza yorumu analizi uzmanısın.\n"
        f"{rating_line}"
        "Yorumu detaylı analiz et ve 3 ana kategoriye puan ver. Toplam 1.0 olmalı.\n"
        "KATEGORİLER:\n"
        "- olumlu: Memnun, övgü, teşekkür, tavsiye.\n"
        "- olumsuz: Şikayet, sorun, kızgınlık, hayal kırıklığı.\n"
        "- istek_gorus: Tarafsız öneri, soru, beklenti.\n"
        "KARAR KURALLARI:\n"
        "1. Son cümle baskındır. Başta şikayet sonda çözüm → olumlu.\n"
        "2. Başta iltifat sonda şikayet → olumsuz.\n"
        "3. İroni/sarkasm → olumsuz. Sarkastik yorumları dikkatle analiz et!\n"
        "4. Yorum içeriği (kelimeler, ton) HER ZAMAN puan/star sayısından ÖNCELİKLİ.\n"
        '   Örn: "5 yıldız ama alarmlar silinmiyor" → OLUMSUZ (bug şikayeti).\n'
        '   Örn: "1 yıldız ama harika uygulama" → OLUMLU (içerik baskın).\n'
    )

    lang_name = _LANG_FOR_PROMPT.get(output_lang, _LANG_FOR_PROMPT["tr"])
    lang_tail = (
        f"\n\nUI language: the user interface is set to {lang_name} (code: {output_lang}).\n"
        f'- In deep analysis (mode 1), the JSON string field "ozet" MUST be written entirely in {lang_name} '
        "(about 5–10 words summarising the review sentiment).\n"
        "- JSON keys must remain exactly as specified; only the human-readable string value of \"ozet\" follows this rule.\n"
    )

    snippet = text[:500].replace('"', "'")

    if analysis_mode == 0:
        return base + lang_tail + (
            "ÇIKTI KURALI: SADECE JSON döndür, başka hiçbir şey yazma.\n"
            '{"olumlu": X, "olumsuz": Y, "istek_gorus": Z}\n'
            f'Yorum: "{snippet}"'
        )

    return base + lang_tail + (
        "ALT-KATEGORİLER:\n"
        "OLUMLU: Yazılım Kalitesi | Tasarım/UX | Müşteri Hizmetleri | İnovasyon\n"
        "OLUMSUZ: Bug/Çökme | Performans | Fiyatlandırma | Kullanıcı Hatası | İsistemsizlik\n"
        "İSTEK: Yeni Özellik | iyileştirme | Entegrasyon\n"
        "\n"
        'Sarkastik mi? Bağlam ve ton analiz et. "5 yıldız veriyorum ama çöp" → SARKASM.\n'
        "\n"
        "ÇIKTI KURALI: SADECE JSON döndür, başka hiçbir şey yazma.\n"
        f'Yorum: "{snippet}"\n'
        "{\n"
        '  "olumlu": X,\n'
        '  "olumlu_kategori_index": 0-3 (yoksa null),\n'
        '  "olumsuz": X,\n'
        '  "olumsuz_kategori_index": 0-4 (yoksa null),\n'
        '  "istek_gorus": X,\n'
        '  "guven_skoru": 0.0-1.0,\n'
        '  "sarkasm_mi": true/false,\n'
        f'  "ozet": "5-10 words, in {lang_name} only"\n'
        "}"
    )


def _extract_json_object(content: str) -> Optional[dict[str, Any]]:
    start = content.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(content)):
        ch = content[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                chunk = content[start : i + 1]
                try:
                    return json.loads(chunk)
                except json.JSONDecodeError:
                    return None
    return None


def parse_model_response(
    content: str,
    provider_label: str,
    analysis_mode: int = 0,
) -> Optional[dict[str, Any]]:
    data = _extract_json_object(content)
    if not data or "olumlu" not in data:
        return None
    try:
        p = float(data.get("olumlu", 0))
        n = float(data.get("olumsuz", 0))
        neu = float(data.get("istek_gorus", 0))
    except (TypeError, ValueError):
        return None
    total = p + n + neu
    if total <= 0:
        return None

    result: dict[str, Any] = {
        "olumlu": round(p / total, 4),
        "olumsuz": round(n / total, 4),
        "istek_gorus": round(neu / total, 4),
        "method": provider_label,
    }

    if analysis_mode == 1:
        result["analysis_mode"] = "deep"
        try:
            result["guven_skoru"] = float(data.get("guven_skoru", 0.5))
        except (TypeError, ValueError):
            result["guven_skoru"] = 0.5
        result["sarkasm_mi"] = bool(data.get("sarkasm_mi", False))

        olumlu_cats = [
            "Yazılım Kalitesi",
            "Tasarım/UX",
            "Müşteri Hizmetleri",
            "İnovasyon",
        ]
        olumsuz_cats = [
            "Bug/Çökme",
            "Performans",
            "Fiyatlandırma",
            "Kullanıcı Hatası",
            "İsistemsizlik",
        ]

        ol_idx = data.get("olumlu_kategori_index")
        try:
            ol_idx = int(ol_idx) if ol_idx is not None else None
        except (TypeError, ValueError):
            ol_idx = None
        result["olumlu_kategori"] = (
            olumlu_cats[ol_idx] if ol_idx is not None and 0 <= ol_idx < len(olumlu_cats) else None
        )

        om_idx = data.get("olumsuz_kategori_index")
        try:
            om_idx = int(om_idx) if om_idx is not None else None
        except (TypeError, ValueError):
            om_idx = None
        result["olumsuz_kategori"] = (
            olumsuz_cats[om_idx] if om_idx is not None and 0 <= om_idx < len(olumsuz_cats) else None
        )

        result["ozet"] = str(data.get("ozet", ""))[:100]

    return result


def strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9]*\n?", "", t)
        t = re.sub(r"\n?```$", "", t)
    return t
