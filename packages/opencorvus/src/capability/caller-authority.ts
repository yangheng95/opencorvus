import type { CapabilityCaller } from "./descriptor"
import type { SessionKind } from "@/session/session.sql"

export type CapabilityRuntimeIdentityKind = "projected-scheduler" | "projected-worker"

/** One pure authority rule shared by Catalog composition and bound-view verification. */
export function resolveCapabilityCaller(input: {
  sessionKind: SessionKind
  agentID: string
  runtimeIdentityKind?: CapabilityRuntimeIdentityKind
}): CapabilityCaller {
  if (input.runtimeIdentityKind === "projected-scheduler") return "task_scheduler"
  if (input.runtimeIdentityKind === "projected-worker") return "task_agent"
  if (input.sessionKind === "mission" && input.agentID === "mission") return "mission"
  return "conversation"
}
