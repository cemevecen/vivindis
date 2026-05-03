from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Callable, Optional

from vivindis.core.heuristic import heuristic_analysis


def dominant_sentiment(scores: dict[str, float]) -> str:
    items = [
        ("Olumlu", float(scores.get("olumlu", 0))),
        ("Olumsuz", float(scores.get("olumsuz", 0))),
        ("İstek/Görüş", float(scores.get("istek_gorus", 0))),
    ]
    return max(items, key=lambda x: x[1])[0]


def dedupe_reviews(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_ids: set[str] = set()
    seen_texts: set[str] = set()
    clean: list[dict[str, Any]] = []
    for d in entries:
        r_id = d.get("id")
        txt = str(d.get("text", "")).strip()
        if not txt:
            continue
        if r_id:
            sid = str(r_id)
            if sid not in seen_ids:
                seen_ids.add(sid)
                clean.append(d)
        else:
            if txt not in seen_texts:
                seen_texts.add(txt)
                clean.append(d)
    return clean


def _row(
    idx: int,
    entry: dict[str, Any],
    res: dict[str, Any],
    verdict: str,
) -> dict[str, Any]:
    comment = str(entry.get("text", ""))
    date = entry.get("date")
    return {
        "No": idx + 1,
        "Yorum": comment,
        "Baskın Duygu": verdict,
        "Olumlu %": f"{float(res['olumlu']):.2%}",
        "İstek/Görüş %": f"{float(res['istek_gorus']):.2%}",
        "Olumsuz %": f"{float(res['olumsuz']):.2%}",
        "Tarih": date,
        "Puan": entry.get("rating"),
        "lang": entry.get("lang", "tr"),
        "Versiyon": entry.get("version", "—"),
        "Yöntem": res.get("method", "—"),
    }


def analyze_batch(
    entries: list[dict[str, Any]],
    *,
    use_heuristic_only: bool,
    analysis_mode: int,
    rich: Optional[Any],  # RichAnalyzer
    provider: str,
    model: str,
    max_workers: int = 24,
    progress: Optional[Callable[[int, int], None]] = None,
    max_rich_items: int = 500,
    ui_lang: str = "tr",
) -> list[dict[str, Any]]:
    data = dedupe_reviews(entries)
    if not use_heuristic_only and len(data) > max_rich_items:
        data = data[:max_rich_items]

    total = len(data)
    if total == 0:
        return []

    if not use_heuristic_only and rich is None:
        raise ValueError("Zengin analiz için RichAnalyzer gerekli.")

    def worker(i: int, entry: dict[str, Any]) -> dict[str, Any]:
        comment = str(entry.get("text", ""))[:1000].strip()
        valid = entry.get("is_valid", True)
        if not valid or len(comment) < 2:
            res = {"olumlu": 0, "olumsuz": 0, "istek_gorus": 0, "method": "Skipped"}
            return _row(i, entry, res, "—")

        rating = entry.get("rating")
        if use_heuristic_only:
            res = heuristic_analysis(comment, rating=rating)
        else:
            assert rich is not None
            res = rich.analyze(
                comment,
                provider=provider,
                model=model,
                analysis_mode=analysis_mode,
                rating=rating,
                output_lang=ui_lang,
            )
        verdict = dominant_sentiment(res)
        return _row(i, entry, res, verdict)

    out: list[Optional[dict[str, Any]]] = [None] * total
    done = 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(worker, i, e): i for i, e in enumerate(data)}
        for fut in as_completed(futs):
            i = futs[fut]
            out[i] = fut.result()
            done += 1
            if progress:
                progress(done, total)

    # Renumber No sequentially in original order
    final = []
    for n, row in enumerate(out):
        if row is None:
            continue
        row = dict(row)
        row["No"] = n + 1
        final.append(row)
    return final
