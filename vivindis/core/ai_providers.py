from __future__ import annotations

import threading
import time
from typing import Any, Callable, Optional

from vivindis.core.heuristic import heuristic_analysis
from vivindis.core.prompts import build_prompt, parse_model_response, strip_code_fence

# Soft client-side throttling (requests per rolling minute)
_RPM_LIMITS = {"Groq AI": 28, "Google Gemini": 28, "OpenAI": 60}
_rate_state: dict[str, list[float]] = {k: [] for k in _RPM_LIMITS}
_rate_lock = threading.Lock()


def _rpm_ok(provider: str) -> bool:
    limit = _RPM_LIMITS.get(provider, 20)
    with _rate_lock:
        now = time.time()
        window = _rate_state.setdefault(provider, [])
        window[:] = [t for t in window if now - t < 60.0]
        return len(window) < limit


def _rpm_record(provider: str) -> None:
    with _rate_lock:
        _rate_state.setdefault(provider, []).append(time.time())


DEFAULT_MODELS = {
    "Google Gemini": "gemini-2.0-flash",
    "Groq AI": "llama-3.3-70b-versatile",
    "OpenAI": "gpt-4o-mini",
}


def _call_groq(
    text: str,
    api_key: str,
    model: str,
    analysis_mode: int,
    rating: Optional[str | int],
    output_lang: str,
) -> Optional[dict[str, Any]]:
    try:
        from groq import Groq

        if not _rpm_ok("Groq AI"):
            return None
        client = Groq(api_key=api_key)
        prompt = build_prompt(text, analysis_mode, rating=rating, output_lang=output_lang)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=25,
        )
        _rpm_record("Groq AI")
        raw = (resp.choices[0].message.content or "").strip()
        return parse_model_response(strip_code_fence(raw), "Groq AI", analysis_mode)
    except Exception:
        return None


def _call_gemini(
    text: str,
    api_key: str,
    model: str,
    analysis_mode: int,
    rating: Optional[str | int],
    output_lang: str,
) -> Optional[dict[str, Any]]:
    try:
        from google import genai
        from google.genai import types as genai_types

        if not _rpm_ok("Google Gemini"):
            return None
        client = genai.Client(api_key=api_key)
        prompt = build_prompt(text, analysis_mode, rating=rating, output_lang=output_lang)
        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0),
        )
        _rpm_record("Google Gemini")
        raw = (getattr(resp, "text", None) or "").strip()
        return parse_model_response(strip_code_fence(raw), "Google Gemini", analysis_mode)
    except Exception:
        return None


def _call_openai(
    text: str,
    api_key: str,
    model: str,
    analysis_mode: int,
    rating: Optional[str | int],
    output_lang: str,
) -> Optional[dict[str, Any]]:
    try:
        from openai import OpenAI

        if not _rpm_ok("OpenAI"):
            return None
        client = OpenAI(api_key=api_key)
        prompt = build_prompt(text, analysis_mode, rating=rating, output_lang=output_lang)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=30,
        )
        _rpm_record("OpenAI")
        raw = (resp.choices[0].message.content or "").strip()
        return parse_model_response(strip_code_fence(raw), "OpenAI", analysis_mode)
    except Exception:
        return None


def build_provider_chain(selected: str) -> list[str]:
    order = ["Google Gemini", "Groq AI", "OpenAI"]
    return [selected] + [p for p in order if p != selected]


class RichAnalyzer:
    """
    Zengin analiz: sırayla Gemini → Groq → OpenAI dene; başarısızsa heuristic.
    """

    def __init__(
        self,
        gemini_key: Optional[str] = None,
        groq_key: Optional[str] = None,
        openai_key: Optional[str] = None,
    ):
        self.gemini_key = gemini_key
        self.groq_key = groq_key
        self.openai_key = openai_key

    def _try(
        self,
        provider: str,
        model: str,
        text: str,
        mode: int,
        rating: Optional[str | int],
        output_lang: str,
    ):
        if provider == "Google Gemini" and self.gemini_key:
            return _call_gemini(text, self.gemini_key, model, mode, rating, output_lang)
        if provider == "Groq AI" and self.groq_key:
            return _call_groq(text, self.groq_key, model, mode, rating, output_lang)
        if provider == "OpenAI" and self.openai_key:
            return _call_openai(text, self.openai_key, model, mode, rating, output_lang)
        return None

    def analyze(
        self,
        text: str,
        *,
        provider: str,
        model: str,
        analysis_mode: int,
        rating: Optional[str | int] = None,
        output_lang: str = "tr",
    ) -> dict[str, Any]:
        t = str(text).strip()
        if len(t) < 2:
            return {
                "olumlu": 0.33,
                "olumsuz": 0.34,
                "istek_gorus": 0.33,
                "method": "Skipped",
            }

        for p in build_provider_chain(provider):
            m = model if p == provider else DEFAULT_MODELS.get(p, model)
            res = self._try(p, m, t, analysis_mode, rating, output_lang)
            if res:
                return res

        h = heuristic_analysis(t, rating=rating)
        h["method"] = "Heuristic+APIFallback"
        return h


def resolve_api_keys(
    base_gemini: Optional[str],
    base_groq: Optional[str],
    base_openai: Optional[str],
    secrets_get: Callable[[str], Any],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Merge os.environ keys with optional Streamlit secrets."""

    def pick(*names: str) -> Optional[str]:
        for n in names:
            v = secrets_get(n)
            if v and str(v).strip():
                return str(v).strip()
        return None

    g = base_gemini or pick("GEMINI_API_KEY", "GOOGLE_API_KEY", "API_KEY")
    q = base_groq or pick("GROQ_API_KEY")
    o = base_openai or pick("OPENAI_API_KEY")
    return g, q, o
