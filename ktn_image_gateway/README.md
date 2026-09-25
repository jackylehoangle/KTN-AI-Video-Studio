# KTN Image Gateway

Internal gateway for KTN AI Video Studio.

## Current phase

MPT-04B.1 establishes an isolated FastAPI package, configuration contract,
OpenAI-compatible request/response schemas, workflow directory, and health
smoke test.

No ComfyUI generation call is implemented in this phase.

## Planned contract

- Gateway: http://127.0.0.1:8189
- ComfyUI: http://127.0.0.1:8188
- Image endpoint (MPT-04B.2): POST /v1/images/generations
- Initial model alias: flux
- Initial response format: b64_json
