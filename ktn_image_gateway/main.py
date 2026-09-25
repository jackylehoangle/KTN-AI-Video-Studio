"""ASGI entrypoint for the KTN OpenAI-compatible image gateway."""

from __future__ import annotations

from fastapi import FastAPI

from ktn_image_gateway import __version__
from ktn_image_gateway.config import GatewaySettings


settings = GatewaySettings.from_env()

app = FastAPI(
    title="KTN Image Gateway",
    version=__version__,
    description=(
        "OpenAI-compatible facade for KTN AI Video Studio image generation. "
        "ComfyUI/Flux execution is added in MPT-04B.3."
    ),
)


@app.get("/health")
def health() -> dict[str, object]:
    """Non-generating health endpoint used by local and CI smoke tests."""
    return {
        "status": "ok",
        "service": "ktn-image-gateway",
        "version": __version__,
        "comfyui_base_url": settings.comfyui_base_url,
    }
