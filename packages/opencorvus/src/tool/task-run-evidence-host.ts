import { createHash } from "node:crypto"
import z from "zod"
import {
  TaskRunEvidenceBundleSchema,
  TaskRunEvidenceCollectInputSchema,
  canonicalTaskRunEvidenceJSON,
  type TaskRunEvidenceBundle,
  type TaskRunEvidenceCollectInput,
} from "@opencorvus-ai/plugin"
import { asc, Database, eq, inArray } from "@/storage/db"
import { EngineArtifactVersionTable, EngineTaskTable } from "@/engine/engine.sql"
import { deriveTaskStatus } from "@/engine/task-status"
import { Event } from "@/engine/model"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"
import { terminalLifecycleReferenceMatchesTaskRow } from "@/engine/terminal-lifecycle-reference"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import { withTaskArtifactSnapshotCatalog } from "@/task-artifact/store"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { TaskPackageRevisionBindingPayloadSchema } from "@/engine/task-package-revision-binding"
import { SelectedWorkflowBindingSchema } from "@/engine/workflow-binding"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { readTaskDurableActivityScope } from "@/engine/durable-activity"
import { TaskProcessBindingPayloadSchema } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import { EngineGit } from "@/engine/git"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { executionCapsuleSourceTreeDigest } from "@/execution-capsule/tree-digest"

function digest(value: unknown) {
  const canonical = canonicalTaskRunEvidenceJSON(value)
  return {
    sha256: createHash("sha256").update(canonical).digest("hex"),
    bytes: Buffer.byteLength(canonical),
  }
}

function messageInfo(value: unknown, messageID: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Message ${messageID} has invalid canonical info`)
  }
  const info = value as Record<string, unknown>
  if (typeof info.role !== "string" || info.role.length === 0) {
    throw new Error(`Message ${messageID} has no canonical role`)
  }
  return info
}

function checkpointFact(taskID: string, checkpointInput: unknown, stage: "baseline" | "result") {
  const checkpoint = z.record(z.string(), z.unknown()).parse(checkpointInput)
  const repositories = z.array(z.record(z.string(), z.unknown())).parse(checkpoint.repositories).flatMap((record) => {
    if (!record.authority) return []
    return [{
      path: record.path,
      depth: record.depth,
      commit: record.commit,
      tree: record.tree,
      authority: record.authority,
    }]
  })
  const root = repositories.find((repository) => repository.path === ".")
  if (!root) throw new Error(`Task ${taskID} ${stage} checkpoint has no initialized root repository`)
  return { commit: root.commit, tree: root.tree, repositories }
}

export async function collectTaskRunEvidence(input: {
  projectID: string
  request: TaskRunEvidenceCollectInput
}): Promise<TaskRunEvidenceBundle> {
  const request = TaskRunEvidenceCollectInputSchema.parse(input.request)
  const durableTask = requireTask(request.taskID)
  if (durableTask.project_id !== input.projectID) {
    throw new Error(`Task ${request.taskID} is not owned by Project ${input.projectID}`)
  }
  if (!durableTask.session_id) throw new Error(`Task ${request.taskID} has no root Session identity`)
  const taskProjectDirectory = taskPrimaryProjectRoot(request.taskID, { activeProjectID: input.projectID })
  const gitMetadata = z.record(z.string(), z.unknown()).parse(
    z.record(z.string(), z.unknown()).parse(durableTask.metadata).git,
  )
  const baselineMetadata = z.record(z.string(), z.unknown()).parse(gitMetadata.baseline)
  const terminalOccurrence = request.terminalOccurrence.status === "completed" ||
    request.terminalOccurrence.status === "failed" || request.terminalOccurrence.status === "cancelled"
  const liveObservationTime = request.terminalOccurrence.status === "inactive"
    ? request.terminalOccurrence.last_activity.time_updated
    : request.terminalOccurrence.status === "awaiting_interaction"
      ? request.terminalOccurrence.time_created
      : undefined
  const evidenceCheckpoint = terminalOccurrence
    ? { kind: "terminal_git" as const, ...checkpointFact(
        durableTask.id,
        EngineGit.terminalEvidenceCheckpoint(durableTask),
        "result",
      ) }
    : {
        kind: "live_observation" as const,
        tree_sha256: await executionCapsuleSourceTreeDigest(taskProjectDirectory),
        time_observed: liveObservationTime!,
      }
  return withTaskArtifactSnapshotCatalog(
    { projectID: input.projectID, projectDirectory: taskProjectDirectory, taskID: request.taskID },
    (taskArtifactRecords) =>
      Database.transaction((db) => {
        const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, request.taskID)).get()
        if (!task || task.project_id !== input.projectID) {
          throw new Error(`Task ${request.taskID} is not owned by Project ${input.projectID}`)
        }
        const status = deriveTaskStatus(task)
        if (!task.session_id) throw new Error(`Task ${request.taskID} has no root Session identity`)

        const durableActivity = readTaskDurableActivityScope(db, task)
        const { sessions, messages, parts, artifacts: currentArtifacts, interactions } = durableActivity
        const sessionIDs = sessions.map((session) => session.id)
        const partsByMessage = new Map<string, typeof parts>()
        for (const part of parts) {
          const current = partsByMessage.get(part.message_id) ?? []
          current.push(part)
          partsByMessage.set(part.message_id, current)
        }
        const selectedKeys = new Set(
          request.selectedMessageLocators.map((locator) => `${locator.session_id}\u0000${locator.message_id}`),
        )
        for (const locator of request.selectedMessageLocators) {
          const row = messages.find(
            (message) => message.id === locator.message_id && message.session_id === locator.session_id,
          )
          if (!row)
            throw new Error(
              `Selected Message ${locator.session_id}/${locator.message_id} is not owned by Task ${task.id}`,
            )
        }

        const historicalArtifacts = db
          .select()
          .from(EngineArtifactVersionTable)
          .where(eq(EngineArtifactVersionTable.task_id, task.id))
          .orderBy(asc(EngineArtifactVersionTable.catalog_revision), asc(EngineArtifactVersionTable.artifact_id))
          .all()
        const packageBindingArtifacts = currentArtifacts.filter(
          (artifact) => artifact.kind === "task_package_revision_binding",
        )
        if (packageBindingArtifacts.length !== 1) {
          throw new Error(`Task ${task.id} requires one exact package revision binding`)
        }
        const creationBinding = TaskPackageRevisionBindingPayloadSchema.parse(packageBindingArtifacts[0]!.payload)
        const processBindingArtifacts = currentArtifacts.filter(
          (artifact) => artifact.kind === "task_execution_capsule_binding",
        )
        if (processBindingArtifacts.length !== 1) {
          throw new Error(`Task ${task.id} requires one exact process authority binding`)
        }
        const processBindingArtifact = processBindingArtifacts[0]!
        const processBinding = TaskProcessBindingPayloadSchema.parse(processBindingArtifact.payload)
        const initialTreeSHA256 = processBinding.protocol === "task-native-process-binding-v1"
          ? processBinding.initial_tree_sha256
          : processBinding.workspace.initial_tree_sha256
        const baselineCheckpoint = checkpointFact(task.id, gitMetadata.baseline, "baseline")
        const executionBaselineTreeSHA256 = z.string().regex(/^[a-f0-9]{64}$/).parse(
          baselineMetadata.workspace_tree_sha256,
        )
        if (executionBaselineTreeSHA256 !== initialTreeSHA256) {
          throw new Error(`Task ${task.id} execution baseline differs from its immutable creation workspace`)
        }
        const workflowDigests = currentArtifacts
          .filter((artifact) => artifact.kind === "dispatch_lineage" || artifact.kind === "task_completion_decision")
          .map((artifact) => {
            const payload = z
              .object({ workflow_binding: SelectedWorkflowBindingSchema })
              .passthrough()
              .parse(artifact.payload)
            return payload.workflow_binding.package_revision.package_digest
          })
        const workflowBindingDigest = workflowDigests[0] ?? null
        if (workflowDigests.some((candidate) => candidate !== workflowBindingDigest)) {
          throw new Error(`Task ${task.id} has conflicting workflow package revision facts`)
        }
        const descriptorRuntimeDigests = db
          .select()
          .from(WorkerTurnDescriptorTable)
          .where(inArray(WorkerTurnDescriptorTable.session_id, sessionIDs))
          .orderBy(asc(WorkerTurnDescriptorTable.time_created), asc(WorkerTurnDescriptorTable.id))
          .all()
          .map(
            (descriptor) =>
              WorkerTurnDescriptor.parsePersisted({
                id: descriptor.id,
                agentIndex: descriptor.agent,
                hash: descriptor.hash,
                payload: descriptor.payload,
              }).packageRevision.packageDigest,
          )
        const taskArtifactRuntimeDigests = taskArtifactRecords.flatMap((record) => {
          const producer = record.manifest.producer
          return producer.owner_kind === "projected-scheduler" || producer.owner_kind === "projected-worker"
            ? [producer.package_revision.package_digest]
            : []
        })
        const runtimeSnapshotDigests = [...descriptorRuntimeDigests, ...taskArtifactRuntimeDigests]
        const occurrence = request.terminalOccurrence
        if (occurrence.status === "completed" || occurrence.status === "failed" || occurrence.status === "cancelled") {
          const lifecycle = TerminalLifecycleReferenceSchema.parse(occurrence.lifecycle)
          if (!terminalLifecycleReferenceMatchesTaskRow(lifecycle, task)) {
            throw new Error(`Task ${task.id} terminal lifecycle reference is not its current terminal occurrence`)
          }
          const event = db
            .select()
            .from(ProtocolEventTable)
            .where(eq(ProtocolEventTable.id, lifecycle.terminalEventID))
            .get()
          const payload = event?.payload ?? {}
          const eventType = {
            completed: Event.TaskCompleted.type,
            failed: Event.TaskFailed.type,
            cancelled: Event.TaskCancelled.type,
          }[lifecycle.terminalStatus]
          if (
            !event ||
            event.aggregate_type !== "task" ||
            event.aggregate_id !== task.id ||
            event.task_id !== task.id ||
            event.type !== eventType ||
            payload.taskID !== task.id ||
            payload.status !== lifecycle.terminalStatus ||
            payload.timeCompleted !== lifecycle.timeCompleted ||
            payload.error !== lifecycle.terminalError ||
            payload.terminalReason !== lifecycle.terminalReason
          ) {
            throw new Error(
              `Task ${task.id} terminal lifecycle reference conflicts with event ${lifecycle.terminalEventID}`,
            )
          }
        }
        if (occurrence.status === "completed") {
          const completionDecisionID = occurrence.completion_decision_artifact_id
          const decision = currentArtifacts.find(
            (artifact) => artifact.id === completionDecisionID && artifact.kind === "task_completion_decision",
          )
          if (!decision || decision.time_created !== occurrence.lifecycle.timeCompleted) {
            throw new Error(`Task ${task.id} completion decision Artifact is not exact for this terminal occurrence`)
          }
        }
        if (occurrence.status === "inactive") {
          if (status !== "active") throw new Error(`Inactive Trial outcome requires an active Task execution`)
          const latest = durableActivity.latest
          if (
            !latest ||
            latest.source !== occurrence.last_activity.source ||
            latest.id !== occurrence.last_activity.id ||
            latest.time_updated !== occurrence.last_activity.time_updated
          ) {
            throw new Error(`Task ${task.id} inactive occurrence does not reference its exact latest durable activity`)
          }
        }
        if (occurrence.status === "awaiting_interaction") {
          if (status !== "active")
            throw new Error(`Awaiting-interaction Trial outcome requires an active Task execution`)
          const interaction = interactions.find(
            (candidate) => candidate.id === occurrence.interaction_request_id && candidate.status === "pending",
          )
          if (!interaction || interaction.time_created !== occurrence.time_created) {
            throw new Error(`Task ${task.id} awaiting-interaction occurrence is not exact and pending`)
          }
        }

        const semantic = {
          schema_version: 1 as const,
          task: {
            id: task.id,
            project_id: task.project_id,
            session_id: task.session_id,
            request_sha256: createHash("sha256").update(task.request).digest("hex"),
            status,
            time_started: task.time_started,
            time_completed: task.time_completed,
            error: task.error,
          },
          revision_facts: {
            installed_resolved_digest: creationBinding.package_revision.package_digest,
            creation_expected_digest: creationBinding.creation_expected_package_digest,
            task_binding_digest: creationBinding.package_revision.package_digest,
            workflow_binding_digest: workflowBindingDigest,
            runtime_snapshot_digests: runtimeSnapshotDigests,
          },
          workspace_checkpoint: {
            initial_tree_sha256: initialTreeSHA256,
            execution_baseline_tree_sha256: executionBaselineTreeSHA256,
            process_binding_sha256: processBindingArtifact.payload_sha256,
            baseline: baselineCheckpoint,
            result: evidenceCheckpoint,
          },
          terminal_occurrence: occurrence,
          sessions: sessions.map((session) => ({
            id: session.id,
            parent_id: session.parent_id,
            kind: session.kind,
            time_created: session.time_created,
            time_updated: session.time_updated,
          })),
          messages: messages.map((message) => {
            const info = messageInfo(message.data, message.id)
            const messageParts = partsByMessage.get(message.id) ?? []
            const body = {
              info: message.data,
              parts: messageParts.map((part) => ({
                id: part.id,
                time_created: part.time_created,
                time_updated: part.time_updated,
                data: part.data,
              })),
            }
            const identity = digest(body)
            const selected = selectedKeys.has(`${message.session_id}\u0000${message.id}`)
            return {
              locator: { session_id: message.session_id, message_id: message.id },
              role: info.role as string,
              agent: typeof info.agent === "string" ? info.agent : null,
              time_created: message.time_created,
              time_updated: message.time_updated,
              canonical_sha256: identity.sha256,
              canonical_bytes: identity.bytes,
              parts: messageParts.map((part) => {
                const canonicalPart = {
                  id: part.id,
                  time_created: part.time_created,
                  time_updated: part.time_updated,
                  data: part.data,
                }
                const partIdentity = digest(canonicalPart)
                const data = part.data as Record<string, unknown>
                const type = typeof data.type === "string" ? data.type : ""
                if (!type) throw new Error(`Part ${part.id} has no canonical type`)
                const tool =
                  type === "tool" &&
                  typeof data.tool === "string" &&
                  typeof data.callID === "string" &&
                  data.state &&
                  typeof data.state === "object" &&
                  typeof (data.state as Record<string, unknown>).status === "string"
                    ? {
                        name: data.tool,
                        call_id: data.callID,
                        status: (data.state as Record<string, unknown>).status as string,
                      }
                    : undefined
                return {
                  id: part.id,
                  type,
                  time_created: part.time_created,
                  time_updated: part.time_updated,
                  canonical_sha256: partIdentity.sha256,
                  canonical_bytes: partIdentity.bytes,
                  ...(tool ? { tool } : {}),
                }
              }),
              ...(selected ? { body } : {}),
            }
          }),
          engine_artifacts: [
            ...currentArtifacts.map((artifact) => ({
              artifact_id: artifact.id,
              kind: artifact.kind,
              artifact_type: artifact.catalog_artifact_type,
              schema_version:
                artifact.payload && typeof artifact.payload.schema_version === "number"
                  ? artifact.payload.schema_version
                  : null,
              catalog_revision: artifact.catalog_revision,
              payload_sha256: artifact.payload_sha256,
              payload_bytes: artifact.payload_bytes,
              time_created: artifact.time_created,
            })),
            ...historicalArtifacts.map((artifact) => ({
              artifact_id: artifact.artifact_id,
              kind: artifact.kind,
              artifact_type: artifact.catalog_artifact_type,
              schema_version:
                artifact.payload && typeof artifact.payload.schema_version === "number"
                  ? artifact.payload.schema_version
                  : null,
              catalog_revision: artifact.catalog_revision,
              payload_sha256: artifact.payload_sha256,
              payload_bytes: artifact.payload_bytes,
              time_created: artifact.time_created,
            })),
          ].sort(
            (left, right) =>
              left.catalog_revision - right.catalog_revision || left.artifact_id.localeCompare(right.artifact_id),
          ),
          task_artifacts: taskArtifactRecords.map((record) => ({
            snapshot: record.identity,
            snapshot_kind: record.manifest.snapshot_kind,
            publication_sequence: record.manifest.publication_sequence,
            created_at_ms: record.manifest.created_at_ms,
            producer: record.manifest.producer,
            trees: Object.entries(record.manifest.trees).map(([tree, inventory]) => ({
              tree,
              files: inventory.files.map((file) => ({
                path: file.path,
                media_type: file.media_type,
                bytes: file.bytes,
                sha256: file.sha256,
              })),
            })),
          })),
        }
        return TaskRunEvidenceBundleSchema.parse({ ...semantic, canonical_sha256: digest(semantic).sha256 })
      }),
  )
}
