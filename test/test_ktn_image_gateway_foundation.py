"""Foundation tests for MPT-04B.1."""

from fastapi.testclient import TestClient

from ktn_image_gateway.config import GatewaySettings
from ktn_image_gateway.main import app
from ktn_image_gateway.schemas import ImageGenerationRequest


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
