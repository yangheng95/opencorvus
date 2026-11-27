import { afterEach, expect, test } from "bun:test"
import { Database } from "@/storage/db"
import { ProjectMemory, ProjectMemoryInvariantError } from "@/memory/project-memory"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

function capture(projectID: string, sessionID: string, occurrenceID: string, text: string) {
  Database.immediateTransaction((db) =>
    ProjectMemory.captureOccurrenceInTransaction(db, {
      projectID,
      sessionID,
      occurrenceKind: "interaction_reply",
      occurrenceID,
      surface: "test.memory-settlement",
      timeCreated: Date.now(),
      text,
    }),
  )
}

function begin(projectID: string, leaseID: string, leaseTtlMs = 60_000) {
  return Database.immediateTransaction((db) =>
    ProjectMemory.beginOrganizerAttemptInTransaction(db, {
      projectID,
      leaseID,
      expectedRevision: ProjectMemory.readInTransaction(db, projectID).revision,
      leaseTtlMs,
    }),
  )!
}

function commit(projectID: string, leaseID: string, markdown: string) {
  const snapshot = ProjectMemory.read(projectID)
  const coveredOccurrenceIDs = ProjectMemory.pending(projectID).map((entry) => entry.occurrenceID)
  return Database.immediateTransaction((db) =>
    ProjectMemory.commitOrganizationInTransaction(db, {
      projectID,
      leaseID,
      baseRevision: snapshot.revision,
      coveredOccurrenceIDs,
      markdown,
    }),
  )
}

async function expire(lease: { expiresAt: number }) {
  while (Date.now() <= lease.expiresAt) await Bun.sleep(2)
}

for (const expired of [false, true]) {
  test(`a failed ${expired ? "expired" : "active"} current attempt hands its complete input to the next document version`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const session = await Session.create({ kind: "assistant", title: "Memory failure settlement" })
        capture(projectID, session.id, "initial-input", "Retain the initial committed decision.")
        begin(projectID, "initial-writer")
        commit(projectID, "initial-writer", "# Context\n\nInitial committed decision.")
        capture(projectID, session.id, "next-input", "Complete pending wording: 中文与🙂 remain readable.")
        const before = ProjectMemory.read(projectID)
        const pending = ProjectMemory.pending(projectID)
        const lease = begin(projectID, "failing-writer", expired ? 1 : 60_000)
        expect(lease.id).toBe("failing-writer")
        if (expired) {
          await expire(lease)
          expect(() => commit(projectID, lease.id, "# Context\n\nLate output.")).toThrow(ProjectMemoryInvariantError)
        }
        const released = Database.immediateTransaction((db) =>
          ProjectMemory.releaseOrganizerAttemptInTransaction(db, {
            projectID,
            leaseID: lease.id,
          }),
        )
        expect({ released, document: ProjectMemory.read(projectID) }).toMatchObject({
          released: true,
          document: {
            status: "retry_wait",
            content: before.content,
            revision: before.revision,
            tokenCount: before.tokenCount,
            pendingCount: 1,
          },
        })
        expect(ProjectMemory.pending(projectID)).toEqual(pending)
        expect(begin(projectID, "retry-writer").id).toBe("retry-writer")
        expect(
          commit(projectID, "retry-writer", "# Context\n\nInitial decision and the complete pending correction."),
        ).toMatchObject({
          revision: before.revision + 1,
          coveredOccurrenceIDs: ["next-input"],
        })
        expect(ProjectMemory.read(projectID)).toMatchObject({
          status: "idle",
          revision: before.revision + 1,
          pendingCount: 0,
          content: "# Context\n\nInitial decision and the complete pending correction.\n",
        })
      },
    })
  })
}

test("the successor publishes its exact pending prefix after the expired holder reports failure", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectID = Instance.project.id
      const session = await Session.create({ kind: "assistant", title: "Successor settlement" })
      capture(projectID, session.id, "successor-input", "Publish this exact original input.")
      const original = begin(projectID, "original-writer", 1)
      await expire(original)
      expect(begin(projectID, "successor-writer").id).toBe("successor-writer")
      const oldRelease = Database.immediateTransaction((db) =>
        ProjectMemory.releaseOrganizerAttemptInTransaction(db, {
          projectID,
          leaseID: original.id,
        }),
      )
      expect({
        oldRelease,
        commit: commit(projectID, "successor-writer", "# Context\n\nSuccessor preserved the original input."),
      }).toMatchObject({
        oldRelease: false,
        commit: { revision: 1, coveredOccurrenceIDs: ["successor-input"] },
      })
      expect(ProjectMemory.read(projectID)).toMatchObject({ status: "idle", revision: 1, pendingCount: 0 })
    },
  })
})

test("availability revocation and overlapping Project attempts retain their independent current writers", async () => {
  await using projectA = await memoryProject("memory-settlement-project-a")
  await using projectB = await memoryProject("memory-settlement-project-b")
  const a = await Instance.provide({
    directory: projectA.path,
    fn: async () => {
      const projectID = Instance.project.id
      const session = await Session.create({ kind: "assistant", title: "Project A" })
      capture(projectID, session.id, "project-a-input", "A's exact pending decision.")
      return { projectID, lease: begin(projectID, "project-a-original") }
    },
  })
  const b = await Instance.provide({
    directory: projectB.path,
    fn: async () => {
      const projectID = Instance.project.id
      const session = await Session.create({ kind: "assistant", title: "Project B" })
      capture(projectID, session.id, "project-b-input", "B's exact pending decision.")
      return { projectID, lease: begin(projectID, "project-b-original", 1), pending: ProjectMemory.pending(projectID) }
    },
  })
  await Instance.provide({
    directory: projectA.path,
    fn: async () => {
      expect(
        Database.immediateTransaction((db) =>
          ProjectMemory.invalidateOrganizerAvailabilityInTransaction(db, { projectID: a.projectID }),
        ),
      ).toBe(1)
      expect(begin(a.projectID, "project-a-new-generation").availabilityGeneration).toBe(1)
      const oldRelease = Database.immediateTransaction((db) =>
        ProjectMemory.releaseOrganizerAttemptInTransaction(db, { projectID: a.projectID, leaseID: a.lease.id }),
      )
      expect({
        oldRelease,
        commit: commit(a.projectID, "project-a-new-generation", "# A\n\nA's exact decision."),
      }).toMatchObject({
        oldRelease: false,
        commit: { revision: 1, coveredOccurrenceIDs: ["project-a-input"] },
      })
    },
  })
  await Instance.provide({
    directory: projectB.path,
    fn: async () => {
      await expire(b.lease)
      expect(ProjectMemory.pending(b.projectID)).toEqual(b.pending)
      expect(
        Database.immediateTransaction((db) =>
          ProjectMemory.releaseOrganizerAttemptInTransaction(db, { projectID: b.projectID, leaseID: b.lease.id }),
        ),
      ).toBe(true)
      expect(ProjectMemory.read(b.projectID)).toMatchObject({ status: "retry_wait", revision: 0, pendingCount: 1 })
      expect(begin(b.projectID, "project-b-retry").id).toBe("project-b-retry")
      expect(commit(b.projectID, "project-b-retry", "# B\n\nB's exact decision.")).toMatchObject({
        revision: 1,
        coveredOccurrenceIDs: ["project-b-input"],
      })
    },
  })
  expect(ProjectMemory.read(a.projectID)).toMatchObject({
    status: "idle",
    revision: 1,
    content: "# A\n\nA's exact decision.\n",
    pendingCount: 0,
  })
  expect(ProjectMemory.read(b.projectID)).toMatchObject({
    status: "idle",
    revision: 1,
    content: "# B\n\nB's exact decision.\n",
    pendingCount: 0,
  })
})
