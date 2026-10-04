# V1-G04B — OWNER VOICE BATCH ACCEPTANCE

**Date:** 2026-10-04  
**Branch:** `release/v1-rc1`  
**Preview:** `https://ktn-ai-video-studio-ntppjsm2p-jackylehoangles-projects.vercel.app/`  
**Result:** **PASS — OWNER BATCH / AUDIO QA / RELOAD**

## Scope

Acceptance path:

`OWNER VOICE BATCH ACCEPTANCE -> LIVE % -> PAUSE/RESUME -> RETRY/CANCEL -> AUDIO QA -> PROJECT RELOAD`

Clone voice remains consent-gated and requires a real reference/consent audio sample before acceptance.

## Test project

Imported local V1 project seed through the production UI import path:

- Project: `G04B Owner Voice Batch Seed`
- Scenes: 3
- Voice provider: Gemini TTS
- Voice: `Kore`
- Initial state: `0/3 audio`

Import result:

- `PASS · Đã nhập, lưu và xác minh dự án`
- Project saved with `3 scene · 0 ảnh · 0 audio`

## Verified

- Voice Library loaded from live provider catalog.
- Gemini TTS readiness displayed as `Gemini TTS sẵn sàng`.
- Batch scope confirmation correctly kept `Chạy batch` disabled until confirmed.
- Batch start showed live progress: `0%`, `1 running`, `2 queued`.
- Pause worked during the batch window:
  - progress reached `33%`;
  - label changed to `Đã tạm dừng`;
  - Resume button became enabled;
  - per-scene generate buttons stayed disabled while the batch job was active.
- Resume worked:
  - label changed to quota wait for the next scene;
  - Pause became available again.
- Cancel worked:
  - label changed to `Đã hủy batch`;
  - completed audio was preserved;
  - unfinished scenes remained queued/missing and controls reopened.
- Controlled failure path worked:
  - scene 2 narration was temporarily emptied through Scene Editor;
  - batch marked scene 2 `FAIL` without a provider call;
  - scene 3 still completed with real Gemini TTS audio;
  - progress reached `100%` with `1 pass / 1 fail`;
  - `Retry lỗi` became enabled only after a failed scene existed.
- Retry worked:
  - scene 2 narration was restored through Scene Editor;
  - clicking `Retry lỗi` switched scope to `Chỉ retry scene lỗi`;
  - retry generated real Gemini TTS audio for scene 2;
  - final batch state reached `3/3 audio`, `0 fail`.
- Scene Audio QA worked:
  - all three scenes displayed audio controls;
  - all three scenes showed technical audio pass with durations:
    - scene 1: `Audio 8.6s`
    - scene 2: `Audio 9.2s`
    - scene 3: `Audio 7.7s`
  - all three were manually approved and changed to `TECH PASS ĐÃ DUYỆT`.
- Project reload worked:
  - a fresh browser tab on the same origin restored the active project from browser storage;
  - project reopened as `G04B Owner Voice Batch Seed`;
  - restored state preserved `3/3 audio`;
  - queue rows remained `PASS / PASS / PASS`;
  - all three audio QA badges remained `TECH PASS ĐÃ DUYỆT`.

## Decision

`V1-G04B` owner/browser batch acceptance is **PASS**.

The remaining clone acceptance is not closed here because real voice clone testing requires owner-approved reference/consent audio.
