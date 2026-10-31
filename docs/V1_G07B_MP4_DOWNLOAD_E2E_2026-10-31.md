# V1-G07B - MP4 RENDER AND DOWNLOAD E2E

**Date:** 2026-10-31 (GMT+7)
**Branch:** `release/v1-rc1`
**Tested code head:** `aaf9247a2717befb0bceb03e0148ec34ea6e5f13`
**Status:** **RENDER PASS / BYTE-COMPLETE DOWNLOAD PASS / PLAYBACK PENDING**

## Runtime

- Colab GPU: T4.
- One-click stack restore: PASS in about 5 minutes.
- FLUX.1-schnell FP8: READY, 16.05 GB.
- KTN Image Gateway: READY.
- MoneyPrinterTurbo Render Worker: READY and authenticated.
- Vercel Preview deployment: `dpl_8X9Rg6MGQQb4U52n54bac55krbJA`, READY.
- Git branch alias: `ktn-ai-video-studio-git-release-v1-rc1-jackylehoangles-projects.vercel.app`.

## Real render evidence

### Minimal smoke task

- Task: `d98cd3b6-dc2f-476b-8526-8aac33582cbf`.
- Input: one 1280x720 image and a 3-second validated WAV.
- Result: state `1`, progress `100`, final MP4 returned.

### Product UI task

- Project: `G02 GPT E2E 2026-10-30`.
- Scene assets: 14/14.
- Aspect: 9:16.
- Task: `436cc16e-1185-4c24-8db7-5104b5f5e01b`.
- Product UI reached `Hoan tat MP4`, `100%` and displayed `Tai lai MP4`.
- Final MP4 size: `10,747,935` bytes.

## Download integrity evidence

The same-origin Vercel download proxy returned the complete MP4 as contiguous
authenticated ranges:

| Part | Content-Range | Length |
|---|---|---:|
| 1 | `bytes 0-2097151/10747935` | 2,097,152 |
| 2 | `bytes 2097152-4194303/10747935` | 2,097,152 |
| 3 | `bytes 4194304-6291455/10747935` | 2,097,152 |
| 4 | `bytes 6291456-8388607/10747935` | 2,097,152 |
| 5 | `bytes 8388608-10485759/10747935` | 2,097,152 |
| 6 | `bytes 10485760-10747934/10747935` | 262,175 |

Every response was HTTP `206`, `video/mp4`. The ranges cover byte `0` through
byte `10,747,934` exactly once with no gap or overlap.

## Fixes covered by the evidence

- Signed worker download URLs.
- Same-origin Vercel MP4 download proxy.
- Bounded 2 MB range reads from the worker.
- Browser-side chunk assembly into one MP4 Blob.
- Retry link after render completion.
- Full regression suite: 1,337 passed, 19 skipped, 12 warnings and 10,614
  subtests passed.

## Remaining acceptance

- Browser automation did not capture the final local download event before its
  control timeout, although the UI reached the download state and every byte was
  independently retrieved through the production proxy.
- Local MP4 playback, decoded duration, audio/subtitle synchronization and visual
  inspection are not recorded for this task.
- This project is a short-form acceptance project, not the required six-minute
  Golden Brief.

## Gate decision

G07 advances from readiness-only to:

`REAL_RENDER_PASS / BYTE_COMPLETE_DOWNLOAD_PASS / PLAYBACK_PENDING`

G07 is not closed until playback and media QA pass. G10 remains pending until a
real six-minute Golden Brief completes from Brief through downloaded MP4.
