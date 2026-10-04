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
