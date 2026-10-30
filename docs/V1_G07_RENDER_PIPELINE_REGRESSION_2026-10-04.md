# V1-G07 — RENDER PIPELINE REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **TECH PASS / RUNTIME BLOCKED**

PASS:
- Material staging API.
- 20 MB image staging guard.
- Render manifest validation.
- Per-scene local material contract.
- Aspect propagation.
- Transition propagation.
- Voice provider/voice/speed propagation.
- Subtitle SRT propagation.
- Render task creation contract.
- Render task polling.
- Failed/processing/complete states.
- Active task ID persisted to resume polling after reload.
- Final MP4 URL handling.
- API syntax PASS.

Security hardening:
- Render Worker now requires BOTH `MPT_RENDER_BASE_URL` and `MPT_RENDER_API_KEY`.
- Health/readiness does not return READY with URL only.
- Material staging refuses unauthenticated worker use.
- Render task operations refuse unauthenticated worker use.

Live Preview result:
- `baseUrlConfigured=true`
- `apiKeyConfigured=false`
- `configured=false`
- `ready=false`

Current blocker:
- MPT Render API key not configured.
- Render worker is not production READY.

**Decision:** technical contract PASS; gate closes only after authenticated worker is live and one real Brief→assets→MP4 playback E2E passes.


## Live recheck - 2026-10-30

Endpoint:
`GET /api/render-video`

Observed:
- `baseUrlConfigured=true`
- `apiKeyConfigured=false`
- `configured=false`
- `ready=false`

**Decision:** G07 remains `BLOCKED_RUNTIME`. The worker cannot be authenticated or declared ready until `MPT_RENDER_API_KEY` is configured and the live readiness probe passes.

## Recovery implementation - 2026-10-30

Commit `71af1ad6ce509cca9f6a51d96277351231553725` updates `COLAB-BOOT-02` to generate/reuse `MPT_RENDER_API_KEY`, write it to worker `config.toml`, and print it with the Vercel variables. The Vercel readiness route now probes authenticated `/api/v1/tasks` rather than public `/docs`. Focused tests passed 7/7 and the preview deployment is READY. G07 remains blocked until Colab is running and the live authenticated probe returns READY.
