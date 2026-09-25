"""Minimal synchronous client for a local ComfyUI server."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any

import requests


class ComfyUIError(RuntimeError):
    """Raised when ComfyUI cannot complete an image generation request."""


@dataclass(frozen=True)
class ComfyUIImageRef:
    filename: str
    subfolder: str = ""
    folder_type: str = "output"


class ComfyUIClient:
    """Queue a workflow, poll its history, and download the first image output."""

    def __init__(
        self,
        base_url: str,
        *,
        timeout_seconds: int = 300,
        poll_interval_seconds: float = 0.5,
        session: requests.Session | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self.session = session or requests.Session()
        self.client_id = str(uuid.uuid4())

    def queue_prompt(self, workflow: dict[str, Any]) -> str:
        try:
            response = self.session.post(
                f"{self.base_url}/prompt",
                json={"prompt": workflow, "client_id": self.client_id},
                timeout=(10, 30),
            )
            response.raise_for_status()
            body = response.json()
        except Exception as exc:
            raise ComfyUIError(f"failed to queue ComfyUI prompt: {exc}") from exc

        prompt_id = body.get("prompt_id") if isinstance(body, dict) else None
        if not isinstance(prompt_id, str) or not prompt_id:
            raise ComfyUIError("ComfyUI /prompt response did not include prompt_id")
        return prompt_id

    def wait_for_history(self, prompt_id: str) -> dict[str, Any]:
        deadline = time.monotonic() + max(self.timeout_seconds, 1)
        last_error = ""
        while time.monotonic() < deadline:
            try:
                response = self.session.get(
                    f"{self.base_url}/history/{prompt_id}",
                    timeout=(10, 30),
                )
                response.raise_for_status()
                body = response.json()
                entry = body.get(prompt_id) if isinstance(body, dict) else None
                if isinstance(entry, dict):
                    outputs = entry.get("outputs")
                    status = entry.get("status")
                    completed = (
                        isinstance(status, dict) and status.get("completed") is True
                    )
                    if outputs or completed:
                        return entry
            except Exception as exc:
                last_error = str(exc)
            time.sleep(max(self.poll_interval_seconds, 0.05))

        detail = f"; last_error={last_error}" if last_error else ""
        raise ComfyUIError(
            f"timed out waiting for ComfyUI prompt {prompt_id}{detail}"
        )

    @staticmethod
    def first_image_ref(history_entry: dict[str, Any]) -> ComfyUIImageRef:
        outputs = history_entry.get("outputs")
        if not isinstance(outputs, dict):
            raise ComfyUIError("ComfyUI history contains no outputs")

        for node_output in outputs.values():
            if not isinstance(node_output, dict):
                continue
            images = node_output.get("images")
            if not isinstance(images, list):
                continue
            for image in images:
                if not isinstance(image, dict):
                    continue
                filename = image.get("filename")
                if isinstance(filename, str) and filename:
                    return ComfyUIImageRef(
                        filename=filename,
                        subfolder=str(image.get("subfolder") or ""),
                        folder_type=str(image.get("type") or "output"),
                    )
        raise ComfyUIError("ComfyUI workflow completed without an image output")

    def download_image(self, image: ComfyUIImageRef) -> bytes:
        try:
            response = self.session.get(
                f"{self.base_url}/view",
                params={
                    "filename": image.filename,
                    "subfolder": image.subfolder,
                    "type": image.folder_type,
                },
                timeout=(10, 120),
            )
            response.raise_for_status()
        except Exception as exc:
            raise ComfyUIError(f"failed to download ComfyUI image: {exc}") from exc

        if not response.content:
            raise ComfyUIError("ComfyUI returned an empty image body")
        return response.content

    def generate_image(self, workflow: dict[str, Any]) -> bytes:
        prompt_id = self.queue_prompt(workflow)
        history = self.wait_for_history(prompt_id)
        image_ref = self.first_image_ref(history)
        return self.download_image(image_ref)
