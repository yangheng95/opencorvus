import { describe, expect, test } from "bun:test"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { memoryProject } from "./fixture/memory"
import { Database, eq } from "../src/storage/db"
import { ApplicationSchema } from "../src/storage/schema"
import { ProjectTable } from "../src/project/project.sql"
import { QuickNoteTable } from "../src/quicknote/quicknote.sql"
import { ChannelIngressAcceptedTable } from "../src/channel/channel.sql"
import { Project } from "../src/project/project"
import { ProjectIdentityConvergence } from "../src/project/identity-convergence"
import { namedErrorStatus } from "../src/server/error-handler"
import { PermissionLedgerTable } from "../src/permission/permission.sql"
import { BusPublicationOutboxTable } from "../src/bus/bus.sql"
import fs from "node:fs/promises"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { EngineArtifactTable } from "../src/engine/engine.sql"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { insertTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { SessionPromptOwnerTable, SessionTable } from "../src/session/session.sql"
import { currentRuntimeProcessOccurrence } from "../src/runtime/process-occurrence"
import { WorkspaceLifecycleAdmissionTable } from "../src/workspace/workspace.sql"

function insertProject(input: {
  id: string
  worktree: string
  name?: string
  sandboxes?: string[]
  commands?: { start?: string }
}) {
  const now = Date.now()
  Database.use((db) =>
    db
      .insert(ProjectTable)
      .values({
        id: input.id,
        generation: crypto.randomUUID(),
        worktree: input.worktree,
        name: input.name,
        sandboxes: input.sandboxes ?? [],
        commands: input.commands,
        time_created: now,
        time_updated: now,
      })
      .run(),
  )
}

function identityRows(projectIDs: string[]) {
  return Database.use((db) => ({
    projects: db
      .select()
      .from(ProjectTable)
      .all()
      .filter((row) => projectIDs.includes(row.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    notes: db
      .select()
      .from(QuickNoteTable)
      .all()
      .filter((row) => row.project_id !== null && projectIDs.includes(row.project_id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    acceptedChannelInputs: db
      .select()
      .from(ChannelIngressAcceptedTable)
      .all()
      .filter((row) => projectIDs.includes(row.project_id))
      .sort((left, right) => left.project_id.localeCompare(right.project_id)),
  }))
}

async function convergeProjectIdentity(input: { worktree: string; canonicalProjectID: string }) {
  return ProjectIdentityConvergence.converge(input)
}

describe("explicit Project identity convergence", () => {
  test("lookup reports duplicate identity without mutation, then explicit repair converges owned references", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    const canonicalSandbox = `${fixture.path}-canonical-sandbox`
    const duplicateSandbox = `${fixture.path}-duplicate-sandbox`
    insertProject({
      id: canonicalProjectID,
      worktree: fixture.path,
      sandboxes: [canonicalSandbox],
      commands: { start: "bun dev" },
    })
    insertProject({
      id: duplicateProjectID,
      worktree: fixture.path,
      name: "Recovered project name",
      sandboxes: [duplicateSandbox],
    })
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(QuickNoteTable)
        .values({
          id: `note_${crypto.randomUUID()}`,
          project_id: duplicateProjectID,
          content: "project identity repair fact",
          summary: "repair fact",
          time_created: now,
          time_updated: now,
        })
        .run(),
    )

    const before = identityRows([canonicalProjectID, duplicateProjectID])
    const lookupError = await Project.fromDirectory(fixture.path).catch((cause) => cause)
    expect({
      name: lookupError instanceof Error ? lookupError.name : undefined,
      data: Project.DuplicateWorktreeIdentityError.isInstance(lookupError) ? lookupError.data : undefined,
      status: lookupError instanceof Error ? namedErrorStatus(lookupError) : undefined,
      rows: identityRows([canonicalProjectID, duplicateProjectID]),
    }).toEqual({
      name: "ProjectDuplicateWorktreeIdentityError",
      data: {
        worktree: fixture.path,
        projectIDs: [canonicalProjectID, duplicateProjectID].sort(),
        message: `Worktree ${fixture.path} belongs to multiple Projects: ${[canonicalProjectID, duplicateProjectID].sort().join(", ")}`,
      },
      status: 409,
      rows: before,
    })

    const receipt = await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    const repaired = Project.get(canonicalProjectID)
    const resolved = await Project.fromDirectory(fixture.path)
    expect({
      receipt,
      repaired: repaired && {
        id: repaired.id,
        name: repaired.name,
        sandboxes: repaired.sandboxes.sort(),
        commands: repaired.commands,
      },
      duplicate: Project.get(duplicateProjectID),
      notes: Database.use((db) =>
        db
          .select({
            project_id: QuickNoteTable.project_id,
            content: QuickNoteTable.content,
          })
          .from(QuickNoteTable)
          .where(eq(QuickNoteTable.project_id, canonicalProjectID))
          .all(),
      ),
      resolvedProjectID: resolved.project.id,
    }).toEqual({
      receipt: {
        worktree: fixture.path,
        canonicalProjectID,
        removedProjectIDs: [duplicateProjectID],
        migratedRows: {
          bus_publication_outbox: 0,
          channel_ingress_accepted: 0,
          engine_task: 0,
          memory_chunk: 0,
          memory_file: 0,
          permission_ledger: 0,
          permission_policy: 0,
          quick_note: 1,
          session: 0,
          workspace: 0,
        },
      },
      repaired: {
        id: canonicalProjectID,
        name: "Recovered project name",
        sandboxes: [canonicalSandbox, duplicateSandbox].sort(),
        commands: { start: "bun dev" },
      },
      duplicate: undefined,
      notes: [
        {
          project_id: canonicalProjectID,
          content: "project identity repair fact",
        },
      ],
      resolvedProjectID: canonicalProjectID,
    })
  }, 90_000)

  test("a compound identity collision returns a typed conflict and rolls back every migrated row", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const now = Date.now()
    Database.use((db) => {
      for (const projectID of [canonicalProjectID, duplicateProjectID]) {
        db.insert(ChannelIngressAcceptedTable)
          .values({
            id: Identifier.deterministic("call", `channel-ingress\0${projectID}\0matrix\0same-request`),
            project_id: projectID,
            platform: "matrix",
            request_id: "same-request",
            input: {
              channel: "room",
              thread: "thread",
              text: `project identity ${projectID}`,
              allow_create: false,
              allow_session_mutation: false,
              bind: true,
              attachments: [],
            },
            time_created: now,
          })
          .run()
      }
    })
    const before = identityRows([canonicalProjectID, duplicateProjectID])
    let conflict: unknown
    try {
      await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    } catch (cause) {
      conflict = cause
    }
    expect({
      name: conflict instanceof Error ? conflict.name : undefined,
      canonicalProjectID: ProjectIdentityConvergence.ConflictError.isInstance(conflict)
        ? conflict.data.canonicalProjectID
        : undefined,
      rows: identityRows([canonicalProjectID, duplicateProjectID]),
    }).toEqual({
      name: "ProjectIdentityConvergenceConflictError",
      canonicalProjectID,
      rows: before,
    })
  })

  test("an admitted Workspace creation preserves its exact duplicate Project occurrence", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const duplicate = Database.use((db) =>
      db.select().from(ProjectTable).where(eq(ProjectTable.id, duplicateProjectID)).get(),
    )
    if (!duplicate) throw new Error("Duplicate Project fixture was not inserted")
    const owner = currentRuntimeProcessOccurrence()
    const occurrenceID = crypto.randomUUID()
    Database.use((db) =>
      db
        .insert(WorkspaceLifecycleAdmissionTable)
        .values({
          occurrence_id: occurrenceID,
          project_id: duplicateProjectID,
          project_generation: duplicate.generation,
          workspace_id: Identifier.ascending("workspace"),
          lifecycle: "creating",
          authority: "public",
          owner_occurrence_id: owner.occurrenceID,
          owner_pid: owner.pid,
          owner_process_instance_id: owner.processInstanceID,
          time_created: Date.now(),
        })
        .run(),
    )

    const conflict = await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID }).catch(
      (cause) => cause,
    )
    expect({
      name: conflict instanceof Error ? conflict.name : undefined,
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      projects: Database.use((db) =>
        db
          .select({ id: ProjectTable.id })
          .from(ProjectTable)
          .all()
          .filter((row) => row.id === canonicalProjectID || row.id === duplicateProjectID)
          .map((row) => row.id)
          .sort(),
      ),
      admission: Database.use((db) =>
        db
          .select({ occurrenceID: WorkspaceLifecycleAdmissionTable.occurrence_id })
          .from(WorkspaceLifecycleAdmissionTable)
          .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, occurrenceID))
          .get(),
      ),
    }).toEqual({
      name: "ProjectIdentityConvergenceConflictError",
      message: `Workspace creation admission ${occurrenceID} blocks Project identity convergence`,
      projects: [canonicalProjectID, duplicateProjectID].sort(),
      admission: { occurrenceID },
    })
  })

  test("physical aliases resolve to the same duplicate worktree occurrence before marker writes", async () => {
    await using fixture = await memoryProject()
    const alias = `${fixture.path}-alias`
    await fs.symlink(fixture.path, alias, process.platform === "win32" ? "junction" : "dir")
    try {
      const canonicalProjectID = `project_${crypto.randomUUID()}`
      const duplicateProjectID = `project_${crypto.randomUUID()}`
      insertProject({ id: canonicalProjectID, worktree: fixture.path })
      insertProject({ id: duplicateProjectID, worktree: alias })

      const conflict = await Project.fromDirectory(fixture.path).catch((cause) => cause)
      expect({
        name: conflict instanceof Error ? conflict.name : undefined,
        projectIDs: Project.DuplicateWorktreeIdentityError.isInstance(conflict) ? conflict.data.projectIDs : undefined,
      }).toEqual({
        name: "ProjectDuplicateWorktreeIdentityError",
        projectIDs: [canonicalProjectID, duplicateProjectID].sort(),
      })
    } finally {
      await fs.rm(alias, { recursive: true, force: true })
    }
  })

  test("a registered sandbox cannot bypass duplicate primary-worktree detection", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    const sandbox = `${fixture.path}-registered-sandbox`
    await fs.mkdir(sandbox)
    try {
      insertProject({ id: canonicalProjectID, worktree: fixture.path, sandboxes: [sandbox] })
      insertProject({ id: duplicateProjectID, worktree: fixture.path })
      const conflict = await Project.fromDirectory(sandbox).catch((cause) => cause)
      expect({
        name: conflict instanceof Error ? conflict.name : undefined,
        projectIDs: Project.DuplicateWorktreeIdentityError.isInstance(conflict) ? conflict.data.projectIDs : undefined,
      }).toEqual({
        name: "ProjectDuplicateWorktreeIdentityError",
        projectIDs: [canonicalProjectID, duplicateProjectID].sort(),
      })
    } finally {
      await fs.rm(sandbox, { recursive: true, force: true })
    }
  })

  test("explicit convergence commits the canonical Project transaction", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const receipt = await ProjectIdentityConvergence.converge({ worktree: fixture.path, canonicalProjectID })
    expect(receipt).toMatchObject({ canonicalProjectID, removedProjectIDs: [duplicateProjectID] })
  })

  test("an immutable Task process binding preserves the duplicate Project occurrence", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    const taskID = Identifier.ascending("task")
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const now = Date.now()
    Database.use((db) => {
      db.insert(EngineTaskTable)
        .values({
          id: taskID,
          project_id: duplicateProjectID,
          product_pillar: "code",
          title: "immutable process authority",
          request: "preserve binding",
          time_started: now,
          time_created: now,
          time_updated: now,
        })
        .run()
      insertTaskProcessBinding({
        db,
        payload: {
          protocol: "task-native-process-binding-v1",
          task_id: taskID,
          project_id: duplicateProjectID,
          package_revision_sha256: "b".repeat(64),
          mode: "native",
          workspace_root: fixture.path,
          initial_tree_sha256: "c".repeat(64),
          time_created: now,
        },
      })
    })
    let conflict: unknown
    try {
      await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    } catch (cause) {
      conflict = cause
    }
    expect({
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      task: Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()),
    }).toEqual({
      message: `Task ${taskID} has an immutable process authority binding for Project ${duplicateProjectID}`,
      task: expect.objectContaining({ project_id: duplicateProjectID }),
    })
  })

  test("an attachment-store authority owned by the duplicate Project is preserved", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const attachmentRoot = ProjectRuntimePaths.attachmentBlobRoot(fixture.path)
    const authority = {
      schema_version: 1,
      project_id: duplicateProjectID,
      worktree: fixture.path,
      database_instance_id: Database.Identity(),
    }
    await fs.mkdir(attachmentRoot, { recursive: true })
    await fs.writeFile(`${attachmentRoot}/.authority.json`, JSON.stringify(authority, null, 2))
    let conflict: unknown
    try {
      await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    } catch (cause) {
      conflict = cause
    }
    expect({
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      authority: JSON.parse(await fs.readFile(`${attachmentRoot}/.authority.json`, "utf8")),
    }).toEqual({
      message: `Attachment store authority does not belong to canonical Project ${canonicalProjectID}`,
      authority,
    })
  })

  test("an embedded attachment identity is reported as a typed preservation conflict", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(EngineTaskTable)
        .values({
          id: `task_${crypto.randomUUID()}`,
          project_id: duplicateProjectID,
          product_pillar: "code",
          title: "embedded attachment identity",
          request: "preserve exact attachment owner",
          attachments: [
            {
              sha: "a".repeat(64),
              url: `/attachment/${duplicateProjectID}/${"a".repeat(64)}.png`,
              mime: "image/png",
              size: 1,
              intent: "task_input",
              source: "user-upload",
            },
          ],
          time_started: now,
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    const before = identityRows([canonicalProjectID, duplicateProjectID])

    let conflict: unknown
    try {
      await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    } catch (cause) {
      conflict = cause
    }
    expect({
      name: conflict instanceof Error ? conflict.name : undefined,
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      task: Database.use((db) =>
        db.select().from(EngineTaskTable).where(eq(EngineTaskTable.project_id, duplicateProjectID)).get(),
      ),
    }).toEqual({
      name: "ProjectIdentityConvergenceConflictError",
      message: `Embedded attachment identity remains for duplicate Project ${duplicateProjectID}`,
      task: expect.objectContaining({ project_id: duplicateProjectID }),
    })
  })

  test("append-only permission evidence is preserved as an explicit repair conflict", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const ledgerID = `permission_${crypto.randomUUID()}`
    Database.use((db) =>
      db
        .insert(PermissionLedgerTable)
        .values({
          id: ledgerID,
          request_id: `request_${crypto.randomUUID()}`,
          project_id: duplicateProjectID,
          session_id: `session_${crypto.randomUUID()}`,
          message_id: `message_${crypto.randomUUID()}`,
          tool_call_id: `tool_${crypto.randomUUID()}`,
          event_type: "requested",
          mode: "ask",
          policy_revision: "revision",
          provider_kind: "builtin",
          provider_id: "test",
          provider_digest: "digest",
          tool_name: "bash",
          effect_class: "write",
          scope_version: "v1",
          scope: {},
          fingerprint: "fingerprint",
          summary: "append-only authority",
          time_created: Date.now(),
        })
        .run(),
    )
    let conflict: unknown
    try {
      await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    } catch (cause) {
      conflict = cause
    }
    expect({
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      ledger: Database.use((db) =>
        db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.id, ledgerID)).get(),
      ),
      projects: Project.list()
        .filter((project) => [canonicalProjectID, duplicateProjectID].includes(project.id))
        .map((project) => project.id)
        .sort(),
    }).toEqual({
      message: "append-only permission ledger contains 1 immutable fact(s) for duplicate Project identity",
      ledger: expect.objectContaining({ id: ledgerID, project_id: duplicateProjectID }),
      projects: [canonicalProjectID, duplicateProjectID].sort(),
    })
  })

  test("a durable pending publication keeps its original Project occurrence", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const occurrenceID = `event_${crypto.randomUUID()}`
    Database.use((db) =>
      db
        .insert(BusPublicationOutboxTable)
        .values({
          occurrence_id: occurrenceID,
          project_id: duplicateProjectID,
          directory: fixture.path,
          event_type: "project.memory.updated",
          properties: { projectID: duplicateProjectID },
          time_created: Date.now(),
          time_updated: Date.now(),
        })
        .run(),
    )
    let conflict: unknown
    try {
      await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    } catch (cause) {
      conflict = cause
    }
    expect({
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      event: Database.use((db) =>
        db
          .select()
          .from(BusPublicationOutboxTable)
          .where(eq(BusPublicationOutboxTable.occurrence_id, occurrenceID))
          .get(),
      ),
    }).toEqual({
      message: "durable publication outbox contains 1 immutable fact(s) for duplicate Project identity",
      event: expect.objectContaining({ project_id: duplicateProjectID, properties: { projectID: duplicateProjectID } }),
    })
  })

  test("a durable Session prompt owner preserves its exact Project occurrence", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    const sessionID = `session_${crypto.randomUUID()}`
    const generation = `call_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const now = Date.now()
    Database.use((db) => {
      db.insert(SessionTable)
        .values({
          id: sessionID,
          project_id: duplicateProjectID,
          slug: "durable-prompt-owner",
          directory: fixture.path,
          title: "Durable prompt owner",
          version: "1",
          kind: "root",
          time_created: now,
          time_updated: now,
        })
        .run()
      db.insert(SessionPromptOwnerTable)
        .values({
          session_id: sessionID,
          project_id: duplicateProjectID,
          directory: fixture.path,
          generation,
          owner_pid: process.pid,
          owner_process_instance_id: `process_${crypto.randomUUID()}`,
          owner_occurrence_id: `occurrence_${crypto.randomUUID()}`,
          time_acquired: now,
        })
        .run()
    })

    const conflict = await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID }).catch(
      (cause) => cause,
    )
    expect({
      name: conflict instanceof Error ? conflict.name : undefined,
      message: ProjectIdentityConvergence.ConflictError.isInstance(conflict) ? conflict.data.message : undefined,
      projects: Project.list()
        .filter((project) => [canonicalProjectID, duplicateProjectID].includes(project.id))
        .map((project) => project.id)
        .sort(),
      session: Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()),
      owner: Database.use((db) =>
        db.select().from(SessionPromptOwnerTable).where(eq(SessionPromptOwnerTable.session_id, sessionID)).get(),
      ),
    }).toEqual({
      name: "ProjectIdentityConvergenceConflictError",
      message: "durable Session prompt ownership contains 1 immutable fact(s) for duplicate Project identity",
      projects: [canonicalProjectID, duplicateProjectID].sort(),
      session: expect.objectContaining({ id: sessionID, project_id: duplicateProjectID }),
      owner: expect.objectContaining({ session_id: sessionID, project_id: duplicateProjectID, generation }),
    })
  })

  test("a canonical Session prompt owner remains authoritative while its duplicate Project converges", async () => {
    await using fixture = await memoryProject()
    const canonicalProjectID = `project_${crypto.randomUUID()}`
    const duplicateProjectID = `project_${crypto.randomUUID()}`
    const sessionID = `session_${crypto.randomUUID()}`
    insertProject({ id: canonicalProjectID, worktree: fixture.path })
    insertProject({ id: duplicateProjectID, worktree: fixture.path })
    const now = Date.now()
    const session = {
      id: sessionID,
      project_id: canonicalProjectID,
      parent_id: null,
      slug: "canonical-durable-prompt-owner",
      directory: fixture.path,
      title: "Canonical durable prompt owner",
      version: "1",
      kind: "root" as const,
      share_url: null,
      summary_additions: null,
      summary_deletions: null,
      summary_files: null,
      permission: null,
      metadata: null,
      time_created: now,
      time_updated: now,
      time_archived: null,
      time_pinned: null,
    }
    const owner = {
      session_id: sessionID,
      project_id: canonicalProjectID,
      directory: fixture.path,
      generation: `call_${crypto.randomUUID()}`,
      owner_pid: process.pid,
      owner_process_instance_id: `process_${crypto.randomUUID()}`,
      owner_occurrence_id: `occurrence_${crypto.randomUUID()}`,
      time_acquired: now,
    }
    Database.use((db) => {
      db.insert(SessionTable).values(session).run()
      db.insert(SessionPromptOwnerTable).values(owner).run()
    })

    const receipt = await convergeProjectIdentity({ worktree: fixture.path, canonicalProjectID })
    expect({
      receipt: {
        canonicalProjectID: receipt.canonicalProjectID,
        removedProjectIDs: receipt.removedProjectIDs,
      },
      duplicate: Project.get(duplicateProjectID),
      session: Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()),
      owner: Database.use((db) =>
        db.select().from(SessionPromptOwnerTable).where(eq(SessionPromptOwnerTable.session_id, sessionID)).get(),
      ),
    }).toEqual({
      receipt: { canonicalProjectID, removedProjectIDs: [duplicateProjectID] },
      duplicate: undefined,
      session,
      owner,
    })
  })

  test("the reviewed repair mapping exactly covers the application tables with Project identity columns", () => {
    const applicationProjectTables = Object.values(ApplicationSchema)
      .map((table) => getTableConfig(table))
      .filter((table) => table.columns.some((column) => column.name === "project_id"))
      .map((table) => table.name)
      .sort()
    expect(ProjectIdentityConvergence.PROJECT_REFERENCE_CONTRACTS.map((contract) => contract.table).sort()).toEqual(
      applicationProjectTables,
    )
  })
})
