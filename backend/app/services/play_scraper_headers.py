"""google-play-scraper isteklerine dönüşümlü User-Agent ekler (urllib tabanlı post/get)."""

from __future__ import annotations

from urllib.request import Request

from google_play_scraper.utils import request as gpr

from app.services.user_agents import pick_user_agent

_installed = False


def ensure_play_request_user_agents() -> None:
    global _installed
    if _installed:
        return

    orig_post = gpr.post
    orig_get = gpr.get

    def post(url: str, data: str | bytes, headers: dict) -> str:
        merged = {**headers, "User-Agent": pick_user_agent()}
        return orig_post(url, data, merged)

    def get(url: str) -> str:
        req = Request(url, headers={"User-Agent": pick_user_agent()})
        return gpr._urlopen(req).read().decode("UTF-8")

    gpr.post = post  # type: ignore[assignment]
    gpr.get = get  # type: ignore[assignment]
    _installed = True
