"""HTTP istek/gövde şemaları (Pydantic) — router ince, iş mantığı `services` içinde."""

from vivindis.web.schemas.analyze import AnalyzeRequest, ReviewIn
from vivindis.web.schemas.apps import FetchBody, ResolveBody, SearchQuery
from vivindis.web.schemas.reviews import PasteBody

__all__ = [
    "AnalyzeRequest",
    "ReviewIn",
    "FetchBody",
    "ResolveBody",
    "SearchQuery",
    "PasteBody",
]
