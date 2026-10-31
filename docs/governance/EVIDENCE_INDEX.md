# KTN AI Video Studio - Evidence Index

**Updated:** 2026-10-31

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
- G07 real MP4/download: `docs/V1_G07B_MP4_DOWNLOAD_E2E_2026-10-31.md`
- G08: `docs/V1_G08_PROJECT_PERSISTENCE_REGRESSION_2026-10-04.md`
- G09: `docs/V1_G09_PROVIDER_READINESS_REGRESSION_2026-10-04.md`
- G10 six-minute execution spec: `docs/V1_G10_SIX_MINUTE_GOLDEN_E2E_SPEC_2026-10-31.md`
- Stable worker migration plan: `docs/V1_WORKER_STABLE_INFRA_MIGRATION_PLAN_2026-10-31.md`

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

## Live provider/runtime evidence - 2026-10-30

| Evidence | Result |
|---|---|
| Evidence/regression commit | `4d53b52de78b8ef2127cd3f0ac408c0ebb2efa89` |
| Colab T4 one-click restore | PASS in 5.5 minutes |
| FLUX model | READY, 16.05 GB |
| Direct FLUX generation | PASS, two images, `HTTP 200` twice |
| Vercel Preview deployment | `dpl_7dr6MG9XKeMLJSrf2YeJmyE1CuPc` READY |
| Render worker readiness | PASS, authenticated, `workerStatus=200` |
| Gemini 3.8 real multi-pass | BLOCKED by high demand; controlled retry logged |
| Gemini 3.7 rerun | Did not complete in observation window |
| Focused regression tests | 13 PASS, one deprecation warning |

G05 is not closed by runtime readiness alone and still requires application
generate/regenerate persistence evidence. G07 now has a completed product MP4
task and byte-complete proxy delivery; playback/media QA remains before closure.

## Real MP4 and download evidence - 2026-10-31

| Evidence | Result |
|---|---|
| Tested code head | `aaf9247a2717befb0bceb03e0148ec34ea6e5f13` |
| Vercel deployment | `dpl_8X9Rg6MGQQb4U52n54bac55krbJA` READY |
| Minimal render task | `d98cd3b6-dc2f-476b-8526-8aac33582cbf` PASS |
| Product UI render task | `436cc16e-1185-4c24-8db7-5104b5f5e01b` PASS, 100% |
| Product scene assets | 14/14 |
| MP4 size | 10,747,935 bytes |
| Proxy byte coverage | PASS, six contiguous HTTP 206 ranges |
| Browser local-file event | Not captured before automation timeout |
| Playback/media QA | PENDING |
| Six-minute Golden Brief | PENDING |

## Stable worker migration readiness - 2026-10-31

| Evidence | Result |
|---|---|
| Colab/Quick Tunnel classification | Temporary acceptance infrastructure |
| Stable worker architecture and runbook | READY |
| Security, persistence, monitoring and rollback requirements | DOCUMENTED |
| Paid infrastructure provisioning | NOT STARTED |
| Current blocker | Owner provider/region/GPU/budget/endpoint approval |
| Migration canary | G10 six-minute Golden Brief |

## Local regression - 2026-10-31

| Check | Result |
|---|---|
| Full pytest suite | 1,338 passed, 19 skipped, 8 warnings |
| Pytest subtests | 10,614 passed |
| Duration profile focused tests | 7 passed |
| JavaScript syntax | PASS |
| Project state YAML parse/assert | PASS |
| Git whitespace check | PASS |
