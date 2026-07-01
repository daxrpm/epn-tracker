"""Application entrypoint: ``uvicorn app.main:app``."""

from app.core.registrar import create_app

app = create_app()
