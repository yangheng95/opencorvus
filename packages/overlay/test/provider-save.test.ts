import { expect, test } from "bun:test"
import { settleProviderSaveFollowups } from "../src/services/provider-save"

test("credential cleanup settles before successful directory observation", async () => {
  const stages: string[] = []
  const issues = await settleProviderSaveFollowups(
    [
      {
        phase: "config.credential-cleanup",
        run: async () => {
          stages.push("cleanup")
        },
      },
      {
        phase: "provider.reload",
        run: async () => {
          stages.push("reload")
        },
      },
    ],
    () => true,
  )
  expect({ stages, issues }).toEqual({ stages: ["cleanup", "reload"], issues: [] })
})

test("credential settlement retains its commit issues and cleanup error through directory observation", async () => {
  const stages: string[] = []
  const error = new Error("Owned cleanup write failed")
  error.stack = "Error: Owned cleanup write failed"
  const issues = await settleProviderSaveFollowups(
    [
      {
        phase: "auth.save",
        run: async () => {
          stages.push("auth")
          return [{ providerID: "owned", phase: "cache.provider", message: "Owned cache reset failed" }]
        },
      },
      {
        phase: "config.credential-cleanup",
        run: async () => {
          stages.push("cleanup")
          throw error
        },
      },
      {
        phase: "provider.reload",
        run: async () => {
          stages.push("reload")
        },
      },
    ],
    () => true,
  )
  expect({ stages, issues }).toEqual({
    stages: ["auth", "cleanup", "reload"],
    issues: [
      {
        stage: "auth.save",
        phase: "cache.provider",
        providerID: "owned",
        message: "Owned cache reset failed",
      },
      { stage: "config.credential-cleanup", message: "Error: Owned cleanup write failed" },
    ],
  })
})

test("independent write and read rejections retain their ordered phase results", async () => {
  const errors = [new Error("Owned credential write failure"), new Error("Owned directory read failure")]
  for (const error of errors) error.stack = `${error.name}: ${error.message}`
  expect(
    await settleProviderSaveFollowups(
      [
        {
          phase: "auth.save",
          run: async () => {
            throw errors[0]
          },
        },
        {
          phase: "provider.reload",
          run: async () => {
            throw errors[1]
          },
        },
      ],
      () => true,
    ),
  ).toEqual([
    { stage: "auth.save", message: "Error: Owned credential write failure" },
    { stage: "provider.reload", message: "Error: Owned directory read failure" },
  ])
})

test("retired ownership retains the already dispatched stage result", async () => {
  let current = true
  const stages: string[] = []
  expect(
    await settleProviderSaveFollowups(
      [
        {
          phase: "auth.save",
          run: async () => {
            stages.push("auth")
            current = false
            return [{ message: "Accepted original write result" }]
          },
        },
        {
          phase: "provider.reload",
          run: async () => {
            stages.push("reload")
            return []
          },
        },
      ],
      () => current,
    ),
  ).toEqual([{ stage: "auth.save", message: "Accepted original write result" }])
  expect(stages).toEqual(["auth"])
})
