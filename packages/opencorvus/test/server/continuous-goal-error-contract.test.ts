import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { generateSpecs } from "hono-openapi"
import { ContinuousGoalError } from "@/continuous-goal/schema"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { ContinuousGoalRoutes } from "@/server/routes/continuous-goal"
import { serverErrorResponse } from "@/server/error-handler"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

const cases = [
  { method: "get", code: "owner_unavailable", description: "Goal owner or revision conflict." },
  { method: "post", code: "conflict", description: "Goal owner or request conflict." },
  { method: "patch", code: "revision_conflict", description: "Goal owner, state or revision conflict." },
] as const

for (const contract of cases) {
  test(`Goal ${contract.method.toUpperCase()} documents its actual named conflict response`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const app = new Hono().onError(serverErrorResponse).route("/continuous-goal", ContinuousGoalRoutes())
        const session = await Session.create({ kind: "assistant" })
        const url = `/continuous-goal/chat/${session.id}`
        const initial = await app.request(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestID: "initial", objective: "Goal error contract", turnBudget: 1 }),
        })
        expect(initial.status).toBe(200)
        const goal = await initial.json()
        const body =
          contract.method === "post"
            ? { requestID: "second", objective: "Another unresolved goal" }
            : contract.method === "patch"
              ? {
                  requestID: "stale",
                  goalID: goal.id,
                  expectedRevision: "stale",
                  status: "paused",
                  reason: "Operator pause",
                }
              : undefined
        const response = await app.request(contract.method === "get" ? "/continuous-goal/chat/missing-owner" : url, {
          method: contract.method.toUpperCase(),
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        })
        const actual = ContinuousGoalError.Schema.parse(await response.json())
        expect({ status: response.status, name: actual.name, code: actual.data.code }).toEqual({
          status: 409,
          name: "ContinuousGoalError",
          code: contract.code,
        })
        const spec = await generateSpecs(app)
        expect(spec.paths?.["/continuous-goal/{kind}/{ownerID}"]?.[contract.method]?.responses?.["409"]).toMatchObject({
          description: contract.description,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { name: { const: actual.name } },
                required: ["name", "data"],
              },
            },
          },
        })
      },
    })
  })
}
