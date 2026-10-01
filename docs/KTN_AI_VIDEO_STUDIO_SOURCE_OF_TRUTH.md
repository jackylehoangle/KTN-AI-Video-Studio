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
