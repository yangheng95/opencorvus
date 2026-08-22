# Website data-analysis Expert Squad demo

Status: real end-to-end delivery completed; strict workflow ordering failed

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Run one real multi-Expert-Squad orchestration example end to end for a website demonstration. |
| Acceptance | A new Task submitted from the real `/ui/` page binds the built-in `data-analysis` package and its sole `operating-insight-report` workflow; planner, data steward, performance analyst, segment analyst, insight synthesizer, fact checker, and report writer each reach terminal success; the two analyst nodes run from the same frontier and overlap; the Mission and Task reach canonical completion; the final Markdown report is visible and opens from the website; no post-submit operator intervention is used. |
| Evidence | Preserve the isolated service source identity and URL, project path and Git identity, Mission/Task/Session identifiers, exact Provider/model identity without credentials, package revision/digest, workflow-node occurrence states and timing, completion decision, Artifact locators and hashes, interaction API response, durable interaction/event counts, final project commit, and real-page screenshots. |
| Hard constraints | Use a new absolute `OPENCORVUS_HOME`, empty managed-config directory, random loopback port, and new Git project. Copy or bind both the selected Provider credential record and its `models.json` projection; verify the credential, projected model, and actual request model separately. Keep all model calls streaming. Do not reuse, restart, refresh, stop, or mutate the existing OpenCorvus/browser processes. Do not expose credentials in logs, this record, screenshots, or commits. Do not add or run UI automation tests. |
| Sources read | `AGENTS.md`; `BUILD_AND_DEV_QUICKSTART.md`; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-13-expert-squad-gui-zero-intervention-sampling.md`; `expert-squads/builtin/data-analysis/{README.md,selector.md,expert-squad.jsonc}`; its package-owned Agent prompts, workflow Skill, codec, and publication Tool; server startup and Provider/model projection code. |
| Repository search | The current package declares one seven-node workflow. The planner publishes the analysis charter; the data steward publishes the dossier; the performance and segment analysts share that predecessor and may overlap; synthesis joins both; audit follows synthesis; the Build-owned writer alone commits `artifacts/data-analysis/report.md` and publishes identical `data-analysis/report` plus `document@1` artifacts. `/ui/` is served by the production backend. The current default database is stale for this source and therefore cannot be used as run authority. |
| Starting worktree | Branch `v0.0.51beta`; unrelated untracked `packages/opencorvus/script/benchmark/` and two abnormal-name entries are present and excluded. Another user-owned source server is listening on port 7899 and a website server on 4331; both remain untouched. |
| Independent agent feedback | None before implementation. A previously uninvolved read-only Agent will review the completed record, evidence, diff, and verification if this task creates repository changes. |

## Impact and execution-chain analysis

- Observable starting state: no new demonstration Task or current-source evidence exists yet. Historical data-analysis evidence is useful as a contract reference but cannot prove the current `v0.0.51beta` source, current Provider projection, or current website rendering.
- Direct trigger: one operator submission from Mission creation in the real Overlay Web UI after selecting the isolated project and installed `data-analysis` Expert Squad.
- Data/control flow: Overlay submit -> Mission creation -> Task-root ingress -> package-bound Orchestrator activation -> dependency-gated Task dispatches -> package Artifact publication and selection -> Build-owned report commit/snapshot -> Task completion decision -> Mission completion -> live website projection.
- Why an older path is insufficient: a previous completed Mission, fixture, checker-only run, static website asset, or API-only submission cannot prove this requested demonstration. The current run must create new durable occurrences and be observed on the current real page.
- Shared scheduling surface: because this run exercises Mission, Task, Session occurrence, parallel frontier, join, terminal convergence, Provider streaming, and recovery, any stall or duplicate dispatch is treated as a shared control-plane incident. Diagnosis must audit every active node occurrence, Task/Mission lifecycle, queue/ingress facts, normal and terminal delivery, retries/recovery, parallel overlap, and project isolation before calling it local.
- Definitions and call sites in scope: data-analysis package manifest/prompt/Skill/Tool contracts; Mission create and Task control APIs; Provider credential/model projection; Project installation; Artifact catalog/read/selection/publication; report writer Git merge/snapshot path; Overlay Mission/Task/artifact rendering. Product code is not modified unless real evidence exposes a root cause.
- Tests/docs/delivery: a run-only success needs real API/database/Git/Artifact/page evidence rather than new product tests. Any product repair requires a focused positive non-UI test, updated architecture/record documentation as applicable, current documentation checks, full relevant rerun, independent review, commit, upstream merge, and push.
- Main risks: missing exact model projection, incompatible Provider credential, package not installed for the isolated Project, permission prompt after submission, provider inactivity/retry, non-overlapping analyst occurrences, report commit/merge failure, stale page projection, and long-running Task convergence. Unknowns are retained until runtime facts settle them.

## Plan

1. Create a deterministic Git project with a compact operating CSV, explicit metric definitions, and a bounded Chinese analysis brief suitable for public demonstration.
2. Create an isolated runtime root and empty managed-config root. Copy only the selected Provider authority plus `models.json`; write one minimal non-secret config selecting the exact projected model. Validate credential availability, model projection, and one real streaming request before Mission submission.
3. Start the current source backend on a random loopback port and verify readiness plus `/ui/`. Use the real website to select the project, install/select `data-analysis`, submit one Mission, and stop all operator input.
4. Observe with bounded periodic checks. Record Mission/Task/Session/package/workflow/Provider/Artifact facts and diagnose any failure across the shared scheduling surface before changing anything.
5. Open the completed Task and final report in the real website, capture screenshots, and manually verify layout, content, node progression, completion state, and final Artifact.
6. Update this record with exact evidence. Run documentation/diff checks, obtain an uninvolved read-only review, fix every valid finding and repeat review when needed, then create one scoped commit, merge the current upstream, inspect the complete outgoing commit set, rerun necessary checks, and push.

## Execution record

### Isolated installation and runtime

- Test Project: `D:\myhexin-local\demos\website-data-analysis-20260822`; initial Git commit `5b4ce4486c4f14c2929c2ad7102631170e277b5a`.
- Isolated runtime root: `D:\myhexin-local\demos\.opencorvus-website-data-analysis-20260822`; real source service: `http://127.0.0.1:7878/ui/`.
- The formal `release-payload` installation route returned HTTP 200 after 156.18 seconds. Its authority contained 115 unique package sources; all 115 were installed into the Project's `.opencorvus/expert-squads/builtin` test directory. The UI catalog exposed 118 entries because it also includes three platform built-ins.
- Selected package identity: project-scoped `builtin/data-analysis@2026.08.19.1`, package digest `d3f161b61272b9c41528807a89bc1312a3e346ce093f9563102fb64ef91397f5`.
- DeepSeek credential and model projection were both present, but its real request returned Provider HTTP 402 (insufficient balance). SiliconFlow `siliconflow-cn/deepseek-ai/DeepSeek-V3.2` and OpenAI OAuth `openai/gpt-5.4-mini` each passed an isolated real streaming `PROVIDER_OK` request. The demonstration Task used `openai/gpt-5.4-mini`; no credential bytes are retained here.

### Mission, Task, and terminal evidence

- The first SiliconFlow Mission `22ada58db10ba4a2` produced no Task because the model submitted five schema-invalid `panel.create_task` calls carrying a forbidden `taskID` field. It was explicitly aborted and is retained as failure evidence, not counted as the demonstration.
- Successful delivery Mission: `bfedbd3b000b31c7`; Mission Session: `ses_-zUWy0L3Azzow27ns4Za`; completed board lane with completion recorded at `1787407191597`.
- Task: `tsk_g00VT1zzwK00dT8jO1lF`; Task root Session: `ses_-zUWxzwYNzzXuXeCSH5Q`; Orchestrator Session: `ses_-zUWxzqyEzzYwnfdr26F`. Task lifecycle completed at `1787407086486`; status endpoint reported zero running occurrences and the Mission reported one inactive/completed Task.
- The final Project HEAD is `bab5eb5646a98244efdad97652a334b30ed2cdfb` (`Resolve report merge conflict`) and the Project worktree is clean.
- Canonical report Git blob: `artifacts/data-analysis/report.md`, 4,676 LF-normalized bytes, SHA-256 `70afe8672943ce457baac96748aec8e84dc7e30fb22b7890956e6d1d09bfe193`. The checked-out Windows file is CRLF-normalized and therefore has different workspace bytes; the immutable snapshot and web renderer use the Git blob identity.
- Terminal typed report Artifact: `art_hU2TIpiENjGcaj93s5xL`, catalog revision 30, `data-analysis/report`, payload SHA-256 `1160e688567492aabfe658ca39756a31aa8d6fcf5add4d182aedf2928266927d`, one attached report resource.
- Matching interactive document: `art_g0VT29gid00W3B9U496a`, renderer `document@1`, title `Northstar SaaS 2025 经营洞察报告`. Its persisted Markdown equals the final LF-normalized report content.
- The real page expanded the final report, rendered the metric definitions, compact yearly table, quarterly trend table, four region/customer combinations, two priorities, audit corrections, and limitations. The right dock showed `0 working / 7 done`; no interaction was pending or supplied after submission.

### Seven role occurrences and parallelism

| Workflow role | Session | Terminal event time |
| --- | --- | ---: |
| Planner | `ses_-zUWxzdsuzzDR6QMq0Kf` | `1787404924657` |
| Data steward | `ses_-zUWxyslLzzT4TV9w3jv` | `1787405321749` |
| Performance analyst | `ses_-zUWxxHEKzzf9zP6cfHg` | `1787405932062` |
| Segment analyst | `ses_-zUWxxF2TzzcCvbS3ubK` | `1787405950927` |
| Insight synthesizer | `ses_-zUWxugH8zz2JcelM0e7` | `1787406229066` |
| Fact checker | `ses_-zUWxuXAqzzUIE3YM7FK` | `1787406107459` |
| Report writer | `ses_-zUWxtymTzzsNQmuWEbq` | `1787407048517` |

Performance started at `1787405356810`; segment started at `1787405365254`. Their overlap from the later start through the earlier terminal event was 566,808 ms (9 minutes 26.808 seconds), proving the intended parallel frontier actually ran.

### Workflow-contract finding

This is a genuine end-to-end deliverable, but it is not a strict `operating-insight-report` dependency-order pass:

- The fact checker was created at `1787406010572`, 218,494 ms before the insight synthesizer's terminal success.
- The report writer was created at `1787406146516`, 82,968 ms before the insight synthesizer's terminal success. It did start after the fact checker reached terminal status, but therefore still lacked the workflow join's terminal predecessor at dispatch time.
- The fact checker consequently audited an early progress message rather than the completed synthesized brief and returned a clean zero-claim review. The writer initially supplied non-typed snapshots/resources where six exact typed predecessor Engine Artifacts were required; the package publisher correctly rejected them with `ArtifactInspectionError`. It later used the generic publisher and completed the report.
- Dispatch-lineage facts record these as direct calls with no workflow-node binding. The Host correctly preserved natural Agent/tool messages and did not synthesize missing nodes, but the package prompt/model orchestration did not enforce its own declared Directed Acyclic Graph (DAG) order. This cannot be labeled a strict workflow success merely because the Task and Mission reached completion.
- The shared-surface audit covered the Mission, Task, every Session occurrence, streaming/terminal events, parallel overlap, repeated waits, typed and generic publications, Task completion decision, Project Git state, and isolated runtime. Evidence rules out stale UI projection or a second Project; the ordering defect is in the real orchestration path.

### Screenshots

- `specs/artifacts/2026-08-22-data-analysis-demo-submit.png`: the retained first SiliconFlow submission attempt before its schema-invalid Mission was aborted.
- `specs/artifacts/2026-08-22-data-analysis-demo-submit-openai.png`: real UI submission bound to `data-analysis` and `openai/gpt-5.4-mini`.
- `specs/artifacts/2026-08-22-data-analysis-demo-parallel.png`: both analyst branches working concurrently.
- `specs/artifacts/2026-08-22-data-analysis-demo-completed.png`: terminal Task with one declared report output and `0 working / 7 done`.
- `specs/artifacts/2026-08-22-data-analysis-demo-report.png`: final report expanded and rendered inside the real website.

## Acceptance assessment

The installation, real Provider stream, real website submission, seven role occurrences, parallel analyst frontier, final Git report, typed report Artifact, matching interactive document, Task completion, Mission completion, and visual rendering all passed. The explicit strict dependency-order criterion failed because audit and writing started before synthesis terminal success. This record is suitable only as a reproducible real multi-Agent delivery and orchestration-defect example. It does not satisfy the user's requested successful workflow demonstration and must not be placed on the website as one; a new run must pass the declared DAG before that requirement is complete.
