"""Foundation and HTTP-contract tests for MPT-04B.1 / MPT-04B.2."""

from fastapi.testclient import TestClient

from ktn_image_gateway.config import GatewaySettings
from ktn_image_gateway.main import app
from ktn_image_gateway.schemas import (
    ImageData,
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from ktn_image_gateway.services import image_backend


def test_gateway_defaults_are_isolated_and_local():
    settings = GatewaySettings()
    assert settings.port == 8189
    assert settings.comfyui_base_url == "http://127.0.0.1:8188"
    assert settings.default_model == "flux"


def test_openai_image_request_contract_is_minimal():
    request = ImageGenerationRequest(prompt="cinematic Vietnamese workspace")
    assert request.model == "flux"
    assert request.n == 1
    assert request.response_format == "b64_json"


def test_gateway_health_smoke():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "ktn-image-gateway"


def test_image_generation_endpoint_reports_backend_not_connected():
    response = TestClient(app).post(
        "/v1/images/generations",
        json={"model": "flux", "prompt": "cinematic Vietnamese workspace"},
    )
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "comfyui_backend_not_connected"
    assert body["error"]["type"] == "service_unavailable"


def test_image_generation_endpoint_rejects_invalid_contract():
    client = TestClient(app)

    missing_prompt = client.post("/v1/images/generations", json={"model": "flux"})
    assert missing_prompt.status_code == 422

    too_many = client.post(
        "/v1/images/generations",
        json={"prompt": "scene", "n": 2},
    )
    assert too_many.status_code == 422

    unsupported_format = client.post(
        "/v1/images/generations",
        json={"prompt": "scene", "response_format": "url"},
    )
    assert unsupported_format.status_code == 422


def test_image_generation_endpoint_happy_path(monkeypatch):
    def fake_generate(request: ImageGenerationRequest) -> ImageGenerationResponse:
        assert request.prompt == "scene prompt"
        return ImageGenerationResponse(
            created=1720000000,
            data=[ImageData(b64_json="ZmFrZS1pbWFnZS1ieXRlcw==")],
        )

    monkeypatch.setattr(image_backend, "generate_image", fake_generate)

    response = TestClient(app).post(
        "/v1/images/generations",
        json={
            "model": "flux",
            "prompt": "scene prompt",
            "size": "1024x1024",
            "n": 1,
            "response_format": "b64_json",
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "created": 1720000000,
        "data": [{"b64_json": "ZmFrZS1pbWFnZS1ieXRlcw=="}],
    }


def test_openapi_exposes_images_generations_route():
    schema = TestClient(app).get("/openapi.json").json()
    assert "/v1/images/generations" in schema["paths"]
    assert "post" in schema["paths"]["/v1/images/generations"]
