import type { CapabilityRef } from "@opencorvus-ai/util/capability-ref"
import { harnessGrantedRefs, type HarnessGrantSet, type HarnessProjection } from "./harness-projection"
import { capabilityRecoveryGuidance } from "./recovery-guidance"

// Guidance describes tools; role grants and execution visibility own availability.
const guidance: Readonly<Record<string, string>> = {
  capability_search: "Discover and load specialist or extension capabilities that are not already callable.",
  read: "Read project files and exact file ranges.",
  list: "Inspect directory contents.",
  glob: "Find files by path pattern.",
  search_code: "Find definitions, callers and text in the project.",
  websearch: "Search current external sources before answering time-sensitive questions.",
  webfetch: "Read a known source URL and verify its content and date.",
  bash: "Run shell commands, application checks and existing tests.",
  edit: "Apply precise edits to existing files.",
  write: "Create or replace a file with the intended content.",
  apply_patch: "Apply a reviewable patch to project files.",
  question: "Ask the user for information or a decision needed to proceed.",
  todo: "Read or replace the current Session checklist.",
  dispatch_agent: "Dispatch a declared worker or continue its exact existing occurrence.",
  dispatch_agents: "Dispatch a declared collection of workers with its shared coordination contract.",
  manage_task: "Record Task lifecycle and Delivery Slice decisions using current evidence.",
  no_action: "Record that the current scheduler input is reconciled and end this wake.",
  scheduler_message: "Send an exact scheduler request, reply or notification.",
  mission_state: "Read or commit the Mission's authored state.",
  read_context: "Read the shared context needed for the current task.",
  read_task_message: "Read an exact Task message.",
  read_agent_message: "Read an exact worker message.",
  cancel_subagent: "Cancel the specified worker when the current decision requires it.",
  respond_agent_coordination: "Resolve a worker's exact coordination request.",
  request_orchestrator_decision: "Request a decision from the owning Task scheduler.",
  send_mailbox_message: "Send a message to an authorized peer worker.",
  wait: "Wait only for the external condition described by this role's wait tool.",
  artifact_search: "Batch Artifact searches in queries and continue next_queries.",
  artifact_read: "Batch exact Artifact references in reads and continue next_reads.",
  artifact_select: "Select previously read artifact evidence as a semantic source.",
  artifact_snapshot: "Publish an immutable snapshot of the specified project files.",
  artifact_publish: "Publish the worker's structured artifact and evidence.",
  publish_interactive_artifact: "Publish the requested interactive deliverable.",
  panel_query_task: "Inspect a Task's current persisted state.",
  panel_query_task_artifacts: "Batch terminal Task Artifact catalogs and search conditions in queries.",
  panel_read_task_artifact: "Batch required Task Artifact reads for acceptance.",
  panel_read_task_message:
    "Read a bounded exact terminal Task evidence Message batch named by its Completion Decision.",
  panel_read_task_dispatch_evidence:
    "Read a failed child Task's settled worker reports and causal Tool facts by exact Message identities.",
  panel_create_task: "Create a Task with the selected ownership and requested work.",
  panel_complete_mission: "Complete a Mission using its accepted Task evidence.",
}

export function routineToolRefs(input: {
  harness: HarnessGrantSet | HarnessProjection
  visibleToolIDs: readonly string[]
}): CapabilityRef[] {
  const visible = new Set(input.visibleToolIDs)
  return harnessGrantedRefs(input.harness, "execute").filter(
    (ref) =>
      ref.kind === "tool" &&
      ref.source === "platform" &&
      visible.has(ref.local_ref) &&
      (ref.owner_ref.startsWith("dispatch-stage:") ||
        ((ref.owner_ref === "tool-registry" || ref.owner_ref.startsWith("runtime-projection:")) &&
          ref.local_ref !== "skill" &&
          ref.local_ref !== "mission_skill")),
  )
}

export function routineToolPrompt(refs: readonly CapabilityRef[]): string {
  if (refs.length === 0) return ""
  return [
    "# Available routine capabilities",
    "The following tools are already callable for this role. Use them directly; do not search for or reveal them first. Their tool definitions provide the exact input contracts. Use capability_search only when a needed specialist or extension capability is not already callable.",
    ...refs.map(
      (ref) =>
        `- ${ref.local_ref}: ${guidance[ref.local_ref] ?? "Use this declared role tool according to its exact definition and current contract."}`,
    ),
    "# Capability and permission recovery",
    capabilityRecoveryGuidance(refs.map((ref) => ref.local_ref)),
  ].join("\n")
}
