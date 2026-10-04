# V1-G02A — REAL MULTI-PASS SCRIPT TEST REPORT

**Date:** 2026-10-04 (GMT+7)  
**Gate:** `V1-G02A — REAL MULTI-PASS SCRIPT TEST → YOUTUBE LONG + YOUTUBE SHORT → ANGLE/OUTLINE VISIBILITY → FINAL SCRIPT QA ≥80 → OWNER QUALITY REVIEW → FIX UNTIL PASS`  
**Release branch:** `release/v1-rc1`  
**Current gate status:** **BLOCKED_PROVIDER / NOT PASS**

## 1. What was implemented before the real test

The V1 Script Quality Engine now executes:

```text
Brief
→ Angle
→ Outline
→ Hook
→ Section 1..N
→ Humanize / Rewrite
→ QA
→ QA < 80 or decision != PASS → Repair
→ QA again
→ Final Script
```

The project persists the Script Workflow artifact with the Project.

The Script Workspace displays:
- Angle;
- Outline;
- workflow stage state;
- progress %;
- QA score;
- QA problems/rewrite plan.

## 2. Real self-test cases

### YouTube Short
Channel: KTN Tech  
Topic: Why a company can have CRM, chatbot and AI while staff still copy data from Zalo to Excel.

### YouTube Long
Channel: The Hidden Mind  
Topic: Why people know they need to change but keep repeating old habits.

The Long test is not executed until the provider can pass the initial stage, to avoid unnecessary quota burn while the provider is unavailable.

## 3. Real provider results

### Gemini 3.8 Flash
Result: **FAIL — provider high demand**

Observed message:
`gemini-3.8-flash is currently experiencing high demand`

Retry behavior:
- initial call;
- controlled transient retry;
- exponential backoff;
- final stop with HTTP 502 after provider remains unavailable.

### Gemini 3.7 Flash
Result: **FAIL — provider high demand**

### Gemini 3.6 Flash
Result: **FAIL — provider high demand / Free Tier RPM pressure**

Provider also reported a Free Tier limit of 5 requests/minute during retry.

### Gemini 3.1 Pro Preview
Result: **FAIL — hard quota**

Observed:
`limit: 0 input tokens per minute on Free Tier`

After the quota-aware retry fix, hard quota now stops immediately and is **not retried**.

## 4. Reliability fixes made because of the test

### Retry policy
The Script Workflow now distinguishes:

1. transient high demand / overload  
   → controlled exponential backoff;

2. explicit provider retry-after  
   → wait according to provider retry time (capped);

3. hard quota such as 0 requests/day or 0 input tokens/minute  
   → stop immediately; no useless retry;

4. non-transient errors  
   → fail immediately.

This prevents infinite loops and unnecessary quota consumption.

## 5. Verification evidence

Vercel Preview deployment:
- branch: `release/v1-rc1`
- latest tested commit: `a5b20980014ea17ecfb661934af0dffcb0ec5c72`
- deployment state: READY.

Runtime logs confirm:
- transient retry attempts for Gemini 3.8;
- no retry for Gemini 3.1 Pro hard quota after the quota-aware fix.

## 6. PASS / FAIL decision

### Structural/implementation checks
- Multi-pass endpoint deployed: **PASS**
- Angle/Outline/Hook/Section/Rewrite/QA/Repair contract: **PASS**
- Workflow UI/artifact visibility implemented: **PASS**
- Project persistence for workflow artifacts: **PASS**
- Retry hardening: **PASS**

### Real content acceptance
- YouTube Short final script: **BLOCKED**
- YouTube Long final script: **BLOCKED**
- Final QA >= 80: **NOT TESTED**
- Owner quality review: **NOT TESTED**

**V1-G02A remains NOT PASS.**

## 7. Exact unblock conditions

At least one real script provider must become available.

Current Vercel provider status:
- Gemini: configured, but currently overloaded/quota-limited during this test window.
- OpenAI: not configured.
- Anthropic Claude: not configured.
- xAI Grok: not configured.

When Gemini is available again, rerun Short first. If Short reaches QA >= 80, run Long. If quality is below 80 or owner review rejects it, revise prompts/orchestration and rerun until PASS.

Alternative: configure one additional provider key and execute the same gate through that provider.

## 8. Gate rule

Do not mark V1-G02A PASS from mock output, local reasoning or static code inspection.

PASS requires:
1. real provider output;
2. Angle and Outline visible;
3. complete final script;
4. QA >= 80 after optional repair;
5. owner quality acceptance.


## 9. V1-G02A.1 rerun — 2026-10-04 13:59 GMT+7

Provider availability was checked again on the latest V1 RC.

Current provider configuration:
- Gemini: configured.
- OpenAI: not configured.
- Anthropic Claude: not configured.
- xAI Grok: not configured.

Real YouTube Short rerun against Gemini 3.8 Flash:

`Rate limit exceeded for model gemini-3.8-flash (limit: 20 requests per day on Free Tier). Please retry in 17h13s or upgrade your tier.`

Runtime log behavior:
- First provider response was transient high demand → one controlled retry.
- Next provider response was daily quota exhaustion (20 requests/day) → stopped immediately.
- No further retry loop occurred.

Decision:
- V1-G02A.1 remains **BLOCKED_PROVIDER**.
- Do not run YouTube Long while Short cannot clear the first provider stage.
- Earliest practical retry window is after the provider daily reset reported by Gemini, approximately the next morning in GMT+7.
- Alternative unblock: configure at least one additional script provider for this Vercel project.
