# V1-G03 — SCENE QUALITY TECHNICAL REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Latest verified Preview commit:** `c2c68f1bcddee1cc37f7b6aa449fea20681a3b79`  
**Gate status:** **TECH PASS / OWNER VISUAL PENDING**

## Scope verified

Scene Quality contract includes:
- Board / List modes;
- purpose;
- narration;
- duration;
- visual intent;
- shot type;
- continuity notes;
- visual description;
- image prompt;
- Scene QA;
- edit;
- split;
- merge;
- reorder;
- lock.

## Fixes completed during regression

1. Image aspect is no longer hard-coded to 16:9.
   - YouTube Long default: 16:9.
   - YouTube Short / Facebook Short default: 9:16.
   - User can select 16:9 / 9:16 / 1:1.
   - Gemini, OpenAI and KTN Image request contracts now receive the selected aspect.
   - KTN Image maps 9:16 to 768x1360.
   - OpenAI maps 9:16 to 1024x1536.

2. Split/Merge quality safety.
   - Split and Merge invalidate prior image/audio assets.
   - Split/Merge mark `visual_review_required=true`.
   - Split/Merge mark `continuity_review_required=true`.
   - Scene QA cannot report full PASS until these review flags are cleared through Scene Editor.

3. Reorder continuity safety.
   - Reordering marks the moved scene and neighboring scenes as requiring continuity review.

4. Image ratio QA.
   - Generated image asset stores `aspect_ratio`.
   - If an existing generated image ratio conflicts with the current project ratio, Scene QA flags it.

5. Persistence.
   - Visual/continuity review flags are serialized with the Project and restored.

## Static regression

- `app.js` syntax: PASS
- `api/generate-image.js` syntax: PASS
- duplicate DOM IDs: 0
- missing getElementById references: 0
- frontend hard-coded scene image 16:9: removed
- portrait API contract: PASS
- persisted stale-review flags: PASS
- aspect-aware Storyboard CSS: PASS

## Preview smoke

Latest Preview: `https://ktn-ai-video-studio-grl352thq-jackylehoangles-projects.vercel.app/`

- Home HTTP 200
- Scene Board control present
- Scene List control present
- Scene Editor present
- Scene QA control present
- Render Aspect control present
- Image API HTTP 200
- OpenAI image API advertises 16:9 / 9:16 / 1:1 supported sizes

## Remaining acceptance

Owner must visually/functionally verify:
- Board ↔ List;
- edit;
- split;
- merge;
- reorder;
- lock;
- QA state after edits;
- 9:16 appearance for Short;
- 16:9 appearance for Long.

Real image generation remains part of V1-G05 because KTN Image runtime is currently offline.

**Decision: V1-G03 technical implementation PASS; gate cannot be fully closed until owner visual acceptance.**
