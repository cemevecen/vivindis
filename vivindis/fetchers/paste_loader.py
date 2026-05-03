"""Metin (paste) sekmesi için akıllı ayrıştırıcı.

Kullanıcı Excel/Google Sheets/CSV dışa aktarımından kopyala-yapıştır yaptığında
içerik çoğunlukla tab (Excel default) veya virgülle ayrılmış tablodur. Bu modül:

1. Girdinin tablosal olup olmadığını sezgisel olarak tespit eder.
2. Eğer tabloysa `pandas` ile okuyup mevcut `load_reviews_from_dataframe`
   yolundan geçirir (aynı sütun keşif mantığı: yorum/review/text/mesaj...).
3. Tablo değilse düz metin olarak satır-bazı ayrıştırmaya düşer.

Böylece "metni havuza yükle" akışında çok satırlı Excel verisi geldiğinde,
gerçek yorum sayısı (satırlara bölünmüş parçalar değil) elde edilir.

`file-N\\t` ile başlayan ve `text` alanı tırnaksız çok satırlı olan dışa aktarımlar
pandas `read_csv` ile bozulur (`on_bad_lines="skip"`); bunlar için
`_try_parse_file_prefixed_multiline_tsv` kullanılır.
"""

from __future__ import annotations

import io
import re
from typing import Any

import pandas as pd

from vivindis.fetchers.file_loader import load_reviews_from_dataframe
from vivindis.utils.validators import is_valid_comment


_TEXT_COL_HINTS = (
    "yorum",
    "review",
    "comment",
    "text",
    "content",
    "body",
    "mesaj",
)


def _has_text_like_column(df: pd.DataFrame) -> bool:
    cols = [str(c).strip().lower() for c in df.columns]
    for c in cols:
        if any(h in c for h in _TEXT_COL_HINTS):
            return True
    return False


_FILE_ROW = re.compile(r"^(file-\d+)\t(.*)$")
_DATE_FIELD = re.compile(r"^\d{4}-\d{2}-\d+")


def _tab_parts_date_start_index(parts: list[str]) -> int | None:
    """İlk 'yyyy-mm-dd...' tarih alanının indeksi; yoksa None."""
    for j, seg in enumerate(parts):
        if _DATE_FIELD.match(seg.strip()):
            return j
    return None


def _is_footer_tab_line(ln: str) -> bool:
    """Satır tarih + sekmeli puan/lang gibi görünüyorsa (gövde sonu)."""
    ln = ln.strip("\r")
    if "\t" not in ln:
        return False
    first = ln.split("\t", 1)[0].strip()
    return bool(_DATE_FIELD.match(first))


def _parse_footer_fields(ln: str) -> tuple[str, str, str]:
    """Tarih satırından date, rating, lang (kalanı birleştik)."""
    parts = [p.strip() for p in ln.rstrip("\r").split("\t")]
    date_s = parts[0] if parts else ""
    rating_s = parts[1] if len(parts) > 1 else ""
    lang_s = parts[2] if len(parts) > 2 else "upload"
    return date_s, rating_s, lang_s or "upload"


def _parse_date_cell(date_s: str) -> Any:
    if not date_s.strip():
        return None
    try:
        return pd.to_datetime(date_s)
    except Exception:
        return None


def _should_try_file_prefixed_multiline_tsv(text: str) -> bool:
    """id/text/date başlığı + en az bir file-N satırı (dışa aktarım)."""
    lines = text.lstrip("\ufeff").splitlines()
    if not lines:
        return False
    head = lines[0].strip().lower()
    cols0 = lines[0].split("\t")[0].strip().lower()
    has_header = cols0 == "id" and "text" in head and "date" in head
    n_file_rows = len(re.findall(r"^file-\d+\t", text, flags=re.MULTILINE))
    return has_header and n_file_rows >= 1


def _try_parse_file_prefixed_multiline_tsv(text: str) -> list[dict[str, Any]] | None:
    """`file-N\\t` satırları + tırnaksız çok satırlı text + tarih footer satırı."""
    raw = text.lstrip("\ufeff").rstrip()
    lines = raw.splitlines()
    if len(lines) < 2:
        return None
    i = 1 if lines[0].split("\t")[0].strip().lower() == "id" else 0
    out: list[dict[str, Any]] = []
    n = len(lines)

    while i < n:
        m = _FILE_ROW.match(lines[i])
        if not m:
            i += 1
            continue
        rid, tail = m.group(1), m.group(2).rstrip("\r")
        i += 1

        parts = tail.split("\t") if tail else []
        d_idx = _tab_parts_date_start_index(parts)

        if d_idx is not None:
            text_val = "\t".join(parts[:d_idx]).strip()
            rest = parts[d_idx:]
            date_s = rest[0].strip() if rest else ""
            rating_s = rest[1].strip() if len(rest) > 1 else ""
            lang_s = rest[2].strip() if len(rest) > 2 else "upload"
            dt = _parse_date_cell(date_s)
        else:
            text_segments: list[str] = []
            date_s, rating_s, lang_s = "", "", "upload"
            dt = None
            if tail.strip():
                text_segments.append(tail.rstrip("\r"))
            while i < n:
                ln = lines[i]
                if _FILE_ROW.match(ln):
                    break
                if _is_footer_tab_line(ln):
                    date_s, rating_s, lang_s = _parse_footer_fields(ln)
                    dt = _parse_date_cell(date_s)
                    i += 1
                    break
                text_segments.append(ln.rstrip("\r"))
                i += 1
            text_val = "\n".join(text_segments).strip()

        if not is_valid_comment(text_val):
            continue
        out.append(
            {
                "id": rid,
                "text": text_val,
                "date": dt,
                "rating": rating_s,
                "lang": "upload",
                "is_valid": True,
            }
        )

    return out or None


def _try_read(text: str, sep: str) -> pd.DataFrame | None:
    """pandas ile denemeli okuma: hata/boş/çok-az-sütun halinde None."""
    try:
        df = pd.read_csv(
            io.StringIO(text),
            sep=sep,
            engine="python",
            dtype=str,
            keep_default_na=False,
            skip_blank_lines=True,
            on_bad_lines="skip",
        )
    except Exception:
        return None
    if df.empty or df.shape[1] < 2:
        return None
    return df


def _fallback_line_pool(text: str) -> list[dict[str, Any]]:
    """Tablo olarak okunamazsa: her satırı tek yorum kabul et."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    pool: list[dict[str, Any]] = []
    j = 0
    for ln in lines:
        if not is_valid_comment(ln):
            continue
        pool.append(
            {
                "id": f"paste-{j}",
                "text": ln,
                "date": None,
                "rating": "",
                "lang": "paste",
                "is_valid": True,
            }
        )
        j += 1
    return pool


def parse_pasted_reviews(text: str) -> list[dict[str, Any]]:
    """Yapıştırılmış metni yorum listesine çevirir.

    `file-N\\t` + çok satırlı text (tırnaksız) dışa aktarımları önce özel ayrıştırıcıda
    okunur; aksi halde Excel-kopyala TSV/CSV `pandas` + `load_reviews_from_dataframe`,
    son çare satır bazlı ayrıştırma.
    """
    if not isinstance(text, str) or not text.strip():
        return []

    if _should_try_file_prefixed_multiline_tsv(text):
        parsed = _try_parse_file_prefixed_multiline_tsv(text)
        if parsed:
            return parsed

    for sep in ("\t", ","):
        df = _try_read(text, sep=sep)
        if df is None:
            continue
        if not _has_text_like_column(df):
            continue
        try:
            return load_reviews_from_dataframe(df)
        except Exception:
            continue

    return _fallback_line_pool(text)
