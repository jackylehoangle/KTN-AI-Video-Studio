"""Load an exported ComfyUI API workflow and inject request values."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


PROMPT_TOKEN = "__KTN_PROMPT__"
WIDTH_TOKEN = "__KTN_WIDTH__"
HEIGHT_TOKEN = "__KTN_HEIGHT__"
SEED_TOKEN = "__KTN_SEED__"


class WorkflowTemplateError(ValueError):
    """Raised when the workflow template cannot satisfy the KTN contract."""


class WorkflowLoader:
    """Render a ComfyUI API-format JSON workflow from a tokenized template."""

    def __init__(self, path: str):
        self.path = Path(path)

    def load(self) -> dict[str, Any]:
        if not self.path.is_file():
            raise FileNotFoundError(
                f"ComfyUI workflow template not found: {self.path}"
            )
        with self.path.open("r", encoding="utf-8") as handle:
            workflow = json.load(handle)
        if not isinstance(workflow, dict) or not workflow:
            raise WorkflowTemplateError("ComfyUI workflow must be a non-empty JSON object")
        return workflow

    def render(
        self,
        *,
        prompt: str,
        width: int,
        height: int,
        seed: int,
    ) -> dict[str, Any]:
        workflow = deepcopy(self.load())
        replacements: dict[str, Any] = {
            PROMPT_TOKEN: prompt,
            WIDTH_TOKEN: width,
            HEIGHT_TOKEN: height,
            SEED_TOKEN: seed,
        }
        counts = {token: 0 for token in replacements}

        def replace(value: Any) -> Any:
            if isinstance(value, dict):
                return {key: replace(item) for key, item in value.items()}
            if isinstance(value, list):
                return [replace(item) for item in value]
            if isinstance(value, str) and value in replacements:
                counts[value] += 1
                return replacements[value]
            return value

        rendered = replace(workflow)
        if counts[PROMPT_TOKEN] == 0:
            raise WorkflowTemplateError(
                f"workflow template must contain {PROMPT_TOKEN}"
            )
        return rendered
