"""Local runtime preflight for ComfyUI + FLUX.

Run:
    python -m ktn_image_gateway.preflight

The command does not install or download anything. It inspects the host and
prints deterministic PASS/WARN/FAIL checks so MPT-04B.4A can be accepted
without guessing about the machine.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import requests

from ktn_image_gateway.config import GatewaySettings


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: str
    detail: str
    blocking: bool = False


def _run(command: list[str], timeout: int = 10) -> str:
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if completed.returncode != 0:
        return ""
    return completed.stdout.strip()


def _total_ram_gb() -> float | None:
    try:
        if sys.platform == "win32":
            raw = _run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
                ]
            )
            return int(raw) / (1024**3) if raw else None
        if sys.platform == "darwin":
            raw = _run(["sysctl", "-n", "hw.memsize"])
            return int(raw) / (1024**3) if raw else None

        pages = os.sysconf("SC_PHYS_PAGES")
        page_size = os.sysconf("SC_PAGE_SIZE")
        return (pages * page_size) / (1024**3)
    except Exception:
        return None


def _detect_accelerator() -> tuple[str, str]:
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        output = _run(
            [
                nvidia_smi,
                "--query-gpu=name,memory.total",
                "--format=csv,noheader,nounits",
            ]
        )
        if output:
            first = output.splitlines()[0].strip()
            return "PASS", f"NVIDIA CUDA GPU detected: {first} MiB VRAM"

    try:
        import torch

        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            vram_mib = int(props.total_memory / (1024**2))
            return "PASS", f"PyTorch CUDA detected: {props.name}, {vram_mib} MiB VRAM"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "PASS", "Apple Metal (MPS) acceleration detected"
    except Exception:
        pass

    if sys.platform == "win32":
        output = _run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_VideoController | "
                "Select-Object -ExpandProperty Name",
            ]
        )
        if output:
            return (
                "WARN",
                "No CUDA accelerator detected. Video adapter(s): "
                + "; ".join(line.strip() for line in output.splitlines() if line.strip()),
            )

    return (
        "WARN",
        "No supported GPU accelerator was detected. CPU fallback may work but is "
        "not considered practical for regular FLUX production.",
    )


def _comfyui_health(base_url: str) -> tuple[str, str]:
    session = requests.Session()
    errors: list[str] = []
    for path in ("/system_stats", "/"):
        try:
            response = session.get(f"{base_url}{path}", timeout=(2, 5))
            if response.status_code < 500:
                return "PASS", f"ComfyUI reachable at {base_url}{path} (HTTP {response.status_code})"
            errors.append(f"{path}: HTTP {response.status_code}")
        except Exception as exc:
            errors.append(f"{path}: {type(exc).__name__}")
    return "FAIL", f"ComfyUI not reachable at {base_url}; " + ", ".join(errors)


def _find_flux_models(comfyui_root: Path | None) -> list[str]:
    if comfyui_root is None or not comfyui_root.is_dir():
        return []
    roots = [
        comfyui_root / "models" / "diffusion_models",
        comfyui_root / "models" / "unet",
        comfyui_root / "models" / "checkpoints",
    ]
    matches: list[str] = []
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            name = path.name.lower()
            if "flux" in name and "schnell" in name:
                matches.append(str(path))
    return matches[:20]


def run_preflight() -> dict[str, Any]:
    settings = GatewaySettings.from_env()
    checks: list[CheckResult] = []

    python_ok = sys.version_info >= (3, 11)
    checks.append(
        CheckResult(
            "python",
            "PASS" if python_ok else "FAIL",
            f"Python {platform.python_version()} (requires >= 3.11 for this project)",
            blocking=not python_ok,
        )
    )

    is_64bit = platform.architecture()[0] == "64bit"
    checks.append(
        CheckResult(
            "architecture",
            "PASS" if is_64bit else "FAIL",
            f"{platform.system()} {platform.release()} / {platform.machine()} / "
            f"{platform.architecture()[0]}",
            blocking=not is_64bit,
        )
    )

    ram_gb = _total_ram_gb()
    if ram_gb is None:
        checks.append(CheckResult("system_ram", "WARN", "Unable to detect system RAM"))
    else:
        # KTN operational threshold, not an upstream hard requirement.
        status = "PASS" if ram_gb >= 16 else "WARN"
        checks.append(
            CheckResult(
                "system_ram",
                status,
                f"{ram_gb:.1f} GB RAM detected; KTN recommends >=16 GB and prefers "
                ">=32 GB when heavy CPU offload is required",
            )
        )

    free_gb = shutil.disk_usage(Path.cwd()).free / (1024**3)
    # FLUX.1-schnell BF16 alone is ~23.8 GB; leave headroom for encoders,
    # ComfyUI, cache, generated assets and temporary files.
    disk_ok = free_gb >= 40
    checks.append(
        CheckResult(
            "free_disk",
            "PASS" if disk_ok else "WARN",
            f"{free_gb:.1f} GB free on current drive; KTN recommends >=40 GB free "
            "for the initial FLUX.1-schnell setup",
        )
    )

    accelerator_status, accelerator_detail = _detect_accelerator()
    checks.append(
        CheckResult(
            "accelerator",
            accelerator_status,
            accelerator_detail,
            blocking=False,
        )
    )

    comfy_status, comfy_detail = _comfyui_health(settings.comfyui_base_url)
    checks.append(
        CheckResult(
            "comfyui",
            comfy_status,
            comfy_detail,
            blocking=comfy_status == "FAIL",
        )
    )

    workflow_path = Path(settings.workflow_path)
    workflow_ok = workflow_path.is_file()
    checks.append(
        CheckResult(
            "workflow",
            "PASS" if workflow_ok else "FAIL",
            (
                f"Workflow found: {workflow_path}"
                if workflow_ok
                else f"Missing workflow: {workflow_path}"
            ),
            blocking=not workflow_ok,
        )
    )

    comfyui_root_text = os.getenv("COMFYUI_ROOT", "").strip()
    comfyui_root = Path(comfyui_root_text) if comfyui_root_text else None
    flux_models = _find_flux_models(comfyui_root)
    if not comfyui_root_text:
        checks.append(
            CheckResult(
                "flux_model",
                "WARN",
                "COMFYUI_ROOT is not set, so the preflight cannot verify whether "
                "FLUX.1-schnell is installed",
            )
        )
    elif flux_models:
        checks.append(
            CheckResult(
                "flux_model",
                "PASS",
                "Detected FLUX schnell model file(s): " + "; ".join(flux_models),
            )
        )
    else:
        checks.append(
            CheckResult(
                "flux_model",
                "FAIL",
                f"No FLUX schnell model file detected under {comfyui_root}",
                blocking=True,
            )
        )

    blockers = [check.name for check in checks if check.blocking and check.status == "FAIL"]
    warnings = [check.name for check in checks if check.status == "WARN"]

    if blockers:
        overall = "FAIL"
    elif warnings:
        overall = "PASS_WITH_WARNINGS"
    else:
        overall = "PASS"

    return {
        "phase": "MPT-04B.4A",
        "overall": overall,
        "flux_baseline": "FLUX.1-schnell",
        "checks": [asdict(check) for check in checks],
        "blockers": blockers,
        "warnings": warnings,
    }


def main() -> int:
    result = run_preflight()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if result["overall"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
