import { tool } from "ai"
import z from "zod"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import { Shell } from "@/shell/shell"
import { DEFAULT_BASH_TIMEOUT_MS } from "@/shell/timeout"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { BrowserPreviewTool, BrowserPreviewToolStaticDefinition } from "@/tool/browser-preview"
import { executeWait } from "@/tool/wait"
import { WAIT_MAX_MS, WAIT_MIN_MS, WaitToolDescription, WaitToolParameters } from "@/tool/wait-contract"
import { TOOL_RESULT_PARK_METADATA_KEY } from "@/session/tool-result-control"
import { Tool } from "@/tool/tool"
import { resolveSessionExecutionAuthority } from "@/engine/task-session-lineage"

export const ORCHESTRATOR_BASH_DEFAULT_TIMEOUT_MS = DEFAULT_BASH_TIMEOUT_MS
export const ORCHESTRATOR_BASH_MAX_TIMEOUT_MS = 10 * 60 * 1000
export const ORCHESTRATOR_WAIT_MIN_MS = WAIT_MIN_MS
export const ORCHESTRATOR_WAIT_MAX_MS = WAIT_MAX_MS

const log = Log.create({ service: "task-tools" })

export type OrchestratorToolExecutionIdentity = {
  orchestratorSessionID: string
  orchestratorMessageID: string
  toolCallID: string
}

export function validateOrchestratorBashCommand(command: string): { ok: true } | { ok: false; reason: string } {
  if (!command.trim()) return { ok: false, reason: "empty command" }
  return { ok: true }
}

export function createRuntimeRepairTools(input: {
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
  requireExecutionContext: (options: unknown, toolName: string) => OrchestratorToolExecutionIdentity
}) {
  return {
    browser_preview: tool({
      description: BrowserPreviewToolStaticDefinition.description,
      inputSchema: BrowserPreviewToolStaticDefinition.parameters,
      execute: async (params, options) => {
        const meta = input.requireExecutionContext(options, "browser_preview")
        const initialized = await BrowserPreviewTool.init()
        const abort = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal ?? input.signal
        if (!abort) throw new Error("browser_preview requires an orchestrator abort signal")
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: meta.orchestratorSessionID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          expected: { kind: "task", taskID: input.taskID },
        })
        const result = await initialized.execute(params, {
          sessionID: meta.orchestratorSessionID,
          messageID: meta.orchestratorMessageID,
          callID: meta.toolCallID,
          agent: "orchestrator",
          abort,
          messages: [],
          executionAuthority,
          executionSurface: Tool.executionSurface(["browser_preview"], []),
          extra: { taskID: input.taskID },
          metadata: () => {},
          ask: async () => {},
        })
        return result.output
      },
    }),

    bash: tool({
      description:
        "Full runtime repair command shell against the project root. Use it " +
        "to fix orchestration-time shell, git, package manager, test runner, " +
        "browser preview, dependency materialization, or toolchain blockers " +
        "encountered while scheduling work. This is NOT a deliverable " +
        "producer, NOT a code authoring lane, NOT a research/content tool, " +
        "and NOT a shortcut around the dynamic agents and deliverable ownership declared by the active expert-squad package. " +
        "The system prompt carries the executor boundary; this schema intentionally does not gate command syntax.",
      inputSchema: z.object({
        command: z
          .string()
          .min(1)
          .superRefine((command, context) => {
            const result = validateOrchestratorBashCommand(command)
            if (!result.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: result.reason })
          })
          .describe(
            "Full shell command text for runtime repair. Pipelines, chaining, redirection, command substitution, package-manager commands, test commands, git commands, and multi-line commands are valid when they repair an orchestration-time runtime blocker rather than produce the task deliverable.",
          ),
        description: z
          .string()
          .min(1)
          .describe("Concise 5-15 word statement of the runtime blocker you are repairing."),
        timeout: z
          .number()
          .int()
          .positive()
          .max(ORCHESTRATOR_BASH_MAX_TIMEOUT_MS)
          .optional()
          .describe(
            `Timeout in ms. Default ${ORCHESTRATOR_BASH_DEFAULT_TIMEOUT_MS}. Hard ceiling ${ORCHESTRATOR_BASH_MAX_TIMEOUT_MS}.`,
          ),
      }),
      execute: async ({ command, description, timeout }) => {
        const validation = validateOrchestratorBashCommand(command)
        if (!validation.ok) {
          log.info("orchestrator bash refused", { taskID: input.taskID, command, reason: validation.reason })
          return `bash refused: ${validation.reason}`
        }
        const cwd = Instance.directory
        const timeoutMs = timeout ?? ORCHESTRATOR_BASH_DEFAULT_TIMEOUT_MS
        const shell = await Shell.acceptable()
        const supervisor = await ProcessSupervisor.spawnTaskShell({ taskID: input.taskID, cwd }, {
          command,
          shell,
          env: { ...process.env },
        })
        let output = ""
        const append = (chunk: Buffer | string) => {
          output += typeof chunk === "string" ? chunk : chunk.toString()
        }
        supervisor.stdout?.on("data", append)
        supervisor.stderr?.on("data", append)

        let timedOut = false
        let terminationPromise: Promise<number> | undefined
        let resolveTerminationRequested: ((promise: Promise<number>) => void) | undefined
        const terminationRequested = new Promise<Promise<number>>((resolve) => {
          resolveTerminationRequested = resolve
        })
        const requestTermination = (reason: string) => {
          if (!terminationPromise) {
            terminationPromise = ProcessSupervisor.terminateAndWaitForExit(supervisor, `orchestrator bash ${reason}`)
            terminationPromise.catch(() => undefined)
            resolveTerminationRequested?.(terminationPromise)
          }
          return terminationPromise
        }
        const timer = setTimeout(() => {
          timedOut = true
          requestTermination(`timeout ${timeoutMs}ms`)
        }, timeoutMs)
        const onAbort = () => requestTermination("abort")
        if (input.signal?.aborted) requestTermination("abort")
        input.signal?.addEventListener("abort", onAbort, { once: true })

        let exitCode: number | null = null
        let primaryError: unknown
        try {
          exitCode = await Promise.race([supervisor.exited, terminationRequested.then((cleanup) => cleanup)])
          if (terminationPromise) exitCode = await terminationPromise
        } catch (error) {
          primaryError = error
          throw error
        } finally {
          clearTimeout(timer)
          input.signal?.removeEventListener("abort", onAbort)
          try {
            await ProcessSupervisor.disposeAndWaitForExit(supervisor, "orchestrator bash")
          } catch (error) {
            if (primaryError) {
              throw ProcessSupervisor.combineFailures("Orchestrator bash execution and disposal failed", [
                primaryError,
                error,
              ])
            }
            throw error
          }
        }

        const maxOutput = 30_000
        const clipped =
          output.length > maxOutput
            ? output.slice(0, maxOutput) +
              `\n\n[truncated ${output.length - maxOutput} bytes — bash is single-shot repair, not a debugger; if you need more output route through a sub-agent]`
            : output
        const trailer = timedOut ? `\n\n[command terminated after ${timeoutMs}ms timeout]` : ""
        log.info("orchestrator bash executed", {
          taskID: input.taskID,
          command,
          exit: exitCode,
          timedOut,
          outputBytes: output.length,
        })
        return `purpose=${description}; exit=${exitCode ?? "?"}; cmd=${command}\n\n${clipped}${trailer}`
      },
    }),

    wait: tool({
      description:
        WaitToolDescription +
        " In orchestrator context, wait is NOT a substitute for `question` (operator input required), `manage_task` action=fail_task (exact evidence proves force majeure beyond same-Task repair), or a real scheduler decision from the current task snapshot. Never use wait to poll child-agent completion, peer Delivery Slice reviews, or terminal evidence. After wait returns, decide from the refreshed task snapshot before the next dispatch.",
      inputSchema: WaitToolParameters,
      execute: async ({ duration_ms, reason }) => {
        const result = await executeWait({
          duration_ms,
          reason,
          signal: input.signal,
          sessionID: input.agentSessionID,
          taskID: input.taskID,
          logPhase: "orchestrator",
        })
        return {
          title: result.aborted ? "Wait Not Scheduled" : "Wait Scheduled",
          output: `${result.output} This is a scheduled park decision; do not poll with another wait.`,
          metadata: {
            requestedMs: result.requestedMs,
            aborted: result.aborted,
            jobID: result.jobID,
            nextRun: result.nextRun,
            mode: result.mode,
            nonblocking: true,
            ...(result.aborted ? {} : { [TOOL_RESULT_PARK_METADATA_KEY]: true }),
          },
        }
      },
    }),
  }
}
