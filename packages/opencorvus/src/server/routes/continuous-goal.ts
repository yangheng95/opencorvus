import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import z from "zod"
import { validator } from "@/server/validator"
import { ContinuousGoalCreate, ContinuousGoalUpdate, ContinuousGoalView } from "@/continuous-goal/schema"
import {
  createContinuousGoal,
  readContinuousGoal,
  updateContinuousGoal,
  resolveGoalOwner,
} from "@/continuous-goal/store"
import { namedErrorResponse } from "@/server/error"

const OwnerParams = z.object({ kind: z.enum(["chat", "task", "mission"]), ownerID: z.string().min(1) })
const response = {
  description: "Current durable continuous goal. Budgets stop new automatic turns; accepted work may settle.",
  content: { "application/json": { schema: resolver(ContinuousGoalView.nullable()) } },
}
export function ContinuousGoalRoutes() {
  return new Hono()
    .get(
      "/:kind/:ownerID",
      describeRoute({
        summary: "Read continuous goal",
        operationId: "continuousGoal.get",
        description:
          "Read the ongoing goal for a Chat Session, Task or Mission Session in the selected Project, including archived owners. Reading does not restore or resume the owner. Separate from Delivery Slice Goals.",
        responses: {
          200: response,
          409: namedErrorResponse("Goal owner or revision conflict.", "ContinuousGoalError"),
        },
      }),
      validator("param", OwnerParams),
      async (c) => {
        const { kind, ownerID: id } = c.req.valid("param")
        return c.json(readContinuousGoal(resolveGoalOwner({ kind, id }, { includeArchived: true })) ?? null)
      },
    )
    .post(
      "/:kind/:ownerID",
      describeRoute({
        summary: "Create continuous goal",
        operationId: "continuousGoal.create",
        description:
          "Explicitly authorize an ongoing goal on an existing owner. requestID is idempotent; one unresolved goal per execution scope.",
        responses: { 200: response, 409: namedErrorResponse("Goal owner or request conflict.", "ContinuousGoalError") },
      }),
      validator("param", OwnerParams),
      validator("json", ContinuousGoalCreate),
      async (c) => {
        const { kind, ownerID: id } = c.req.valid("param")
        return c.json(createContinuousGoal(resolveGoalOwner({ kind, id }), c.req.valid("json"), "user"))
      },
    )
    .patch(
      "/:kind/:ownerID",
      describeRoute({
        summary: "Update continuous goal",
        operationId: "continuousGoal.update",
        description:
          "Pause, explicitly resume, block, complete or change explicit budgets using the exact current goal ID and revision. Usage remains cumulative.",
        responses: {
          200: response,
          409: namedErrorResponse("Goal owner, state or revision conflict.", "ContinuousGoalError"),
        },
      }),
      validator("param", OwnerParams),
      validator("json", ContinuousGoalUpdate),
      async (c) => {
        const { kind, ownerID: id } = c.req.valid("param")
        return c.json(updateContinuousGoal(resolveGoalOwner({ kind, id }), c.req.valid("json"), "user"))
      },
    )
}
