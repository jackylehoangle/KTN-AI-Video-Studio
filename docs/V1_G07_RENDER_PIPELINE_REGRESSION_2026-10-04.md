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

## Authenticated live runtime evidence - 2026-10-30

Preview deployment `dpl_7dr6MG9XKeMLJSrf2YeJmyE1CuPc` returned:

- `configured=true`
- `ready=true`
- `authenticated=true`
- `workerStatus=200`
- `baseUrlConfigured=true`
- `apiKeyConfigured=true`

The public worker OpenAPI page also loaded from the new Cloudflare tunnel. A regression fix now requires a successful HTTP response during bootstrap; authentication failures are no longer accepted as readiness.

**Decision:** authenticated worker readiness is PASS. G07 remains open only for a real assets-to-MP4 task, polling completion and playback verification.

## Real MP4/download continuation - 2026-10-31

The render pipeline advanced beyond readiness:

- Minimal 3-second render task completed at 100%.
- Product UI render completed 14/14 scene assets at 100%.
- Product task: `436cc16e-1185-4c24-8db7-5104b5f5e01b`.
- Final MP4 size: 10,747,935 bytes.
- Vercel same-origin proxy returned all bytes in six contiguous HTTP 206 ranges.
- Full regression suite passed: 1,337 passed, 19 skipped and 10,614 subtests.

The connected-browser controller timed out before it captured a final local-file
download event. Playback, decoded duration, audio/subtitle synchronization and
visual inspection were not recorded for this artifact.

**Decision:** G07 is now
`REAL_RENDER_PASS / BYTE_COMPLETE_DOWNLOAD_PASS / PLAYBACK_PENDING`.
Detailed evidence: `docs/V1_G07B_MP4_DOWNLOAD_E2E_2026-10-31.md`.
