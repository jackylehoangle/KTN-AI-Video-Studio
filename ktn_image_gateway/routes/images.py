"""OpenAI-compatible image generation route."""

from __future__ import annotations

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from ktn_image_gateway.schemas import ImageGenerationRequest, ImageGenerationResponse
from ktn_image_gateway.services import image_backend


router = APIRouter(prefix="/v1/images", tags=["images"])


@router.post(
    "/generations",
    response_model=ImageGenerationResponse,
    responses={
        503: {
            "description": "Image backend is not connected",
            "content": {
                "application/json": {
                    "example": {
                        "error": {
                            "message": "ComfyUI/Flux backend is not connected yet.",
                            "type": "service_unavailable",
                            "code": "comfyui_backend_not_connected",
                        }
                    }
                }
            },
        }
    },
)
def create_image_generation(
    request: ImageGenerationRequest,
    authorization: str | None = Header(default=None),
) -> ImageGenerationResponse | JSONResponse:
    """Accept the stable OpenAI-compatible request contract.

    In MPT-04B.2 this endpoint is real and fully validated, but the default
    backend intentionally reports 503 until ComfyUI is connected in MPT-04B.3.
    """
    settings = image_backend.GatewaySettings.from_env()
    if settings.gateway_token:
        expected = f"Bearer {settings.gateway_token}"
        if authorization != expected:
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "message": "Invalid KTN Image Gateway token.",
                        "type": "authentication_error",
                        "code": "invalid_gateway_token",
                    }
                },
            )

    try:
        return image_backend.generate_image(request)
    except image_backend.ImageBackendUnavailable as exc:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "message": str(exc),
                    "type": "service_unavailable",
                    "code": "comfyui_backend_not_connected",
                }
            },
        )
