"""日本語 UI 文字列（i18n.STRINGS にマージ）。"""

from __future__ import annotations

import json
from pathlib import Path

JA: dict[str, str] = json.loads(
    (Path(__file__).with_name("i18n_ja.json")).read_text(encoding="utf-8")
)
