import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { execFileSync } from "node:child_process"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { CredentialRedactor, RealProviderAudit, assertCopiedOAuthAccess } from "./real-provider-audit"

// Explicit opt-in checker. All model/data/credential work belongs to its new private runtime.
const authorized = process.env.GOAL_CHECK_ALLOW_REAL_PROVIDER === "1"
const authSource = process.env.GOAL_CHECK_AUTH_SOURCE
const model = process.env.GOAL_CHECK_MODEL
const evidence = process.env.GOAL_CHECK_EVIDENCE
const kind = process.env.GOAL_CHECK_KIND
const reviewPath = process.env.GOAL_CHECK_REVIEW_RUN
const review = reviewPath
  ? (JSON.parse(await fs.readFile(path.resolve(reviewPath), "utf8")) as {
      runtimeRoot: string
      projectDirectory: string
      ownerID: string
      sessionID: string
      directory: string
    })
  : undefined
if (review) {
  const relative = path.relative(os.tmpdir(), review.runtimeRoot)
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.startsWith("opencorvus-test-run-"))
    throw new Error("Review requires a previous isolated goal-check runtime.")
}
const tokenBudget = Number(process.env.GOAL_CHECK_TOKEN_BUDGET ?? "180000")
if (!Number.isSafeInteger(tokenBudget) || tokenBudget <= 0)
  throw new Error("Goal checker token budget must be positive.")
if (!authorized || !authSource || !model || !evidence || !["chat", "task", "mission"].includes(kind ?? ""))
  throw new Error("Set GOAL_CHECK_ALLOW_REAL_PROVIDER=1, AUTH_SOURCE, MODEL, EVIDENCE and KIND (chat/task/mission).")
const sourceModel = model
const evidenceRoot = path.resolve(evidence)
await fs.mkdir(evidenceRoot, { recursive: true })
const runtime = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(runtime)
if (review) {
  process.env.OPENCORVUS_HOME = review.runtimeRoot
  process.env.OPENCORVUS_TEST_PROCESS_ROOT = path.dirname(review.runtimeRoot)
}
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
  model: sourceModel,
  small_model: sourceModel,
  permission_mode: "full_access",
})
const { prepareTestProcessSupervisor } = await import("./prepare-test-process-supervisor")
const supervisor = prepareTestProcessSupervisor()
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const projectDirectory = review?.projectDirectory ?? path.join(runtime.processRoot, "project")
await fs.mkdir(projectDirectory, { recursive: true })
for (const args of review
  ? []
  : [
      ["init"],
      ["config", "user.name", "Goal Acceptance"],
      ["config", "user.email", "goal@example.invalid"],
      ["commit", "--allow-empty", "-m", "Isolated goal acceptance"],
    ]) {
  execFileSync("git", args, { cwd: projectDirectory, stdio: "ignore" })
}
const actualRuntimeRoot = review?.runtimeRoot ?? runtime.runtimeRoot
const authTarget = path.join(actualRuntimeRoot, "data", "auth.json")
const modelsTarget = path.join(actualRuntimeRoot, "data", "models.json")
await fs.mkdir(path.dirname(authTarget), { recursive: true })
await fs.copyFile(path.resolve(authSource), authTarget)
await fs.copyFile(path.join(path.dirname(path.resolve(authSource)), "models.json"), modelsTarget)
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(authTarget, "utf8")))
const deadline = Date.now() + 900_000
let server: { url: URL; stop(closeActiveConnections?: boolean): Promise<void> } | undefined
let audit: RealProviderAudit | undefined
let failure: unknown
const result: Record<string, unknown> = {
  kind,
  model,
  projectDirectory,
  runtimeRoot: actualRuntimeRoot,
  startedAt: Date.now(),
}
const save = async (name: string, value: unknown) => {
  await fs.writeFile(path.join(evidenceRoot, name), redactor.redact(JSON.stringify(value, null, 2)))
}
try {
  const { Log } = await import("@/util/log")
  await Log.init({ print: false })
  const { Auth } = await import("@/auth")
  const { Provider } = await import("@/provider/provider")
  const { Instance } = await import("@/project/instance")
  const { SessionStatus } = await import("@/session/status")
  const { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime } = await import("@/cli/server-runtime")
  const { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded } = await import(
    "@/engine/host-recovery"
  )
  const separator = sourceModel.indexOf("/")
  if (separator <= 0) throw new Error("GOAL_CHECK_MODEL must be Provider/model.")
  const credential = await Auth.get(sourceModel.slice(0, separator))
  if (!credential) throw new Error("Authorized Provider credential is unavailable.")
  const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
  if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
  audit = new RealProviderAudit(sourceModel.slice(separator + 1), review ? 0 : 64, undefined, authority)
  await Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      const projected = await Provider.getModel(sourceModel.slice(0, separator), sourceModel.slice(separator + 1))
      if (projected.api.id !== audit!.modelID)
        throw new Error("Target model is not projected to the exact actual request model.")
    },
  })
  const prepared = await requireRecoveredServerRuntime(
    await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions())
      },
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  server = prepared.server
  audit.localOrigins.add(server.url.origin)
  result.url = server.url.toString()
  const json = async (route: string, body?: unknown, directory = projectDirectory) => {
    const url = new URL(route, server!.url)
    url.searchParams.set("directory", directory)
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new Error(route + " " + response.status + ": " + (await response.text()))
    return response.json() as Promise<any>
  }
  if (review) {
    Object.assign(result, {
      ownerID: review.ownerID,
      sessionID: review.sessionID,
      directory: review.directory,
      status: "review_ready",
    })
    await save("server.json", result)
    console.log(JSON.stringify({ stage: "review_ready", url: result.url, kind }))
    while (Date.now() < deadline && !(await fs.stat(path.join(evidenceRoot, "finish")).catch(() => undefined)))
      await Bun.sleep(1_000)
  } else {
    result.preflight = await audit.preflight({
      serverURL: server.url,
      model: sourceModel,
      inactivityMs: 180_000,
      activity: SessionStatus.getActivity,
    })
    await save("server.json", result)
    console.log(JSON.stringify({ stage: "ready", kind, url: result.url, directory: projectDirectory }))
    const request = [
      "请执行一个有明确结束条件的持续目标模式验收。用户明确授权创建持续目标，tokenBudget=" +
        tokenBudget +
        "，turnBudget=3。",
      "目标：分三个真实轮次整理一份两阶段交付说明，不访问外部网站、不部署、不修改权限、不读凭据。",
      "首次输入这一轮：创建目标，说明阶段一负责需求核对、阶段二负责验收核对，然后结束本轮回复，保持目标 active。",
      "第一次 goal-controller 自动续跑：给出阶段一的三项具体核对标准，结束本轮回复，保持目标 active。",
      "第二次 goal-controller 自动续跑：给出阶段二的三项具体核对标准，核对两组标准已经实际写在消息中，然后将持续目标标记 complete，reason 引用实际消息或内容证据。",
      "只用当前模式的既有角色权限。本验收无需委派其他 Agent 或创建子 Task；不要定时等待，不要提前 complete。",
      kind === "task"
        ? "本 Task 由当前负责人直接完成这份短说明。前两轮用现有 no_action 结算当前输入；最后完成持续目标后按当前 Task 完成合同结算 Task。"
        : "",
      kind === "mission"
        ? "本 Mission 只进行有限协调说明，不派发子 Task；最后通过既有 Mission 完成合同结束，空 task_acceptances 对此有限协调有效。"
        : "",
    ]
      .filter(Boolean)
      .join("\n")
    let ownerID: string
    let sessionID: string
    let directory = projectDirectory
    if (kind === "chat") {
      const started = await json("/global/chat/start", {
        requestID: crypto.randomUUID(),
        model: sourceModel,
        text: request,
      })
      ownerID = sessionID = started.session.id
      directory = started.session.directory
    } else if (kind === "mission") {
      const started = await json("/mission/wake", {
        requestID: crypto.randomUUID(),
        productPillar: "work",
        text: request,
        model: sourceModel,
        expertSquadIDs: ["base"],
      })
      ownerID = sessionID = started.sessionID
    } else {
      const started = await json("/task", {
        requestID: crypto.randomUUID(),
        productPillar: "code",
        title: "持续目标真实验收",
        source: "continuous-goal-check",
        promptProfile: "base",
        request,
        model: sourceModel,
      })
      ownerID = started.task_id
      const board = await json("/task/" + ownerID)
      sessionID = board.sessionID ?? board.session_id ?? board.task?.sessionID ?? board.task?.session_id
    }
    Object.assign(result, { ownerID, sessionID, directory, request })
    await save("server.json", result)
    let goal: any
    while (Date.now() < deadline) {
      if (audit.exhausted) throw new Error("Real Provider request budget reached.")
      goal = await json("/continuous-goal/" + kind + "/" + ownerID, undefined, directory)
      result.goal = goal
      if (goal) {
        const { goalScopeSessionIDs, resolveGoalOwner } = await import("@/continuous-goal/store")
        const { SessionPromptOwner } = await import("@/session/prompt/owner")
        const settled = await Instance.provide({
          directory,
          fn: async () =>
            goalScopeSessionIDs(resolveGoalOwner(goal.owner)).every((id) => !SessionPromptOwner.activeExecution(id)),
        })
        if (settled && goal.status === "complete") break
        if (settled && ["blocked", "budget_limited", "paused"].includes(goal.status))
          throw new Error("Goal stopped: " + JSON.stringify(goal))
      }
      await Bun.sleep(1_000)
    }
    if (goal?.status !== "complete" || goal.turnsAccepted < 2)
      throw new Error("Goal did not complete at least two actual automatic continuations.")
    result.goal = goal
    sessionID = goal.sessionID
    const { Session } = await import("@/session")
    await Instance.provide({
      directory,
      fn: async () => {
        const sessions = await Session.treeInProject({ sessionID, projectID: goal.projectID })
        const transcripts = []
        for (const id of sessions) {
          const messages = (await Session.messages({ sessionID: id })).map((message) => ({
            info: message.info,
            parts: message.parts
              .filter((part) => part.type !== "reasoning")
              .map((part) => {
                const { metadata: _metadata, ...visible } = part as typeof part & { metadata?: unknown }
                return visible
              }),
          }))
          transcripts.push({ sessionID: id, messages })
        }
        await save("transcripts.json", transcripts)
        const controllerInputs = transcripts
          .flatMap((entry) => entry.messages)
          .filter((message) => message.info.role === "user" && message.info.author === "goal-controller")
        if (controllerInputs.length < 2) throw new Error("Missing actual visible goal-controller Messages.")
        result.controllerMessageIDs = controllerInputs.map((message) => message.info.id)
        if (kind === "task") {
          const { taskLifecycleProjection } = await import("@/engine/task-lifecycle")
          result.taskLifecycle = taskLifecycleProjection(ownerID)
          if ((result.taskLifecycle as { status: string }).status !== "completed")
            throw new Error("Continuous goal completed before the normal Task completion contract.")
        }
      },
    })
    result.status = "passed"
    await save("result.json", result)
    console.log(
      JSON.stringify({
        stage: "passed",
        kind,
        goalID: goal.id,
        turns: goal.turnsAccepted,
        tokens: goal.tokensUsed,
        url: result.url,
      }),
    )
    // Optional bounded manual /ui inspection. No browser automation is run here.
    const stopFile = path.join(evidenceRoot, "finish")
    while (
      process.env.GOAL_CHECK_HOLD_UI === "1" &&
      Date.now() < deadline &&
      !(await fs.stat(stopFile).catch(() => undefined))
    )
      await Bun.sleep(1_000)
  }
} catch (error) {
  failure = error
  result.status = "failed"
  result.error = redactor.redact(error instanceof Error ? (error.stack ?? error.message) : String(error))
  await save("result.json", result)
  console.error(redactor.redact(error instanceof Error ? error.message : String(error)))
} finally {
  try {
    if (server) await server.stop(true)
    const { Instance } = await import("@/project/instance")
    await Instance.disposeAll()
    const { Database } = await import("@/storage/db")
    Database.close()
    result.settled = true
  } catch (error) {
    failure ??= error
    result.settled = false
    result.cleanupError = String(error)
  }
  if (audit) {
    await save("provider-audit.json", { exhausted: audit.exhausted, requests: audit.requests })
    audit[Symbol.dispose]()
  }
  for (const file of [authTarget, modelsTarget]) await fs.rm(file, { force: true })
  await save("settlement.json", { settled: result.settled, credentialPairRemoved: true, endedAt: Date.now() })
}
if (failure) process.exitCode = 1
