import { lstatSync } from "node:fs"
import { randomUUID } from "node:crypto"
import path from "node:path"
import z from "zod"
import { and, inArray, type AnyColumn } from "drizzle-orm"
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core"
import { NamedError } from "@opencorvus-ai/util/error"
import { Database, eq } from "@/storage/db"
import { AttachmentStore } from "@/storage/attachment-store"
import { AutomationProjectTargetTable, AutomationRunTable, AutomationTable } from "@/scheduler/automation.sql"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { ChannelIngressAcceptedTable } from "@/channel/channel.sql"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { EventJobFireTable, EventJobTable, EventOccurrenceTable } from "@/scheduler/event.sql"
import { MemoryChunkTable, MemoryFileTable } from "@/memory/memory.sql"
import { PermissionLedgerTable, PermissionPolicyTable } from "@/permission/permission.sql"
import { QuickNoteTable } from "@/quicknote/quicknote.sql"
import { SessionPromptOwnerTable, SessionTable } from "@/session/session.sql"
import { WorkspaceTable } from "@/workspace/workspace.sql"
import { ProjectRuntimePaths } from "./runtime-paths"
import { ProjectTable } from "./project.sql"
import { Project } from "./project"
import {
  acquireProjectMaintenanceFencesInTransaction,
  releaseProjectMaintenanceFencesInTransaction,
} from "./deletion-registry"

export namespace ProjectIdentityConvergence {
  export const ConflictError = NamedError.create(
    "ProjectIdentityConvergenceConflictError",
    z.object({
      worktree: z.string(),
      canonicalProjectID: z.string(),
      projectIDs: z.array(z.string()).min(2),
      message: z.string(),
    }),
  )

  export const Receipt = z.object({
    worktree: z.string(),
    canonicalProjectID: z.string(),
    removedProjectIDs: z.array(z.string()).min(1),
    migratedRows: z.record(z.string(), z.number().int().nonnegative()),
  })
  export type Receipt = z.infer<typeof Receipt>

  type ProjectRow = typeof ProjectTable.$inferSelect
  type ProjectReferenceTable = AnySQLiteTable & { project_id: AnyColumn }
  type MutableDomainMapping = {
    name: string
    referencedRows(db: Database.TxOrDb, projectIDs: string[]): number
    migrate(db: Database.TxOrDb, canonicalProjectID: string, projectIDs: string[]): void
  }

  function mutableDomain(name: string, table: ProjectReferenceTable): MutableDomainMapping {
    return {
      name,
      referencedRows(db, projectIDs) {
        return db.select({ projectID: table.project_id }).from(table).where(inArray(table.project_id, projectIDs)).all()
          .length
      },
      migrate(db, canonicalProjectID, projectIDs) {
        db.update(table)
          .set({ project_id: canonicalProjectID } as never)
          .where(inArray(table.project_id, projectIDs))
          .run()
      },
    }
  }

  /**
   * Every entry names one domain whose mutable Project foreign key may be
   * corrected by the explicit repair occurrence. Append-only audit facts and
   * publication outboxes are intentionally absent and handled by blockers.
   */
  const MUTABLE_DOMAIN_MAPPINGS: readonly MutableDomainMapping[] = [
    mutableDomain("engine_task", EngineTaskTable),
    mutableDomain("memory_chunk", MemoryChunkTable),
    mutableDomain("memory_file", MemoryFileTable),
    mutableDomain("permission_policy", PermissionPolicyTable),
    mutableDomain("quick_note", QuickNoteTable),
    mutableDomain("session", SessionTable),
    mutableDomain("workspace", WorkspaceTable),
  ]

  export const PROJECT_REFERENCE_CONTRACTS = [
    ...MUTABLE_DOMAIN_MAPPINGS.map((mapping) => ({ table: mapping.name, settlement: "migrate" as const })),
    { table: "bus_publication_outbox", settlement: "preserve" as const },
    { table: "channel_ingress_accepted", settlement: "preserve" as const },
    { table: "permission_ledger", settlement: "preserve" as const },
    { table: "automation", settlement: "preserve" as const },
    { table: "automation_project_target", settlement: "preserve" as const },
    { table: "event_job", settlement: "preserve" as const },
    { table: "event_occurrence", settlement: "preserve" as const },
    { table: "session_prompt_owner", settlement: "preserve" as const },
    { table: "project_maintenance_fence", settlement: "maintenance_fence" as const },
  ]

  function conflict(input: {
    worktree: string
    canonicalProjectID: string
    projectIDs: string[]
    message: string
    cause?: unknown
  }): never {
    throw new ConflictError(
      {
        worktree: input.worktree,
        canonicalProjectID: input.canonicalProjectID,
        projectIDs: [...input.projectIDs].sort(),
        message: input.message,
      },
      input.cause instanceof Error ? { cause: input.cause } : undefined,
    )
  }

  function referencedRows(db: Database.TxOrDb, table: ProjectReferenceTable, projectIDs: string[]): number {
    return db.select({ projectID: table.project_id }).from(table).where(inArray(table.project_id, projectIDs)).all()
      .length
  }

  function assertImmutableDomainFactsAbsent(input: {
    worktree: string
    canonicalProjectID: string
    projectIDs: string[]
    duplicateProjectIDs: string[]
    db: Database.TxOrDb
  }) {
    const blockers = [
      {
        domain: "immutable Channel ingress facts",
        count: referencedRows(input.db, ChannelIngressAcceptedTable, input.duplicateProjectIDs),
      },
      {
        domain: "append-only permission ledger",
        count: referencedRows(input.db, PermissionLedgerTable, input.duplicateProjectIDs),
      },
      {
        domain: "durable publication outbox",
        count: referencedRows(input.db, BusPublicationOutboxTable, input.duplicateProjectIDs),
      },
      {
        domain: "immutable Automation definitions",
        count:
          referencedRows(input.db, AutomationTable, input.duplicateProjectIDs) +
          referencedRows(input.db, AutomationProjectTargetTable, input.duplicateProjectIDs),
      },
      {
        domain: "immutable Event definitions",
        count: referencedRows(input.db, EventJobTable, input.duplicateProjectIDs),
      },
      {
        domain: "immutable Event occurrences",
        count: referencedRows(input.db, EventOccurrenceTable, input.duplicateProjectIDs),
      },
      {
        domain: "durable Session prompt ownership",
        count: referencedRows(input.db, SessionPromptOwnerTable, input.duplicateProjectIDs),
      },
    ]
    for (const blocker of blockers) {
      if (blocker.count === 0) continue
      conflict({
        ...input,
        message: `${blocker.domain} contains ${blocker.count} immutable fact(s) for duplicate Project identity`,
      })
    }

    const duplicateTasks = input.db
      .select({ id: EngineTaskTable.id, projectID: EngineTaskTable.project_id })
      .from(EngineTaskTable)
      .where(inArray(EngineTaskTable.project_id, input.duplicateProjectIDs))
      .all()
    for (const task of duplicateTasks) {
      const bindings = input.db
        .select({ id: EngineArtifactTable.id })
        .from(EngineArtifactTable)
        .where(
          and(eq(EngineArtifactTable.task_id, task.id), eq(EngineArtifactTable.kind, "task_execution_capsule_binding")),
        )
        .all()
      if (bindings.length > 0) {
        conflict({
          ...input,
          message: `Task ${task.id} has an immutable process authority binding for Project ${task.projectID}`,
        })
      }
      if (AttachmentStore.hasProjectIdentityReference(task.projectID)) continue
      const artifactRoot = ProjectRuntimePaths.taskArtifactRoot(input.worktree, task.id)
      try {
        lstatSync(artifactRoot)
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT") continue
        conflict({ ...input, message: `Task Artifact identity could not be inspected for Task ${task.id}`, cause })
      }
      conflict({
        ...input,
        message: `Task ${task.id} has immutable Artifact files for Project ${task.projectID}`,
      })
    }
  }

  function assertNoEmbeddedProjectIDReferences(input: {
    worktree: string
    canonicalProjectID: string
    projectIDs: string[]
    duplicateProjectIDs: string[]
    db: Database.TxOrDb
  }): void {
    for (const duplicateProjectID of input.duplicateProjectIDs) {
      if (AttachmentStore.hasProjectIdentityReference(duplicateProjectID)) {
        conflict({
          ...input,
          message: `Embedded attachment identity remains for duplicate Project ${duplicateProjectID}`,
        })
      }
    }
  }

  async function physicalMatches(rows: ProjectRow[], worktree: string): Promise<ProjectRow[]> {
    const matches: ProjectRow[] = []
    for (const row of rows) {
      if (await Project.sameFilesystemLocation(row.worktree, worktree)) matches.push(row)
    }
    return matches
  }

  function assertDirectoryAuthorityAvailable(input: {
    canonical: ProjectRow
    duplicates: ProjectRow[]
    otherProjects: ProjectRow[]
    worktree: string
    projectIDs: string[]
  }): string[] {
    const sandboxes = [...new Set([input.canonical, ...input.duplicates].flatMap((row) => row.sandboxes))]
    for (const directory of [input.worktree, ...sandboxes]) {
      const owner = input.otherProjects.find((row) =>
        [row.worktree, ...row.sandboxes].some((candidate) => Project.samePath(candidate, directory)),
      )
      if (!owner) continue
      conflict({
        worktree: input.worktree,
        canonicalProjectID: input.canonical.id,
        projectIDs: [...input.projectIDs, owner.id],
        message: `Directory ${directory} is also owned by Project ${owner.id}`,
      })
    }
    return sandboxes
  }

  function nullableField<K extends keyof ProjectRow>(canonical: ProjectRow, duplicates: ProjectRow[], key: K) {
    return canonical[key] ?? duplicates.find((row) => row[key] !== null && row[key] !== undefined)?.[key]
  }

  export async function converge(input: { worktree: string; canonicalProjectID: string }): Promise<Receipt> {
    const worktree = path.resolve(input.worktree)
    const canonicalProjectID = input.canonicalProjectID.trim()
    if (!canonicalProjectID) {
      conflict({
        worktree,
        canonicalProjectID,
        projectIDs: ["<missing>", "<missing>"],
        message: "Canonical Project ID is required",
      })
    }

    const observedRows = Database.use((db) => db.select().from(ProjectTable).all())
    const observedMatches = await physicalMatches(observedRows, worktree)
    const observedProjectIDs = observedMatches.map((row) => row.id).sort()
    const attachmentAuthority = await AttachmentStore.observeAuthority(worktree)
    if (
      attachmentAuthority &&
      (attachmentAuthority.project_id !== canonicalProjectID ||
        attachmentAuthority.database_instance_id !== Database.Identity() ||
        !(await Project.sameFilesystemLocation(attachmentAuthority.worktree, worktree)))
    ) {
      conflict({
        worktree,
        canonicalProjectID,
        projectIDs:
          observedProjectIDs.length >= 2 ? observedProjectIDs : [canonicalProjectID, attachmentAuthority.project_id],
        message: `Attachment store authority does not belong to canonical Project ${canonicalProjectID}`,
      })
    }

    try {
      return Database.immediateTransaction((db) => {
        const all = db.select().from(ProjectTable).all()
        const matches = all.filter((row) => observedProjectIDs.includes(row.id))
        const unchanged =
          matches.length === observedMatches.length &&
          matches.every((row) =>
            observedMatches.some((observed) => observed.id === row.id && observed.generation === row.generation),
          )
        const canonical = matches.find((row) => row.id === canonicalProjectID)
        if (!unchanged || matches.length < 2 || !canonical) {
          conflict({
            worktree,
            canonicalProjectID,
            projectIDs:
              observedProjectIDs.length >= 2 ? observedProjectIDs : [canonicalProjectID, "<duplicate-required>"],
            message: `Expected one unchanged duplicate Project occurrence set for ${worktree}`,
          })
        }
        const maintenanceOperationID = randomUUID()
        acquireProjectMaintenanceFencesInTransaction(db, {
          projectRows: matches,
          operationID: maintenanceOperationID,
          kind: "identity_convergence",
        })
        const duplicates = matches.filter((row) => row.id !== canonicalProjectID)
        const duplicateProjectIDs = duplicates.map((row) => row.id)
        const sandboxes = assertDirectoryAuthorityAvailable({
          canonical,
          duplicates,
          otherProjects: all.filter((row) => !observedProjectIDs.includes(row.id)),
          worktree,
          projectIDs: observedProjectIDs,
        })
        assertImmutableDomainFactsAbsent({
          worktree,
          canonicalProjectID,
          projectIDs: observedProjectIDs,
          duplicateProjectIDs,
          db,
        })
        assertNoEmbeddedProjectIDReferences({
          worktree,
          canonicalProjectID,
          projectIDs: observedProjectIDs,
          duplicateProjectIDs,
          db,
        })

        const migratedRows: Record<string, number> = {
          bus_publication_outbox: 0,
          channel_ingress_accepted: 0,
          permission_ledger: 0,
        }
        for (const mapping of MUTABLE_DOMAIN_MAPPINGS) {
          migratedRows[mapping.name] = mapping.referencedRows(db, duplicateProjectIDs)
          mapping.migrate(db, canonicalProjectID, duplicateProjectIDs)
        }
        db.update(ProjectTable)
          .set({
            name: nullableField(canonical, duplicates, "name") as string | null,
            icon_url: nullableField(canonical, duplicates, "icon_url") as string | null,
            icon_color: nullableField(canonical, duplicates, "icon_color") as string | null,
            time_updated: Date.now(),
            time_initialized: nullableField(canonical, duplicates, "time_initialized") as number | null,
            sandboxes,
            commands: nullableField(canonical, duplicates, "commands") as { start?: string } | null,
          })
          .where(eq(ProjectTable.id, canonicalProjectID))
          .run()
        for (const duplicateProjectID of duplicateProjectIDs) {
          db.delete(ProjectTable).where(eq(ProjectTable.id, duplicateProjectID)).run()
        }
        releaseProjectMaintenanceFencesInTransaction(db, { operationID: maintenanceOperationID })
        return Receipt.parse({
          worktree,
          canonicalProjectID,
          removedProjectIDs: duplicateProjectIDs.sort(),
          migratedRows,
        })
      })
    } catch (cause) {
      if (ConflictError.isInstance(cause)) throw cause
      conflict({
        worktree,
        canonicalProjectID,
        projectIDs:
          observedProjectIDs.length >= 2 ? observedProjectIDs : [canonicalProjectID, "<transaction-conflict>"],
        message: `Project identity convergence failed atomically: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      })
    }
  }
}
