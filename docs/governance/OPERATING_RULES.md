# KTN AI Video Studio - Operating Rules

**Effective:** 2026-10-28  
**Scope:** Chat, Work, Codex, local workspaces, browser acceptance and runtime operations.

## 1. Authority order

1. GitHub committed code and evidence on the canonical RC branch.
2. `docs/governance/PROJECT_STATE.yaml`.
3. `docs/KTN_AI_VIDEO_STUDIO_SOURCE_OF_TRUTH.md`.
4. Gate-specific evidence documents.
5. `docs/governance/SESSION_HANDOFF.md`.
6. ChatGPT Library as a secondary archive and user-facing deliverable store.
7. Conversation summaries or agent memory only as leads requiring verification.

Chat, Work and Codex memory is not a shared database and is never sufficient evidence for PASS.

## 2. Branch discipline

- V1 RC baseline: `release/v1-rc1`.
- Production: `main`.
- `v1-completion-01` is frozen because it diverged from the RC.
- `script-model-01` remains frozen for V2.
- No merge, force push, branch deletion or history rewrite without owner approval.
- New work must identify its gate and start from a verified canonical HEAD.

## 3. Session start

Every implementation or acceptance session must:

1. Fetch repository state.
2. Verify branch and exact HEAD.
3. Read Project State, Session Handoff and Source of Truth.
4. Read evidence for the active gate.
5. Confirm that the requested task matches the recorded next action.
6. Stop and report any branch or document mismatch before editing.

## 4. Session finish

A session is handed over only when:

1. Tests and evidence are recorded.
2. Project State is updated.
3. Session Handoff is updated.
4. Evidence Index is updated.
5. Changes are committed and pushed.
6. The exact branch and commit are reported.

Uncommitted workspace changes, browser state, terminal output and chat summaries are temporary evidence only.

## 5. Gate discipline

- PASS requires reproducible evidence tied to a commit, deployment or runtime.
- Mock tests cannot close a gate requiring a real provider or runtime.
- Configured does not mean ready.
- Partial browser acceptance must be recorded as partial.
- A failed or interrupted test must not be rewritten as PASS.
- G11 and G12 remain blocked until all prerequisite gates pass.

## 6. Storage boundaries

- GitHub: code, specifications, state, decisions and technical evidence.
- Library: durable user deliverables and secondary report copies.
- IndexedDB: browser project data bound to one origin; export is required for recovery.
- Colab and scratch workspaces: ephemeral and not authoritative.
- Secrets: environment or secret manager only, never committed to documents.

## 7. Consistency rule

If Project State, Source of Truth, Handoff, PR text and gate evidence disagree, the session must stop feature work and open a governance reconciliation task.
