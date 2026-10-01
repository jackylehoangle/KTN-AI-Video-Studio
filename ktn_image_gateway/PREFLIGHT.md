# MPT-04B.4A — Local ComfyUI + FLUX runtime preflight

Run from the repository root:

```bash
python -m ktn_image_gateway.preflight
```

Optional but recommended environment variable:

```text
COMFYUI_ROOT=<path to the local ComfyUI folder>
```

The preflight is read-only. It does not install models, modify ComfyUI, or
download files.

## Decision rules

- **FAIL**: at least one blocking prerequisite is missing.
- **PASS_WITH_WARNINGS**: the critical runtime is present, but the machine has
  an operational concern such as no detected GPU acceleration.
- **PASS**: all checked prerequisites are present.

## KTN baseline model

The initial local model is **FLUX.1-schnell**, not FLUX.1-dev.

Reasons:
- schnell is suitable for a fast first text-to-image baseline.
- its upstream model page declares Apache-2.0.
- FLUX.1-dev is not the default for KTN because its upstream license is
  non-commercial.

The gateway alias remains `model="flux"`; the actual local model/workflow is
owned by ComfyUI and can be replaced later without changing the public gateway
contract.

## KTN operational thresholds

These are KTN deployment recommendations, not claims of upstream hard minimums:

- Python >= 3.11
- 64-bit OS
- >=16 GB system RAM; >=32 GB preferred when relying on CPU offload
- >=40 GB free disk for the initial model, encoders, caches, and outputs
- GPU acceleration strongly preferred for routine production
