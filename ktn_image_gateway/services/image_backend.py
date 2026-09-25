"""ComfyUI/Flux implementation behind the stable image API contract."""

from __future__ import annotations

import base64
import random
import time

from ktn_image_gateway.config import GatewaySettings
from ktn_image_gateway.schemas import (
    ImageData,
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from ktn_image_gateway.services.comfyui_client import ComfyUIClient, ComfyUIError
from ktn_image_gateway.services.workflow_loader import (
    WorkflowLoader,
    WorkflowTemplateError,
)


class ImageBackendUnavailable(RuntimeError):
    """Raised when the configured ComfyUI backend cannot fulfill the request."""


def _parse_size(size: str) -> tuple[int, int]:
    try:
        width_text, height_text = size.lower().split("x", 1)
        width, height = int(width_text), int(height_text)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("size must use WIDTHxHEIGHT format") from exc
    if width <= 0 or height <= 0 or width > 4096 or height > 4096:
        raise ValueError("image dimensions must be between 1 and 4096 pixels")
    return width, height


def generate_image(request: ImageGenerationRequest) -> ImageGenerationResponse:
    """Generate one image through the local ComfyUI workflow."""
    settings = GatewaySettings.from_env()
    if request.model != settings.default_model:
        raise ImageBackendUnavailable(
            f"unsupported image model alias: {request.model!r}; "
            f"configured model is {settings.default_model!r}"
        )

    try:
        width, height = _parse_size(request.size)
        workflow = WorkflowLoader(settings.workflow_path).render(
            prompt=request.prompt,
            width=width,
            height=height,
            seed=random.SystemRandom().randint(0, 2**63 - 1),
        )
        image_bytes = ComfyUIClient(
            settings.comfyui_base_url,
            timeout_seconds=settings.request_timeout_seconds,
            poll_interval_seconds=settings.poll_interval_seconds,
        ).generate_image(workflow)
    except (
        FileNotFoundError,
        ValueError,
        WorkflowTemplateError,
        ComfyUIError,
    ) as exc:
        raise ImageBackendUnavailable(str(exc)) from exc

    return ImageGenerationResponse(
        created=int(time.time()),
        data=[
            ImageData(
                b64_json=base64.b64encode(image_bytes).decode("ascii"),
            )
        ],
    )
