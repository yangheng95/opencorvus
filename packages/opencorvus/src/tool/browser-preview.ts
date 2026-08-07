import z from "zod"
import { persistBrowserPreviewTarget } from "@/browser-preview/persist"
import { deriveBrowserPreviewUrlsFromDevServerCommand } from "@/browser-preview/dev-server-command"
import { extractBrowserPreviewUrlsFromText } from "@/browser-preview/extract"
import { waitForBrowserPreviewUrlReachable } from "@/browser-preview/liveness"
import { browserPreviewTaskEvidenceRoot } from "@/browser-preview/task-evidence-root"
import {
  missingBrowserPreviewTarget,
  normalizeBrowserPreviewUrl,
  resolveBrowserPreviewTarget,
} from "@/browser-preview/target"
import { BrowserPreviewViewport, normalizeBrowserPreviewViewports } from "@/browser-preview/viewport"
import {
  readTaskProcessBinding,
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
} from "@/engine/task-execution-capsule-binding"
import { Instance } from "@/project/instance"
import { BashTool } from "./bash"
import { BrowserPreviewToolID } from "./browser-preview-tool-ids"
import { Tool } from "./tool"

const DEFAULT_PREVIEW_SERVICE_DESCRIPTION = "Start browser preview service"
const DEFAULT_PREVIEW_TARGET_STARTUP_WAIT_MS = 45_000
const PREVIEW_TARGET_DISCOVERY_INTERVAL_MS = 250
const PREVIEW_TARGET_PROBE_SLICE_MS = 1_000

type BrowserPreviewStartupCandidateSource = "explicit" | "process-output" | "command"
type BrowserPreviewStartupCandidate = {
  source: BrowserPreviewStartupCandidateSource
  url: string
  reachable?: boolean
  persistedTargetID?: string
  skipReason?: string
}

export const BrowserPreviewToolParameters = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      "Frontend dev/preview/serve command to keep running in the background, for example `npm run dev -- --host 127.0.0.1 --port 5173`.",
    ),
  workdir: z
    .string()
    .describe("Working directory for the service command. Defaults to the current project directory.")
    .optional(),
  url: z
    .string()
    .min(1)
    .describe(
      "Optional explicit preview URL (Uniform Resource Locator) to save after the service starts, for commands that do not print a local URL.",
    )
    .optional(),
  viewports: BrowserPreviewViewport.array()
    .min(1)
    .describe(
      "Task-scoped preview viewport dimensions to persist with the target. These must come from source evidence or the current deliverable requirements, not global presets.",
    ),
  timeout: z.number().describe("Optional startup readiness wait in milliseconds before this tool returns.").optional(),
  leaseTimeout: z
    .number()
    .describe("Optional background service lease in milliseconds. Defaults to the bash background lease.")
    .optional(),
  description: z.string().describe("Optional concise label for the service startup command.").optional(),
})
export type BrowserPreviewToolParameters = z.infer<typeof BrowserPreviewToolParameters>

export const BrowserPreviewToolDescription =
  "Explicitly start a long-lived frontend preview service for the current task and save the resulting task-scoped browser preview target. Reuses the bash process supervisor and browser_preview_target artifacts; use this when a real running app must back the Preview panel or downstream visual evidence. This is the only tool path that may infer preview URLs from service startup output; ordinary command output does not update preview targets."

export const BrowserPreviewToolStaticDefinition = {
  description: BrowserPreviewToolDescription,
  parameters: BrowserPreviewToolParameters,
} as const

export const BrowserPreviewTool = Tool.define(BrowserPreviewToolID, async (initCtx) => {
  const bash = await BashTool.init(initCtx)

  return {
    description: BrowserPreviewToolStaticDefinition.description,
    parameters: BrowserPreviewToolStaticDefinition.parameters,
    async execute(params: BrowserPreviewToolParameters, ctx: Tool.Context) {
      const taskID = typeof ctx.extra?.taskID === "string" ? ctx.extra.taskID.trim() : ""
      if (!taskID) {
        throw new Error(
          "browser_preview requires a task context so it can persist a browser_preview_target EngineArtifact record.",
        )
      }
      const processBinding = readTaskProcessBinding(taskID)
      const defaultWorkdir = processBinding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL
        ? processBinding.workspace.root
        : processBinding.workspace_root
      const workdir = params.workdir ?? defaultWorkdir
      const viewports = normalizeBrowserPreviewViewports(params.viewports)

      const explicitUrl = normalizeBrowserPreviewUrl(params.url)
      if (params.url && !explicitUrl) {
        throw new Error(`Invalid browser preview URL: ${params.url}`)
      }

      let observedStartupOutput = ""
      const startup = await bash.execute(
        {
          command: params.command,
          workdir,
          timeout: params.timeout,
          leaseTimeout: params.leaseTimeout,
          description: params.description ?? DEFAULT_PREVIEW_SERVICE_DESCRIPTION,
          background: true,
        },
        withBrowserPreviewOutputObserver(ctx, (output) => {
          observedStartupOutput = output
        }),
      )

      const targetStartupWaitMs = params.timeout ?? DEFAULT_PREVIEW_TARGET_STARTUP_WAIT_MS
      const capsuleCwd = workdir
      let explicitUrlPersisted = false
      const startupCandidates: BrowserPreviewStartupCandidate[] = []
      if (explicitUrl) {
        const reachable = await waitForBrowserPreviewUrlReachable(explicitUrl, {
          timeoutMs: targetStartupWaitMs,
          taskID,
          cwd: capsuleCwd,
        })
        if (reachable) {
          const persisted = await persistBrowserPreviewTarget({ taskID, url: explicitUrl, viewports })
          explicitUrlPersisted = true
          startupCandidates.push({
            source: "explicit",
            url: explicitUrl,
            reachable,
            persistedTargetID: persisted.id,
          })
        } else {
          startupCandidates.push({
            source: "explicit",
            url: explicitUrl,
            reachable,
            skipReason: "explicit preview URL was not reachable",
          })
        }
      }
      let startupOutput = typeof startup.metadata.output === "string" ? startup.metadata.output : observedStartupOutput
      if (!explicitUrl) {
        startupCandidates.push(
          ...(await waitForProcessOutputPreviewTargets({
            taskID,
            output: () => observedStartupOutput || startupOutput,
            timeoutMs: targetStartupWaitMs,
            viewports,
            cwd: capsuleCwd,
          })),
        )
        startupOutput = observedStartupOutput || startupOutput
      } else {
        for (const url of extractBrowserPreviewUrlsFromText(startupOutput)) {
          startupCandidates.push({
            source: "process-output",
            url,
            skipReason: "explicit preview URL owns target selection",
          })
        }
      }
      for (const url of deriveBrowserPreviewUrlsFromDevServerCommand(params.command)) {
        const reachable = await waitForBrowserPreviewUrlReachable(url, { taskID, cwd: capsuleCwd })
        startupCandidates.push({
          source: "command",
          url,
          reachable,
          skipReason: "command-derived URL is diagnostic only; pass url to persist it",
        })
      }

      const startupTargets = startupCandidates
        .filter((item) => item.persistedTargetID)
        .map((item) => ({ id: item.persistedTargetID!, url: item.url, source: item.source }))
      const noStartupTargetDiagnostic = "No browser_preview_target was persisted for this service startup."
      const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
      const target =
        startupTargets.length > 0
          ? await resolveBrowserPreviewTarget({
              projectRoot,
              taskID,
            })
          : missingBrowserPreviewTarget({
              projectRoot,
              taskID,
              diagnostics: [noStartupTargetDiagnostic],
            })
      const payload = {
        kind: "browser_preview_service",
        taskID,
        command: params.command,
        pid: typeof startup.metadata.pid === "number" ? startup.metadata.pid : null,
        background: startup.metadata.background === true,
        target: {
          id: target.id,
          status: target.status,
          url: target.url,
          source: target.source,
        },
        explicitUrlPersisted,
        startupCandidates,
        startupTargets,
        diagnostics: [
          ...target.diagnostics,
          ...(startupTargets.length === 0 && !target.diagnostics.includes(noStartupTargetDiagnostic)
            ? [noStartupTargetDiagnostic]
            : []),
          "Overlay Preview opens from the task-scoped browser_preview_target artifact.",
        ],
      }

      return {
        title: target.status === "ready" ? "Preview service started" : "Preview service starting",
        output: JSON.stringify(payload, null, 2),
        metadata: {
          command: params.command,
          output: startup.metadata.output,
          pid: payload.pid,
          background: true as const,
          targetID: target.id,
          targetUrl: target.url,
          targetStatus: target.status,
          explicitUrlPersisted,
          startupTargets: startupTargets.map((item) => item.id),
          startupCandidates,
        },
      }
    },
  }
})

type BashOutputObserverInput = { stream: "stdout" | "stderr"; chunk: string; output: string }

function withBrowserPreviewOutputObserver(ctx: Tool.Context, observe: (output: string) => void): Tool.Context {
  const previousObserver =
    typeof ctx.extra?.bashOutputObserver === "function"
      ? (ctx.extra.bashOutputObserver as (input: BashOutputObserverInput) => void)
      : undefined
  return {
    ...ctx,
    extra: {
      ...ctx.extra,
      bashOutputObserver(input: BashOutputObserverInput) {
        observe(input.output)
        previousObserver?.(input)
      },
    },
  }
}

async function waitForProcessOutputPreviewTargets(input: {
  taskID: string
  output: () => string
  timeoutMs: number
  viewports: ReturnType<typeof normalizeBrowserPreviewViewports>
  cwd: string
}): Promise<BrowserPreviewStartupCandidate[]> {
  const candidates = new Map<string, BrowserPreviewStartupCandidate>()
  const start = Date.now()
  const idleTimeoutMs = Math.max(0, input.timeoutMs)
  let lastOutput = input.output()
  let lastActivityAt = start
  while (Date.now() - lastActivityAt <= idleTimeoutMs) {
    const currentOutput = input.output()
    if (currentOutput !== lastOutput) {
      lastOutput = currentOutput
      lastActivityAt = Date.now()
    }
    let persisted = false
    for (const url of extractBrowserPreviewUrlsFromText(currentOutput)) {
      const remainingMs = Math.max(1, idleTimeoutMs - (Date.now() - lastActivityAt))
      const reachable = await waitForBrowserPreviewUrlReachable(url, {
        timeoutMs: Math.min(PREVIEW_TARGET_PROBE_SLICE_MS, remainingMs),
        taskID: input.taskID,
        cwd: input.cwd,
      })
      if (!reachable) {
        candidates.set(url, {
          source: "process-output",
          url,
          reachable,
          skipReason: "process output preview URL was not reachable",
        })
        continue
      }
      const target = await persistBrowserPreviewTarget({ taskID: input.taskID, url, viewports: input.viewports })
      candidates.set(url, {
        source: "process-output",
        url,
        reachable,
        persistedTargetID: target.id,
      })
      persisted = true
    }
    if (persisted) break
    const remainingMs = idleTimeoutMs - (Date.now() - lastActivityAt)
    if (remainingMs <= 0) break
    await new Promise((resolve) => setTimeout(resolve, Math.min(PREVIEW_TARGET_DISCOVERY_INTERVAL_MS, remainingMs)))
  }
  return [...candidates.values()]
}
