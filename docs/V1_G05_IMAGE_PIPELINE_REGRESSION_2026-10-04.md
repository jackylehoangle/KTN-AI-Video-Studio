# V1-G05 — IMAGE PIPELINE REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **TECH PASS / RUNTIME-PROVIDER BLOCKED**

PASS:
- Gemini Image provider contract.
- OpenAI Image provider contract.
- KTN FLUX gateway contract.
- 16:9 / 9:16 / 1:1 aspect routing.
- Scene image generation uses current project/render aspect.
- Generated image stores provider/model/MIME/aspect.
- Image persistence verification.
- KTN Image readiness uses live health status.
- Offline KTN Image is not shown as READY.
- API syntax PASS.

Real tests on 2026-10-04:
- Gemini Image 16:9 self-test: BLOCKED — Free Tier 0 input tokens/minute.
- Gemini Image 9:16 self-test: BLOCKED — Free Tier 0 input tokens/minute.
- KTN FLUX: configured + token configured, but runtime `ready=false`.
- OpenAI Image: not configured.

**Decision:** image code/contract PASS; V1-G05 cannot close until at least one real image provider produces/regenerates images successfully E2E.


## Live recheck - 2026-10-30

Endpoint:
`GET /api/generate-image?selftest=gemini&aspect=16:9`

Observed:
- `ok=false`
- provider: `gemini`
- model: `gemini-3.1-flash-image`
- Free Tier limit: `0 requests per day`

**Decision:** G05 remains `BLOCKED_PROVIDER_RUNTIME`. A configured key is not a usable image runtime.
