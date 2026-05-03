from __future__ import annotations

import io
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd


def df_to_csv_bytes(df: "pd.DataFrame") -> bytes:
    import pandas as pd

    return df.to_csv(index=False).encode("utf-8-sig")


def df_to_excel_bytes(df: "pd.DataFrame") -> bytes:
    import pandas as pd

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Yorumlar")
    return buf.getvalue()
