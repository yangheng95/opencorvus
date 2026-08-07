import * as nativeFiles from "node:fs/promises"
import type { ToolFiles } from "@opencorvus-ai/plugin"
import { executeCapsuleFileOperation } from "@/execution-capsule/file-broker"
import {
  readTaskProcessBinding,
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
} from "@/engine/task-execution-capsule-binding"

type FileOperationTracker = <T>(operation: () => Promise<T>) => Promise<T>

function tracked<T extends (...args: any[]) => Promise<any>>(operation: T, track: FileOperationTracker): T {
  return ((...args: Parameters<T>) => track(() => operation(...args))) as T
}

/**
 * Native implementation of the package-tool filesystem capability.
 * The capability interface is the stable ToolHost boundary; the Capsule
 * executor can replace this implementation without changing package code.
 */
export function createPluginToolFilesHost(
  track: FileOperationTracker,
  scope: { taskID: string },
): ToolFiles {
  const capsuleOperation = async (operation: keyof ToolFiles, args: unknown[]) => {
    const binding = readTaskProcessBinding(scope.taskID)
    if (binding.protocol !== TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL) {
      throw new Error(`Task ${scope.taskID} package-tool filesystem does not have a Capsule binding`)
    }
    return executeCapsuleFileOperation({
      taskID: scope.taskID,
      cwd: binding.workspace.root,
      operation,
      args,
    })
  }
  const operations = [
    "access",
    "copyFile",
    "cp",
    "lstat",
    "mkdir",
    "mkdtemp",
    "readFile",
    "readdir",
    "realpath",
    "rename",
    "rm",
    "stat",
    "writeFile",
  ] as const
  const host = Object.fromEntries(
    operations.map((operation) => [
      operation,
      (...args: unknown[]) =>
        track(() => {
          const binding = readTaskProcessBinding(scope.taskID)
          return binding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL
            ? capsuleOperation(operation, args)
            : (nativeFiles[operation] as (...nativeArgs: unknown[]) => Promise<unknown>)(...args)
        }),
    ]),
  )
  return Object.freeze(host) as ToolFiles
}
