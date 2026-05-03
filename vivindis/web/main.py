"""ASGI giriş noktası — `uvicorn vivindis.web.main:app`."""

from vivindis.web.factory import create_app

app = create_app()
