import { describe, expect, test } from "bun:test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import {
  assertExactTaskToolCapabilityAuthority,
  TaskToolCapabilityAuthorityError,
} from "../../src/tool/task-tool-execution-scope"

describe("Task Tool exact reveal authority", () => {
  const expected = capabilityRef({
    kind: "tool",
    source: "package",
    owner_ref: "expected-squad",
    local_ref: "publish",
  })
  const sameLocalWrongOwner = capabilityRef({
    kind: "tool",
    source: "package",
    owner_ref: "other-squad",
    local_ref: "publish",
  })

  test("rejects a same-local-ref leaf owned by another capability source", () => {
    expect(() =>
      assertExactTaskToolCapabilityAuthority({
        toolName: "publish",
        expected,
        executableRefs: [sameLocalWrongOwner],
        activeRefs: [sameLocalWrongOwner],
      }),
    ).toThrow(TaskToolCapabilityAuthorityError)
  })

  test("rejects an executable Core leaf until the current occurrence reveals its exact ref", () => {
    const core = capabilityRef({
      kind: "tool",
      source: "platform",
      owner_ref: "tool-registry",
      local_ref: "read",
    })
    expect(() =>
      assertExactTaskToolCapabilityAuthority({
        toolName: "read",
        expected: core,
        executableRefs: [core],
        activeRefs: [],
      }),
    ).toThrow(TaskToolCapabilityAuthorityError)
  })
})
