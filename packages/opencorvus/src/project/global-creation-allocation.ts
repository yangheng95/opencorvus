import path from "node:path"
import fs from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { eq, and } from "drizzle-orm"
import { Database } from "@/storage/db"
import { Global } from "@/global"
import { CROSS_PROCESS_LOCK_RETRY, withProcessLock } from "@/util/process-lock"
import { GlobalCreationAllocationTable, ProjectTable } from "./project.sql"
import { ImplicitProject } from "./implicit-project"
import { Project } from "./project"
import { EngineChannelBindingTable, EngineTaskCreationContractTable, EngineTaskTable } from "@/engine/engine.sql"
import { SessionTable } from "@/session/session.sql"
import {
  canonicalTaskCreationContract,
  taskCreationContractFingerprint,
} from "@/engine/task-creation-contract"
import { canonicalJSONValue } from "@/util/canonical-digest"
import { globalTaskAllocationTaskRequest } from "@/engine/task-creation-request"
import {
  TaskChannelBindingGlobalCreationConflictError,
  TaskChannelBindingProjectConflictError,
} from "@/engine/task-project-error"
import {
  assertGlobalChatAcceptedSession,
  assertGlobalTaskAcceptedResolution,
} from "@/engine/global-creation-target"

export type GlobalCreationKind = "global_task" | "global_chat_start"

export const GlobalCreationAllocationConflictError = NamedError.create(
  "GlobalCreationAllocationConflictError",
  z.object({
    message: z.string(),
    kind: z.enum(["global_task", "global_chat_start"]),
    requestID: z.string(),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    actualFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
)

export const GlobalCreationAcceptedTargetUnavailableError = NamedError.create(
  "GlobalCreationAcceptedTargetUnavailableError",
  z.object({
    message: z.string(),
    kind: z.enum(["global_task", "global_chat_start"]),
    requestID: z.string(),
    projectID: z.string(),
    targetID: z.string(),
    directory: z.string(),
  }),
)

export const GlobalCreationAllocatedProjectUnavailableError = NamedError.create(
  "GlobalCreationAllocatedProjectUnavailableError",
  z.object({
    message: z.string(),
    kind: z.enum(["global_task", "global_chat_start"]),
    requestID: z.string(),
    projectID: z.string(),
    projectGeneration: z.string(),
    directory: z.string(),
  }),
)

export const GlobalCreationAcceptedTargetConflictError = NamedError.create(
  "GlobalCreationAcceptedTargetConflictError",
  z.object({
    message: z.string(),
    kind: z.enum(["global_task", "global_chat_start"]),
    requestID: z.string(),
    targetID: z.string(),
  }),
)

const PersistedRejection = z.object({
  name: z.enum([
    "TaskChannelBindingProjectConflictError",
    "TaskChannelBindingGlobalCreationConflictError",
    "GlobalCreationAcceptedTargetConflictError",
  ]),
  data: z.record(z.string(), z.unknown()),
}).strict()

function rejectionError(value: unknown): Error {
  const rejection = PersistedRejection.parse(value)
  if (rejection.name === "TaskChannelBindingProjectConflictError") {
    return new TaskChannelBindingProjectConflictError(rejection.data as never)
  }
  if (rejection.name === "GlobalCreationAcceptedTargetConflictError") {
    return new GlobalCreationAcceptedTargetConflictError(rejection.data as never)
  }
  return new TaskChannelBindingGlobalCreationConflictError(rejection.data as never)
}

function calendarSegment(value: number): string {
  return value.toString().padStart(2, "0")
}

function allocatedDirectory(now = new Date()): string {
  return path.join(
    Global.Path.data,
    "projects",
    String(now.getFullYear()),
    calendarSegment(now.getMonth() + 1),
    calendarSegment(now.getDate()),
    randomUUID(),
  )
}

export namespace GlobalCreationAllocation {
  function assertRequestContract(
    existing: typeof GlobalCreationAllocationTable.$inferSelect,
    input: { kind: GlobalCreationKind; requestID: string; requestContract: Record<string, unknown> },
  ) {
    const requestContract = canonicalTaskCreationContract(input.requestContract)
    const requestFingerprint = taskCreationContractFingerprint(requestContract)
    const existingContract = canonicalTaskCreationContract(existing.request_contract)
    const existingFingerprint = taskCreationContractFingerprint(existingContract)
    if (existing.request_fingerprint !== existingFingerprint) {
      throw new Error(
        `Global creation allocation ${existing.id} fingerprint does not match its canonical request contract`,
      )
    }
    const existingCanonical = canonicalJSONValue(existingContract, `global allocation ${existing.id}`)
    if (canonicalJSONValue(requestContract, `global allocation ${existing.id} replay`) !== existingCanonical) {
      throw new GlobalCreationAllocationConflictError({
        message: `${input.kind} request ${input.requestID} is already allocated with another immutable contract`,
        kind: input.kind,
        requestID: input.requestID,
        expectedFingerprint: existing.request_fingerprint,
        actualFingerprint: requestFingerprint,
      })
    }
    return existing
  }

  /** Read the immutable occurrence before resolving any mutable host defaults.
   * Exact replay consumes its frozen resolution; a changed request conflicts
   * here even if today's model/profile/package configuration is unavailable. */
  export function find(input: {
    kind: GlobalCreationKind
    requestID: string
    requestContract: Record<string, unknown>
  }) {
    const requestID = input.requestID.trim()
    if (!requestID) throw new Error("Global creation allocation requires a non-empty request ID")
    const existing = Database.use((db) =>
      db
        .select()
        .from(GlobalCreationAllocationTable)
        .where(
          and(
            eq(GlobalCreationAllocationTable.kind, input.kind),
            eq(GlobalCreationAllocationTable.request_id, requestID),
          ),
        )
        .get(),
    )
    return existing
      ? assertRequestContract(existing, { ...input, requestID })
      : undefined
  }

  export function reserve(input: {
    kind: GlobalCreationKind
    requestID: string
    requestContract: Record<string, unknown>
    resolutionSeed: Record<string, unknown>
    taskResolution?: Record<string, unknown>
  }) {
    const requestID = input.requestID.trim()
    if (!requestID) throw new Error("Global creation allocation requires a non-empty request ID")
    const requestContract = canonicalTaskCreationContract(input.requestContract)
    const requestFingerprint = taskCreationContractFingerprint(requestContract)
    return Database.immediateTransaction((db) => {
      const existing = db
        .select()
        .from(GlobalCreationAllocationTable)
        .where(
          and(
            eq(GlobalCreationAllocationTable.kind, input.kind),
            eq(GlobalCreationAllocationTable.request_id, requestID),
          ),
        )
        .get()
      if (existing) {
        return assertRequestContract(existing, {
          kind: input.kind,
          requestID,
          requestContract,
        })
      }
      const directory = allocatedDirectory()
      const row = {
        id: `gca_${createHash("sha256").update(`${input.kind}\0${requestID}`).digest("hex")}`,
        kind: input.kind,
        request_id: requestID,
        request_fingerprint: requestFingerprint,
        request_contract: requestContract,
        resolution_seed: input.resolutionSeed,
        task_resolution: input.taskResolution ?? null,
        materialized_project_id: null,
        materialized_project_generation: null,
        time_materialized: null,
        rejected_error: null,
        time_rejected: null,
        accepted_project_id: null,
        accepted_target_id: null,
        accepted_initial_config_overlay: null,
        time_accepted: null,
        time_project_retained: null,
        directory,
        time_created: Date.now(),
      }
      db.insert(GlobalCreationAllocationTable).values(row).run()
      return row
    })
  }

  export function acceptInTransaction(
    db: Database.TxOrDb,
    input: {
      allocationID: string
      kind: GlobalCreationKind
      projectID: string
      targetID: string
      acceptedAt: number
    },
  ): void {
    const allocation = db
      .select()
      .from(GlobalCreationAllocationTable)
      .where(eq(GlobalCreationAllocationTable.id, input.allocationID))
      .get()
    if (!allocation || allocation.kind !== input.kind) {
      throw new Error(`Global ${input.kind} allocation ${input.allocationID} does not exist`)
    }
    if (allocation.rejected_error || allocation.time_rejected !== null) {
      throw rejectionError(allocation.rejected_error)
    }
    if (
      allocation.materialized_project_id !== input.projectID ||
      !allocation.materialized_project_generation ||
      allocation.time_materialized === null
    ) {
      throw new Error(`Global creation allocation ${input.allocationID} target is not owned by its carrying Project`)
    }
    if (allocation.accepted_target_id || allocation.accepted_project_id || allocation.time_accepted !== null) {
      if (
        allocation.accepted_project_id === input.projectID &&
        allocation.accepted_target_id === input.targetID &&
        allocation.accepted_initial_config_overlay !== null
      ) {
        return
      }
      throw new Error(`Global creation allocation ${input.allocationID} is already accepted by another target`)
    }
    let initialConfigOverlay: Record<string, unknown>
    if (input.kind === "global_task") {
      const target = db
        .select({
          projectID: EngineTaskTable.project_id,
          requestID: EngineTaskTable.request_id,
          allocationID: EngineTaskTable.global_creation_allocation_id,
          contract: EngineTaskCreationContractTable.contract,
          taskMetadata: EngineTaskTable.metadata,
          rootSessionMetadata: SessionTable.metadata,
        })
        .from(EngineTaskTable)
        .innerJoin(
          EngineTaskCreationContractTable,
          eq(EngineTaskCreationContractTable.task_id, EngineTaskTable.id),
        )
        .innerJoin(SessionTable, eq(SessionTable.id, EngineTaskTable.session_id))
        .where(eq(EngineTaskTable.id, input.targetID))
        .get()
      const expectedRequest = globalTaskAllocationTaskRequest(allocation.request_contract)
      const actualRequest = target?.contract && (target.contract as Record<string, unknown>).request
      if (
        target?.projectID !== input.projectID ||
        target.requestID !== allocation.request_id ||
        canonicalJSONValue(actualRequest, `Global Task ${input.targetID} request`) !==
          canonicalJSONValue(expectedRequest, `Global allocation ${allocation.id} request`)
      ) {
        throw new Error(
          `Global Task allocation ${input.allocationID} acceptance does not match its persisted Task aggregate`,
        )
      }
      if (target.allocationID !== null && target.allocationID !== allocation.id) {
        throw new Error(`Global Task ${input.targetID} is already bound to another creation allocation`)
      }
      try {
        initialConfigOverlay = canonicalTaskCreationContract(
          (target.rootSessionMetadata as Record<string, unknown> | null)?.configOverlay ?? {},
        )
        assertGlobalTaskAcceptedResolution({
          requestContract: allocation.request_contract,
          resolutionSeed: allocation.resolution_seed,
          taskResolution: allocation.task_resolution,
          taskContract: target.contract,
          taskMetadata: target.taskMetadata,
          rootSessionMetadata: target.rootSessionMetadata,
          initialConfigOverlay,
        })
      } catch (cause) {
        throw new GlobalCreationAcceptedTargetConflictError(
          {
            message: `Global Task allocation ${input.allocationID} target ${input.targetID} has another frozen resolution`,
            kind: "global_task",
            requestID: allocation.request_id,
            targetID: input.targetID,
          },
          { cause },
        )
      }
      const channel = (allocation.request_contract as Record<string, unknown>).channel_binding
      if (channel && typeof channel === "object" && !Array.isArray(channel)) {
        const claim = channel as { platform?: unknown; channel?: unknown; thread?: unknown; payload?: unknown }
        const binding = db
          .select()
          .from(EngineChannelBindingTable)
          .where(
            and(
              eq(EngineChannelBindingTable.task_id, input.targetID),
              eq(EngineChannelBindingTable.platform, String(claim.platform)),
              eq(EngineChannelBindingTable.channel, String(claim.channel)),
              eq(EngineChannelBindingTable.thread, String(claim.thread)),
            ),
          )
          .get()
        if (!binding || canonicalJSONValue(binding.payload) !== canonicalJSONValue(claim.payload ?? {})) {
          throw new Error(`Global Task allocation ${input.allocationID} channel claim does not match its Task`)
        }
      }
      if (target.allocationID === null) {
        db.update(EngineTaskTable)
          .set({ global_creation_allocation_id: allocation.id })
          .where(eq(EngineTaskTable.id, input.targetID))
          .run()
      }
    } else {
      const target = db
        .select({
          id: SessionTable.id,
          projectID: SessionTable.project_id,
          kind: SessionTable.kind,
          metadata: SessionTable.metadata,
        })
        .from(SessionTable)
        .where(eq(SessionTable.id, input.targetID))
        .get()
      if (target?.projectID !== input.projectID) {
        throw new Error(
          `Global Chat allocation ${input.allocationID} acceptance does not match its persisted Session aggregate`,
        )
      }
      try {
        initialConfigOverlay = canonicalTaskCreationContract(
          (target.metadata as Record<string, unknown> | null)?.configOverlay ?? {},
        )
        assertGlobalChatAcceptedSession({
          requestID: allocation.request_id,
          requestFingerprint: allocation.request_fingerprint,
          requestContract: allocation.request_contract,
          resolutionSeed: allocation.resolution_seed,
          initialConfigOverlay,
          session: target,
        })
      } catch (cause) {
        throw new GlobalCreationAcceptedTargetConflictError(
          {
            message: `Global Chat allocation ${input.allocationID} target ${input.targetID} has another frozen identity`,
            kind: "global_chat_start",
            requestID: allocation.request_id,
            targetID: input.targetID,
          },
          { cause },
        )
      }
    }
    db.update(GlobalCreationAllocationTable)
      .set({
        accepted_project_id: input.projectID,
        accepted_target_id: input.targetID,
        accepted_initial_config_overlay: initialConfigOverlay,
        time_accepted: input.acceptedAt,
      })
      .where(eq(GlobalCreationAllocationTable.id, input.allocationID))
      .run()
  }

  export function acceptedTarget(allocation: {
    kind: GlobalCreationKind
    request_id: string
    directory: string
    accepted_project_id: string | null
    accepted_target_id: string | null
    time_accepted: number | null
  }) {
    if (
      allocation.accepted_project_id === null &&
      allocation.accepted_target_id === null &&
      allocation.time_accepted === null
    ) {
      return undefined
    }
    if (
      !allocation.accepted_project_id ||
      !allocation.accepted_target_id ||
      allocation.time_accepted === null
    ) {
      throw new Error(`Global creation allocation ${allocation.kind}/${allocation.request_id} has a partial acceptance`)
    }
    return {
      projectID: allocation.accepted_project_id,
      targetID: allocation.accepted_target_id,
      acceptedAt: allocation.time_accepted,
    }
  }

  export function throwIfRejected(allocation: { rejected_error: unknown; time_rejected: number | null }): void {
    if (allocation.rejected_error === null && allocation.time_rejected === null) return
    if (!allocation.rejected_error || allocation.time_rejected === null) {
      throw new Error("Global creation allocation has a partial rejection")
    }
    throw rejectionError(allocation.rejected_error)
  }

  /** Settle a post-reserve semantic race exactly once. If a peer accepted the
   * occurrence first, the caller must reread that winner instead. */
  export function reject(input: { allocationID: string; error: Error; rejectedAt?: number }): "rejected" | "accepted" {
    const serialized = PersistedRejection.parse(
      typeof (input.error as { toObject?: unknown }).toObject === "function"
        ? (input.error as Error & { toObject(): { name: string; data: Record<string, unknown> } }).toObject()
        : { name: input.error.name, data: { message: input.error.message } },
    )
    return Database.immediateTransaction((db) => {
      const allocation = db
        .select()
        .from(GlobalCreationAllocationTable)
        .where(eq(GlobalCreationAllocationTable.id, input.allocationID))
        .get()
      if (!allocation) throw new Error(`Global creation allocation ${input.allocationID} does not exist`)
      if (allocation.accepted_target_id) return "accepted"
      if (allocation.rejected_error) {
        if (
          canonicalJSONValue(allocation.rejected_error, `allocation ${allocation.id} rejection`) !==
          canonicalJSONValue(serialized, `allocation ${allocation.id} replay rejection`)
        ) {
          throw new Error(`Global creation allocation ${allocation.id} has another terminal rejection`)
        }
        return "rejected"
      }
      db.update(GlobalCreationAllocationTable)
        .set({ rejected_error: serialized, time_rejected: input.rejectedAt ?? Date.now() })
        .where(eq(GlobalCreationAllocationTable.id, input.allocationID))
        .run()
      return "rejected"
    })
  }

  export function read(allocationID: string) {
    const allocation = Database.use((db) =>
      db
        .select()
        .from(GlobalCreationAllocationTable)
        .where(eq(GlobalCreationAllocationTable.id, allocationID))
        .get(),
    )
    if (!allocation) throw new Error(`Global creation allocation ${allocationID} does not exist`)
    return allocation
  }

  /** The process/file lock serializes only physical directory publication. It
   * is not the request authority and is released before target creation. */
  export async function materializeProject(allocation: {
    id: string
    kind: GlobalCreationKind
    request_id: string
    directory: string
  }) {
    const directory = path.resolve(allocation.directory)
    const readBound = () =>
      Database.use((db) => {
        const current = db
          .select()
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.id, allocation.id))
          .get()
        if (!current) throw new Error(`Global creation allocation ${allocation.id} does not exist`)
        if (!current.materialized_project_id) return undefined
        const project = db
          .select()
          .from(ProjectTable)
          .where(eq(ProjectTable.id, current.materialized_project_id))
          .get()
        if (!project || project.generation !== current.materialized_project_generation) {
          throw new GlobalCreationAllocatedProjectUnavailableError({
            message: `Global ${allocation.kind} request ${allocation.request_id} carrying Project is no longer retained`,
            kind: allocation.kind,
            requestID: allocation.request_id,
            projectID: current.materialized_project_id,
            projectGeneration: current.materialized_project_generation!,
            directory: current.directory,
          })
        }
        return { directory: project.worktree, project: Project.fromRow(project) }
      })
    const existing = readBound()
    if (existing) {
      return existing
    }
    await fs.mkdir(path.dirname(directory), { recursive: true })
    const created = await withProcessLock(
      directory,
      { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY },
      () =>
        ImplicitProject.create({
          directory,
          commitInTransaction: (db, project) => {
            const current = db
              .select()
              .from(GlobalCreationAllocationTable)
              .where(eq(GlobalCreationAllocationTable.id, allocation.id))
              .get()
            if (!current) throw new Error(`Global creation allocation ${allocation.id} does not exist`)
            if (current.materialized_project_id) {
              if (
                current.materialized_project_id !== project.id ||
                current.materialized_project_generation !== project.generation
              ) {
                throw new Error(`Global creation allocation ${allocation.id} is bound to another Project occurrence`)
              }
              return
            }
            db.update(GlobalCreationAllocationTable)
              .set({
                materialized_project_id: project.id,
                materialized_project_generation: project.generation,
                time_materialized: Date.now(),
              })
              .where(eq(GlobalCreationAllocationTable.id, allocation.id))
              .run()
          },
        }),
    )
    const bound = readBound()
    if (!bound || bound.project.id !== created.project.id) {
      throw new Error(`Global creation allocation ${allocation.id} did not bind its carrying Project atomically`)
    }
    return created
  }
}
