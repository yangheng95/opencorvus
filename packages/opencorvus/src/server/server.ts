import { Log } from "../util/log"
import { generateSpecs } from "hono-openapi"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { basicAuth } from "hono/basic-auth"
import { HTTPException } from "hono/http-exception"
import { NamedError } from "@opencorvus-ai/util/error"
import { routeRequiresProjectDirectory } from "@opencorvus-ai/transport-protocol"
import { requireServerUrl, setServerUrl } from "./runtime-url"
import { Flag } from "../flag/flag"
import { lazy } from "../util/lazy"
import { InstanceBootstrap } from "../project/bootstrap"
import { Instance, InstanceProcessAdmissionClosedError, runOutsideInstanceContext } from "../project/instance"
import { Project } from "../project/project"
import { websocket } from "hono/bun"
import z from "zod"
import { mkdir } from "node:fs/promises"
import { AuthRoutes } from "./routes/auth"
import { AppDocumentation } from "./routes/documentation"
import { GlobalRoutes } from "./routes/global"
import { MDNS } from "./mdns"
import { muteAISdkWarnings } from "@/runtime/shims"
import { OverlayUI, freezeDefaultOverlayUiSource, type FrozenOverlayUiSource } from "./overlay-ui"
import { DEFAULT_SERVER_PORT } from "./defaults"
import { requestID, serverErrorResponse } from "./error-handler"
import { Database } from "@/storage/db"
import { configureCorsOrigins, isAllowedCorsOrigin, isAllowedRequestOrigin } from "./cors"
import { ServeRuntimeMemoryMetrics } from "@/runtime/memory-metrics"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { selectProjectDirectory } from "./directory"
import { Filesystem } from "@/util/filesystem"
import { Worktree } from "@/worktree"
import { CreateTaskInput } from "@/engine/model"
import { installInProcessServerApp } from "./in-process-client"
import { projectRouteContextKind } from "./project-route-context"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import { AutomationService } from "@/scheduler/automation-service"
import { SchedulerMessageDeliveryService } from "@/protocol/scheduler-message"
import { Scheduler } from "@/scheduler"
import { GlobalConversationService } from "@/chat/global-chat-service"

muteAISdkWarnings()

export namespace Server {
  const log = Log.create({ service: "server" })
  const DEFAULT_RUNTIME_SETTLEMENT_INACTIVITY_TIMEOUT_MILLISECONDS = 60_000
  let runtimeSettlementInactivityTimeoutMilliseconds = DEFAULT_RUNTIME_SETTLEMENT_INACTIVITY_TIMEOUT_MILLISECONDS
  let runtimeHandoffCommitFailuresForTest = 0
  let runtimeHandoffPostCommitFailuresForTest = 0
  let listenerStopFailuresForTest = 0
  type PendingRuntimeRollbackReceipt = {
    label: string
    receipt: () => Promise<void>
    settled?: Promise<void>
    succeeded: boolean
    failure?: unknown
  }
  const pendingRuntimeRollbackReceipts = new Set<PendingRuntimeRollbackReceipt>()
  let runtimeRollbackReceiptForTest: (() => Promise<void>) | undefined
  let beforeRequestForTest: ((request: Request) => void | Promise<void>) | undefined

  export class RuntimeRollbackRecoveryInactivityError extends Error {
    override readonly name = "RuntimeRollbackRecoveryInactivityError"

    constructor(
      public readonly labels: readonly string[],
      public readonly inactivityTimeoutMilliseconds: number,
    ) {
      super(
        `Runtime rollback recovery made no progress for ${inactivityTimeoutMilliseconds}ms; ` +
          `${labels.length} receipt(s) remain: ${labels.join(", ")}`,
      )
    }
  }
  export type ListenOptions = {
    port: number
    hostname: string
    mdns?: boolean
    mdnsDomain?: string
    cors?: string[]
    randomPort?: boolean
    overlayUiSource?: FrozenOverlayUiSource
  }

  export class OverlayUiSourceConflictError extends Error {
    override readonly name = "OverlayUiSourceConflictError"

    constructor(
      public readonly configuredIdentity: string,
      public readonly requestedIdentity: string,
    ) {
      super(
        `The process already bound Overlay UI source ${configuredIdentity}; ` +
          `it cannot be rebound to ${requestedIdentity}`,
      )
    }
  }

  let configuredOverlayUiSource: FrozenOverlayUiSource | undefined

  function bindOverlayUiSource(requested?: FrozenOverlayUiSource): FrozenOverlayUiSource {
    if (!configuredOverlayUiSource) {
      configuredOverlayUiSource = requested ?? freezeDefaultOverlayUiSource()
      return configuredOverlayUiSource
    }
    if (requested && requested.identity !== configuredOverlayUiSource.identity) {
      throw new OverlayUiSourceConflictError(configuredOverlayUiSource.identity, requested.identity)
    }
    return configuredOverlayUiSource
  }

  const runtimeTransfers = new WeakMap<
    object,
    {
      quiesce(): Promise<void>
    }
  >()
  const inProcessApp = {
    fetch(request: Request) {
      return App().fetch(request)
    },
  }

  async function enterBoundedProjectRuntime<R>(run: () => Promise<R>): Promise<R> {
    try {
      return await run()
    } finally {
      try {
        runOutsideInstanceContext(() =>
          Instance.scheduleConvergence({ maximumRetained: Flag.OPENCORVUS_PROJECT_RUNTIME_CACHE_LIMIT }),
        )
      } catch (error) {
        if (!(error instanceof InstanceProcessAdmissionClosedError)) throw error
      }
    }
  }

  export function installInProcessClient(): void {
    installInProcessServerApp(inProcessApp)
  }

  export interface RuntimeTransferHandle {
    quiesced: Promise<void>
  }

  export async function settleCurrentProcessExecution(
    reason: string,
    options: {
      disposeInstances: () => Promise<void>
      runtimeInactivityTimeoutMilliseconds?: number
      onRuntimeCancellationRequested?: () => void
    },
  ) {
    const settlementInactivityTimeoutMilliseconds =
      options.runtimeInactivityTimeoutMilliseconds ?? runtimeSettlementInactivityTimeoutMilliseconds
    const { RuntimeExecutionSettlement, waitForRuntimeSettlementIdle } = await import("../runtime/execution-settlement")
    const startRollbackReceipt = (pending: PendingRuntimeRollbackReceipt): void => {
      if (pending.settled || pending.succeeded) return
      pending.failure = undefined
      pending.settled = Promise.resolve()
        .then(pending.receipt)
        .then(
          () => {
            pending.succeeded = true
          },
          (error) => {
            pending.failure = error
          },
        )
    }
    const awaitPendingRollbackReceipts = async (message: string, retryFailures: boolean): Promise<void> => {
      if (retryFailures) {
        for (const receipt of pendingRuntimeRollbackReceipts) {
          if (receipt.failure !== undefined) receipt.settled = undefined
          startRollbackReceipt(receipt)
        }
      }
      await waitForRuntimeSettlementIdle({
        snapshot: () =>
          [...pendingRuntimeRollbackReceipts]
            .filter((receipt) => !receipt.succeeded && receipt.failure === undefined && receipt.settled)
            .map(({ label, settled }) => ({ label, settled: settled! })),
        inactivityTimeoutMilliseconds: settlementInactivityTimeoutMilliseconds,
        inactivityError: (labels) =>
          new RuntimeRollbackRecoveryInactivityError(labels, settlementInactivityTimeoutMilliseconds),
      })
      const succeeded = [...pendingRuntimeRollbackReceipts].filter((receipt) => receipt.succeeded)
      for (const receipt of succeeded) pendingRuntimeRollbackReceipts.delete(receipt)
      const failures = [...pendingRuntimeRollbackReceipts].flatMap((receipt) =>
        receipt.failure === undefined ? [] : [receipt.failure],
      )
      if (failures.length > 0) throw new AggregateError(failures, message)
    }
    await awaitPendingRollbackReceipts("Previous runtime rollback recovery failed", true)
    const runtimeExecutionGate = RuntimeExecutionSettlement.acquireSettlementGate()
    const settlementGates: Disposable[] = [runtimeExecutionGate]
    let gatesReleased = false
    const releaseSettlementGates = () => {
      if (gatesReleased) return
      gatesReleased = true
      const failures: unknown[] = []
      for (const gate of [...settlementGates].reverse()) {
        try {
          gate[Symbol.dispose]()
        } catch (error) {
          failures.push(error)
        }
      }
      if (failures.length > 0) {
        throw new AggregateError(failures, "Runtime settlement gate release failed")
      }
    }
    const awaitRollbackReceipts = async (
      receipts: Array<(() => Promise<void>) | undefined>,
      message: string,
    ): Promise<void> => {
      const selectedReceipts = runtimeRollbackReceiptForTest ? [...receipts, runtimeRollbackReceiptForTest] : receipts
      for (const [index, receipt] of selectedReceipts.entries()) {
        if (!receipt) continue
        const pending: PendingRuntimeRollbackReceipt = {
          label: `runtime-rollback-receipt:${index}`,
          receipt,
          succeeded: false,
        }
        startRollbackReceipt(pending)
        pendingRuntimeRollbackReceipts.add(pending)
      }
      await awaitPendingRollbackReceipts(message, false)
    }
    let detachedDispatchGate: (Disposable & { waitForIdle(): Promise<void> }) | undefined
    let gitSettlementGate:
      | (Disposable & { waitForIdle(inactivityTimeoutMilliseconds?: number): Promise<void> })
      | undefined
    let instanceSettlementGate:
      | (Disposable & { waitForIdle(inactivityTimeoutMilliseconds: number): Promise<void> })
      | undefined
    let globalSchedulerSettlementGate: (Disposable & { commit(): void }) | undefined
    let eventFireSettlementGate:
      | (Disposable & {
          commit(): void
          rollback(): () => Promise<void>
        })
      | undefined
    let busSettlementGate:
      | (Disposable & {
          commit(): void
          rollback(): () => Promise<void>
        })
      | undefined
    let reconcileTaskControl: (() => Promise<void>) | undefined
    try {
      runtimeExecutionGate.closeAdmission([
        "scheduler_event_fire",
        "scheduler_automation_fire",
        "session_wake_loop",
        "task_cancellation",
        "detached_dispatch_pipeline",
      ])
      runtimeExecutionGate.requestCancellation(
        [
          "scheduler_event_fire",
          "scheduler_automation_fire",
          "session_wake_loop",
          "detached_dispatch_pipeline",
          "protocol_publication",
        ],
        new Error(reason),
      )
      options.onRuntimeCancellationRequested?.()
      const { Bus } = await import("../bus")
      busSettlementGate = Bus.acquireProcessSettlementGate()
      settlementGates.push(busSettlementGate)
      const { acquireDetachedDispatchSettlementGate } = await import("../orchestrator/dispatch-agent-tool")
      detachedDispatchGate = acquireDetachedDispatchSettlementGate()
      settlementGates.push(detachedDispatchGate)
      const { SessionPromptState } = await import("../session/prompt/state")
      settlementGates.push(SessionPromptState.acquireProcessSettlementGate())
      globalSchedulerSettlementGate = Scheduler.acquireGlobalSettlementGate()
      settlementGates.push(globalSchedulerSettlementGate)
      const { EventService } = await import("../scheduler/event-service")
      eventFireSettlementGate = EventService.acquireProcessSettlementGate()
      settlementGates.push(eventFireSettlementGate)
    } catch (error) {
      const resumeEventFires = eventFireSettlementGate?.rollback()
      const resumeBusPublications = busSettlementGate?.rollback()
      const rollbackFailures: unknown[] = []
      try {
        releaseSettlementGates()
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError)
      }
      try {
        await awaitRollbackReceipts(
          [resumeEventFires, resumeBusPublications],
          "Runtime settlement admission rollback failed",
        )
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError)
      }
      if (rollbackFailures.length > 0) {
        throw new AggregateError(
          [error, ...rollbackFailures],
          "Runtime settlement gate acquisition and rollback failed",
        )
      }
      throw error
    }
    let terminated:
      | Awaited<ReturnType<(typeof import("../engine/writer"))["terminateCurrentProcessOwnedExecution"]>>
      | undefined
    try {
      const schedulerSettlement = Scheduler.disposeGlobal({
        inactivityTimeoutMilliseconds: settlementInactivityTimeoutMilliseconds,
      })
      void schedulerSettlement.catch((error) => {
        log.error("global scheduler settlement failed", { error })
      })
      const { terminateCurrentProcessOwnedExecution } = await import("../engine/writer")
      terminated = await terminateCurrentProcessOwnedExecution({ reason })
      const settledExecution = terminated
      // Session termination publishes the real terminal lifecycle occurrence.
      // Keep protocol admission open until every current-process execution owner
      // has emitted that fact, then fence new publications before the final drain.
      runtimeExecutionGate.closeAdmission(["protocol_publication"])
      await schedulerSettlement
      runtimeExecutionGate.requestCancellation(["protocol_publication"], new Error(reason))
      await runtimeExecutionGate.waitForIdle(
        [
          "scheduler_event_fire",
          "scheduler_automation_fire",
          "session_wake_loop",
          "task_cancellation",
          "protocol_publication",
          "detached_dispatch_pipeline",
        ],
        settlementInactivityTimeoutMilliseconds,
      )
      await detachedDispatchGate!.waitForIdle()
      const taskRootIngressDelivery = await import("../engine/task-root-ingress-delivery")
      const taskControlDirectories = taskRootIngressDelivery.snapshotTaskControlReconciliationDirectories()
      reconcileTaskControl =
        taskControlDirectories.length === 0
          ? undefined
          : () =>
              taskRootIngressDelivery.reconcileTaskControlAfterRuntimeRollback(taskControlDirectories)
      runtimeExecutionGate.closeAdmission(["task_control_activation"])
      runtimeExecutionGate.requestCancellation(["task_control_activation"], new Error(reason))
      await runtimeExecutionGate.waitForIdle(["task_control_activation"], settlementInactivityTimeoutMilliseconds)
      const { awaitTaskMessageProtocolBridgeIdle } = await import("../orchestrator/protocol/message-bridge")
      await Database.awaitEffectIdle(settlementInactivityTimeoutMilliseconds)
      await awaitTaskMessageProtocolBridgeIdle()
      instanceSettlementGate = Instance.acquireProcessSettlementGate()
      await instanceSettlementGate.waitForIdle(settlementInactivityTimeoutMilliseconds)
      await options.disposeInstances()
      const databaseEffectGate = await Database.acquireEffectSettlementGate(settlementInactivityTimeoutMilliseconds)
      settlementGates.push(databaseEffectGate)
      await awaitTaskMessageProtocolBridgeIdle()
      const { ProjectGitLock } = await import("../worktree/git-lock")
      gitSettlementGate = ProjectGitLock.acquireSettlementGate()
      settlementGates.push(gitSettlementGate)
      await gitSettlementGate.waitForIdle(settlementInactivityTimeoutMilliseconds)
      const mandatorySpawnGate = await ProcessSupervisor.acquireRuntimeMandatorySettlementGate()
      let commitDecisionApplied = false
      let mandatorySpawnGateReleased = false
      let settlementGatesReleased = false
      let instanceGateReleased = false
      let executionHandoffReleased = false
      return {
        ...settledExecution,
        releaseHandoff(commit = true): void | Promise<void> {
          if (!commit && commitDecisionApplied) {
            throw new Error("Committed runtime handoff cleanup must resume through its exact commit receipt")
          }
          const resumeEventFires = commit ? undefined : eventFireSettlementGate!.rollback()
          const resumeBusPublications = commit ? undefined : busSettlementGate!.rollback()
          if (commit) {
            if (!commitDecisionApplied) {
              if (runtimeHandoffCommitFailuresForTest > 0) {
                runtimeHandoffCommitFailuresForTest -= 1
                throw new Error("injected runtime handoff commit cleanup failure")
              }
              eventFireSettlementGate!.commit()
              busSettlementGate!.commit()
              globalSchedulerSettlementGate!.commit()
              runtimeExecutionGate.commit()
              commitDecisionApplied = true
            }
            if (!mandatorySpawnGateReleased) {
              mandatorySpawnGate[Symbol.dispose]()
              mandatorySpawnGateReleased = true
            }
            if (runtimeHandoffPostCommitFailuresForTest > 0) {
              runtimeHandoffPostCommitFailuresForTest -= 1
              throw new Error("injected runtime handoff post-commit cleanup failure")
            }
            if (!settlementGatesReleased) {
              try {
                releaseSettlementGates()
              } finally {
                if (gatesReleased) settlementGatesReleased = true
              }
            }
            if (!instanceGateReleased) {
              instanceSettlementGate?.[Symbol.dispose]()
              instanceSettlementGate = undefined
              instanceGateReleased = true
            }
            if (!executionHandoffReleased) {
              settledExecution.releaseHandoff()
              executionHandoffReleased = true
            }
            return
          }
          return (async () => {
            const failures: unknown[] = []
            const attempt = (operation: () => void) => {
              try {
                operation()
              } catch (error) {
                failures.push(error)
              }
            }
            attempt(() => {
              mandatorySpawnGate[Symbol.dispose]()
            })
            attempt(releaseSettlementGates)
            attempt(() => {
              instanceSettlementGate?.[Symbol.dispose]()
              instanceSettlementGate = undefined
            })
            attempt(() => settledExecution.releaseHandoff())
            try {
              await awaitRollbackReceipts(
                [resumeEventFires, resumeBusPublications, reconcileTaskControl],
                "Runtime handoff rollback recovery failed",
              )
            } catch (error) {
              failures.push(error)
            }
            if (failures.length > 0) throw new AggregateError(failures, "Runtime handoff rollback failed")
          })()
        },
      }
    } catch (error) {
      const resumeEventFires = eventFireSettlementGate?.rollback()
      const resumeBusPublications = busSettlementGate?.rollback()
      const rollbackFailures: unknown[] = []
      const attempt = (operation: () => void) => {
        try {
          operation()
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError)
        }
      }
      attempt(() => {
        instanceSettlementGate?.[Symbol.dispose]()
        instanceSettlementGate = undefined
      })
      attempt(releaseSettlementGates)
      attempt(() => terminated?.releaseHandoff())
      try {
        await awaitRollbackReceipts(
          [resumeEventFires, resumeBusPublications, reconcileTaskControl],
          "Runtime settlement admission rollback failed",
        )
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError)
      }
      if (rollbackFailures.length > 0) {
        throw new AggregateError([error, ...rollbackFailures], "Runtime settlement and rollback failed")
      }
      throw error
    }
  }

  /** Complete the exact settlement receipt through cleanup failures.
   * Production callers retain and retry the same receipt until it converges;
   * no successor settlement or database owner can replace a partial commit. */
  export async function releaseRuntimeHandoff(
    release: (commit?: boolean) => void | Promise<void>,
    commit = true,
    options: { attempts?: number; delayMilliseconds?: number } = {},
  ): Promise<void> {
    const attempts = options.attempts
    const delayMilliseconds = options.delayMilliseconds ?? 25
    let failure: unknown
    for (let attempt = 1; attempts === undefined || attempt <= attempts; attempt += 1) {
      try {
        await release(commit)
        return
      } catch (error) {
        failure = error
        if (attempts === undefined || attempt < attempts) await Bun.sleep(delayMilliseconds)
      }
    }
    throw failure
  }

  export const TestHooks = {
    installBeforeRequest(hook: (request: Request) => void | Promise<void>): Disposable {
      if (beforeRequestForTest) throw new Error("Server request test hook is already installed")
      beforeRequestForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeRequestForTest === hook) beforeRequestForTest = undefined
        },
      }
    },
    installRuntimeRollbackReceipt(receipt: () => Promise<void>): Disposable {
      if (runtimeRollbackReceiptForTest) throw new Error("Runtime rollback receipt test hook is already installed")
      runtimeRollbackReceiptForTest = receipt
      return {
        [Symbol.dispose]() {
          if (runtimeRollbackReceiptForTest === receipt) runtimeRollbackReceiptForTest = undefined
        },
      }
    },
    failNextRuntimeHandoffCommit(attempts: number): Disposable {
      const previous = runtimeHandoffCommitFailuresForTest
      runtimeHandoffCommitFailuresForTest = attempts
      return {
        [Symbol.dispose]() {
          runtimeHandoffCommitFailuresForTest = previous
        },
      }
    },
    failNextRuntimeHandoffPostCommit(attempts: number): Disposable {
      const previous = runtimeHandoffPostCommitFailuresForTest
      runtimeHandoffPostCommitFailuresForTest = attempts
      return {
        [Symbol.dispose]() {
          runtimeHandoffPostCommitFailuresForTest = previous
        },
      }
    },
    failNextListenerStop(attempts: number): Disposable {
      const previous = listenerStopFailuresForTest
      listenerStopFailuresForTest = attempts
      return {
        [Symbol.dispose]() {
          listenerStopFailuresForTest = previous
        },
      }
    },
    installRuntimeSettlementInactivityTimeout(inactivityTimeoutMilliseconds: number): Disposable {
      if (!Number.isInteger(inactivityTimeoutMilliseconds) || inactivityTimeoutMilliseconds <= 0) {
        throw new Error(`Invalid runtime settlement inactivity timeout ${inactivityTimeoutMilliseconds}`)
      }
      const previous = runtimeSettlementInactivityTimeoutMilliseconds
      runtimeSettlementInactivityTimeoutMilliseconds = inactivityTimeoutMilliseconds
      return {
        [Symbol.dispose]() {
          runtimeSettlementInactivityTimeoutMilliseconds = previous
        },
      }
    },
  }

  /** Stop request admission while process-owned execution settles. */
  export function beginRuntimeTransfer(server: ReturnType<typeof Bun.serve>): RuntimeTransferHandle {
    const transfer = runtimeTransfers.get(server)
    if (!transfer) throw new Error("Server runtime transfer state is unavailable")
    return {
      quiesced: transfer.quiesce(),
    }
  }

  /**
   * Project-scoped routes require an explicit `directory` (via `?directory=`
   * or `x-opencorvus-directory` header). Falling back to `process.cwd()`
   * silently bound the entire orchestrator to whatever directory the
   * sidecar was launched in — on darwin .app this is `/`, which made
   * every subsequent project request 500 (rule 7: no fallback).
   */
  export const DirectoryRequiredError = NamedError.create(
    "DirectoryRequiredError",
    z.object({
      message: z.string(),
    }),
  )
  export const RequestOriginForbiddenError = NamedError.create(
    "RequestOriginForbiddenError",
    z.object({
      message: z.string(),
      origin: z.string(),
      host: z.string().optional(),
    }),
  )
  export const InvalidInitGitParameterError = NamedError.create(
    "InvalidInitGitParameterError",
    z.object({
      value: z.string(),
      message: z.string(),
    }),
  )

  let projectRoutesApp: Hono | undefined
  let projectRoutesAppPromise: Promise<Hono> | undefined

  export function url(): URL {
    return requireServerUrl()
  }

  async function loadProjectRoutesApp(root: Hono) {
    if (projectRoutesApp) return projectRoutesApp
    if (!projectRoutesAppPromise) {
      projectRoutesAppPromise = import("./routes/app")
        .then(({ AppRoutes }) => {
          projectRoutesApp = AppRoutes(root)
          return projectRoutesApp
        })
        .catch((error) => {
          projectRoutesAppPromise = undefined
          throw error
        })
    }
    return projectRoutesAppPromise
  }

  export function resetProjectRoutesAppForTest() {
    projectRoutesApp = undefined
    projectRoutesAppPromise = undefined
  }

  export async function routeInventoryApp(): Promise<Hono> {
    const { AppRoutes, resetAppRouteFactoriesForOpenApi } = await import("./routes/app")
    resetAppRouteFactoriesForOpenApi()
    GlobalRoutes.reset()
    AuthRoutes.reset()
    const documented = AppRoutes(new Hono())
      .route("/global", GlobalRoutes())
      .route("/auth", AuthRoutes())
      .route("/ui", OverlayUI.routes(Object.freeze({ kind: "missing", identity: "missing" })))
    const routed = documented as unknown as Hono & {
      routes: Array<{ method: string }>
    }
    routed.routes = routed.routes.filter((route) => route.method !== "ALL")
    return routed
  }

  type OpenAPIParameter = {
    name?: string
    in?: string
    [key: string]: unknown
  }

  type OpenAPIOperation = {
    parameters?: OpenAPIParameter[]
    requestBody?: {
      required?: boolean
      content?: Record<string, { schema?: unknown }>
      [key: string]: unknown
    }
    [key: string]: unknown
  }

  type OpenAPISpecWithPaths = {
    components?: {
      schemas?: Record<string, unknown>
      [key: string]: unknown
    }
    paths?: Record<string, unknown>
    [key: string]: unknown
  }

  const DIRECTORY_QUERY_PARAMETER = {
    name: "directory",
    in: "query",
    required: false,
    description:
      "Project directory for project-scoped routes. Equivalent to the x-opencorvus-directory request header.",
    schema: {
      type: "string",
    },
  } as const
  const TASK_CREATE_INIT_GIT_QUERY_PARAMETER = {
    name: "init-git",
    in: "query",
    required: false,
    description:
      "POST /task only. Defaults to true. When true, the selected directory is created when missing and initialized as Git when needed before task creation.",
    schema: {
      type: "boolean",
      default: true,
    },
  } as const

  const OPENAPI_OPERATION_METHODS = ["get", "post", "put", "patch", "delete"] as const

  function hasQueryParameter(operation: OpenAPIOperation, name: string) {
    return (operation.parameters ?? []).some((parameter) => parameter.in === "query" && parameter.name === name)
  }

  function addDirectoryQueryParameter<T extends OpenAPISpecWithPaths>(spec: T) {
    for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
      if (!pathItem || typeof pathItem !== "object") continue
      const operations = pathItem as Record<string, unknown>
      for (const method of OPENAPI_OPERATION_METHODS) {
        if (!routeRequiresProjectDirectory(routePath, method.toUpperCase())) continue
        const rawOperation = operations[method]
        if (!rawOperation || typeof rawOperation !== "object") continue
        const operation = rawOperation as OpenAPIOperation
        if (hasQueryParameter(operation, "directory")) continue
        operation.parameters = [DIRECTORY_QUERY_PARAMETER satisfies OpenAPIParameter, ...(operation.parameters ?? [])]
      }
    }
    return spec
  }

  function addTaskCreateInitGitQueryParameter<T extends OpenAPISpecWithPaths>(spec: T) {
    const pathItem = spec.paths?.["/task"]
    if (!pathItem || typeof pathItem !== "object") return spec
    const operations = pathItem as Record<string, unknown>
    const rawOperation = operations.post
    if (!rawOperation || typeof rawOperation !== "object") return spec
    const operation = rawOperation as OpenAPIOperation
    if (hasQueryParameter(operation, "init-git")) return spec
    operation.parameters = [...(operation.parameters ?? []), TASK_CREATE_INIT_GIT_QUERY_PARAMETER]
    return spec
  }

  function hasRequiredSchemaFields(schema: unknown, spec: OpenAPISpecWithPaths, seen = new Set<string>()): boolean {
    if (!schema || typeof schema !== "object") return false
    const value = schema as {
      $ref?: unknown
      required?: unknown
      oneOf?: unknown
      anyOf?: unknown
      allOf?: unknown
    }
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
      if (seen.has(value.$ref)) return false
      seen.add(value.$ref)
      const name = value.$ref.slice("#/components/schemas/".length)
      return hasRequiredSchemaFields(spec.components?.schemas?.[name], spec, seen)
    }
    if (Array.isArray(value.required) && value.required.length > 0) return true
    for (const union of [value.oneOf, value.anyOf, value.allOf]) {
      if (Array.isArray(union) && union.some((branch) => hasRequiredSchemaFields(branch, spec, new Set(seen)))) {
        return true
      }
    }
    return false
  }

  function markRequiredJsonRequestBodies<T extends OpenAPISpecWithPaths>(spec: T) {
    for (const pathItem of Object.values(spec.paths ?? {})) {
      if (!pathItem || typeof pathItem !== "object") continue
      const operations = pathItem as Record<string, unknown>
      for (const method of OPENAPI_OPERATION_METHODS) {
        const rawOperation = operations[method]
        if (!rawOperation || typeof rawOperation !== "object") continue
        const operation = rawOperation as OpenAPIOperation
        const requestBody = operation.requestBody
        const jsonSchema = requestBody?.content?.["application/json"]?.schema
        if (!requestBody || !hasRequiredSchemaFields(jsonSchema, spec)) continue
        requestBody.required = true
      }
    }
    return spec
  }

  function isTaskCreateRequest(routePath: string, method: string) {
    return method.toUpperCase() === "POST" && routePath === "/task"
  }

  function parseTaskCreateInitGit(value: string | undefined) {
    if (value === undefined) return true
    if (value === "true") return true
    if (value === "false") return false
    throw new InvalidInitGitParameterError({
      value,
      message: `Invalid init-git query parameter "${value}". Use "true" or "false".`,
    })
  }

  async function prepareTaskCreateDirectory(input: { directory: string; initGit: boolean }) {
    if (Project.isGitRepo(input.directory)) return
    if (!input.initGit) {
      throw new Worktree.NotGitError({
        message: `Cannot create a task in ${input.directory}: the directory is not a git repository and init-git=false.`,
      })
    }
    await mkdir(input.directory, { recursive: true })
    await Project.initGit(input.directory)
  }

  async function validateTaskCreateBodyBeforeDirectoryPrepare(request: Request) {
    let body: unknown
    try {
      body = await request.clone().json()
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : String(error),
      })
    }
    const parsed = CreateTaskInput.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message })
    }
  }

  const app = new Hono()
  const createApp: () => Hono = lazy(
    () =>
      app
        .onError(serverErrorResponse)
        .use((c, next) => {
          if (c.req.method === "OPTIONS") return next()
          const password = Flag.OPENCORVUS_SERVER_PASSWORD
          if (!password) return next()
          const username = Flag.OPENCORVUS_SERVER_USERNAME ?? "opencorvus"
          return basicAuth({ username, password })(c, next)
        })
        .use(async (c, next) => {
          await beforeRequestForTest?.(c.req.raw)
          const skipLogging = c.req.path === "/log" || c.req.path.startsWith("/log/")
          const id = requestID(c)
          c.header("x-opencorvus-request-id", id)
          const started = Date.now()
          if (!skipLogging) {
            log.info("request", {
              requestID: id,
              method: c.req.method,
              path: c.req.path,
              status: "started",
            })
          }
          try {
            await next()
            if (!skipLogging) {
              log.info("request", {
                requestID: id,
                method: c.req.method,
                path: c.req.path,
                status: "completed",
                statusCode: c.res.status,
                duration: Date.now() - started,
              })
            }
          } catch (error) {
            if (!skipLogging) {
              log.error("request", {
                requestID: id,
                method: c.req.method,
                path: c.req.path,
                status: "failed",
                duration: Date.now() - started,
                error,
              })
            }
            throw error
          }
        })
        .use(async (c, next) => {
          const origin = c.req.header("origin")
          const host = c.req.header("host")
          if (isAllowedRequestOrigin(origin, host)) return next()
          throw new RequestOriginForbiddenError({
            message: `Request Origin is not allowed: ${origin}`,
            origin: origin!,
            host,
          })
        })
        .use(
          cors({
            origin(input) {
              return isAllowedCorsOrigin(input) ? input : undefined
            },
            // ETag means Entity Tag, the immutable digest validator for the returned Artifact bytes.
            exposeHeaders: ["Content-Disposition", "Content-Range", "ETag"],
          }),
        )
        .route("/global", GlobalRoutes())
        .route("/auth", AuthRoutes())
        .route("/ui", OverlayUI.routes(bindOverlayUiSource()))
        .use(async (c, next) => {
          // Control-plane routes must stay available even if project bootstrap is broken.
          // /favicon.ico is browser-issued before the overlay UI sets the
          // x-opencorvus-directory header (browsers fetch favicons before
          // any app JS runs). Without this bypass it throws
          // DirectoryRequiredError on every page load — noisy in logs and
          // a real failure for non-Tauri preview windows that have no UI
          // chance to attach the directory header. Falls through to the
          // root router; if no handler matches, the request 404s cleanly.
          const selectedDirectory = selectProjectDirectory({
            queryDirectory: c.req.query("directory"),
            headerDirectory: c.req.header("x-opencorvus-directory"),
          })
          if (!routeRequiresProjectDirectory(c.req.path, c.req.method)) {
            return next()
          }
          if (!selectedDirectory) {
            throw new DirectoryRequiredError({
              message: `Project-scoped route ${c.req.path} requires ?directory= query parameter or x-opencorvus-directory header`,
            })
          }
          const directory = Filesystem.resolve(selectedDirectory)
          if (isTaskCreateRequest(c.req.path, c.req.method)) {
            await validateTaskCreateBodyBeforeDirectoryPrepare(c.req.raw)
            await prepareTaskCreateDirectory({
              directory,
              initGit: parseTaskCreateInitGit(c.req.query("init-git")),
            })
          }
          const projectContext = projectRouteContextKind(c.req.path, c.req.method)
          if (projectContext === "persisted") {
            return enterBoundedProjectRuntime(() => PersistedProjectContext.provide({ directory, fn: () => next() }))
          }
          if (projectContext === "identity") {
            return enterBoundedProjectRuntime(() => Instance.provideProjectIdentity({ directory, fn: () => next() }))
          }
          return enterBoundedProjectRuntime(() =>
            Instance.provide({ directory, init: InstanceBootstrap, fn: () => next() }),
          )
        })
        .all("*", async (c) => {
          const projectApp = await loadProjectRoutesApp(app)
          const response = await projectApp.fetch(c.req.raw, c.env)
          response.headers.set("x-opencorvus-request-id", requestID(c))
          return response
        }) as unknown as Hono,
  )

  export function App(): Hono {
    installInProcessClient()
    bindOverlayUiSource()
    return createApp()
  }

  export async function openapi() {
    const { resetAppRouteFactoriesForOpenApi } = await import("./routes/app")
    try {
      const result = await generateSpecs(await routeInventoryApp(), {
        documentation: AppDocumentation,
      })
      return markRequiredJsonRequestBodies(addTaskCreateInitGitQueryParameter(addDirectoryQueryParameter(result)))
    } finally {
      resetAppRouteFactoriesForOpenApi()
      GlobalRoutes.reset()
      AuthRoutes.reset()
    }
  }

  export function initializeGlobalAutomation() {
    AutomationService.initGlobal({ createGlobalConversation: GlobalConversationService.create })
  }

  function bind(opts: ListenOptions, initializeGlobalServices: boolean) {
    /**
     * When true, port=0 maps directly to OS-assigned random port without
     * first attempting DEFAULT_SERVER_PORT. Required by independently
     * managed server instances so they never collide on the default port.
     */
    let boundServer: ReturnType<typeof Bun.serve> | undefined
    let runtimeStopInstalled = false
    try {
      bindOverlayUiSource(opts.overlayUiSource)
      configureCorsOrigins(opts.cors)
      if (initializeGlobalServices) {
        initializeGlobalAutomation()
        SchedulerMessageDeliveryService.initGlobal()
      }

      const args = {
        hostname: opts.hostname,
        idleTimeout: 0,
        fetch: App().fetch,
        websocket: websocket,
      } as const
      let failure: unknown
      const tryServe = (port: number) => {
        try {
          return Bun.serve({ ...args, port })
        } catch (error) {
          failure = error
          return undefined
        }
      }
      let server: ReturnType<typeof Bun.serve> | undefined
      if (opts.randomPort) {
        if (opts.port !== 0) {
          throw new Error(`randomPort=true requires port=0, got ${opts.port}`)
        }
        server = tryServe(0)
      } else if (opts.port === 0) {
        server = tryServe(DEFAULT_SERVER_PORT) ?? tryServe(0)
      } else {
        server = tryServe(opts.port)
      }
      if (!server) {
        const detail = failure instanceof Error ? failure.message : failure ? String(failure) : "unknown"
        throw new Error(`Failed to start server on port ${opts.port}: ${detail}`)
      }
      boundServer = server

      setServerUrl(server.url)

      const shouldPublishMDNS =
        opts.mdns &&
        server.port &&
        opts.hostname !== "127.0.0.1" &&
        opts.hostname !== "localhost" &&
        opts.hostname !== "::1"
      if (shouldPublishMDNS) {
        MDNS.publish(server.port!, opts.mdnsDomain)
      } else if (opts.mdns) {
        log.warn("mDNS enabled but hostname is loopback; skipping mDNS publish")
      }

      const unregisterProcessMetrics = ServeRuntimeMemoryMetrics.register({
        id: "supervised-processes",
        snapshot: () => ProcessSupervisor.metricsSnapshot(),
      })
      const runtimeMemoryMetrics = ServeRuntimeMemoryMetrics.start()
      const originalStop = server.stop.bind(server)
      let listenerStopped = false
      let quiesceOperation: Promise<void> | undefined
      let stopOperation: Promise<void> | undefined
      let cleanupFailures: unknown[] = []
      const quiesce = (closeActiveConnections = true) => {
        if (quiesceOperation) return quiesceOperation
        const operation = (async () => {
          const failures: unknown[] = []
          try {
            await runtimeMemoryMetrics.stop()
          } catch (error) {
            failures.push(error)
          }
          try {
            unregisterProcessMetrics()
          } catch (error) {
            failures.push(error)
          }
          if (shouldPublishMDNS) {
            try {
              MDNS.unpublish()
            } catch (error) {
              failures.push(error)
            }
          }
          try {
            if (listenerStopFailuresForTest > 0) {
              listenerStopFailuresForTest -= 1
              throw new Error("injected server listener stop failure")
            }
            await originalStop(closeActiveConnections)
            listenerStopped = true
          } catch (error) {
            failures.push(error)
          }
          if (!listenerStopped) {
            if (failures.length === 1) throw failures[0]
            throw new AggregateError(failures, "Server listener and cleanup stop failed")
          }
          cleanupFailures = failures
          if (failures.length > 0) {
            log.error("server cleanup failed after listener quiesced", {
              error:
                failures.length === 1
                  ? failures[0]
                  : new AggregateError(failures, "Server cleanup failed after listener quiesced"),
            })
          }
        })()
        quiesceOperation = operation
        void operation.catch(() => {
          if (!listenerStopped && quiesceOperation === operation) quiesceOperation = undefined
        })
        return operation
      }
      runtimeTransfers.set(server, {
        quiesce,
      })
      server.stop = (closeActiveConnections?: boolean) => {
        if (stopOperation) return stopOperation
        const operation = (async () => {
          let confirmRuntimeCancellation!: () => void
          let failRuntimeCancellation!: (error: unknown) => void
          const runtimeCancellationRequested = new Promise<void>((resolve, reject) => {
            confirmRuntimeCancellation = resolve
            failRuntimeCancellation = reject
          })
          const termination = settleCurrentProcessExecution("Server.stop graceful runtime shutdown", {
            disposeInstances: () => Instance.disposeAll(),
            onRuntimeCancellationRequested: confirmRuntimeCancellation,
          })
          void termination.catch(failRuntimeCancellation)
          await runtimeCancellationRequested
          try {
            await quiesce(closeActiveConnections)
          } catch (quiesceError) {
            const failures: unknown[] = [quiesceError]
            try {
              const terminated = await termination
              await terminated.releaseHandoff(false)
            } catch (settlementError) {
              failures.push(settlementError)
            }
            throw failures.length === 1
              ? failures[0]
              : new AggregateError(failures, "Server listener quiesce and runtime settlement rollback failed")
          }
          const terminated = await termination
          await releaseRuntimeHandoff(terminated.releaseHandoff)
          if (cleanupFailures.length === 1) throw cleanupFailures[0]
          if (cleanupFailures.length > 1) {
            throw new AggregateError(cleanupFailures, "Server cleanup failed after listener stopped")
          }
        })()
        stopOperation = operation
        void operation.catch(() => {
          if (stopOperation === operation) stopOperation = undefined
        })
        return operation
      }
      runtimeStopInstalled = true

      return server
    } catch (error) {
      let listenerCleanupComplete = boundServer === undefined
      let terminated: Awaited<ReturnType<typeof settleCurrentProcessExecution>> | undefined
      const cleanup = async () => {
        if (runtimeStopInstalled) {
          await boundServer!.stop(true)
          return
        }
        if (!listenerCleanupComplete && boundServer) {
          await boundServer.stop(true)
          listenerCleanupComplete = true
        }
        terminated ??= await settleCurrentProcessExecution("Server.listen initialization failure", {
          disposeInstances: () => Instance.disposeAll(),
        })
        await releaseRuntimeHandoff(terminated.releaseHandoff)
      }
      void cleanup().catch((cleanupError) => {
        log.error("server startup cleanup failed", { error: cleanupError })
      })
      throw error
    }
  }

  export function listen(opts: ListenOptions) {
    return bind(opts, true)
  }

  export function listenPrepared(opts: ListenOptions) {
    return bind(opts, false)
  }
}
