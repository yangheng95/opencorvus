import { afterEach, expect, test } from "bun:test"
import { AttachError, attachBaseUrl, attachDirectory, attach } from "../../src/cli/cmd/attach"
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

  expect(AttachError.isInstance(thrown) && thrown.data).toEqual({
    operation: "question list",
    baseUrl: "http://127.0.0.1:7979",
    detail: "Unable to connect",
  })
})

test("attach drops an empty error body instead of rendering it as detail", async () => {
  const server = attach({ url: "http://127.0.0.1:7979" })
  const thrown = await server
    .result("permission list", Promise.resolve({ error: {}, response: new Response(null, { status: 502 }) }))
    .then(
      () => undefined,
      (error: unknown) => error,
    )

  expect(AttachError.isInstance(thrown) && thrown.data).toEqual({
    operation: "permission list",
    baseUrl: "http://127.0.0.1:7979",
    status: 502,
    detail: undefined,
  })
})

test("question JSON answers preserve exact custom text and multi-select values", () => {
  expect(parseQuestionAnswers('[["yes"],["a,b"," c "]]')).toEqual([["yes"], ["a,b", " c "]])
  expect(parseQuestionAnswers('[["Use alpha, then beta"]]')).toEqual([["Use alpha, then beta"]])
})

test("invalid answer JSON and element types produce parser/schema errors", () => {
  expect(() => parseQuestionAnswers("[invalid")).toThrow(SyntaxError)
  expect(() => parseQuestionAnswers("[[1]]")).toThrow("expected string")
})

test("server directory preserves POSIX, drive and UNC absolute paths", () => {
  for (const directory of ["/srv/project", "C:\\projects\\repo", "\\\\server\\share\\repo"]) {
    expect(attachDirectory(directory)).toBe(directory)
  }
})
