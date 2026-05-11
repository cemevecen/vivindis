"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11).

Main flow:
  1. Normalize the seller_url (strip /profil/, query params).
  2. Extract the merchant ID (m-XXXXX) from the URL.
  3. Fetch product list from Trendyol internal API.
  4. Build product review URLs (/yorumlar suffix).
  5. Call shahidirfan/trendyol-reviews-scraper with those URLs.
  6. Map output fields -> canonical review dict.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote, urlencode

import httpx

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def normalize_marketplace_url(url: str) -> str:
    """Strips /profil/ subpaths and query params from Trendyol/marketplace URLs."""
    if not isinstance(url, str):
        return ""
    u = url.strip()
    if "?" in u:
        u = u.split("?")[0]
    # trendyol.com/magaza/profil/shopist-m-357212  ->  trendyol.com/magaza/shopist-m-357212
    low = u.lower()
    if "/magaza/profil/" in low:
        idx = low.find("/magaza/profil/")
        u = u[:idx] + "/magaza/" + u[idx + len("/magaza/profil/"):]
    return u


def extract_seller_name_from_url(url: str) -> str:
    """Best-effort seller name extraction from URL slug."""
    u = normalize_marketplace_url(url).lower()
    name = "Bilinmeyen Mağaza"
    try:
        for seg in ("/magaza/", "/satici/"):
            if seg in u:
                part = u.split(seg)[1].split("/")[0]
                part = re.split(r"-m-|-s-", part)[0]
                name = part.replace("-", " ").strip().title()
                break
    except Exception:
        pass
    return name or "Bilinmeyen Mağaza"


def _extract_merchant_id(url: str) -> str | None:
    """Extract numeric merchant ID from URL like 'shopist-m-357212'."""
    m = re.search(r"-m-(\d+)", url, re.IGNORECASE)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Trendyol internal product discovery
# ---------------------------------------------------------------------------

async def _fetch_trendyol_products_for_seller(
    merchant_id: str,
    *,
    max_products: int = 20,
    timeout: float = 30.0,
) -> list[str]:
    """Returns a list of Trendyol product review-page URLs for the given merchant."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.trendyol.com/",
    }
    params = {
        "merchantId": merchant_id,
        "pi": 1,
        "culture": "tr-TR",
        "pId": merchant_id,
        "storefrontId": 1,
        "channelId": 1,
    }
    api_url = (
        "https://public.trendyol.com/discovery-web-websfxproductlisting-santral/api/infinite-scroll"
        f"?{urlencode(params)}"
    )
    product_urls: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
            resp = await client.get(api_url)
            if resp.status_code != 200:
                log.warning("trendyol_product_api_failed", status=resp.status_code, merchant_id=merchant_id)
                return []
            data = resp.json()
            products = (
                data.get("result", {}).get("products")
                or data.get("products")
                or []
            )
            for p in products[:max_products]:
                url_val = p.get("url") or p.get("productUrl") or ""
                if not url_val:
                    continue
                if url_val.startswith("/"):
                    url_val = "https://www.trendyol.com" + url_val
                # Trendyol review page: append /yorumlar
                url_val = url_val.split("?")[0].rstrip("/")
                if "/yorumlar" not in url_val.lower():
                    url_val = url_val + "/yorumlar"
                product_urls.append(url_val)
    except Exception as exc:
        log.warning("trendyol_product_api_error", error=str(exc), merchant_id=merchant_id)
    return product_urls


# ---------------------------------------------------------------------------
# Output field mapping
# ---------------------------------------------------------------------------

def _is_review_like_row(item: dict[str, Any]) -> bool:
    if not isinstance(item, dict):
        return False
    if item.get("recordType") == "RUN_SUMMARY" or item.get("type") == "RUN_SUMMARY":
        return False
    dv = str(item.get("dataVersion") or "")
    if "run_summary" in dv.lower():
        return False
    # shahidirfan actor fields
    if item.get("comment") or item.get("reviewText") or item.get("body"):
        return True
    if item.get("reviewId") or item.get("id"):
        return True
    return False


def normalize_review_row(item: dict[str, Any]) -> dict[str, Any]:
    """Map various actor output schemas to a canonical review dict."""
    return {
        # IDs
        "reviewId": (
            item.get("reviewId")
            or item.get("id")
            or item.get("review_id")
            or ""
        ),
        # Text content
        "body": (
            item.get("comment")          # shahidirfan
            or item.get("reviewText")
            or item.get("body")
            or item.get("text")
            or ""
        ),
        "title": item.get("title") or "",
        # Author
        "reviewerName": (
            item.get("userFullName")     # shahidirfan
            or item.get("reviewerName")
            or item.get("author")
            or ""
        ),
        # Rating
        "rating": (
            item.get("rating")
            or item.get("rate")
            or item.get("starCount")
            or 3
        ),
        # Date
        "reviewDate": (
            item.get("createdAt")        # shahidirfan
            or item.get("reviewDate")
            or item.get("date")
            or item.get("commentDate")
            or ""
        ),
        # Product info
        "productUrl": (
            item.get("productUrl")
            or item.get("sourceUrl")
            or item.get("url")
            or ""
        ),
        "platform": item.get("platform") or "trendyol",
        "helpfulCount": item.get("helpfulCount") or item.get("helpfulVoteCount") or 0,
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run_marketplace_review_aggregator(
    *,
    settings: Settings,
    platforms: list[str],
    max_reviews_per_product: int,
    search_queries: list[str] | None = None,
    product_urls: list[str] | None = None,
    seller_url: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetches reviews for a Trendyol/marketplace seller.

    Strategy:
      - Normalize seller_url.
      - Extract merchant ID and fetch product list from Trendyol API.
      - Call the configured Apify actor (expects startUrls with /yorumlar product pages).
      - Return list of canonical review dicts.
    """
    if seller_url:
        seller_url = normalize_marketplace_url(seller_url)

    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_reviews_actor or "").strip()
    if not actor_raw:
        actor_raw = "shahidirfan/trendyol-reviews-scraper"

    actor_enc = quote(actor_raw, safe="")
    timeout_val = max(180, int(settings.external_scraper_timeout_seconds or 300))
    cap = max(5, min(500, int(max_reviews_per_product)))

    log.info("marketplace_review_start", actor=actor_raw, seller_url=seller_url)

    # --- Step 1: Collect product review URLs ---
    start_urls: list[str] = []

    # Use provided product URLs (pre-converted to /yorumlar if needed)
    if product_urls:
        for pu in product_urls[:20]:
            pu = pu.split("?")[0].rstrip("/")
            if "/yorumlar" not in pu.lower():
                pu += "/yorumlar"
            start_urls.append(pu)

    # Discover products from seller via Trendyol internal API
    if seller_url and len(start_urls) < 15:
        merchant_id = _extract_merchant_id(seller_url)
        if merchant_id:
            log.info("trendyol_product_discovery", merchant_id=merchant_id)
            discovered = await _fetch_trendyol_products_for_seller(
                merchant_id,
                max_products=20 - len(start_urls),
                timeout=30.0,
            )
            for u in discovered:
                if u not in start_urls:
                    start_urls.append(u)
            log.info("trendyol_product_discovery_done", found=len(discovered), total_urls=len(start_urls))
        else:
            log.warning("trendyol_merchant_id_not_found", seller_url=seller_url)

    if not start_urls:
        raise RuntimeError(
            f"Mağaza için ürün URL'si bulunamadı. "
            f"Lütfen doğrudan bir Trendyol mağaza sayfası URL'si girin "
            f"(örn: https://www.trendyol.com/magaza/shopist-m-357212). "
            f"seller_url={seller_url!r}"
        )

    # --- Step 2: Call the Apify actor ---
    payload: dict[str, Any] = {
        "startUrls": [{"url": u} for u in start_urls],
        "results_wanted": cap,
        "max_pages": max(1, cap // 10),
    }

    run_url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1&timeout={timeout_val}"
    )

    log.info("marketplace_apify_call", actor=actor_raw, url_count=len(start_urls), cap=cap)

    async with httpx.AsyncClient(timeout=timeout_val + 60) as client:
        resp = await client.post(run_url, json=payload)

    if resp.status_code >= 400:
        err = resp.text[:500]
        raise RuntimeError(f"Apify çekimi başarısız ({resp.status_code}): {err}")

    raw_items = resp.json()
    if not isinstance(raw_items, list):
        raise RuntimeError("Apify beklenmeyen yanıt döndü (liste değil).")

    # --- Step 3: Filter and normalize ---
    reviews = [normalize_review_row(item) for item in raw_items if _is_review_like_row(item)]

    log.info("marketplace_review_done", raw=len(raw_items), reviews=len(reviews))

    if not reviews and raw_items:
        # Fallback: return raw items so the worker can try to parse them
        return [dict(item) for item in raw_items if isinstance(item, dict)]

    return reviews


# ---------------------------------------------------------------------------
# Utility kept for backward compat (used in scraper.py)
# ---------------------------------------------------------------------------

def collect_marketplace_product_urls_from_profile(root: object, *, max_urls: int = 40) -> list[str]:
    """Pull product page URLs out of seller-intelligence JSON (nested dict/list walk)."""
    seen: set[str] = set()
    out: list[str] = []

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
