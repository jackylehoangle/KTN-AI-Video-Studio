# V1-G03B — SCENE QUALITY OWNER BROWSER ACCEPTANCE

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Preview tested:** `https://ktn-ai-video-studio-ntppjsm2p-jackylehoangles-projects.vercel.app/`  
**Gate:** `V1-G03`  
**Result:** **PASS**

## Scope

This acceptance closes the remaining owner/browser portion of Scene Quality.
It does not close Script Quality, Image generation, Render Worker, or Golden MP4 gates.

Verified Scene Quality behaviors:

- Board and List view switching.
- Scene edit modal and save.
- Human review action with `Duyệt cảnh`.
- Reorder with continuity review invalidation.
- Lock / unlock AI overwrite control.
- Split scene.
- Merge scene with next scene.
- Scene QA summary and per-card QA states.
- YouTube Long aspect `16:9`.
- YouTube Short aspect `9:16`.
- Truthful image runtime state when KTN FLUX is configured but offline.

## Test data

A local V1 project JSON seed was imported through the production UI import flow.

The app returned:

- `PASS · Đã nhập, lưu và xác minh dự án`
- `Đã lưu · 2 scene · 0 ảnh · 0 audio`

This seed was used only to exercise Scene Quality without calling a script provider during the current Gemini quota/high-demand block.
It must not be counted as evidence for `V1-G02`.

## Acceptance evidence

Initial state after import:

- Scene count: `2 cảnh`
- Scene QA: `QA 0/2`
- Scene list class: `scene-list scene-aspect-16-9`
- Both scene cards showed `Duyệt cảnh`
- KTN FLUX image button correctly showed runtime offline state.

Board / List:

- Clicking `List` added `scene-list-mode`.
- Clicking `Board` removed `scene-list-mode`.
- Scene count and QA state remained stable.

Review:

- Reviewing scene 1 changed card QA from `QA 78%` to `QA 100%`.
- Scene summary changed from `QA 0/2` to `QA 1/2`.
- Reviewed card button changed to disabled `Đã duyệt`.

Edit:

- Scene editor opened.
- Scene title and continuity notes were edited and saved.
- After selecting a valid purpose (`explanation`) and saving, the scene reached `QA 100%`.

Reorder:

- Moving scene 2 upward changed order correctly.
- Reorder marked affected scenes as needing continuity review.
- Summary changed back to `QA 0/2`, preventing false-green status.

Lock:

- Clicking `Khóa AI` changed the action to `Mở khóa AI`.
- The lock state was visible on the scene card.

Split:

- Splitting the scene created 3 scene cards.
- Scene count changed to `3 cảnh`.
- Split scenes required review and the summary showed `QA 0/3`.

Merge:

- Merging the split scene with the next scene returned count to `2 cảnh`.
- The merged scene required review and did not falsely pass.

Final review:

- After setting the merged scene to a valid purpose and reviewing both scene cards:
  - Scene 1: `QA 100%`
  - Scene 2: `QA 100%`
  - Summary: `QA 2/2`
  - Both cards showed disabled `Đã duyệt`.

Aspect:

- Long state:
  - platform: `youtube_long`
  - render aspect: `16:9`
  - scene list class: `scene-list scene-aspect-16-9`
  - QA remained `QA 2/2`

- Short state:
  - platform: `youtube_short`
  - render aspect: `9:16`
  - scene list class: `scene-list scene-aspect-9-16`
  - card count remained `2`
  - QA remained `QA 2/2`

- Returning to Long restored:
  - render aspect: `16:9`
  - scene list class: `scene-list scene-aspect-16-9`
  - QA remained `QA 2/2`

## Decision

`V1-G03` is closed as **PASS**.

Remaining V1 work continues with:

1. `V1-G04B` — Voice batch owner acceptance.
2. `V1-G08B` — Browser project persistence E2E.
3. Runtime track for `V1-G05` and `V1-G07`.

