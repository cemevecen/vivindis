"""CLI: `vivindis-api` veya `python -m vivindis.web`."""

from __future__ import annotations

import argparse
import os


def main() -> None:
    import uvicorn

    p = argparse.ArgumentParser(description="Vivindis FastAPI sunucusu")
    p.add_argument("--host", default=os.environ.get("API_HOST", "127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.environ.get("API_PORT", "8000")))
    p.add_argument("--reload", action="store_true", help="Geliştirme: kod değişince yeniden yükle")
    args = p.parse_args()
    uvicorn.run(
        "vivindis.web.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
