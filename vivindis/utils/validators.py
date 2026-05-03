from __future__ import annotations

import re
import unicodedata
from typing import Any

# Yalnızca sütun adı gibi görünen satırlar (CSV/Excel başlığı, dışa aktarım)
_HEADER_TOKENS = frozenset(
    {
        "id",
        "no",
        "idx",
        "index",
        "text",
        "yorum",
        "review",
        "comment",
        "body",
        "content",
        "mesaj",
        "date",
        "tarih",
        "time",
        "created",
        "rating",
        "puan",
        "score",
        "star",
        "stars",
        "lang",
        "language",
        "locale",
        "user",
        "author",
        "title",
        "name",
        "version",
        "versiyon",
        "app",
        "platform",
        "device",
        "baskın",
        "baskin",
        "duygu",
        "olumlu",
        "olumsuz",
        "istek",
        "görüş",
        "gorus",
        "yüzde",
        "%",
    }
)


def is_valid_comment(text: Any) -> bool:
    """
    Filter pasted metadata, developer replies, and noise lines
    (Play / App Store exports, Connect copy-pastes).
    """
    if not text:
        return False
    s = str(text).strip()
    s_norm = unicodedata.normalize("NFKC", s)
    sl = s_norm.lower()

    if len(s_norm) < 3:
        return False

    # Gerçek yorum: en az bir harf (saf rakam / ID / sadece noktalama elenir)
    if not any(ch.isalpha() for ch in s_norm):
        return False

    # Uzun sayısal kimlik / puan satırı (ör. 13354134213)
    compact_num = re.sub(r"[\s,._\-+eE]", "", s_norm)
    if compact_num.isdigit() and len(compact_num) >= 5:
        return False

    # Başlık satırı: yalnızca bilinen sütun adlarından oluşuyorsa
    nh = re.sub(r"[\s,;\t|]+", " ", sl).strip()
    hdr_words = [w for w in nh.split() if w and w not in ("%",)]
    if len(hdr_words) >= 3 and all(w in _HEADER_TOKENS for w in hdr_words) and len(s_norm) < 160:
        return False
    if sl in ("nan", "null", "none"):
        return False

    meta_keywords = [
        "developer response",
        "geliştirici cevabı",
        "developer answer",
        "customer review",
        "müşteri yorumu",
        "app store connect",
        "review details",
        "yorum detayları",
        "version:",
        "versiyon:",
        "report a concern",
        "rapor et",
        "reply",
        "cevapla",
        "edit response",
        "cevabı düzenle",
    ]
    if any(k in sl for k in meta_keywords):
        return False

    if re.search(r"version\s+\d+(\.\d+)*", sl):
        return False

    months = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
        "ocak",
        "şubat",
        "mart",
        "nisan",
        "mayıs",
        "haziran",
        "temmuz",
        "ağustos",
        "eylül",
        "ekim",
        "kasım",
        "aralık",
    ]
    first_word = sl.split()[0].replace(".", "").replace(",", "") if sl.split() else ""
    if first_word in months and len(s_norm) < 60:
        return False

    if len(s_norm) < 45:
        date_regex = (
            r"(\d{1,4}[-./]\d{1,2}[-./]\d{1,4})|"
            r"((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
            r"Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+\d{1,2},?\s+\d{4})"
        )
        if re.search(date_regex, s_norm, re.IGNORECASE):
            return False

    formal_patterns = [
        "aksaklık için üzgünüz",
        "yaşanan aksaklık için",
        "teşekkür ederiz. yaşadığınız",
        "teşekkürler. yaşadığınız",
        "good day, thank you for the feedback",
        "support team",
        "destek ekibi",
        "iletişime geçtiğiniz için teşekkür",
        "bize ulaştığınız için teşekkür",
        "ilgili birimlerimize iletiyoruz",
        "çözüm için çalışıyoruz",
        "güncelleme ile giderilmiştir",
        "versiyonda giderilmiştir",
        "sorununuz devam ediyorsa",
        "yeni versiyon yayınlandı",
        "yükleyebilmiş miydiniz",
        "yardıma ihtiyacınız olursa",
        "iyi günler dileriz",
    ]
    if any(fp in sl for fp in formal_patterns):
        return False

    if re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", sl):
        return False

    return True
