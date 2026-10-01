"""Unit tests for MPT-04B.3 ComfyUI client and workflow loader."""

import json

from ktn_image_gateway.services.comfyui_client import (
    ComfyUIClient,
    ComfyUIImageRef,
)
from ktn_image_gateway.services.workflow_loader import WorkflowLoader


class FakeResponse:
    def __init__(self, *, body=None, content=b"", status_code=200):
        self._body = body
        self.content = content
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._body


class FakeSession:
    def __init__(self):
        self.posts = []
        self.gets = []

    def post(self, url, **kwargs):
        self.posts.append((url, kwargs))
        return FakeResponse(body={"prompt_id": "prompt-123"})

    def get(self, url, **kwargs):
        self.gets.append((url, kwargs))
        if "/history/" in url:
            return FakeResponse(
                body={
                    "prompt-123": {
                        "outputs": {
                            "9": {
                                "images": [
                                    {
                                        "filename": "ktn-output.png",
                                        "subfolder": "",
                                        "type": "output",
                                    }
                                ]
                            }
                        },
                        "status": {"completed": True},
                    }
                }
            )
        return FakeResponse(content=b"real-image-bytes")


def test_workflow_loader_replaces_gateway_tokens(tmp_path):
    path = tmp_path / "workflow.json"
    path.write_text(
        json.dumps(
            {
                "6": {"inputs": {"text": "__KTN_PROMPT__"}},
                "5": {
                    "inputs": {
                        "width": "__KTN_WIDTH__",
                        "height": "__KTN_HEIGHT__",
                    }
                },
                "3": {"inputs": {"seed": "__KTN_SEED__"}},
            }
        ),
        encoding="utf-8",
    )

    workflow = WorkflowLoader(str(path)).render(
        prompt="Vietnamese cinematic office",
        width=1024,
        height=768,
        seed=42,
    )

    assert workflow["6"]["inputs"]["text"] == "Vietnamese cinematic office"
    assert workflow["5"]["inputs"]["width"] == 1024
    assert workflow["5"]["inputs"]["height"] == 768
    assert workflow["3"]["inputs"]["seed"] == 42


def test_comfyui_client_prompt_history_view_flow():
    session = FakeSession()
    client = ComfyUIClient(
        "http://127.0.0.1:8188",
        timeout_seconds=2,
        poll_interval_seconds=0.01,
        session=session,
    )

    image = client.generate_image({"6": {"class_type": "CLIPTextEncode"}})

    assert image == b"real-image-bytes"
    assert session.posts[0][0] == "http://127.0.0.1:8188/prompt"
    assert session.gets[0][0] == "http://127.0.0.1:8188/history/prompt-123"
    assert session.gets[1][0] == "http://127.0.0.1:8188/view"
    assert session.gets[1][1]["params"] == {
        "filename": "ktn-output.png",
        "subfolder": "",
        "type": "output",
    }


def test_first_image_ref_reads_standard_history_shape():
    ref = ComfyUIClient.first_image_ref(
        {
            "outputs": {
                "node": {
                    "images": [
                        {
                            "filename": "scene.png",
                            "subfolder": "ktn",
                            "type": "output",
                        }
                    ]
                }
            }
        }
    )
    assert ref == ComfyUIImageRef(
        filename="scene.png",
        subfolder="ktn",
        folder_type="output",
    )
