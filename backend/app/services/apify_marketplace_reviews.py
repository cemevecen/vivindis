"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings


def _apify_actor_run_failed_retryable(status_code: int, body: str) -> bool:
    """Apify returns HTTP 400 with run-failed when the actor started but exited with status FAILED or TIMEOUT."""
    if status_code != 400:
        return False
    low = body.lower()
    # Check for various failure markers in Apify run results
    return (
        "run-failed" in low
        or "did not succeed" in low
        or "status: failed" in low
        or "status: timeout" in low
        or '"status":"failed"' in low.replace(" ", "")
        or '"status":"timeout"' in low.replace(" ", "")
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
    """Runs `turkish-e-commerce-review-aggregator` with robust retries and fallback."""
    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_reviews_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_MARKETPLACE_REVIEWS_ACTOR eksik.")
    actor_enc = quote(actor_raw, safe="")

    # Match client timeout for sync run
    timeout_val = max(180, int(settings.external_scraper_timeout_seconds or 300))
    url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1&timeout={timeout_val}&restartOnError=1&memory=4096"
    )

    plats = [p.strip().lower() for p in platforms if p and str(p).strip()]
    if not plats:
        raise RuntimeError("platforms boş.")

    pu = [u.strip() for u in (product_urls or []) if isinstance(u, str) and u.strip()]
    sqs = [s.strip() for s in (search_queries or []) if isinstance(s, str) and len(s.strip()) >= 2]
    
    if not pu and not sqs:
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

    # Client timeout should be slightly more than Apify sync timeout
    client_timeout = timeout_val + 60

    async with httpx.AsyncClient(timeout=client_timeout) as client:
        last_detail = ""
        
        # 1. Try Product URLs if available
        if pu:
            for idx, (label, proxy_cfg) in enumerate(proxy_strategies):
                payload: dict[str, Any] = {
                    "productUrls": pu[:50],
                    "platforms": plats[:3],
                    "maxReviewsPerProduct": cap,
                    "sortBy": "recent",
                    "proxyConfig": proxy_cfg,
                }
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code < 400:
                        rows = _normalize_dataset_list(resp.json())
                        if _review_like_row_count(rows) > 0:
                            return rows
                        # No reviews found with this proxy, try next
                        continue
                    
                    last_detail = (resp.text or "").strip()
                    if len(last_detail) > 800:
                        last_detail = last_detail[:800] + "…"
                    
                    retryable = _apify_actor_run_failed_retryable(resp.status_code, resp.text or "")
                    if retryable and idx + 1 < len(proxy_strategies):
                        continue
                    # If we reach here, this proxy failed non-retryably
                except Exception as e:
                    last_detail = f"Request error ({label}): {str(e)}"
                    if idx + 1 < len(proxy_strategies):
                        continue
            
            # If we are here, Product URLs failed or returned nothing. 
            # We don't raise error yet if we have search queries to fall back to.
            if not sqs:
                raise RuntimeError(
                    f"Apify yorum aktörü (ürün URL) başarısız oldu. Son hata: {last_detail or 'Veri yok'}"
                )

        # 2. Try Search Queries
        last_http_error = last_detail
        for q in sqs:
            q_clip = q[:500]
            for idx, (label, proxy_cfg) in enumerate(proxy_strategies):
                payload = {
                    "searchQuery": q_clip,
                    "platforms": plats[:3],
                    "maxReviewsPerProduct": cap,
                    "sortBy": "recent",
                    "proxyConfig": proxy_cfg,
                }
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code < 400:
                        rows = _normalize_dataset_list(resp.json())
                        if _review_like_row_count(rows) > 0:
                            return rows
                        # No reviews found for this query/proxy combo
                        continue
                    
                    detail = (resp.text or "").strip()
                    if len(detail) > 800:
                        detail = detail[:800] + "…"
                    last_http_error = detail
                    
                    retryable = _apify_actor_run_failed_retryable(resp.status_code, resp.text or "")
                    if retryable and idx + 1 < len(proxy_strategies):
                        continue
                except Exception as e:
                    last_http_error = f"Request error ({label}): {str(e)}"
                    if idx + 1 < len(proxy_strategies):
                        continue
        
        if last_http_error:
            raise RuntimeError(f"Apify yorum aktörü tüm yöntemleri denedi ama başarısız oldu: {last_http_error}")
        
        return []
