/** PREPARED ONLY. Root must review and authorize execution; ordinary CLI, no UI driver. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { randomUUID } from "node:crypto"
import { once } from "node:events"

const packageRoot = path.resolve(import.meta.dir, "../packages/opencorvus")
const source = (relative: string) => pathToFileURL(path.join(packageRoot, relative)).href

// Host owns one foreground launch; Target below remains the sole Task pipeline.
if (process.argv[2] === "--owned-host") {
  const [hostEvidence, hostOccurrence, executable, ...args] = process.argv.slice(3)
  assert(hostEvidence && hostOccurrence && executable && args.length)
  assert(path.isAbsolute(hostEvidence) && path.isAbsolute(executable))
  const { installProcessShims } = await import(source("src/runtime/shims.ts"))
  installProcessShims()
  const { Filesystem } = await import(source("src/util/filesystem.ts"))
  const physical = await import(source("src/runtime/process-occurrence.ts"))
  const { ProcessSupervisor } = await import(source("src/shell/process-supervisor.ts"))
  const host = physical.currentRuntimeProcessOccurrence()
  const parent = physical.observedProcessOccurrence(process.ppid)
  assert(parent, "Native Host requires its actual supervising parent")
  await fs.mkdir(hostEvidence, { recursive: true })
  const fact = async (name: string, value: unknown) => {
    const target = path.join(hostEvidence, name)
    const stage = `${target}.${process.pid}-${randomUUID()}.stage`
    try {
      await fs.writeFile(stage, JSON.stringify(value, null, 2), { flag: "wx" })
      await Filesystem.renameNoReplace(stage, target)
    } finally { await fs.rm(stage, { force: true }) }
  }
  let phase = "spawn-admission"
  try {
    const handle = await ProcessSupervisor.spawnHostCommand({ executable, args,
      cwd: packageRoot, env: process.env, stdin: "ignore",
      owner: hostOccurrence, terminateChildrenOnRootExit: true })
    const drain = async (stream: NodeJS.ReadableStream | null, destination: NodeJS.WriteStream) => {
      assert(stream, "Foreground native command requires an output stream")
      for await (const chunk of stream) {
        if (!destination.write(chunk)) await once(destination, "drain")
      }
    }
    const outcomes = Promise.allSettled([
      handle.settled ?? Promise.reject(new Error("Native Handle requires authoritative settlement")),
      drain(handle.stdout, process.stdout), drain(handle.stderr, process.stderr),
    ])
    phase = "target-identity"
    const target = physical.observedProcessOccurrence(handle.pid)
    assert(target, "Native Target must be observable at ready admission")
    assert.equal(physical.observeRuntimeProcessOccurrence(target), "exact_live")
    const targetBirthAtMs = Number((BigInt(target.processInstanceID.slice("win32:".length)) - 621355968000000000n) / 10000n)
    await fact("native-host-ready.json", { occurrence: hostOccurrence, outcome: "ready", host, parent, target,
      targetBirthAtMs, observedAtUtc: new Date().toISOString(), executable, args,
      authority: "Production ProcessSupervisor.spawnHostCommand foreground Windows Job; no detached transfer" })
    phase = "whole-job-output-request-settlement"
    const results = await outcomes
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : [])
    if (errors.length) throw new AggregateError(errors, "Native Host physical/output/request settlement failed")
    const terminal = await handle.terminalFact
    assert(terminal, "Native command must retain its original terminal fact")
    await fact("native-host-settled.json", { occurrence: hostOccurrence, outcome: "settled", host, target,
      observedAtUtc: new Date().toISOString(), terminal,
      physicalCompletion: true, outputDrainComplete: true, requestCleanupComplete: true,
      authority: "Actual fulfilled production Handle.settled and both output drains; native marker validation precedes request cleanup" })
    process.exit(terminal.exitCode ?? 1)
  } catch (error) {
    await fact("native-host-error.json", { occurrence: hostOccurrence, outcome: "failed", host, phase,
      observedAtUtc: new Date().toISOString(), errorType: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      authority: "Failed Host observation/admission/settlement; no physical completion claim" })
    process.exit(1)
  }
}

// Nonsecret arguments only: source auth, owned runtime, owned project, owned evidence,
// owned startup receipt, proposed port, unique startup occurrence. Environment is parent-owned.
const [authSource, runtime, project, evidenceRoot, receiptPath, portText, occurrence, taskSelectionPath, profileSelectionPath, requestBudgetText] = process.argv.slice(2)
assert(authSource && runtime && project && evidenceRoot && receiptPath && portText && occurrence && taskSelectionPath && profileSelectionPath && requestBudgetText,
  "Expected ten nonsecret owned/source arguments including the actual Task selection, profile selection and upfront request budget")
const maxRequests = Number(requestBudgetText)
assert(Number.isInteger(maxRequests) && maxRequests >= 1 && maxRequests <= 100, "Expected reviewed upfront cumulative request budget")
assert(path.isAbsolute(profileSelectionPath))
for (const value of [authSource, runtime, project, evidenceRoot, receiptPath]) assert(path.isAbsolute(value))
assert(path.isAbsolute(taskSelectionPath))
assert.equal(path.dirname(path.resolve(taskSelectionPath)), path.dirname(path.resolve(runtime)))
assert.equal(path.basename(authSource), "auth.json")
assert.equal(process.env.OPENCORVUS_HOME, runtime)
assert.equal(process.env.OPENCORVUS_TEST_HOME, undefined)
assert.equal(process.env.OPENCORVUS_MODELS_PATH, undefined)
assert.equal(process.env.OPENCORVUS_CONFIG_CONTENT, undefined, "Owned global/project canonical configuration must not be overridden by inline config")
const port = Number(portText)
assert(Number.isInteger(port) && port > 0 && port <= 65535)
assert.notEqual(path.resolve(path.dirname(authSource)), path.resolve(runtime, "data"))
const { installProcessShims } = await import(source("src/runtime/shims.ts"))
installProcessShims()
const { CredentialRedactor, RealProviderAudit, installProcessProviderAudit } =
  await import(source("script/real-provider-audit.ts"))
const redactor = new CredentialRedactor()
const { Filesystem } = await import(source("src/util/filesystem.ts"))
await fs.mkdir(evidenceRoot, { recursive: true })
const publish = async (name: string, value: unknown) => {
  const target = path.join(evidenceRoot, name)
  const stage = `${target}.${process.pid}-${randomUUID()}.tmp`
  try {
    await fs.writeFile(stage, redactor.redact(JSON.stringify(value, null, 2)), { flag: "wx" })
    await Filesystem.renameNoReplace(stage, target)
  } finally {
    await fs.rm(stage, { force: true })
  }
}

try {
  // Establish the real Git identity before the first Instance observes this directory.
  // Metadata policy remains production-owned; no copied ignore/attribute rules.
  const git = async (args: string[]) => {
    const child = Bun.spawn(["git", ...args], { cwd: project, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ])
    assert.equal(exitCode, 0, `Owned initial Git ${args[0]} failed: ${stderr.trim()}`)
    return stdout.trim()
  }
  assert.equal((await fs.readdir(project)).length, 0, "Fresh owned Task project must be empty")
  await git(["init", "--initial-branch=main"])
  await git(["config", "--local", "user.name", "OpenCorvus diagnostic"])
  await git(["config", "--local", "user.email", "diagnostic@opencorvus.invalid"])
  await fs.writeFile(path.join(project, "README.md"), "# Isolated formal Task resource qualification\n", { flag: "wx" })
  const { ensureGitProjectMetadata } = await import(source("src/engine/git-project-metadata.ts"))
  await ensureGitProjectMetadata(project)
  await git(["add", "--", "README.md", ".gitignore", ".gitattributes"])
  await git(["commit", "-m", "Initialize isolated formal Task project"])
  const initialCommit = await git(["rev-parse", "--verify", "HEAD"])
  const initialFiles = (await git(["ls-tree", "--name-only", "HEAD"])).split("\n").sort()
  assert.deepEqual(initialFiles, [".gitattributes", ".gitignore", "README.md"])
  assert.equal(await git(["status", "--porcelain"]), "")
  await publish("project-baseline.json", { directory: await fs.realpath(project), initialCommit,
    initialFiles, status: "clean", metadataOwner: "ensureGitProjectMetadata", hooks: "normal Git invocation",
    qualification: "Actual initial Git object/files; no mutable-source hash acceptance" })

  const { ExpertSquadRegistry } = await import(source("src/expert-squad/registry.ts"))
  const rawSelection: unknown = JSON.parse(await fs.readFile(profileSelectionPath, "utf8"))
  const { z } = await import("zod")
  const profileSelection = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("builtin"), id: z.literal("base"), namespace: z.literal("builtin") }).strict(),
    z.object({ kind: z.literal("project"), definitionPath: z.string().refine(path.isAbsolute, "Absolute definition path required") }).strict(),
  ]).parse(rawSelection)
  let profileID = "base"
  let profileNamespace = "builtin"
  if (profileSelection.kind === "project") {
    assert.equal(path.resolve(profileSelection.definitionPath), path.resolve(import.meta.dir, "creator-delivery-definition-16.json"), "Actual reviewed QA16 definition required")
    const { writeExpertSquadPackage } = await import(pathToFileURL(path.resolve(packageRoot, "../sdk/js/src/expert-squad-authoring.ts")).href)
    const { ExpertSquadPackageLocations } = await import(source("src/expert-squad/locations.ts"))
    const definition = JSON.parse(await fs.readFile(profileSelection.definitionPath, "utf8"))
    assert.equal(definition.manifest.id, "task-resource-qa")
    assert.equal(definition.manifest.namespace, "qa")
    assert.equal(definition.manifest.version, "2026.10.06.2")
    profileID = definition.manifest.id
    profileNamespace = definition.manifest.namespace
    const installed = await writeExpertSquadPackage({
      directory: path.join(ExpertSquadPackageLocations.project(project).packagesRoot, profileNamespace, profileID), definition,
    })
    await ExpertSquadRegistry.invalidateAvailable()
    await publish("qa-package-installed.json", { profileSelectionPath, definitionPath: profileSelection.definitionPath,
      profileID, namespace: profileNamespace, version: definition.manifest.version, ...installed,
      boundary: "SDK canonical project installation before first Instance/Resolver" })
  }
  await publish("profile-selection-admitted.json", { profileSelectionPath, selection: profileSelection, profileID, namespace: profileNamespace })
  const [{ Global }, { ConfigPaths }] = await Promise.all([
    import(source("src/global/index.ts")), import(source("src/config/paths.ts")),
  ])
  await fs.mkdir(Global.Path.config, { recursive: true })
  const globalConfigFile = await ConfigPaths.assertCanonicalDirectory(Global.Path.config)
  const projectConfigFile = ConfigPaths.projectFile(project)
  await fs.mkdir(path.dirname(projectConfigFile), { recursive: true })
  const globalConfig = { model: "openai/gpt-6.1-sol", small_model: "openai/gpt-6.1-sol", prompt_profile: { active: "base" } }
  const projectConfig = { prompt_profile: { active: profileID } }
  await fs.writeFile(globalConfigFile, JSON.stringify(globalConfig, null, 2) + "\n", { flag: "wx" })
  await fs.writeFile(projectConfigFile, JSON.stringify(projectConfig, null, 2) + "\n", { flag: "wx" })
  await publish("owned-config-hierarchy.json", { global: { path: globalConfigFile, config: globalConfig },
    project: { path: projectConfigFile, config: projectConfig }, inlineConfig: "absent",
    boundary: "Fresh canonical global Base and selected project profile configuration before first Instance; no environment profile switching" })
  await fs.mkdir(path.join(runtime, "data"), { recursive: true })
  for (const name of ["auth.json", "models.json"]) {
    try {
      await fs.lstat(path.join(runtime, "data", name))
      throw new Error("Owned destination authority pair must be fresh before staging")
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  }
  const { stageDiagnosticProvider } = await import(source("script/evolution-diagnostic-provider.ts"))
  const pairMetadata = async (directory: string) => Promise.all(["auth.json", "models.json"].map(async (name) => {
    const file = path.join(directory, name)
    const stat = await fs.stat(file)
    return { path: file, bytes: stat.size, modifiedAt: stat.mtime.toISOString(), createdAt: stat.birthtime.toISOString() }
  }))
  const sourcePairBefore = await pairMetadata(path.dirname(authSource))
  // Mature helper requires the complete models.json adjacent to the explicitly approved auth source.
  const access = await stageDiagnosticProvider({ authSource, dataDirectory: path.join(runtime, "data"),
    modelID: "gpt-6.1-sol", redactor })
  await publish("provider-pair-staging.json", { sourcePairBefore,
    sourcePairAfter: await pairMetadata(path.dirname(authSource)), copiedPair: await pairMetadata(path.join(runtime, "data")),
    stagingOwner: "stageDiagnosticProvider", credential: "selected existing OpenAI entry", catalog: "complete adjacent models.json",
    boundary: "Metadata only; content redactor remains in memory; copied refresh prohibited" })
  const { createAuditSnapshotPublisher } = await import(source("script/audit-snapshot.ts"))
  const snapshot = createAuditSnapshotPublisher(evidenceRoot, "provider")
  const state = installProcessProviderAudit(() => {
    const persist = () => snapshot({ pid: process.pid, executable: process.execPath,
      model: audit.modelID, maxRequests, requests: audit.requests,
      exhausted: audit.exhausted, observedAt: new Date().toISOString() })
    const audit = new RealProviderAudit("gpt-6.1-sol", maxRequests, persist,
      { copiedOAuthExpiresAt: access.copiedOAuthExpiresAt }, undefined, { redactor })
    persist()
    return { audit, persist }
  })
  const expectedURL = new URL(`http://127.0.0.1:${port}`)
  state.audit.localOrigins.add(expectedURL.origin)
  state.audit.localOrigins.add(`http://localhost:${port}`)
  const [{ Instance }, { Auth }, { Provider }, { SessionStatus }, physical, shutdown] = await Promise.all([
    import(source("src/project/instance.ts")), import(source("src/auth/index.ts")),
    import(source("src/provider/provider.ts")), import(source("src/session/status.ts")),
    import(source("src/runtime/process-occurrence.ts")), import(source("src/server/shutdown.ts")),
  ])
  const [{ EffectiveConfig }, { Config }, { PromptProfileResolver },
    modelResolver, { HostAgentRegistry }, { HelperAgentRegistry },
    { PrimaryAssistantRegistry }, { UNIVERSAL_BUILD_AGENT_ID }, { configuredTaskProcessMode },
    { Database, eq }, { EngineTaskTable }, { projectTaskRowInTransaction },
    { readTaskDurableActivityScope }, { taskLifecycleProjectionInTransaction },
    { listOwnedPromptSessionsForTask }, { observeMissionTaskDuplexActivity }, { Identifier }] = await Promise.all([
    import(source("src/config/effective.ts")), import(source("src/config/config.ts")),
    import(source("src/expert-squad/prompt-profile-resolver.ts")), import(source("src/agent/model.ts")),
    import(source("src/agent/host-agent-registry.ts")), import(source("src/agent/helper-agent-registry.ts")),
    import(source("src/agent/primary-assistant-registry.ts")), import(source("src/agent/universal-build.ts")),
    import(source("src/engine/task-execution-capsule-binding.ts")), import(source("src/storage/db.ts")),
    import(source("src/engine/engine.sql.ts")), import(source("src/engine/store.ts")),
    import(source("src/engine/durable-activity.ts")), import(source("src/engine/task-lifecycle.ts")),
    import(source("src/engine/runtime.ts")), import(source("script/mission-task-duplex-snapshot.ts")),
    import(source("src/id/id.ts")),
  ])
  const qualifyModels = async (opts?: { taskID: string }) => {
    assert.equal(configuredTaskProcessMode(), "native")
    const config = await EffectiveConfig.effective(opts)
    assert.equal(config.prompt_profile.active, profileID)
    assert.equal(config.model, "openai/gpt-6.1-sol")
    assert.equal(config.small_model, "openai/gpt-6.1-sol")
    const revision = await PromptProfileResolver.resolveActivePackageRevision({ config, projectDirectory: project, scope: "project" })
    assert.equal(revision.scope, profileSelection.kind === "builtin" ? "built_in" : "project")
    assert.equal(revision.projectID, profileSelection.kind === "builtin" ? null : Instance.project.id)
    const loadedPackage = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.packageDigest)
    assert.equal(loadedPackage.id, profileID)
    assert.equal(loadedPackage.namespace, profileNamespace)
    assert.equal(loadedPackage.version, revision.version)
    assert.equal(loadedPackage.packageDigest, revision.packageDigest)
    const preview = Config.mergeOverlay(config, { model: "openai/gpt-6.1-sol", prompt_profile: { active: profileID } })
    const matrix: Array<{ kind: string; agentID: string; baseRole?: string; capabilityOwner?: string; providerID: string; modelID: string; intendedProviderID?: string; intendedModelID?: string }> = []
    const expectedRef = { providerID: "openai", modelID: "gpt-6.1-sol" }
    const entries = ExpertSquadRegistry.agentProjectionEntries(loadedPackage.manifest).map((entry: any) => ({
      agentID: entry.agentID, baseRole: entry.baseRole, capabilityOwner: "package",
    }))
    entries.push({ agentID: UNIVERSAL_BUILD_AGENT_ID, baseRole: "build", capabilityOwner: "platform" })
    const workerGrants: Array<{ identity: unknown; packageRevision: unknown; builtInToolIDs: string[];
      defaultTools: Array<{ ref: string; providerName: string }> }> = []
    for (const entry of entries) {
      const identity = { expertSquadID: loadedPackage.id, ...entry }
      const ref = modelResolver.configuredProjectedWorkerModelRef(config, identity)
      const intended = modelResolver.configuredProjectedWorkerModelRef(preview, identity)
      assert.deepEqual(ref, expectedRef, `Actual projected model ${entry.agentID}`)
      assert.deepEqual(intended, expectedRef, `Intended projected model ${entry.agentID}`)
      matrix.push({ kind: "projected-worker", ...entry, ...ref, intendedProviderID: intended.providerID, intendedModelID: intended.modelID })
      const { workerCapability } = await PromptProfileResolver.resolveWorkerTurnProjection({
        config, projectDirectory: project, packageRevision: revision, agentID: entry.agentID,
      })
      if (profileSelection.kind === "project" && entry.agentID === "mission") {
        assert.equal(workerCapability.identity.baseRole, "explore")
        assert.equal(workerCapability.identity.sessionKind, "explore")
        assert(workerCapability.builtInToolIDs.includes("panel_query_task"), "Actual explorer must receive its query grant")
      }
      if (profileSelection.kind === "builtin" && entry.agentID === "base-researcher") {
        assert.equal(workerCapability.identity.baseRole, "explore")
        assert(workerCapability.builtInToolIDs.includes("webfetch"), "Actual Base researcher must receive its webfetch grant")
      }
      workerGrants.push({ identity: workerCapability.identity, packageRevision: workerCapability.packageRevision,
        builtInToolIDs: workerCapability.builtInToolIDs,
        defaultTools: workerCapability.defaultTools.map((tool: any) => ({ ref: tool.ref, providerName: tool.providerName })) })
    }
    for (const [kind, registry] of [["host", HostAgentRegistry], ["helper", HelperAgentRegistry], ["primary", PrimaryAssistantRegistry]] as const) {
      for (const agent of await registry.list({ config })) {
        const ref = await modelResolver.resolveAgentModelRef(agent.name, opts)
        assert.deepEqual(ref, expectedRef, `Actual fixed model ${agent.name}`)
        matrix.push({ kind, agentID: agent.name, ...ref })
      }
    }
    const projected = await Provider.getModel(expectedRef.providerID, expectedRef.modelID, { config })
    assert.equal(projected.api.id, "gpt-6.1-sol")
    assert.equal(new Set(matrix.map((entry) => `${entry.kind}:${entry.agentID}`)).size, matrix.length)
    const { schedulerCapability } = await PromptProfileResolver.resolveSchedulerTurnProjection({
      config, projectDirectory: project, packageRevision: revision,
    })
    return { projectID: Instance.project.id, directory: Instance.directory, packageRevision: revision,
      processMode: configuredTaskProcessMode(), matrix, workerGrants,
      schedulerGrants: { identity: schedulerCapability.identity, packageRevision: schedulerCapability.packageRevision,
        builtInToolIDs: schedulerCapability.builtInToolIDs, virtualWorkflows: schedulerCapability.virtualWorkflows },
      providerAPIModel: projected.api.id,
      boundary: "Available actual registry identities and intended configuration; no prediction of dispatch or request origin" }
  }
  const admission = await Instance.provide({ directory: project, fn: async () => {
    const credential = await Auth.get("openai")
    assert.equal(credential?.type, "oauth")
    return qualifyModels()
  } })
  const owner = physical.currentRuntimeProcessOccurrence()
  const managedParent = physical.observedProcessOccurrence(process.ppid)
  assert(managedParent, "Owned CLI requires an observable exact supervising parent")
  assert.equal(physical.observeRuntimeProcessOccurrence(managedParent), "exact_live")
  await publish("managed-parent-ready.json", { pid: process.pid, occurrence, owner, parent: managedParent,
    boundary: "Current native parent occurrence supplied to the established serve lifecycle; no PID-only ownership" })
  await publish("authority-ready.json", { pid: process.pid, owner, model: "openai/gpt-6.1-sol",
    credential: "available", catalog: "projected", pairedModels: true, executionStarted: false, admission })

  // Start before importing index: ordinary serve never resolves its top-level import.
  const monitor = (async () => {
    const startupDeadline = Date.now() + 180_000
    for (;;) {
      let receipt: any
      try { receipt = JSON.parse(await fs.readFile(receiptPath, "utf8")) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
      if (receipt) {
        assert.equal(receipt.occurrenceID, occurrence)
        assert.equal(receipt.outcome, "listening")
        assert.equal(receipt.pid, process.pid)
        assert.equal(new URL(receipt.url).origin, expectedURL.origin)
        assert.equal(physical.observeRuntimeProcessOccurrence(owner), "exact_live")
        if (shutdown.hasServerShutdownHandler()) {
          const health = await state.audit.nativeFetch(new URL("/global/health", expectedURL),
            { signal: AbortSignal.timeout(15_000) })
          assert(health.ok, `Owned health HTTP ${health.status}`)
          const healthFact = await health.json() as { healthy?: boolean }
          assert.equal(healthFact.healthy, true)
          break
        }
      }
      if (Date.now() > startupDeadline) throw new Error("OWNED_CLI_STARTUP_TIMEOUT")
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const preflight = await state.audit.preflight({ serverURL: expectedURL,
      model: "openai/gpt-6.1-sol", inactivityMs: 180_000,
      activity: SessionStatus.getActivity })
    await publish("preflight-ready.json", { pid: process.pid, owner, occurrence, port, preflight,
      maxRequests, budgetScope: "preflight-and-entire-formal-task-cumulative-same-process",
      nextAction: "root-owned-genuine-cli-task-create", credentialCleanup: "parent-owned-after-physical-exit" })
    const handleDeadline = Date.now() + 600_000
    let handle: { occurrence: string; taskID: string; projectID: string; directory: string; requestID: string; requestSentAt: string; acceptedObservedAt: string } | undefined
    for (;;) {
      try { handle = JSON.parse(await fs.readFile(taskSelectionPath, "utf8")) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
      if (handle) break
      if (state.audit.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
      if (Date.now() > handleDeadline) throw new Error("TASK_HANDLE_ADMISSION_TIMEOUT")
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.equal(handle.occurrence, occurrence)
    assert.equal(await fs.realpath(handle.directory), await fs.realpath(project))
    assert(Identifier.isCanonical("task", handle.taskID))
    assert.equal(handle.projectID, admission.projectID)
    assert.equal(typeof handle.requestID, "string")
    assert(handle.requestID.length > 0)
    const requestSentAt = Date.parse(handle.requestSentAt)
    const acceptedObservedAt = Date.parse(handle.acceptedObservedAt)
    assert(Number.isSafeInteger(requestSentAt) && Number.isSafeInteger(acceptedObservedAt) &&
      requestSentAt <= acceptedObservedAt && acceptedObservedAt <= Date.now(), "Actual request and acceptance times required")
    const selected = handle
    const readTaskSnapshot = () => Instance.provide({ directory: selected.directory, fn: () => Database.transaction((db: any) => {
      const row = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, selected.taskID)).get()
      assert(row, "Actual accepted Task must be persisted")
      assert.equal(row.project_id, selected.projectID)
      assert.equal(row.request_id, selected.requestID)
      assert.equal(row.product_pillar, "code")
      const task = projectTaskRowInTransaction(db, row)
      const scope = readTaskDurableActivityScope(db, task)
      const root = scope.sessions.find((session: any) => session.id === task.session_id)
      assert(root, "Actual Task root must belong to the selected durable Project tree")
      assert.equal(path.resolve(root.directory), path.resolve(project))
      return { task, lifecycle: taskLifecycleProjectionInTransaction(db, task.id), scope,
        ownedPromptSessions: listOwnedPromptSessionsForTask(task.id),
        sessionActivity: scope.sessions.map((session: any) => ({ sessionID: session.id, activity: SessionStatus.getActivity(session.id) })) }
    }) })
    const first = await readTaskSnapshot()
    const pinned = { taskID: selected.taskID, projectID: selected.projectID, rootSessionID: first.task.session_id,
      epoch: first.lifecycle.epoch, openedEventID: first.lifecycle.openedEventID, openedAt: first.lifecycle.openedAt }
    assert(Number.isSafeInteger(pinned.openedAt) && pinned.openedAt >= requestSentAt && pinned.openedAt <= acceptedObservedAt)
    const totalDeadlineMs = pinned.openedAt + 900_000
    await publish("task-boundary-admitted.json", { pid: process.pid, occurrence, selected, pinned,
      totalDeadlineMs, maximumMilliseconds: 900_000, inactivityMilliseconds: 180_000,
      boundary: "Fixed actual Task opening boundary survives monitor failure; parent supervision owns settlement" })
    const activityKey = (current: typeof first) => JSON.stringify({
      lifecycle: current.lifecycle,
      durable: [...current.scope.activity].sort((left: any, right: any) => left.time_updated - right.time_updated ||
        left.source.localeCompare(right.source) || left.id.localeCompare(right.id) || left.revision.localeCompare(right.revision)),
      sessions: current.sessionActivity,
      promptOwners: current.ownedPromptSessions,
    })
    let deadline = observeMissionTaskDuplexActivity({ activityKey: activityKey(first), observedAtMs: pinned.openedAt, inactivityWindowMs: 180_000 })
    const taskSnapshot = createAuditSnapshotPublisher(evidenceRoot, "task-observation")
    const retain = (current: typeof first) => taskSnapshot(JSON.parse(redactor.redact(JSON.stringify({
      observationKind: "actual-selected-task-scope", pid: process.pid, occurrence, selected, pinned,
      observedAt: new Date().toISOString(), inactivityDeadlineMs: deadline.deadlineMs, totalDeadlineMs,
      requests: state.audit.requests.length, ...current,
    }))))
    retain(first)
    if (Date.now() > totalDeadlineMs) throw new Error("TASK_MAXIMUM_DURATION")
    if (Date.now() > deadline.deadlineMs) throw new Error("TASK_ACTIVITY_INACTIVITY")
    const acceptedModels = await Instance.provide({ directory: selected.directory, fn: () => qualifyModels({ taskID: selected.taskID }) })
    await publish("task-occurrence-admitted.json", { pid: process.pid, occurrence, selected, pinned,
      inactivityMilliseconds: 180_000, maximumMilliseconds: 900_000, totalDeadlineMs, acceptedModels })
    for (;;) {
      const current = await readTaskSnapshot()
      const observedAtMs = Date.now()
      if (current.lifecycle.epoch !== pinned.epoch || current.lifecycle.openedEventID !== pinned.openedEventID ||
        current.lifecycle.openedAt !== pinned.openedAt || current.task.session_id !== pinned.rootSessionID) {
        retain(current)
        throw new Error("TASK_EXECUTION_OCCURRENCE_CHANGED")
      }
      // A late observation cannot grant a new window after the admitted bound expired.
      if (observedAtMs > totalDeadlineMs) { retain(current); throw new Error("TASK_MAXIMUM_DURATION") }
      if (observedAtMs > deadline.deadlineMs) { retain(current); throw new Error("TASK_ACTIVITY_INACTIVITY") }
      const next = activityKey(current)
      if (next !== deadline.activityKey) {
        deadline = observeMissionTaskDuplexActivity({ previous: deadline, activityKey: next, observedAtMs, inactivityWindowMs: 180_000 })
        retain(current)
      }
      if (state.audit.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
      if (current.lifecycle.status === "failed" || current.lifecycle.status === "cancelled") {
        retain(current)
        throw new Error(`TASK_TERMINAL_${current.lifecycle.status.toUpperCase()}: ${current.lifecycle.terminalError ?? current.lifecycle.status}`)
      }
      if (current.lifecycle.status === "completed" && current.ownedPromptSessions.length === 0) {
        retain(current)
        await publish("task-complete.json", { pid: process.pid, occurrence, selected, pinned, lifecycle: current.lifecycle,
          ownedPromptSessions: current.ownedPromptSessions, sessionIDs: current.scope.sessions.map((session: any) => session.id),
          artifactIDs: current.scope.artifacts.map((artifact: any) => ({ id: artifact.id, kind: artifact.kind })),
          observedAt: new Date(observedAtMs).toISOString(), requests: state.audit.requests.length,
          qualification: "Exact durable Task completed and its physical prompt owners unwound; Root separately qualifies declared resource, real UI/native download and whole service chain" })
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  })()
  process.argv = [process.execPath, path.join(packageRoot, "src/index.ts"), "serve",
    "--hostname", "127.0.0.1", "--port", String(port), "--project-dir", project,
    "--startup-receipt", receiptPath, "--startup-occurrence", occurrence,
    "--parent-pid", String(managedParent.pid), "--parent-process-instance-id", managedParent.processInstanceID,
    "--log-level", "DEBUG"]
  await Promise.all([import(source("src/index.ts")), monitor])
} catch (error) {
  await publish("failed.json", { pid: process.pid, occurrence,
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    actionRequired: "parent-owner-public-shutdown-then-physical-exit-and-paired-cleanup",
    credentialCleanup: "unverified-parent-owned" })
  // Parent must watch this file. Do not wait forever silently or claim local finally cleanup.
  process.stderr.write("Owned live Sol failed; parent must inspect sanitized failed.json and settle its process.\n")
  process.exitCode = 1
  // Keep listener alive for parent public shutdown; no process.kill, no credential deletion here.
}
