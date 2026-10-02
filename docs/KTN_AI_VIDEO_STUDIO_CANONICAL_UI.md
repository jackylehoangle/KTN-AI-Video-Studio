# KTN AI Video Studio — Canonical Product UI Decision

## Milestone

`KTN-VIDEO-UI-PROD-01 — OFFICIAL UI AUDIT → PREVIEW VS WEBUI CAPABILITY MAP → CHOOSE CANONICAL PRODUCT UI → CUTOVER TO PRODUCTION`

## Decision

**Canonical product-facing UI:** `ui_preview/`

The directory name is retained temporarily for deployment stability, but it is no longer treated as a mockup-only surface. It is the official browser product UI for Vercel.

**Engine/Admin Console:** `webui/Main.py`

The Streamlit WebUI remains available for deep configuration, task management, provider administration, local/headless engine operation, task recovery, key backup/restore, and advanced MoneyPrinterTurbo capabilities. It is not the canonical public product-facing Vercel UI.

## Capability map

| Capability | ui_preview | webui/Main.py | Product decision |
|---|---|---|---|
| Vietnamese product UX | Yes | Yes | ui_preview primary |
| New project / save / import / export | Yes, browser/localStorage workflow | Task-oriented engine state | ui_preview primary |
| Script generation | Gemini/OpenAI serverless adapters | Multiple backend/provider paths | ui_preview primary, webui advanced |
| Script analysis → keywords/scenes | Yes | Engine workflow capabilities | ui_preview primary |
| Image generation | KTN Image Gateway + Gemini/OpenAI fallback | Material/image provider configuration | ui_preview primary |
| Voice generation | Gemini TTS | Broad TTS provider support + preview | ui_preview primary, webui advanced |
| Subtitle workspace | Yes | Full subtitle settings | ui_preview primary |
| Render video | MPT Render Worker API | Direct engine task pipeline | ui_preview primary |
| Render progress/status | API polling | Task manager + logs + recovery | ui_preview user-facing; webui ops |
| System health | `/api/system-status` | Direct runtime state | ui_preview user-facing |
| Task manager / recovery | Limited product workflow | Strong / mature | webui ops |
| Deep provider configuration | Limited/env-driven | Strong / mature | webui ops |
| Credential backup/restore | No | Yes | webui ops |
| Cross-post/social publishing | No product surface yet | Yes | webui ops |
| Local filesystem/open folders | No browser-native equivalent | Yes | webui ops |
| Vercel suitability | High | Low/complex for this architecture | ui_preview canonical |

## Architecture

```text
Browser / Product User
        ↓
ui_preview/  ← canonical product UI
        ↓
Vercel serverless API adapters
        ├─ Gemini / OpenAI
        ├─ KTN Image Gateway
        └─ MPT Render Worker
                 ↓
          MoneyPrinterTurbo engine

webui/Main.py
        ↓
Engine/Admin Console
        ├─ deep settings
        ├─ task manager/recovery
        ├─ provider administration
        └─ local/headless operations
```

## Cutover rules

1. Do not replace the Vercel product surface with Streamlit.
2. Do not remove `webui/Main.py`; it remains an operations/admin console.
3. Do not rename `ui_preview/` during this cutover because the Vercel project is already wired to the current directory structure.
4. Product-facing copy must no longer call the canonical UI a preview/mockup.
5. Production deployment must come from `main` after preview verification of the cutover branch.
6. Runtime/API behavior is unchanged by this UI naming cutover.

## Current cutover branch

`ui-prod-01-canonical-cutover`

First UI cutover commit:
`7794388abe4a7337426d51abd3a92b2153442b56`

## Acceptance gate

Before merging this branch to `main`:
- Vercel preview deployment READY.
- Home page HTTP 200.
- Product label shows **Bản chính thức**.
- Core UI shell loads.
- `/api/system-status` responds.
- No runtime/application/test files changed except the intended product UI/docs cutover.

After merge:
- Deploy `main`.
- Production smoke.
- Close `KTN-VIDEO-UI-PROD-01`.
