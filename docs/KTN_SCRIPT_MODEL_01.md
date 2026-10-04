# KTN-SCRIPT-MODEL-01

Status: Gate A implementation
Owner goal: reduce dependency on hosted LLMs for Vietnamese YouTube/Facebook script production without sacrificing quality.

## 1. Decision

KTN will NOT pretrain an LLM from scratch.

KTN will benchmark small open-weight models, select one student model, fine-tune it on KTN-approved script tasks, serve it behind a local/OpenAI-compatible endpoint, and retain hosted LLM fallback when QA is below threshold.

Canonical pipeline:

Content Brief
→ Angle Planner
→ Outline Builder
→ Hook Writer
→ Section Writer
→ Rewrite/Humanize
→ Script Critic
→ Final Script
→ QA score
→ Local KTN model if score passes
→ Hosted fallback if score fails

## 2. Benchmark candidates

Primary benchmark:
- Qwen/Qwen3.5-4B
- google/gemma-3-4b-it
- microsoft/Phi-4-mini-instruct

Shadow candidate:
- google/gemma-4-E4B-it

The shadow candidate is tracked because Gemma 4 is newer than Gemma 3, but the owner-approved primary benchmark remains unchanged.

## 3. Training-method rule

Do not force one fine-tuning method across all models.

- Qwen3.5-4B: prefer BF16 LoRA pilot if Qwen wins benchmark.
- Gemma 3 / Phi-4-mini: QLoRA 4-bit pilot is allowed as the default low-cost experiment.
- Gemma 4 E4B: benchmark first; select training method only after compatibility/VRAM verification.

No training begins before the benchmark winner is selected.

## 4. Script Task Contract

KTN Script Model V1 is NOT a general chatbot.

Supported task types:
1. angle
2. outline
3. hook
4. section
5. rewrite
6. qa

Every training/evaluation record must contain:
- task
- language
- platform_mode
- channel_profile
- content_brief
- input
- target

Optional:
- facts
- constraints
- references
- metadata

See:
script_model/contracts/script_task.schema.json

## 5. Golden Dataset V1

Dataset must be quality-gated.

Target progression:
- Seed: 30–100 human-reviewed records
- Pilot: 500–1,500 records
- V1 training: 3,000–10,000 high-quality records
- Scale only after benchmark evidence shows improvement

Quality labels:
- GOLD: owner/editor accepted with no material rewrite
- SILVER: accepted after limited rewrite
- REJECT: never train on this record

Do not train directly on raw model output.

## 6. Benchmark rubric

Weighted score / 100:
- Instruction / contract adherence: 15
- Vietnamese naturalness: 15
- Channel DNA adherence: 15
- Hook / retention quality: 15
- Structure / coherence: 15
- Specificity / non-generic writing: 10
- Factual discipline: 10
- Rewrite usefulness / editorial control: 5

Automatic checks are only gates. Final model selection requires human scoring.

Winner rule:
- No hard failure.
- Mean score >= 75/100.
- Vietnamese naturalness >= 12/15.
- Channel DNA adherence >= 12/15.
- No material hallucination pattern.
- Latency/resource profile acceptable for KTN deployment.

## 7. Local inference contract

The local student service should expose an OpenAI-compatible endpoint:

POST /v1/chat/completions

Required health endpoints:
- GET /health
- GET /v1/models

Recommended deployment paths:
- llama.cpp server for GGUF inference
- vLLM when GPU server is available
- Ollama/LM Studio allowed for developer experiments, not canonical production

## 8. Hybrid fallback

The KTN app should never blindly trust the student model.

Student output
→ Script QA
→ score >= configured threshold: accept
→ score < threshold: send task to hosted fallback
→ preserve both outputs for A/B review
→ accepted output becomes future dataset candidate

Hosted fallback candidates:
- Gemini
- Claude
- OpenAI
- Grok

## 9. Acceptance gates

### Gate A — Dataset/benchmark design
- Model registry exists.
- Task contract schema exists.
- Benchmark case schema and initial cases exist.
- Golden dataset schema and seed records exist.
- Dataset validator passes.

### Gate B — Baseline benchmark
- Same cases run against all primary candidates.
- Raw outputs preserved.
- Human scoring sheet completed.
- Winner selected with evidence.

### Gate C — Fine-tune pilot
- Winner training method confirmed.
- Golden train/validation split frozen.
- Pilot adapter produced.
- Before/after benchmark run.
- Fine-tuned model must beat its own base model on KTN score.

### Gate D — Local inference
- Local endpoint starts.
- Health/model endpoints pass.
- Script-task request/response contract passes.
- Vietnamese long-form sample completes.

### Gate E — Gemini fallback A/B
- Same task can route Local vs Gemini.
- QA threshold can trigger fallback.
- Both outputs and scores stored.
- No silent fallback.
- Owner can see which model produced the selected script.

## 10. Current phase status

PASS:
- Architecture decision
- Candidate registry
- Task contract
- Benchmark rubric
- Dataset schema
- Seed dataset scaffold
- Validation/evaluation tooling scaffold

PENDING runtime:
- Download candidate weights
- Run baseline model benchmark
- Select winner
- Fine-tune pilot
- Export/quantize
- Local inference benchmark
- Gemini fallback A/B E2E
