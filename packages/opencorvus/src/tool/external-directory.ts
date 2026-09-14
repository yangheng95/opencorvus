import path from "path"
import { realpath } from "node:fs/promises"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Session } from "../session"
import { Filesystem } from "../util/filesystem"
import { readTaskProcessBinding, TASK_NATIVE_PROCESS_BINDING_PROTOCOL } from "@/engine/task-execution-capsule-binding"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

export class TaskProcessBoundaryError extends Error {
  override readonly name = "TaskProcessBoundaryError"
  readonly code = "TASK_PROCESS_BOUNDARY_VIOLATION" as const
}

export function assertResolvedTaskPathInWorkspace(input: {
  taskID: string
  candidate: string
  root: string
}) {
  if (Filesystem.contains(input.root, input.candidate)) return
  throw new TaskProcessBoundaryError(
    `Task ${input.taskID} file target ${input.candidate} is outside exact process root ${input.root}`,
  )
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

async function resolveThroughExistingAncestor(target: string): Promise<string> {
  let current = path.resolve(target)
  const missingSegments: string[] = []
  while (true) {
    try {
      return path.resolve(await realpath(current), ...missingSegments)
    } catch (error) {
      if (!isMissingPathError(error)) throw error
      const parent = path.dirname(current)
      if (parent === current) throw error
      missingSegments.unshift(path.basename(current))
      current = parent
    }
  }
}

async function projectContainsResolvedPath(target: string): Promise<boolean> {
  const [candidate, directory, worktree] = await Promise.all([
    resolveThroughExistingAncestor(target),
    realpath(Instance.directory),
    realpath(Instance.worktree),
  ])
  return Filesystem.contains(directory, candidate) || Filesystem.contains(worktree, candidate)
}

export async function assertBuildWriteDirectory(ctx: Tool.Context, target?: string) {
  if (!target) return
  let session: Awaited<ReturnType<typeof Session.get>> | undefined
  try {
    session = await Session.get(ctx.sessionID)
  } catch {
    session = undefined
  }
  if (!session || session.kind !== "build") return
  if (Filesystem.contains(session.directory, target)) return
  throw new Error(
    `build session ${ctx.sessionID} cannot write outside its assigned directory ${session.directory}: ${target}`,
  )
}

export async function assertExternalDirectory(ctx: Tool.Context, target?: string, options?: Options) {
  if (!target) return

  const executionAuthority = Tool.requireExecutionAuthority(ctx)
  const taskID = executionAuthority.kind === "task" ? executionAuthority.taskID : undefined
  const binding = taskID ? readTaskProcessBinding(taskID) : undefined
  if (binding) {
    const candidate = await resolveThroughExistingAncestor(target)
    const root = await realpath(
      binding.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL ? binding.workspace_root : binding.workspace.root,
    )
    assertResolvedTaskPathInWorkspace({ taskID: taskID!, candidate, root })
    return
  }

  if (options?.bypass) return

  if (await projectContainsResolvedPath(target)) return

}
