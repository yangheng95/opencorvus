import { describe, expect, test } from "bun:test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { PlatformCapabilitySetRegistry } from "../../src/agent/platform-capability-sets"
import { RuntimeTemplateID } from "../../src/agent/runtime-template-id"
import { bindHarnessProjection, createHarnessGrantSet } from "../../src/capability/harness-projection"
import { routineToolRefs } from "../../src/capability/routine-tools"
import { SessionLoop } from "../../src/session/loop"
import { AgentToolPool } from "../../src/agent/tool-pool-contract"

describe("Task role routine authority", () => {
  for (const role of ["coding", "chat", "work", "control", "mission"] as const) {
    test(`${role} directly projects its granted built-in tools on every occurrence`, () => {
      const ids = [...AgentToolPool.visibleToolIDs(AgentToolPool.assignment(role))]
      const grants = createHarnessGrantSet({
        context: role === "mission" ? { kind: "mission" } : { kind: "conversation", agent_id: role },
        owner_revision: "native-role",
        grants: ids.map((local_ref) => ({
          ref: capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref }),
          access: "execute",
        })),
      })
      const expected = ids.filter((id) => !["skill", "mission_skill"].includes(id)).sort()
      for (const harness of [
        grants,
        bindHarnessProjection(grants, {
          snapshot_ref: "/attachment/native-catalog.json",
          snapshot_hash: "a".repeat(64),
        }),
      ]) {
        const actual = SessionLoop.occurrencePermanentToolRefs({
          harness,
          visibleToolIDs: ids,
          explicitSkillNames: [],
          productionSkillContext: role !== "mission",
        })
        expect(actual.map((ref) => ref.local_ref).sort()).toEqual(expected)
      }
      const restricted = SessionLoop.occurrencePermanentToolRefs({
        harness: grants,
        visibleToolIDs: ["capability_search"],
        explicitSkillNames: [],
        productionSkillContext: false,
      })
      expect(restricted.map((ref) => ref.local_ref)).toEqual(["capability_search"])
    })
  }

  for (const role of RuntimeTemplateID.ids) {
    test(`${role} keeps its authorized platform base on a new and bound occurrence`, () => {
      const refs = PlatformCapabilitySetRegistry.get(
        PlatformCapabilitySetRegistry.baseRef({ kind: "worker", baseRole: role }),
      ).member_refs
      const grants = createHarnessGrantSet({
        context: { kind: "task_agent", task_id: "task", profile_id: "squad", agent_id: role },
        owner_revision: "revision",
        grants: refs.map((ref) => ({ ref, access: "discover_execute" })),
      })
      const expected = refs
        .filter((ref) => !["skill", "mission_skill"].includes(ref.local_ref))
        .map((ref) => ref.local_ref)
        .sort()
      for (const harness of [
        grants,
        bindHarnessProjection(grants, {
          snapshot_ref: "/attachment/catalog.json",
          snapshot_hash: "a".repeat(64),
        }),
      ]) {
        const actual = SessionLoop.occurrencePermanentToolRefs({
          harness,
          visibleToolIDs: refs.map((ref) => ref.local_ref),
          explicitSkillNames: [],
          productionSkillContext: true,
        })
        expect(actual.map((ref) => ref.local_ref).sort()).toEqual(expected)
      }
    })
  }

  test("retains exact managed Build and projected role owners through grant and visibility intersection", () => {
    const ref = (owner_ref: string, local_ref: string) =>
      capabilityRef({ kind: "tool", source: "platform", owner_ref, local_ref })
    const merge = ref("dispatch-stage:build", "merge_back")
    const research = ref("runtime-projection:researcher", "websearch")
    const read = ref("tool-registry", "read")
    const grants = createHarnessGrantSet({
      context: { kind: "task_agent", task_id: "task", profile_id: "squad", agent_id: "researcher" },
      owner_revision: "revision",
      grants: [
        { ref: merge, access: "discover_execute" },
        { ref: research, access: "discover_execute" },
        { ref: read, access: "discover" },
        { ref: ref("tool-registry", "bash"), access: "execute" },
      ],
    })
    expect(routineToolRefs({ harness: grants, visibleToolIDs: ["merge_back", "websearch", "read", "write"] })).toEqual([
      merge,
      research,
    ])
  })
})
