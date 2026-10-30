from colab import boot_all


class FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code

    @property
    def ok(self):
        return 200 <= self.status_code < 400


def test_patch_render_config_enables_authenticated_worker(tmp_path, monkeypatch):
    (tmp_path / "config.example.toml").write_text(
        'listen_port = 8080\n\n[app]\napi_key = ""\nedge_tts_timeout = 60\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(boot_all, "REPO", tmp_path)

    boot_all.patch_render_config("render-secret")

    config = (tmp_path / "config.toml").read_text(encoding="utf-8")
    assert "listen_port = 8090" in config
    assert 'api_key = "render-secret"' in config
    assert "edge_tts_timeout = 240" in config


def test_render_api_key_reuses_configured_environment(monkeypatch):
    monkeypatch.setenv("MPT_RENDER_API_KEY", "existing-render-secret")

    assert boot_all.render_api_key() == "existing-render-secret"


def test_wait_http_does_not_accept_auth_failure(monkeypatch):
    responses = iter([FakeResponse(401), FakeResponse(200)])
    monkeypatch.setattr(boot_all.requests, "get", lambda *args, **kwargs: next(responses))
    monkeypatch.setattr(boot_all.time, "sleep", lambda _seconds: None)

    response = boot_all.wait_http(
        "https://render.example/api/v1/tasks",
        seconds=2,
        headers={"x-api-key": "test-key"},
    )

    assert response.status_code == 200
