import { GLOBAL_TOOL_ID_SET } from "./tool-id-catalog"

export type NativeTaskToolBinding = Readonly<{
  taskID: string
  sessionID: string
  toolName: string
  providerKind: "builtin" | "internal"
}>

const nativeTaskToolBinding = Symbol("opencorvus.native-task-tool-binding")
const internalTaskReaders = new Set(["read_task_message", "read_context"])

/** Trusted Core factories retain their origin without impersonating package Tools. */
export function bindNativeTaskTool<T extends object>(tool: T, binding: NativeTaskToolBinding): T {
  if (
    !binding.taskID.trim() ||
    !binding.sessionID.trim() ||
    !(binding.providerKind === "builtin" ? GLOBAL_TOOL_ID_SET : internalTaskReaders).has(binding.toolName)
  ) {
    throw new Error(`Native Task Tool ${binding.toolName} has an invalid Core origin`)
  }
  const previous = nativeTaskToolBindingOf(tool)
  if (previous) {
    assertNativeTaskToolBinding(previous, binding)
    if (previous.providerKind !== binding.providerKind) {
      throw new Error(`Native Task Tool ${binding.toolName} has conflicting Core origins`)
    }
    return tool
  }
  Object.defineProperty(tool, nativeTaskToolBinding, {
    value: Object.freeze({ ...binding }),
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function nativeTaskToolBindingOf(tool: object): NativeTaskToolBinding | undefined {
  return (tool as { [nativeTaskToolBinding]?: NativeTaskToolBinding })[nativeTaskToolBinding]
}

export function assertNativeTaskToolBinding(
  binding: NativeTaskToolBinding,
  owner: { taskID: string; sessionID: string; toolName: string },
): void {
  if (binding.taskID !== owner.taskID || binding.sessionID !== owner.sessionID || binding.toolName !== owner.toolName) {
    throw new Error(`Native Task Tool ${owner.toolName} does not match its exact Task/Session owner`)
  }
}

export function nativeTaskToolProviderKind(toolName: string): NativeTaskToolBinding["providerKind"] | undefined {
  if (GLOBAL_TOOL_ID_SET.has(toolName)) return "builtin"
  if (internalTaskReaders.has(toolName)) return "internal"
}
