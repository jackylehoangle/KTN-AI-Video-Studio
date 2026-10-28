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
