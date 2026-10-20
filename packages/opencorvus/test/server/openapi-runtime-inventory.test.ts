import { afterEach, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
  Server.resetProjectRoutesAppForTest()
})

function operationIDs(spec: { paths?: Record<string, any> }) {
  return Object.values(spec.paths ?? {})
    .flatMap((item) =>
      Object.values(item).flatMap((operation: any) =>
        typeof operation?.operationId === "string" ? [operation.operationId] : [],
      ),
    )
    .sort()
}

test("runtime OpenAPI publishes the complete canonical operation inventory and Goal errors", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const response = await Server.App().request(`/doc?directory=${encodeURIComponent(project.path)}`)
      expect(response.status).toBe(200)
      const actual = await response.json()
      const canonical = await Server.openapi()
      expect(operationIDs(actual)).toEqual(operationIDs(canonical))
      expect(actual).toEqual(JSON.parse(JSON.stringify(canonical)))
      for (const method of ["get", "post", "patch"] as const) {
        expect(actual.paths["/continuous-goal/{kind}/{ownerID}"][method].responses["409"]).toMatchObject({
          content: { "application/json": { schema: { properties: { name: { const: "ContinuousGoalError" } } } } },
        })
      }
    },
  })
})

test("concurrent runtime documents retain their full inventory beside the actual Goal error response", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const app = Server.App()
      const outcomes = await Promise.allSettled(
        ["/doc", "/continuous-goal/chat/missing-owner", "/doc"].map(async (path) => {
          const response = await app.request(`${path}?directory=${encodeURIComponent(project.path)}`)
          return { status: response.status, body: await response.json() }
        }),
      )
      const values = outcomes.map((outcome) => {
        if (outcome.status === "rejected") throw outcome.reason
        return outcome.value
      })
      const canonical = JSON.parse(JSON.stringify(await Server.openapi()))
      const expected = operationIDs(canonical)
      expect(values[0]!.body).toEqual(canonical)
      expect(values[2]!.body).toEqual(canonical)
      expect(
        values.map((value, index) =>
          index === 1
            ? { status: value.status, name: value.body.name, code: value.body.data.code }
            : { status: value.status, operations: operationIDs(value.body) },
        ),
      ).toEqual([
        { status: 200, operations: expected },
        { status: 409, name: "ContinuousGoalError", code: "owner_unavailable" },
        { status: 200, operations: expected },
      ])
    },
  })
})
