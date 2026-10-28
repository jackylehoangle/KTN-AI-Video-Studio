# V1-G08 — PROJECT PERSISTENCE REGRESSION

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Status:** **TECH PASS / BROWSER E2E BLOCKED-PENDING**

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
