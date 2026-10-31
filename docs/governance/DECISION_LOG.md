# KTN AI Video Studio - Decision Log

This log is append-only. Corrections must be added as new entries.

## 2026-10-28 - GOV-01 Central state discipline

**Decision:** Execute `V1-GOV-RECOVERY-01` before further feature work.

- GitHub committed state is authoritative.
- `release/v1-rc1` remains the canonical V1 RC baseline.
- PR #13 remains Draft and must not be merged.
- Chat, Work and Codex memory is non-authoritative.
- Temporary workspaces and Colab runtimes are ephemeral.
- Every completed session must update state, handoff and evidence, then commit and push.
- `v1-completion-01` is frozen pending reconciliation; no branch deletion or force update is authorized.
- G08 remains open because export/import fingerprint and delete/recover are unverified.

## Existing locked decisions

- V1 must close G01 through G12 before being called complete.
- Custom KTN Script Model work is deferred to V2.
- Mock or static evidence cannot close real provider/runtime gates.
- Configured does not equal ready.
- Product UI remains `ui_preview/`; Engine/Admin Console remains `webui/Main.py`.

## 2026-10-30 - GOV-02 G08 closure and runtime recovery

**Decision:** the later complete browser run supersedes the historical open-G08 note in GOV-01.

- G08 is PASS / CLOSED after A/B isolation, reload restore, export/import, delete/recover and fingerprint verification.
- Live FLUX runtime is proven by two real `HTTP 200` image generations; G05 still needs application UI persistence evidence.
- Authenticated MPT readiness is proven with `workerStatus=200`; G07 still needs completed MP4 playback evidence.
- Gemini high demand keeps G02 blocked; partial requests do not count as acceptance evidence.
- Colab Quick Tunnels are temporary acceptance infrastructure, not production hosting.

## 2026-10-31 - GOV-03 Six-minute acceptance and stable worker migration

**Decision:** execute the six-minute Golden Brief as the release canary and move
the image/render worker off Colab only after owner infrastructure approval.

- The product exposes a `5-7m` profile targeting approximately six minutes.
- G07 has real render and byte-complete download evidence, but playback/media QA
  remains open.
- G10 requires a real 345-375 second artifact and cannot be closed by a short
  smoke render.
- Paid worker provisioning requires recorded provider, region, GPU, budget,
  availability mode and endpoint decisions.
- G11 requires owner acceptance and an exact frozen RC commit.
- G12 remains blocked until the approved RC is merged and production smoke passes.
