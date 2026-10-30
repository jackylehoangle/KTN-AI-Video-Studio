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

## Recovery implementation - 2026-10-30

Commit `71af1ad6ce509cca9f6a51d96277351231553725` corrects `COLAB-BOOT-02` to clone `release/v1-rc1` and restore the FLUX gateway from the canonical RC. Vercel deployment is READY. G05 remains blocked until the notebook is actually run on a Colab GPU and one real image generation/regeneration passes.

## Live FLUX runtime evidence - 2026-10-30

- `COLAB-BOOT-02` completed on a T4 in 5.5 minutes.
- FLUX.1-schnell FP8 model loaded at 16.05 GB.
- ComfyUI, KTN Image Gateway and the public image tunnel reported ready.
- Direct smoke generation returned `HTTP 200` twice and displayed the generated images in Colab.
- The Vercel Preview image route is configured against the same live gateway.

The first smoke attempt exposed an obsolete notebook-cell dependency on `public_url/token`; the corrected cell now reads `/content/ktn_colab_runtime.json`. Bootstrap readiness was also tightened so `401/403` cannot be mistaken for success.

**Decision:** the real KTN FLUX provider runtime is proven. G05 is now `RUNTIME_PASS_APP_E2E_PENDING`; closure still requires generate/regenerate through the application UI with project persistence evidence.
