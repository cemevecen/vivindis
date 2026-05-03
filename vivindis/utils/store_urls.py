"""Mağaza listeleme URL'leri (Play / App Store)."""

from __future__ import annotations

from urllib.parse import quote


def store_listing_url(*, platform: str, app_id: str) -> str | None:
    """Android: play details; iOS: App Store id. Tanınmayan veya boşsa None."""
    aid = str(app_id or "").strip()
    if not aid:
        return None
    p = (platform or "android").strip().lower()
    if p == "android":
        return "https://play.google.com/store/apps/details?id=" + quote(aid, safe=".")
    if p == "ios":
        if aid.isdigit():
            return f"https://apps.apple.com/app/id{aid}"
        return None
    return None
