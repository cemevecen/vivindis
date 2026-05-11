"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger(__name__)


def normalize_marketplace_url(url: str) -> str:
    """Removes 'profil/' subpaths and query params from Trendyol/marketplace URLs."""
    if not isinstance(url, str):
        return ""
    u = url.strip()
    # Remove query params
    if "?" in u:
        u = u.split("?")[0]
    # Trendyol: magaza/profil/ -> magaza/
    low = u.lower()
    if "/magaza/profil/" in low:
        # Preserve original case for the rest of the URL if possible, but replace the specific segment
        idx = low.find("/magaza/profil/")
        u = u[:idx] + "/magaza/" + u[idx + len("/magaza/profil/") :]
    return u


def extract_seller_name_from_url(url: str) -> str:
    """Best-effort seller name extraction from URL (Shopist, etc)."""
    u = normalize_marketplace_url(url).lower()
    name = "Bilinmeyen Mağaza"
    try:
        if "/magaza/" in u:
            part = u.split("/magaza/")[1].split("/")[0]
            name = part.split("-m-")[0].split("-s-")[0]
        elif "/satici/" in u:
            part = u.split("/satici/")[1].split("/")[0]
            name = part.split("-m-")[0].split("-s-")[0]
        
        if name:
            # Replace dashes with spaces and capitalize
            return name.replace("-", " ").strip().title()
    except Exception:
        pass
    return name


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
    if seller_url:
        seller_url = normalize_marketplace_url(seller_url)

    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_reviews_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_MARKETPLACE_REVIEWS_ACTOR eksik.")
    
    is_abotapi = "abotapi/trendyol-scraper" in actor_raw or "fatihtahta/trendyol-scraper" in actor_raw
    actor_enc = quote(actor_raw, safe="")
    timeout_val = max(180, int(settings.external_scraper_timeout_seconds or 300))
    cap = max(5, min(200, int(max_reviews_per_product)))
    plats = [p.strip().lower() for p in platforms if p and str(p).strip()]

    async with httpx.AsyncClient(timeout=timeout_val + 60) as client:
        # --- SPECIAL BRANCH: abotapi/trendyol-scraper ---
        if is_abotapi:
            log.info("marketplace_abotapi_start", actor=actor_raw)

            # Build startUrls: actor accepts store URLs, search URLs, and product URLs directly
            start_urls: list[str] = []
            if product_urls:
                start_urls.extend(product_urls[:20])
            if seller_url and seller_url not in start_urls:
                start_urls.append(seller_url)
            if not start_urls and search_queries:
                # Use Trendyol search URLs as fallback
                from urllib.parse import quote as urlquote
                for sq in search_queries[:2]:
                    start_urls.append(f"https://www.trendyol.com/sr?q={urlquote(sq)}")

            if not start_urls:
                raise RuntimeError("Başlatılacak URL bulunamadı.")

            log.info("marketplace_abotapi_run", actor=actor_raw, start_urls=start_urls[:2])
            # fatihtahta/trendyol-scraper and abotapi/trendyol-scraper both accept startUrls
            payload = {
                "startUrls": [{
                    "url": u,
                    "method": "GET"
                } for u in start_urls],
                "maxReviews": cap,
                "getReviews": True,
                "proxyConfiguration": {"useApifyProxy": True},
            }
            run_url = (
                f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
                f"?token={token}&format=json&clean=1&timeout={timeout_val}"
            )
            resp = await client.post(run_url, json=payload)
            if resp.status_code < 400:
                items = _normalize_dataset_list(resp.json())
                # Filter to review items only
                reviews = [
                    item for item in items
                    if item.get("type") == "review" or item.get("reviewId") or item.get("review_id")
                ]
                log.info("marketplace_abotapi_done", total=len(items), reviews=len(reviews))
                return reviews if reviews else items  # fallback: return all if no typed reviews

            err_detail = resp.text[:500]
            raise RuntimeError(f"Abotapi çekimi başarısız ({resp.status_code}): {err_detail}")

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
