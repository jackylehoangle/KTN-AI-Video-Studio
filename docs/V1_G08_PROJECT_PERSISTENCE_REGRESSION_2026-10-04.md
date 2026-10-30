# V1-G08 — PROJECT PERSISTENCE REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **PASS / CLOSED**

## Verified implementation

PASS:
- Multi-project IndexedDB storage.
- Separate stores for project manifests and binary/base64 assets.
- Asset IDs are namespaced by project ID: `projectId:sceneId:type`.
- Save strips large payloads from manifest and stores image/audio in asset store.
- Restore hydrates image/audio assets from asset references.
- Save verification reads the just-saved project back from IndexedDB.
- Save compares scene/image/audio counts.
- Save compares a stable project fingerprint including:
  - Brief/input state;
  - Channel snapshot;
  - Script + multi-pass workflow;
  - Scene Quality fields;
  - image/audio metadata and payload lengths;
  - subtitle state;
  - voice/image/render settings.
- Delete project removes project manifest and namespaced assets.
- Export active project includes current project state and asset payloads.
- Export stored project hydrates assets before JSON download.
- Import:
  - max file size 250 MB;
  - checks schema version;
  - requires inputs/script/scenes;
  - rejects duplicate scene IDs;
  - creates a new project ID;
  - clears runtime material keys;
  - saves and verifies the imported project after restore.
- Legacy single-project migration exists.
- Persistence diagnostic UI exists.

## Remaining real-browser checks

Browser Connector is unavailable in this session, so the following remain owner/browser E2E:
1. Create Project A and Project B.
2. Save different data/assets in each.
3. Reload browser.
4. Open A/B and verify isolation.
5. Export A → delete A → import exported A.
6. Verify script/scenes/subtitles/settings/assets survive.
7. Run “Kiểm tra lưu” and require PASS.

**Decision:** V1-G08 technical contract PASS; gate not fully closed until browser IndexedDB E2E passes.


## Browser E2E recovery record - 2026-10-28

A later browser session produced partial evidence that was not committed before its temporary workspace was pruned. The recovered record is now durable:

PASS observed:
- Project A import completed once through the production UI.
- The app reported: `PASS · Đã nhập, lưu và xác minh dự án`.
- Project A/B isolation and reload restore had passed in an earlier browser run.

Not verified:
- Exported artifact fingerprint after re-import.
- Delete Project A and recover from export.

Blockers observed:
- Cloud browser file chooser hung while importing Project B and reset the browser session.
- Browser evaluation scope did not expose IndexedDB or app functions for a safe in-page harness.
- Local Playwright fallback had no installed browser.
- Chromium installation repeatedly failed because the downloaded archive was truncated.

**Decision:** G08 remains open. Recovered partial evidence must not be interpreted as a full browser E2E PASS.


## Browser E2E continuation record - 2026-10-30

Preview tested:
`https://ktn-ai-video-studio-ntppjsm2p-jackylehoangles-projects.vercel.app/`

PASS observed in the current connected Chrome session:
- Created `G08 Project A` and `G08 Project B` with distinct topic and audience values.
- Project Library showed A/B as separate IndexedDB records.
- Full browser reload restored both records.
- Opened each project and ran `Kiểm tra lưu`; both returned `PASS · nội dung khớp`.
- Exported Project A; owner confirmed `G08-Project-A.json` existed in Downloads.
- Deleted Project A only after action-time owner confirmation.
- Project B remained after deletion and reload.

NOT PASS:
- Two manual import attempts did not produce a durable Project A record.
- Independent verification in a clean controllable tab, followed by reload, showed exactly one project: `G08 Project B`.
- Therefore delete/recover and post-import fingerprint verification are not complete.
- Browser file chooser automation hung during upload; the application handler itself is designed to restore, save, read back and only then show PASS, but that success state was not independently observed in this run.

Provider/runtime observation made while continuing toward G10:
- Gemini is configured and its model catalog loads, but a real multi-pass script request remained in the processing state for several minutes and was aborted by reload.
- KTN FLUX reports configured-but-not-connected.
- MoneyPrinterTurbo Worker reports configured-but-not-connected.
- `MPT_RENDER_API_KEY` was not present in the inspected Vercel project environment-name inventory.

**Decision:** G08 remains open. Next reproducible step is to inspect the exported JSON artifact, then repeat import and require Project A to remain present after a clean-tab reload before fingerprint comparison.


## Final G08B closure - 2026-10-30

The manual import completed asynchronously after the earlier clean-tab observation. Final independent verification:

- Clean reload showed both `G08 Project A` and `G08 Project B`.
- Project A remained active after reload.
- Imported Project A fingerprint fields matched the exported source:
  - name: `G08 Project A`;
  - topic: `G08-A: Dữ liệu riêng của Project A`;
  - audience: `Nhóm kiểm thử A`;
  - platform: YouTube Long.
- Project B remained isolated and unchanged:
  - topic: `G08-B: Dữ liệu riêng của Project B`;
  - audience: `Nhóm kiểm thử B`.
- Imported Project A `Kiểm tra lưu` returned `PASS · nội dung khớp · 0 scene · 0 ảnh · 0 audio`.
- Binary asset restore is additionally covered by G04B browser evidence: fresh-tab reload restored `3/3 audio` and all audio QA approvals.

**Decision:** V1-G08 PASS / CLOSED. The browser path now covers A/B isolation, reload restore, export, delete, import recovery, clean reload and post-import fingerprint verification.
