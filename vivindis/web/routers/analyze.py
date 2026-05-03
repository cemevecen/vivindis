from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from vivindis.web.dependencies import get_analysis_service
from vivindis.web.schemas.analyze import AnalyzeRequest
from vivindis.web.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("")
def run_analysis(
    body: AnalyzeRequest,
    svc: AnalysisService = Depends(get_analysis_service),
) -> dict[str, Any]:
    return svc.run(body)
