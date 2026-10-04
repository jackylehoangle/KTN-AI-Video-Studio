# KTN AI VIDEO STUDIO V1 RC1 — GATE STATUS

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**PR:** #13 — V1 RC1 — consolidated AI Video Studio release candidate  
**Status:** ACTIVE / DO NOT MERGE

## Current gate matrix

| Gate | Scope | Status | Evidence |
|---|---|---|---|
| V1-G01 | Consolidate current product work into one RC | PASS | `release/v1-rc1` + Draft PR #13 |
| V1-G02 | Real Vietnamese Long + Short multi-pass Script Quality | BLOCKED_PROVIDER | Gemini script daily/free-tier limits; no final Short/Long acceptance yet |
| V1-G03 | Scene Quality | PASS | Owner/browser acceptance passed: Board/List/Edit/Split/Merge/Reorder/Lock/QA + Long 16:9 / Short 9:16 |
| V1-G04 | Voice Studio | TECH + REAL TTS + OWNER BATCH PASS / CLONE CONSENT AUDIO PENDING | G04B owner/browser batch acceptance passed on RC preview |
| V1-G05 | Image generation E2E | BLOCKED_PROVIDER | Gemini Image Free Tier reports 0 input tokens/min; KTN FLUX runtime offline; OpenAI image not configured |
| V1-G06 | Subtitle workflow | TECH PASS / FINAL MP4 VERIFICATION DEFERRED TO G07 | Editable/validated SRT is forwarded exactly to render worker |
| V1-G07 | Render Worker → final MP4 | BLOCKED_RUNTIME | Render configured but live probe `ready=false`; API key not configured |
| V1-G08 | Project save/restore/export/import | TECH PASS / BROWSER E2E PENDING | Full content fingerprint + read-back verification + import validation |
| V1-G09 | Provider/readiness/error-state | TECH PASS | Configured and live-ready states separated; image/render use live readiness |
| V1-G10 | Golden Brief → MP4 | PENDING | Depends on G02/G05/G07 |
| V1-G11 | Owner acceptance + RC freeze | PENDING | Requires owner visual/function acceptance |
| V1-G12 | Merge `main` + production smoke | PENDING | PR #13 remains Draft |

## V1-G03B owner/browser acceptance

Preview:
`https://ktn-ai-video-studio-ntppjsm2p-jackylehoangles-projects.vercel.app/`

Result:
**PASS**

Verified in browser:
- Project JSON import path returned `PASS · Đã nhập, lưu và xác minh dự án`.
- Board/List switching preserved scene state.
- `Duyệt cảnh` prevents false-green and moves reviewed scenes to disabled `Đã duyệt`.
- Scene Editor save works and can bring a valid scene to `QA 100%`.
- Reorder marks continuity review required and drops summary back to `QA 0/2`.
- Lock toggles between `Khóa AI` and `Mở khóa AI`.
- Split creates review-required child scenes and changes count to `3 cảnh`.
- Merge returns count to `2 cảnh` and keeps review required.
- Final reviewed state reached `QA 2/2`.
- YouTube Long uses `16:9` / `scene-aspect-16-9`.
- YouTube Short uses `9:16` / `scene-aspect-9-16`.
- KTN FLUX configured-but-offline state remains truthful and does not fake image readiness.

Evidence:
`docs/V1_G03B_OWNER_BROWSER_ACCEPTANCE_2026-10-04.md`

## V1-G04 real Voice evidence

Real endpoint:
`GET /api/generate-voice?selftest=gemini`

Test 1:
- HTTP 200
- model: `gemini-3.8-flash-lite-tts`
- voice: `Kore`
- MIME: `audio/wav`
- bytes: 246,066
- duration: 5.0s
- WAV RIFF signature: PASS

Test 2:
- HTTP 200
- model: `gemini-3.8-flash-lite-tts`
- voice: `Kore`
- MIME: `audio/wav`
- bytes: 269,106
- duration: 5.48s
- WAV RIFF signature: PASS

Conclusion:
- Gemini TTS itself is currently usable.
- Repeated real TTS requests pass.
- Batch queue logic, live %, Pause/Resume/Retry/Cancel and Scene Audio QA are implemented.
- Owner/browser batch acceptance is complete in `docs/V1_G04B_OWNER_VOICE_BATCH_ACCEPTANCE_2026-10-04.md`.
- Voice clone acceptance remains pending until owner-approved reference/consent audio is supplied.

## V1-G04B owner/browser batch acceptance

Preview:
`https://ktn-ai-video-studio-ntppjsm2p-jackylehoangles-projects.vercel.app/`

Result:
**PASS**

Verified in browser:
- Imported `G04B Owner Voice Batch Seed` through the production UI import path and received `PASS · Đã nhập, lưu và xác minh dự án`.
- Voice Library loaded from the live provider catalog and Gemini TTS showed `sẵn sàng`.
- Batch confirmation correctly guarded API-cost execution.
- Live progress showed running/queued/pass/fail state and percentage.
- Pause changed the job to `Đã tạm dừng`; Resume returned the job to the quota-wait/running path.
- Cancel stopped the queue while preserving already-created audio.
- Controlled failure created a real `FAIL` row; `Retry lỗi` became enabled only when a failed scene existed.
- Retry switched scope to `Chỉ retry scene lỗi` and regenerated the failed scene with real Gemini/Kore audio.
- Final queue state reached `3/3 audio`, `0 fail`, rows `PASS / PASS / PASS`.
- Scene Audio QA approved all three scenes as `TECH PASS ĐÃ DUYỆT`.
- Project reload in a fresh tab restored `3/3 audio` and all audio QA approvals.

Evidence:
`docs/V1_G04B_OWNER_VOICE_BATCH_ACCEPTANCE_2026-10-04.md`

## V1-G05 real Image evidence

Real endpoint:
`GET /api/generate-image?selftest=gemini&aspect=16:9`

Result:
- HTTP 502
- provider: Gemini
- model: `gemini-3.1-flash-image`
- provider message: Free Tier limit = 0 input tokens/minute.

Other image paths:
- KTN FLUX: configured but live `ready=false`.
- OpenAI Image: not configured.

Conclusion:
**V1-G05 remains BLOCKED_PROVIDER / BLOCKED_RUNTIME.**
No fake/mock image result may close this gate.

## V1-G06 Subtitle technical evidence

V1 Subtitle now provides:
- deterministic SRT generation from scene narration/durations;
- editable SRT textarea;
- structural validator:
  - sequential cue numbers;
  - valid `HH:MM:SS,mmm` timestamps;
  - end > start;
  - no overlaps;
  - non-empty cue text;
  - warnings for very short cues and overlong lines;
- invalid SRT blocks download/render readiness;
- exact edited SRT is persisted in Project;
- exact edited SRT is added to render manifest as `subtitle_srt`;
- Vercel render bridge forwards it as `custom_subtitle_content`;
- MoneyPrinterTurbo `VideoParams` accepts `custom_subtitle_content`;
- MoneyPrinterTurbo `generate_subtitle` validates and writes the exact supplied SRT instead of regenerating it.

Final visual validation that the edited SRT is burned into the produced MP4 belongs to V1-G07.

## V1-G08 Persistence technical evidence

Project save now verifies:
- scene count;
- image/audio count;
- full normalized Project fingerprint after read-back.

Fingerprint covers:
- project identity;
- Brief/input values;
- Channel Profile snapshot;
- Script + multi-pass workflow artifacts;
- Scene content and QA/review flags;
- image/audio metadata + payload lengths;
- SRT;
- Voice/Image/Render settings.

Import now:
- requires V1 schema;
- validates inputs/script/scenes;
- rejects duplicate/empty scene IDs;
- rejects >500 scenes;
- rejects malformed subtitle/settings objects;
- rejects files >250 MB;
- verifies current project before switching;
- clears stale render material keys;
- restores → saves → read-back verifies before reporting PASS.

Browser/IndexedDB interaction cannot be closed automatically because the connected browser is currently unavailable; owner acceptance remains pending.

## V1-G09 Readiness semantics

Corrected rule:
**configured ≠ ready**

Current UI behavior:
- script providers with keys are shown as `Provider đã cấu hình`, not falsely `AI sẵn sàng`;
- KTN Image readiness uses live gateway probe;
- Render readiness uses live render-worker probe;
- Voice Library requires provider configuration and a successful list response.

## CI observation

GitHub Actions CI run `37191288019`:
- Python 3.11: failure
- Python 3.13: failure
- Windows smoke: failure
- all heavy/manual E2E jobs skipped as designed

The failed jobs expose **no executed steps** and GitHub returns no job log blob. A rerun reproduced the same no-step failure. An earlier Voice Studio PR run (`37135412953`) shows the same no-step pattern.

Therefore the available evidence does **not** attribute the CI failure to application code. Exact runner/account/infrastructure cause is currently unresolved. Vercel Preview deployment and JavaScript/API static regression remain PASS, but CI must be understood or replaced by an executable release gate before V1-G11.

## Immediate remaining blockers

1. Script provider availability for G02.
2. Image provider/runtime for G05.
3. Render Worker for G07.
4. Full Project persistence browser E2E beyond the G04 voice reload path.
5. Golden Brief → MP4 E2E.
6. GitHub Actions no-step failure diagnosis.
