"""Deterministic tests for MPT-04B.4A preflight helpers."""

from pathlib import Path

from ktn_image_gateway import preflight


def test_find_flux_model_in_supported_comfyui_directories(tmp_path: Path):
    model_dir = tmp_path / "models" / "diffusion_models"
    model_dir.mkdir(parents=True)
    model = model_dir / "flux1-schnell-fp8.safetensors"
    model.write_bytes(b"test")

    matches = preflight._find_flux_models(tmp_path)

    assert str(model) in matches


def test_find_flux_model_requires_schnell_name(tmp_path: Path):
    model_dir = tmp_path / "models" / "checkpoints"
    model_dir.mkdir(parents=True)
    (model_dir / "flux1-dev.safetensors").write_bytes(b"test")

    assert preflight._find_flux_models(tmp_path) == []


def test_preflight_marks_missing_comfyui_and_workflow_as_blockers(monkeypatch, tmp_path):
    monkeypatch.setenv("COMFYUI_BASE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("COMFYUI_WORKFLOW_PATH", str(tmp_path / "missing.json"))
    monkeypatch.setenv("COMFYUI_ROOT", str(tmp_path / "ComfyUI"))
    monkeypatch.setattr(
        preflight,
        "_detect_accelerator",
        lambda: ("WARN", "no accelerator"),
    )
    monkeypatch.setattr(preflight, "_total_ram_gb", lambda: 32.0)
    monkeypatch.setattr(
        preflight,
        "_comfyui_health",
        lambda base_url: ("FAIL", f"not reachable: {base_url}"),
    )

    result = preflight.run_preflight()

    assert result["overall"] == "FAIL"
    assert "comfyui" in result["blockers"]
    assert "workflow" in result["blockers"]
    assert "flux_model" in result["blockers"]
