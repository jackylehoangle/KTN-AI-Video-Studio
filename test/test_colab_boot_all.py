from colab import boot_all


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
