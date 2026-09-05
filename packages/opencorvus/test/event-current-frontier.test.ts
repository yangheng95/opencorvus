import { afterAll, describe, expect, test } from "bun:test"
import { EngineControlActivationLeaseTable } from "../src/engine/engine.sql"
import { currentControlLeaseRowsSQL, releaseControlLeaseInTransaction } from "../src/engine/control-lease"
import { Instance } from "../src/project/instance"
import {
  completedOneShotEventDefinitionIDsInTransaction,
  currentEventDefinitionPageInTransaction,
  currentEventFireHeadPageInTransaction,
  currentEventFireHeadRowsSQL,
  nextEventFireQueuePositionsInTransaction,
  projectEventFireInTransaction,
  type EventFrontierQueryStage,
} from "../src/scheduler/event-projection"
import { EventService } from "../src/scheduler/event-service"
import {
  EventJobDefinitionTombstoneTable,
  EventJobFireReceiptTable,
  EventJobFireTable,
  EventJobTable,
  EventOccurrenceTable,
} from "../src/scheduler/event.sql"
import { Database, eq, sql } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const MATCHED_EVENT = "test.event.current-frontier"
const OTHER_EVENT = "test.event.unrelated"

function definitionRevisionID(definitionID: string, revision: number) {
  return `${definitionID}:revision:${revision}`
}

function insertDefinition(
  db: Database.TxOrDb,
  input: {
    definitionID: string
    projectID: string
    revision?: number
    eventType?: string
    oneShot?: boolean
    timeCreated: number
  },
) {
  const revision = input.revision ?? 1
  const row = {
    id: definitionRevisionID(input.definitionID, revision),
    definition_id: input.definitionID,
    revision,
    project_id: input.projectID,
    session_id: null,
    name: input.definitionID,
    event_type: input.eventType ?? OTHER_EVENT,
    match_json: {},
    prompt: `Run ${input.definitionID}`,
    agent: "default",
    enabled: true,
    one_shot: input.oneShot ?? false,
    cooldown_ms: 0,
    tool_part_id: null,
    tool_input_digest: null,
    time_created: input.timeCreated,
  } satisfies typeof EventJobTable.$inferInsert
  db.insert(EventJobTable).values(row).run()
  return row
}

function insertFire(
  db: Database.TxOrDb,
  input: {
    definitionRevisionID: string
    fireID: string
    projectID: string
    timeCreated: number
    terminal?: boolean
    causalCycle?: boolean
    causationFireID?: string
  },
) {
  const definition = db
    .select({ definitionID: EventJobTable.definition_id })
    .from(EventJobTable)
    .where(eq(EventJobTable.id, input.definitionRevisionID))
    .get()
  if (!definition) throw new Error(`Missing Event definition revision ${input.definitionRevisionID}`)
  const queuePosition = nextEventFireQueuePositionsInTransaction(db, [definition.definitionID]).get(
    definition.definitionID,
  )
  if (!queuePosition) throw new Error(`Missing Event queue position for ${definition.definitionID}`)
  const occurrenceID = `${input.fireID}:occurrence`
  db.insert(EventOccurrenceTable)
    .values({
      id: occurrenceID,
      bus_outbox_id: null,
      project_id: input.projectID,
      event_type: MATCHED_EVENT,
      properties: {},
      time_created: input.timeCreated,
    })
    .run()
  db.insert(EventJobFireTable)
    .values({
      id: input.fireID,
      definition_id: definition.definitionID,
      queue_position: queuePosition,
      event_job_revision_id: input.definitionRevisionID,
      event_occurrence_id: occurrenceID,
      causation_fire_id: input.causationFireID ?? null,
      causal_cycle: input.causalCycle ?? false,
      created_session_id: `${input.fireID}:session`,
      mission_opened_event_id: null,
      mission_disposition: null,
      mission_closure_event_id: null,
      time_created: input.timeCreated,
    })
    .run()
  if (input.terminal) {
    db.insert(EventJobFireReceiptTable)
      .values({
        id: `${input.fireID}:success`,
        fire_id: input.fireID,
        definition_id: definition.definitionID,
        queue_position: queuePosition,
        outcome: "succeeded",
        disposition: null,
        closure_event_id: null,
        message_id: `${input.fireID}:message`,
        retry_at: null,
        error: null,
        time_created: input.timeCreated + 1,
      })
      .run()
  }
  return input.fireID
}

describe("Event bounded current frontier", () => {
  test("pages only current Project definitions and production acceptance reaches later pages", async () => {
    await using activeProject = await memoryProject()
    await using siblingProject = await memoryProject()
    const siblingProjectID = await Instance.provide({
      directory: siblingProject.path,
      fn: async () => Instance.project.id,
    })
    await Instance.provide({
      directory: activeProject.path,
      fn: async () => {
        const activeProjectID = Instance.project.id
        const now = Date.now()
        Database.immediateTransaction((db) => {
          for (let index = 0; index < 130; index += 1) {
            const definitionID = `${activeProjectID}:definition:${index.toString().padStart(3, "0")}`
            insertDefinition(db, {
              definitionID,
              projectID: activeProjectID,
              eventType: index === 129 ? MATCHED_EVENT : OTHER_EVENT,
              oneShot: index === 1 || index === 65 || index === 129,
              timeCreated: now + index,
            })
            if (index === 0) {
              insertDefinition(db, {
                definitionID,
                projectID: activeProjectID,
                revision: 2,
                eventType: MATCHED_EVENT,
                timeCreated: now + 1_000,
              })
            }
            if (index === 64) {
              db.insert(EventJobDefinitionTombstoneTable)
                .values({
                  id: `${definitionID}:tombstone`,
                  definition_id: definitionID,
                  revision: 2,
                  time_created: now + 1_000,
                })
                .run()
            }
          }
          insertDefinition(db, {
            definitionID: `${siblingProjectID}:definition:matching`,
            projectID: siblingProjectID,
            eventType: MATCHED_EVENT,
            timeCreated: now,
          })
        })

        const projected = Database.use((db) => {
          const definitionIDs: string[] = []
          const stages: EventFrontierQueryStage[] = []
          let afterDefinitionID: string | undefined
          while (true) {
            const page = currentEventDefinitionPageInTransaction(db, {
              projectID: activeProjectID,
              afterDefinitionID,
              observe: (stage) => stages.push(stage),
            })
            completedOneShotEventDefinitionIDsInTransaction(db, page.rows, (stage) => stages.push(stage))
            definitionIDs.push(...page.rows.map((row) => row.definition_id))
            if (!page.hasMore) break
            afterDefinitionID = page.rows.at(-1)!.definition_id
          }
          return { definitionIDs, stages }
        })
        expect(projected.definitionIDs).toEqual(Array.from({ length: 129 }, (_, index) =>
          `${activeProjectID}:definition:${(index < 64 ? index : index + 1).toString().padStart(3, "0")}`,
        ))
        expect(projected.stages).toEqual([
          "definitions",
          "one_shot",
          "definitions",
          "one_shot",
          "definitions",
          "one_shot",
        ])
        const oversizedChildSet = Database.use((db) => {
          const first = currentEventDefinitionPageInTransaction(db, { projectID: activeProjectID })
          const second = currentEventDefinitionPageInTransaction(db, {
            projectID: activeProjectID,
            afterDefinitionID: first.rows.at(-1)!.definition_id,
          })
          return [...first.rows, second.rows[0]!]
        })
        expect(() =>
          Database.use((db) => completedOneShotEventDefinitionIDsInTransaction(db, oversizedChildSet)),
        ).toThrow("Event definition child set exceeds 64")

        const accepted: string[] = []
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          accepted.push(fire.event_job_id)
          return { sessionID: fire.target_session_id, messageID: `${fire.id}:message` }
        })
        await EventService.TestHooks.acceptEnvelope({
          occurrenceID: `${activeProjectID}:frontier-acceptance`,
          type: MATCHED_EVENT,
          properties: { current: true },
        })
        await EventService.TestHooks.waitForIdle()
        expect(accepted.sort()).toEqual([
          `${activeProjectID}:definition:000`,
          `${activeProjectID}:definition:129`,
        ])
      },
    })
  }, 60_000)

  test("selects one FIFO head per definition from retained history with fixed child-query stages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const now = Date.now()
        const heads = new Map<string, string>()
        let queuedFireID = ""
        Database.immediateTransaction((db) => {
          for (let index = 0; index < 65; index += 1) {
            const definitionID = `${projectID}:head:${index.toString().padStart(3, "0")}`
            const definition = insertDefinition(db, {
              definitionID,
              projectID,
              timeCreated: now + index,
            })
            const retainedHistory = index === 0 ? 1_024 : 4
            for (let history = 0; history < retainedHistory; history += 1) {
              insertFire(db, {
                definitionRevisionID: definition.id,
                fireID: `${definitionID}:terminal:${history}`,
                projectID,
                timeCreated: now + history * 10,
                terminal: true,
              })
            }
            const headID = insertFire(db, {
              definitionRevisionID: definition.id,
              fireID: `${definitionID}:head`,
              projectID,
              timeCreated: now + 100,
            })
            heads.set(definitionID, headID)
            if (index === 0) {
              queuedFireID = insertFire(db, {
                definitionRevisionID: definition.id,
                fireID: `${definitionID}:queued`,
                projectID,
                timeCreated: now + 101,
              })
            }
            if (index === 1) {
              const head = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, headID)).get()!
              db.insert(EventJobFireReceiptTable)
                .values({
                  id: `${headID}:retry`,
                  fire_id: headID,
                  definition_id: head.definition_id,
                  queue_position: head.queue_position,
                  outcome: "retry_wait",
                  retry_at: now + 60_000,
                  error: "retry later",
                  time_created: now + 102,
                })
                .run()
            }
            if (index === 2 || index === 3) {
              db.insert(EngineControlActivationLeaseTable)
                .values({
                  id: `${headID}:lease`,
                  target: "event_fire",
                  target_id: headID,
                  owner_occurrence_id: `${headID}:owner`,
                  time_activated: now - 100,
                  expires_at: index === 2 ? now + 60_000 : now - 1,
                })
                .run()
            }
          }
        })

        const frontier = Database.use((db) => {
          const rows = [] as ReturnType<typeof currentEventFireHeadPageInTransaction>["rows"]
          const stages: EventFrontierQueryStage[] = []
          let afterDefinitionID: string | undefined
          while (true) {
            const page = currentEventFireHeadPageInTransaction(db, {
              projectID,
              now,
              afterDefinitionID,
              observe: (stage) => stages.push(stage),
            })
            rows.push(...page.rows)
            if (!page.hasMore) break
            afterDefinitionID = page.nextDefinitionID
            if (!afterDefinitionID) throw new Error("Event Fire head page has no cursor")
          }
          return { rows, stages }
        })
        expect(frontier.rows).toHaveLength(65)
        expect(frontier.rows.map((row) => row.fire.id)).toEqual([...heads.values()])
        expect(frontier.rows.slice(0, 4).map((row) => row.status)).toEqual([
          "pending",
          "retry_wait",
          "running",
          "pending",
        ])
        expect(frontier.stages).toEqual([
          "head_definitions",
          "heads",
          "retries",
          "leases",
          "head_definitions",
          "heads",
          "retries",
          "leases",
        ])
        EventService.TestHooks.claimFire(queuedFireID, "queued-owner")
        expect(Database.use((db) => {
          const queued = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, queuedFireID)).get()!
          return projectEventFireInTransaction(db, queued, Date.now())
        })).toMatchObject({ id: queuedFireID, status: "pending" })
        expect(EventService.TestHooks.claimFire(heads.values().next().value!, "head-owner")).toMatchObject({
          status: "running",
          owner_id: "head-owner",
        })

        const plan = Database.use((db) =>
          db.all<{ detail: string }>(sql`
            EXPLAIN QUERY PLAN ${currentEventFireHeadRowsSQL([...heads.keys()].slice(0, 64))}
          `),
        )
        const details = plan.map((entry) => entry.detail).join("\n")
        expect(details).toContain("event_job_fire_definition_frontier_idx")
        expect(details).toContain("event_job_fire_terminal_frontier_idx")
        const selectedFireID = heads.values().next().value!
        const retryPlan = Database.use((db) =>
          db.all<{ detail: string }>(sql`
            EXPLAIN QUERY PLAN
            SELECT receipt.id
            FROM event_job_fire_receipt AS receipt
            WHERE receipt.fire_id=${selectedFireID} AND receipt.outcome='retry_wait'
            ORDER BY receipt.time_created DESC,receipt.id DESC
            LIMIT 1
          `),
        )
        expect(retryPlan.some((entry) => entry.detail.includes("event_job_fire_receipt_fire_idx"))).toBe(true)
        const leasePlan = Database.use((db) =>
          db.all<{ detail: string }>(sql`
            EXPLAIN QUERY PLAN ${currentControlLeaseRowsSQL("event_fire", [selectedFireID])}
          `),
        )
        expect(leasePlan.some((entry) => entry.detail.includes("engine_control_activation_target_idx"))).toBe(true)
      },
    })
  }, 60_000)

  test("production recovery drains every paged head in FIFO order and preserves sibling Project work", async () => {
    await using activeProject = await memoryProject()
    await using siblingProject = await memoryProject()
    const siblingProjectID = await Instance.provide({
      directory: siblingProject.path,
      fn: async () => Instance.project.id,
    })
    await Instance.provide({
      directory: activeProject.path,
      fn: async () => {
        const projectID = Instance.project.id
        const now = Date.now()
        const expected: string[] = []
        let firstDefinitionID = ""
        Database.immediateTransaction((db) => {
          for (let index = 0; index < 65; index += 1) {
            const definitionID = `${projectID}:recovery:${index.toString().padStart(3, "0")}`
            if (index === 0) firstDefinitionID = definitionID
            const definition = insertDefinition(db, { definitionID, projectID, timeCreated: now + index })
            for (let history = 0; history < 2; history += 1) {
              insertFire(db, {
                definitionRevisionID: definition.id,
                fireID: `${definitionID}:terminal:${history}`,
                projectID,
                timeCreated: now + history * 10,
                terminal: true,
              })
            }
            const first = insertFire(db, {
              definitionRevisionID: definition.id,
              fireID: `${definitionID}:pending`,
              projectID,
              timeCreated: now + 100,
            })
            expected.push(first)
            if (index === 0) {
              expected.push(
                insertFire(db, {
                  definitionRevisionID: definition.id,
                  fireID: `${definitionID}:second`,
                  projectID,
                  timeCreated: now + 101,
                }),
              )
            }
          }
          const sibling = insertDefinition(db, {
            definitionID: `${siblingProjectID}:recovery:000`,
            projectID: siblingProjectID,
            timeCreated: now,
          })
          insertFire(db, {
            definitionRevisionID: sibling.id,
            fireID: `${sibling.definition_id}:pending`,
            projectID: siblingProjectID,
            timeCreated: now + 100,
          })
        })

        const processed: string[] = []
        using _capacity = EventService.TestHooks.installExecutionCapacity(8)
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          processed.push(fire.id)
          return { sessionID: fire.target_session_id, messageID: `${fire.id}:message` }
        })
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()

        expect(new Set(processed)).toEqual(new Set(expected))
        expect(processed.filter((fireID) => fireID.startsWith(firstDefinitionID))).toEqual([
          `${firstDefinitionID}:pending`,
          `${firstDefinitionID}:second`,
        ])
        expect(EventService.TestHooks.fires(projectID).every((fire) => fire.status === "succeeded")).toBe(true)
        expect(EventService.TestHooks.fires(siblingProjectID)).toEqual([
          expect.objectContaining({ id: `${siblingProjectID}:recovery:000:pending`, status: "pending" }),
        ])
      },
    })
  }, 120_000)

  test("a remote terminal commit hands the recovery timer to the next FIFO Fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const now = Date.now()
        const definition = Database.immediateTransaction((db) =>
          insertDefinition(db, {
            definitionID: `${projectID}:remote-terminal-handoff`,
            projectID,
            timeCreated: now,
          }),
        )
        const [headID, nextID] = Database.immediateTransaction((db) => [
          insertFire(db, {
            definitionRevisionID: definition.id,
            fireID: `${definition.definition_id}:head`,
            projectID,
            timeCreated: now,
          }),
          insertFire(db, {
            definitionRevisionID: definition.id,
            fireID: `${definition.definition_id}:next`,
            projectID,
            timeCreated: now + 1,
          }),
        ])
        const leaseID = `${headID}:remote-lease`
        const remoteOwner = `${headID}:remote-owner`
        Database.immediateTransaction((db) => {
          db.insert(EngineControlActivationLeaseTable)
            .values({
              id: leaseID,
              target: "event_fire",
              target_id: headID,
              owner_occurrence_id: remoteOwner,
              time_activated: now,
              expires_at: now + 350,
            })
            .run()
        })

        const woken: string[] = []
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          woken.push(fire.id)
          return { sessionID: fire.target_session_id, messageID: `${fire.id}:message` }
        })
        EventService.TestHooks.scheduleLeaseRecovery(headID)
        expect(EventService.TestHooks.recoveryTimerActive(headID)).toBe(true)

        Database.immediateTransaction((db) => {
          const head = db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, headID)).get()!
          const terminalAt = Date.now()
          db.insert(EventJobFireReceiptTable)
            .values({
              id: `${headID}:remote-success`,
              fire_id: head.id,
              definition_id: head.definition_id,
              queue_position: head.queue_position,
              outcome: "succeeded",
              disposition: null,
              closure_event_id: null,
              message_id: `${headID}:remote-message`,
              retry_at: null,
              error: null,
              time_created: terminalAt,
            })
            .run()
          expect(
            releaseControlLeaseInTransaction(db, {
              target: "event_fire",
              targetID: headID,
              leaseID,
              ownerOccurrenceID: remoteOwner,
              now: terminalAt,
            }),
          ).toBe(true)
        })

        await Bun.sleep(700)
        await EventService.TestHooks.waitForIdle()
        expect(woken).toEqual([nextID])
        expect(EventService.TestHooks.recoveryTimerActive(headID)).toBe(false)
        expect(EventService.TestHooks.fires(projectID).map((fire) => [fire.id, fire.status])).toEqual([
          [headID, "succeeded"],
          [nextID, "succeeded"],
        ])
      },
    })
  }, 60_000)

  test("a causal-cycle disposition advances only after its older FIFO head", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const now = Date.now()
        const definition = Database.immediateTransaction((db) =>
          insertDefinition(db, {
            definitionID: `${projectID}:causal-cycle-fifo`,
            projectID,
            timeCreated: now,
          }),
        )
        const [headID, cycleID] = Database.immediateTransaction((db) => {
          const head = insertFire(db, {
            definitionRevisionID: definition.id,
            fireID: `${definition.definition_id}:head`,
            projectID,
            timeCreated: now,
          })
          return [
            head,
            insertFire(db, {
              definitionRevisionID: definition.id,
              fireID: `${definition.definition_id}:cycle`,
              projectID,
              timeCreated: now + 1,
              causalCycle: true,
              causationFireID: head,
            }),
          ]
        })
        const woken: string[] = []
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          woken.push(fire.id)
          return { sessionID: fire.target_session_id, messageID: `${fire.id}:message` }
        })
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()
        expect(woken).toEqual([headID])
        expect(EventService.TestHooks.fires(projectID).map((fire) => [fire.id, fire.status, fire.disposition])).toEqual([
          [headID, "succeeded", null],
          [cycleID, "disposition", "causal_cycle"],
        ])
      },
    })
  }, 60_000)

  test("the current claim does not consume its own cooldown predecessor", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "cooldown predecessor",
          eventType: MATCHED_EVENT,
          prompt: "run once",
          projectId: Instance.project.id,
          cooldownMs: 60_000,
        })
        let wakeCalls = 0
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          wakeCalls += 1
          return { sessionID: fire.target_session_id, messageID: `${fire.id}:message` }
        })
        await EventService.TestHooks.acceptEnvelope({
          occurrenceID: `${Instance.project.id}:cooldown:first`,
          type: MATCHED_EVENT,
          properties: { ordinal: 1 },
        })
        await EventService.TestHooks.waitForIdle()
        await EventService.TestHooks.acceptEnvelope({
          occurrenceID: `${Instance.project.id}:cooldown:second`,
          type: MATCHED_EVENT,
          properties: { ordinal: 2 },
        })
        await EventService.TestHooks.waitForIdle()
        expect({
          wakeCalls,
          fires: EventService.TestHooks.fires(Instance.project.id).map((fire) => ({
            jobID: fire.event_job_id,
            status: fire.status,
            disposition: fire.disposition,
          })),
        }).toEqual({
          wakeCalls: 1,
          fires: [
            { jobID: job.id, status: "succeeded", disposition: null },
            { jobID: job.id, status: "disposition", disposition: "cooldown" },
          ],
        })
      },
    })
  }, 60_000)
})
