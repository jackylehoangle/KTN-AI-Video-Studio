# V1 - STABLE WORKER INFRASTRUCTURE MIGRATION PLAN

**Date:** 2026-10-31 (GMT+7)
**Branch:** `release/v1-rc1`
**Status:** DESIGN READY / OWNER INFRASTRUCTURE APPROVAL REQUIRED

## Purpose

Replace the temporary Colab T4 and Cloudflare Quick Tunnel runtime with a
persistent GPU worker while preserving the current application contracts:

- KTN Image Gateway: `POST /v1/images/generations`.
- MoneyPrinterTurbo Render Worker: `/api/v1/tasks` and task download routes.
- Vercel remains the browser-facing application and same-origin MP4 proxy.

The migration must not change the project format, render task identity or browser
persistence behavior.

## Recommended baseline

| Resource | Minimum acceptance baseline |
|---|---|
| GPU | NVIDIA GPU with 16 GB VRAM or more |
| CPU | 4 vCPU or more |
| Memory | 16 GB RAM or more |
| Persistent disk | 100 GB SSD or more |
| Operating system | Supported Ubuntu LTS with NVIDIA drivers |
| Region | Near the primary Vietnamese users; Singapore is the initial preference |
| Availability | Persistent instance or a managed worker with persistent volume and stable endpoint |

The current FLUX.1-schnell FP8 checkpoint is approximately 16.05 GB. The disk
baseline includes the model, ComfyUI, Python environments, render workspaces,
logs and temporary media. Final sizing must be confirmed against the selected
provider before purchase.

## Production topology

1. Bind ComfyUI to localhost only on port `8188`.
2. Expose KTN Image Gateway `8189` and Render Worker `8090` only through a
   stable HTTPS reverse proxy or a named authenticated tunnel.
3. Require separate strong bearer credentials for image and render services.
4. Store models, task manifests and completed MP4 files on persistent storage.
5. Keep the Vercel MP4 proxy as the browser download boundary.
6. Restrict ingress to the application path where the provider supports it.

## Security and operations requirements

- Secrets are injected by the platform secret store and never committed or
  printed in logs.
- Services run as a non-root user where supported and restart automatically.
- Health checks cover ComfyUI, Image Gateway and authenticated Render Worker
  readiness independently.
- Logs include task ID, state, duration and error class, but not tokens or source
  media payloads.
- Completed task storage has an explicit retention policy and low-disk alert.
- A backup or reproducible model bootstrap is documented and tested.
- Monitoring alerts on worker unavailability, queue growth, render failure rate,
  disk usage and GPU memory exhaustion.

## Migration runbook

1. Record owner approval for provider, region, GPU SKU, monthly budget,
   always-on versus scheduled operation, and public domain strategy.
2. Provision the GPU worker and persistent disk without changing Vercel.
3. Install pinned repository code from the approved RC commit.
4. Restore the FLUX checkpoint and verify its expected size or checksum.
5. Start all three services and pass local authenticated smoke tests.
6. Configure stable HTTPS and rotate new image/render credentials.
7. Run one image smoke task and one three-second MP4 smoke task directly.
8. Update Vercel Preview variables and redeploy Preview only.
9. Run the six-minute G10 Golden Brief as the migration canary.
10. Verify playback, download byte equality, ffprobe/media QA and persistence.
11. Keep the old runtime available until the canary passes, then retire it.

## Rollback

- Preserve the previous Vercel variable set until the stable worker passes G10.
- If readiness or canary media QA fails, restore the previous Preview variables
  and redeploy without creating another paid render task for the same project.
- Do not alter Production variables or merge `main` during migration.

## Approval gate

No paid infrastructure may be provisioned and no recurring spend may be accepted
until the owner records all of the following:

- provider;
- region;
- GPU type;
- maximum monthly budget;
- always-on or scheduled availability;
- domain or named-tunnel choice.

After approval, successful provisioning and the six-minute canary are execution
evidence. This design document alone does not close G07, G10, G11 or G12.
