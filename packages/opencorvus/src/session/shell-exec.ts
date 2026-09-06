import path from "path"
import z from "zod"
import { Identifier } from "../id/id"
import { Message } from "./message"
import { MessageStore } from "./message-store"
import { Session } from "."
import { Instance } from "../project/instance"
import { Plugin } from "../plugin"
import { defer } from "../util/defer"
import { ulid } from "ulid"
import { Shell } from "@/shell/shell"
import { PidGuard } from "@/shell/pid-guard"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { SessionPromptState } from "./prompt/state"
import { gitCeilingEnvForWorktree } from "@/worktree/git-ceiling"
import { SessionContext } from "./context"
import { EffectiveConfig } from "@/config/effective"
import { resolveAgentModelRef, resolveProjectedWorkerModelRef } from "@/agent/model"
import { SessionRuntimeContractStore, isProjectedWorkerRuntimeContract } from "./runtime-contract"
import { LocalEnvironment } from "@/config/local-environment"
import { sanitizeShellEnvironment } from "@/shell/environment"
import { createExecutionCancellationOrigin } from "./prompt/cancellation"
import { resolveSessionExecutionAuthority } from "@/engine/task-session-lineage"
import { ProjectMemory } from "@/memory/project-memory"
import {
  currentRuntimeProcessOccurrence,
  observedProcessOccurrence,
  type RuntimeProcessOccurrenceInfo,
} from "@/runtime/process-occurrence"
import { executionInterruptionFailure } from "@/engine/execution-interruption"
import { toolFailureCauseFromUnknown } from "./tool-failure-cause"
import {
  ControlLeaseFenceLostError,
  acquireControlLease,
  assertControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLease,
} from "@/engine/control-lease"

type SessionShellResume = (input: { sessionID: string; resume_existing: true }) => Promise<unknown>

let resumeSessionLoop: SessionShellResume | undefined

export function configureSessionShellResume(resume: SessionShellResume): void {
  if (resumeSessionLoop && resumeSessionLoop !== resume) {
    throw new Error("Session shell resume runner is already configured")
  }
  resumeSessionLoop = resume
}

function requireSessionShellResume(): SessionShellResume {
  if (!resumeSessionLoop) throw new Error("Session shell resume runner is not configured")
  return resumeSessionLoop
}

export namespace SessionShell {
  const { log, state, start, cancel } = SessionPromptState
  const PROCESS_OWNERSHIP_METADATA_KEY = "sessionShellProcessOwnership"
  const CHILD_PROCESS_OCCURRENCE_METADATA_KEY = "sessionShellChildProcessOccurrence"
  const SHELL_LEASE_MILLISECONDS = 30_000
  const SHELL_LEASE_RENEWAL_MILLISECONDS = 5_000
  export const TestHooks: {
    afterPromptOwnerAcquired?: (input: { sessionID: string }) => void | Promise<void>
  } = {}
  const RuntimeProcessOccurrence = z
    .object({
      pid: z.number().int().positive(),
      processInstanceID: z.string().min(1),
      occurrenceID: z.string().min(1),
    })
    .strict()
  const PersistedProcessOwner = z
    .object({
      version: z.literal(1),
      owner: RuntimeProcessOccurrence,
      leaseID: z.string().min(1),
      leaseOwnerOccurrenceID: z.string().min(1),
    })
    .strict()
  export type ProcessOwnership = z.infer<typeof PersistedProcessOwner> & {
    child?: RuntimeProcessOccurrenceInfo
  }

  function ownershipMetadata(
    owner: RuntimeProcessOccurrenceInfo,
    lease: { leaseID: string; ownerOccurrenceID: string },
  ) {
    return PersistedProcessOwner.parse({
      version: 1,
      owner,
      leaseID: lease.leaseID,
      leaseOwnerOccurrenceID: lease.ownerOccurrenceID,
    })
  }

  export function processOwnershipMetadata(
    owner: RuntimeProcessOccurrenceInfo,
    lease: { leaseID: string; ownerOccurrenceID: string },
  ): Record<string, z.infer<typeof PersistedProcessOwner>> {
    return { [PROCESS_OWNERSHIP_METADATA_KEY]: ownershipMetadata(owner, lease) }
  }

  export function processChildOwnershipMetadata(
    child: RuntimeProcessOccurrenceInfo,
  ): Record<string, RuntimeProcessOccurrenceInfo> {
    return { [CHILD_PROCESS_OCCURRENCE_METADATA_KEY]: RuntimeProcessOccurrence.parse(child) }
  }

  export function processOwnership(part: Message.ToolPart): ProcessOwnership | undefined {
    const parsed = PersistedProcessOwner.safeParse(part.metadata?.[PROCESS_OWNERSHIP_METADATA_KEY])
    if (!parsed.success) return undefined
    const child = RuntimeProcessOccurrence.safeParse(
      part.state.status === "running" ? part.state.metadata?.[CHILD_PROCESS_OCCURRENCE_METADATA_KEY] : undefined,
    )
    return child.success ? { ...parsed.data, child: child.data } : parsed.data
  }

  function settleOwnedTerminal(input: {
    message: Message.Assistant
    part: Message.ToolPart
    ownership: ProcessOwnership
  }): Message.WithParts {
    let fencedAt = 0
    const settled = Session.updateMessageAndPartWithCommit(
      { info: input.message, part: input.part },
      (db) => {
        fencedAt = Date.now()
        assertControlLeaseInTransaction(db, {
          target: "session_shell",
          targetID: input.part.id,
          leaseID: input.ownership.leaseID,
          ownerOccurrenceID: input.ownership.leaseOwnerOccurrenceID,
          now: fencedAt,
        })
      },
      (db) => {
        const released = releaseControlLeaseInTransaction(db, {
          target: "session_shell",
          targetID: input.part.id,
          leaseID: input.ownership.leaseID,
          ownerOccurrenceID: input.ownership.leaseOwnerOccurrenceID,
          now: fencedAt,
        })
        if (!released) throw new ControlLeaseFenceLostError(`Session shell ${input.part.id} lost its terminal lease`)
      },
    )
    return { info: settled.info, parts: [settled.part] }
  }

  function settleCaughtExecutionFailure(input: {
    message: Message.Assistant
    part: Message.ToolPart
    ownership: ProcessOwnership
    error: unknown
  }): Message.WithParts {
    const now = Date.now()
    let completedAt = now
    let failedPart = input.part
    if (input.part.state.status === "pending" || input.part.state.status === "running") {
      failedPart = {
        ...input.part,
        state: {
          status: "error",
          input: input.part.state.input,
          failure: toolFailureCauseFromUnknown({
            error: input.error,
            originSite: "SessionShell.shell",
            classification: "tool-execution",
            kind: "session-shell-execution-failed",
            data: {
              sessionID: input.message.sessionID,
              messageID: input.message.id,
              toolPartID: input.part.id,
              callID: input.part.callID,
            },
          }),
          time: { start: input.part.state.time.start, end: Math.max(now, input.part.state.time.start + 1) },
        },
      }
      completedAt = failedPart.state.status === "error" ? failedPart.state.time.end : now
    } else if (input.part.state.status === "completed" || input.part.state.status === "error") {
      completedAt = input.part.state.time.end
    }
    const failedMessage: Message.Assistant =
      input.message.time.completed === undefined
        ? {
            ...input.message,
            error: Message.fromError(input.error, { providerID: input.message.providerID }),
            finish: "error",
            time: { ...input.message.time, completed: completedAt },
          }
        : input.message
    return settleOwnedTerminal({ message: failedMessage, part: failedPart, ownership: input.ownership })
  }

  function interruptedOccurrenceError(sessionID: string, assistantMessageID: string) {
    const interruption = new Error(
      `Previous process ended before Session ${sessionID} completed shell assistant ${assistantMessageID}`,
    )
    interruption.name = "ProcessExecutionInterruptedError"
    return interruption
  }

  export async function terminalizeInterruptedOccurrence(input: {
    sessionID: string
    assistantMessageID: string
  }): Promise<Message.WithParts> {
    const current = await MessageStore.get({ sessionID: input.sessionID, messageID: input.assistantMessageID })
    if (current.info.role !== "assistant") {
      throw new Error(`Interrupted shell Message ${input.assistantMessageID} is not an assistant`)
    }
    const shellParts = current.parts.filter(
      (part): part is Message.ToolPart => part.type === "tool" && part.tool === "bash",
    )
    const open = shellParts.filter((part) => part.state.status === "pending" || part.state.status === "running")
    const interruption = interruptedOccurrenceError(input.sessionID, input.assistantMessageID)
    if (open.length > 0) {
      let completedAt = current.info.time.created + 1
      for (const part of open) {
        const start = part.state.time.start
        const failedPart: Message.ToolPart = {
          ...part,
          state: {
            status: "error",
            input: part.state.input,
            failure: executionInterruptionFailure({
              sessionID: input.sessionID,
              messageID: current.info.id,
              toolPartID: part.id,
              toolCallID: part.callID,
              toolName: part.tool,
              error: interruption,
              originSite: "SessionShell.terminalizeInterruptedOccurrence",
            }),
            time: { start, end: start + 1 },
          },
        }
        await Session.updatePart(failedPart)
        completedAt = Math.max(completedAt, failedPart.state.status === "error" ? failedPart.state.time.end : start + 1)
      }
      if (current.info.time.completed === undefined) {
        const terminalMessage: Message.Assistant = {
          ...current.info,
          error: Message.fromError(interruption, { providerID: current.info.providerID }),
          finish: "error",
          time: { ...current.info.time, completed: completedAt },
        }
        await Session.updateMessage(terminalMessage)
      }
    } else if (current.info.time.completed === undefined) {
      const terminalEnds = shellParts.flatMap((part) =>
        part.state.status === "completed" || part.state.status === "error" ? [part.state.time.end] : [],
      )
      if (terminalEnds.length > 0 && shellParts.every((part) => part.state.status === "completed")) {
        const terminalMessage: Message.Assistant = {
          ...current.info,
          finish: "stop",
          time: { ...current.info.time, completed: Math.max(...terminalEnds) },
        }
        await Session.updateMessage(terminalMessage)
      } else {
        const terminalMessage: Message.Assistant = {
          ...current.info,
          error: Message.fromError(interruption, { providerID: current.info.providerID }),
          finish: "error",
          time: {
            ...current.info.time,
            completed: Math.max(current.info.time.created + 1, ...terminalEnds),
          },
        }
        await Session.updateMessage(terminalMessage)
      }
    }
    return MessageStore.get({ sessionID: input.sessionID, messageID: input.assistantMessageID })
  }

  export const ShellInput = z.object({
    sessionID: Identifier.schema("session"),
    /** The caller-visible request occurrence: the input Message identity.
     *  Minted here only for internal callers that carry no replay contract. */
    messageID: Identifier.schema("message").optional(),
    agent: z.string(),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    command: z.string(),
    /** Caller-owned durable facts merged onto the input Message (never part
     *  of the public route schema). */
    extra: z.record(z.string(), z.any()).optional(),
  })
  export type ShellInput = z.infer<typeof ShellInput>
  export async function shell(input: ShellInput) {
    const { resolveSessionMessageIdentity } = await import("./message-identity")
    const session = await Session.get(input.sessionID)
    const identity = await resolveSessionMessageIdentity({
      session,
      requestedAgentID: input.agent,
      config: await EffectiveConfig.effective({ sessionID: input.sessionID }),
    })
    using _runtimeOperation = SessionRuntimeContractStore.claimOperation(
      input.sessionID,
      identity.runtimeContract,
      "session shell",
    )
    const abort = start(input.sessionID)
    if (!abort) {
      throw new Session.BusyError(input.sessionID)
    }

    await using _ = defer(async () => {
      const callbacks = state()[input.sessionID]?.callbacks ?? []
      if (callbacks.length === 0) {
        cancel(input.sessionID, session.directory, {
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "session",
            reason: "Session shell completed without an attached prompt callback",
            targetSessionID: input.sessionID,
          }),
        })
      } else {
        const resume = requireSessionShellResume()
        SessionContext.provide(session, () => resume({ sessionID: input.sessionID, resume_existing: true })).catch(
          (error: any) => {
            log.error("session loop failed to resume after shell command", { sessionID: input.sessionID, error })
          },
        )
      }
    })
    await TestHooks.afterPromptOwnerAcquired?.({ sessionID: input.sessionID })

    const occurrence = await (async () => {
      using _runtimeIdentity = SessionRuntimeContractStore.claimMessageWrite(input.sessionID, identity.runtimeContract)
      const projectedIdentity =
        identity.runtimeContract && isProjectedWorkerRuntimeContract(identity.runtimeContract)
          ? identity.runtimeContract.identity
          : undefined
      const model = await SessionContext.provide(session, () =>
        projectedIdentity
          ? resolveProjectedWorkerModelRef(
              {
                expertSquadID: projectedIdentity.expertSquadID,
                agentID: projectedIdentity.agentID,
                baseRole: projectedIdentity.baseRole,
              },
              { explicitModel: input.model, sessionID: input.sessionID },
            )
          : resolveAgentModelRef(identity.baseRole, {
              explicitModel: input.model,
              sessionID: input.sessionID,
            }),
      )
      const userMsg: Message.User = {
        id: input.messageID ?? Identifier.ascending("message"),
        sessionID: input.sessionID,
        author: "user",
        time: {
          created: Date.now(),
        },
        role: "user",
        agent: identity.agentID,
        model: {
          providerID: model.providerID,
          modelID: model.modelID,
        },
        extra: {
          ...ProjectMemory.userInputExtra({ surface: "session.shell", literalText: input.command }),
          ...input.extra,
        },
      }
      const userPart: Message.Part = {
        type: "text",
        id: Identifier.ascending("part"),
        messageID: userMsg.id,
        sessionID: input.sessionID,
        text: "The following tool was executed by the user",
      }
      const msg: Message.Assistant = {
        id: Identifier.ascending("message"),
        sessionID: input.sessionID,
        author: identity.agentID,
        parentID: userMsg.id,
        acceptedInputMessageIDs: [userMsg.id],
        agent: identity.agentID,
        cost: 0,
        path: {
          cwd: Instance.directory,
          root: Instance.worktree,
        },
        time: {
          created: Date.now(),
        },
        role: "assistant",
        tokens: {
          total: 0,
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        modelID: model.modelID,
        providerID: model.providerID,
      }
      const processOwner = currentRuntimeProcessOccurrence()
      const partID = Identifier.ascending("part")
      const callID = ulid()
      const leaseID = Identifier.deterministic("call", `session-shell-lease\0${partID}`)
      const part: Message.Part = {
        type: "tool",
        id: partID,
        messageID: msg.id,
        sessionID: input.sessionID,
        tool: "bash",
        callID,
        metadata: processOwnershipMetadata(processOwner, { leaseID, ownerOccurrenceID: callID }),
        state: {
          status: "running",
          time: {
            start: Date.now(),
          },
          input: {
            command: input.command,
          },
        },
      }
      await Session.persistClaimedMessagePair({
        claim: { info: userMsg, parts: [userPart] },
        dependent: { info: msg, parts: [part] },
        commit: () => {
          const acquired = acquireControlLease({
            target: "session_shell",
            targetID: part.id,
            ownerOccurrenceID: callID,
            leaseID,
            now: Date.now(),
            leaseMilliseconds: SHELL_LEASE_MILLISECONDS,
          })
          if (!acquired.acquired || acquired.lease.id !== leaseID) {
            throw new Error(`Session shell ${part.id} could not acquire its exact execution lease`)
          }
        },
      })
      return { msg, part }
    })()
    const msg = occurrence.msg
    let part = occurrence.part
    const ownership = processOwnership(part)
    if (!ownership) throw new Error(`Session shell ${part.id} is missing its persisted execution ownership`)
    const leaseAbort = new AbortController()
    let leaseRenewalFailure: unknown
    const heartbeat = setInterval(() => {
      try {
        const now = Date.now()
        renewControlLease({
          target: "session_shell",
          targetID: part.id,
          leaseID: ownership.leaseID,
          ownerOccurrenceID: ownership.leaseOwnerOccurrenceID,
          now,
          expiresAt: now + SHELL_LEASE_MILLISECONDS,
        })
      } catch (error) {
        leaseRenewalFailure ??= error
        leaseAbort.abort(error)
      }
    }, SHELL_LEASE_RENEWAL_MILLISECONDS)
    const executionAbort = AbortSignal.any([abort, leaseAbort.signal])
    try {
      return await (async () => {
        const shellBin = Shell.preferred()
        const shellName = (
          process.platform === "win32" ? path.win32.basename(shellBin, ".exe") : path.basename(shellBin)
        ).toLowerCase()

        const localEnvironment = await LocalEnvironment.projectShellCommand(input.command)
        const invocationCommand: Record<string, string> = {
          nu: localEnvironment.command,
          fish: localEnvironment.command,
          zsh: `
            [[ -f ~/.zshenv ]] && source ~/.zshenv >/dev/null 2>&1 || true
            [[ -f "\${ZDOTDIR:-$HOME}/.zshrc" ]] && source "\${ZDOTDIR:-$HOME}/.zshrc" >/dev/null 2>&1 || true
            eval ${JSON.stringify(localEnvironment.command)}
          `,
          bash: `
            shopt -s expand_aliases
            [[ -f ~/.bashrc ]] && source ~/.bashrc >/dev/null 2>&1 || true
            eval ${JSON.stringify(localEnvironment.command)}
          `,
          cmd: localEnvironment.command,
          powershell: localEnvironment.command,
          pwsh: localEnvironment.command,
          "": localEnvironment.command,
        }

        const supervisedCommand = invocationCommand[shellName] ?? invocationCommand[""]

        const cwd = Instance.directory
        const shellEnv = await Plugin.trigger(
          "shell.env",
          { cwd, sessionID: input.sessionID, callID: part.callID },
          { env: {} },
        )
        const guardEnv = await PidGuard.env(shellBin)
        const commandEnvironment = { ...process.env, ...shellEnv.env, ...localEnvironment.variables }
        const processOptions = {
          command: supervisedCommand,
          shell: shellBin,
          owner: `session-shell:${input.sessionID}:${msg.id}`,
          env: sanitizeShellEnvironment(process.env, {
            ...shellEnv.env,
            ...localEnvironment.variables,
            TERM: "dumb",
            ...gitCeilingEnvForWorktree(cwd, commandEnvironment),
            ...guardEnv,
          }),
        }
        executionAbort.throwIfAborted()
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: input.sessionID,
          projectID: Instance.project.id,
          expected: identity.runtimeContract?.identity.taskID
            ? { kind: "task", taskID: identity.runtimeContract.identity.taskID }
            : { kind: "conversation" },
        })
        let processProgressMetadata: Record<string, unknown> = {}
        let progressWrites = Promise.resolve()
        let progressFailure: { error: unknown } | undefined
        const queueProgress = (metadata: Record<string, unknown>) => {
          progressWrites = progressWrites
            .then(async () => {
              if (progressFailure) return
              await Session.appendToolProgress({
                sessionID: part.sessionID,
                messageID: part.messageID,
                partID: part.id,
                metadata,
              })
            })
            .catch((error) => {
              progressFailure ??= { error }
            })
          return progressWrites
        }
        const admitChild = async (handle: ProcessSupervisor.Handle) => {
          executionAbort.throwIfAborted()
          const childProcess = observedProcessOccurrence(handle.pid)
          if (!childProcess) {
            throw new Error(`Session shell ${part.id} could not establish its exact gated child occurrence`)
          }
          processProgressMetadata = processChildOwnershipMetadata(childProcess)
          const admitted = await Session.appendToolProgressWithCommit(
            {
              sessionID: part.sessionID,
              messageID: part.messageID,
              partID: part.id,
              metadata: processProgressMetadata,
            },
            (db) => {
              assertControlLeaseInTransaction(db, {
                target: "session_shell",
                targetID: part.id,
                leaseID: ownership.leaseID,
                ownerOccurrenceID: ownership.leaseOwnerOccurrenceID,
                now: Date.now(),
              })
            },
          )
          if (!admitted.persisted) {
            throw new ControlLeaseFenceLostError(
              `Session shell ${part.id} could not publish its exact child before start admission`,
            )
          }
          executionAbort.throwIfAborted()
        }
        const supervisor =
          executionAuthority.kind === "task"
            ? await ProcessSupervisor.spawnTaskShellGated(
                { taskID: executionAuthority.taskID, cwd },
                { ...processOptions, signal: executionAbort },
                admitChild,
              )
            : await ProcessSupervisor.spawnHostShellGated(
                { ...processOptions, cwd, signal: executionAbort },
                admitChild,
              )

        let output = ""
        supervisor.stdout?.on("data", (chunk) => {
          const text = chunk.toString()
          output += text
          if (part.state.status === "running") {
            void queueProgress({
              ...processProgressMetadata,
              output: output,
              description: "",
            })
          }
        })

        supervisor.stderr?.on("data", (chunk) => {
          const text = chunk.toString()
          output += text
          if (part.state.status === "running") {
            void queueProgress({
              ...processProgressMetadata,
              output: output,
              description: "",
            })
          }
        })

        let aborted = false

        let terminationPromise: Promise<number> | undefined
        let resolveTerminationRequested: ((promise: Promise<number>) => void) | undefined
        const terminationRequested = new Promise<Promise<number>>((resolve) => {
          resolveTerminationRequested = resolve
        })
        const requestTermination = (reason: string) => {
          if (!terminationPromise) {
            terminationPromise = ProcessSupervisor.terminateAndWaitForExit(supervisor, `session shell ${reason}`)
            terminationPromise.catch(() => undefined)
            resolveTerminationRequested?.(terminationPromise)
          }
          return terminationPromise
        }

        const abortHandler = () => {
          aborted = abort.aborted
          requestTermination(leaseRenewalFailure ? "lease loss" : "abort")
        }

        executionAbort.addEventListener("abort", abortHandler, { once: true })

        let primaryError: unknown
        try {
          if (executionAbort.aborted) abortHandler()
          await Promise.race([supervisor.exited, terminationRequested.then((cleanup) => cleanup)])
          if (terminationPromise) {
            await terminationPromise
          }
        } catch (error) {
          primaryError = error
        } finally {
          executionAbort.removeEventListener("abort", abortHandler)
          const failures: unknown[] = primaryError ? [primaryError] : []
          try {
            await ProcessSupervisor.disposeAndWaitForExit(supervisor, "session shell")
          } catch (error) {
            failures.push(error)
          }
          await progressWrites
          if (progressFailure && !failures.includes(progressFailure.error)) failures.push(progressFailure.error)
          if (leaseRenewalFailure && !failures.includes(leaseRenewalFailure)) failures.push(leaseRenewalFailure)
          if (failures.length > 0) {
            throw ProcessSupervisor.combineFailures("Session shell execution, progress, or disposal failed", failures)
          }
        }

        if (aborted) {
          output += "\n\n" + ["<metadata>", "User aborted the command", "</metadata>"].join("\n")
        }
        const completedPart: Message.ToolPart =
          part.state.status === "running"
            ? {
                ...part,
                state: {
                  status: "completed",
                  time: {
                    ...part.state.time,
                    end: Date.now(),
                  },
                  input: part.state.input,
                  title: "",
                  metadata: {
                    output,
                    description: "",
                  },
                  output,
                },
              }
            : part
        const completedMessage: Message.Assistant = {
          ...msg,
          finish: "stop",
          time: { ...msg.time, completed: Date.now() },
        }
        return settleOwnedTerminal({ message: completedMessage, part: completedPart, ownership })
      })().catch(async (error) => {
        if (error instanceof ControlLeaseFenceLostError) {
          return terminalizeInterruptedOccurrence({ sessionID: msg.sessionID, assistantMessageID: msg.id })
        }
        try {
          return settleCaughtExecutionFailure({ message: msg, part, ownership, error })
        } catch (settlementError) {
          if (settlementError instanceof ControlLeaseFenceLostError) {
            return terminalizeInterruptedOccurrence({ sessionID: msg.sessionID, assistantMessageID: msg.id })
          }
          throw ProcessSupervisor.combineFailures("Session shell failure settlement failed", [error, settlementError])
        }
      })
    } finally {
      clearInterval(heartbeat)
      releaseControlLeaseOnErrorPath({
        target: "session_shell",
        targetID: part.id,
        leaseID: ownership.leaseID,
        ownerOccurrenceID: ownership.leaseOwnerOccurrenceID,
        now: Date.now(),
      })
    }
  }
}
