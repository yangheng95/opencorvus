import { afterEach, expect, test } from "bun:test"
import { AttachError, attachBaseUrl, attach } from "../../src/cli/cmd/attach"
import { parseQuestionAnswers } from "../../src/cli/cmd/question"

const originalUrl = process.env["OPENCORVUS_URL"]

afterEach(() => {
  if (originalUrl === undefined) delete process.env["OPENCORVUS_URL"]
  else process.env["OPENCORVUS_URL"] = originalUrl
})

test("attach base URL prefers the explicit flag over the environment", () => {
  process.env["OPENCORVUS_URL"] = "http://127.0.0.1:1111"
  expect(attachBaseUrl("http://127.0.0.1:2222")).toBe("http://127.0.0.1:2222")
})

test("attach base URL falls back to the environment, then the local default", () => {
  process.env["OPENCORVUS_URL"] = "http://127.0.0.1:1111"
  expect(attachBaseUrl()).toBe("http://127.0.0.1:1111")

  delete process.env["OPENCORVUS_URL"]
  expect(attachBaseUrl()).toBe("http://127.0.0.1:7878")
})

test("attach base URL accepts host:port shorthand without inventing https", () => {
  delete process.env["OPENCORVUS_URL"]
  expect(attachBaseUrl("127.0.0.1:7979")).toBe("http://127.0.0.1:7979")
  expect(attachBaseUrl("https://remote.example:443/")).toBe("https://remote.example:443")
})

test("attach surfaces an HTTP failure as a typed error naming the operation and server", async () => {
  const server = attach({ url: "http://127.0.0.1:7979" })
  const failure = Promise.resolve({
    error: { message: "Mission not found: nope" },
    response: new Response(null, { status: 404 }),
  })

  const thrown = await server.result("mission status", failure).then(
    () => undefined,
    (error: unknown) => error,
  )

  expect(AttachError.isInstance(thrown)).toBe(true)
  expect(AttachError.isInstance(thrown) && thrown.data).toMatchObject({
    operation: "mission status",
    baseUrl: "http://127.0.0.1:7979",
    status: 404,
    detail: "Mission not found: nope",
  })
})

test("attach reports an unreachable server without an HTTP status", async () => {
  const server = attach({ url: "http://127.0.0.1:7979" })
  const thrown = await server.result("question list", Promise.reject(new Error("Unable to connect"))).then(
    () => undefined,
    (error: unknown) => error,
  )

  expect(AttachError.isInstance(thrown) && thrown.data).toMatchObject({
    operation: "question list",
    detail: "Unable to connect",
  })
  // No status at all — the CLI renders the "is a server running there?" hint
  // off this absence, so it must not be filled in with a synthesized code.
  expect(AttachError.isInstance(thrown) && thrown.data.status).toBeUndefined()
})

test("attach drops an empty error body instead of rendering it as detail", async () => {
  const server = attach({ url: "http://127.0.0.1:7979" })
  const thrown = await server
    .result("permission list", Promise.resolve({ error: {}, response: new Response(null, { status: 502 }) }))
    .then(
      () => undefined,
      (error: unknown) => error,
    )

  expect(AttachError.isInstance(thrown) && thrown.data.detail).toBeUndefined()
})

test("question answers map one flag per question and comma-split multi-select values", () => {
  expect(parseQuestionAnswers(["yes"])).toEqual([["yes"]])
  expect(parseQuestionAnswers(["yes", "a, b ,c"])).toEqual([["yes"], ["a", "b", "c"]])
})

test("question answers reject an empty selection rather than sending an empty array", () => {
  expect(() => parseQuestionAnswers([])).toThrow("at least one --answer")
  expect(() => parseQuestionAnswers(["ok", " , "])).toThrow("--answer #2 is empty")
})
