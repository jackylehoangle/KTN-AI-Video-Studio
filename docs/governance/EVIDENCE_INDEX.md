# KTN AI Video Studio - Evidence Index

**Updated:** 2026-10-30

## Canonical control

- Project state: `docs/governance/PROJECT_STATE.yaml`
- Operating rules: `docs/governance/OPERATING_RULES.md`
- Current handoff: `docs/governance/SESSION_HANDOFF.md`
- Decision log: `docs/governance/DECISION_LOG.md`
- Source of Truth: `docs/KTN_AI_VIDEO_STUDIO_SOURCE_OF_TRUTH.md`
- RC gate matrix: `docs/V1_RC1_GATE_STATUS_2026-10-04.md`
- Release PR: #13

## Gate evidence

- G02: `docs/V1_G02A_REAL_MULTIPASS_SCRIPT_TEST_2026-10-04.md`
- G03: `docs/V1_G03_SCENE_QUALITY_REGRESSION_2026-10-04.md`
- G03 owner acceptance: `docs/V1_G03B_OWNER_BROWSER_ACCEPTANCE_2026-10-04.md`
- G04: `docs/V1_G04_VOICE_STUDIO_REGRESSION_2026-10-04.md`
- G04 owner acceptance: `docs/V1_G04B_OWNER_VOICE_BATCH_ACCEPTANCE_2026-10-04.md`
- G05: `docs/V1_G05_IMAGE_PIPELINE_REGRESSION_2026-10-04.md`
- G06: `docs/V1_G06_SUBTITLE_REGRESSION_2026-10-04.md`
- G07: `docs/V1_G07_RENDER_PIPELINE_REGRESSION_2026-10-04.md`
- G08: `docs/V1_G08_PROJECT_PERSISTENCE_REGRESSION_2026-10-04.md`
- G09: `docs/V1_G09_PROVIDER_READINESS_REGRESSION_2026-10-04.md`

## G08 recovered evidence classification

| Evidence | Status | Strength |
|---|---|---|
| Project A import and read-back | PASS once | Browser observation |
| A/B isolation | PASS in prior run | Browser observation |
| Reload restore | PASS in prior run | Browser observation |
| Export/import fingerprint | Not verified | Missing |
| Delete/recover | Not verified | Missing |
| Cloud browser file chooser | Hung and reset session | Blocker evidence |
| Local Chromium installation | Failed on truncated archive | Blocker evidence |

This historical recovered evidence could not close G08 by itself. It is superseded by the complete connected-Chrome run below.


## G08 connected-Chrome evidence - 2026-10-30

| Evidence | Status | Strength |
|---|---|---|
| Create Project A/B with distinct data | PASS | Browser DOM observation |
| A/B isolation after reload | PASS | Browser DOM observation |
| Persistence diagnostic for A and B | PASS | Product read-back diagnostic |
| Export Project A file | Owner-confirmed present | Owner observation |
| Delete A while preserving B | PASS | Browser DOM + clean reload |
| Import A and durable recovery | PASS | Manual import completed asynchronously; clean reload showed A and B |
| Post-import fingerprint | PASS | Name, topic, audience and platform matched; persistence diagnostic PASS |
| Real Gemini multi-pass script | Did not complete | Browser observation; aborted by reload |
| KTN FLUX / MPT worker readiness | Not connected | Product readiness UI |

Final verification completed after the asynchronous manual import finished. Combined with G04B fresh-tab restoration of 3/3 audio assets, this evidence authorizes G08 PASS / CLOSED.

## Runtime recovery implementation - 2026-10-30

| Evidence | Result |
|---|---|
| RC commit | `71af1ad6ce509cca9f6a51d96277351231553725` |
| Colab branch selection | `release/v1-rc1` |
| Render API key generation/config write | Implemented |
| Authenticated readiness probe | `/api/v1/tasks?page=1&page_size=1` |
| Focused Python tests | 7 PASS |
| JS/Python/notebook syntax checks | PASS |
| Vercel deployment | `dpl_DWYWjZMUev49r6uPmrDUz4KLHasA` READY |
| Live Colab runtime execution | Pending owner GPU session |
