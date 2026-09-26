"""One-click Colab bootstrap for KTN AI Video Studio development workers.

Restores after a fresh Colab runtime:
- ComfyUI + FLUX.1-schnell FP8 image engine
- KTN Image Gateway
- MoneyPrinterTurbo render worker on Python 3.11
- Cloudflare Quick Tunnels for image + render APIs

This script is intended for temporary Colab acceptance testing. Production should
use stable GPU infrastructure and named/authenticated tunnels or direct HTTPS.
"""

from __future__ import annotations

import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

REPO = Path("/content/KTN-AI-Video-Studio")
COMFY = Path("/content/ComfyUI")
MODEL = COMFY / "models/checkpoints/flux1-schnell-fp8.safetensors"
MODEL_URL = (
    "https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/"
    "flux1-schnell-fp8.safetensors"
)
CLOUDFLARED = Path("/usr/local/bin/cloudflared")
RENDER_ENV = Path("/content/mpt-render-uv311")
IMAGE_PORT = 8189
COMFY_PORT = 8188
RENDER_PORT = 8090


def run(cmd, *, cwd=None, env=None, quiet=False, check=True):
    stdout = subprocess.DEVNULL if quiet else None
    stderr = subprocess.STDOUT if quiet else None
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        env=env,
        stdout=stdout,
        stderr=stderr,
        check=check,
        text=True,
    )


def wait_http(url: str, *, seconds: int, headers=None) -> requests.Response:
    last_error = None
    for _ in range(seconds):
        try:
            response = requests.get(url, headers=headers or {}, timeout=5)
            if response.status_code < 500:
                return response
        except Exception as exc:
            last_error = exc
        time.sleep(1)
    raise RuntimeError(f"Timeout waiting for {url}. Last error: {last_error}")


def kill(pattern: str) -> None:
    subprocess.run(["pkill", "-f", pattern], check=False)


def ensure_gpu() -> None:
    print("\n[1/9] GPU")
    result = subprocess.run(["nvidia-smi"], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            "Colab chưa có NVIDIA GPU. Vào Runtime → Change runtime type → chọn GPU rồi Run lại cell."
        )
    first = result.stdout.splitlines()[0] if result.stdout else "NVIDIA GPU detected"
    print("✅", first)


def ensure_repo() -> None:
    print("\n[2/9] KTN repository")
    if not REPO.exists():
        raise RuntimeError(
            f"Không thấy repo tại {REPO}. Cell bootstrap phải clone repo trước khi chạy script này."
        )
    run(["git", "-C", str(REPO), "checkout", "ui-vn-01-vietnamese-baseline"], quiet=True)
    run(
        [
            "git",
            "-C",
            str(REPO),
            "pull",
            "--ff-only",
            "origin",
            "ui-vn-01-vietnamese-baseline",
        ],
        quiet=True,
    )
    print("✅ Repository ready")


def ensure_base_tools() -> None:
    print("\n[3/9] Base tools")
    if not shutil.which("ffmpeg"):
        run(["apt-get", "update", "-qq"], quiet=True)
        run(["apt-get", "install", "-y", "-qq", "ffmpeg"], quiet=True)
    if not CLOUDFLARED.exists():
        run(
            [
                "wget",
                "-q",
                "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
                "-O",
                str(CLOUDFLARED),
            ]
        )
        os.chmod(CLOUDFLARED, 0o755)
    print("✅ FFmpeg + cloudflared ready")


def ensure_comfy() -> None:
    print("\n[4/9] ComfyUI + dependencies")
    if not COMFY.exists():
        run(
            [
                "git",
                "clone",
                "-q",
                "https://github.com/Comfy-Org/ComfyUI.git",
                str(COMFY),
            ]
        )
    else:
        run(
            ["git", "-C", str(COMFY), "pull", "--ff-only"],
            quiet=True,
            check=False,
        )

    run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-q",
            "-r",
            str(COMFY / "requirements.txt"),
        ]
    )
    run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-q",
            "fastapi==0.136.3",
            "uvicorn==0.32.1",
            "requests==2.33.1",
            "pydantic",
            "pillow",
        ]
    )
    print("✅ ComfyUI dependencies ready")


def ensure_model() -> None:
    print("\n[5/9] FLUX.1-schnell FP8 model")
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    if not MODEL.exists() or MODEL.stat().st_size < 10 * 1024**3:
        print("⏳ Downloading ~16 GB model. This is required again after a full Colab reset.")
        run(["wget", "-c", MODEL_URL, "-O", str(MODEL)])
    print(f"✅ Model ready: {MODEL.stat().st_size / 1024**3:.2f} GB")


def gateway_token() -> str:
    token = os.environ.get("KTN_IMAGE_GATEWAY_TOKEN", "").strip()
    if token:
        return token
    try:
        from google.colab import userdata

        token = str(userdata.get("KTN_IMAGE_GATEWAY_TOKEN") or "").strip()
    except Exception:
        token = ""
    return token or secrets.token_urlsafe(32)


def start_image_engine(token: str) -> None:
    print("\n[6/9] Image Engine")
    kill("main.py --listen 127.0.0.1 --port 8188")
    kill("uvicorn ktn_image_gateway.main:app")
    time.sleep(1)

    os.environ["COMFYUI_BASE_URL"] = f"http://127.0.0.1:{COMFY_PORT}"
    os.environ["COMFYUI_WORKFLOW_PATH"] = str(
        REPO / "ktn_image_gateway/workflows/flux_schnell_api.json"
    )
    os.environ["KTN_IMAGE_GATEWAY_TOKEN"] = token

    comfy_log = open("/content/comfyui.log", "w", encoding="utf-8")
    subprocess.Popen(
        [
            sys.executable,
            "main.py",
            "--listen",
            "127.0.0.1",
            "--port",
            str(COMFY_PORT),
            "--lowvram",
        ],
        cwd=str(COMFY),
        stdout=comfy_log,
        stderr=subprocess.STDOUT,
    )
    wait_http(f"http://127.0.0.1:{COMFY_PORT}/system_stats", seconds=180)
    print("✅ ComfyUI ready")

    gateway_log = open("/content/ktn_gateway.log", "w", encoding="utf-8")
    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "ktn_image_gateway.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(IMAGE_PORT),
        ],
        cwd=str(REPO),
        stdout=gateway_log,
        stderr=subprocess.STDOUT,
    )
    wait_http(f"http://127.0.0.1:{IMAGE_PORT}/health", seconds=90)
    print("✅ KTN Image Gateway ready")


def ensure_uv() -> str:
    uv = shutil.which("uv")
    if uv:
        return uv
    subprocess.run(
        "curl -LsSf https://astral.sh/uv/install.sh | sh",
        shell=True,
        check=True,
    )
    for candidate in (
        "/root/.local/bin/uv",
        "/root/.cargo/bin/uv",
        "/usr/local/bin/uv",
    ):
        if os.path.exists(candidate):
            return candidate
    raise RuntimeError("Không tìm thấy uv sau khi cài.")


def patch_render_config() -> None:
    example = REPO / "config.example.toml"
    config = REPO / "config.toml"
    shutil.copyfile(example, config)
    text = config.read_text(encoding="utf-8")
    text = re.sub(
        r"(?m)^listen_port\s*=\s*\d+\s*$",
        f"listen_port = {RENDER_PORT}",
        text,
        count=1,
    )
    text = re.sub(
        r"(?m)^edge_tts_timeout\s*=\s*[0-9.]+\s*$",
        "edge_tts_timeout = 240",
        text,
        count=1,
    )
    config.write_text(text, encoding="utf-8")


def start_render_worker() -> None:
    print("\n[7/9] MoneyPrinterTurbo Render Worker")
    uv = ensure_uv()
    run([uv, "python", "install", "3.11"], quiet=True)

    python_bin = RENDER_ENV / "bin/python"
    if not python_bin.exists():
        shutil.rmtree(RENDER_ENV, ignore_errors=True)
        run([uv, "venv", str(RENDER_ENV), "--python", "3.11"], quiet=True)

    sync_env = os.environ.copy()
    sync_env["UV_PROJECT_ENVIRONMENT"] = str(RENDER_ENV)
    run(
        [
            uv,
            "sync",
            "--project",
            str(REPO),
            "--frozen",
            "--no-dev",
            "--python",
            str(python_bin),
        ],
        env=sync_env,
        quiet=True,
    )

    patch_render_config()
    kill("/content/mpt-render-uv311/bin/python.*main.py")
    time.sleep(1)

    render_log = open("/content/mpt_render_worker.log", "w", encoding="utf-8")
    subprocess.Popen(
        [str(python_bin), "main.py"],
        cwd=str(REPO),
        stdout=render_log,
        stderr=subprocess.STDOUT,
    )
    wait_http(f"http://127.0.0.1:{RENDER_PORT}/docs", seconds=120)
    print("✅ MPT Render Worker ready on port", RENDER_PORT)


def quick_tunnel(local_url: str, log_path: str) -> tuple[subprocess.Popen, str]:
    log_handle = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [
            str(CLOUDFLARED),
            "tunnel",
            "--url",
            local_url,
            "--no-autoupdate",
        ],
        stdout=log_handle,
        stderr=subprocess.STDOUT,
    )
    deadline = time.time() + 120
    pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    while time.time() < deadline:
        time.sleep(1)
        try:
            content = Path(log_path).read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            content = ""
        match = pattern.search(content)
        if match:
            return proc, match.group(0)
    raise RuntimeError(f"Không lấy được Cloudflare URL. Xem {log_path}")


def start_tunnels() -> tuple[str, str]:
    print("\n[8/9] Cloudflare Quick Tunnels")
    kill("cloudflared.*127.0.0.1:8189")
    kill("cloudflared.*127.0.0.1:8090")
    time.sleep(1)

    _image_proc, image_url = quick_tunnel(
        f"http://127.0.0.1:{IMAGE_PORT}",
        "/content/ktn_image_tunnel.log",
    )
    _render_proc, render_url = quick_tunnel(
        f"http://127.0.0.1:{RENDER_PORT}",
        "/content/mpt_render_tunnel.log",
    )

    wait_http(image_url + "/health", seconds=60)
    wait_http(render_url + "/docs", seconds=60)
    print("✅ Image tunnel:", image_url)
    print("✅ Render tunnel:", render_url)
    return image_url, render_url


def save_state(image_url: str, render_url: str, token: str) -> None:
    import json

    state = {
        "image_gateway_url": image_url,
        "render_base_url": render_url,
        "image_gateway_token": token,
        "comfyui": f"http://127.0.0.1:{COMFY_PORT}",
        "image_gateway": f"http://127.0.0.1:{IMAGE_PORT}",
        "render_worker": f"http://127.0.0.1:{RENDER_PORT}",
        "edge_tts_timeout": 240,
    }
    Path("/content/ktn_colab_runtime.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    started = time.time()
    print("=" * 78)
    print("KTN AI VIDEO STUDIO — COLAB ONE-CLICK RESTORE")
    print("=" * 78)

    ensure_gpu()
    ensure_repo()
    ensure_base_tools()
    ensure_comfy()
    ensure_model()
    token = gateway_token()
    start_image_engine(token)
    start_render_worker()
    image_url, render_url = start_tunnels()
    save_state(image_url, render_url, token)

    print("\n[9/9] READY")
    print("=" * 78)
    print("✅ KTN COLAB STACK READY")
    print("=" * 78)
    print(f"Elapsed: {(time.time() - started) / 60:.1f} minutes")
    print()
    print("COPY / UPDATE THESE VERCEL PREVIEW VARIABLES:")
    print("KTN_IMAGE_GATEWAY_URL=" + image_url)
    print("KTN_IMAGE_GATEWAY_TOKEN=" + token)
    print("MPT_RENDER_BASE_URL=" + render_url)
    print("MPT_RENDER_API_KEY=")
    print()
    print("Local services:")
    print(f"  ComfyUI            http://127.0.0.1:{COMFY_PORT}")
    print(f"  KTN Image Gateway  http://127.0.0.1:{IMAGE_PORT}")
    print(f"  MPT Render Worker  http://127.0.0.1:{RENDER_PORT}")
    print()
    print("Runtime state: /content/ktn_colab_runtime.json")
    print("Logs:")
    print("  /content/comfyui.log")
    print("  /content/ktn_gateway.log")
    print("  /content/mpt_render_worker.log")
    print("  /content/ktn_image_tunnel.log")
    print("  /content/mpt_render_tunnel.log")
    print("=" * 78)


if __name__ == "__main__":
    main()
