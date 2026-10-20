import { expect, test } from "bun:test"
import {
  assertNativeTaskToolBinding,
  bindNativeTaskTool,
  nativeTaskToolBindingOf,
} from "../../src/tool/native-task-tool-binding"

test("retains the exact immutable native factory owner across repeated binding", () => {
  const owner = {
    taskID: "tsk_native",
    sessionID: "ses_native",
    toolName: "get_continuous_goal",
    providerKind: "builtin" as const,
  }
  const tool = bindNativeTaskTool({ description: "Current Goal" }, owner)
  expect(bindNativeTaskTool(tool, { ...owner })).toBe(tool)
  expect(nativeTaskToolBindingOf(tool)).toEqual(owner)
  expect(Object.isFrozen(nativeTaskToolBindingOf(tool))).toBe(true)
  expect(Object.keys(tool)).toEqual(["description"])
})

test("reports the exact owner contract error for a different Task, Session or tool", () => {
  const binding = {
    taskID: "tsk_native",
    sessionID: "ses_native",
    toolName: "get_continuous_goal",
    providerKind: "builtin" as const,
  }
  for (const owner of [
    { ...binding, taskID: "tsk_other" },
    { ...binding, sessionID: "ses_other" },
    { ...binding, toolName: "read_context" },
  ]) {
    expect(() => assertNativeTaskToolBinding(binding, owner)).toThrow(
      `Native Task Tool ${owner.toolName} does not match its exact Task/Session owner`,
    )
  }
})
