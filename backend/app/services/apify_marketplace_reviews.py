"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings


def _apify_actor_run_failed_retryable(status_code: int, body: str) -> bool:
    """Apify returns HTTP 400 with run-failed when the actor started but exited with status FAILED."""
    if status_code != 400:
        return False
    low = body.lower()
    return (
        "run-failed" in low
        or "did not succeed" in low
        or "status: failed" in low
        or '"status":"failed"' in low.replace(" ", "")
    )


def _review_like_row_count(items: list[dict[str, Any]]) -> int:
    """Counts dataset rows that look like reviews (excludes run summaries)."""
    n = 0
    for item in items:
        dv = str(item.get("dataVersion") or "")
        if "run_summary" in dv.lower():
            continue
        if item.get("recordType") == "RUN_SUMMARY" or item.get("type") == "RUN_SUMMARY":
            continue
        if item.get("reviewId"):
            n += 1
            continue
        if "review" in dv.lower():
            n += 1
    return n


def _normalize_dataset_list(data: object) -> list[dict[str, Any]]:
    if not isinstance(data, list):
        raise RuntimeError("Apify beklenmeyen yanıt döndü (liste değil).")
    rows: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            rows.append(item)
    return rows


def _is_tr_marketplace_product_url(s: str) -> bool:
    if not s.startswith("http"):
        return False
    low = s.lower()
    if "trendyol.com" in low and "-p-" in low:
        return True
    if "hepsiburada.com" in low and "-p-" in low:
        return True
    if "n11.com" in low and "/urun/" in low:
        return True
    return False


def collect_marketplace_product_urls_from_profile(root: object, *, max_urls: int = 40) -> list[str]:
    """Pull product page URLs out of seller-intelligence JSON (nested dict/list walk)."""
    seen: set[str] = set()
    out: list[str] = []

    def walk(obj: object) -> None:
        if len(out) >= max_urls:
            return
        if isinstance(obj, str):
            s = obj.strip()
            if _is_tr_marketplace_product_url(s) and s not in seen:
                seen.add(s)
                out.append(s[:2048])
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(root)
    return out


async def run_marketplace_review_aggregator(
    *,
    settings: Settings,
    platforms: list[str],
    max_reviews_per_product: int,
    search_queries: list[str] | None = None,
    product_urls: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Runs `turkish-e-commerce-review-aggregator` with `productUrls` and/or `searchQuery` (mutually exclusive)."""
    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_reviews_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_MARKETPLACE_REVIEWS_ACTOR eksik.")
    actor_enc = quote(actor_raw, safe="")

    # Extra memory: review actor can be heavy; sync endpoint allows memory query param.
    url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1&timeout=300&restartOnError=1&memory=4096"
    )

    plats = [p.strip().lower() for p in platforms if p and str(p).strip()]
    if not plats:
        raise RuntimeError("platforms boş.")

    pu = [u.strip() for u in (product_urls or []) if isinstance(u, str) and u.strip()]
    sqs = [s.strip() for s in (search_queries or []) if isinstance(s, str) and len(s.strip()) >= 2]
    if pu:
        sqs = []
    elif not sqs:
        raise RuntimeError("product_urls veya search_queries gerekli.")

    cap = max(5, min(200, int(max_reviews_per_product)))

    proxy_strategies: list[tuple[str, dict[str, Any]]] = [
        (
            "residential_tr",
            {
                "useApifyProxy": True,
                "apifyProxyGroups": ["RESIDENTIAL"],
                "apifyProxyCountry": "TR",
            },
        ),
        (
            "datacenter_auto_tr",
            {
                "useApifyProxy": True,
                "apifyProxyCountry": "TR",
            },
        ),
        ("no_proxy", {"useApifyProxy": False}),
    ]

    timeout_seconds = max(360, int(settings.external_scraper_timeout_seconds or 180) * 2)

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        if pu:
            last_detail = ""
            for idx, (_label, proxy_cfg) in enumerate(proxy_strategies):
                payload: dict[str, Any] = {
                    "productUrls": pu[:50],
                    "platforms": plats[:3],
                    "maxReviewsPerProduct": cap,
                    "sortBy": "recent",
                    "proxyConfig": proxy_cfg,
                }
                resp = await client.post(url, json=payload)
                if resp.status_code < 400:
                    rows = _normalize_dataset_list(resp.json())
                    if _review_like_row_count(rows) > 0:
                        return rows
                    continue
                last_detail = (resp.text or "").strip()
                if len(last_detail) > 800:
                    last_detail = last_detail[:800] + "…"
                retryable = _apify_actor_run_failed_retryable(resp.status_code, resp.text or "")
                if retryable and idx + 1 < len(proxy_strategies):
                    continue
                raise RuntimeError(
                    f"Apify yorum aktörü (ürün URL) HTTP {resp.status_code}: {last_detail or 'gövde yok'}"
                )
            return []

        last_http_error = ""
        for q in sqs:
            q_clip = q[:500]
            for idx, (_label, proxy_cfg) in enumerate(proxy_strategies):
                payload = {
                    "searchQuery": q_clip,
                    "platforms": plats[:3],
                    "maxReviewsPerProduct": cap,
                    "sortBy": "recent",
                    "proxyConfig": proxy_cfg,
                }
                resp = await client.post(url, json=payload)
                if resp.status_code < 400:
                    last_http_error = ""
                    rows = _normalize_dataset_list(resp.json())
                    if _review_like_row_count(rows) > 0:
                        return rows
                    break
                detail = (resp.text or "").strip()
                if len(detail) > 800:
                    detail = detail[:800] + "…"
                last_http_error = detail or last_http_error
                retryable = _apify_actor_run_failed_retryable(resp.status_code, resp.text or "")
                if retryable and idx + 1 < len(proxy_strategies):
                    continue
                break

        if last_http_error:
            raise RuntimeError(f"Apify yorum aktörü: {last_http_error}")
        return []
