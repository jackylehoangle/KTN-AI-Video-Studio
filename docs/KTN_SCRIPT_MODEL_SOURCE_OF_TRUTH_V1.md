# KTN SCRIPT MODEL — SOURCE OF TRUTH V1

**Document ID:** KTN-SCRIPT-MODEL-SOT-V1  
**Version:** 1.0  
**Status:** ACTIVE / CANONICAL  
**Effective date:** 2026-10-04  
**Scope:** KTN AI Video Studio — training, evaluation, deployment and continuous improvement of the KTN Script Model  
**Canonical branch at creation:** `script-model-01`

---

## 0. Authority and change control

This document is the **Source of Truth** for the KTN Script Model program.

If an ad-hoc chat instruction, experiment note, implementation shortcut, notebook or code comment conflicts with this document, this document takes precedence unless the owner explicitly approves a change.

Any material change to the following requires an explicit owner decision and a version bump:
- model purpose or scope;
- canonical task contract;
- dataset acceptance policy;
- training data provenance rules;
- evaluation gates and thresholds;
- production fallback behavior;
- privacy, copyright or data-governance rules;
- deployment architecture;
- definition of PASS / FAIL.

Implementation details that do not change the above principles may evolve without a full SOT rewrite, but must remain auditable.

Every SOT change must append to the Change Log with:
- date;
- version;
- decision;
- reason;
- impact;
- owner approval status.

---

# 1. Business objective

KTN is building a narrow, controllable script-writing model for KTN AI Video Studio.

The purpose is **not** to recreate Gemini, Claude, OpenAI or Grok.

The purpose is to reduce dependency on hosted LLM APIs for repetitive script-production work while improving:
- Vietnamese naturalness;
- Channel DNA adherence;
- long-form structure;
- hook and retention quality;
- editorial controllability;
- consistency across projects;
- predictable cost and infrastructure control.

The product objective is:

> **A small KTN-owned script model that is excellent at the KTN script workflow, runs behind a KTN-controlled inference service, and safely falls back to a stronger hosted model whenever quality is insufficient.**

---

# 2. Non-goals

The KTN Script Model V1 is **not**:
- a general chatbot;
- a search engine;
- a fact database;
- a web research agent;
- an image generator;
- a TTS model;
- a coding assistant;
- a replacement for all frontier LLM tasks;
- a continuously self-training production model.

The model must not be expected to know current events or reliably supply facts that were not provided to it.

Research and factual evidence belong to a separate Research / Evidence layer.

---

# 3. Canonical architecture

The canonical writing pipeline is:

```text
Research / Evidence Pack
        ↓
Content Brief + Channel Profile
        ↓
Angle Planner
        ↓
Outline Builder
        ↓
Hook Writer
        ↓
Section Writer
        ↓
Rewrite / Humanize
        ↓
Script QA / Critic
        ↓
Final Script
        ↓
QA score
   ┌────┴─────┐
   │          │
 PASS      BELOW THRESHOLD
   │          │
   ▼          ▼
Local KTN   Hosted fallback
Model       Gemini / Claude /
            OpenAI / Grok
   │          │
   └────┬─────┘
        ▼
Owner/editor-selected final output
        ↓
Accepted Data Store
        ↓
Candidate data for future dataset versions
```

The model is never asked to write an entire long-form video in one uncontrolled request when a staged workflow is available.

---

# 4. Model strategy

## 4.1 Primary training target

**Preferred V1 training target:** `Qwen/Qwen3.5-4B`

The current reason for preferring Qwen3.5-4B is:
- small enough for KTN-controlled deployment;
- suitable for narrow specialization;
- commercially practical open-weight licensing in the current registry;
- compatible with the KTN multi-pass script architecture.

However, this preference does **not** override benchmark evidence.

## 4.2 Benchmark candidates

Primary baseline benchmark:
1. `Qwen/Qwen3.5-4B`
2. `google/gemma-3-4b-it`
3. `microsoft/Phi-4-mini-instruct`

Shadow candidate:
- `google/gemma-4-E4B-it`

## 4.3 Winner rule

Qwen3.5-4B remains the preferred training target **only if it passes Gate B**.

A different candidate may replace it if:
- it materially outperforms Qwen on the canonical KTN benchmark;
- Vietnamese quality is superior;
- Channel DNA adherence is superior;
- factual discipline is not worse;
- deployment resource cost remains acceptable;
- the owner approves the switch.

No model is selected based on general internet benchmarks alone.

---

# 5. Fine-tuning strategy

KTN will **not pretrain a model from scratch**.

KTN will **not use full fine-tuning as the default V1 method**.

Canonical approach:
- supervised fine-tuning of a strong open-weight base model;
- parameter-efficient adapter training;
- strict before/after evaluation.

Current policy:
- Qwen3.5-4B: prefer **BF16 LoRA** for the pilot;
- Gemma 3 4B: QLoRA 4-bit pilot allowed;
- Phi-4-mini: QLoRA 4-bit pilot allowed;
- Gemma 4 E4B: benchmark first, then choose training method.

Training method must follow the winner model; KTN does not force one method across all candidate architectures.

---

# 6. Script Task Contract

One model will support six explicit task types.

## 6.1 ANGLE

Purpose:
- find a differentiated central angle;
- define the viewer question;
- define the content promise;
- avoid generic topic restatement.

Typical output:
- `angle`
- `viewer_question`
- `promise`

## 6.2 OUTLINE

Purpose:
- turn the approved angle into a coherent long/short-form structure;
- assign a purpose and payoff to each section;
- maintain logical progression.

Typical output:
- ordered sections;
- section title;
- purpose;
- viewer question;
- payoff / transition.

## 6.3 HOOK

Purpose:
- create an opening that earns attention quickly;
- fit platform and Channel DNA;
- avoid generic AI language and prohibited phrases.

The hook must not promise facts that the evidence pack cannot support.

## 6.4 SECTION

Purpose:
- write one controlled section of a longer script;
- usually 250–700 words for long-form workflows;
- use previous/next context;
- end with a useful transition when appropriate.

For long-form YouTube, the model should normally write section-by-section rather than generate a full 10–20 minute script in one pass.

## 6.5 REWRITE / HUMANIZE

Purpose:
- remove machine-like phrasing;
- improve rhythm and spoken-language naturalness;
- preserve approved facts;
- preserve Channel DNA;
- remove prohibited phrases;
- make the text sound intentionally written, not generically generated.

## 6.6 QA / CRITIC

Purpose:
- score a candidate script or section;
- identify violations;
- identify weak retention, structure or factual discipline;
- produce a concrete rewrite plan.

QA is not allowed to silently invent a replacement script unless explicitly requested.

---

# 7. Canonical training/evaluation record

Every record must conform to:

`script_model/contracts/script_task.schema.json`

Required top-level fields:
- `id`
- `task`
- `language`
- `platform_mode`
- `channel_profile`
- `content_brief`
- `input`
- `target`
- `quality`

Optional:
- `facts`
- `constraints`
- `references`
- `metadata`

The same contract is used for:
- training records;
- validation records;
- benchmark records;
- A/B evaluation records.

This prevents training-time and production-time schema drift.

---

# 8. Channel DNA principle

Channel DNA must **not be baked permanently into the model for one channel**.

The model learns **how to obey a Channel Profile**.

At runtime, Channel Profile remains external structured context.

Canonical Channel Profile contains, at minimum:
- channel name;
- niche;
- default audience;
- tone;
- narrator persona;
- vocabulary style;
- opening style;
- storytelling pattern;
- forbidden phrases;
- fixed rules.

This enables one KTN Script Model to serve many channels without retraining per channel.

---

# 9. Platform contract

The model must distinguish:
- `youtube_long`
- `youtube_short`
- `facebook_short`

Dataset and evaluation must not treat these as interchangeable.

Pilot/V1 target mix:

| Platform | Target share |
|---|---:|
| YouTube Long | ~50% |
| YouTube Short | ~30% |
| Facebook Short / Reels | ~20% |

This mix may move by ±10 percentage points if real product usage justifies it, but changes must be recorded.

---

# 10. Golden Dataset policy

## 10.1 Dataset stages

The program progresses in controlled stages:

- Seed: 30–100 human-reviewed examples;
- Pilot: 500–1,500 examples;
- **KTN Pilot target: 1,000 reviewed records**;
- V1 expansion: approximately 5,000–8,000 high-quality records;
- larger scale only after measurable evidence of improvement.

The model must never be trained merely because enough examples exist.

**Quality outranks volume.**

## 10.2 Pilot 1,000 record target

Initial target allocation:

| Task | Target records |
|---|---:|
| Angle | 100 |
| Outline | 120 |
| Hook | 180 |
| Section | 300 |
| Rewrite / Humanize | 200 |
| QA / Critic | 100 |
| **Total** | **1,000** |

A ±10% task-level adjustment is allowed if dataset review reveals a quality imbalance.

## 10.3 Quality labels

### GOLD
- reviewed by owner/editor;
- accepted with no material rewrite;
- may enter training, validation or benchmark pools subject to split rules.

### SILVER
- useful and accepted after limited editorial correction;
- may enter training only;
- should not dominate the dataset.

### REJECT
- inaccurate, generic, structurally weak, off-DNA or otherwise unusable;
- **never used as a positive training target**.

Rejected examples may be retained separately for:
- negative analysis;
- QA training;
- before/after rewrite pairs;
- regression testing.

## 10.4 Raw synthetic output rule

Raw Gemini/Claude/OpenAI/Grok output is **not automatically Golden Data**.

Synthetic output becomes eligible only after:
1. automated schema checks;
2. rule checks;
3. factual/evidence review when applicable;
4. human/editor review;
5. explicit quality label.

---

# 11. Dataset provenance

Allowed sources, in order of preference:

1. scripts/sections written and approved by KTN;
2. owner/editor-finalized outputs from real KTN Video Studio usage;
3. teacher-model output that has been human-reviewed and accepted;
4. before/after rewrite pairs where the accepted version is clearly marked;
5. KTN-owned, licensed or public-domain text suitable for the task.

Not allowed as training targets:
- unreviewed web-scraped scripts;
- copyrighted transcripts copied from creators without permission/license;
- private client material outside the agreed data rights;
- raw user secrets or unnecessary personal data;
- AI output whose provenance cannot be reconstructed;
- benchmark/test records copied into the training split.

Every production-scale training record should have traceable provenance in `metadata`.

---

# 12. Teacher generation pipeline

Hosted LLMs are used as **teachers**, not as unquestioned truth.

Canonical dataset-generation flow:

```text
Brief + Channel Profile + Evidence
        ↓
2–3 teacher candidates
(Gemini / Claude / OpenAI as available)
        ↓
Automatic contract/rule checks
        ↓
Optional AI judge for triage
        ↓
Human/editor review
        ↓
GOLD / SILVER / REJECT
        ↓
Golden Dataset candidate
```

An AI judge may prioritize review but may **never be the sole authority** that promotes a record to GOLD.

---

# 13. Research and factual discipline

Fine-tuning improves writing behavior; it does not make the student model a reliable current-facts engine.

For factual videos:

```text
Research Agent / Source Pack
        ↓
Verified facts / citations / constraints
        ↓
KTN Script Model
```

Rules:
- factual claims should come from supplied Evidence Pack when the task is evidence-dependent;
- the model must not fabricate research citations;
- uncertainty must be expressed when evidence is insufficient;
- QA must flag unsupported claims;
- factual discipline is a non-regression dimension.

---

# 14. Dataset split and leakage prevention

For each frozen training version:

Recommended default:
- 80% training;
- 10% validation;
- 10% test/holdout.

Critical rule:
**split by topic/source family, not only by random row.**

Related examples from the same original script, source article or content family should remain in the same split where possible.

The canonical benchmark set must never be mixed into training.

Before a training run:
- dataset version is frozen;
- train/validation/test file hashes are recorded;
- benchmark version is recorded;
- model base revision is recorded.

No post-hoc editing of the frozen test set is allowed during the same experiment.

---

# 15. Baseline benchmark

Before fine-tuning, all primary candidates must run the same cases under the same task contract.

Canonical benchmark rubric /100:

| Dimension | Points |
|---|---:|
| Instruction / contract adherence | 15 |
| Vietnamese naturalness | 15 |
| Channel DNA adherence | 15 |
| Hook / retention quality | 15 |
| Structure / coherence | 15 |
| Specificity / non-generic writing | 10 |
| Factual discipline | 10 |
| Rewrite usefulness / editorial control | 5 |
| **Total** | **100** |

Hard failures:
- required output missing;
- wrong language;
- ignores forbidden Channel rules;
- fabricated fact presented as source fact;
- invalid/unusable JSON when JSON is required.

Baseline winner threshold:
- no hard failure pattern;
- mean score >= 75/100;
- Vietnamese naturalness >= 12/15;
- Channel DNA adherence >= 12/15;
- acceptable latency/resource profile.

Human scoring remains required for final model selection.

---

# 16. Fine-tune pilot configuration

The pilot must be intentionally small and measurable.

Current Qwen3.5-4B pilot defaults:

- method: BF16 LoRA;
- pilot dataset: approximately 1,000 reviewed records;
- max sequence length: 4,096 tokens initially;
- effective batch size target: 16;
- epoch: 1 initially;
- deterministic seed: 3407;
- early stop/regression checks enabled;
- validation checked before any V1 expansion.

Suggested experiment defaults, not immutable policy:
- LoRA rank: 16 initially;
- LoRA alpha: 32;
- dropout: 0–0.05;
- learning rate around 1e-4 as a first experiment;
- optimizer/scheduler chosen by the actual training framework.

These hyperparameters may change without changing the SOT, provided:
- the run is logged;
- the dataset is unchanged;
- before/after evaluation is preserved;
- the change is experimental rather than a hidden production change.

---

# 17. Fine-tune acceptance gate

The fine-tuned model must be compared against the exact base model.

PASS requires:
- benchmark mean improves by at least **+5 points** or an owner-approved equivalent gain;
- no regression in:
  - Vietnamese naturalness;
  - Channel DNA adherence;
  - factual discipline;
- no new hard-failure pattern;
- no obvious overfitting or phrase-template collapse;
- long-form section quality remains coherent;
- inference resource profile remains deployable.

If the adapter does not materially beat the base model, **do not deploy it**.

Training activity itself is never considered success.

---

# 18. Overfitting controls

Watch for:
- repeated identical hooks;
- repeated transitions;
- same sentence rhythm across unrelated channels;
- overuse of dataset catchphrases;
- leaking one Channel DNA into another;
- excessive imitation of teacher model style;
- degradation on unseen topics;
- overly confident unsupported claims.

Mitigations:
- diverse topics and channels;
- balanced task mix;
- strong held-out test set;
- before/after n-gram/repetition analysis;
- multiple-channel evaluation;
- manual blind review;
- stop training when validation/editorial quality regresses.

---

# 19. Inference architecture

The canonical product architecture is:

```text
KTN AI Video Studio (Vercel UI)
        ↓
KTN Script Gateway / Orchestrator
        ↓
KTN Script Server
        ↓
KTN-Script-4B-V1
        ↓
QA
        ↓
Fallback provider when needed
```

Vercel does not host the model weights.

The KTN Script Server must expose an OpenAI-compatible interface where practical:

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`

Acceptable inference backends:
- llama.cpp server for GGUF/local deployment;
- vLLM on suitable GPU servers;
- Ollama / LM Studio for development experiments only.

---

# 20. Quantization and packaging

Quantization happens **after** the adapter passes quality gates.

Canonical sequence:

```text
Base model
+ approved LoRA adapter
        ↓
merge/export
        ↓
quality re-check
        ↓
quantize for deployment
        ↓
inference benchmark
        ↓
production candidate
```

A quantized model must be re-benchmarked because quantization can change output quality.

The first production target may use 4-bit inference if quality remains acceptable.

---

# 21. Production routing and fallback

The product must never silently assume the local student output is good enough.

Canonical routing:

```text
Local KTN model output
        ↓
Script QA
        ↓
score >= 80
        → accept candidate
score < 80
        → hosted fallback
```

The threshold 80 is the current production starting point and may be calibrated using real A/B data.

Fallback candidates:
- Gemini;
- Claude;
- OpenAI;
- Grok.

Rules:
- fallback must be visible in logs;
- selected model/provider must be stored with the output;
- both local and fallback results may be retained for evaluation when policy permits;
- no silent provider switching.

---

# 22. Accepted Data Store and continuous improvement

Production usage is a source of **candidate training data**, not automatic online learning.

Examples:

### Case A
KTN model output accepted unchanged:
- candidate for GOLD after review.

### Case B
KTN output edited by owner:
- original = negative/reference;
- edited final = candidate GOLD/SILVER;
- diff is valuable Rewrite training data.

### Case C
KTN output rejected, Gemini selected:
- KTN output = failure example;
- Gemini final = candidate after review;
- fallback reason should be logged.

There is **no automatic production retraining**.

Dataset V2/V3 are built in controlled batches, reviewed, versioned and benchmarked again.

---

# 23. Data governance, privacy and IP

Minimum rules:
- collect only data needed for script training;
- remove secrets, tokens, credentials and unnecessary PII;
- track data ownership/provenance;
- respect client data agreements;
- do not use customer content for model training unless KTN has the right to do so;
- do not train on unauthorized copyrighted transcripts;
- do not publish training datasets containing confidential information;
- keep API keys server-side;
- separate production logs from curated training records.

Any uncertain data-rights case defaults to **DO NOT TRAIN** until clarified.

---

# 24. Reproducibility

Every training run must record:
- run ID;
- date/time;
- base model ID + revision;
- adapter/training code revision;
- dataset version + file hashes;
- train/validation/test counts;
- benchmark version;
- hyperparameters;
- hardware/GPU;
- framework versions;
- random seed;
- output adapter path/hash;
- benchmark before/after;
- human review result;
- PASS/FAIL decision.

If a run cannot be reproduced or audited, it cannot become the production canonical model.

---

# 25. Model naming and versioning

Canonical names:

`KTN-Script-4B-V1` — first production candidate.

Adapter examples:
- `ktn-script-qwen35-4b-lora-pilot01`
- `ktn-script-qwen35-4b-lora-v1.0`

Dataset examples:
- `KTN-Golden-Script-Pilot-1000-v1`
- `KTN-Golden-Script-V1-8000`

Benchmark:
- `KTN-Script-Benchmark-v1`

Never overwrite a released model/dataset version in place.

Create a new version.

---

# 26. PASS / FAIL gates

## Gate A — Design
PASS when:
- Source of Truth exists;
- model registry exists;
- task contract exists;
- benchmark rubric exists;
- benchmark cases exist;
- Golden Dataset schema exists;
- validator/harness exists.

## Gate B — Base Model Benchmark
PASS when:
- all primary models run the same benchmark;
- outputs are preserved;
- human scorecards completed;
- winner selected with evidence.

## Gate C — Golden Dataset Pilot
PASS when:
- approximately 1,000 reviewed records are complete;
- provenance is present;
- no benchmark leakage;
- train/validation/test split frozen;
- validator passes.

## Gate D — Fine-tune Pilot
PASS when:
- adapter trains successfully;
- fine-tuned model beats its base by required margin;
- no critical-dimension regression;
- human review passes.

## Gate E — Local Inference
PASS when:
- model server starts;
- health/model/chat endpoints work;
- Vietnamese long-form section completes;
- resource/latency profile is acceptable;
- quantized build still passes quality gate.

## Gate F — Hybrid A/B
PASS when:
- Local and hosted model can receive the same task;
- QA threshold triggers fallback;
- source model is visible;
- outputs/scores are logged;
- owner can select the preferred result.

## Gate G — Product Pilot
PASS when:
- real Video Studio users can create scripts through the new pipeline;
- accepted/rejected data is captured correctly;
- no silent quality regression;
- rollback to hosted-only mode exists.

---

# 27. Current status — 2026-10-04

### PASS
- architecture decision;
- candidate registry;
- Script Task Contract;
- six task types;
- benchmark rubric;
- benchmark case scaffold;
- Golden Dataset seed scaffold;
- dataset validator;
- OpenAI-compatible benchmark runner;
- scorecard tooling;
- pilot training policy manifest;
- Source of Truth V1.

### PENDING
- run baseline candidate models;
- complete human scorecards;
- select confirmed Gate B winner;
- build Pilot Golden Dataset ~1,000;
- freeze train/validation/test;
- train BF16 LoRA pilot if Qwen remains winner;
- before/after benchmark;
- merge/export;
- quantized inference;
- local Script Server;
- Gemini/Claude/OpenAI/Grok fallback A/B;
- production pilot.

---

# 28. Exact next sequence

The canonical next work is:

```text
01B — BASE MODEL RUNTIME
  ↓
RUN IDENTICAL BENCHMARK
  ↓
QWEN3.5-4B vs GEMMA3-4B vs PHI4-MINI
(+ GEMMA4-E4B SHADOW)
  ↓
HUMAN SCORECARD
  ↓
SELECT / CONFIRM WINNER
  ↓
01C — BUILD GOLDEN DATASET PILOT ~1,000
  ↓
FREEZE SPLITS
  ↓
BF16 LoRA PILOT (if Qwen wins)
  ↓
BEFORE / AFTER BENCHMARK
  ↓
LOCAL INFERENCE
  ↓
HOSTED FALLBACK A/B
```

No GPU training should begin before Gate B and Gate C are complete.

---

# 29. Repository references

Canonical implementation files:
- `docs/KTN_SCRIPT_MODEL_01.md`
- `docs/KTN_SCRIPT_MODEL_SOURCE_OF_TRUTH_V1.md`
- `script_model/model_registry.json`
- `script_model/contracts/script_task.schema.json`
- `script_model/benchmark/rubric.json`
- `script_model/benchmark/cases_v1.jsonl`
- `script_model/benchmark/run_openai_compatible.py`
- `script_model/benchmark/score_results.py`
- `script_model/data/golden_v1_seed.jsonl`
- `script_model/tools/validate_dataset.py`
- `script_model/train/pilot_config.json`

---

# 30. Change Log

## v1.0 — 2026-10-04
- Created dedicated Source of Truth for the KTN Script Model.
- Locked the narrow six-task architecture.
- Locked Golden Dataset quality/provenance principles.
- Locked baseline/fine-tune/inference/fallback gates.
- Set Qwen3.5-4B as preferred V1 target subject to Gate B evidence.
- Set BF16 LoRA as the preferred Qwen pilot method.
- Set Pilot Golden Dataset target at approximately 1,000 reviewed records.
- Locked no-online-learning, no-benchmark-leakage and no-unauthorized-data rules.
