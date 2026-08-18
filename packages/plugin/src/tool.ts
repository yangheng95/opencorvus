import { z } from "zod"
import type { EngineArtifactHost } from "./artifact-catalog"
import type { TaskArtifactHost } from "./task-artifact"
import type { TaskRunEvidenceHost } from "./task-run-evidence"
import type { ExpertSquadPackageHost } from "./expert-squad-package"
import type { MetricEvaluationHost } from "./metric-evaluation"
import { withToolFiles, type ToolFiles } from "./files"

export * from "./artifact-catalog"
export * from "./task-artifact"
export * from "./project-path"
export * from "./webpage-evidence"
export * from "./task-run-evidence"
export * from "./expert-squad-package"
export * from "./metric-evaluation"
export * from "./files"
export * from "./workspace-tree"
export * from "./expert-squad-evolution"
export * from "./expert-squad-evolution-artifact"
export * from "./expert-squad-evolution-integrity"
export * from "./expert-squad-evolution-history"

export type ToolCommandRunInput = {
  executable: string
  args: string[]
  cwd: string
  env?: Record<string, string | undefined>
  inactiveTimeoutMs: number
  abort?: AbortSignal
}

export type ToolCommandRunResult = {
  startedAt: string
  finishedAt: string
  durationMs: number
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  aborted: boolean
  error: string | null
  stdout: string
  stderr: string
}

export type ToolFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type ToolHost = Readonly<{
  kind: "task"
  /** Canonical runtime directory owned by the current task. */
  managedRuntimeDirectory: string
  files: ToolFiles
  fetch: ToolFetch
  engineArtifacts: EngineArtifactHost
  taskArtifacts: TaskArtifactHost
  taskRuns: TaskRunEvidenceHost
  expertSquadPackages: ExpertSquadPackageHost
  metrics: MetricEvaluationHost
  runCommand(input: ToolCommandRunInput): Promise<ToolCommandRunResult>
}>

export type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  /**
   * Current project directory for this session.
   * Prefer this over process.cwd() when resolving relative paths.
   */
  directory: string
  /**
   * Project worktree root for this session.
   * Useful for generating stable relative paths (e.g. path.relative(worktree, absPath)).
   */
  worktree: string
  abort: AbortSignal
  /**
   * Values declared by and stored for the owning expert-squad package.
   * Secrets are available only inside the trusted package tool invocation and
   * must never be returned in tool output or metadata.
   */
  configuration: Readonly<Record<string, string | boolean>>
  host: ToolHost
  /**
   * Adds package-owned display metadata to this invocation result. Custom
   * values are exposed under the Host-owned `package_metadata` namespace, so
   * they cannot replace provenance, truncation, or lifecycle-control fields.
   */
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void
}

export function tool<Args extends z.ZodRawShape>(input: {
  description: string
  args: Args
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>
}) {
  return {
    description: input.description,
    inputSchema: z.object(input.args),
    introspect: () => ({
      description: input.description,
      inputSchema: z.toJSONSchema(z.object(input.args)),
    }),
    execute: (args: z.infer<z.ZodObject<Args>>, context: ToolContext) =>
      withToolFiles(context.host.files, () => input.execute(args, context)),
  }
}
// Packages reach zod through `tool.schema` in BOTH value positions
// (`tool.schema.object({...})`) and type positions
// (`tool.schema.infer<typeof S>`). A property assignment only satisfies
// the former, so the alias is declared as a namespace merged onto the
// function — one declaration serving both.
export namespace tool {
  export import schema = z
}

export type ToolDefinition = ReturnType<typeof tool>
