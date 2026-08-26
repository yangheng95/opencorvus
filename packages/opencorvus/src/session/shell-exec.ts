import path from "path"
import z from "zod"
import { Identifier } from "../id/id"
import { Message } from "./message"
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

    const { msg, part } = await (async () => {
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
      await Session.persistMessage({ info: userMsg, parts: [userPart] })

      const msg: Message.Assistant = {
        id: Identifier.ascending("message"),
        sessionID: input.sessionID,
        author: identity.agentID,
        parentID: userMsg.id,
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
      await Session.updateMessage(msg)
      const part: Message.Part = {
        type: "tool",
        id: Identifier.ascending("part"),
        messageID: msg.id,
        sessionID: input.sessionID,
        tool: "bash",
        callID: ulid(),
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
      await Session.updatePart(part)
      return { msg, part }
    })()
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
      env: sanitizeShellEnvironment(process.env, {
        ...shellEnv.env,
        ...localEnvironment.variables,
        TERM: "dumb",
        ...gitCeilingEnvForWorktree(cwd, commandEnvironment),
        ...guardEnv,
      }),
    }
    const executionAuthority = await resolveSessionExecutionAuthority({
      sessionID: input.sessionID,
      projectID: Instance.project.id,
      expected: identity.runtimeContract?.identity.taskID
        ? { kind: "task", taskID: identity.runtimeContract.identity.taskID }
        : { kind: "conversation" },
    })
    const supervisor = executionAuthority.kind === "task"
      ? await ProcessSupervisor.spawnTaskShell(
          { taskID: executionAuthority.taskID, cwd },
          processOptions,
        )
      : await ProcessSupervisor.spawnHostShell({ ...processOptions, cwd })

    let output = ""
    supervisor.stdout?.on("data", (chunk) => {
      const text = chunk.toString()
      output += text
      if (part.state.status === "running") {
        part.state.metadata = {
          output: output,
          description: "",
        }
        Session.updatePart(part)
      }
    })

    supervisor.stderr?.on("data", (chunk) => {
      const text = chunk.toString()
      output += text
      if (part.state.status === "running") {
        part.state.metadata = {
          output: output,
          description: "",
        }
        Session.updatePart(part)
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
      aborted = true
      requestTermination("abort")
    }

    abort.addEventListener("abort", abortHandler, { once: true })

    let primaryError: unknown
    try {
      if (abort.aborted) {
        aborted = true
        requestTermination("abort")
      }
      await Promise.race([supervisor.exited, terminationRequested.then((cleanup) => cleanup)])
      if (terminationPromise) {
        await terminationPromise
      }
    } catch (error) {
      primaryError = error
      throw error
    } finally {
      abort.removeEventListener("abort", abortHandler)
      try {
        await ProcessSupervisor.disposeAndWaitForExit(supervisor, "session shell")
      } catch (error) {
        if (primaryError) {
          throw ProcessSupervisor.combineFailures("Session shell execution and disposal failed", [primaryError, error])
        }
        throw error
      }
    }

    if (aborted) {
      output += "\n\n" + ["<metadata>", "User aborted the command", "</metadata>"].join("\n")
    }
    msg.time.completed = Date.now()
    await Session.updateMessage(msg)
    if (part.state.status === "running") {
      part.state = {
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
      }
      await Session.updatePart(part)
    }
    return { info: msg, parts: [part] }
  }
}
