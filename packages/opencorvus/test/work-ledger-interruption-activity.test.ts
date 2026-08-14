import { afterAll, describe, expect, test } from "bun:test"
import { WorkLedgerRouteTestHooks } from "../src/server/routes/work-ledger"
import { ProjectMemory } from "../src/memory/project-memory"
import { resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Work Ledger interruption activity", () => {
  test("projects Project Memory notice changes onto the unified stream", () => {
    const envelope = WorkLedgerRouteTestHooks.workLedgerGlobalBusProjectMemoryEvent({
      payload: {
        type: ProjectMemory.Event.NoticeChanged.type,
        properties: {
          projectID: "project-1",
          status: "capacity_reached",
          message: "Project memory capacity reached",
          generation: "generation-1",
          acknowledged: false,
        },
      },
    })
    expect(envelope).toMatchObject({
      sourceType: ProjectMemory.Event.NoticeChanged.type,
      projectID: "project-1",
    })
    expect(envelope?.sequence).toBeGreaterThan(0)
  })
})
