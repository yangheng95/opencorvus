import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { listGoalGraphProjectionArtifacts, resolveTaskGoalProjection } from "@/engine/store"
import { Identifier } from "@/id/id"
import { applyDeliverySliceContractMutation } from "@/orchestrator/delivery-slice-contract-tools"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, sql } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

describe("Delivery Slice contract atomic publication", () => {
  test("keeps the exact current GoalGraph when add, modify, or remove publication is rejected", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Delivery Slice publication" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "code",
              title: "Delivery Slice publication",
              request: "Delivery Slice publication",
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const installFailure = () =>
          Database.use((db) =>
            db.run(
              sql.raw(`
                CREATE TEMP TRIGGER arc019_fail_delivery_slice_task_updated
                BEFORE INSERT ON protocol_event
                WHEN NEW.type = 'task.updated'
                  AND NEW.source IN ('orchestrator.add_goal','orchestrator.modify_goal','orchestrator.delete_goal')
                BEGIN SELECT RAISE(ABORT, 'injected Delivery Slice task.updated commit failure'); END
              `),
            ),
          )
        const removeFailure = () =>
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_delivery_slice_task_updated")))
        const current = () => {
          const projection = resolveTaskGoalProjection(taskID)
          return {
            currentGoalIDs: projection.currentGoals.map((goal) => goal.id),
            historicalGoalIDs: projection.historicalGoals.map((goal) => goal.id),
            projectionCount: listGoalGraphProjectionArtifacts(taskID).length,
          }
        }

        installFailure()
        const rejectedAdd = await Promise.resolve()
          .then(() =>
            applyDeliverySliceContractMutation({
              mutation: {
                taskID,
                producer: {
                  kind: "operator_command",
                  operation: "add",
                  reason: "Add the atomic publication Slice",
                  target_goal_id: null,
                },
                now: now + 1,
                mutation: {
                  operation: "add",
                  goal: {
                    title: "Atomic publication",
                    objective: "Commit the Delivery Slice and canonical Task event together.",
                    acceptance_specs: [],
                    owned_paths: ["packages/opencorvus/src/orchestrator/**"],
                    source: "system",
                  },
                },
              },
              publication: () => ({ summary: "Goal added", source: "orchestrator.add_goal" }),
            }),
          )
          .catch((error) => error)
        removeFailure()
        expect({
          error: rejectedAdd instanceof Error ? rejectedAdd.message : "not-an-error",
          current: current(),
        }).toEqual({
          error: expect.stringContaining("injected Delivery Slice task.updated commit failure"),
          current: { currentGoalIDs: [], historicalGoalIDs: [], projectionCount: 0 },
        })

        const added = applyDeliverySliceContractMutation({
          mutation: {
            taskID,
            producer: {
              kind: "operator_command",
              operation: "add",
              reason: "Add the atomic publication Slice",
              target_goal_id: null,
            },
            now: now + 2,
            mutation: {
              operation: "add",
              goal: {
                title: "Atomic publication",
                objective: "Commit the Delivery Slice and canonical Task event together.",
                acceptance_specs: [],
                owned_paths: ["packages/opencorvus/src/orchestrator/**"],
                source: "system",
              },
            },
          },
          publication: () => ({ summary: "Goal added", source: "orchestrator.add_goal" }),
        })
        if (!added.goalID) throw new Error("Expected the added Goal identity")

        installFailure()
        const rejectedModify = await Promise.resolve()
          .then(() =>
            applyDeliverySliceContractMutation({
              mutation: {
                taskID,
                producer: {
                  kind: "operator_command",
                  operation: "modify",
                  reason: "Revise the atomic publication Slice",
                  target_goal_id: added.goalID!,
                },
                now: now + 3,
                mutation: {
                  operation: "modify",
                  goalID: added.goalID!,
                  values: { objective: "This revision must roll back with a rejected publication." },
                },
              },
              publication: () => ({ summary: "Goal revised", source: "orchestrator.modify_goal" }),
            }),
          )
          .catch((error) => error)
        removeFailure()
        const afterModify = current()

        installFailure()
        const rejectedRemove = await Promise.resolve()
          .then(() =>
            applyDeliverySliceContractMutation({
              mutation: {
                taskID,
                producer: {
                  kind: "operator_command",
                  operation: "remove",
                  reason: "Remove the atomic publication Slice",
                  target_goal_id: added.goalID!,
                },
                now: now + 4,
                mutation: { operation: "remove", goalID: added.goalID! },
              },
              publication: () => ({ summary: "Goal removed", source: "orchestrator.delete_goal" }),
            }),
          )
          .catch((error) => error)
        removeFailure()
        expect({
          modifyError: rejectedModify instanceof Error ? rejectedModify.message : "not-an-error",
          removeError: rejectedRemove instanceof Error ? rejectedRemove.message : "not-an-error",
          afterModify,
          afterRemove: current(),
        }).toEqual({
          modifyError: expect.stringContaining("injected Delivery Slice task.updated commit failure"),
          removeError: expect.stringContaining("injected Delivery Slice task.updated commit failure"),
          afterModify: { currentGoalIDs: [added.goalID], historicalGoalIDs: [], projectionCount: 1 },
          afterRemove: { currentGoalIDs: [added.goalID], historicalGoalIDs: [], projectionCount: 1 },
        })
      },
    })
  })
})
