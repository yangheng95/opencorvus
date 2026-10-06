# Formal Task entry admission: source-qualified next run

## Recall

Root requests a single natural formal Task to qualify the actual Task resource download region after Sol05 ordinary authored download. Read the previous `artifact-download-root-implementation/next-real-task-delivery-plan-review.md`, binding next-directory/artifact plan, current Task control plane and Code/Work Agent platform architecture, and current CLI/REST/UI/model/worker/audit owners. This review runs no services, requests, checker, browser or model and reads no credential/catalog. No source, shared index or Git change. Root owns execution and evidence. Preserve 12 model requests and 180000 ms true inactivity; no prediction that a complete Task fits those bounds.

## A definite public entry, without keyword routing

The verified minimal entry is the existing **attached Task CLI**, not `run` and not an unqualified Work composer:

```powershell
# Example arguments for Root's already admitted running server; do not execute from this review.
# Run from packages/opencorvus, with Root's authorized runtime environment.
bun src/index.ts task create --url http://127.0.0.1:<owned-port> --dir '<actual-admitted-native-project>' --pillar code --model openai/gpt-6.1-sol --title 'Formal text delivery' --request '交付一个正式 Task 的可下载 UTF-8 文本资源 hello.txt，内容为 Hello from a formal Task. 并以一个换行结束。请实际验证文件内容，在 Task 交付区提供这个持久资源。不要启动服务、访问网站或更改已有文件。' --format json
```

This submits exactly one user-owned formal Task through the existing public API. Do not reuse a request ID with changed facts; if supplied, the ID must be a fresh genuine user-operation ID. `cli/cmd/task.ts:78–123` owns the exact options and acceptance output. `cli/cmd/attach.ts:27–39` deliberately attaches to the existing serving runtime rather than opening a second database writer; `--dir` selects the real server scope. `src/index.ts:117` registers this command. `run` is a conversation command and cannot substitute for durable Task creation (Task CLI header). CLI process Basic authentication, if configured, is environment-owned, never command-line secret material; this review neither inspects nor supplies it.

`server/routes/orchestrator.ts:202–269` receives `POST /task`, validates `CreateTaskInput`, enters `EngineService.createTask` with actual `{actor:'user'}`, and returns HTTP 202 with minted `task_id`, `project_id`, `directory`. Acceptance is not completion. The existing Task CLI status/board/artifacts commands may observe that exact accepted ID; then Root selects that real Task in `/ui` and manually qualifies the download control. No SQL, fabricated locator, custom request router or fake message is necessary.

The CLI has no prompt-profile option. Before submission Root must set the current canonical isolated project configuration's `prompt_profile.active` to the genuinely installed `base` package, using the existing configuration surface. Base's current manifest states execution-verification for direct owner delivery with independent verification; the natural request does not force a workflow or forbid its legitimate tester. A “single Task” is not a promise of a single model call or a single worker Session. No parallel research or Mission is needed for this request.

The inspected general UI submit path is **not an unconditional create button**: `services/task.ts:163–190` creates panel request facts with `allow_create:true`; `:572+` routes an existing selected Session directly, while the no-Session path uses `panel/message/stream`. A real author may then use `panel.create_task`, but permission to create is not evidence that every user text creates a Task. Do not assume a keyword such as “formal Task” activates a host parser. This review therefore recommends the verified CLI entry for creation, followed by real UI delivery interaction. A dedicated live create-control remains unverified; a Root screenshot can qualify it later without changing this source contract.

## Make every actual model Sol through the one config authority

`task-api/index.ts:2008–2023` snapshots the actual project Task configuration and saves an initial root Session overlay containing the explicit input model and active prompt profile. The selected package revision remains lifetime-bound, per current architecture. Scheduler `orchestrator/agent.ts:468–472` uses `resolveAgentModel` with Task root Session scope.

Fixed-agent resolution (`agent/model.ts:68–100`) is explicit input, then overlay agent-specific model, overlay default model, project agent-specific model/default, then `MissingModelConfigError`. Projected worker resolution (`:36–47,102–137`) uses the actual effective configuration with precedence:

1. `expert_squads.<actual-squad-id>.agents.<actual-agent-id>.runtime.model`;
2. `runtime_templates.<actual-base-role>.model`;
3. effective top-level `model`.

The Task `--model` default is therefore not sufficient evidence if a projected/template override wins. `orchestrator/delegated-worker-tool.ts:40+` invokes the real worker without explicit model override; `agent/runner.ts:1107–1138` resolves that worker through the current resolver. For the isolated Task configuration Root should use the existing single config surface: set top-level `model` and any actually configured selected-squad/template/fixed-agent model override to `openai/gpt-6.1-sol`, or remove an unnecessary isolated override so the one documented default applies. Set `small_model` to the same authorized model for any genuine helper path. Do not blindly copy an invented list of agent IDs or add a new configuration plane. Enumerate the installed current package projection's actual agent identities and base roles, and resolve each relevant effective model with current pure/resolver APIs before input; retain sanitized model references, not raw config/catalog.

For every selected identity, separately qualify credential usability, projected `Provider.Model.api.id === 'gpt-6.1-sol'`, then **actual outgoing** JSON model/stream evidence. `Provider.getModel` validates a projected model; it is not a Provider access probe. Root's existing reviewed paired staging/dependency closure and copied-OAuth expiry/no-refresh boundaries remain required. A model override cannot correct missing model-directory projection. This review did not inspect private configuration or catalogs, so the currently effective identities/overrides are unknown.

## Runtime budget and inactivity scope

The existing `.tmp-product-iteration/live-sol-cli-owned.ts:53–57` installs one same-process `RealProviderAudit('gpt-6.1-sol',12,...)` with initialized staged redactor before real CLI serving. `:103–107` preflight uses 180000 ms and explicitly reports **preflight-and-UI cumulative same-process** budget. The preflight request consumes the same 12; there is no fresh 12 for each worker. Audit validates actual outgoing model and `stream:true`, forwards original body, records genuine request origins and rejects copied OAuth refresh. It is not a role/model gate or workflow instruction.

DelegatedWorkerAgent calls `runAgentSession` directly, which enters SessionPrompt/common streaming LLM runtime; native file subprocesses are supervised commands rather than separate LLM sessions. Source evidence supports same-process interception for these current model paths. Actual final audit must still identify scheduler and every real worker Session/origin and exact model; a separate extension model process would require explicit evidence and is not covered by an ambient global fetch patch.

**Important runner mismatch:** current wrapper functional selection monitor (`:110–169`) admits a specific persisted user Session input, polls that Session's messages/execution/activity, and ends on its settled reply. That is ordinary conversation acceptance, not formal Task terminal acceptance. A root scheduler reply may settle while a real worker/Task remains active. Do not treat the existing functional-complete receipt as Task completion, and do not stop auditing/shut down on it. The 180000 startup/preflight and ordinary selected-input inactivity are separate scopes.

Root must retain the existing audit across Task creation through actual Task terminal/declared delivery and use the mature actual Task activity/terminal projection for a **Task-wide** inactivity observer (including scheduler, workers, tools and control reconciliation), not just one root Session completed timestamp. Existing duplex checker uses formal Task activity/terminal evidence, but its 512 default and two-Task prompt cannot be copied. This review admits no runner edit and executes nothing: exact reuse/wiring of the Task-wide observer is an outstanding preparation before launch. Keep 180000 ms reset only by actual progress/activity and stop with explicit incomplete on 12 exhausted; do not inflate budgets or mistake active waiting/HTTP polling for progress.

## Required actual receipts and current unknowns

Root must preserve: genuine CLI request/202 receipt; actual Task/Project/native directory/package binding; accepted root Message and all natural participants; effective configured model references plus actual request origins/stream/model counts; worker write/read verification; real `artifact_snapshot`/`artifact_publish` minted resource closure; actual selected declaration/resource summaries; Task terminal lifecycle and any unfulfilled obligations; screenshots of `ArtifactResourceDownload` in Task conversation or Project deliveries; the manually downloaded hello.txt with exact requested bytes; public shutdown/zero-owned-work and parent paired-copy cleanup receipts.

Only terminal declared resources with actual Task authority exercise this UI region. Ordinary interactive publication, a workspace file, a resource-free development report, 202 acceptance or a settled root assistant message is insufficient. Current platform architecture explicitly shares Task engine across Code/Work; this proposed code-pillar Task does not claim Mission/Work workflow parity, capsule portability, restart/cancel/parallel coverage or race coverage. Selected installed revision, effective override values, real Task-wide monitor integration, actual total turns within 12 and visual/download outcome remain unknown until Root preparation/execution. No UI automated test, runtime or source change was made.
