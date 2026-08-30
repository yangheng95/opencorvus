import { AgentToolPool } from "./tool-pool-contract"
import { RuntimeTemplateID, type RuntimeTemplateID as RuntimeTemplateIDValue } from "./runtime-template-id"
import type { CapabilitySetDescriptor } from "@/capability/descriptor"
import { TASK_ARTIFACT_SCHEDULER_TOOL_IDS, TASK_ARTIFACT_TOOL_IDS } from "@/tool/tool-id-catalog"
import {
  capabilityRef,
  CapabilityRefCodec,
  type CapabilityRef,
} from "@opencorvus-ai/util/capability-ref"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"

const OWNER_REF = "tool-registry"
const ORCHESTRATOR_BASE = "orchestrator-base"
const SCHEDULER_TRANSPORT = "scheduler-transport"
const WORKER_TRANSPORT = "worker-transport"

function toolRef(toolID: string): CapabilityRef {
  return capabilityRef({ kind: "tool", source: "platform", owner_ref: OWNER_REF, local_ref: toolID })
}

function setRef(localRef: string): CapabilityRef {
  return capabilityRef({ kind: "capability_set", source: "platform", owner_ref: OWNER_REF, local_ref: localRef })
}

function definition(localRef: string, name: string, description: string, toolIDs: Iterable<string>): CapabilitySetDescriptor {
  const memberRefs = [...new Set(toolIDs)].sort(compareCanonicalStrings).map(toolRef)
  Object.freeze(memberRefs)
  return Object.freeze({
    ref: setRef(localRef),
    name,
    description,
    member_refs: memberRefs,
  })
}

function runtimeBaseID(templateID: RuntimeTemplateIDValue): string {
  return `${RuntimeTemplateID.get(templateID)}-base`
}

const schedulerTransportIDs = new Set<string>([...TASK_ARTIFACT_SCHEDULER_TOOL_IDS, "publish_interactive_artifact"])
const workerTransportIDs = new Set<string>([...TASK_ARTIFACT_TOOL_IDS, "publish_interactive_artifact"])

const definitions = Object.freeze([
  definition(
    ORCHESTRATOR_BASE,
    "Orchestrator base",
    "Platform scheduler capabilities explicitly granted by an Expert Squad.",
    AgentToolPool.orchestratorSchedulerRoleBaseToolIDs().filter((toolID) => !schedulerTransportIDs.has(toolID)),
  ),
  ...RuntimeTemplateID.ids.map((templateID) =>
    definition(
      runtimeBaseID(templateID),
      `${templateID} base`,
      `Platform ${templateID} runtime-template capabilities explicitly granted by an Expert Squad.`,
      [...AgentToolPool.visibleToolIDs(AgentToolPool.runtimeTemplateAssignment(templateID))].filter(
        (toolID) => !workerTransportIDs.has(toolID),
      ),
    ),
  ),
  definition(
    SCHEDULER_TRANSPORT,
    "Scheduler transport",
    "Platform-owned Task artifact transport appended to every projected scheduler.",
    schedulerTransportIDs,
  ),
  definition(
    WORKER_TRANSPORT,
    "Worker transport",
    "Platform-owned Task artifact transport appended to every projected worker.",
    workerTransportIDs,
  ),
])

const byRef = new Map(definitions.map((set) => [CapabilityRefCodec.encode(set.ref), set]))

export namespace PlatformCapabilitySetRegistry {
  export function baseRef(input: { kind: "scheduler" } | { kind: "worker"; baseRole: RuntimeTemplateIDValue }) {
    return setRef(input.kind === "scheduler" ? ORCHESTRATOR_BASE : runtimeBaseID(input.baseRole))
  }

  export function transportRef(kind: "scheduler" | "worker") {
    return setRef(kind === "scheduler" ? SCHEDULER_TRANSPORT : WORKER_TRANSPORT)
  }

  export function all(): readonly CapabilitySetDescriptor[] {
    return definitions
  }

  export function get(ref: CapabilityRef): CapabilitySetDescriptor {
    const exact = byRef.get(CapabilityRefCodec.encode(ref))
    if (!exact) throw new Error(`Unknown platform capability set ${CapabilityRefCodec.encode(ref)}`)
    return exact
  }

  export function sourceRevision(toolIDs: readonly string[]): string {
    return canonicalDigestSource("platform-tool-capability-inventory-v2", {
      tool_ids: [...toolIDs].sort(compareCanonicalStrings),
      sets: definitions,
    }).sha256
  }
}
