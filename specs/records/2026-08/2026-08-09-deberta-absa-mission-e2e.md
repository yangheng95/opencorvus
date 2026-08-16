# DeBERTa ABSA mission end-to-end experiment

## Recall

| Item | Record |
| --- | --- |
| User request | Use mission mode to decompose and execute an end-to-end debug/test chain on a random-port development backend: download `deberta-v3-base-absa-v1.1`, research or synthesize ABSA data, train iteratively while recording performance data in an isolated database, build an auto-updating performance monitoring webpage, produce a better-performing model, build an inference page, write a complete experiment report, organize the repository, and push to GitHub. The mission orchestration model target is `deepseek-v4-flash`. |
| Acceptance criteria | A project-local ABSA lab downloads `yangheng/deberta-v3-base-absa-v1.1`; a reproducible dataset pipeline exists; at least baseline plus two training iterations write comparable metrics into an isolated SQLite database and audit JSON exports; best iteration improves over baseline on the project validation split; a random-port backend serves metrics, Server-Sent Events (SSE), inference API, monitor page, and inference page from that isolated database; the real pages are manually opened and reviewed; an experiment report records data, method, metrics, failures, final model path, and `deepseek-v4-flash` mission-model boundary; scoped changes are committed and pushed when upstream safety checks permit. |
| Hard constraints | Read existing specs before changes; do not modify unrelated OpenCorvus runtime behavior; no User Interface (UI) automation tests, snapshots, baseline screenshots, or DOM assertions; UI acceptance uses real page interaction and manual screenshots only; preserve unrelated working tree changes; no fallback training path that silently changes the task; large model artifacts stay outside Git unless explicitly designed as small metadata. |
| Sources read | `AGENTS.md`; `package.json`; `packages/opencorvus/package.json`; `specs/README.md`; `specs/records/2026-08/README.md`; `specs/records/2026-08/2026-08-08-machine-learning-implementation-squad-e2e.md`; `benchmark-debug-template` Skill; Hugging Face model card for `yangheng/deberta-v3-base-absa-v1.1`; SemEval-2014 Task 4 description; DeBERTaV3 paper abstract. |
| Whole-repository search evidence | `rg --files` shows this is an existing OpenCorvus monorepo. `rg -n "mission|Mission|backend|dev server|PORT|random"` found random port support in `packages/opencorvus/src/server/server.ts` and Mission routes, but this task can be isolated from platform internals. `git remote -v` shows `origin https://github.com/yangheng95/opencorvus`. `git status --short` was clean before implementation. |
| Independent agent feedback | None before implementation. A read-only independent agent review is required after first successful local verification. |

## External Research Summary

- Hugging Face lists `yangheng/deberta-v3-base-absa-v1.1` as a MIT-licensed Transformers/PyTorch text-classification model and documents paired inference with `text_pair` for the aspect term.
- The model card states the base is `microsoft/deberta-v3-base` and the ABSA model was trained on aggregated ABSA corpora including SemEval-2014, SemEval-2016, and MAMS.
- SemEval-2014 Task 4 defines ABSA as determining sentiment toward specific aspects, with aspect term polarity labels including positive, negative, neutral, and conflict. This experiment uses the three labels exposed by the model head if the downloaded config exposes only three labels.
- DeBERTaV3 replaces masked language modeling with replaced token detection and gradient-disentangled embedding sharing; this motivates using the existing encoder and fine-tuning rather than training from scratch.

## Problem Depth And Impact Analysis

| Area | Analysis |
| --- | --- |
| Observable target | The user wants a complete, inspectable ML workflow, not just a script: model acquisition, data construction, training iterations, performance telemetry, live pages, inference, report, Git delivery. |
| Direct trigger | There is no existing ABSA lab in this monorepo. The deliverable must be added as an isolated project-owned artifact without perturbing OpenCorvus application behavior. |
| Data/control-flow root | The chain needs one source of truth for experiments. Metrics must be produced by training/evaluation and consumed directly by the backend and monitor page. The backend must also load the best registered model for inference. |
| Prior path not sufficient | The earlier machine-learning Expert Squad E2E record concerns generating a Squad through OpenCorvus Mission/Task, and it documents project-identity and workflow issues. It does not provide an ABSA model, dataset, metrics, web monitor, inference service, or report. |
| Public contracts touched | No OpenCorvus package interfaces should be changed. New contracts are local to `deberta-absa-lab`: dataset schema, experiment metrics schema, model registry schema, backend API, report. |
| Tests and validation | Non-UI validation uses focused Python checks against data, metrics, registry, and API contracts. UI validation must be real page viewing and manual screenshot review, not automated UI tests. |
| Risks | Download and training may be network/GPU/time constrained; baseline may already be strong, so improvement must be measured on a project-owned heldout split and recorded honestly. Git push may be blocked by missing credentials, upstream divergence, or unauthorized existing commits. |
| Exclusions | No production OpenCorvus backend route changes; no automatic GitHub repository creation unless explicitly authorized or already configured; no committing model weight binaries to Git. |

## Mission Decomposition

1. Research and plan: verify model identity, ABSA task contract, dataset strategy, runtime constraints, and Git state.
2. Build experiment project: create a self-contained Python lab with dependency lock surface, synthetic ABSA data generator, training/evaluation scripts, backend, pages, and report skeleton.
3. Download and baseline: acquire the exact Hugging Face model, generate the deterministic dataset, evaluate the downloaded checkpoint, and write baseline metrics.
4. Train iterations: run at least two scoped fine-tuning iterations, record metrics and artifacts after each, and select the best validation model.
5. Backend and pages: run the development backend on an OS-assigned random port, serve the metrics monitor with auto-refresh/SSE and an inference page backed by the selected model.
6. End-to-end verification: hit health, metrics, and predict endpoints; manually inspect monitor and inference pages; record screenshots or text evidence in the report.
7. Independent review and repair: commission a read-only review of the diff, tests, metrics, report, and UI evidence; fix valid findings and rerun affected checks.
8. Git delivery: stage only scoped files, commit, inspect `origin/main..HEAD`, then push only if the pending commit set belongs to this task.

## Benchmark Definition

| Item | Contract |
| --- | --- |
| Task | Aspect sentiment classification for `(sentence, aspect)` pairs. |
| Input | JSONL rows with `text`, `aspect`, `label`, `domain`, and `split`; inference accepts one text and one aspect. |
| Output | Labels `negative`, `neutral`, or `positive` plus class probabilities; metrics include accuracy, macro F1, weighted F1, per-class F1, confusion matrix, training seconds, and model path. |
| Environment | `deberta-absa-lab/.venv` created from Python 3.12; model downloads through Hugging Face Hub; generated artifacts live under ignored `deberta-absa-lab/runs/` and `deberta-absa-lab/models/`; metrics authority is the isolated `deberta-absa-lab/runs/absa_metrics.sqlite` database. |
| Timeout | Training/debug commands use inactivity-aware observation; long runs are checked by log progress instead of silent waiting. |
| Acceptance | Baseline and at least two iterations exist in `runs/metrics.jsonl`; best iteration macro F1 is strictly higher than baseline on the heldout project validation split; backend `/api/health`, `/api/experiments`, and `/api/predict` work on a random port; monitor and inference pages are manually reviewed. |

## Implementation Boundary

Add one root-level `deberta-absa-lab/` project with source, pages, generated-data scripts, and documentation. Keep downloaded model weights, fine-tuned weights, caches, and large run outputs ignored. Update spec indexes. Do not alter existing OpenCorvus package behavior unless a local validation tool failure proves a minimal repository-level fix is necessary.

## Evidence Ledger

This section is updated during implementation.

- Initial `git status --short`: clean.
- Initial upstream: `origin/main`.
- Updated user objective: isolated database and `deepseek-v4-flash` mission-model boundary added; subsequent runtime work stayed inside `deberta-absa-lab`.
- Dataset evidence: `python -m absa_lab.data` wrote 2700 deterministic synthetic rows under `deberta-absa-lab/data/generated/`; `tests/contract_check.py` passed.
- Model evidence: Hugging Face config/tokenizer loaded for `yangheng/deberta-v3-base-absa-v1.1`; direct `curl.exe` download wrote `models/base/model.safetensors` in the ignored isolated lab directory; local `AutoModelForSequenceClassification.from_pretrained("models/base")` loaded labels `{0: Negative, 1: Neutral, 2: Positive}`.
- Training evidence: CPU-only small run completed baseline plus `iter_01` and `iter_02`; baseline macro F1 `0.8059163059163059`, `iter_01` macro F1 `0.9373219373219372`, `iter_02` macro F1 `0.9680464778503994`; registry selected `models\\iter_02`.
- Isolated database evidence: `runs/absa_metrics.sqlite` exists with three experiment rows and registry `iter_02`; JSONL and JSON exports mirror the database for audit.
- Backend evidence: random-port backend printed `http://127.0.0.1:52388`; `/api/health` returned `ok=true`, `device=cpu`, `db_path=runs\\absa_metrics.sqlite`, `registered_model=models\\iter_02`, `metrics_count=3`; `/api/predict` returned `negative` for text `The battery is reliable, but the screen is dim in daylight.` and aspect `screen`.
- UI evidence: in-app browser monitor page showed best `iter_02`, macro F1 `0.9680`, and three metrics rows; inference page showed `negative` with probabilities `0.9232/0.0711/0.0057`; DOM evidence confirmed 1280px desktop grid positions though local image rendering preview displayed a cropped-looking view.
- Independent review: pending.
- Git commit/push: pending.
