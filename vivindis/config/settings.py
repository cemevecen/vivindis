from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


def _first_env(*names: str) -> Optional[str]:
    for n in names:
        v = os.getenv(n)
        if v and str(v).strip():
            return str(v).strip()
    return None


@dataclass
class Settings:
    """Runtime API keys (load .env before constructing)."""

    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            gemini_api_key=_first_env("GEMINI_API_KEY", "GOOGLE_API_KEY", "API_KEY"),
            groq_api_key=_first_env("GROQ_API_KEY"),
            openai_api_key=_first_env("OPENAI_API_KEY"),
        )
