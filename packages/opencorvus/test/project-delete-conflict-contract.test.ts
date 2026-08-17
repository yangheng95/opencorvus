import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import {
  acquireProjectMaintenanceFencesInTransaction,
  closeProjectDeletionRegistryAdmission,
  releaseProjectMaintenanceFencesInTransaction,
} from "@/project/deletion-registry"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { namedErrorStatus } from "@/server/error-handler"
import { Server } from "@/server/server"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("returns the canonical Project admission conflict for a concurrent deletion occurrence", async () => {
  await using project = await memoryProject()
  const registered = await Project.fromDirectory(project.path)
  using _admission = closeProjectDeletionRegistryAdmission(registered.project.id)

  let conflict: unknown
  try {
    closeProjectDeletionRegistryAdmission(registered.project.id)
  } catch (error) {
    conflict = error
  }

  expect({
    status: namedErrorStatus(conflict as { name: string }),
    body: (conflict as { toObject(): unknown }).toObject(),
  }).toEqual({
    status: 409,
    body: {
      name: "ProjectDurableAdmissionClosedError",
      data: {
        projectID: registered.project.id,
        message: `Project ${registered.project.id} registry admission is already closed`,
      },
    },
  })

  const response = await Server.App().request("/project/current", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-opencorvus-directory": project.path,
    },
    body: JSON.stringify({
      surface: "overlay.work_ledger",
      reason: "Join an already active Project deletion occurrence",
    }),
  })
  expect({ status: response.status, body: await response.json() }).toEqual({
    status: 409,
    body: {
      name: "ProjectDurableAdmissionClosedError",
      data: {
        projectID: registered.project.id,
        message: `Project ${registered.project.id} registry admission is already closed`,
      },
    },
  })
})

test("returns the canonical Project admission conflict for a durable maintenance fence", async () => {
  await using project = await memoryProject()
  const registered = await Project.fromDirectory(project.path)
  const operationID = randomUUID()
  const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, registered.project.id)).get())!
  Database.immediateTransaction((db) =>
    acquireProjectMaintenanceFencesInTransaction(db, {
      projectRows: [row],
      operationID,
      kind: "delete",
    }),
  )

  try {
    let conflict: unknown
    try {
      closeProjectDeletionRegistryAdmission(registered.project.id)
    } catch (error) {
      conflict = error
    }
    expect({
      status: namedErrorStatus(conflict as { name: string }),
      body: (conflict as { toObject(): unknown }).toObject(),
    }).toEqual({
      status: 409,
      body: {
        name: "ProjectDurableAdmissionClosedError",
        data: {
          projectID: registered.project.id,
          message: `Project ${registered.project.id} durable maintenance admission is already closed`,
        },
      },
    })
  } finally {
    Database.immediateTransaction((db) => releaseProjectMaintenanceFencesInTransaction(db, { operationID }))
  }
})
