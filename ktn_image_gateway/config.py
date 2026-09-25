"""Environment-backed configuration for the KTN image gateway."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class GatewaySettings:
    """Minimal runtime settings for the ComfyUI-backed gateway."""

    host: str = "127.0.0.1"
    port: int = 8189
    comfyui_base_url: str = "http://127.0.0.1:8188"
    workflow_path: str = "ktn_image_gateway/workflows/flux_text2img.json"
    output_dir: str = "storage/ktn_image_gateway"
    default_model: str = "flux"
    default_size: str = "1024x1024"
    request_timeout_seconds: int = 300
    poll_interval_seconds: float = 0.5

    @classmethod
    def from_env(cls) -> "GatewaySettings":
        return cls(
            host=os.getenv("KTN_IMAGE_GATEWAY_HOST", "127.0.0.1"),
            port=int(os.getenv("KTN_IMAGE_GATEWAY_PORT", "8189")),
            comfyui_base_url=os.getenv(
                "COMFYUI_BASE_URL", "http://127.0.0.1:8188"
            ).rstrip("/"),
            workflow_path=os.getenv(
                "COMFYUI_WORKFLOW_PATH",
                "ktn_image_gateway/workflows/flux_text2img.json",
            ),
            output_dir=os.getenv(
                "KTN_IMAGE_GATEWAY_OUTPUT_DIR", "storage/ktn_image_gateway"
            ),
            default_model=os.getenv("KTN_IMAGE_MODEL", "flux"),
            default_size=os.getenv("KTN_IMAGE_SIZE", "1024x1024"),
            request_timeout_seconds=int(
                os.getenv("KTN_IMAGE_REQUEST_TIMEOUT_SECONDS", "300")
            ),
            poll_interval_seconds=float(
                os.getenv("KTN_IMAGE_POLL_INTERVAL_SECONDS", "0.5")
            ),
        )
