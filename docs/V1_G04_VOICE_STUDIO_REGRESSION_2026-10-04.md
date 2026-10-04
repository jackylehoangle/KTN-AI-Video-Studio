# V1-G04 — VOICE STUDIO TECHNICAL REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **TECH + REAL TTS + OWNER BATCH PASS / CLONE CONSENT AUDIO PENDING**

PASS:
- Gemini + ElevenLabs provider architecture.
- Voice Library GET live endpoint.
- Gemini Voice Library currently returns live provider catalog.
- Provider switching UI.
- Voice Profile: provider / voice / style / speed / direction.
- Clone modal.
- Explicit ownership/consent confirmation.
- Gemini clone API contract with reference + consent audio.
- ElevenLabs clone API contract.
- Live batch progress percentage.
- Queue states.
- Pause / Resume / Retry failed / Cancel controls.
- Per-scene technical Audio QA.
- Manual audio approval.
- Voice provider/profile and audio QA persist with Project.
- JS/API syntax PASS.
- Owner/browser batch acceptance:
  - live progress percentage;
  - Pause / Resume;
  - Cancel preserving completed audio;
  - Retry failed scene;
  - Scene Audio QA manual approval;
  - Project reload persistence.

Current runtime limitations:
- ElevenLabs API key is not configured.
- Real clone requires owner-approved reference audio + consent.

Evidence:
- `docs/V1_G04B_OWNER_VOICE_BATCH_ACCEPTANCE_2026-10-04.md`

**Decision:** technical implementation and owner/browser batch acceptance PASS; clone acceptance remains pending until consent/reference audio is supplied.
