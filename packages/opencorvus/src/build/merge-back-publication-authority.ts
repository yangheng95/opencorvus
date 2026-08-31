import { Session } from "@/session"
import { Message } from "@/session/message"
import {
  SessionRuntimeContractStore,
  sessionRuntimeToolOwner,
  type SessionRuntimeContract,
} from "@/session/runtime-contract"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"
import { runtimeToolOwnerIDs } from "@/session/runtime-tool-owner"
import { GitObjectIDSchema, MergeBackToolOutputSchema } from "./merge-back-tool-contract"

export type ArtifactSnapshotReadAuthority =
  | Readonly<{ kind: "merged_primary_commit"; commit: string }>
  | Readonly<{ kind: "current_task_project" }>

export function artifactSnapshotSourceForRuntimeContract(
  contract: SessionRuntimeContract | undefined,
): ArtifactSnapshotReadAuthority["kind"] {
  if (!contract) return "current_task_project"
  const runtimeOwner = sessionRuntimeToolOwner(contract)
  const stageToolIDs = (runtimeOwner ? runtimeToolOwnerIDs(runtimeOwner, "stage") : []).sort()
  if (contract.identity.identityKind === "projected-scheduler") {
    if (stageToolIDs.length > 0) {
      throw new Error("artifact_snapshot: scheduler runtime has an invalid private stage-tool surface")
    }
    return "current_task_project"
  }
  if (contract.identity.dispatchAdapterID === "build") {
    if (stageToolIDs.length === 0) return "current_task_project"
    if (stageToolIDs.length === 1 && stageToolIDs[0] === "merge_back") return "merged_primary_commit"
    throw new Error("artifact_snapshot: Build runtime has an invalid private stage-tool surface")
  }
  if (stageToolIDs.includes("merge_back")) {
    throw new Error("artifact_snapshot: merge_back is owned only by the Build dispatch adapter")
  }
  return "current_task_project"
}

function exactManagedBuildSurface(
  scope: TaskToolExecutionScope,
  contract: SessionRuntimeContract | undefined,
): boolean {
  if (
    !contract ||
    (contract.identity.identityKind !== "projected-scheduler" && contract.identity.identityKind !== "projected-worker")
  ) {
    throw new Error("artifact_snapshot: current Session has no projected Task runtime contract")
  }
  const identity = contract.identity
  if (
    identity.sessionID !== scope.sessionID ||
    identity.taskID !== scope.taskID ||
    identity.agentID !== scope.owner.agentID ||
    (identity.identityKind === "projected-scheduler") !== (scope.owner.kind === "projected-scheduler")
  ) {
    throw new Error("artifact_snapshot: runtime contract does not match the current projected Task scope")
  }
  return artifactSnapshotSourceForRuntimeContract(contract) === "merged_primary_commit"
}

function latestMergeBackOutputBeforeTool(
  scope: TaskToolExecutionScope,
  messages: readonly Message.WithParts[],
  toolName: string,
) {
  const current = messages.flatMap((message) => message.parts).find((part) => part.id === scope.toolPartID)
  if (!current || current.type !== "tool" || current.tool !== toolName || current.state.status !== "running") {
    throw new Error(`${toolName}: current persisted tool part is not the running invocation`)
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
  const latest = latestMergeBackOutputBeforeTool(input.scope, input.messages, "artifact_snapshot")
  if (latest.status !== "merged") {
    throw new Error(`artifact_snapshot: latest merge_back status is ${latest.status}, not merged`)
  }
  if (latest.primary_head !== claimed) {
    throw new Error("artifact_snapshot: source_commit does not equal the latest merge_back primary_head")
  }
  return Object.freeze({ kind: "merged_primary_commit", commit: claimed })
}

export function assertMergedPrimaryCommitToolAuthorityFromFacts(input: {
  scope: TaskToolExecutionScope
  claimedSourceCommit: string
  contract: SessionRuntimeContract | undefined
  messages: readonly Message.WithParts[]
}): void {
  const current = input.messages.flatMap((message) => message.parts).find((part) => part.id === input.scope.toolPartID)
  const toolName = current?.type === "tool" ? current.tool : "package-tool"
  if (!exactManagedBuildSurface(input.scope, input.contract)) {
    throw new Error(`${toolName}: exact merged commit publication requires a managed Build worker`)
  }
  const latest = latestMergeBackOutputBeforeTool(input.scope, input.messages, toolName)
  if (latest.status !== "merged") {
    throw new Error(`${toolName}: latest merge_back status is ${latest.status}, not merged`)
  }
  if (latest.primary_head !== input.claimedSourceCommit) {
    throw new Error(`${toolName}: source_commit does not equal the latest merge_back primary_head`)
  }
}

export async function assertMergedPrimaryCommitToolAuthority(input: {
  scope: TaskToolExecutionScope
  claimedSourceCommit: string
}): Promise<void> {
  assertMergedPrimaryCommitToolAuthorityFromFacts({
    ...input,
    contract: SessionRuntimeContractStore.get(input.scope.sessionID),
    messages: await Session.messages({ sessionID: input.scope.sessionID }),
  })
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
