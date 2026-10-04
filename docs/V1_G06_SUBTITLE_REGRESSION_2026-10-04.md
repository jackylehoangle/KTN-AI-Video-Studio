# V1-G06 — SUBTITLE WORKFLOW REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **TECH PASS / OWNER BROWSER CHECK PENDING**

## Verified

PASS:
- SRT generation from Scene narration.
- Uses actual audio duration when available, scene duration otherwise.
- Character splitting with configurable max chars.
- Configurable scene gap.
- Manual SRT editor.
- SRT structural validation.
- Continuous cue numbering.
- Timestamp format validation.
- End > start validation.
- Overlap detection.
- Short-duration warnings.
- Line-length warnings.
- SRT download only when structurally valid.
- Subtitle state is persisted/restored with Project.
- Render readiness blocks invalid SRT.
- Render manifest includes subtitle SRT only when present.

## Regression fix

Found and fixed a real timeline bug:
- old behavior filtered out scenes with empty narration before timeline calculation;
- later subtitle cues therefore started too early if a silent/no-narration scene existed;
- new behavior always advances the global timeline by every scene duration, while only creating cues for scenes that contain narration.

Latest fix commit:
`8f6148d97e1916f72cec738d0994228ac3462e66`

## Static/deploy verification

- app.js syntax: PASS
- duplicate DOM IDs: 0
- missing DOM refs: 0
- Preview deployment: READY

Remaining owner/browser check:
- generate SRT;
- edit one cue;
- intentionally introduce overlap and verify FAIL;
- fix it and verify PASS;
- download SRT;
- reload Project and verify SRT survives.

**Decision:** technical implementation PASS; full gate closes after owner/browser interaction check.
