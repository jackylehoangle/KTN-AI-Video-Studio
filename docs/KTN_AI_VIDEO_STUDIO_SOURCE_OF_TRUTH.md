# KTN AI VIDEO STUDIO — SOURCE OF TRUTH

**Cập nhật:** 27/09/2026 (GMT+7)  
**Repository:** `jackylehoangle/KTN-AI-Video-Studio`  
**Nhánh đang nghiệm thu:** `ui-vn-01-vietnamese-baseline`  
**Trạng thái milestone:** `VIDEO-E2E-01D.2B.5A — MANUAL PYTHON 3.13 COMPATIBILITY GATE — PASS`

> Tài liệu này là nguồn chuẩn kỹ thuật cho trạng thái hiện tại của KTN AI Video Studio trên nhánh nghiệm thu. Không lưu secret/token runtime trong tài liệu.

## 1. Trạng thái đã chốt

| Hạng mục | Trạng thái | Bằng chứng/ghi chú |
|---|---|---|
| UI tiếng Việt baseline | PASS | Giao diện tiếng Việt hoạt động trên Vercel preview/fixed alias |
| KTN Image Engine / FLUX | PASS | FLUX.1-schnell FP8 qua ComfyUI + KTN Image Gateway |
| Image E2E | PASS | App → Vercel API → KTN Gateway → ComfyUI/FLUX → ảnh → IndexedDB/Library |
| Project recovery | PASS | Project 12 scene và 12/12 ảnh được giữ/khôi phục |
| MoneyPrinterTurbo Render Worker | PASS | Python 3.11 + uv + FFmpeg/MoviePy + Edge TTS |
| Colab one-click recovery | PASS | `COLAB-BOOT-02` dựng lại toàn stack sau reset |
| Live readiness UI | PASS | App hiển thị KTN FLUX Image Engine và MoneyPrinterTurbo Worker = READY dựa trên live probe |
| MP4 E2E | PASS | Render đạt 100%, có MP4; Owner xác nhận playback thực tế |

## 2. Milestone vừa hoàn tất

### VIDEO-E2E-01C.4 — PASS

Chuỗi nghiệm thu đã đi qua:

```text
Colab GPU
  → ComfyUI :8188
  → KTN Image Gateway :8189
  → Cloudflare Quick Tunnel
  → Vercel Preview / Fixed Alias
  → Project 12 scenes + 12/12 images
  → MPT Render Worker :8090
  → Edge TTS
  → FFmpeg/MoviePy
  → MP4 100%
  → Playback xác nhận
```

Không coi trạng thái “configured” là READY. READY phải dựa trên probe sống tới endpoint runtime.

## 3. Colab recovery chuẩn

Notebook:

`colab/KTN_IMAGE_ENGINE_COLAB.ipynb`

Cell chuẩn duy nhất sau runtime reset:

`COLAB-BOOT-02 — ONE-CLICK FULL STACK RESTORE`

Script:

`colab/boot_all.py`

One-click restore phải:

1. Xác nhận NVIDIA GPU.
2. Clone/pull đúng branch `ui-vn-01-vietnamese-baseline`.
3. Cài/check FFmpeg + cloudflared.
4. Dựng ComfyUI.
5. Tải/check FLUX.1-schnell FP8.
6. Start ComfyUI :8188.
7. Start KTN Image Gateway :8189.
8. Dựng MoneyPrinterTurbo bằng uv + Python 3.11.
9. Giữ `edge_tts_timeout = 240`.
10. Start MPT Render Worker :8090.
11. Tạo Image + Render Quick Tunnel.
12. In runtime variables cần cập nhật cho Vercel.
13. Chỉ báo READY khi các local service/tunnel đã phản hồi.

### Lỗi đã sửa ngày 27/09/2026

Cell One-Click trong notebook trước đó chứa literal `\\n` thay vì newline thật. Đã sửa để cell chạy hợp lệ sau full runtime reset.

## 4. Runtime variables

Vercel Preview sử dụng:

- `KTN_IMAGE_GATEWAY_URL`
- `KTN_IMAGE_GATEWAY_TOKEN`
- `MPT_RENDER_BASE_URL`
- `MPT_RENDER_API_KEY` — để trống trong Colab acceptance hiện tại

**Không ghi giá trị token vào Source of Truth.**

Cloudflare Quick Tunnel đổi URL sau mỗi Colab runtime. Vì vậy sau reset:

1. Run `COLAB-BOOT-02`.
2. Lấy URL/token mới.
3. Cập nhật **giá trị của biến hiện có**, không tạo biến trùng tên.
4. Chờ Vercel redeploy/refresh environment.
5. Kiểm tra live readiness.

## 5. Fixed alias và persistence

Fixed alias phải được giữ ổn định để không đổi browser origin.

Project persistence hiện dựa trên:

- IndexedDB
- browser origin
- Export/Import JSON để recovery

Không được tùy tiện đổi sang deployment URL ngẫu nhiên khi cần giữ project local browser.

### Rủi ro hiện tại

IndexedDB là persistence phía trình duyệt, chưa phải project backend bền vững. Production cần backend storage/database ổn định cho project, asset metadata và trạng thái render.

## 6. Image architecture

```text
KTN AI Video Studio
  → /api/generate-image
  → KTN_IMAGE_GATEWAY_URL
  → KTN Image Gateway
  → ComfyUI
  → FLUX.1-schnell FP8
  → image result
  → IndexedDB / Library
```

Provider chính hiện tại: **KTN FLUX**.

Gemini Image key hiện không phải provider chính của acceptance. OpenAI Image chưa được cấu hình trên môi trường hiện tại.

## 7. Render architecture

```text
12 scene images
  → stage-material
  → MoneyPrinterTurbo Worker
  → Edge TTS vi-VN-HoaiMyNeural
  → subtitle (optional)
  → FFmpeg/MoviePy
  → MP4
  → task polling
  → playback
```

Render task phải được persist theo `task_id` ở frontend để reload không tạo false-failure.

Polling window đã được mở rộng khoảng 60 phút; không được quay lại timeout UI khoảng 6 phút.

## 8. Live readiness contract

UI Cài đặt phải hiển thị tối thiểu:

- Gemini
- OpenAI
- KTN FLUX Image Engine
- MoneyPrinterTurbo Worker

Với KTN FLUX và Render Worker:

- `READY` chỉ khi endpoint runtime phản hồi thành công.
- Có URL trong env nhưng endpoint chết → **không được hiển thị READY**.

## 9. Gate PASS/FAIL chuẩn

### BOOT
PASS khi:
- `KTN COLAB STACK READY`
- 8188 / 8189 / 8090 chạy

### IMAGE
PASS khi:
- Gateway health OK
- KTN FLUX live status READY
- tạo ảnh E2E thành công

### PROJECT DATA
PASS khi:
- project restore được
- scene count đúng
- asset ảnh đủ

### RENDER START
PASS khi:
- ảnh được stage đủ
- task_id mới tạo thành công

### AUDIO
PASS khi:
- progress vượt audio gate
- không Edge TTS timeout

### UI POLL
PASS khi:
- UI không false-timeout
- reload có thể tiếp tục theo dõi task hiện tại

### MP4 FINAL
PASS khi:
- progress 100%
- có MP4 URL/file
- playback thực tế thành công

## 10. Những thay đổi quan trọng gần nhất

- `4088253` — persist render task + extend polling window
- `b503fe1` — add one-click full stack Colab restore script
- `df99104` — expose One-Click restore cell
- `fd7d11e` — repair notebook One-Click cell newlines
- `60c9c85` — show KTN FLUX live status card
- `fcbd0b2` — live probe image/render workers
- `ce61a34` — render endpoint reports worker live readiness
- `581926d` — UI renders live KTN FLUX + worker readiness

## 11. Hạn chế chưa xử lý

1. Colab là môi trường acceptance/dev, không phải production.
2. `/content` là ephemeral; reset sẽ mất model/process/task runtime.
3. Quick Tunnel URL thay đổi và không có uptime guarantee.
4. Project persistence vẫn ở browser/IndexedDB.
5. Render baseline hiện dùng Edge TTS trong MPT; chưa stage audio scene đã tạo trong project.
6. Chưa chuyển Image/Render workers sang GPU VPS endpoint ổn định.
7. Chưa merge milestone này vào `main`.

## 12. Hardening / merge-gate progress

### VIDEO-E2E-01D.1 — HANDOFF + SOURCE OF TRUTH
**PASS**

- Source of Truth và Session Handoff đã được tạo và duy trì.
- Functional acceptance baseline trước hardening: `581926dbc3841ab76d9dd4de3c6030536a8e77ea`.

### VIDEO-E2E-01D.2B — MANUAL CORE CI SURROGATE
**PASS với ngoại lệ hosted CI được ghi nhận**

**Exact tested code head:** `8fbd050f23455cc65fc5cad05d1bc7f8cb838468`  
**Acceptance lock branch:** `acceptance/video-e2e-01d-2b4-8fbd050f`

Bằng chứng manual gate trên đúng exact head:

| Gate | Kết quả |
|---|---|
| Redis prerequisite | PASS |
| Python 3.11 environment/dependencies | PASS |
| Compile | PASS |
| Ruff full | PASS |
| Gemini TTS targeted contract test | PASS |
| Vietnamese i18n targeted gate | PASS |
| Full Python 3.11 pytest suite | PASS |
| Coverage | **81%** — PASS, ngưỡng yêu cầu >= 70% |
| Windows clean clone / exact-head verify | PASS |
| Windows Python 3.11 dependency sync | PASS |
| Windows compile | PASS |
| Windows smoke pytest | **PASS — 168 passed, 4 skipped, 2 warnings, 64 subtests; 121.10s** |
| Python 3.13 environment/dependencies | PASS |
| Python 3.13 compile | PASS |
| Python 3.13 full pytest suite | PASS |
| Python 3.13 coverage | **81% — PASS** |
| Python 3.13 coverage.xml export | PASS |

Các lỗi được sửa trong hardening:
- Gemini TTS unit test được cập nhật theo Interactions API hiện tại.
- Xóa unused import làm Ruff F401.
- Vietnamese `vi` được xác định là first-class fully maintained locale; test fallback không còn ép `vi` bỏ bản dịch tiếng Việt.
- `vi.json` hiện cover đủ key theo `en.json` trong targeted i18n gate.

### Hosted CI / Vercel evidence

- GitHub Actions run #28 trên exact code head vẫn hiển thị failure cho Python 3.11, Python 3.13 và Windows smoke **trước khi có step thực thi**; job steps rỗng và không có log blob. Đây không được dùng làm bằng chứng code regression.
- Manual Linux Python 3.11 + Windows smoke + Python 3.13 manual gate là surrogate evidence được khóa cho milestone này.
- Python 3.13 compatibility đã được manual-retest trên HEAD `d3007d2962a2fa536eb0d13257c53be5f60c8d3d`: Python 3.13.15, dependencies PASS, compile PASS, full pytest PASS, coverage 81%, coverage.xml PASS.
- Vercel deployment cho exact code head `8fbd050f23455cc65fc5cad05d1bc7f8cb838468` hiện **READY**.
- PR #2 hiện **Open + Draft + Mergeable**, base `main`, head branch `ui-vn-01-vietnamese-baseline`.

### VIDEO-E2E-01D.2B.4 — MANUAL CI EVIDENCE LOCK → FINAL MERGE READINESS
**PASS phần evidence lock / docs update. Merge vẫn cần owner decision.**

Quy tắc merge:
1. Không diễn giải hosted Actions đỏ trước-step là code failure.
2. Python 3.13 manual compatibility gate đã PASS trên HEAD `d3007d2962a2fa536eb0d13257c53be5f60c8d3d`.
3. Runtime/application/test code được nghiệm thu chức năng tại `8fbd050f23455cc65fc5cad05d1bc7f8cb838468`; các commit đến `d3007d...` chỉ là docs-only và đã được diff verify.
4. Acceptance lock cho complete manual CI surrogate: `acceptance/video-e2e-01d-2b5a-py313-pass`.
5. Không merge PR #2 tự động. Owner vẫn phải quyết định merge; hosted GitHub Actions đỏ trước-step được giữ như ngoại lệ hạ tầng/account, không còn là thiếu gate chức năng.

## 13. Trạng thái merge readiness hiện tại

### Đã đủ
- Image E2E: PASS.
- MP4 render/playback E2E: PASS.
- Python 3.11 full core manual gate: PASS.
- Coverage: 81% PASS.
- Windows smoke: PASS.
- Exact-head Vercel preview deployment: READY.
- PR #2: mergeable.

### Còn ngoại lệ cần owner biết trước merge
- GitHub-hosted Actions chưa xanh do job không khởi chạy được; manual surrogate đã thay thế đầy đủ 3 core jobs cần thiết cho milestone này.
- Production persistence/GPU endpoint vẫn là hardening sau MVP, không phải blocker của functional acceptance hiện tại.

### VIDEO-E2E-01D.2B.5A — MANUAL PYTHON 3.13 COMPATIBILITY GATE
**PASS**

- Tested HEAD: `d3007d2962a2fa536eb0d13257c53be5f60c8d3d`.
- Python: 3.13.15.
- Redis: PASS.
- Dependencies: PASS.
- Compile: PASS.
- Full pytest: PASS (`PYTEST EXIT CODE: 0`).
- Coverage: 81% PASS.
- coverage.xml export: PASS.
- Acceptance lock: `acceptance/video-e2e-01d-2b5a-py313-pass`.

**Hosted core CI surrogate status:** COMPLETE

- Python 3.11 core: MANUAL PASS.
- Python 3.13 core: MANUAL PASS.
- Windows smoke: MANUAL PASS.

### Bước kế tiếp chính xác
`VIDEO-E2E-01D.2B.5B — COMPLETE CI SURROGATE LOCK → OWNER MERGE GATE`

Hosted GitHub Actions không còn là blocker bắt buộc cho milestone này, nhưng vẫn được ghi nhận là unavailable/red trước-step do account/billing.

**Không merge `main` tự động.**


## Canonical Product UI — KTN-VIDEO-UI-PROD-01

**Decision:** `ui_preview/` is the canonical product-facing browser UI for Vercel. The directory name is retained temporarily for deployment stability; it is no longer classified as mockup-only.

**`webui/Main.py` remains Engine/Admin Console**, used for deep provider settings, task manager/recovery, credential backup/restore, local/headless operations, and advanced MoneyPrinterTurbo controls.

Product architecture:

```text
Browser user
  → ui_preview (official product UI)
  → Vercel API adapters
  → Gemini/OpenAI / KTN Image Gateway / MPT Render Worker

Operations/admin
  → webui/Main.py (Streamlit Engine/Admin Console)
```

Cutover branch: `ui-prod-01-canonical-cutover`.

Product-facing copy has been changed from **Bản xem trước** to **Bản chính thức** without changing runtime API behavior. Detailed capability map: `docs/KTN_AI_VIDEO_STUDIO_CANONICAL_UI.md`.

Acceptance sequence: Vercel preview READY → HTTP/UI/system-status smoke → merge to `main` → production deployment → production smoke → close hardening.


## 14. V1 / V2 product split — 04/10/2026

### Owner decision

The custom KTN Script Model training program is **deferred to V2**.

V1 must be completed as a stable, usable AI Video Studio using hosted LLM providers and the existing KTN runtime architecture before any custom LLM training is resumed.

### V1 definition

**KTN AI Video Studio V1** includes:

1. Project-centric product UI.
2. Named multi-project workflow and recovery.
3. Reusable Channel Profile / Channel DNA.
4. Hosted LLM script generation through provider/model registry.
5. Multi-pass Script Quality Engine: Brief → Angle → Outline → Hook/Sections → Rewrite/Humanize → QA.
6. Scene Quality workflow: Board/List, purpose, visual intent, continuity, edit/split/merge/reorder/lock, Scene QA.
7. Voice Studio: Voice Library, provider selection, clone workflow where provider supports it, batch queue, progress, retry, Scene Audio QA.
8. Image generation provider routing with truthful live readiness.
9. Subtitle generation/editing sufficient for final video export.
10. Render Worker integration and real MP4 output.
11. Project/asset persistence and recovery sufficient for V1 acceptance.
12. One canonical V1 release branch and one production release after regression + owner acceptance.

### V2 definition

**KTN AI Video Studio V2** starts only after V1 is stable.

V2 includes:
- KTN Script Model benchmark;
- Golden Dataset build;
- LoRA/QLoRA pilot;
- local KTN Script Server;
- student-model QA routing;
- hosted LLM fallback A/B;
- continuous dataset improvement under the separate Script Model Source of Truth.

The separate document `docs/KTN_SCRIPT_MODEL_SOURCE_OF_TRUTH_V1.md` remains valid for V2, but its training gates are frozen during V1 completion.

### V1 completion rule

V1 is **100% complete only when every gate below is PASS**:

| Gate | Requirement | Status |
|---|---|---|
| V1-G01 | Consolidate current product branches into one RC baseline | PASS — `release/v1-rc1` |
| V1-G02 | Script Quality multi-pass workflow passes real Vietnamese Long + Short tests | BLOCKED_PROVIDER — Gemini high demand / Free Tier quota during 2026-10-04 real test |
| V1-G03 | Scene Quality owner functional/visual acceptance | TECH PASS / OWNER VISUAL PENDING |
| V1-G04 | Voice Studio real batch + retry/progress acceptance; clone acceptance when provider available | TECH + REAL TTS PASS / OWNER BATCH + CLONE PENDING |
| V1-G05 | Image runtime live; create/regenerate image E2E PASS | BLOCKED_PROVIDER/RUNTIME — Gemini Image Free Tier 0; KTN FLUX offline; OpenAI not configured |
| V1-G06 | Subtitle workflow acceptance | TECH PASS / FINAL MP4 VERIFICATION DEFERRED TO G07 |
| V1-G07 | Render Worker live; final MP4 E2E + playback PASS | BLOCKED_RUNTIME — configured but ready=false; API key not configured |
| V1-G08 | Project save/restore/export/import regression PASS | TECH PASS / BROWSER E2E PENDING |
| V1-G09 | Provider/readiness/error-state regression PASS | TECH PASS |
| V1-G10 | Golden end-to-end project from Brief → MP4 PASS | PENDING |
| V1-G11 | Owner acceptance + freeze V1 RC | PENDING |
| V1-G12 | Merge one approved RC to `main` + production smoke PASS | PENDING |


### V1-G03A technical regression note — 04/10/2026

- Board/List, Scene Editor, Split/Merge, Reorder, Lock AI, aspect-ratio correctness and Scene QA passed structural regression.
- AI-generated scenes now require explicit visual + continuity review before QA can reach full PASS.
- Added explicit `Duyệt cảnh` action to prevent false-green Scene QA.
- Dynamic aspect ratio follows current Render Aspect / platform default; generated image asset stores its ratio and Scene QA detects mismatch.
- Detailed evidence: `docs/V1_G03A_SCENE_QUALITY_REGRESSION_2026-10-04.md`.
- Gate remains open only for owner visual/functional acceptance.

### V1-G02A real test note — 04/10/2026

- Multi-pass implementation is deployed and structurally PASS.
- Real YouTube Short test attempted against Gemini 3.8 / 3.7 / 3.6 and Gemini 3.1 Pro Preview.
- 3.8 / 3.7 / 3.6 returned provider high-demand and/or Free Tier RPM pressure.
- Gemini 3.1 Pro Preview reported hard Free Tier quota of 0 input tokens/minute.
- Quota-aware retry was added: transient overload backs off; explicit retry-after is honored; hard quota stops immediately.
- Real final script + QA >=80 + owner review could not be completed in this window.
- Detailed evidence: `docs/V1_G02A_REAL_MULTIPASS_SCRIPT_TEST_2026-10-04.md`.
- Gate remains **NOT PASS** until a real provider produces both Short and Long outputs and owner quality review passes.


### V1 RC1 parallel gate note — 04/10/2026

While V1-G02 is provider-blocked, non-Gemini gates continue in parallel.

Verified:
- V1-G03 technical Scene Quality regression PASS; owner visual acceptance pending.
- V1-G04 Gemini TTS real generation PASS twice with valid WAV output; batch UI/clone owner acceptance pending.
- V1-G05 real Gemini Image call BLOCKED by provider Free Tier (0 input tokens/min); KTN FLUX remains offline.
- V1-G06 technical Subtitle editor/validator/exact-SRT-to-render contract PASS; final MP4 subtitle validation belongs to G07.
- V1-G08 full Project read-back fingerprint/import validation technical PASS; browser IndexedDB E2E pending.
- V1-G09 configured-vs-ready semantics technical PASS.
- Current consolidated evidence: `docs/V1_RC1_GATE_STATUS_2026-10-04.md`.

GitHub Actions currently reports no-step failures for standard CI jobs, with no retrievable job-log blob; this pattern also existed on an earlier Voice Studio PR. Exact CI infrastructure/account cause remains unresolved and must not be misreported as an application-code failure.

### V1 non-provider technical progress — 04/10/2026

- V1-G03 Scene Quality: technical regression PASS; AI-generated scenes now require visual + continuity review; owner visual acceptance pending.
- V1-G04 Voice Studio: technical regression PASS; real batch/clone provider acceptance pending.
- V1-G06 Subtitle: technical regression PASS; fixed silent-scene timeline drift; owner browser check pending.
- V1-G08 Project persistence: technical contract PASS with read-back fingerprint verification; browser IndexedDB E2E pending.
- V1-G09 Provider/readiness/error-state: technical PASS; runtime blockers are shown truthfully.

Evidence:
- `docs/V1_G03_SCENE_QUALITY_REGRESSION_2026-10-04.md`
- `docs/V1_G06_SUBTITLE_REGRESSION_2026-10-04.md`
- `docs/V1_G08_PROJECT_PERSISTENCE_REGRESSION_2026-10-04.md`
- `docs/V1_G09_PROVIDER_READINESS_REGRESSION_2026-10-04.md`

### V1 runtime gate technical status — 04/10/2026

- V1-G04 Voice Studio: TECH PASS; real TTS batch/clone acceptance pending.
- V1-G05 Image: TECH PASS; Gemini Image Free Tier unavailable in current key, KTN FLUX offline, OpenAI Image not configured.
- V1-G07 Render: TECH PASS; production readiness now requires URL + API key + health. Current URL exists but API key is missing, therefore configured=false / ready=false.

Evidence:
- `docs/V1_G04_VOICE_STUDIO_REGRESSION_2026-10-04.md`
- `docs/V1_G05_IMAGE_PIPELINE_REGRESSION_2026-10-04.md`
- `docs/V1_G07_RENDER_PIPELINE_REGRESSION_2026-10-04.md`

### Scope discipline

Until V1-G12 is PASS:

- Do not resume custom LLM training.
- Do not add unrelated product modules.
- Do not redesign architecture without a V1 blocker.
- Prefer fixing correctness, quality, persistence, runtime readiness and E2E reliability.
- New optional providers are not blockers if at least one supported provider passes the corresponding production workflow.
- A configured endpoint is never equal to a READY runtime; live probe remains authoritative.

### Canonical active branches

- Production: `main`
- Consolidated V1 RC baseline: `release/v1-rc1`
- Active V1 completion development: `v1-completion-01`
- Custom Script Model / V2 work: `script-model-01` — **FROZEN until V1 completion**
