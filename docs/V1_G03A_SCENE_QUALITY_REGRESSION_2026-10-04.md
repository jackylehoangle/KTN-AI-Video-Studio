# V1-G03A — SCENE QUALITY REGRESSION REPORT

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **TECHNICAL PASS / PENDING OWNER VISUAL ACCEPTANCE**

## Scope

`V1-G03A — SCENE QUALITY REGRESSION → BOARD/LIST → EDIT → SPLIT/MERGE → REORDER → LOCK → ASPECT-RATIO CORRECTNESS → SCENE QA → OWNER ACCEPTANCE`

## Technical checks

- Board/List mode: PASS.
- Scene Editor: PASS.
- Split: PASS; new scenes clear image/audio and require re-review.
- Merge: PASS; merged scene clears generated assets and requires re-review.
- Reorder: PASS; affected neighboring scenes require continuity review.
- Lock: PASS as **Lock AI**; locked scene is preserved against AI regeneration by position.
- Dynamic scene/image aspect: PASS; uses current Render Aspect / platform default instead of hard-coded 16:9.
- Image aspect stored with generated asset: PASS.
- Scene QA checks image aspect: PASS.
- Scene QA checks narration/duration/purpose/visual intent/shot/prompt: PASS.
- Scene QA checks visual and continuity review state: PASS.
- AI-created scenes now require explicit human visual/continuity review: PASS.
- Explicit `Duyệt cảnh` action added: PASS.
- Scene edit counts as explicit review: PASS.
- Project persistence stores Scene Quality fields: PASS.
- JS syntax: PASS.
- API analyzer syntax: PASS.
- Duplicate DOM IDs: none.
- Missing getElementById references: none.

## Important quality correction made during G03A

Previously an AI-generated scene could reach a high QA score even if the owner had not reviewed visual intent/continuity.

New rule:

```text
AI Scene
→ visual_review_required = true
→ continuity_review_required = true
→ QA cannot reach 100%
→ owner clicks "Duyệt cảnh" or edits/reviews the scene
→ review flags cleared
→ QA may PASS
```

This prevents false-green Scene QA.

## Deployment

Latest Scene QA commit:
`c8a948e4f0baebc6a6f62a6b7cc768349a0b2c25`

GitHub Vercel commit status: **success**.

The direct Vercel connector lost authorization to the team scope after deployment, so the unique latest preview URL could not be re-read through the connector in this session. This does not change the GitHub/Vercel deployment status reported on the commit.

## Remaining acceptance

Owner visual/functional acceptance remains required for:
- Board vs List usability;
- Scene Editor usability;
- Split/Merge behavior;
- Reorder behavior;
- Lock AI semantics;
- explicit Scene Review flow;
- QA readability.

Therefore V1-G03 is not fully closed until owner acceptance.
