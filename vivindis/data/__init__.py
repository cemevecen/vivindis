"""Static data assets (e.g. heuristic lexicon)."""

from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
HEURISTIC_LEXICON_PATH = DATA_DIR / "heuristic_lexicon.json"

__all__ = ["DATA_DIR", "HEURISTIC_LEXICON_PATH"]
