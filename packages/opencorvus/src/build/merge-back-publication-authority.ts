import { Session } from "@/session"
import { Message } from "@/session/message"
import {
  SessionRuntimeContractStore,
  sessionRuntimeToolRecords,
  type SessionRuntimeContract,
} from "@/session/runtime-contract"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"
import { GitObjectIDSchema, MergeBackToolOutputSchema } from "./merge-back-tool-contract"

export type ArtifactSnapshotReadAuthority =
  | Readonly<{ kind: "merged_primary_commit"; commit: string }>
  | Readonly<{ kind: "current_task_project" }>

function exactManagedBuildSurface(scope: TaskToolExecutionScope, contract: SessionRuntimeContract | undefined): boolean {
  if (!contract || contract.identity.identityKind !== "projected-worker") {
    throw new Error("artifact_snapshot: current Session has no projected-worker runtime contract")
  }
  if (
    contract.identity.sessionID !== scope.sessionID ||
    contract.identity.taskID !== scope.taskID ||
    contract.identity.agentID !== scope.owner.agentID
  ) {
    throw new Error("artifact_snapshot: runtime contract does not match the current Task worker scope")
  }
  const stageToolIDs = Object.keys(sessionRuntimeToolRecords(contract).stageTools).sort()
  if (contract.identity.dispatchAdapterID === "build") {
    if (stageToolIDs.length === 0) return false
    if (stageToolIDs.length === 1 && stageToolIDs[0] === "merge_back") return true
    throw new Error("artifact_snapshot: Build runtime has an invalid private stage-tool surface")
  }
  if (stageToolIDs.includes("merge_back")) {
    throw new Error("artifact_snapshot: merge_back is owned only by the Build dispatch adapter")
  }
  return false
}

function latestMergeBackOutputBeforeSnapshot(
  scope: TaskToolExecutionScope,
  messages: readonly Message.WithParts[],
) {
  const current = messages
    .flatMap((message) => message.parts)
    .find((part) => part.id === scope.toolPartID)
  if (!current || current.type !== "tool" || current.tool !== "artifact_snapshot" || current.state.status !== "running") {
    throw new Error("artifact_snapshot: current persisted tool part is not the running snapshot invocation")
  }
  const candidates = messages
    .flatMap((message) => message.parts)
    .filter(
      (part) =>
        part.type === "tool" &&
        part.tool === "merge_back" &&
        part.state.status === "completed" &&
        part.state.time.end <= current.state.time.start,
    )
    .sort((left, right) => {
      if (left.type !== "tool" || right.type !== "tool") return 0
      if (left.state.status !== "completed" || right.state.status !== "completed") return 0
      return right.state.time.end - left.state.time.end || right.id.localeCompare(left.id)
    })
  const latest = candidates[0]
  if (!latest || latest.type !== "tool" || latest.state.status !== "completed") {
    throw new Error("artifact_snapshot: managed Build has no completed merge_back before this snapshot")
  }
  let decoded: unknown
  try {
    decoded = JSON.parse(latest.state.output)
  } catch (cause) {
    throw new Error("artifact_snapshot: latest merge_back output is not valid JSON", { cause })
  }
  return MergeBackToolOutputSchema.parse(decoded)
}

export function resolveArtifactSnapshotReadAuthorityFromFacts(input: {
  scope: TaskToolExecutionScope
  claimedSourceCommit?: string
  contract: SessionRuntimeContract | undefined
  messages: readonly Message.WithParts[]
}): ArtifactSnapshotReadAuthority {
  const managedBuild = exactManagedBuildSurface(input.scope, input.contract)
  if (!managedBuild) {
    if (input.claimedSourceCommit !== undefined) {
      throw new Error("artifact_snapshot: source_commit is reserved for a managed Build merge_back result")
    }
    return Object.freeze({ kind: "current_task_project" })
  }
  const claimed = GitObjectIDSchema.parse(input.claimedSourceCommit)
  const latest = latestMergeBackOutputBeforeSnapshot(input.scope, input.messages)
  if (latest.status !== "merged") {
    throw new Error(`artifact_snapshot: latest merge_back status is ${latest.status}, not merged`)
  }
  if (latest.primary_head !== claimed) {
    throw new Error("artifact_snapshot: source_commit does not equal the latest merge_back primary_head")
  }
  return Object.freeze({ kind: "merged_primary_commit", commit: claimed })
}

export async function resolveArtifactSnapshotReadAuthority(input: {
  scope: TaskToolExecutionScope
  claimedSourceCommit?: string
}): Promise<ArtifactSnapshotReadAuthority> {
  return resolveArtifactSnapshotReadAuthorityFromFacts({
    ...input,
    contract: SessionRuntimeContractStore.get(input.scope.sessionID),
    messages: await Session.messages({ sessionID: input.scope.sessionID }),
  })
}
