"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger(__name__)


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
    seller_url: str | None = None,
) -> list[dict[str, Any]]:
    """Runs the marketplace review actor with support for abotapi/trendyol-scraper and fallback to old aggregator."""
    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_reviews_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_MARKETPLACE_REVIEWS_ACTOR eksik.")
    
    is_abotapi = "abotapi/trendyol-scraper" in actor_raw
    actor_enc = quote(actor_raw, safe="")
    timeout_val = max(180, int(settings.external_scraper_timeout_seconds or 300))
    cap = max(5, min(200, int(max_reviews_per_product)))
    plats = [p.strip().lower() for p in platforms if p and str(p).strip()]

    async with httpx.AsyncClient(timeout=timeout_val + 60) as client:
        # --- SPECIAL BRANCH: abotapi/trendyol-scraper ---
        if is_abotapi:
            log.info("marketplace_abotapi_start", actor=actor_raw)
            target_urls = list(product_urls or [])

            # If no product URLs, use Trendyol's own internal listing API to find products
            # This is much faster and more reliable than using abotapi for discovery
            if not target_urls and seller_url:
                import re
                m = re.search(r"-m-(\d+)", seller_url)
                if m:
                    merchant_id = m.group(1)
                    log.info("marketplace_trendyol_api_discovery", merchant_id=merchant_id)
                    # Trendyol's public product listing endpoint (no auth required)
                    trendyol_api_url = (
                        f"https://public.trendyol.com/discovery-web-searchgw-service/api/infinite-scroll"
                        f"?merchantIds={merchant_id}&pi=0&isLegalRequirementConfirmed=false&channelId=1"
                    )
                    try:
                        headers = {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "Accept": "application/json",
                            "Referer": "https://www.trendyol.com/",
                        }
                        api_resp = await client.get(trendyol_api_url, headers=headers, timeout=30)
                        if api_resp.status_code < 400:
                            api_data = api_resp.json()
                            # Extract product URLs from the response
                            products = (
                                api_data.get("result", {}).get("products", [])
                                or api_data.get("products", [])
                                or api_data.get("data", {}).get("products", [])
                                or []
                            )
                            for prod in products[:40]:
                                url_field = prod.get("url") or prod.get("productUrl") or ""
                                if url_field and not url_field.startswith("http"):
                                    url_field = "https://www.trendyol.com" + url_field
                                if url_field and "trendyol.com" in url_field:
                                    # Ensure it has /yorumlar suffix for review scraping
                                    base = url_field.split("?")[0].rstrip("/")
                                    if not base.endswith("/yorumlar"):
                                        base = base + "/yorumlar"
                                    target_urls.append(base)
                            log.info("marketplace_trendyol_api_success", count=len(target_urls))
                    except Exception as e:
                        log.warning("marketplace_trendyol_api_failed", error=str(e))

            # If still no URLs, try abotapi search mode as last resort
            if not target_urls and search_queries:
                log.info("marketplace_abotapi_search_fallback", queries=search_queries[:1])
                search_payload = {
                    "mode": "search",
                    "urls": search_queries[:1],  # seller name as search term
                    "maxItems": 20,
                    "proxyConfiguration": {"useApifyProxy": True, "apifyProxyCountry": "TR"}
                }
                d_url = f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items?token={token}&format=json&timeout=120"
                try:
                    d_resp = await client.post(d_url, json=search_payload, timeout=130)
                    if d_resp.status_code < 400:
                        for item in d_resp.json():
                            u = item.get("url") or item.get("productUrl") or ""
                            if "trendyol.com" in u and "-p-" in u:
                                base = u.split("?")[0].rstrip("/")
                                if not base.endswith("/yorumlar"):
                                    base = base + "/yorumlar"
                                target_urls.append(base)
                        target_urls = target_urls[:30]
                        log.info("marketplace_abotapi_search_result", count=len(target_urls))
                except Exception as e:
                    log.warning("marketplace_abotapi_search_failed", error=str(e))

            if not target_urls:
                raise RuntimeError(
                    "Mağazadan ürün linkleri alınamadı. "
                    "Trendyol API ve arama denemesi başarısız oldu."
                )

            # Step 2: Pass /yorumlar URLs to abotapi in url mode for review extraction
            log.info("marketplace_abotapi_reviews_start", url_count=len(target_urls))
            reviews_payload = {
                "mode": "url",
                "urls": target_urls[:20],
                "maxItems": cap,
                "proxyConfiguration": {"useApifyProxy": True, "apifyProxyCountry": "TR"}
            }
            r_url = f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items?token={token}&format=json&clean=1&timeout={timeout_val}"
            resp = await client.post(r_url, json=reviews_payload)
            if resp.status_code < 400:
                return _normalize_dataset_list(resp.json())

            err_detail = resp.text[:500]
            raise RuntimeError(f"Abotapi yorum çekimi başarısız: {err_detail}")

        # --- FALLBACK: Legacy Aggregator Logic ---
        url = (
            f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
            f"?token={token}&format=json&clean=1&timeout={timeout_val}&restartOnError=1&memory=4096"
        )
        # ... (Rest of the previous logic for fallback)
        # For brevity, I'll keep the existing logic here but integrated with the abotapi branch.
        # I'll re-implement the robust retry loop for the fallback case.
        
        pu = [u.strip() for u in (product_urls or []) if isinstance(u, str) and u.strip()]
        sqs = []
        for s in (search_queries or []):
            if not isinstance(s, str): continue
            clean_s = s.strip()
            if len(clean_s) < 2: continue
            if "-m-" in clean_s or "-p-" in clean_s: continue
            sqs.append(clean_s)
        if not sqs and search_queries:
            first = str(search_queries[0]).split("-m-")[0].split("-p-")[0].strip()
            if len(first) >= 2: sqs = [first]

        if not pu and not sqs:
            raise RuntimeError("product_urls veya geçerli arama terimi bulunamadı.")

        proxy_strategies = [
            ("residential_tr", {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"], "apifyProxyCountry": "TR"}),
            ("datacenter_auto_tr", {"useApifyProxy": True, "apifyProxyCountry": "TR"}),
            ("no_proxy", {"useApifyProxy": False}),
        ]

        last_detail = ""
        if pu:
            for idx, (label, proxy_cfg) in enumerate(proxy_strategies):
                try:
                    resp = await client.post(url, json={"productUrls": pu[:50], "platforms": plats[:3], "maxReviewsPerProduct": cap, "proxyConfig": proxy_cfg})
                    if resp.status_code < 400:
                        rows = _normalize_dataset_list(resp.json())
                        if _review_like_row_count(rows) > 0: return rows
                        continue
                    last_detail = f"{resp.status_code} - {resp.text[:200]}"
                except Exception as e:
                    last_detail = str(e)
            if not sqs: raise RuntimeError(f"Yorum çekimi (URL) başarısız: {last_detail}")

        for q in sqs:
            for idx, (label, proxy_cfg) in enumerate(proxy_strategies):
                try:
                    resp = await client.post(url, json={"searchQuery": q, "platforms": plats[:3], "maxReviewsPerProduct": cap, "proxyConfig": proxy_cfg})
                    if resp.status_code < 400:
                        rows = _normalize_dataset_list(resp.json())
                        if _review_like_row_count(rows) > 0: return rows
                        continue
                    last_detail = f"{resp.status_code} - {resp.text[:200]}"
                except Exception as e:
                    last_detail = str(e)
        
        raise RuntimeError(f"Tüm yöntemler denendi ama sonuç alınamadı: {last_detail}")
