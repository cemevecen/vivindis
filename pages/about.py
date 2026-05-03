"""Eski çok sayfalı /about adresi — ana uygulamada Hakkında pill'ine yönlendirir.

Streamlit Cloud `~/+/about` gibi URL'ler buraya düşer; tam sayfa yenilemesi
yerine ana betikte aynı masthead pill davranışı kullanılır.
"""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

st.session_state["main_data_source_tab"] = "Hakkında"
st.switch_page("streamlit_app.py")
