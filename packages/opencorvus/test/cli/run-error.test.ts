import { expect, test } from "bun:test"
import { NamedError } from "@opencorvus-ai/util/error"
import { isJsonRun, runErrorObject } from "../../src/cli/run-error"
import { resolveRunAgent } from "../../src/cli/cmd/run"

test("run JSON mode recognizes both supported option spellings before startup", () => {
  expect(isJsonRun(["run", "--format", "json", "hello"])).toBe(true)
  expect(isJsonRun(["--log-level", "ERROR", "run", "--format=json", "hello"])).toBe(true)
})

test("run errors preserve the server named error contract", () => {
  const error = { name: "APIError", data: { message: "Provider returned HTTP 401", statusCode: 401 } }
  expect(runErrorObject(error)).toEqual(error)
  expect(runErrorObject(new NamedError.Unknown({ message: "Missing model" }))).toEqual({
    name: "UnknownError",
    data: { message: "Missing model" },
  })
  expect(runErrorObject(new Error("Connection closed"))).toEqual({
    name: "Error",
    data: { message: "Connection closed" },
  })
})

test("explicit chat resolves its public ID outside a project Instance", async () => {
  expect(await resolveRunAgent("chat")).toBe("chat")
  expect(await resolveRunAgent("coding")).toBe("coding")
  await expect(resolveRunAgent("unknown-agent")).rejects.toThrow('agent "unknown-agent" is not a primary assistant')
})
