# KTN Image Engine — Colab V1

Kiến trúc:

KTN AI Video Studio (Vercel) → KTN Image Gateway (Colab) → ComfyUI → FLUX.1-schnell FP8.

## Mục tiêu

- Không dùng API tạo ảnh trả phí.
- Dùng FLUX.1-schnell self-host.
- Colab chỉ là worker thử nghiệm.
- Khi chuyển sang GPU VPS, giữ nguyên contract và chỉ đổi URL worker.

## Contract

- `POST /v1/images/generations`
- model alias: `flux`
- response: `b64_json`
- output gateway: JPEG
- bảo vệ bằng `Authorization: Bearer <KTN_IMAGE_GATEWAY_TOKEN>`

## Cách chạy

1. Mở `KTN_IMAGE_ENGINE_COLAB.ipynb` bằng Google Colab.
2. Chọn **Runtime → Change runtime type → GPU**.
3. Chạy từng cell từ trên xuống.
4. Notebook tải checkpoint `flux1-schnell-fp8.safetensors` của Comfy-Org.
5. Cuối cùng notebook in:
   - `KTN_IMAGE_GATEWAY_URL`
   - `KTN_IMAGE_GATEWAY_TOKEN`
6. Hai biến này sẽ được nối vào Vercel Preview ở bước tích hợp.

Cloudflare Quick Tunnel chỉ dùng cho thử nghiệm và URL thay đổi khi phiên Colab kết thúc. Production sẽ dùng GPU VPS/domain cố định.

Workflow KTN được chuyển sang API-format dựa trên workflow FLUX.1 Schnell FP8 chính thức của Comfy-Org.
