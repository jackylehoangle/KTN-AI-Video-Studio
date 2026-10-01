"""OpenAI-compatible request/response models for image generation."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ImageGenerationRequest(BaseModel):
    model: str = "flux"
    prompt: str = Field(min_length=1)
    size: str = "1024x1024"
    n: int = Field(default=1, ge=1, le=1)
    response_format: Literal["b64_json"] = "b64_json"
    seed: int | None = Field(default=None, ge=0, le=2**63 - 1)


class ImageData(BaseModel):
    b64_json: str


class ImageGenerationResponse(BaseModel):
    created: int
    data: list[ImageData]
