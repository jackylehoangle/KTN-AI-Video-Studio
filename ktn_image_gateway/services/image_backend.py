"""Image generation backend boundary.

MPT-04B.2 deliberately keeps the HTTP contract separate from ComfyUI.
MPT-04B.3 will replace the placeholder implementation below with the real
ComfyUI workflow client.
"""

from __future__ import annotations

from ktn_image_gateway.schemas import ImageGenerationRequest, ImageGenerationResponse


class ImageBackendUnavailable(RuntimeError):
    """Raised while no real image-generation backend is connected."""


def generate_image(_: ImageGenerationRequest) -> ImageGenerationResponse:
    """Generate one image through the configured backend.

    The route and OpenAI-compatible contract are active in MPT-04B.2, while
    real ComfyUI/Flux execution is intentionally deferred to MPT-04B.3.
    """
    raise ImageBackendUnavailable(
        "ComfyUI/Flux backend is not connected yet; complete MPT-04B.3."
    )
