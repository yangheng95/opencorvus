import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import {
  appendTaskSystemArtifact,
  prepareTaskAttachmentAppends,
  replaceTaskSystemArtifactByIntent,
} from "@/engine/task-file-reference"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { AttachmentStore } from "@/storage/attachment-store"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("persists canonical Task file references through their Engine owner", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Task file reference owner" })
      const now = Date.now()
      Database.immediateTransaction((db) => {
        db.insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Task file reference owner",
            request: "Persist canonical Task attachment and system Artifact references.",
            time_started: now,
            time_created: now,
            time_updated: now,
          })
          .run()
        appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.task-file-reference" })
      })

      const firstSystem = await AttachmentStore.write(
        Instance.project.id,
        Buffer.from("first system artifact"),
        "text/plain",
        "first.txt",
      )
      const secondSystem = await AttachmentStore.write(
        Instance.project.id,
        Buffer.from("replacement system artifact"),
        "text/plain",
        "second.txt",
      )
      const inputAttachment = await AttachmentStore.write(
        Instance.project.id,
        Buffer.from("operator attachment"),
        "text/plain",
        "input.txt",
      )

      await appendTaskSystemArtifact(taskID, { ...firstSystem, intent: "design_source", source: "material" })
      const replaced = await replaceTaskSystemArtifactByIntent(taskID, "design_source", {
        ...secondSystem,
        intent: "design_source",
        source: "material",
      })
      expect(replaced).toEqual([{ ...secondSystem, intent: "design_source", source: "material" }])

      const prepared = await prepareTaskAttachmentAppends(taskID, [
        { ...inputAttachment, intent: "task_input", source: "user-upload" },
      ])
      Database.immediateTransaction((db) => prepared.commitInTransaction(db))

      expect(requireTask(taskID)).toMatchObject({
        attachments: [{ ...inputAttachment, intent: "task_input", source: "user-upload" }],
        system_artifacts: [{ ...secondSystem, intent: "design_source", source: "material" }],
      })
    },
  })
})
